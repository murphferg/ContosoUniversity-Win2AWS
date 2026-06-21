using System.Security.Cryptography;
using System.Text;
using Amazon.SQS;
using Amazon.SQS.Model;
using ContosoUniversity.NotificationService.Models;
using Newtonsoft.Json;

namespace ContosoUniversity.NotificationService.Services;

/// <summary>
/// Handles SQS interaction for the notification microservice.
/// </summary>
public class NotificationService
{
    private readonly IAmazonSQS _sqsClient;
    private readonly string _queueUrl;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IAmazonSQS sqsClient, IConfiguration configuration, ILogger<NotificationService> logger)
    {
        _queueUrl = configuration["AppSettings:SqsQueueUrl"]!;
        if (string.IsNullOrWhiteSpace(_queueUrl))
            throw new InvalidOperationException(
                "Configuration key 'AppSettings:SqsQueueUrl' is absent or empty.");

        _sqsClient = sqsClient;
        _logger = logger;
    }

    public async Task<bool> SendNotificationAsync(SendNotificationRequest request)
    {
        // Compose the display name: fall back to EntityId if EntityDisplayName is null/empty
        var displayName = string.IsNullOrEmpty(request.EntityDisplayName)
            ? request.EntityId
            : request.EntityDisplayName;

        var notification = new Notification
        {
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            Operation = request.Operation.ToString(),
            CreatedBy = request.CreatedBy ?? string.Empty,
            CreatedAt = DateTime.UtcNow,
            IsRead = false,
            Message = $"{request.EntityType} '{displayName}' was {request.Operation}"
        };

        var messageBody = JsonConvert.SerializeObject(notification);
        var deduplicationId = ComputeDeduplicationId(notification);

        var sendRequest = new SendMessageRequest
        {
            QueueUrl = _queueUrl,
            MessageBody = messageBody,
            MessageGroupId = notification.EntityType,
            MessageDeduplicationId = deduplicationId
        };

        _logger.LogInformation(
            "Sending notification to SQS: EntityType={EntityType}, EntityId={EntityId}, Operation={Operation}",
            notification.EntityType, notification.EntityId, notification.Operation);

        await _sqsClient.SendMessageAsync(sendRequest);

        return true;
    }

    public async Task<List<Notification>> ReceiveNotificationsAsync(int max)
    {
        var notifications = new List<Notification>();
        try
        {
            while (notifications.Count < max)
            {
                var response = await _sqsClient.ReceiveMessageAsync(new ReceiveMessageRequest
                {
                    QueueUrl = _queueUrl,
                    MaxNumberOfMessages = 1
                });

                if (response.Messages == null || response.Messages.Count == 0)
                    break;

                foreach (var message in response.Messages)
                {
                    var notification = JsonConvert.DeserializeObject<Notification>(message.Body);
                    await _sqsClient.DeleteMessageAsync(new DeleteMessageRequest
                    {
                        QueueUrl = _queueUrl,
                        ReceiptHandle = message.ReceiptHandle
                    });
                    notifications.Add(notification!);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error receiving notifications from SQS. Returning {Count} partial results.", notifications.Count);
        }
        return notifications;
    }

    public void MarkAsRead(int id) { }

    /// <summary>
    /// Computes a deterministic, unique deduplication ID for the SQS FIFO queue.
    /// Uses SHA-256 of "EntityType|EntityId|Operation|CreatedAt:O", Base64-encoded truncated to 43 chars.
    /// </summary>
    private static string ComputeDeduplicationId(Notification n)
    {
        var raw = $"{n.EntityType}|{n.EntityId}|{n.Operation}|{n.CreatedAt:O}";
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToBase64String(hash)[..43];
    }
}
