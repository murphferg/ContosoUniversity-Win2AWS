using System;
using ContosoUniversity.Services;
using ContosoUniversity.Models;
using ContosoUniversity.Data;
using Microsoft.AspNetCore.Mvc;


namespace ContosoUniversity.Controllers
{
    public abstract class BaseController : Controller
    {
        protected SchoolContext db;
        protected NotificationClient notificationClient;

        protected BaseController(SchoolContext db, NotificationClient notificationClient)
        {
            this.db = db;
            this.notificationClient = notificationClient;
        }

        protected void SendEntityNotification(string entityType, string entityId, EntityOperation operation)
        {
            SendEntityNotification(entityType, entityId, null, operation);
        }

        protected void SendEntityNotification(string entityType, string entityId, string entityDisplayName, EntityOperation operation)
        {
            try
            {
                var userName = "System"; // No authentication, use System as default user
                notificationClient.SendNotification(entityType, entityId, entityDisplayName, operation, userName);
            }
            catch (Exception ex)
            {
                // Log the error but don't break the main operation
                System.Diagnostics.Debug.WriteLine($"Failed to send notification: {ex.Message}");
            }
        }
    }
}
