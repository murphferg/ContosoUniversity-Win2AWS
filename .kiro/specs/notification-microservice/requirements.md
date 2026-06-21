# Requirements Document

## Introduction

This feature extracts the notification functionality currently embedded in the Contoso University monolithic ASP.NET MVC application into a standalone .NET 8 Web API microservice (`NotificationService`). The new service is independently deployable, communicates with the monolith via HTTP REST, and continues to use the existing AWS SQS FIFO queue (`contoso.fifo`) for durable message storage. The monolith's `NotificationsController`, `NotificationService` class, and `BaseController` notification integration are replaced with an HTTP client that delegates all notification operations to the new microservice.

## Glossary

- **Notification_Microservice**: The new standalone .NET 8 Web API project (`ContosoUniversity.NotificationService`) being created by this feature.
- **Monolith**: The existing Contoso University ASP.NET MVC application (`ContosoUniversity`) that currently embeds notification logic.
- **Notification_Client**: A typed HTTP client in the Monolith that calls the `Notification_Microservice` REST API instead of the local `NotificationService` class.
- **Notification**: The domain object representing a single entity-change event, with fields: `EntityType`, `EntityId`, `Operation`, `Message`, `CreatedAt`, `CreatedBy`, `IsRead`, `ReadAt`.
- **SQS_Client**: The `IAmazonSQS` instance provided by the AWS SDK (`AWSSDK.SQS`) used exclusively inside the `Notification_Microservice`.
- **FIFO_Queue**: The AWS SQS FIFO queue named `contoso.fifo` at URL `https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo`.
- **Default_Credential_Chain**: The AWS SDK's built-in credential resolution order: environment variables → ECS/EC2 instance profile → `~/.aws/credentials` file.
- **Send_Endpoint**: The `POST /api/notifications` HTTP endpoint exposed by the `Notification_Microservice` for publishing a new notification.
- **Receive_Endpoint**: The `GET /api/notifications` HTTP endpoint exposed by the `Notification_Microservice` for polling pending notifications.
- **MarkRead_Endpoint**: The `POST /api/notifications/{id}/mark-read` HTTP endpoint exposed by the `Notification_Microservice`.
- **SendNotificationRequest**: The JSON request body for the `Send_Endpoint`, containing `entityType`, `entityId`, `entityDisplayName`, `operation`, and `createdBy`.
- **NotificationResponse**: The JSON response body returned by the `Receive_Endpoint`, containing a `notifications` array, a `count`, and a `success` flag.

---

## Requirements

### Requirement 1: Notification Microservice Project Structure

**User Story:** As a developer, I want a new standalone .NET 8 Web API project for notifications, so that it can be built, tested, and deployed independently of the Contoso University monolith.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL be a .NET 8 Web API project named `ContosoUniversity.NotificationService`.
2. THE `Notification_Microservice` SHALL include a `PackageReference` for `AWSSDK.SQS` version `3.7.*`.
3. THE `Notification_Microservice` SHALL include a `PackageReference` for `Newtonsoft.Json` minimum version `13.0.1` for JSON serialization.
4. THE `Notification_Microservice` SHALL expose its HTTP endpoints on a configurable port via the `applicationUrl` property in `launchSettings.json`, defaulting to `http://localhost:5001`.
5. THE `Notification_Microservice` SHALL include a `Dockerfile` that bundles all .NET runtime dependencies using a `mcr.microsoft.com/dotnet/aspnet:8.0` base image and runs the service as a Linux container.

---

### Requirement 2: Notification Data Model

**User Story:** As a developer, I want the `Notification` model defined within the microservice, so that the microservice owns its data contract and does not depend on the monolith's model assembly.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL define a `Notification` class with properties: `Id` (int), `EntityType` (string, max 100), `EntityId` (string, max 50), `Operation` (string, max 20), `Message` (string, max 256), `CreatedAt` (DateTime), `CreatedBy` (string, max 100), `IsRead` (bool), `ReadAt` (nullable DateTime).
2. THE `Notification_Microservice` SHALL define an `EntityOperation` enum with values `CREATE`, `UPDATE`, and `DELETE`.
3. THE `Notification_Microservice` SHALL define a `SendNotificationRequest` record with properties: `EntityType` (string, max 100, required), `EntityId` (string, max 50, required), `EntityDisplayName` (string, nullable, default null), `Operation` (EntityOperation, required), `CreatedBy` (string, max 100, optional).

---

### Requirement 3: SQS Configuration

**User Story:** As an operator, I want SQS connection details stored in configuration, so that the microservice can be pointed at different queues per environment without recompiling.

#### Acceptance Criteria

1. THE `Notification_Microservice` `appsettings.json` SHALL contain a configuration key `SqsQueueUrl` under the `AppSettings` section with a default value of `https://sqs.us-east-1.amazonaws.com/360664446946/contoso.fifo`.
2. IF the `AppSettings:SqsQueueUrl` configuration key is absent or empty at startup, THEN THE `Notification_Microservice` SHALL throw an `InvalidOperationException` whose message identifies the missing key name during the `NotificationService` constructor.
3. THE `Notification_Microservice` SHALL resolve AWS credentials exclusively via the `Default_Credential_Chain`, without hard-coding any access keys or secret keys in source code or configuration files.
4. THE `Notification_Microservice` SHALL register `IAmazonSQS` as a singleton in its DI container using `AmazonSQSClient`.
5. THE `Notification_Microservice` `appsettings.json` SHALL NOT contain the key `NotificationQueuePath`.

---

### Requirement 4: Send Notification Endpoint

**User Story:** As the Monolith, I want to publish a notification event via HTTP, so that entity-change events are forwarded to the `Notification_Microservice` without the monolith requiring direct SQS access.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL expose a `POST /api/notifications` endpoint that accepts a `SendNotificationRequest` JSON body with fields: `EntityType`, `EntityId`, `EntityDisplayName`, and `Operation`.
2. WHEN a valid `SendNotificationRequest` is received, THE `Notification_Microservice` SHALL construct a `Notification` object, set `CreatedAt` to the current UTC time, set `IsRead` to `false`, and set `Message` to the string `"[EntityType] '[EntityDisplayName]' was [Operation]"`.
3. WHEN a valid `SendNotificationRequest` is received, THE `Notification_Microservice` SHALL serialize the `Notification` to JSON and call `SQS_Client.SendMessageAsync` targeting the `FIFO_Queue`, setting `MessageGroupId` to the notification's `EntityType`.
4. WHEN calling `SendMessageAsync` against the `FIFO_Queue`, THE `Notification_Microservice` SHALL set `MessageDeduplicationId` to a SHA-256 hash (Base64-encoded, truncated to 43 characters) derived from the notification's `EntityType`, `EntityId`, `Operation`, and `CreatedAt` fields.
5. WHEN `SendMessageAsync` succeeds, THE `Send_Endpoint` SHALL return HTTP `202 Accepted`.
6. IF `SendMessageAsync` throws an exception, THEN THE `Send_Endpoint` SHALL return HTTP `503 Service Unavailable` with a JSON error body containing a `message` field.
7. IF the `SendNotificationRequest` body is missing or has a null `EntityType`, null `EntityId`, or null `Operation`, THEN THE `Send_Endpoint` SHALL return HTTP `400 Bad Request` with a JSON error body containing a `message` field that identifies which field(s) failed validation.

---

### Requirement 5: Receive Notifications Endpoint

**User Story:** As the Monolith, I want to poll for pending notifications via HTTP, so that the notification dashboard can display recent entity-change events sourced from SQS.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL expose a `GET /api/notifications` endpoint that accepts an optional `max` query parameter (integer, default `10`, maximum `10`).
2. WHEN the `Receive_Endpoint` is called, THE `Notification_Microservice` SHALL call `SQS_Client.ReceiveMessageAsync` with `MaxNumberOfMessages = 1` in a loop, repeating until `max` messages have been retrieved or SQS returns an empty batch.
3. WHEN a message is received from SQS, THE `Notification_Microservice` SHALL deserialize the message body from JSON into a `Notification` object and call `SQS_Client.DeleteMessageAsync` with the message's `ReceiptHandle` before including the notification in the response.
4. WHEN the `Receive_Endpoint` is called, THE `Notification_Microservice` SHALL return HTTP `200 OK` with a `NotificationResponse` JSON body containing the retrieved notifications array and count.
5. IF `ReceiveMessageAsync` or `DeleteMessageAsync` throws an exception during a receive loop iteration, THEN THE `Notification_Microservice` SHALL stop the loop for that iteration, log the error, and return any notifications already collected up to that point.

---

### Requirement 6: Mark as Read Endpoint

**User Story:** As the Monolith, I want to mark a notification as read via HTTP, so that the notification dashboard can update read status without direct SQS access.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL expose a `POST /api/notifications/{id}/mark-read` endpoint.
2. WHEN the `MarkRead_Endpoint` is called with any integer `id`, THE `Notification_Microservice` SHALL return HTTP `200 OK` with a JSON body `{ "success": true }`.
3. THE `MarkRead_Endpoint` SHALL NOT interact with SQS or any persistent store in the initial implementation.

---

### Requirement 7: Health Check Endpoint

**User Story:** As an operator, I want a health check endpoint on the microservice, so that orchestration platforms and load balancers can verify the service is running.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL expose a `GET /health` endpoint.
2. WHEN the `/health` endpoint is called and the service is running, THE `Notification_Microservice` SHALL return HTTP `200 OK` with a JSON body containing a `status` field set to `"healthy"`.

---

### Requirement 8: Monolith — Remove Embedded SQS Notification Logic

**User Story:** As a developer, I want the monolith to stop talking to SQS directly, so that all notification infrastructure is owned by the `Notification_Microservice`.

#### Acceptance Criteria

1. THE `Monolith` SHALL remove all direct `IAmazonSQS` usage from `NotificationService`.
2. THE `Monolith` SHALL remove the `AWSSDK.SQS` `PackageReference` from `ContosoUniversity.csproj` if no other code references it after the migration.
3. THE `Monolith` `appsettings.json` SHALL remove the `AppSettings:SqsQueueUrl` key and SHALL add an `AppSettings:NotificationServiceBaseUrl` key containing the base URL of the `Notification_Microservice`.

---

### Requirement 9: Monolith — Notification Client

**User Story:** As a developer, I want a typed HTTP client in the monolith that wraps calls to the `Notification_Microservice`, so that `BaseController` can send notifications without any knowledge of HTTP details.

#### Acceptance Criteria

1. THE `Monolith` SHALL define a `NotificationClient` class registered in its DI container as an `HttpClient`-backed typed client.
2. THE `Notification_Client` SHALL expose a `SendNotification(string entityType, string entityId, string entityDisplayName, EntityOperation operation, string userName)` method that issues a `POST` to `{NotificationServiceBaseUrl}/api/notifications` with a `SendNotificationRequest` JSON body.
3. THE `Notification_Client` SHALL expose a `GetNotifications(int max)` method that issues a `GET` to `{NotificationServiceBaseUrl}/api/notifications?max={max}` and returns the list of `Notification` objects from the response.
4. THE `Notification_Client` SHALL expose a `MarkAsRead(int id)` method that issues a `POST` to `{NotificationServiceBaseUrl}/api/notifications/{id}/mark-read`.
5. IF an HTTP call from the `Notification_Client` throws an exception or receives a non-success status code, THEN THE `Notification_Client` SHALL log the error via `Debug.WriteLine` and return a safe default (empty list or no-op), without propagating the exception to the caller.
6. THE `Monolith` `appsettings.json` `AppSettings:NotificationServiceBaseUrl` configuration value SHALL be read by the `Notification_Client` at construction time.

---

### Requirement 10: Monolith — BaseController Uses Notification Client

**User Story:** As a developer, I want `BaseController` to use `NotificationClient` instead of the old `NotificationService`, so that entity-change events are forwarded to the microservice transparently.

#### Acceptance Criteria

1. THE `Monolith` `BaseController` SHALL replace the `NotificationService` field and constructor parameter with a `NotificationClient` field and constructor parameter.
2. WHEN `SendEntityNotification` is called in a derived controller, THE `BaseController` SHALL delegate to `Notification_Client.SendNotification` with the same arguments.
3. THE `Monolith` `NotificationsController` SHALL replace calls to `notificationService.ReceiveNotification()` with calls to `Notification_Client.GetNotifications(10)` and iterate the returned list.
4. THE `Monolith` `NotificationsController` SHALL replace calls to `notificationService.MarkAsRead(id)` with calls to `Notification_Client.MarkAsRead(id)`.

---

### Requirement 11: Serialization Round-Trip

**User Story:** As a developer, I want the `Notification` JSON serialization format to be stable and lossless, so that notifications published by the microservice and consumed by the monolith's polling client are faithfully reconstructed.

#### Acceptance Criteria

1. THE `Notification_Microservice` SHALL serialize `Notification` objects to JSON using `Newtonsoft.Json` with default settings.
2. FOR ALL valid `Notification` objects, serializing to JSON and then deserializing from that same JSON SHALL produce a `Notification` object with equivalent values for all fields.
3. THE `Notification_Microservice` SHALL serialize `DateTime` fields in ISO 8601 round-trip format (`"O"` format specifier) to prevent precision loss across serialization boundaries.
