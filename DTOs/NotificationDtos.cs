#nullable enable

using System;
using System.Collections.Generic;

namespace ContosoUniversity.DTOs;

public record NotificationListDto(List<NotificationItemDto> Notifications, int UnreadCount);

public record NotificationItemDto(
    int Id,
    string EntityType,
    string Operation,
    string? EntityDisplayName,
    DateTime Timestamp);
