/**
 * @fileoverview Notification Settings component for managing user notification preferences
 * in the Prior Authorization Management System. Implements HIPAA-compliant notification
 * configuration with accessibility support.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { useNotification } from '../../hooks/useNotification';
import { NotificationType, NotificationPreferences } from '../../types/notifications';
import Card from '../../components/common/Card';

// Default notification preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  userId: '',
  enabledTypes: [
    NotificationType.REQUEST_SUBMITTED,
    NotificationType.REQUEST_APPROVED,
    NotificationType.REQUEST_DENIED,
    NotificationType.ADDITIONAL_INFO_NEEDED
  ],
  emailEnabled: true,
  pushEnabled: true,
  emailFrequency: 'immediate',
  minimumPriority: 'MEDIUM'
};

/**
 * Component for managing notification preferences with accessibility support
 */
const NotificationsSettings: React.FC = () => {
  // State management
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Custom hook for notification management
  const { updatePreferences } = useNotification();

  /**
   * Validates notification preferences before saving
   */
  const validatePreferences = (prefs: NotificationPreferences): boolean => {
    if (!prefs.enabledTypes.length) {
      setError('At least one notification type must be enabled');
      return false;
    }
    if (!prefs.emailEnabled && !prefs.pushEnabled) {
      setError('At least one delivery method must be enabled');
      return false;
    }
    return true;
  };

  /**
   * Debounced handler for saving preference updates
   */
  const handlePreferenceUpdate = useCallback(
    debounce(async (updatedPreferences: NotificationPreferences) => {
      if (!validatePreferences(updatedPreferences)) {
        return;
      }

      setLoading(true);
      setError(null);
      setSaveSuccess(false);

      try {
        await updatePreferences(updatedPreferences);
        setSaveSuccess(true);
        setIsDirty(false);
        
        // Announce success for screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'alert');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = 'Notification preferences saved successfully';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      } catch (err) {
        setError('Failed to save notification preferences. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 500),
    [updatePreferences]
  );

  /**
   * Handles changes to notification type toggles
   */
  const handleTypeToggle = (type: NotificationType) => {
    const updatedTypes = preferences.enabledTypes.includes(type)
      ? preferences.enabledTypes.filter(t => t !== type)
      : [...preferences.enabledTypes, type];

    const updatedPreferences = {
      ...preferences,
      enabledTypes: updatedTypes
    };

    setPreferences(updatedPreferences);
    setIsDirty(true);
    handlePreferenceUpdate(updatedPreferences);
  };

  /**
   * Handles changes to delivery method settings
   */
  const handleDeliveryMethodChange = (method: 'email' | 'push', enabled: boolean) => {
    const updatedPreferences = {
      ...preferences,
      [method === 'email' ? 'emailEnabled' : 'pushEnabled']: enabled
    };

    setPreferences(updatedPreferences);
    setIsDirty(true);
    handlePreferenceUpdate(updatedPreferences);
  };

  /**
   * Handles changes to email frequency setting
   */
  const handleFrequencyChange = (frequency: 'immediate' | 'daily' | 'weekly') => {
    const updatedPreferences = {
      ...preferences,
      emailFrequency: frequency
    };

    setPreferences(updatedPreferences);
    setIsDirty(true);
    handlePreferenceUpdate(updatedPreferences);
  };

  return (
    <div className="notification-settings" role="main" aria-labelledby="settings-title">
      <h1 id="settings-title" className="text-2xl font-bold mb-6">
        Notification Settings
      </h1>

      {error && (
        <div role="alert" className="alert alert--error mb-4">
          {error}
        </div>
      )}

      {saveSuccess && (
        <div role="alert" className="alert alert--success mb-4">
          Settings saved successfully
        </div>
      )}

      <Card
        variant="outlined"
        padding="large"
        ariaLabel="Notification type preferences"
      >
        <h2 className="text-xl font-semibold mb-4">Notification Types</h2>
        <div className="space-y-4">
          {Object.values(NotificationType).map(type => (
            <div key={type} className="flex items-center">
              <input
                type="checkbox"
                id={`type-${type}`}
                checked={preferences.enabledTypes.includes(type)}
                onChange={() => handleTypeToggle(type)}
                disabled={loading}
                aria-label={`Enable ${type.toLowerCase().replace('_', ' ')} notifications`}
              />
              <label htmlFor={`type-${type}`} className="ml-3">
                {type.toLowerCase().replace('_', ' ')}
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card
        variant="outlined"
        padding="large"
        className="mt-6"
        ariaLabel="Delivery method preferences"
      >
        <h2 className="text-xl font-semibold mb-4">Delivery Methods</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="email-enabled"
              checked={preferences.emailEnabled}
              onChange={(e) => handleDeliveryMethodChange('email', e.target.checked)}
              disabled={loading || (!preferences.pushEnabled && preferences.emailEnabled)}
              aria-label="Enable email notifications"
            />
            <label htmlFor="email-enabled" className="ml-3">
              Email Notifications
            </label>
          </div>

          {preferences.emailEnabled && (
            <div className="ml-8">
              <label htmlFor="email-frequency" className="block mb-2">
                Email Frequency
              </label>
              <select
                id="email-frequency"
                value={preferences.emailFrequency}
                onChange={(e) => handleFrequencyChange(e.target.value as any)}
                disabled={loading}
                className="input"
                aria-label="Select email notification frequency"
              >
                <option value="immediate">Immediate</option>
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Digest</option>
              </select>
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="push-enabled"
              checked={preferences.pushEnabled}
              onChange={(e) => handleDeliveryMethodChange('push', e.target.checked)}
              disabled={loading || (!preferences.emailEnabled && preferences.pushEnabled)}
              aria-label="Enable push notifications"
            />
            <label htmlFor="push-enabled" className="ml-3">
              Push Notifications
            </label>
          </div>
        </div>
      </Card>

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 text-secondary"
        >
          Saving changes...
        </div>
      )}
    </div>
  );
};

export default NotificationsSettings;