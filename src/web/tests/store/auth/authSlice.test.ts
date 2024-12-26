/**
 * @fileoverview Test suite for authentication slice verifying secure authentication flows,
 * MFA verification, token handling, and HIPAA compliance in state management.
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { describe, test, expect, beforeEach, jest } from '@jest/globals'; // v29.0.0
import { reducer, actions, loginThunk, verifyMFAThunk } from '../../../src/store/auth/authSlice';
import { AuthTypes } from '../../../src/types/auth';

// Mock crypto utilities
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn().mockReturnValue('encrypted-token'),
    decrypt: jest.fn().mockReturnValue({ toString: () => 'decrypted-token' })
  },
  SHA256: jest.fn().mockReturnValue('mock-device-hash'),
  enc: { Utf8: 'utf8' }
}));

// Test store configuration
const configureTestStore = () => {
  return configureStore({
    reducer: { auth: reducer }
  });
};

describe('Authentication Slice Security Tests', () => {
  let store: ReturnType<typeof configureTestStore>;

  beforeEach(() => {
    store = configureTestStore();
    // Reset fetch mocks
    global.fetch = jest.fn();
    // Reset timer mocks
    jest.useFakeTimers();
  });

  describe('Initial Security State', () => {
    test('should initialize with secure default state', () => {
      const state = store.getState().auth;
      
      // Verify no sensitive data in initial state
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBeFalsy();
      expect(state.mfaSession).toBeNull();
      expect(state.deviceId).toBeNull();
      
      // Verify security controls initialization
      expect(state.loginAttempts).toBe(0);
      expect(state.sessionExpiresAt).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('Secure Login Flow', () => {
    const mockLoginCredentials: AuthTypes.LoginCredentials = {
      email: 'test@example.com',
      password: 'Test123!',
      clientId: 'test-client'
    };

    const mockLoginResponse = {
      tokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        idToken: 'test-id-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      },
      user: {
        id: 'test-user',
        email: 'test@example.com',
        role: AuthTypes.UserRole.PROVIDER,
        organization: 'Test Org'
      },
      mfaRequired: true,
      sessionId: 'test-session',
      challengeName: 'SOFTWARE_TOKEN_MFA'
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse)
      });
    });

    test('should handle login request securely', async () => {
      const result = await store.dispatch(loginThunk(mockLoginCredentials));
      const state = store.getState().auth;

      // Verify secure API call
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mockLoginCredentials, deviceId: 'mock-device-hash' })
      });

      // Verify token encryption
      expect(state.tokens?.accessToken).toBe('encrypted-token');
      expect(state.tokens?.refreshToken).toBe('encrypted-token');
      expect(state.tokens?.idToken).toBe('encrypted-token');

      // Verify security state
      expect(state.mfaRequired).toBe(true);
      expect(state.mfaSession).toBe('test-session');
      expect(state.loginAttempts).toBe(0);
      expect(state.deviceId).toBe('mock-device-hash');
    });

    test('should enforce login attempt limits', async () => {
      // Simulate failed login attempts
      for (let i = 0; i < 3; i++) {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Login failed'));
        await store.dispatch(loginThunk(mockLoginCredentials));
      }

      const state = store.getState().auth;
      expect(state.loginAttempts).toBe(3);

      // Verify next attempt is blocked
      const result = await store.dispatch(loginThunk(mockLoginCredentials));
      expect(result.payload).toBe('Maximum login attempts exceeded. Please try again later.');
    });
  });

  describe('MFA Security', () => {
    const mockMFAData: AuthTypes.MFAVerificationData = {
      email: 'test@example.com',
      code: '123456',
      sessionId: 'test-session',
      challengeName: 'SOFTWARE_TOKEN_MFA'
    };

    const mockMFAResponse = {
      tokens: {
        accessToken: 'mfa-access-token',
        refreshToken: 'mfa-refresh-token',
        idToken: 'mfa-id-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      },
      user: {
        id: 'test-user',
        email: 'test@example.com',
        role: AuthTypes.UserRole.PROVIDER,
        organization: 'Test Org'
      },
      mfaRequired: false
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMFAResponse)
      });
    });

    test('should handle MFA verification securely', async () => {
      const result = await store.dispatch(verifyMFAThunk(mockMFAData));
      const state = store.getState().auth;

      // Verify secure API call
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockMFAData)
      });

      // Verify token refresh after MFA
      expect(state.tokens?.accessToken).toBe('encrypted-token');
      expect(state.mfaRequired).toBe(false);
      expect(state.mfaSession).toBeNull();
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('Session Security', () => {
    test('should handle session timeout', () => {
      // Set initial authenticated state
      store.dispatch(actions.loginThunk.fulfilled({
        tokens: {
          accessToken: 'encrypted-token',
          refreshToken: 'encrypted-token',
          idToken: 'encrypted-token',
          expiresIn: 3600,
          tokenType: 'Bearer'
        },
        user: {
          id: 'test-user',
          email: 'test@example.com',
          role: AuthTypes.UserRole.PROVIDER,
          organization: 'Test Org'
        },
        mfaRequired: false,
        deviceId: 'test-device'
      }, 'requestId', {} as AuthTypes.LoginCredentials));

      // Advance time past session timeout
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.tokens).toBeNull();
      expect(state.user).toBeNull();
    });

    test('should update session activity', () => {
      store.dispatch(actions.updateLastActivity());
      const state = store.getState().auth;

      expect(state.lastActivity).toBe(Date.now());
      expect(state.sessionExpiresAt).toBe(Date.now() + 30 * 60 * 1000);
    });
  });

  describe('Secure Logout', () => {
    test('should clear all sensitive data on logout', () => {
      // Set authenticated state first
      store.dispatch(actions.loginThunk.fulfilled({
        tokens: {
          accessToken: 'encrypted-token',
          refreshToken: 'encrypted-token',
          idToken: 'encrypted-token',
          expiresIn: 3600,
          tokenType: 'Bearer'
        },
        user: {
          id: 'test-user',
          email: 'test@example.com',
          role: AuthTypes.UserRole.PROVIDER,
          organization: 'Test Org'
        },
        mfaRequired: false,
        deviceId: 'test-device'
      }, 'requestId', {} as AuthTypes.LoginCredentials));

      // Perform logout
      store.dispatch(actions.logout());
      const state = store.getState().auth;

      // Verify all sensitive data is cleared
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBeFalsy();
      expect(state.mfaRequired).toBeFalsy();
      expect(state.mfaSession).toBeNull();
      expect(state.sessionExpiresAt).toBeNull();
      expect(state.deviceId).toBeNull();
      expect(state.loginAttempts).toBe(0);
    });
  });
});