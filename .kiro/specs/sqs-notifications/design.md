# Design Document: SQS Notifications

## Overview

This design replaces the in-process `ConcurrentQueue<string>` inside `NotificationService` with real AWS SQS calls to the pre-existing FIFO queue `contoso.fifo`. The change is entirely contained within the service layer and its DI wiring. No controllers, models, views, or frontend assets change.

The AWS SDK for .NET (`AWSSDK.SQS`) provides `IAmazonSQS` / `AmazonSQSClient`. Credentials are resolved at runtime via the AWS SDK default credential chain (environment variables → ECS/EC2 instance profile → `~/.aws/credentials`), so no credential material appears in source code or configuration files.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ASP.NET Core MVC Request Pipeline                          │
│                                                             │
│  ┌──────────────┐        ┌──────────────────────────────┐  │
│  │ BaseController│◄──DI──│ NotificationService           │  │
│  │ (abstract)   │        │  + IAmazonSQS (singleton)    │  │
│  └──────┬───────┘        │  + IConfiguration (scoped)   │  │
│         │                └──────────────┬───────────────┘  │
│         │ inherits                       │ async calls      │
│         ▼                               ▼                   │
│  Feature Controllers         AWS SQS FIFO Queue             │
│  (Courses, Students…)        contoso.fifo                   │
└─────────────────────────────────────────────────────────────┘
```

Key architectural decisions:

- `IAmazonSQS` is registered as a **singleton** — the SDK client is thread-safe and designed to be reused across requests. Creating a new client per request would be wasteful and is an AWS SDK anti-pattern.
- `NotificationService` remains **scoped** (per-request) because it reads configuration once per construction and has no shared mutable state once the queue is removed.
- All SQS calls are **fire-and-forget**: the callers do not await results and exceptions are swallowed inside the service, matching the existing behavior and the stated requirement for no extensive error handling.

---

## Components and Interfaces

### 1. `ContosoUniversity.csproj`

Add one `PackageReference`:

```xml
<PackageReference Include="AWSSDK.SQS" Version="3.7.*" />
```

The `3.7.*` line matches the current AWS SDK v3 for .NET, which is the stable, long-term-supported branch.

### 2. `appsettings.json`

Replace the `AppSettings` block:

```json
"AppSettings": {
  "SqsQueueUrl": "https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo"
}
```

The old `NotificationQueuePath` key is removed entirely.

### 3. `Program.cs` — DI Registration

Add after the existing service registrations:

```csharp
using Amazon.SQS;

// Register AWS SQS client — singleton, credentials from default credential chain
builder.Services.AddSingleton<IAmazonSQS, AmazonSQSClient>();
```

No `AmazonSQSConfig` or region override is needed because the queue URL encodes the region (`us-east-1`) and the SDK resolves the region from the URL automatically when a full queue URL is used in API calls.

### 4. `NotificationService.cs` — Replacement Implementation

**Constructor signature:**

```csharp
public NotificationService(IAmazonSQS sqsClient, IConfiguration configuration)
```

The `ConcurrentQueue<string>` field is removed. The constructor reads and validates `AppSettings:SqsQueueUrl` at construction time, throwing `InvalidOperationException` if absent or empty.

**SendNotification (async, fire-and-forget via `Task.Run`):**

```csharp
public void SendNotification(string entityType, string entityId,
    string entityDisplayName, EntityOperation operation, string userName = null)
{
    try
    {
        var notification = new Notification { /* ... populate fields ... */ };
        var body = JsonConvert.SerializeObject(notification);
        var dedupeId = ComputeDeduplicationId(notification);

        var request = new SendMessageRequest
        {
            QueueUrl             = _queueUrl,
            MessageBody          = body,
            MessageGroupId       = notification.EntityType,
            MessageDeduplicationId = dedupeId
        };

        // Fire-and-forget: exceptions caught below
        _sqsClient.SendMessageAsync(request)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                    Debug.WriteLine($"Failed to send SQS notification: {t.Exception?.GetBaseException().Message}");
            });
    }
    catch (Exception ex)
    {
        Debug.WriteLine($"Failed to send notification: {ex.Message}");
    }
}
```

**ReceiveNotification (synchronous wrapper using `.GetAwaiter().GetResult()`):**

```csharp
public Notification ReceiveNotification()
{
    try
    {
        var request = new ReceiveMessageRequest
        {
            QueueUrl            = _queueUrl,
            MaxNumberOfMessages = 1
        };

        var response = _sqsClient.ReceiveMessageAsync(request).GetAwaiter().GetResult();

        if (response.Messages.Count == 0) return null;

        var msg = response.Messages[0];
        var notification = JsonConvert.DeserializeObject<Notification>(msg.Body);

        _sqsClient.DeleteMessageAsync(_queueUrl, msg.ReceiptHandle)
            .GetAwaiter().GetResult();

        return notification;
    }
    catch (Exception ex)
    {
        Debug.WriteLine($"Failed to receive notification: {ex.Message}");
        return null;
    }
}
```

> **Rationale for synchronous `.GetAwaiter().GetResult()`**: `NotificationsController.GetNotifications` calls `ReceiveNotification` in a `while` loop and returns a `JsonResult` synchronously (it is not an `async Task<IActionResult>`). Changing all controllers to async is out of scope. Using `.GetAwaiter().GetResult()` is acceptable for this bounded, fire-and-forget read path.

**Deduplication ID computation:**

```csharp
private static string ComputeDeduplicationId(Notification n)
{
    var raw = $"{n.EntityType}|{n.EntityId}|{n.Operation}|{n.CreatedAt:O}";
    using var sha = System.Security.Cryptography.SHA256.Create();
    var hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(raw));
    return Convert.ToBase64String(hash)[..43]; // SQS limit: 128 chars; base64(32 bytes)=44, trim trailing '='
}
```

Using a hash of the four identifying fields ensures:
- Same event = same deduplication ID (determinism / idempotence window).
- Different events = different IDs (uniqueness).

### 5. `BaseController.cs` — Constructor Injection

Replace the field initializer and parameterless constructor:

```csharp
public abstract class BaseController : Controller
{
    protected SchoolContext db;
    protected NotificationService notificationService;

    protected BaseController(SchoolContext db, NotificationService notificationService)
    {
        this.db = db;
        this.notificationService = notificationService;
    }
    // ... SendEntityNotification and Dispose unchanged ...
}
```

All derived controllers (`CoursesController`, `StudentsController`, `DepartmentsController`, `InstructorsController`, `HomeController`, `NotificationsController`) must also add matching constructors that accept these parameters and pass them to `base(...)`. ASP.NET Core's DI will inject both automatically because both are registered.

---

## Data Models

No new data models. The existing `Notification` class is serialized to/from JSON as-is. Relevant properties used for FIFO routing:

| Property     | SQS Field              | Notes                                      |
|--------------|------------------------|--------------------------------------------|
| `EntityType` | `MessageGroupId`       | Groups related entity events in FIFO order |
| `EntityType` + `EntityId` + `Operation` + `CreatedAt` | `MessageDeduplicationId` (SHA-256 hash) | Prevents duplicate delivery within 5-minute window |
| Full object  | `MessageBody`          | JSON-serialized `Notification`             |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

PBT is applicable here because `NotificationService` contains pure data-transformation logic (serialization, field mapping, hash computation) that can be exercised with a mocked `IAmazonSQS` at very low cost.

---

### Property 1: Send/Receive Round-Trip Preserves Notification Data

*For any* valid `Notification` object, serializing it to JSON (as done by `SendNotification`) and then deserializing that same JSON (as done by `ReceiveNotification`) SHALL produce a `Notification` object with equivalent field values.

**Validates: Requirements 5.1, 6.2**

---

### Property 2: MessageGroupId Equals EntityType

*For any* `Notification` with any `EntityType` value, the `MessageGroupId` set on the `SendMessageRequest` SHALL equal the `EntityType` of that notification.

**Validates: Requirements 5.3**

---

### Property 3: MessageDeduplicationId Is Deterministic and Unique

*For any* two `Notification` objects: if they share the same `EntityType`, `EntityId`, `Operation`, and `CreatedAt` values then their computed `MessageDeduplicationId` values SHALL be identical; and if any one of those four fields differs between the two notifications, their `MessageDeduplicationId` values SHALL differ.

**Validates: Requirements 5.4**

---

### Property 4: Received Message Is Deleted Using Its ReceiptHandle

*For any* SQS message with any `ReceiptHandle` string returned by `ReceiveMessageAsync`, `DeleteMessageAsync` SHALL be called with that exact `ReceiptHandle`.

**Validates: Requirements 6.3**

---

## Error Handling

In line with the stated requirement for basic fire-and-forget behavior:

- `SendNotification`: exceptions from `SendMessageAsync` are caught in a `ContinueWith` continuation and written to `Debug.WriteLine`. They do not propagate to the controller.
- `ReceiveNotification`: exceptions from `ReceiveMessageAsync` or `DeleteMessageAsync` are caught in the outer `try/catch` and `null` is returned.
- Missing `SqsQueueUrl` configuration: `InvalidOperationException` thrown at construction time, which surfaces as a 500 during application startup — this is intentional so misconfiguration is visible immediately.

---

## Testing Strategy

This feature involves pure data-transformation logic (serialization, field mapping, hash computation) wrapped around a mockable AWS SDK interface, which makes it well-suited for property-based testing.

**Property-Based Testing Library**: [FsCheck](https://fscheck.github.io/FsCheck/) for .NET (NuGet: `FsCheck` + `FsCheck.Xunit` or `FsCheck.NUnit`). FsCheck is the standard PBT library for .NET and integrates cleanly with xUnit/NUnit. Each property test must be configured to run a minimum of 100 iterations.

**Mock Library**: [Moq](https://github.com/moq/moq4) for mocking `IAmazonSQS`.

### Unit / Example Tests

- `NotificationService` constructor throws `InvalidOperationException` when `SqsQueueUrl` is absent or empty (Requirement 3.3).
- `SendNotification` calls `SendMessageAsync` with the configured queue URL (Requirement 5.2).
- `SendNotification` does not propagate exceptions from `SendMessageAsync` (Requirement 5.5).
- `ReceiveNotification` passes `MaxNumberOfMessages = 1` to `ReceiveMessageAsync` (Requirement 6.1).
- `ReceiveNotification` returns `null` when the SQS response contains no messages (Requirement 6.4).
- `ReceiveNotification` returns `null` and does not propagate exceptions when SQS throws (Requirement 6.5).

### Property Tests (minimum 100 iterations each)

Each test is tagged with the format: **Feature: sqs-notifications, Property {N}: {property_text}**

- Property 1: Send/Receive Round-Trip Preserves Notification Data — generate arbitrary `Notification` instances; serialize; deserialize; assert field equivalence.
- Property 2: MessageGroupId Equals EntityType — generate `Notification` with arbitrary `EntityType`; capture `SendMessageRequest`; assert `MessageGroupId == EntityType`.
- Property 3: MessageDeduplicationId Is Deterministic and Unique — generate pairs of `Notification`; assert ID stability and ID divergence per four-field key.
- Property 4: Received Message Is Deleted Using Its ReceiptHandle — generate messages with arbitrary `ReceiptHandle`; mock `ReceiveMessageAsync`; call `ReceiveNotification`; assert `DeleteMessageAsync` received the same handle.
