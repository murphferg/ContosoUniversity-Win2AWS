import { useCallback, useEffect, useRef, useState } from 'react';
import { get, post } from '../apiClient';
import type { NotificationItem, NotificationList } from '../types';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await get<NotificationList>('/api/notifications');
      setUnreadCount(data.unreadCount);
      setNotifications(data.notifications);
    } catch {
      // On failure, retain last known count and notifications
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    setDropdownOpen((prev) => !prev);
  };

  const handleNotificationClick = async (id: number) => {
    try {
      await post<void>(`/api/notifications/${id}/mark-read`);
      setNotifications((prev) =>
        prev.filter((n) => n.id !== id),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail on mark-read error
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const displayCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={bellRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleBellClick}
        aria-label={`Notifications (${displayCount} unread)`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', position: 'relative' }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-8px',
              background: 'red',
              color: 'white',
              borderRadius: '10px',
              padding: '1px 5px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              minWidth: '16px',
              textAlign: 'center',
            }}
          >
            {displayCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            width: '320px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {notifications.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
              No notifications
            </div>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <button
                key={notification.id}
                type="button"
                role="menuitem"
                onClick={() => handleNotificationClick(notification.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: '1px solid #eee',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {notification.entityType} — {notification.operation}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  {formatTimestamp(notification.timestamp)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
