using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using ContosoUniversity.Models;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace ContosoUniversity.Services;

public class NotificationClient
{
    private readonly HttpClient _httpClient;

    public NotificationClient(HttpClient httpClient, IConfiguration configuration)
    {
        var baseUrl = configuration["AppSettings:NotificationServiceBaseUrl"];
        httpClient.BaseAddress = new Uri(baseUrl!);
        _httpClient = httpClient;
    }

    public void SendNotification(string entityType, string entityId, string entityDisplayName, EntityOperation operation, string userName)
    {
        try
        {
            var requestBody = new
            {
                entityType,
                entityId,
                entityDisplayName,
                operation,
                createdBy = userName
            };

            var json = JsonConvert.SerializeObject(requestBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _httpClient.PostAsync("/api/notifications", content).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to send notification: {ex.Message}");
        }
    }

    public List<Notification> GetNotifications(int max = 10)
    {
        try
        {
            var response = _httpClient.GetAsync($"/api/notifications?max={max}").GetAwaiter().GetResult();

            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"Failed to get notifications: HTTP {(int)response.StatusCode}");
                return new List<Notification>();
            }

            var responseBody = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            var result = JsonConvert.DeserializeObject<NotificationResponse>(responseBody);

            return result?.Notifications ?? new List<Notification>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to get notifications: {ex.Message}");
            return new List<Notification>();
        }
    }

    public void MarkAsRead(int id)
    {
        try
        {
            _httpClient.PostAsync($"/api/notifications/{id}/mark-read", null).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to mark notification as read: {ex.Message}");
        }
    }

    /// <summary>
    /// Gets notifications from the microservice, throwing on failure.
    /// Use this when the caller needs to distinguish service unavailability from empty results.
    /// </summary>
    public async Task<List<Notification>> GetNotificationsAsync(int max = 10)
    {
        var response = await _httpClient.GetAsync($"/api/notifications?max={max}");
        response.EnsureSuccessStatusCode();

        var responseBody = await response.Content.ReadAsStringAsync();
        var result = JsonConvert.DeserializeObject<NotificationResponse>(responseBody);

        return result?.Notifications ?? new List<Notification>();
    }

    /// <summary>
    /// Marks a notification as read, throwing on failure.
    /// </summary>
    public async Task MarkAsReadAsync(int id)
    {
        var response = await _httpClient.PostAsync($"/api/notifications/{id}/mark-read", null);
        response.EnsureSuccessStatusCode();
    }

    private class NotificationResponse
    {
        public bool Success { get; set; }
        public List<Notification> Notifications { get; set; } = new();
        public int Count { get; set; }
    }
}
