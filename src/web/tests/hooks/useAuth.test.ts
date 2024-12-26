/**
 * @fileoverview Comprehensive test suite for useAuth hook validating HIPAA-compliant
 * authentication flows, secure token management, and MFA verification.
 * @version 1.0.0
 */

// @version 14.0.0
import { renderHook, act } from '@testing-library/react-hooks';
// @version 14.0.0
import { render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { useAuth, SessionStatus } from '../../src/hooks/useAuth';
import { UserRole } from '../../src/types/auth';
// @version 4.1.1
import CryptoJS from 'crypto-js';
import { TOKEN_CONFIG, SECURITY_CONFIG, MFA_CONFIG } from '../../src/config/auth';
import { API_ERRORS } from '../../src/config/api';

// Mock CryptoJS for token encryption testing
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn().mockReturnValue('encrypted_token'),
    decrypt: jest.fn().mockReturnValue({ toString: () => 'decrypted_token' })
  },
  mode: { GCM: 'GCM' },
  pad: { Pkcs7: 'Pkcs7' }
}));

// Test data constants
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.PROVIDER,
  organization: 'Test Hospital',
  mfaEnabled: true,
  lastLoginAt: new Date().toISOString()
};

const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'SecureP@ssw0rd123!',
  mfaCode: '123456'
};

/**
 * Helper function to render useAuth hook with AuthProvider wrapper
 */
const renderAuthHook = (mockOptions = {}) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
};

describe('useAuth Hook Security Tests', () => {
  beforeEach(() => {
    // Clear storage and reset mocks before each test
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with secure default values', () => {
      const { result } = renderAuthHook();

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.sessionStatus).toBe(SessionStatus.ACTIVE);
      expect(result.current.loginAttempts).toBe(0);
      expect(result.current.lockoutUntil).toBeNull();
    });

    it('should not have any tokens in storage initially', () => {
      renderAuthHook();
      
      expect(localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(TOKEN_CONFIG.ID_TOKEN_KEY)).toBeNull();
    });
  });

  describe('Login Flow Security', () => {
    it('should validate credentials against security policy', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        try {
          await result.current.login({
            email: TEST_CREDENTIALS.email,
            password: 'weak'
          });
          fail('Should have thrown validation error');
        } catch (error) {
          expect(error.code).toBe('INVALID_CREDENTIALS');
          expect(result.current.loginAttempts).toBe(1);
        }
      });
    });

    it('should enforce progressive lockout after failed attempts', async () => {
      const { result } = renderAuthHook();

      for (let i = 0; i < SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS; i++) {
        await act(async () => {
          try {
            await result.current.login({
              email: TEST_CREDENTIALS.email,
              password: 'wrong_password'
            });
          } catch (error) {
            expect(error.code).toBe('INVALID_CREDENTIALS');
          }
        });
      }

      expect(result.current.loginAttempts).toBe(SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS);
      expect(result.current.lockoutUntil).not.toBeNull();
      expect(result.current.sessionStatus).toBe(SessionStatus.LOCKED);
    });

    it('should securely store encrypted tokens after successful login', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      });

      expect(CryptoJS.AES.encrypt).toHaveBeenCalled();
      expect(localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY)).toBe('encrypted_token');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(TEST_USER);
    });
  });

  describe('MFA Verification', () => {
    it('should validate MFA code format', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        try {
          await result.current.verifyMFA('12345', 'session_id'); // Invalid 5-digit code
          fail('Should have thrown validation error');
        } catch (error) {
          expect(error.code).toBe('INVALID_MFA_CODE');
        }
      });
    });

    it('should enforce MFA code expiration', async () => {
      const { result } = renderAuthHook();
      
      // Set expired MFA session
      sessionStorage.setItem('mfa_session_start', 
        String(Date.now() - (MFA_CONFIG.CODE_EXPIRY * 2000)));

      await act(async () => {
        try {
          await result.current.verifyMFA('123456', 'session_id');
          fail('Should have thrown expiration error');
        } catch (error) {
          expect(error.code).toBe('MFA_EXPIRED');
        }
      });
    });

    it('should complete authentication after successful MFA', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
        await result.current.verifyMFA('123456', 'session_id');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.mfaEnabled).toBe(true);
      expect(sessionStorage.getItem('mfa_session')).toBeNull();
    });
  });

  describe('Session Security', () => {
    it('should track session activity and timeout', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      });

      // Fast forward past idle timeout
      act(() => {
        jest.advanceTimersByTime(TOKEN_CONFIG.SESSION_CONFIG.IDLE_TIMEOUT * 1000);
      });

      expect(result.current.sessionStatus).toBe(SessionStatus.EXPIRED);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should enforce role-based access control', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      });

      expect(result.current.validatePermission('canSubmitPA')).toBe(true);
      expect(result.current.validatePermission('canApprovePA')).toBe(false);
    });

    it('should require MFA for sensitive operations', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login({
          ...TEST_CREDENTIALS,
          mfaEnabled: false
        });
      });

      expect(result.current.validatePermission('canSubmitPA')).toBe(false);
    });
  });
});