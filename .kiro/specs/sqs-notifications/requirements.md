# Requirements Document

## Introduction

This feature replaces the in-memory `ConcurrentQueue<string>` used as a fake MSMQ-style queue inside `NotificationService` with real AWS SQS calls targeting the pre-existing FIFO queue `contoso.fifo`. The change is entirely internal to the notification infrastructure: no controllers, models, views, or frontend code change. The goal is to make notifications durable and visible across process restarts and multiple application instances.

## Glossary

- **NotificationService**: The C# service class in `Services/NotificationService.cs` responsible for sending and receiving `Notification` objects via a message queue.
- **BaseController**: The abstract ASP.NET Core MVC controller in `Controllers/BaseController.cs` from which all feature controllers inherit. Currently instantiates `NotificationService` directly with `new`.
- **SQS_Client**: The `IAmazonSQS` instance provided by the AWS SDK (`AWSSDK.SQS`) and registered in the DI container.
- **Notification**: The C# model class in `Models/Notification.cs` representing a domain event (entity type, operation, message, timestamps, etc.).
- **FIFO_Queue**: The AWS SQS FIFO queue named `contoso.fifo` at URL `https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo`. FIFO queues require `MessageGroupId` and `MessageDeduplicationId` on every send.
- **Program**: The .NET 8 application entry point in `Program.cs` where DI services are registered.
- **SqsQueueUrl**: The `appsettings.json` configuration key holding the SQS queue URL, replacing the legacy `NotificationQueuePath` key.
- **Default_Credential_Chain**: The AWS SDK's built-in credential resolution order: environment variables → ECS/EC2 instance profile → `~/.aws/credentials` file.

---

## Requirements

### Requirement 1: NuGet Package Dependency

**User Story:** As a developer, I want the AWS SQS SDK available in the project, so that I can make SQS API calls from application code.

#### Acceptance Criteria

1. THE `ContosoUniversity.csproj` file SHALL include a `PackageReference` for `AWSSDK.SQS`.

---

### Requirement 2: AWS SQS Client DI Registration

**User Story:** As a developer, I want `IAmazonSQS` registered in the DI container, so that `NotificationService` can receive it via constructor injection without creating its own AWS client.

#### Acceptance Criteria

1. THE `Program` SHALL register `IAmazonSQS` as a singleton in the DI container using `AmazonSQSClient`.
2. THE `Program` SHALL resolve AWS credentials exclusively via the `Default_Credential_Chain`, without hard-coding any access keys or secret keys in source code.

---

### Requirement 3: Configuration Key Migration

**User Story:** As an operator, I want the SQS queue URL stored in `appsettings.json`, so that it can be changed per environment without recompiling the application.

#### Acceptance Criteria

1. THE `appsettings.json` file SHALL contain a configuration key `SqsQueueUrl` under the `AppSettings` section with the value `https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo`.
2. THE `appsettings.json` file SHALL NOT contain the key `NotificationQueuePath`.
3. IF the `AppSettings:SqsQueueUrl` configuration key is absent or empty at startup, THEN THE `NotificationService` SHALL throw an `InvalidOperationException` with a descriptive message rather than proceeding silently.

---

### Requirement 4: NotificationService — Constructor and Dependencies

**User Story:** As a developer, I want `NotificationService` to receive its dependencies via constructor injection, so that it works correctly within the ASP.NET Core DI lifecycle.

#### Acceptance Criteria

1. THE `NotificationService` SHALL accept an `IAmazonSQS` parameter and an `IConfiguration` parameter in its constructor.
2. THE `NotificationService` SHALL NOT instantiate `AmazonSQSClient` itself.
3. THE `NotificationService` SHALL read the queue URL from `IConfiguration` using the key `AppSettings:SqsQueueUrl`.
4. THE `NotificationService` SHALL NOT contain a `ConcurrentQueue<string>` field.

---

### Requirement 5: Send Notification via SQS

**User Story:** As a developer, I want domain events published to the FIFO_Queue, so that notifications are durable and visible across process restarts.

#### Acceptance Criteria

1. WHEN `SendNotification` is called, THE `NotificationService` SHALL serialize the `Notification` object to JSON using `Newtonsoft.Json`.
2. WHEN `SendNotification` is called, THE `NotificationService` SHALL call `SQS_Client.SendMessageAsync` with the `SqsQueueUrl` as the queue URL.
3. WHEN calling `SendMessageAsync` against the `FIFO_Queue`, THE `NotificationService` SHALL set `MessageGroupId` to the `EntityType` of the notification.
4. WHEN calling `SendMessageAsync` against the `FIFO_Queue`, THE `NotificationService` SHALL set `MessageDeduplicationId` to a value derived from the notification's `EntityType`, `EntityId`, `Operation`, and `CreatedAt` fields so that each message is unique.
5. WHEN `SendMessageAsync` throws an exception, THE `NotificationService` SHALL catch the exception, write a debug trace message, and return without propagating the exception to the caller.

---

### Requirement 6: Receive Notification via SQS

**User Story:** As a developer, I want `ReceiveNotification` to pull one message at a time from the FIFO_Queue, so that the `NotificationsController` can page through pending notifications.

#### Acceptance Criteria

1. WHEN `ReceiveNotification` is called, THE `NotificationService` SHALL call `SQS_Client.ReceiveMessageAsync` requesting a maximum of one message.
2. WHEN `ReceiveMessageAsync` returns a message, THE `NotificationService` SHALL deserialize the message body from JSON into a `Notification` object using `Newtonsoft.Json`.
3. WHEN `ReceiveMessageAsync` returns a message, THE `NotificationService` SHALL call `SQS_Client.DeleteMessageAsync` with the message's `ReceiptHandle` to remove the message from the queue.
4. WHEN `ReceiveMessageAsync` returns no messages, THE `NotificationService` SHALL return `null`.
5. WHEN `ReceiveMessageAsync` or `DeleteMessageAsync` throws an exception, THE `NotificationService` SHALL catch the exception, write a debug trace message, and return `null`.

---

### Requirement 7: MarkAsRead Remains a No-Op

**User Story:** As a developer, I want `MarkAsRead` to remain unchanged, so that the `NotificationsController` continues to compile and function without modification.

#### Acceptance Criteria

1. THE `NotificationService` SHALL retain a public `MarkAsRead(int notificationId)` method with an empty body.

---

### Requirement 8: BaseController Uses DI-Injected NotificationService

**User Story:** As a developer, I want `BaseController` to receive `NotificationService` from the DI container, so that all controllers share the same properly configured instance.

#### Acceptance Criteria

1. THE `BaseController` SHALL declare a constructor that accepts a `NotificationService` parameter and assigns it to the protected `notificationService` field.
2. THE `BaseController` SHALL NOT instantiate `NotificationService` directly with `new NotificationService()`.
3. WHEN a derived controller requires a `SchoolContext`, THE `BaseController` constructor SHALL also accept a `SchoolContext` parameter from DI and assign it to the `db` field, replacing the direct call to `SchoolContextFactory.Create()`.
