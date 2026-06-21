# Implementation Plan: SQS Notifications

## Overview

Replace the in-memory `ConcurrentQueue<string>` in `NotificationService` with real AWS SQS calls. Changes are contained to the service layer, DI wiring, and configuration. No controllers, models, views, or frontend assets change beyond adding constructor parameters to `BaseController` and its derived controllers.

## Tasks

- [x] 1. Add AWSSDK.SQS NuGet package
  - Add `<PackageReference Include="AWSSDK.SQS" Version="3.7.*" />` to `ContosoUniversity.csproj`
  - Run `dotnet restore` to confirm the package resolves
  - _Requirements: 1.1_

- [ ] 2. Update `appsettings.json` configuration
  - Replace the `AppSettings:NotificationQueuePath` key with `AppSettings:SqsQueueUrl` set to `https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo`
  - Remove the old `NotificationQueuePath` key entirely
  - _Requirements: 3.1, 3.2_

- [ ] 3. Register `IAmazonSQS` in the DI container
  - Add `using Amazon.SQS;` to `Program.cs`
  - Register `builder.Services.AddSingleton<IAmazonSQS, AmazonSQSClient>();` after the existing service registrations
  - Do not pass any explicit credentials — rely on the default AWS credential chain
  - _Requirements: 2.1, 2.2_

- [ ] 4. Rewrite `NotificationService` to use SQS
  - [ ] 4.1 Replace constructor and fields
    - Remove `ConcurrentQueue<string> _queue` field
    - Add `IAmazonSQS _sqsClient` and `string _queueUrl` fields
    - Change constructor signature to `NotificationService(IAmazonSQS sqsClient, IConfiguration configuration)`
    - Read `configuration["AppSettings:SqsQueueUrl"]` in the constructor; throw `InvalidOperationException` if the value is absent or empty
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.3_

  - [ ] 4.2 Implement `SendNotification` via `SendMessageAsync`
    - Keep the existing `Notification` object construction and `GenerateMessage` helper unchanged
    - Serialize the `Notification` to JSON using `JsonConvert.SerializeObject`
    - Implement `ComputeDeduplicationId(Notification n)` as a SHA-256 hash of `"{EntityType}|{EntityId}|{Operation}|{CreatedAt:O}"` encoded as Base64 (truncated to 43 chars)
    - Build a `SendMessageRequest` with `QueueUrl = _queueUrl`, `MessageBody = json`, `MessageGroupId = notification.EntityType`, `MessageDeduplicationId = dedupeId`
    - Call `_sqsClient.SendMessageAsync(request)` using `.ContinueWith` to catch and trace any faults (fire-and-forget)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 4.3 Write property test: send/receive round-trip preserves Notification data
    - **Property 1: Send/Receive Round-Trip Preserves Notification Data**
    - **Validates: Requirements 5.1, 6.2**
    - Use FsCheck to generate arbitrary `Notification` instances; serialize with `JsonConvert.SerializeObject`; deserialize with `JsonConvert.DeserializeObject<Notification>`; assert all fields are equivalent
    - Tag: `Feature: sqs-notifications, Property 1: Send/receive round-trip preserves Notification data`
    - Minimum 100 iterations

  - [ ]* 4.4 Write property test: MessageGroupId equals EntityType
    - **Property 2: MessageGroupId Equals EntityType**
    - **Validates: Requirements 5.3**
    - Use FsCheck to generate `Notification` objects with arbitrary `EntityType` values; mock `IAmazonSQS`; call `SendNotification`; capture the `SendMessageRequest`; assert `MessageGroupId == notification.EntityType`
    - Tag: `Feature: sqs-notifications, Property 2: MessageGroupId equals EntityType`
    - Minimum 100 iterations

  - [ ]* 4.5 Write property test: MessageDeduplicationId is deterministic and unique
    - **Property 3: MessageDeduplicationId Is Deterministic and Unique**
    - **Validates: Requirements 5.4**
    - Use FsCheck to generate pairs of `Notification` objects; for identical (EntityType, EntityId, Operation, CreatedAt) assert IDs are equal; for any differing field assert IDs differ
    - Tag: `Feature: sqs-notifications, Property 3: MessageDeduplicationId is deterministic and unique`
    - Minimum 100 iterations

  - [ ] 4.6 Implement `ReceiveNotification` via `ReceiveMessageAsync`
    - Build a `ReceiveMessageRequest` with `QueueUrl = _queueUrl`, `MaxNumberOfMessages = 1`
    - Call `_sqsClient.ReceiveMessageAsync(request).GetAwaiter().GetResult()`
    - Return `null` if `response.Messages.Count == 0`
    - Deserialize `msg.Body` to `Notification` via `JsonConvert.DeserializeObject<Notification>`
    - Call `_sqsClient.DeleteMessageAsync(_queueUrl, msg.ReceiptHandle).GetAwaiter().GetResult()`
    - Return the deserialized `Notification`
    - Wrap the entire body in `try/catch`; on exception write `Debug.WriteLine` and return `null`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.7 Write property test: received message is deleted using its ReceiptHandle
    - **Property 4: Received Message Is Deleted Using Its ReceiptHandle**
    - **Validates: Requirements 6.3**
    - Use FsCheck to generate SQS `Message` objects with arbitrary `ReceiptHandle` strings; mock `ReceiveMessageAsync` to return each; call `ReceiveNotification`; assert `DeleteMessageAsync` was called with the exact same `ReceiptHandle`
    - Tag: `Feature: sqs-notifications, Property 4: Received message is deleted using its ReceiptHandle`
    - Minimum 100 iterations

  - [ ] 4.8 Retain `MarkAsRead` as a no-op
    - Keep `public void MarkAsRead(int notificationId) { }` unchanged
    - _Requirements: 7.1_

- [ ] 5. Checkpoint — build and confirm no compile errors
  - Run `dotnet build` and resolve any compiler errors before proceeding
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Update `BaseController` to use constructor injection
  - [ ] 6.1 Change `BaseController` constructor
    - Remove `protected NotificationService notificationService = new NotificationService();`
    - Remove `db = SchoolContextFactory.Create();` from the parameterless constructor
    - Add constructor: `protected BaseController(SchoolContext db, NotificationService notificationService)`
    - Assign both parameters to the protected fields
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 6.2 Update all derived controllers to pass dependencies to base
    - For each controller that inherits `BaseController` (`CoursesController`, `StudentsController`, `DepartmentsController`, `InstructorsController`, `HomeController`, `NotificationsController`):
      - Add a constructor accepting `SchoolContext db` and `NotificationService notificationService`
      - Pass both to `base(db, notificationService)`
    - ASP.NET Core DI will inject both automatically — no additional registration needed
    - _Requirements: 8.1, 8.3_

- [ ] 7. Final checkpoint — full build and smoke test
  - Run `dotnet build`; confirm zero errors and zero warnings related to these changes
  - Verify `appsettings.json` contains `SqsQueueUrl` and does not contain `NotificationQueuePath`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `ReceiveNotification` uses synchronous `.GetAwaiter().GetResult()` because the calling controllers are not async — this is intentional and acceptable for this bounded use case
- AWS credentials are never hard-coded; the SDK default credential chain (env vars → instance profile → `~/.aws/credentials`) is used automatically when no explicit credentials are passed to `AmazonSQSClient`
- Property tests require adding `FsCheck` and `FsCheck.Xunit` (or `FsCheck.NUnit`) and `Moq` NuGet packages to a test project

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4.1"] },
    { "wave": 4, "tasks": ["4.2", "4.6", "4.8"] },
    { "wave": 5, "tasks": ["4.3", "4.4", "4.5", "4.7"] },
    { "wave": 6, "tasks": ["5"] },
    { "wave": 7, "tasks": ["6.1"] },
    { "wave": 8, "tasks": ["6.2"] },
    { "wave": 9, "tasks": ["7"] }
  ]
}
```
