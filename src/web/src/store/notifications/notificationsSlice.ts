/**
 * Redux Toolkit slice for managing notification state in the Prior Authorization Management System.
 * Implements real-time notifications with offline support, batch operations, and enhanced error handling.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { 
  Notification, 
  NotificationPreferences,
  NotificationType,
  NotificationPriority,
  NotificationResponse 
} from '../../types/notifications';
import { NotificationAPI } from '../../lib/api/notifications';
import { isApiError } from '../../types/api';

// State interface with enhanced offline support and error handling
interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  loading: {
    fetch: boolean;
    update: boolean;
    preferences: boolean;
  };
  error: {
    type: string | null;
    message: string | null;
    retryCount: number;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
  };
  offline: {
    queue: Array<{
      action: string;
      payload: any;
      timestamp: number;
    }>;
    lastSync: string | null;
  };
}

// Initial state with HIPAA-compliant defaults
const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  preferences: {
    userId: '',
    enabledTypes: Object.values(NotificationType),
    emailEnabled: true,
    pushEnabled: true,
    emailFrequency: 'immediate',
    minimumPriority: NotificationPriority.LOW
  },
  loading: {
    fetch: false,
    update: false,
    preferences: false
  },
  error: {
    type: null,
    message: null,
    retryCount: 0
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 20
  },
  offline: {
    queue: [],
    lastSync: null
  }
};

// Async thunk for fetching notifications with retry logic
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ page, limit }: { page: number; limit: number }, { rejectWithValue }) => {
    try {
      const response = await NotificationAPI.getNotifications(page, limit);
      return response;
    } catch (error) {
      if (isApiError(error)) {
        return rejectWithValue({
          type: error.error_type,
          message: error.message
        });
      }
      throw error;
    }
  }
);

// Async thunk for marking notifications as read with offline support
export const markNotificationsAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationIds: string[], { dispatch, getState, rejectWithValue }) => {
    try {
      await NotificationAPI.markAsRead(notificationIds);
      return notificationIds;
    } catch (error) {
      if (isApiError(error)) {
        // Queue for offline retry
        dispatch(queueOfflineAction({
          action: 'markAsRead',
          payload: notificationIds,
          timestamp: Date.now()
        }));
        return rejectWithValue({
          type: error.error_type,
          message: error.message
        });
      }
      throw error;
    }
  }
);

// Async thunk for updating notification preferences
export const updateNotificationPreferences = createAsyncThunk(
  'notifications/updatePreferences',
  async (preferences: Partial<NotificationPreferences>, { rejectWithValue }) => {
    try {
      const response = await NotificationAPI.updatePreferences(preferences);
      return response;
    } catch (error) {
      if (isApiError(error)) {
        return rejectWithValue({
          type: error.error_type,
          message: error.message
        });
      }
      throw error;
    }
  }
);

// Create the notifications slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    queueOfflineAction(state, action: PayloadAction<{
      action: string;
      payload: any;
      timestamp: number;
    }>) {
      state.offline.queue.push(action.payload);
    },
    clearOfflineQueue(state) {
      state.offline.queue = [];
      state.offline.lastSync = new Date().toISOString();
    },
    resetError(state) {
      state.error = initialState.error;
    },
    updateUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications reducers
      .addCase(fetchNotifications.pending, (state) => {
        state.loading.fetch = true;
        state.error = initialState.error;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
        state.pagination = {
          currentPage: action.payload.page,
          totalPages: Math.ceil(action.payload.totalCount / state.pagination.itemsPerPage),
          itemsPerPage: state.pagination.itemsPerPage
        };
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading.fetch = false;
        if (action.payload) {
          state.error = {
            ...action.payload as { type: string; message: string },
            retryCount: state.error.retryCount + 1
          };
        }
      })
      // Mark as read reducers
      .addCase(markNotificationsAsRead.pending, (state) => {
        state.loading.update = true;
      })
      .addCase(markNotificationsAsRead.fulfilled, (state, action) => {
        state.loading.update = false;
        state.notifications = state.notifications.map(notification => 
          action.payload.includes(notification.id) 
            ? { ...notification, read: true }
            : notification
        );
        state.unreadCount = Math.max(0, state.unreadCount - action.payload.length);
      })
      .addCase(markNotificationsAsRead.rejected, (state, action) => {
        state.loading.update = false;
        if (action.payload) {
          state.error = {
            ...action.payload as { type: string; message: string },
            retryCount: state.error.retryCount + 1
          };
        }
      })
      // Update preferences reducers
      .addCase(updateNotificationPreferences.pending, (state) => {
        state.loading.preferences = true;
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.loading.preferences = false;
        state.preferences = action.payload;
      })
      .addCase(updateNotificationPreferences.rejected, (state, action) => {
        state.loading.preferences = false;
        if (action.payload) {
          state.error = {
            ...action.payload as { type: string; message: string },
            retryCount: state.error.retryCount + 1
          };
        }
      });
  }
});

// Configure persistence
const persistConfig = {
  key: 'notifications',
  storage,
  whitelist: ['notifications', 'preferences', 'offline']
};

// Export actions
export const { 
  queueOfflineAction, 
  clearOfflineQueue, 
  resetError,
  updateUnreadCount 
} = notificationsSlice.actions;

// Export selectors
export const selectNotifications = (state: { notifications: NotificationsState }) => 
  state.notifications.notifications;

export const selectUnreadCount = (state: { notifications: NotificationsState }) => 
  state.notifications.unreadCount;

export const selectNotificationPreferences = (state: { notifications: NotificationsState }) => 
  state.notifications.preferences;

export const selectOfflineQueue = (state: { notifications: NotificationsState }) => 
  state.notifications.offline.queue;

// Export persisted reducer
export default persistReducer(persistConfig, notificationsSlice.reducer);