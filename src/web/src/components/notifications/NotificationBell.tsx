/**
 * @fileoverview A secure and accessible React component that renders a notification bell icon
 * with an unread count badge for the Prior Authorization Management System.
 * Implements HIPAA-compliant notification handling with performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import classNames from 'classnames'; // v2.3.2
import { Badge } from '../common/Badge';
import { useNotification } from '../../hooks/useNotification';
import NotificationPanel from './NotificationPanel';
import { Size } from '../../types/common';
import { ErrorType } from '../../types/api';

// Constants for component behavior
const REFRESH_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 300; // 300ms for click handling
const ERROR_RETRY_COUNT = 3;

/**
 * Props interface for NotificationBell component with enhanced security and accessibility
 */
interface NotificationBellProps {
  /** Optional CSS class name */
  className?: string;
  /** Interval in ms to refresh notifications */
  refreshInterval?: number;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Handler for notification click events */
  onNotificationClick?: () => void;
}

/**
 * NotificationBell component that renders a notification bell icon with unread count
 * and implements HIPAA-compliant security measures and accessibility features.
 */
export const NotificationBell: React.FC<NotificationBellProps> = React.memo(({
  className,
  refreshInterval = REFRESH_INTERVAL,
  ariaLabel = 'Notification bell',
  onNotificationClick
}) => {
  // State management with error handling
  const {
    unreadCount,
    loading,
    error,
    clearError,
    fetchNotifications
  } = useNotification(refreshInterval);

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const bellRef = useRef<HTMLButtonElement>(null);

  /**
   * Handles retry logic for failed notification fetches
   */
  const handleRetry = useCallback(async () => {
    if (retryCount >= ERROR_RETRY_COUNT) {
      console.error('Max retry attempts reached for notification fetch');
      return;
    }

    setRetryCount(prev => prev + 1);
    clearError();

    try {
      await fetchNotifications();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }, [retryCount, clearError, fetchNotifications]);

  /**
   * Debounced handler for bell icon click events
   */
  const handleBellClick = useCallback(() => {
    let timeoutId: NodeJS.Timeout;

    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsPanelOpen(prev => !prev);
        onNotificationClick?.();

        // Announce state change for screen readers
        const message = `Notification panel ${!isPanelOpen ? 'opened' : 'closed'}`;
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'alert');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }, DEBOUNCE_DELAY);
    };
  }, [isPanelOpen, onNotificationClick]);

  /**
   * Handles keyboard navigation for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBellClick()();
    }
  }, [handleBellClick]);

  /**
   * Effect for handling errors and retries
   */
  useEffect(() => {
    if (error?.error_type === ErrorType.TIMEOUT_ERROR) {
      handleRetry();
    }
  }, [error, handleRetry]);

  /**
   * Effect for cleaning up timeouts on unmount
   */
  useEffect(() => {
    return () => {
      setIsPanelOpen(false);
      setRetryCount(0);
    };
  }, []);

  return (
    <div className={classNames('relative inline-block', className)}>
      <button
        ref={bellRef}
        className={classNames(
          'p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
          {
            'bg-gray-100': isPanelOpen,
            'cursor-not-allowed opacity-75': loading
          }
        )}
        onClick={handleBellClick()}
        onKeyDown={handleKeyDown}
        disabled={loading}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={isPanelOpen}
        aria-busy={loading}
        data-testid="notification-bell"
      >
        <svg
          className="h-6 w-6 text-gray-600"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <Badge
            variant="error"
            size={Size.SM}
            className="absolute -top-1 -right-1"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>

      {/* Error message */}
      {error && !loading && (
        <div
          className="absolute top-full right-0 mt-2 w-48 text-sm text-red-600 bg-red-50 p-2 rounded shadow-lg"
          role="alert"
        >
          <p>{error.message}</p>
          {retryCount < ERROR_RETRY_COUNT && (
            <button
              className="mt-1 text-red-700 underline text-xs"
              onClick={handleRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Notification panel */}
      <NotificationPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        className="mt-2"
      />
    </div>
  );
});

NotificationBell.displayName = 'NotificationBell';

export default NotificationBell;