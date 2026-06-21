using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using ContosoUniversity.DTOs;
using ContosoUniversity.Services;
using Microsoft.AspNetCore.Mvc;

namespace ContosoUniversity.Controllers.Api
{
    [ApiController]
    [Route("api/notifications")]
    public class NotificationsApiController : ControllerBase
    {
        private readonly NotificationClient _notificationClient;

        public NotificationsApiController(NotificationClient notificationClient)
        {
            _notificationClient = notificationClient;
        }

        // GET: api/notifications
        [HttpGet]
        public async Task<IActionResult> GetNotifications()
        {
            try
            {
                var notifications = await _notificationClient.GetNotificationsAsync(10);

                var items = notifications
                    .OrderByDescending(n => n.CreatedAt)
                    .Take(10)
                    .Select(n => new NotificationItemDto(
                        n.Id,
                        n.EntityType,
                        n.Operation,
                        null,
                        n.CreatedAt))
                    .ToList();

                var unreadCount = notifications.Count(n => !n.IsRead);

                return Ok(new NotificationListDto(items, unreadCount));
            }
            catch (HttpRequestException)
            {
                return StatusCode(503, new { message = "Notification service unavailable" });
            }
        }

        // POST: api/notifications/{id}/mark-read
        [HttpPost("{id}/mark-read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            try
            {
                await _notificationClient.MarkAsReadAsync(id);
                return Ok(new { success = true });
            }
            catch (HttpRequestException)
            {
                return StatusCode(503, new { message = "Notification service unavailable" });
            }
        }
    }
}
