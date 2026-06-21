namespace ContosoUniversity.NotificationService.Models;

public class NotificationResponse
{
    public bool Success { get; set; }
    public List<Notification> Notifications { get; set; } = new();
    public int Count { get; set; }
}
