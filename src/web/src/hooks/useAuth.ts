/**
 * @fileoverview Enhanced authentication hook providing HIPAA-compliant authentication functionality
 * with comprehensive security features including encrypted token management, MFA support,
 * session monitoring, and role-based access control.
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
// @version 4.1.1
import CryptoJS from 'crypto-js';
import { useAuthContext } from '../contexts/AuthContext';
import { AuthResponse, LoginCredentials, UserRole, UserProfile } from '../types/auth';
import { API_ERRORS } from '../config/api';
import { TOKEN_CONFIG, SECURITY_CONFIG, MFA_CONFIG } from '../config/auth';

// Session status tracking
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  EXPIRED = 'EXPIRED',
  LOCKED = 'LOCKED'
}

// Enhanced error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Enhanced authentication hook with comprehensive security features
 * @returns Authentication state and methods with security enhancements
 */
export const useAuth = () => {
  const auth = useAuthContext();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(SessionStatus.ACTIVE);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  /**
   * Encrypts sensitive token data using configured encryption settings
   */
  const encryptToken = useCallback((data: string): string => {
    return CryptoJS.AES.encrypt(
      data,
      TOKEN_CONFIG.TOKEN_ENCRYPTION.KEY,
      {
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7,
        iterations: TOKEN_CONFIG.TOKEN_ENCRYPTION.ITERATIONS
      }
    ).toString();
  }, []);

  /**
   * Validates user credentials against security policy
   */
  const validateCredentials = useCallback((credentials: LoginCredentials): boolean => {
    const { password } = credentials;
    const policy = SECURITY_CONFIG.PASSWORD_POLICY;

    if (password.length < policy.MIN_LENGTH) return false;
    if (policy.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) return false;
    if (policy.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) return false;
    if (policy.REQUIRE_NUMBERS && !/\d/.test(password)) return false;
    if (policy.REQUIRE_SYMBOLS && !/[!@#$%^&*]/.test(password)) return false;

    return true;
  }, []);

  /**
   * Handles progressive lockout based on failed attempts
   */
  const handleLoginAttempt = useCallback((success: boolean) => {
    if (success) {
      setLoginAttempts(0);
      setLockoutUntil(null);
      return true;
    }

    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS) {
      const lockoutTime = Date.now() + (SECURITY_CONFIG.LOCKOUT_POLICY.LOCKOUT_DURATION * 1000);
      setLockoutUntil(lockoutTime);
      setSessionStatus(SessionStatus.LOCKED);
      return false;
    }

    return true;
  }, [loginAttempts]);

  /**
   * Enhanced login handler with security features
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      // Check lockout status
      if (lockoutUntil && Date.now() < lockoutUntil) {
        throw new AuthError(
          'Account temporarily locked',
          'ACCOUNT_LOCKED',
          { unlockTime: lockoutUntil }
        );
      }

      // Validate credentials
      if (!validateCredentials(credentials)) {
        handleLoginAttempt(false);
        throw new AuthError(
          'Invalid credentials format',
          'INVALID_CREDENTIALS'
        );
      }

      const response = await auth.login(credentials.email, credentials.password);

      // Handle successful login
      handleLoginAttempt(true);
      setSessionStatus(SessionStatus.ACTIVE);
      setLastActivity(Date.now());

      // Initialize session monitoring
      startSessionMonitoring();

      return response;
    } catch (error) {
      handleLoginAttempt(false);
      throw error;
    }
  }, [auth, validateCredentials, handleLoginAttempt, lockoutUntil]);

  /**
   * Enhanced MFA verification with timeout handling
   */
  const verifyMFA = useCallback(async (code: string, sessionId: string): Promise<AuthResponse> => {
    try {
      // Validate MFA code format
      if (!code.match(/^\d{6}$/)) {
        throw new AuthError('Invalid MFA code format', 'INVALID_MFA_CODE');
      }

      // Check MFA timeout
      const mfaSession = sessionStorage.getItem('mfa_session_start');
      if (mfaSession && (Date.now() - parseInt(mfaSession)) > MFA_CONFIG.CODE_EXPIRY * 1000) {
        throw new AuthError('MFA code expired', 'MFA_EXPIRED');
      }

      return await auth.verifyMFA(code, sessionId);
    } catch (error) {
      throw new AuthError(
        error instanceof Error ? error.message : 'MFA verification failed',
        'MFA_VERIFICATION_FAILED'
      );
    }
  }, [auth]);

  /**
   * Enhanced permission validation with role checks
   */
  const validatePermission = useCallback((requiredPermission: string): boolean => {
    if (!auth.user?.role) return false;

    const userRole = auth.user.role as UserRole;
    const rolePermissions = SECURITY_CONFIG.ROLE_PERMISSIONS[userRole];

    // Check if MFA is required for role
    if (rolePermissions.requiresMFA && !auth.user.mfaEnabled) {
      return false;
    }

    return rolePermissions[requiredPermission] === true;
  }, [auth.user]);

  /**
   * Monitors session activity and handles timeouts
   */
  const startSessionMonitoring = useCallback(() => {
    const checkSession = () => {
      const idleTime = Date.now() - lastActivity;
      
      if (idleTime >= TOKEN_CONFIG.SESSION_CONFIG.IDLE_TIMEOUT * 1000) {
        setSessionStatus(SessionStatus.EXPIRED);
        auth.logout();
        return;
      }

      if (idleTime >= TOKEN_CONFIG.SESSION_CONFIG.IDLE_TIMEOUT * 500) { // 50% of timeout
        setSessionStatus(SessionStatus.IDLE);
      }
    };

    const updateActivity = () => {
      setLastActivity(Date.now());
      setSessionStatus(SessionStatus.ACTIVE);
    };

    // Set up activity listeners
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('click', updateActivity);

    // Start session check interval
    const sessionInterval = setInterval(checkSession, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('click', updateActivity);
      clearInterval(sessionInterval);
    };
  }, [lastActivity, auth]);

  return {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    loading: auth.loading,
    error: auth.error,
    sessionStatus,
    login,
    logout: auth.logout,
    verifyMFA,
    validatePermission,
    lastActivity,
    loginAttempts,
    lockoutUntil
  };
};

export default useAuth;