import React, { useEffect, useState, useCallback } from 'react';
import CryptoJS from 'crypto-js'; // v4.1.1
import { Button } from '../../components/common/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS, ERROR_MESSAGES } from '../../config/constants';

/**
 * Interface defining user preference options
 */
interface UserPreferences {
  themeMode: 'light' | 'dark';
  enableNotifications: boolean;
  enableEmailAlerts: boolean;
  language: string;
  displaySettings: {
    fontSize: number;
    highContrast: boolean;
    reducedMotion: boolean;
  };
}

/**
 * Default preferences configuration
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  themeMode: 'light',
  enableNotifications: true,
  enableEmailAlerts: true,
  language: 'en',
  displaySettings: {
    fontSize: 16,
    highContrast: false,
    reducedMotion: false
  }
};

/**
 * Preferences page component that allows users to customize their application experience
 * with enhanced security and accessibility features.
 */
const Preferences: React.FC = () => {
  // Theme context for managing application theme
  const { mode: themeMode, toggleTheme } = useTheme();

  // Local state for preferences with secure storage
  const [preferences, setPreferences, removePreferences] = useLocalStorage<UserPreferences>(
    LOCAL_STORAGE_KEYS.USER_PREFERENCES,
    DEFAULT_PREFERENCES,
    true // Enable encryption
  );

  // Local state for form handling
  const [formState, setFormState] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize form state from stored preferences
   */
  useEffect(() => {
    if (preferences) {
      setFormState(preferences);
    }
  }, [preferences]);

  /**
   * Handle preference changes with validation and encryption
   */
  const handlePreferenceChange = useCallback(async (
    key: keyof UserPreferences,
    value: any
  ) => {
    try {
      setError(null);
      
      // Update form state
      setFormState(prev => ({
        ...prev,
        [key]: value
      }));

    } catch (error) {
      console.error('Error updating preference:', error);
      setError(ERROR_MESSAGES.GENERIC_ERROR);
    }
  }, []);

  /**
   * Handle display settings changes
   */
  const handleDisplaySettingChange = useCallback((
    setting: keyof UserPreferences['displaySettings'],
    value: any
  ) => {
    setFormState(prev => ({
      ...prev,
      displaySettings: {
        ...prev.displaySettings,
        [setting]: value
      }
    }));
  }, []);

  /**
   * Save all preferences
   */
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Update theme if changed
      if (formState.themeMode !== themeMode) {
        toggleTheme();
      }

      // Save preferences to secure storage
      await setPreferences(formState);

      // Apply display settings
      document.documentElement.style.fontSize = `${formState.displaySettings.fontSize}px`;
      document.documentElement.classList.toggle('high-contrast', formState.displaySettings.highContrast);
      document.documentElement.classList.toggle('reduced-motion', formState.displaySettings.reducedMotion);

    } catch (error) {
      console.error('Error saving preferences:', error);
      setError(ERROR_MESSAGES.GENERIC_ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Reset preferences to defaults
   */
  const handleReset = async () => {
    try {
      await removePreferences();
      setFormState(DEFAULT_PREFERENCES);
      
      // Reset theme if needed
      if (themeMode !== DEFAULT_PREFERENCES.themeMode) {
        toggleTheme();
      }

      // Reset display settings
      document.documentElement.style.fontSize = '';
      document.documentElement.classList.remove('high-contrast', 'reduced-motion');

    } catch (error) {
      console.error('Error resetting preferences:', error);
      setError(ERROR_MESSAGES.GENERIC_ERROR);
    }
  };

  return (
    <div className="preferences-page p-6" role="main">
      <h1 className="text-2xl font-semibold mb-6">Preferences</h1>

      {/* Theme Preferences */}
      <section className="mb-8" aria-labelledby="theme-heading">
        <h2 id="theme-heading" className="text-xl mb-4">Theme Settings</h2>
        <div className="flex items-center mb-4">
          <label htmlFor="theme-toggle" className="mr-4">Dark Mode</label>
          <input
            id="theme-toggle"
            type="checkbox"
            checked={formState.themeMode === 'dark'}
            onChange={(e) => handlePreferenceChange('themeMode', e.target.checked ? 'dark' : 'light')}
            className="form-checkbox"
            aria-describedby="theme-description"
          />
          <span id="theme-description" className="ml-2 text-sm text-gray-600">
            Enable dark theme for reduced eye strain
          </span>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="mb-8" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading" className="text-xl mb-4">Notification Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <label htmlFor="notifications-toggle" className="mr-4">Browser Notifications</label>
            <input
              id="notifications-toggle"
              type="checkbox"
              checked={formState.enableNotifications}
              onChange={(e) => handlePreferenceChange('enableNotifications', e.target.checked)}
              className="form-checkbox"
            />
          </div>
          <div className="flex items-center">
            <label htmlFor="email-toggle" className="mr-4">Email Alerts</label>
            <input
              id="email-toggle"
              type="checkbox"
              checked={formState.enableEmailAlerts}
              onChange={(e) => handlePreferenceChange('enableEmailAlerts', e.target.checked)}
              className="form-checkbox"
            />
          </div>
        </div>
      </section>

      {/* Display Settings */}
      <section className="mb-8" aria-labelledby="display-heading">
        <h2 id="display-heading" className="text-xl mb-4">Display Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <label htmlFor="font-size" className="mr-4">Font Size</label>
            <input
              id="font-size"
              type="range"
              min="12"
              max="24"
              value={formState.displaySettings.fontSize}
              onChange={(e) => handleDisplaySettingChange('fontSize', parseInt(e.target.value))}
              className="form-range"
              aria-describedby="font-size-value"
            />
            <span id="font-size-value" className="ml-2">
              {formState.displaySettings.fontSize}px
            </span>
          </div>
          <div className="flex items-center">
            <label htmlFor="high-contrast" className="mr-4">High Contrast</label>
            <input
              id="high-contrast"
              type="checkbox"
              checked={formState.displaySettings.highContrast}
              onChange={(e) => handleDisplaySettingChange('highContrast', e.target.checked)}
              className="form-checkbox"
            />
          </div>
          <div className="flex items-center">
            <label htmlFor="reduced-motion" className="mr-4">Reduced Motion</label>
            <input
              id="reduced-motion"
              type="checkbox"
              checked={formState.displaySettings.reducedMotion}
              onChange={(e) => handleDisplaySettingChange('reducedMotion', e.target.checked)}
              className="form-checkbox"
            />
          </div>
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div role="alert" className="text-red-600 mb-4">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          loading={isSaving}
          aria-label="Save preferences"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={isSaving}
          aria-label="Reset preferences to defaults"
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

export default Preferences;