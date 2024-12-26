/**
 * @fileoverview TypeScript type definitions for authentication-related interfaces, types and enums
 * used throughout the Prior Authorization Management System frontend.
 * @version 1.0.0
 */

/**
 * Enum defining available user roles for Role-Based Access Control (RBAC).
 * Maps to AWS Cognito user pool groups.
 */
export enum UserRole {
  PROVIDER = 'PROVIDER',
  PAYER_REVIEWER = 'PAYER_REVIEWER', 
  MEDICAL_DIRECTOR = 'MEDICAL_DIRECTOR',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN'
}

/**
 * Interface representing the JWT token data structure returned by AWS Cognito
 * after successful authentication.
 */
export interface AuthToken {
  /** JWT access token for API authorization */
  accessToken: string;
  /** JWT refresh token for obtaining new access tokens */
  refreshToken: string;
  /** JWT ID token containing user claims */
  idToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (typically "Bearer") */
  tokenType: string;
}

/**
 * Interface representing a user's profile data including role and organization details.
 * Maps to AWS Cognito user attributes and custom attributes.
 */
export interface UserProfile {
  /** Unique user identifier */
  id: string;
  /** User's email address (used as username) */
  email: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's assigned role for RBAC */
  role: UserRole;
  /** User's organization/institution name */
  organization: string;
  /** Whether MFA is enabled for the user */
  mfaEnabled: boolean;
  /** Timestamp of user's last successful login */
  lastLoginAt: string;
}

/**
 * Interface representing the complete authentication response including
 * tokens, user profile, and MFA status.
 */
export interface AuthResponse {
  /** JWT tokens for the authenticated session */
  tokens: AuthToken;
  /** Authenticated user's profile data */
  user: UserProfile;
  /** Whether MFA verification is required */
  mfaRequired: boolean;
  /** Unique session identifier for MFA flow */
  sessionId: string;
  /** AWS Cognito challenge name (e.g. "SOFTWARE_TOKEN_MFA") */
  challengeName: string;
}

/**
 * Interface representing the login request payload including
 * Cognito client credentials.
 */
export interface LoginCredentials {
  /** User's email address */
  email: string;
  /** User's password */
  password: string;
  /** AWS Cognito client ID */
  clientId: string;
}

/**
 * Interface representing the MFA verification request payload
 * including session tracking data.
 */
export interface MFAVerificationData {
  /** User's email address */
  email: string;
  /** MFA verification code */
  code: string;
  /** Session ID from initial authentication */
  sessionId: string;
  /** AWS Cognito challenge name */
  challengeName: string;
}