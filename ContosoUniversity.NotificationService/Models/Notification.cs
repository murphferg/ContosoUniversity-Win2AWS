using System.ComponentModel.DataAnnotations;

namespace ContosoUniversity.NotificationService.Models;

public class Notification
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string EntityType { get; set; } = string.Empty;

    [MaxLength(50)]
    public string EntityId { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Operation { get; set; } = string.Empty;

    [MaxLength(256)]
    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    [MaxLength(100)]
    public string CreatedBy { get; set; } = string.Empty;

    public bool IsRead { get; set; }

    public DateTime? ReadAt { get; set; }
}
