using System.ComponentModel.DataAnnotations;

namespace ContosoUniversity.NotificationService.Models;

public record SendNotificationRequest
{
    [Required]
    [MaxLength(100)]
    public string EntityType { get; init; } = null!;

    [Required]
    [MaxLength(50)]
    public string EntityId { get; init; } = null!;

    public string? EntityDisplayName { get; init; } = null;

    [Required]
    public EntityOperation Operation { get; init; }

    [MaxLength(100)]
    public string? CreatedBy { get; init; } = null;
}
