/**
 * constants.ts
 * Centralized configuration file for the Prior Authorization Management System frontend
 * Version: 1.0.0
 */

/**
 * Enum representing all possible states of a prior authorization request
 */
export enum PriorAuthStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  NEEDS_INFO = 'NEEDS_INFO'
}

/**
 * Enum representing user role types for access control
 */
export enum UserRole {
  PROVIDER = 'PROVIDER',
  PAYER = 'PAYER',
  ADMIN = 'ADMIN'
}

/**
 * Default pagination configuration for optimal performance and memory usage
 */
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20, // Optimal number of items per page for performance
  MAX_PAGES: 50  // Maximum pages to prevent memory issues
} as const;

/**
 * File upload restrictions for HIPAA compliance and security
 */
export const FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png'
  ] as const,
  MAX_FILES_PER_REQUEST: 5
} as const;

/**
 * UI-related timing constants for consistent user experience
 */
export const UI_CONSTANTS = {
  TOAST_DURATION: 3000,    // Toast notification duration in ms
  MODAL_TRANSITION: 200,   // Modal animation duration in ms
  DEBOUNCE_DELAY: 300,    // Input debounce delay in ms
  API_TIMEOUT: 30000      // API request timeout in ms (30s)
} as const;

/**
 * Local storage key constants for consistent data persistence
 */
export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'pa_auth_token',
  USER_PREFERENCES: 'pa_user_prefs',
  THEME: 'pa_theme',
  LAST_ACTIVITY: 'pa_last_activity'
} as const;

/**
 * Standardized error messages for consistent user feedback
 */
export const ERROR_MESSAGES = {
  GENERIC_ERROR: 'An unexpected error occurred. Please try again or contact support.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  UNAUTHORIZED: "Your session has expired or you don't have permission. Please log in again.",
  SESSION_EXPIRED: 'Your session has expired for security purposes. Please log in again.',
  FILE_SIZE_ERROR: 'File exceeds maximum allowed size of 10MB.',
  FILE_TYPE_ERROR: 'File type not supported. Please upload PDF, JPEG, or PNG files only.',
  RATE_LIMIT_ERROR: 'Too many requests. Please try again in a few minutes.'
} as const;

/**
 * API endpoint configuration
 */
export const API_ENDPOINTS = {
  BASE_URL: '/api/v1',
  AUTH: '/auth',
  REQUESTS: '/requests',
  DOCUMENTS: '/documents',
  USERS: '/users'
} as const;

// Type assertions to ensure constants are readonly
Object.freeze(PAGINATION_DEFAULTS);
Object.freeze(FILE_UPLOAD_LIMITS);
Object.freeze(UI_CONSTANTS);
Object.freeze(LOCAL_STORAGE_KEYS);
Object.freeze(ERROR_MESSAGES);
Object.freeze(API_ENDPOINTS);