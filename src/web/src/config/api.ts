/**
 * API Configuration Constants
 * Version: 1.0.0
 * 
 * Defines core API configuration settings and endpoints for the Prior Authorization Management System.
 * Implements performance requirements (<3s response time) and security controls through timeouts and rate limits.
 */

// API version and environment-specific base URLs
export const API_VERSION = 'v1';

const ENVIRONMENTS = {
  development: 'http://localhost:8080',
  staging: 'https://api-staging.pamanagement.com',
  production: 'https://api.pamanagement.com'
} as const;

// Core API configuration constants
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || ENVIRONMENTS[process.env.NODE_ENV || 'development'],
  TIMEOUT: 3000, // 3 second timeout per system requirements
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second between retries
  HEALTH_CHECK_INTERVAL: 30000, // 30 second health check interval
  API_VERSION
} as const;

// API endpoint paths organized by domain
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
    MFA: '/auth/mfa'
  },
  PRIOR_AUTH: {
    BASE: '/prior-auth',
    CREATE: '/prior-auth/create',
    UPDATE: '/prior-auth/:id',
    STATUS: '/prior-auth/:id/status',
    HISTORY: '/prior-auth/:id/history',
    SEARCH: '/prior-auth/search'
  },
  CLINICAL: {
    EVIDENCE: '/clinical/evidence',
    MATCHING: '/clinical/matching',
    CRITERIA: '/clinical/criteria',
    VALIDATION: '/clinical/validate'
  },
  DOCUMENTS: {
    UPLOAD: '/documents/upload',
    DOWNLOAD: '/documents/:id/download',
    DELETE: '/documents/:id',
    LIST: '/documents/list'
  },
  FORMULARY: {
    SEARCH: '/formulary/search',
    DETAILS: '/formulary/:id',
    ALTERNATIVES: '/formulary/:id/alternatives',
    POLICIES: '/formulary/:id/policies'
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    STATUS: '/notifications/status',
    PREFERENCES: '/notifications/preferences',
    MARK_READ: '/notifications/:id/read'
  },
  MONITORING: {
    HEALTH: '/health',
    STATUS: '/status',
    METRICS: '/metrics'
  }
} as const;

// Rate limits per minute by endpoint category
export const API_RATE_LIMITS = {
  DEFAULT: 100,
  CLINICAL: 200, // Higher limit for clinical processing
  DOCUMENTS: 50, // Limited for large file transfers
  FORMULARY: 300, // Higher for drug lookups
  AUTH: 20 // Restricted for security
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Error messages
export const API_ERRORS = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait before trying again.',
  AUTH_ERROR: 'Authentication error. Please log in again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  VALIDATION_ERROR: 'Validation error. Please check your input.'
} as const;

// Content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  STREAM: 'application/octet-stream',
  PDF: 'application/pdf'
} as const;

// Request headers
export const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-API-Version': API_VERSION
} as const;

// Export all configurations as a single object for convenience
export const API = {
  CONFIG: API_CONFIG,
  ENDPOINTS: API_ENDPOINTS,
  RATE_LIMITS: API_RATE_LIMITS,
  HTTP_STATUS,
  ERRORS: API_ERRORS,
  CONTENT_TYPES,
  DEFAULT_HEADERS
} as const;