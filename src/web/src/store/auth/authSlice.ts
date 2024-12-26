/**
 * @fileoverview Redux Toolkit slice for managing authentication state in the Prior Authorization Management System.
 * Implements HIPAA-compliant JWT-based authentication with AWS Cognito integration.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import CryptoJS from 'crypto-js'; // v4.1.1
import { AuthToken, UserProfile, UserRole, LoginCredentials, MFAVerificationData, AuthResponse } from '../../types/auth';

// Constants for security configuration
const TOKEN_ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_LOGIN_ATTEMPTS = 3;
const MFA_CODE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Interface for the authentication state
interface AuthState {
  user: UserProfile | null;
  tokens: AuthToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaSession: string | null;
  lastActivity: number;
  deviceId: string | null;
  sessionExpiresAt: number | null;
  loginAttempts: number;
}

// Initial state with security defaults
const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
  mfaSession: null,
  lastActivity: Date.now(),
  deviceId: null,
  sessionExpiresAt: null,
  loginAttempts: 0
};

/**
 * Encrypts sensitive token data before storage
 */
const encryptToken = (token: string): string => {
  return CryptoJS.AES.encrypt(token, TOKEN_ENCRYPTION_KEY!).toString();
};

/**
 * Decrypts token data for usage
 */
const decryptToken = (encryptedToken: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedToken, TOKEN_ENCRYPTION_KEY!);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Async thunk for handling user login with enhanced security
 */
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: AuthState };
      
      // Check login attempts
      if (state.auth.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        throw new Error('Maximum login attempts exceeded. Please try again later.');
      }

      // Generate secure device identifier
      const deviceId = CryptoJS.SHA256(
        navigator.userAgent + navigator.language + screen.width + screen.height
      ).toString();

      // Attempt login with AWS Cognito
      const response: AuthResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, deviceId })
      }).then(res => {
        if (!res.ok) throw new Error('Login failed');
        return res.json();
      });

      // Encrypt tokens before storing
      const encryptedTokens: AuthToken = {
        ...response.tokens,
        accessToken: encryptToken(response.tokens.accessToken),
        refreshToken: encryptToken(response.tokens.refreshToken),
        idToken: encryptToken(response.tokens.idToken)
      };

      return {
        tokens: encryptedTokens,
        user: response.user,
        mfaRequired: response.mfaRequired,
        sessionId: response.sessionId,
        deviceId
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for MFA verification
 */
export const verifyMFAThunk = createAsyncThunk(
  'auth/verifyMFA',
  async (verificationData: MFAVerificationData, { rejectWithValue }) => {
    try {
      const response: AuthResponse = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData)
      }).then(res => {
        if (!res.ok) throw new Error('MFA verification failed');
        return res.json();
      });

      // Encrypt tokens after successful MFA
      const encryptedTokens: AuthToken = {
        ...response.tokens,
        accessToken: encryptToken(response.tokens.accessToken),
        refreshToken: encryptToken(response.tokens.refreshToken),
        idToken: encryptToken(response.tokens.idToken)
      };

      return {
        tokens: encryptedTokens,
        user: response.user,
        mfaRequired: false
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Create the auth slice with reducers
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      // Secure logout by clearing all sensitive data
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.mfaRequired = false;
      state.mfaSession = null;
      state.sessionExpiresAt = null;
      state.deviceId = null;
      state.loginAttempts = 0;
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
      state.sessionExpiresAt = Date.now() + SESSION_TIMEOUT_MS;
    },
    resetLoginAttempts: (state) => {
      state.loginAttempts = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login thunk reducers
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.loginAttempts += 1;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokens = action.payload.tokens;
        state.user = action.payload.user;
        state.mfaRequired = action.payload.mfaRequired;
        state.mfaSession = action.payload.sessionId;
        state.deviceId = action.payload.deviceId;
        state.isAuthenticated = !action.payload.mfaRequired;
        state.sessionExpiresAt = Date.now() + SESSION_TIMEOUT_MS;
        state.loginAttempts = 0;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // MFA verification thunk reducers
      .addCase(verifyMFAThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyMFAThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokens = action.payload.tokens;
        state.user = action.payload.user;
        state.mfaRequired = false;
        state.mfaSession = null;
        state.isAuthenticated = true;
        state.sessionExpiresAt = Date.now() + SESSION_TIMEOUT_MS;
      })
      .addCase(verifyMFAThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

// Selectors with security validation
export const selectCurrentUser = (state: { auth: AuthState }): UserProfile | null => {
  const { user, sessionExpiresAt, isAuthenticated } = state.auth;
  if (!user || !sessionExpiresAt || !isAuthenticated || Date.now() > sessionExpiresAt) {
    return null;
  }
  return user;
};

export const selectAuthStatus = (state: { auth: AuthState }): boolean => {
  const { isAuthenticated, sessionExpiresAt } = state.auth;
  return isAuthenticated && !!sessionExpiresAt && Date.now() <= sessionExpiresAt;
};

export const { logout, updateLastActivity, resetLoginAttempts } = authSlice.actions;
export default authSlice.reducer;