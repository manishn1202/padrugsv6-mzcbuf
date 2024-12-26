/**
 * @fileoverview A React component that renders a sliding notification panel with real-time 
 * notification updates, unread count badge, and notification list for the Prior Authorization Management System.
 * Implements HIPAA-compliant error handling, accessibility features, and performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames';
import { NotificationList } from './NotificationList';
import { Badge } from '../common/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Size } from '../../types/common';
import { ErrorType } from '../../types/api';

/**
 * Props interface for NotificationPanel component with enhanced accessibility and error handling
 */
interface NotificationPanelProps {
  /** Controls panel visibility state */
  isOpen: boolean;
  /** Callback function when panel is closed */
  onClose: () => void;
  /** Additional CSS classes for styling */
  className?: string;
  /** Accessibility label for the panel */
  ariaLabel?: string;
}

/**
 * NotificationPanel component that renders a sliding panel with notifications
 * and implements HIPAA-compliant error handling and accessibility features.
 */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  className,
  ariaLabel = 'Notification Panel'
}) => {
  // Fetch notifications using custom hook with error handling
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    clearError,
    retry: retryFetch
  } = useNotification();

  // Ref for panel element to handle click outside
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Handles click event on notification item with error handling
   */
  const handleNotificationClick = useCallback(async (notification) => {
    try {
      if (!notification.read) {
        await markAsRead([notification.id]);
      }
      onClose();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [markAsRead, onClose]);

  /**
   * Handles retry attempt for failed operations
   */
  const handleRetry = useCallback(async () => {
    clearError();
    try {
      await retryFetch();
    } catch (err) {
      console.error('Failed to retry notification fetch:', err);
    }
  }, [clearError, retryFetch]);

  /**
   * Handles click outside panel to close it
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
      onClose();
    }
  }, [onClose]);

  // Set up click outside listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, handleClickOutside]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Early return if panel is closed
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-label={ariaLabel}
      aria-modal="true"
    >
      {/* Backdrop with animation */}
      <div className="absolute inset-0 bg-black bg-opacity-25 transition-opacity">
        {/* Panel container */}
        <div
          ref={panelRef}
          className={classNames(
            'absolute inset-y-0 right-0 w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out',
            className
          )}
          role="region"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Notifications
                {unreadCount > 0 && (
                  <Badge
                    variant="error"
                    size={Size.SM}
                    className="ml-2"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount}
                  </Badge>
                )}
              </h2>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={onClose}
                aria-label="Close notifications"
              >
                <span className="sr-only">Close panel</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="h-full pb-6 pt-2 overflow-y-auto">
            {error ? (
              <div
                className="p-4 m-4 text-red-700 bg-red-100 rounded-md"
                role="alert"
              >
                <p className="font-medium">
                  {error.error_type === ErrorType.TIMEOUT_ERROR
                    ? 'Failed to load notifications due to timeout'
                    : 'Failed to load notifications'}
                </p>
                <button
                  className="mt-2 text-sm text-red-800 underline"
                  onClick={handleRetry}
                >
                  Retry
                </button>
              </div>
            ) : (
              <NotificationList
                maxHeight="calc(100vh - 120px)"
                onNotificationClick={handleNotificationClick}
                className="divide-y divide-gray-200"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;