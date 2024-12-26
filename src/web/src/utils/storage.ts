/**
 * storage.ts
 * High-level storage utility module providing type-safe browser storage operations
 * with encryption support for the Prior Authorization Management System frontend.
 * Version: 1.0.0
 * 
 * @packageDocumentation
 */

import { 
  StorageType, 
  setItem, 
  getItem, 
  removeItem, 
  clear 
} from '../lib/storage';
import { LOCAL_STORAGE_KEYS } from '../config/constants';

// Storage keys with proper type definitions
const AUTH_TOKEN_KEY = LOCAL_STORAGE_KEYS.AUTH_TOKEN;
const USER_PREFERENCES_KEY = LOCAL_STORAGE_KEYS.USER_PREFERENCES;

/**
 * User preferences interface for type safety
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  defaultPageSize: number;
  timezone: string;
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
}

/**
 * Stores authentication token with mandatory encryption
 * @param token - JWT authentication token
 * @throws Error if storage fails or quota exceeded
 */
export async function storeAuthToken(token: string): Promise<void> {
  if (!token) {
    throw new Error('Invalid authentication token');
  }

  const result = await setItem(
    AUTH_TOKEN_KEY,
    token,
    StorageType.LOCAL,
    true // Mark as PHI/sensitive data
  );

  if (!result.success) {
    throw new Error(`Failed to store auth token: ${result.error}`);
  }
}

/**
 * Retrieves encrypted authentication token
 * @returns Decrypted token or null if not found
 * @throws Error if decryption fails
 */
export async function getAuthToken(): Promise<string | null> {
  const result = await getItem<string>(
    AUTH_TOKEN_KEY,
    StorageType.LOCAL
  );

  if (!result.success && result.error) {
    throw new Error(`Failed to retrieve auth token: ${result.error}`);
  }

  return result.data;
}

/**
 * Securely removes authentication token
 * @throws Error if removal fails
 */
export async function clearAuthToken(): Promise<void> {
  const result = await removeItem(
    AUTH_TOKEN_KEY,
    StorageType.LOCAL
  );

  if (!result.success) {
    throw new Error(`Failed to clear auth token: ${result.error}`);
  }
}

/**
 * Stores user preferences with validation
 * @param preferences - User preferences object
 * @throws Error if storage fails or validation fails
 */
export async function storeUserPreferences(
  preferences: UserPreferences
): Promise<void> {
  // Validate preferences structure
  if (!validatePreferences(preferences)) {
    throw new Error('Invalid user preferences format');
  }

  const result = await setItem(
    USER_PREFERENCES_KEY,
    preferences,
    StorageType.LOCAL,
    false // Non-PHI data
  );

  if (!result.success) {
    throw new Error(`Failed to store user preferences: ${result.error}`);
  }
}

/**
 * Retrieves and validates user preferences
 * @returns Validated preferences object or null
 * @throws Error if retrieval or validation fails
 */
export async function getUserPreferences(): Promise<UserPreferences | null> {
  const result = await getItem<UserPreferences>(
    USER_PREFERENCES_KEY,
    StorageType.LOCAL
  );

  if (!result.success && result.error) {
    throw new Error(`Failed to retrieve user preferences: ${result.error}`);
  }

  if (result.data && !validatePreferences(result.data)) {
    throw new Error('Retrieved preferences failed validation');
  }

  return result.data;
}

/**
 * Validates user preferences object structure
 * @param preferences - Preferences object to validate
 * @returns boolean indicating if preferences are valid
 */
function validatePreferences(preferences: unknown): preferences is UserPreferences {
  if (!preferences || typeof preferences !== 'object') {
    return false;
  }

  const p = preferences as UserPreferences;
  
  return (
    (p.theme === 'light' || p.theme === 'dark') &&
    typeof p.notifications === 'boolean' &&
    typeof p.defaultPageSize === 'number' &&
    typeof p.timezone === 'string' &&
    typeof p.accessibility === 'object' &&
    typeof p.accessibility.highContrast === 'boolean' &&
    ['small', 'medium', 'large'].includes(p.accessibility.fontSize)
  );
}

/**
 * Default export of storage utility functions
 */
export default {
  storeAuthToken,
  getAuthToken,
  clearAuthToken,
  storeUserPreferences,
  getUserPreferences
};