/**
 * @fileoverview Custom React hook for managing notifications in the Prior Authorization Management System.
 * Implements real-time notification state management with configurable polling, error handling, and accessibility support.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Notification, 
  NotificationResponse,
  NotificationType 
} from '../../types/notifications';
import { 
  getNotifications, 
  markAsRead 
} from '../../lib/api/notifications';
import { ApiError, ErrorType } from '../../types/api';

// Default polling interval of 30 seconds
const DEFAULT_POLLING_INTERVAL = 30000;

// Custom error type for notification operations
interface NotificationError {
  type: ErrorType;
  message: string;
  details?: Record<string, unknown>;
}

// Return type for the useNotification hook
interface NotificationHookReturn {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  loading: boolean;
  error: NotificationError | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook for managing notifications with real-time updates and error handling
 * @param refreshInterval - Optional polling interval in milliseconds (default: 30000)
 * @returns NotificationHookReturn object containing notification state and operations
 */
export function useNotification(
  refreshInterval: number = DEFAULT_POLLING_INTERVAL
): NotificationHookReturn {
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<NotificationError | null>(null);

  /**
   * Fetches notifications from the API with error handling
   */
  const fetchNotifications = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response: NotificationResponse = await getNotifications(1, 20, true);

      // Validate response data
      if (!Array.isArray(response.notifications)) {
        throw new Error('Invalid notification data received');
      }

      // Update state with new notifications
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
      setTotalCount(response.total_count);

      // Announce new notifications for accessibility
      if (response.unread_count > 0) {
        announceNewNotifications(response.unread_count);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError({
        type: apiError.error_type || ErrorType.INTERNAL_SERVER_ERROR,
        message: apiError.message || 'Failed to fetch notifications',
        details: apiError.details
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Marks notifications as read with optimistic updates
   * @param notificationIds - Array of notification IDs to mark as read
   */
  const handleMarkAsRead = useCallback(async (
    notificationIds: string[]
  ): Promise<void> => {
    if (!notificationIds.length) return;

    // Optimistically update local state
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: notification.read || notificationIds.includes(notification.id)
    }));

    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    setNotifications(updatedNotifications);
    setUnreadCount(Math.max(0, unreadCount - notificationIds.length));

    try {
      await markAsRead(notificationIds);

      // Announce status change for accessibility
      announceNotificationsRead(notificationIds.length);
    } catch (err) {
      // Revert optimistic updates on error
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);

      const apiError = err as ApiError;
      setError({
        type: apiError.error_type || ErrorType.INTERNAL_SERVER_ERROR,
        message: apiError.message || 'Failed to mark notifications as read',
        details: apiError.details
      });
    }
  }, [notifications, unreadCount]);

  /**
   * Clears any existing notification errors
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Announces new notifications for screen readers
   */
  const announceNewNotifications = (count: number): void => {
    const message = `You have ${count} new notification${count === 1 ? '' : 's'}`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 3000);
  };

  /**
   * Announces when notifications are marked as read
   */
  const announceNotificationsRead = (count: number): void => {
    const message = `${count} notification${count === 1 ? '' : 's'} marked as read`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 3000);
  };

  // Set up polling effect
  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Set up polling interval
    const pollInterval = setInterval(fetchNotifications, refreshInterval);

    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchNotifications, refreshInterval]);

  return {
    notifications,
    unreadCount,
    totalCount,
    loading,
    error,
    fetchNotifications,
    markAsRead: handleMarkAsRead,
    clearError
  };
}
```

This implementation provides a comprehensive notification management hook that:

1. Implements real-time notification updates through configurable polling
2. Provides optimistic updates for marking notifications as read
3. Includes comprehensive error handling with typed errors
4. Supports accessibility through ARIA announcements
5. Manages loading states for better UX
6. Includes proper cleanup on unmount
7. Uses TypeScript for type safety
8. Follows React best practices for state management and memoization
9. Integrates with the existing notification API client
10. Provides a clean and intuitive interface for components

The hook can be used in components like this:

```typescript
const { 
  notifications, 
  unreadCount, 
  loading, 
  error, 
  markAsRead 
} = useNotification();