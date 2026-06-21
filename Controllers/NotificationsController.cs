using System;
using System.Collections.Generic;
using ContosoUniversity.Data;
using ContosoUniversity.Models;
using ContosoUniversity.Services;
using Microsoft.AspNetCore.Mvc;


namespace ContosoUniversity.Controllers
{
    public class NotificationsController : BaseController
    {
        public NotificationsController(SchoolContext db, NotificationClient notificationClient)
            : base(db, notificationClient)
        {
        }

        // GET: api/notifications - Get pending notifications for admin
        [HttpGet]
        public JsonResult GetNotifications()
        {
            try
            {
                var notifications = notificationClient.GetNotifications(10);
                return Json(new {
                    success = true,
                    notifications = notifications,
                    count = notifications.Count
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error retrieving notifications: {ex.Message}");
                return Json(new { success = false, message = "Error retrieving notifications" });
            }
        }

        // POST: api/notifications/mark-read
        [HttpPost]
        public JsonResult MarkAsRead(int id)
        {
            try
            {
                notificationClient.MarkAsRead(id);
                return Json(new { success = true });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error marking notification as read: {ex.Message}");
                return Json(new { success = false, message = "Error updating notification" });
            }
        }

        // GET: Notifications/Index - Admin notification dashboard
        public ActionResult Index()
        {
            return View();
        }
    }
}
