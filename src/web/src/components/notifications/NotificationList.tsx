/**
 * @fileoverview A React component that renders a virtualized list of notifications
 * with real-time updates, filtering, grouping, and accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import { FixedSizeList as VirtualList } from 'react-window';
import classNames from 'classnames';
import { formatDistanceToNow } from 'date-fns';
import { Notification, NotificationPriority } from '../../types/notifications';
import { Badge } from '../common/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Size } from '../../types/common';

// Constants for component styling and behavior
const NOTIFICATION_ITEM_HEIGHT = 72;
const DEFAULT_MAX_HEIGHT = '400px';

/**
 * Props interface for NotificationList component
 */
interface NotificationListProps {
  maxHeight?: string;
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
  filter?: NotificationFilter;
  groupBy?: 'date' | 'priority' | 'category' | null;
}

/**
 * Interface for notification filtering options
 */
interface NotificationFilter {
  priority?: NotificationPriority[];
  read?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Maps notification priority to badge variant with accessibility labels
 */
const getPriorityBadgeVariant = (priority: NotificationPriority): {
  variant: 'error' | 'warning' | 'success';
  label: string;
} => {
  switch (priority) {
    case NotificationPriority.HIGH:
      return { variant: 'error', label: 'Urgent notification' };
    case NotificationPriority.MEDIUM:
      return { variant: 'warning', label: 'Important notification' };
    case NotificationPriority.LOW:
      return { variant: 'success', label: 'Information notification' };
  }
};

/**
 * NotificationList component that renders a virtualized list of notifications
 * with real-time updates and accessibility features.
 */
export const NotificationList: React.FC<NotificationListProps> = ({
  maxHeight = DEFAULT_MAX_HEIGHT,
  onNotificationClick,
  className,
  filter,
  groupBy
}) => {
  // Fetch notifications using custom hook
  const { 
    notifications, 
    loading, 
    error, 
    markAsRead, 
    retryFetch 
  } = useNotification();

  /**
   * Filters notifications based on provided criteria
   */
  const filteredNotifications = useMemo(() => {
    if (!filter) return notifications;

    return notifications.filter(notification => {
      if (filter.priority && !filter.priority.includes(notification.priority)) {
        return false;
      }
      if (filter.read !== undefined && notification.read !== filter.read) {
        return false;
      }
      if (filter.startDate && new Date(notification.createdAt) < filter.startDate) {
        return false;
      }
      if (filter.endDate && new Date(notification.createdAt) > filter.endDate) {
        return false;
      }
      return true;
    });
  }, [notifications, filter]);

  /**
   * Groups notifications by specified criteria
   */
  const groupedNotifications = useMemo(() => {
    if (!groupBy) return { ungrouped: filteredNotifications };

    return filteredNotifications.reduce((groups, notification) => {
      let groupKey: string;

      switch (groupBy) {
        case 'date':
          groupKey = new Date(notification.createdAt).toDateString();
          break;
        case 'priority':
          groupKey = notification.priority;
          break;
        case 'category':
          groupKey = notification.category;
          break;
        default:
          groupKey = 'ungrouped';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
      return groups;
    }, {} as Record<string, Notification[]>);
  }, [filteredNotifications, groupBy]);

  /**
   * Handles click events on notification items
   */
  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (!notification.read) {
      try {
        await markAsRead([notification.id]);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    onNotificationClick?.(notification);
  }, [markAsRead, onNotificationClick]);

  /**
   * Renders individual notification items
   */
  const NotificationItem = useCallback(({ index, style }: any) => {
    const notification = filteredNotifications[index];
    const { variant, label } = getPriorityBadgeVariant(notification.priority);

    return (
      <div
        style={style}
        className={classNames(
          'p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer',
          !notification.read && 'bg-blue-50'
        )}
        onClick={() => handleNotificationClick(notification)}
        role="listitem"
        aria-label={`${label}: ${notification.title}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">{notification.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
          </div>
          <Badge
            variant={variant}
            size={Size.SM}
            className="ml-2"
            aria-label={label}
          >
            {notification.priority}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </div>
      </div>
    );
  }, [filteredNotifications, handleNotificationClick]);

  // Handle loading and error states
  if (loading) {
    return (
      <div className="flex justify-center items-center p-4" role="status">
        <span className="sr-only">Loading notifications...</span>
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="p-4 text-red-700 bg-red-100 rounded"
        role="alert"
      >
        <p>{error.message}</p>
        <button
          className="mt-2 text-sm text-red-800 underline"
          onClick={retryFetch}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={classNames('border border-gray-200 rounded-lg overflow-hidden', className)}
      role="list"
      aria-label="Notifications list"
    >
      <VirtualList
        height={parseInt(maxHeight) || parseInt(DEFAULT_MAX_HEIGHT)}
        width="100%"
        itemCount={filteredNotifications.length}
        itemSize={NOTIFICATION_ITEM_HEIGHT}
      >
        {NotificationItem}
      </VirtualList>
    </div>
  );
};

export default NotificationList;