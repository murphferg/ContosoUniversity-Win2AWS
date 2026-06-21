# Design Document: Notification Microservice

## Overview

This design extracts the notification functionality from the Contoso University monolith into a standalone .NET 8 Web API project (`ContosoUniversity.NotificationService`). The new microservice owns all SQS interaction and exposes three HTTP endpoints for publishing notifications, polling pending notifications, and marking notifications as read. The monolith's internal `NotificationService` and its direct `IAmazonSQS` dependency are replaced by a typed HTTP client (`NotificationClient`) that delegates to the microservice over HTTP.

The split is motivated by independent deployability: the microservice can be updated, scaled, or replaced without touching the monolith, and the monolith is decoupled from AWS SDK versioning and SQS configuration.

### Key Design Decisions

- **No shared assembly**: The microservice defines its own `Notification` model and `EntityOperation` enum. Both sides carry identical definitions rather than sharing a class library, keeping deployment units fully independent.
- **Async controller actions in the microservice**: The new Web API is green-field, so all controller actions are properly `async Task<IActionResult>`, eliminating the synchronous `.GetAwaiter().GetResult()` pattern used in the monolith's current code.
- **Fire-and-forget send in the microservice**: The send endpoint still uses a fire-and-forget approach (returns `202 Accepted` before SQS confirms), matching the existing non-blocking behaviour the monolith controllers rely on.
- **Typed HTTP client in the monolith**: `IHttpClientFactory` / `AddHttpClient<T>` is the .NET recommended pattern for outbound HTTP. It handles lifetime management of `HttpClient` instances and integrates cleanly with DI.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Contoso University Monolith (net8.0 MVC)                            │
│                                                                      │
│  ┌────────────────────┐    ┌──────────────────────────────────────┐  │
│  │  BaseController    │◄───│  NotificationClient (typed HTTP)     │  │
│  │  (abstract)        │    │  - SendNotification(...)             │  │
│  └────────┬───────────┘    │  - GetNotifications(max)             │  │
│           │ inherits       │  - MarkAsRead(id)                    │  │
│           ▼                └──────────────┬───────────────────────┘  │
│  Feature Controllers                      │ HTTP (REST)               │
│  (Courses, Students, …)                   │                           │
│  NotificationsController                  │                           │
└───────────────────────────────────────────┼──────────────────────────┘
                                            │
                           ┌────────────────▼────────────────────────┐
                           │  ContosoUniversity.NotificationService  │
                           │  (net8.0 Web API, :5001)                │
                           │                                         │
                           │  POST /api/notifications                │
                           │  GET  /api/notifications[?max=N]        │
                           │  POST /api/notifications/{id}/mark-read │
                           │  GET  /health                           │
                           │                                         │
                           │  ┌─────────────────────────────────┐   │
                           │  │  NotificationService (scoped)   │   │
                           │  │  + IAmazonSQS (singleton)       │   │
                           │  └──────────────┬──────────────────┘   │
                           └─────────────────┼───────────────────────┘
                                             │ AWS SDK calls
                                             ▼
                                   AWS SQS FIFO Queue
                                   contoso.fifo
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `NotificationClient` (Monolith) | Translates in-process calls into HTTP requests; handles errors silently |
| `NotificationsController` (Microservice) | Routes HTTP requests; validates input; maps to service calls |
| `NotificationService` (Microservice) | Owns all SQS interaction; serializes/deserializes; computes deduplication IDs |
| `IAmazonSQS` (Microservice) | AWS SDK singleton; credentials from default credential chain |

---

## Components and Interfaces

### 1. `ContosoUniversity.NotificationService` Project

**Project file** (`ContosoUniversity.NotificationService.csproj`):

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="AWSSDK.SQS" Version="3.7.*" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.4" />
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.*" />
  </ItemGroup>
</Project>
```

**`launchSettings.json`** (default port 5001):

```json
{
  "profiles": {
    "http": {
      "commandName": "Project",
      "applicationUrl": "http://localhost:5001",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

**`Dockerfile`**:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5001

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["ContosoUniversity.NotificationService.csproj", "."]
RUN dotnet restore
COPY . .
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ContosoUniversity.NotificationService.dll"]
```

---

### 2. Microservice — `NotificationsController`

Handles HTTP routing and request/response mapping. Delegates all business logic to `NotificationService`.

```csharp
[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly NotificationService _service;

    public NotificationsController(NotificationService service)
        => _service = service;

    // POST /api/notifications
    [HttpPost]
    public async Task<IActionResult> Send([FromBody] SendNotificationRequest request);

    // GET /api/notifications?max=N
    [HttpGet]
    public async Task<IActionResult> Receive([FromQuery] int max = 10);

    // POST /api/notifications/{id}/mark-read
    [HttpPost("{id}/mark-read")]
    public IActionResult MarkAsRead(int id);
}
```

Validation flow for `Send`:
- Model binding validation (DataAnnotations on `SendNotificationRequest`) returns `400 Bad Request` automatically via `[ApiController]` when required fields are null or fail constraints.
- On success: returns `202 Accepted`.
- On `SqsException`: returns `503 Service Unavailable` with `{ "message": "..." }`.

---

### 3. Microservice — `NotificationService`

Owns SQS interaction, serialization, and deduplication ID computation.

```csharp
public class NotificationService
{
    private readonly IAmazonSQS _sqsClient;
    private readonly string _queueUrl;

    public NotificationService(IAmazonSQS sqsClient, IConfiguration configuration)
    {
        _queueUrl = configuration["AppSettings:SqsQueueUrl"];
        if (string.IsNullOrWhiteSpace(_queueUrl))
            throw new InvalidOperationException(
                "Configuration key 'AppSettings:SqsQueueUrl' is absent or empty.");
        _sqsClient = sqsClient;
    }

    public async Task<bool> SendNotificationAsync(SendNotificationRequest request);
    public async Task<List<Notification>> ReceiveNotificationsAsync(int max);
    // MarkAsRead is a no-op in initial implementation
    public void MarkAsRead(int id) { }
}
```

**`SendNotificationAsync`** constructs a `Notification`, serializes it to JSON, and calls `SendMessageAsync`. Returns `true` on success, throws on SQS failure (the controller converts the exception to a 503).

**`ReceiveNotificationsAsync`** loops calling `ReceiveMessageAsync` with `MaxNumberOfMessages = 1` until `max` messages are collected or SQS returns an empty batch. Each iteration: deserialize body, call `DeleteMessageAsync` with the message's `ReceiptHandle`, add to result list. On any exception: log, return partial results.

**Deduplication ID** (SHA-256 of four fields, Base64 truncated to 43 chars — same algorithm as the existing monolith):

```csharp
private static string ComputeDeduplicationId(Notification n)
{
    var raw = $"{n.EntityType}|{n.EntityId}|{n.Operation}|{n.CreatedAt:O}";
    using var sha = SHA256.Create();
    var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
    return Convert.ToBase64String(hash)[..43];
}
```

---

### 4. Microservice — `Program.cs`

```csharp
using Amazon.SQS;
using ContosoUniversity.NotificationService.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddNewtonsoftJson();                     // Newtonsoft.Json for all JSON I/O

builder.Services.AddSingleton<IAmazonSQS, AmazonSQSClient>();
builder.Services.AddScoped<NotificationService>();

builder.Services.AddHealthChecks();

var app = builder.Build();
app.MapControllers();
app.MapHealthChecks("/health");
app.Run();
```

---

### 5. Monolith — `NotificationClient`

A typed HTTP client registered via `AddHttpClient<NotificationClient>`. Reads `AppSettings:NotificationServiceBaseUrl` from configuration.

```csharp
public class NotificationClient
{
    private readonly HttpClient _httpClient;

    public NotificationClient(HttpClient httpClient, IConfiguration configuration)
    {
        var baseUrl = configuration["AppSettings:NotificationServiceBaseUrl"];
        httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient = httpClient;
    }

    public void SendNotification(string entityType, string entityId,
        string entityDisplayName, EntityOperation operation, string userName);

    public List<Notification> GetNotifications(int max = 10);

    public void MarkAsRead(int id);
}
```

All methods are fire-and-forget wrappers: exceptions and non-success responses are caught, logged via `Debug.WriteLine`, and safe defaults returned (no exception propagation to callers).

DI registration in monolith `Program.cs`:

```csharp
builder.Services.AddHttpClient<NotificationClient>();
```

---

### 6. Monolith — `BaseController` Changes

Replace the `NotificationService` field and constructor parameter with `NotificationClient`:

```csharp
public abstract class BaseController : Controller
{
    protected SchoolContext db;
    protected NotificationClient notificationClient;

    protected BaseController(SchoolContext db, NotificationClient notificationClient)
    {
        this.db = db;
        this.notificationClient = notificationClient;
    }

    protected void SendEntityNotification(string entityType, string entityId,
        string entityDisplayName, EntityOperation operation)
    {
        try
        {
            var userName = "System";
            notificationClient.SendNotification(entityType, entityId, entityDisplayName, operation, userName);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to send notification: {ex.Message}");
        }
    }
}
```

All derived controllers (`CoursesController`, `StudentsController`, `DepartmentsController`, `InstructorsController`, `HomeController`, `NotificationsController`) update their constructors to accept `NotificationClient` and pass it to `base(...)`.

---

### 7. Monolith — `NotificationsController` Changes

Replace the two `notificationService` calls:

```csharp
// Before:
while ((notification = notificationService.ReceiveNotification()) != null) { ... }
notificationService.MarkAsRead(id);

// After:
var notifications = notificationClient.GetNotifications(10);
foreach (var notification in notifications) { ... }
notificationClient.MarkAsRead(id);
```

---

### 8. Monolith — `appsettings.json` Changes

```json
// Remove:
"AppSettings": {
  "SqsQueueUrl": "https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo"
}

// Add:
"AppSettings": {
  "NotificationServiceBaseUrl": "http://localhost:5001"
}
```

---

## Data Models

### `Notification` (defined independently in both microservice and monolith)

| Property | Type | Constraints | Notes |
|---|---|---|---|
| `Id` | `int` | — | Not set by microservice send path |
| `EntityType` | `string` | max 100, required | Also used as SQS `MessageGroupId` |
| `EntityId` | `string` | max 50, required | |
| `Operation` | `string` | max 20, required | String form of `EntityOperation` enum |
| `Message` | `string` | max 256, required | Human-readable description |
| `CreatedAt` | `DateTime` | UTC | ISO 8601 round-trip format in JSON |
| `CreatedBy` | `string` | max 100, optional | |
| `IsRead` | `bool` | — | Defaults to `false` |
| `ReadAt` | `DateTime?` | nullable | |

### `SendNotificationRequest` (microservice input contract)

| Property | Type | Constraints |
|---|---|---|
| `EntityType` | `string` | max 100, required |
| `EntityId` | `string` | max 50, required |
| `EntityDisplayName` | `string?` | nullable |
| `Operation` | `EntityOperation` | required |
| `CreatedBy` | `string?` | max 100, optional |

### `NotificationResponse` (microservice GET response)

```json
{
  "success": true,
  "notifications": [ { ...Notification... } ],
  "count": 3
}
```

### SQS Field Mapping

| `Notification` Field | SQS `SendMessageRequest` Field | Notes |
|---|---|---|
| `EntityType` | `MessageGroupId` | Groups events for same entity type in FIFO order |
| `EntityType + EntityId + Operation + CreatedAt` | `MessageDeduplicationId` | SHA-256 hash, Base64 truncated to 43 chars |
| Full object (JSON) | `MessageBody` | Newtonsoft.Json with ISO 8601 DateTime |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

PBT applies here because the microservice contains pure data-transformation logic (field mapping, serialization, hash computation, loop invariants) that is cost-effective to test at 100+ iterations using a mocked `IAmazonSQS`.

---

### Property 1: Notification Field Construction

*For any* valid `SendNotificationRequest` with any `EntityType`, `EntityId`, `EntityDisplayName`, `Operation`, and `CreatedBy` values, the `Notification` object constructed by `NotificationService.SendNotificationAsync` SHALL have: `EntityType` equal to `request.EntityType`, `EntityId` equal to `request.EntityId`, `Operation` equal to `request.Operation.ToString()`, `IsRead` equal to `false`, `CreatedAt` close to the UTC time of the call, and `Message` containing both the entity type and the display name (or entity ID fallback).

**Validates: Requirements 4.2**

---

### Property 2: MessageGroupId Equals EntityType

*For any* `SendNotificationRequest` with any `EntityType` value, the `SendMessageRequest` passed to `IAmazonSQS.SendMessageAsync` SHALL have `MessageGroupId` equal to the notification's `EntityType`.

**Validates: Requirements 4.3**

---

### Property 3: Deduplication ID Is Deterministic and Unique

*For any* two `Notification` objects: if all four fields (`EntityType`, `EntityId`, `Operation`, `CreatedAt`) are equal, their computed `MessageDeduplicationId` values SHALL be identical; if any one of those four fields differs, their IDs SHALL differ. Additionally, for any `Notification`, the computed ID SHALL be exactly 43 characters long and contain only Base64 characters.

**Validates: Requirements 4.4**

---

### Property 4: Invalid Request Returns HTTP 400

*For any* `SendNotificationRequest` with at least one null or empty required field (`EntityType`, `EntityId`, or `Operation`), the `POST /api/notifications` endpoint SHALL return HTTP `400 Bad Request` with a JSON body that contains a `message` or validation error field.

**Validates: Requirements 4.7**

---

### Property 5: Receive Loop Count Matches Queue Depth

*For any* mocked SQS queue with N messages (0 ≤ N ≤ 15) and a request with `max` M (1 ≤ M ≤ 10), the `GET /api/notifications` endpoint SHALL return exactly `min(N, M)` notifications and SHALL have called `ReceiveMessageAsync` with `MaxNumberOfMessages = 1` on each loop iteration.

**Validates: Requirements 5.2**

---

### Property 6: Receive Preserves Notification Data and Uses ReceiptHandle

*For any* `Notification` object serialized to a mock SQS message body with any `ReceiptHandle`, calling `ReceiveNotificationsAsync` SHALL return a notification with all field values equal to the original, and SHALL call `DeleteMessageAsync` with exactly that `ReceiptHandle`.

**Validates: Requirements 5.3, 11.2**

---

### Property 7: MarkRead Returns 200 for Any Id

*For any* integer `id`, calling `POST /api/notifications/{id}/mark-read` SHALL return HTTP `200 OK` with a JSON body `{ "success": true }`, and SHALL NOT make any calls to `IAmazonSQS`.

**Validates: Requirements 6.2, 6.3**

---

### Property 8: Notification Client Send Constructs Correct Request

*For any* combination of `entityType`, `entityId`, `entityDisplayName`, `operation`, and `userName` parameters, `NotificationClient.SendNotification` SHALL issue an HTTP `POST` request to `{baseUrl}/api/notifications` with a JSON body whose fields match those parameters.

**Validates: Requirements 9.2**

---

### Property 9: Notification Client GetNotifications Constructs Correct URL

*For any* integer `max` value, `NotificationClient.GetNotifications(max)` SHALL issue an HTTP `GET` request to `{baseUrl}/api/notifications?max={max}` and SHALL return a `List<Notification>` equal to the deserialized `notifications` array in the response body.

**Validates: Requirements 9.3**

---

### Property 10: Notification Client MarkAsRead Constructs Correct URL

*For any* integer `id`, `NotificationClient.MarkAsRead(id)` SHALL issue an HTTP `POST` request to `{baseUrl}/api/notifications/{id}/mark-read`.

**Validates: Requirements 9.4**

---

### Property 11: Serialization Round-Trip Preserves All Fields

*For any* valid `Notification` object with any field values (including `DateTime` values at full tick precision), serializing it to JSON using `Newtonsoft.Json` with ISO 8601 round-trip format and then deserializing from that same JSON SHALL produce a `Notification` object with all field values equal to the original, including `CreatedAt` and `ReadAt` precision.

**Validates: Requirements 11.2, 11.3**

---

## Error Handling

| Scenario | Component | Behavior |
|---|---|---|
| `SqsQueueUrl` absent or empty at startup | Microservice `NotificationService` constructor | Throws `InvalidOperationException` — surfaces as startup failure |
| `SendMessageAsync` throws | Microservice `NotificationsController.Send` | Catches exception, returns HTTP `503` with `{ "message": "..." }` |
| `ReceiveMessageAsync` or `DeleteMessageAsync` throws mid-loop | Microservice `NotificationService.ReceiveNotificationsAsync` | Stops loop, logs to `ILogger`, returns partial results collected so far |
| HTTP call from `NotificationClient` throws | Monolith `NotificationClient` | Caught, logged via `Debug.WriteLine`, safe default returned (empty list / no-op) |
| Non-success HTTP status from microservice | Monolith `NotificationClient` | Same as above — not propagated to caller |
| Null/missing required fields in `SendNotificationRequest` | Microservice `[ApiController]` model validation | Returns HTTP `400` automatically with field-level validation errors |

---

## Testing Strategy

### Property-Based Testing Library

[FsCheck](https://fscheck.github.io/FsCheck/) with [FsCheck.Xunit](https://www.nuget.org/packages/FsCheck.Xunit/) for .NET. FsCheck is the established PBT library for .NET, integrates natively with xUnit via `[Property]` attributes, and supports custom generators for domain types.

Each property test MUST be configured to run a minimum of 100 iterations (FsCheck's default is 100; use `MaxTest = 100` explicitly in `Arbitrary<T>` configurations to document intent).

**Mock Library**: [Moq](https://github.com/moq/moq4) for mocking `IAmazonSQS` and `HttpMessageHandler`.

Tag format for each property test:
`// Feature: notification-microservice, Property {N}: {property_text}`

---

### Microservice Unit and Property Tests

**Example / Edge-Case Tests:**
- `NotificationService` constructor throws `InvalidOperationException` for null, empty, and whitespace-only `SqsQueueUrl` (Requirement 3.2)
- `Send` endpoint returns `202 Accepted` when `SendMessageAsync` succeeds (Requirement 4.5)
- `Send` endpoint returns `503` when `SendMessageAsync` throws (Requirement 4.6)
- `Receive` endpoint returns `200` with `{ notifications, count, success }` shape (Requirement 5.4)
- `Receive` endpoint stops loop and returns partial results when SQS throws mid-loop (Requirement 5.5)
- `/health` endpoint returns `200` with `{ "status": "healthy" }` (Requirements 7.1, 7.2)
- `MarkRead` endpoint never calls `IAmazonSQS` (Requirement 6.3)

**Property Tests (minimum 100 iterations each):**
- Property 1: Notification Field Construction (mock `IAmazonSQS`; capture constructed `Notification`)
- Property 2: MessageGroupId Equals EntityType (mock `IAmazonSQS`; capture `SendMessageRequest`)
- Property 3: Deduplication ID Is Deterministic and Unique (no mock needed; pure function)
- Property 4: Invalid Request Returns HTTP 400 (use `WebApplicationFactory`; generate invalid requests)
- Property 5: Receive Loop Count Matches Queue Depth (mock `IAmazonSQS` to return N messages then empty)
- Property 6: Receive Preserves Data and Uses ReceiptHandle (mock `IAmazonSQS` with generated messages)
- Property 7: MarkRead Returns 200 for Any Id (use `WebApplicationFactory`; generate arbitrary int ids)
- Property 11: Serialization Round-Trip (no mock; pure Newtonsoft.Json test)

---

### Monolith Unit and Property Tests

**Example / Edge-Case Tests:**
- `NotificationClient` constructor reads `NotificationServiceBaseUrl` from config (Requirement 9.6)
- `NotificationClient.SendNotification` does not propagate exceptions (Requirement 9.5)
- `NotificationClient.GetNotifications` returns empty list on non-success HTTP (Requirement 9.5)
- `BaseController.SendEntityNotification` delegates to `NotificationClient.SendNotification` (Requirement 10.2)
- `NotificationsController.GetNotifications` calls `notificationClient.GetNotifications(10)` (Requirement 10.3)

**Property Tests (minimum 100 iterations each):**
- Property 8: Notification Client Send Constructs Correct Request (mock `HttpMessageHandler`; generate arbitrary parameters)
- Property 9: Notification Client GetNotifications Constructs Correct URL (mock `HttpMessageHandler`; generate arbitrary `max` values and response bodies)
- Property 10: Notification Client MarkAsRead Constructs Correct URL (mock `HttpMessageHandler`; generate arbitrary integer ids)

---

### Integration Tests

- Full round-trip: monolith sends notification → microservice publishes to SQS → monolith polls → notification returned (requires localstack or real SQS queue)
- Microservice starts with valid AWS credentials and connects to SQS (smoke test against localstack)
