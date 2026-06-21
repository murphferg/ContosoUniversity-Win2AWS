using Microsoft.AspNetCore.Mvc;
using SvcNotification = ContosoUniversity.NotificationService.Services.NotificationService;

namespace ContosoUniversity.NotificationService.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly SvcNotification _service;

    public NotificationsController(SvcNotification service)
        => _service = service;

    // POST /api/notifications
    [HttpPost]
    public async Task<IActionResult> Send([FromBody] Models.SendNotificationRequest request)
    {
        try
        {
            await _service.SendNotificationAsync(request);
            return StatusCode(StatusCodes.Status202Accepted);
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
        }
    }

    // GET /api/notifications?max=N
    [HttpGet]
    public async Task<IActionResult> Receive([FromQuery] int max = 10)
    {
        max = Math.Min(max, 10);
        var notifications = await _service.ReceiveNotificationsAsync(max);
        return Ok(new Models.NotificationResponse
        {
            Success = true,
            Notifications = notifications,
            Count = notifications.Count
        });
    }

    // POST /api/notifications/{id}/mark-read
    [HttpPost("{id}/mark-read")]
    public IActionResult MarkAsRead(int id)
    {
        _service.MarkAsRead(id);
        return Ok(new { success = true });
    }
}
