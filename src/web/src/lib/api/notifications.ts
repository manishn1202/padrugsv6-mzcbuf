/**
 * API client library for managing notifications in the Prior Authorization Management System.
 * Implements caching, batching, and performance optimizations to meet <3s response time requirements.
 * @version 1.0.0
 */

import axiosInstance from '../axios';
import axiosRetry from 'axios-retry';
import { API_ENDPOINTS, API_CONFIG } from '../../config/api';
import { 
  Notification, 
  NotificationResponse, 
  NotificationPreferences,
  NotificationType 
} from '../../types/notifications';
import { ApiResponse, isApiError } from '../../types/api';

// Cache configuration
const CACHE_CONFIG = {
  NOTIFICATION_TTL: 5 * 60 * 1000, // 5 minutes
  UNREAD_COUNT_TTL: 30 * 1000, // 30 seconds
  PREFERENCES_TTL: 15 * 60 * 1000 // 15 minutes
};

// In-memory cache implementation
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Manages the notification cache with TTL
 */
class NotificationCache {
  static set(key: string, data: any, ttl: number): void {
    cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    });
  }

  static get(key: string): any | null {
    const cached = cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.timestamp) {
      cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  static invalidate(pattern: RegExp): void {
    for (const key of cache.keys()) {
      if (pattern.test(key)) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Fetches paginated list of notifications with caching support
 * @param page - Page number to fetch
 * @param limit - Number of items per page
 * @param useCache - Whether to use cached data if available
 * @returns Promise resolving to paginated notification response
 */
export async function getNotifications(
  page: number = 1,
  limit: number = 20,
  useCache: boolean = true
): Promise<NotificationResponse> {
  const cacheKey = `notifications_${page}_${limit}`;
  
  if (useCache) {
    const cached = NotificationCache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await axiosInstance.get<ApiResponse<NotificationResponse>>(
      `${API_ENDPOINTS.NOTIFICATIONS.LIST}?page=${page}&limit=${limit}`,
      {
        timeout: API_CONFIG.TIMEOUT,
        headers: {
          'Cache-Control': 'no-cache'
        }
      }
    );

    const notificationResponse = response.data;
    NotificationCache.set(cacheKey, notificationResponse, CACHE_CONFIG.NOTIFICATION_TTL);
    
    return notificationResponse;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    throw new Error('Failed to fetch notifications');
  }
}

/**
 * Gets count of unread notifications with caching
 * @param useCache - Whether to use cached count if available
 * @returns Promise resolving to unread count
 */
export async function getUnreadCount(useCache: boolean = true): Promise<number> {
  const cacheKey = 'unread_count';
  
  if (useCache) {
    const cached = NotificationCache.get(cacheKey);
    if (cached !== null) return cached;
  }

  try {
    const response = await axiosInstance.get<ApiResponse<{ count: number }>>(
      `${API_ENDPOINTS.NOTIFICATIONS.STATUS}/unread/count`
    );

    const count = response.data.data.count;
    NotificationCache.set(cacheKey, count, CACHE_CONFIG.UNREAD_COUNT_TTL);
    
    return count;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    throw new Error('Failed to fetch unread count');
  }
}

/**
 * Marks notifications as read with optimistic updates
 * @param notificationIds - Array of notification IDs to mark as read
 * @returns Promise resolving when complete
 */
export async function markAsRead(notificationIds: string[]): Promise<void> {
  // Optimistically update cache
  const cachePattern = /^notifications_/;
  const cachedResponses = Array.from(cache.entries())
    .filter(([key]) => cachePattern.test(key))
    .map(([_, value]) => value.data as NotificationResponse);

  cachedResponses.forEach(response => {
    response.notifications.forEach(notification => {
      if (notificationIds.includes(notification.id)) {
        notification.read = true;
      }
    });
    response.unreadCount = Math.max(0, response.unreadCount - notificationIds.length);
  });

  try {
    await axiosInstance.put(
      API_ENDPOINTS.NOTIFICATIONS.MARK_READ,
      { notificationIds }
    );
    
    // Invalidate unread count cache
    NotificationCache.invalidate(/^unread_count/);
  } catch (error) {
    // Revert optimistic updates on failure
    NotificationCache.invalidate(cachePattern);
    if (isApiError(error)) {
      throw error;
    }
    throw new Error('Failed to mark notifications as read');
  }
}

/**
 * Updates notification preferences with validation
 * @param preferences - Updated notification preferences
 * @returns Promise resolving to updated preferences
 */
export async function updatePreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  // Validate preferences
  if (preferences.enabledTypes) {
    const validTypes = Object.values(NotificationType);
    const invalidTypes = preferences.enabledTypes.filter(
      type => !validTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid notification types: ${invalidTypes.join(', ')}`);
    }
  }

  try {
    const response = await axiosInstance.put<ApiResponse<NotificationPreferences>>(
      API_ENDPOINTS.NOTIFICATIONS.PREFERENCES,
      preferences
    );

    const updatedPreferences = response.data.data;
    NotificationCache.set(
      'notification_preferences',
      updatedPreferences,
      CACHE_CONFIG.PREFERENCES_TTL
    );
    
    return updatedPreferences;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    throw new Error('Failed to update notification preferences');
  }
}

// Configure retry behavior for notification endpoints
axiosRetry(axiosInstance, {
  retries: 2,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // Progressive delay
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           (error.response?.status === 429); // Retry on rate limit
  }
});