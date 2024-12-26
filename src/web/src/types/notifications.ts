/**
 * @fileoverview TypeScript type definitions for the Prior Authorization Management System notification system.
 * Defines interfaces and types for notifications, preferences, and API responses.
 * @version 1.0.0
 */

/**
 * Enum defining all possible notification types in the PA workflow
 */
export enum NotificationType {
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
  REQUEST_APPROVED = 'REQUEST_APPROVED',
  REQUEST_DENIED = 'REQUEST_DENIED',
  ADDITIONAL_INFO_NEEDED = 'ADDITIONAL_INFO_NEEDED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  REQUEST_EXPIRED = 'REQUEST_EXPIRED',
  REVIEW_ASSIGNED = 'REVIEW_ASSIGNED',
  REVIEW_COMPLETED = 'REVIEW_COMPLETED'
}

/**
 * Enum defining notification priority levels for UI display and sorting
 */
export enum NotificationPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Interface defining structure of a notification object with all required fields
 */
export interface Notification {
  /** Unique identifier for the notification */
  id: string;
  
  /** Type of notification from NotificationType enum */
  type: NotificationType;
  
  /** Priority level of the notification */
  priority: NotificationPriority;
  
  /** Short descriptive title of the notification */
  title: string;
  
  /** Detailed notification message */
  message: string;
  
  /** Whether the notification has been read */
  read: boolean;
  
  /** Timestamp when notification was created */
  createdAt: Date;
  
  /** Additional metadata specific to notification type */
  metadata: Record<string, unknown>;
  
  /** Associated PA request ID if applicable */
  requestId: string;
  
  /** Optional URL for notification action */
  actionUrl: string | null;
}

/**
 * Interface defining user notification preferences with delivery options
 */
export interface NotificationPreferences {
  /** User ID associated with preferences */
  userId: string;
  
  /** Array of notification types the user wants to receive */
  enabledTypes: NotificationType[];
  
  /** Whether email notifications are enabled */
  emailEnabled: boolean;
  
  /** Whether push notifications are enabled */
  pushEnabled: boolean;
  
  /** Frequency of email digest notifications */
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  
  /** Minimum priority level for notifications */
  minimumPriority: NotificationPriority;
}

/**
 * Interface defining structure of paginated notification API responses
 */
export interface NotificationResponse {
  /** Array of notification objects */
  notifications: Notification[];
  
  /** Count of unread notifications */
  unreadCount: number;
  
  /** Total count of notifications */
  totalCount: number;
  
  /** Current page number */
  page: number;
  
  /** Number of items per page */
  limit: number;
  
  /** Whether there are more pages available */
  hasMore: boolean;
}