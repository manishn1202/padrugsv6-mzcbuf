/**
 * @fileoverview Authentication API client for Prior Authorization Management System.
 * Implements HIPAA-compliant JWT-based authentication with AWS Cognito integration.
 * @version 1.0.0
 */

import { Auth } from '@aws-amplify/auth';
import CryptoJS from 'crypto-js';
import axiosInstance from '../axios';
import { AuthToken } from '../../types/auth';
import { 
  COGNITO_CONFIG, 
  TOKEN_CONFIG, 
  MFA_CONFIG, 
  SECURITY_CONFIG 
} from '../../config/auth';

// Authentication endpoints
const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  VERIFY_MFA: '/auth/verify-mfa',
  REFRESH_TOKEN: '/auth/refresh',
  LOGOUT: '/auth/logout',
  BACKUP_CODES: '/auth/backup-codes',
  DEVICE_AUTH: '/auth/device'
} as const;

// Security constants
const SECURITY_CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 3,
  BACKOFF_BASE: 2,
  TOKEN_ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  MFA_TIMEOUT_SECONDS: 300
} as const;

/**
 * Encrypts sensitive token data using configured encryption settings
 * @param data - Data to encrypt
 * @returns Encrypted data string
 */
const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(
    data,
    TOKEN_CONFIG.TOKEN_ENCRYPTION.KEY,
    {
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7,
      iterations: TOKEN_CONFIG.TOKEN_ENCRYPTION.ITERATIONS
    }
  ).toString();
};

/**
 * Decrypts encrypted token data
 * @param encryptedData - Encrypted data string
 * @returns Decrypted data string
 */
const decryptData = (encryptedData: string): string => {
  const bytes = CryptoJS.AES.decrypt(
    encryptedData,
    TOKEN_CONFIG.TOKEN_ENCRYPTION.KEY,
    {
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7,
      iterations: TOKEN_CONFIG.TOKEN_ENCRYPTION.ITERATIONS
    }
  );
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Generates a device fingerprint for enhanced security
 * @returns Device fingerprint string
 */
const generateDeviceFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset()
  ];
  return CryptoJS.SHA256(components.join('|')).toString();
};

/**
 * Implements exponential backoff for retry attempts
 * @param attempt - Current attempt number
 * @returns Delay in milliseconds
 */
const getBackoffDelay = (attempt: number): number => {
  return Math.min(
    Math.pow(SECURITY_CONSTANTS.BACKOFF_BASE, attempt) * 1000,
    30000
  );
};

/**
 * Authenticates user credentials with enhanced security features
 * @param credentials - Login credentials
 * @param deviceInfo - Optional device information
 * @returns Authentication response with tokens
 */
export const login = async (
  credentials: LoginCredentials,
  deviceInfo?: DeviceInfo
): Promise<AuthResponse> => {
  let attempt = 0;
  
  while (attempt < SECURITY_CONSTANTS.MAX_RETRY_ATTEMPTS) {
    try {
      // Generate device fingerprint
      const deviceFingerprint = generateDeviceFingerprint();
      
      // Configure Cognito client
      Auth.configure({
        userPoolId: COGNITO_CONFIG.USER_POOL_ID,
        userPoolWebClientId: COGNITO_CONFIG.CLIENT_ID,
        region: COGNITO_CONFIG.REGION,
        authenticationFlowType: 'USER_SRP_AUTH'
      });

      // Authenticate with Cognito
      const cognitoUser = await Auth.signIn(credentials.email, credentials.password);
      
      // Handle MFA challenge if required
      if (cognitoUser.challengeName) {
        return {
          mfaRequired: true,
          sessionId: cognitoUser.Session,
          challengeName: cognitoUser.challengeName,
          user: cognitoUser.attributes
        };
      }

      // Get tokens from successful authentication
      const tokens: AuthToken = {
        accessToken: encryptData(cognitoUser.signInUserSession.accessToken.jwtToken),
        refreshToken: encryptData(cognitoUser.signInUserSession.refreshToken.token),
        idToken: encryptData(cognitoUser.signInUserSession.idToken.jwtToken),
        expiresIn: cognitoUser.signInUserSession.accessToken.payload.exp,
        tokenType: 'Bearer'
      };

      // Store encrypted tokens
      localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, tokens.refreshToken);
      localStorage.setItem(TOKEN_CONFIG.ID_TOKEN_KEY, tokens.idToken);

      // Register device for adaptive authentication
      await axiosInstance.post(AUTH_ENDPOINTS.DEVICE_AUTH, {
        deviceFingerprint,
        deviceInfo
      });

      return {
        tokens,
        user: cognitoUser.attributes,
        mfaRequired: false,
        sessionId: cognitoUser.Session,
        challengeName: ''
      };

    } catch (error) {
      attempt++;
      if (attempt === SECURITY_CONSTANTS.MAX_RETRY_ATTEMPTS) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, getBackoffDelay(attempt)));
    }
  }

  throw new Error('Authentication failed after maximum retry attempts');
};

/**
 * Verifies MFA code with support for multiple authentication methods
 * @param verificationData - MFA verification data
 * @param options - Optional verification options
 * @returns Authentication response after MFA verification
 */
export const verifyMFA = async (
  verificationData: MFAVerificationData,
  options?: MFAOptions
): Promise<AuthResponse> => {
  try {
    // Validate MFA code format
    if (!/^\d{6}$/.test(verificationData.code)) {
      throw new Error('Invalid MFA code format');
    }

    // Configure Cognito client
    Auth.configure({
      userPoolId: COGNITO_CONFIG.USER_POOL_ID,
      userPoolWebClientId: COGNITO_CONFIG.CLIENT_ID,
      region: COGNITO_CONFIG.REGION
    });

    // Verify MFA challenge
    const cognitoUser = await Auth.confirmSignIn(
      verificationData.email,
      verificationData.code,
      verificationData.challengeName
    );

    // Get tokens after successful MFA
    const tokens: AuthToken = {
      accessToken: encryptData(cognitoUser.signInUserSession.accessToken.jwtToken),
      refreshToken: encryptData(cognitoUser.signInUserSession.refreshToken.token),
      idToken: encryptData(cognitoUser.signInUserSession.idToken.jwtToken),
      expiresIn: cognitoUser.signInUserSession.accessToken.payload.exp,
      tokenType: 'Bearer'
    };

    // Store encrypted tokens
    localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(TOKEN_CONFIG.ID_TOKEN_KEY, tokens.idToken);

    return {
      tokens,
      user: cognitoUser.attributes,
      mfaRequired: false,
      sessionId: cognitoUser.Session,
      challengeName: ''
    };

  } catch (error) {
    // Handle specific MFA errors
    if (error.code === 'CodeMismatchException') {
      throw new Error('Invalid MFA code');
    }
    throw error;
  }
};

/**
 * Refreshes authentication tokens with enhanced security validation
 * @param refreshToken - Current refresh token
 * @param options - Optional refresh options
 * @returns New authentication tokens
 */
export const refreshToken = async (
  refreshToken: string,
  options?: RefreshOptions
): Promise<AuthToken> => {
  try {
    // Decrypt stored refresh token
    const decryptedRefreshToken = decryptData(refreshToken);

    // Configure Cognito client
    Auth.configure({
      userPoolId: COGNITO_CONFIG.USER_POOL_ID,
      userPoolWebClientId: COGNITO_CONFIG.CLIENT_ID,
      region: COGNITO_CONFIG.REGION
    });

    // Refresh tokens
    const cognitoUser = await Auth.currentSession();
    const newTokens = await Auth.refreshSession(cognitoUser);

    // Encrypt new tokens
    const tokens: AuthToken = {
      accessToken: encryptData(newTokens.accessToken.jwtToken),
      refreshToken: encryptData(newTokens.refreshToken.token),
      idToken: encryptData(newTokens.idToken.jwtToken),
      expiresIn: newTokens.accessToken.payload.exp,
      tokenType: 'Bearer'
    };

    // Update stored tokens
    localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(TOKEN_CONFIG.ID_TOKEN_KEY, tokens.idToken);

    return tokens;

  } catch (error) {
    // Handle token refresh errors
    localStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
    localStorage.removeItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_CONFIG.ID_TOKEN_KEY);
    throw error;
  }
};