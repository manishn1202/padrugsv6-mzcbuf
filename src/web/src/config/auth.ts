/**
 * @fileoverview Authentication configuration for the Prior Authorization Management System.
 * Implements secure AWS Cognito integration with enhanced security features and HIPAA compliance.
 * @version 1.0.0
 */

import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import * as CryptoJS from 'crypto-js';
import { UserRole } from '../types/auth';

// Validate required environment variables
if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID || 
    !process.env.COGNITO_REGION || !process.env.TOKEN_ENCRYPTION_KEY) {
  throw new Error('Required authentication environment variables are not configured');
}

/**
 * AWS Cognito configuration with enhanced security settings
 */
export const COGNITO_CONFIG = {
  USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  CLIENT_ID: process.env.COGNITO_CLIENT_ID,
  REGION: process.env.COGNITO_REGION,
  ADVANCED_SECURITY: {
    ENABLED: true,
    RISK_BASED_POLICY: 'BLOCK_HIGH_RISK',
    ADAPTIVE_AUTH: true,
    COMPROMISED_CREDENTIALS_CHECK: true,
  },
  SESSION_CONFIG: {
    MAX_SESSION_DURATION: 28800, // 8 hours in seconds
    IDLE_TIMEOUT: 900, // 15 minutes in seconds
    ENFORCE_SINGLE_SESSION: true,
    REMEMBER_DEVICES: false, // HIPAA compliance
  }
} as const;

/**
 * Token management configuration with encryption and rotation policies
 */
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_KEY: 'pa_access_token',
  REFRESH_TOKEN_KEY: 'pa_refresh_token',
  ID_TOKEN_KEY: 'pa_id_token',
  TOKEN_EXPIRY_BUFFER: 300, // 5 minutes buffer for token refresh
  TOKEN_ROTATION: {
    ENABLED: true,
    ROTATION_INTERVAL: 3600, // 1 hour in seconds
    FORCE_ROTATION_ON_RISK: true,
  },
  TOKEN_ENCRYPTION: {
    ENABLED: true,
    KEY: process.env.TOKEN_ENCRYPTION_KEY,
    ALGORITHM: CryptoJS.AES,
    ITERATIONS: 10000,
  }
} as const;

/**
 * Multi-Factor Authentication (MFA) configuration
 */
export const MFA_CONFIG = {
  ENABLED: true, // Mandatory MFA for HIPAA compliance
  CODE_LENGTH: 6,
  CODE_EXPIRY: 300, // 5 minutes in seconds
  BACKUP_CODES: {
    ENABLED: true,
    COUNT: 10,
    LENGTH: 8,
  },
  RECOVERY_OPTIONS: {
    EMAIL: true,
    SMS: true,
    AUTHENTICATOR_APP: true,
    SECURITY_QUESTIONS: false, // Disabled for enhanced security
  }
} as const;

/**
 * Role-based access control with granular permissions
 */
export const ROLE_PERMISSIONS = {
  [UserRole.PROVIDER]: {
    allowedRoutes: ['/dashboard', '/requests', '/patients'],
    maxRequestsPerDay: 100,
    canSubmitPA: true,
    canViewStatus: true,
    canUploadDocuments: true,
    requiresMFA: true,
  },
  [UserRole.PAYER_REVIEWER]: {
    allowedRoutes: ['/dashboard', '/review', '/queue'],
    maxReviewsPerDay: 200,
    canReviewPA: true,
    canRequestInfo: true,
    canApprovePA: true,
    canDenyPA: true,
    requiresMFA: true,
  },
  [UserRole.MEDICAL_DIRECTOR]: {
    allowedRoutes: ['/dashboard', '/review', '/queue', '/reports', '/policies'],
    maxReviewsPerDay: -1, // Unlimited
    canReviewPA: true,
    canOverrideDecisions: true,
    canManagePolicies: true,
    requiresMFA: true,
  },
  [UserRole.SYSTEM_ADMIN]: {
    allowedRoutes: ['*'],
    canManageUsers: true,
    canManageRoles: true,
    canViewAuditLogs: true,
    canConfigureSystem: true,
    requiresMFA: true,
  }
} as const;

/**
 * Security configuration for authentication and session management
 */
export const SECURITY_CONFIG = {
  PASSWORD_POLICY: {
    MIN_LENGTH: 12,
    REQUIRE_LOWERCASE: true,
    REQUIRE_UPPERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true,
    PREVENT_PASSWORD_REUSE: 24, // Last 24 passwords
  },
  LOCKOUT_POLICY: {
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 1800, // 30 minutes in seconds
    PROGRESSIVE_DELAY: true,
  },
  SESSION_SECURITY: {
    VALIDATE_IP: true,
    VALIDATE_USER_AGENT: true,
    VALIDATE_FINGERPRINT: true,
    SECURE_COOKIE_ATTRS: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
    }
  }
} as const;

/**
 * Initialize Cognito Identity client with configured settings
 */
export const cognitoClient = new CognitoIdentityClient({
  region: COGNITO_CONFIG.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

/**
 * Combined authentication configuration export
 */
export const AUTH_CONFIG = {
  COGNITO_CONFIG,
  TOKEN_CONFIG,
  MFA_CONFIG,
  ROLE_PERMISSIONS,
  SECURITY_CONFIG,
} as const;