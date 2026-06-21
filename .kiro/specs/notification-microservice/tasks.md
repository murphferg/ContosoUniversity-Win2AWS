# Implementation Plan: Notification Microservice

## Overview

Extract notification logic from the Contoso University monolith into a standalone .NET 8 Web API project (`ContosoUniversity.NotificationService`). The microservice owns all SQS interaction and exposes HTTP endpoints for publishing, polling, and marking notifications as read. The monolith is updated to use a typed HTTP client (`NotificationClient`) that delegates to the microservice over HTTP.

## Tasks

- [x] 1. Create the microservice project structure and data models
  - Create `ContosoUniversity.NotificationService` as a new .NET 8 Web API project
  - Add `PackageReference` entries for `AWSSDK.SQS` (3.7.*), `Newtonsoft.Json` (13.0.4), and `Microsoft.AspNetCore.OpenApi` (8.0.*)
  - Configure `launchSettings.json` with `applicationUrl` defaulting to `http://localhost:5001`
  - Create `Dockerfile` using `mcr.microsoft.com/dotnet/aspnet:8.0` base image with multi-stage build
  - Define `Notification` class with all required properties: `Id`, `EntityType`, `EntityId`, `Operation`, `Message`, `CreatedAt`, `CreatedBy`, `IsRead`, `ReadAt`
  - Define `EntityOperation` enum with `CREATE`, `UPDATE`, and `DELETE` values
  - Define `SendNotificationRequest` record with required fields and DataAnnotations for validation
  - Define `NotificationResponse` DTO with `notifications` array, `count`, and `success` fields
  - Create `appsettings.json` with `AppSettings:SqsQueueUrl` defaulting to the production queue URL
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1_

- [x] 2. Implement the microservice `NotificationService` and SQS integration
  - [x] 2.1 Implement `NotificationService` class with constructor validation and `SendNotificationAsync`
    - Inject `IAmazonSQS` and `IConfiguration`; read `AppSettings:SqsQueueUrl` and throw `InvalidOperationException` if absent or empty
    - Implement `SendNotificationAsync`: construct `Notification`, set `CreatedAt` to UTC now, `IsRead` to false, compose `Message` as `"[EntityType] '[EntityDisplayName]' was [Operation]"`
    - Implement `ComputeDeduplicationId` using SHA-256 of `EntityType|EntityId|Operation|CreatedAt:O`, Base64-encoded truncated to 43 chars
    - Call `SendMessageAsync` with `MessageGroupId = EntityType` and the computed `MessageDeduplicationId`
    - _Requirements: 3.2, 3.4, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Write property test for Notification Field Construction (Property 1)
    - **Property 1: Notification Field Construction**
    - **Validates: Requirements 4.2**
    - Mock `IAmazonSQS`; generate arbitrary valid `SendNotificationRequest` inputs using FsCheck
    - Assert `EntityType`, `EntityId`, `Operation`, `IsRead`, `CreatedAt` proximity, and `Message` content on the constructed `Notification`

  - [ ]* 2.3 Write property test for MessageGroupId Equals EntityType (Property 2)
    - **Property 2: MessageGroupId Equals EntityType**
    - **Validates: Requirements 4.3**
    - Mock `IAmazonSQS`; capture `SendMessageRequest` passed to `SendMessageAsync`
    - Assert `MessageGroupId == request.EntityType` for any generated `EntityType` value

  - [ ]* 2.4 Write property test for Deduplication ID Is Deterministic and Unique (Property 3)
    - **Property 3: Deduplication ID Is Deterministic and Unique**
    - **Validates: Requirements 4.4**
    - No mock needed; call `ComputeDeduplicationId` directly on generated pairs of `Notification` objects
    - Assert same-fields → same ID; any-field-differs → different ID; length always 43; chars are valid Base64

  - [x] 2.5 Implement `ReceiveNotificationsAsync` in `NotificationService`
    - Loop calling `ReceiveMessageAsync` with `MaxNumberOfMessages = 1` until `max` messages collected or SQS returns empty batch
    - Deserialize message body to `Notification`, call `DeleteMessageAsync` with `ReceiptHandle`, add to result list
    - On exception: stop loop, log via `ILogger`, return partial results
    - Implement no-op `MarkAsRead(int id)` method
    - _Requirements: 5.2, 5.3, 5.5, 6.3_

  - [ ]* 2.6 Write property test for Receive Loop Count Matches Queue Depth (Property 5)
    - **Property 5: Receive Loop Count Matches Queue Depth**
    - **Validates: Requirements 5.2**
    - Mock `IAmazonSQS` to return N messages then empty; generate N (0–15) and max M (1–10)
    - Assert returned count equals `min(N, M)` and each loop called `ReceiveMessageAsync` with `MaxNumberOfMessages = 1`

  - [ ]* 2.7 Write property test for Receive Preserves Notification Data and Uses ReceiptHandle (Property 6)
    - **Property 6: Receive Preserves Notification Data and Uses ReceiptHandle**
    - **Validates: Requirements 5.3, 11.2**
    - Mock `IAmazonSQS` with generated `Notification` serialized as message body and arbitrary `ReceiptHandle`
    - Assert all returned field values equal originals; assert `DeleteMessageAsync` called with the exact `ReceiptHandle`

- [x] 3. Implement the microservice `NotificationsController`
  - [x] 3.1 Implement `POST /api/notifications` (`Send`) action
    - Call `_service.SendNotificationAsync(request)` asynchronously
    - Return `202 Accepted` on success; catch exception and return `503 Service Unavailable` with `{ "message": "..." }`
    - Rely on `[ApiController]` automatic model validation for `400 Bad Request` on invalid input
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [ ]* 3.2 Write property test for Invalid Request Returns HTTP 400 (Property 4)
    - **Property 4: Invalid Request Returns HTTP 400**
    - **Validates: Requirements 4.7**
    - Use `WebApplicationFactory`; generate `SendNotificationRequest` with at least one null/empty required field
    - Assert HTTP `400` is returned with JSON body containing a `message` or validation error field

  - [x] 3.3 Implement `GET /api/notifications` (`Receive`) action
    - Accept optional `max` query parameter (default 10); call `_service.ReceiveNotificationsAsync(max)`
    - Return `200 OK` with `NotificationResponse` JSON containing `notifications`, `count`, and `success`
    - _Requirements: 5.1, 5.4_

  - [x] 3.4 Implement `POST /api/notifications/{id}/mark-read` (`MarkAsRead`) action
    - Call `_service.MarkAsRead(id)` (no-op); return `200 OK` with `{ "success": true }`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 3.5 Write property test for MarkRead Returns 200 for Any Id (Property 7)
    - **Property 7: MarkRead Returns 200 for Any Id**
    - **Validates: Requirements 6.2, 6.3**
    - Use `WebApplicationFactory`; generate arbitrary integer ids
    - Assert HTTP `200` with `{ "success": true }` body; assert no `IAmazonSQS` calls made

- [x] 4. Wire up microservice `Program.cs`, health check, and DI registration
  - Register `IAmazonSQS` as singleton using `AmazonSQSClient` and `NotificationService` as scoped in the DI container
  - Configure controllers with `AddNewtonsoftJson()` for all JSON I/O
  - Map health check endpoint `GET /health` returning `200` with `{ "status": "healthy" }`
  - Add `AddHealthChecks()` service registration
  - _Requirements: 3.3, 3.4, 7.1, 7.2_

- [x] 5. Checkpoint — Ensure all microservice tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement serialization round-trip and DateTime format
  - [x] 6.1 Configure `Newtonsoft.Json` for ISO 8601 round-trip DateTime serialization
    - Apply `IsoDateTimeConverter` with `DateTimeFormat = "O"` in `JsonSerializerSettings`
    - Ensure `JsonConvert` default settings or `AddNewtonsoftJson` configuration uses round-trip format
    - _Requirements: 11.1, 11.3_

  - [ ]* 6.2 Write property test for Serialization Round-Trip Preserves All Fields (Property 11)
    - **Property 11: Serialization Round-Trip Preserves All Fields**
    - **Validates: Requirements 11.2, 11.3**
    - Generate arbitrary valid `Notification` objects with varying `DateTime` precision
    - Serialize then deserialize using `Newtonsoft.Json`; assert all field values equal originals including `CreatedAt` and `ReadAt`

- [x] 7. Update monolith to remove embedded SQS logic
  - Remove direct `IAmazonSQS` usage from the monolith's `NotificationService` class (or delete the class if fully replaced)
  - Remove `AWSSDK.SQS` `PackageReference` from `ContosoUniversity.csproj` if no other code references it
  - Update `appsettings.json`: remove `AppSettings:SqsQueueUrl`, add `AppSettings:NotificationServiceBaseUrl` set to `http://localhost:5001`
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. Implement `NotificationClient` typed HTTP client in the monolith
  - [x] 8.1 Create `NotificationClient` class with typed `HttpClient` constructor
    - Read `AppSettings:NotificationServiceBaseUrl` from `IConfiguration` and set `httpClient.BaseAddress`
    - Register via `builder.Services.AddHttpClient<NotificationClient>()` in monolith `Program.cs`
    - _Requirements: 9.1, 9.6_

  - [x] 8.2 Implement `SendNotification`, `GetNotifications`, and `MarkAsRead` methods
    - `SendNotification`: POST to `/api/notifications` with `SendNotificationRequest` JSON body (fire-and-forget)
    - `GetNotifications`: GET to `/api/notifications?max={max}`, deserialize `NotificationResponse.notifications`
    - `MarkAsRead`: POST to `/api/notifications/{id}/mark-read`
    - Catch all exceptions and non-success status codes; log via `Debug.WriteLine`; return safe defaults
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [ ]* 8.3 Write property test for Notification Client Send Constructs Correct Request (Property 8)
    - **Property 8: Notification Client Send Constructs Correct Request**
    - **Validates: Requirements 9.2**
    - Mock `HttpMessageHandler`; generate arbitrary combinations of entityType, entityId, entityDisplayName, operation, userName
    - Assert HTTP POST issued to `{baseUrl}/api/notifications` with matching JSON body fields

  - [ ]* 8.4 Write property test for Notification Client GetNotifications Constructs Correct URL (Property 9)
    - **Property 9: Notification Client GetNotifications Constructs Correct URL**
    - **Validates: Requirements 9.3**
    - Mock `HttpMessageHandler`; generate arbitrary `max` values and response bodies
    - Assert GET issued to `{baseUrl}/api/notifications?max={max}`; assert returned list equals deserialized `notifications` array

  - [ ]* 8.5 Write property test for Notification Client MarkAsRead Constructs Correct URL (Property 10)
    - **Property 10: Notification Client MarkAsRead Constructs Correct URL**
    - **Validates: Requirements 9.4**
    - Mock `HttpMessageHandler`; generate arbitrary integer ids
    - Assert HTTP POST issued to `{baseUrl}/api/notifications/{id}/mark-read`

- [x] 9. Update monolith `BaseController` and `NotificationsController`
  - Replace `NotificationService` field and constructor parameter with `NotificationClient` in `BaseController`
  - Update `SendEntityNotification` to delegate to `notificationClient.SendNotification(...)`
  - Update all derived controllers (`CoursesController`, `StudentsController`, `DepartmentsController`, `InstructorsController`, `HomeController`, `NotificationsController`) to accept `NotificationClient` and pass it to `base(...)`
  - Replace `notificationService.ReceiveNotification()` loop in `NotificationsController` with `notificationClient.GetNotifications(10)` and iterate the list
  - Replace `notificationService.MarkAsRead(id)` with `notificationClient.MarkAsRead(id)`
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use FsCheck with FsCheck.Xunit (`[Property]` attribute, minimum 100 iterations)
- Mock library is Moq for `IAmazonSQS` and `HttpMessageHandler`
- Each property test file MUST include the tag comment: `// Feature: notification-microservice, Property {N}: {property_text}`
- The microservice and monolith carry identical `Notification` model definitions — no shared assembly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.3", "3.4", "4"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1"] },
    { "id": 3, "tasks": ["2.6", "2.7", "3.2", "3.5", "6.1"] },
    { "id": 4, "tasks": ["6.2", "7"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["8.3", "8.4", "8.5", "9"] }
  ]
}
```
