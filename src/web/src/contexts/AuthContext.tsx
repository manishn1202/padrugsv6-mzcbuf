/**
 * @fileoverview Authentication Context Provider for Prior Authorization Management System
 * Implements HIPAA-compliant authentication with AWS Cognito integration, secure token
 * management, MFA support, and session monitoring.
 * @version 1.0.0
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
// @version 4.1.1
import CryptoJS from 'crypto-js';
import { AuthToken, UserProfile, UserRole } from '../types/auth';
import { login, verifyMFA, refreshTokens } from '../lib/api/auth';
import { TOKEN_CONFIG, SECURITY_CONFIG, MFA_CONFIG } from '../config/auth';

// Authentication context interface
interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyMFA: (code: string, sessionId: string) => Promise<void>;
  checkPermission: (permission: string) => boolean;
}

// Authentication error types
class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Create authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constants
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_REFRESH_RETRIES = 3;

/**
 * Authentication Provider Component
 * Manages authentication state and provides auth-related functionality
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [refreshAttempts, setRefreshAttempts] = useState<number>(0);

  /**
   * Encrypts sensitive token data using configured encryption settings
   */
  const encryptToken = useCallback((token: AuthToken): string => {
    return CryptoJS.AES.encrypt(
      JSON.stringify(token),
      TOKEN_CONFIG.TOKEN_ENCRYPTION.KEY,
      {
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7,
        iterations: TOKEN_CONFIG.TOKEN_ENCRYPTION.ITERATIONS
      }
    ).toString();
  }, []);

  /**
   * Decrypts token data using configured encryption settings
   */
  const decryptToken = useCallback((encryptedToken: string): AuthToken => {
    const bytes = CryptoJS.AES.decrypt(
      encryptedToken,
      TOKEN_CONFIG.TOKEN_ENCRYPTION.KEY,
      {
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7,
        iterations: TOKEN_CONFIG.TOKEN_ENCRYPTION.ITERATIONS
      }
    );
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }, []);

  /**
   * Handles user authentication with MFA support
   */
  const handleLogin = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await login(email, password);

      if (response.mfaRequired) {
        // Store session data for MFA verification
        sessionStorage.setItem('mfa_session', response.sessionId);
        throw new AuthError('MFA verification required', 'MFA_REQUIRED');
      }

      // Store encrypted tokens
      const encryptedToken = encryptToken(response.tokens);
      localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, encryptedToken);

      setUser(response.user);
      setIsAuthenticated(true);
      setLastActivity(Date.now());

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Authentication failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [encryptToken]);

  /**
   * Handles MFA verification
   */
  const handleMFAVerification = useCallback(async (code: string, sessionId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await verifyMFA({
        code,
        sessionId,
        challengeName: 'SOFTWARE_TOKEN_MFA'
      });

      // Store encrypted tokens after successful MFA
      const encryptedToken = encryptToken(response.tokens);
      localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, encryptedToken);

      setUser(response.user);
      setIsAuthenticated(true);
      setLastActivity(Date.now());

    } catch (err) {
      setError(err instanceof Error ? err : new Error('MFA verification failed'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [encryptToken]);

  /**
   * Handles user logout and cleanup
   */
  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem('mfa_session');
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  /**
   * Checks user permissions based on role
   */
  const checkPermission = useCallback((permission: string): boolean => {
    if (!user || !user.role) return false;

    const rolePermissions = SECURITY_CONFIG.ROLE_PERMISSIONS[user.role as UserRole];
    return rolePermissions ? rolePermissions[permission] === true : false;
  }, [user]);

  /**
   * Refreshes authentication tokens
   */
  const refreshAuthTokens = useCallback(async () => {
    try {
      const encryptedToken = localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
      if (!encryptedToken) throw new Error('No token found');

      const token = decryptToken(encryptedToken);
      const newTokens = await refreshTokens(token.refreshToken);

      // Store new encrypted tokens
      const newEncryptedToken = encryptToken(newTokens);
      localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, newEncryptedToken);

      setRefreshAttempts(0);
    } catch (err) {
      setRefreshAttempts(prev => prev + 1);
      if (refreshAttempts >= MAX_REFRESH_RETRIES) {
        handleLogout();
        throw new Error('Token refresh failed');
      }
    }
  }, [decryptToken, encryptToken, handleLogout, refreshAttempts]);

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const encryptedToken = localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
        if (!encryptedToken) {
          setLoading(false);
          return;
        }

        const token = decryptToken(encryptedToken);
        if (Date.now() >= token.expiresAt) {
          await refreshAuthTokens();
        }

        setIsAuthenticated(true);
        setLastActivity(Date.now());
      } catch (err) {
        handleLogout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [decryptToken, refreshAuthTokens, handleLogout]);

  // Set up token refresh interval
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshInterval = setInterval(refreshAuthTokens, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(refreshInterval);
  }, [isAuthenticated, refreshAuthTokens]);

  // Monitor session activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityCheck = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        handleLogout();
      }
    }, 60000);

    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keypress', updateActivity);

    return () => {
      clearInterval(activityCheck);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keypress', updateActivity);
    };
  }, [isAuthenticated, lastActivity, handleLogout]);

  const contextValue: AuthContextType = {
    isAuthenticated,
    user,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    verifyMFA: handleMFAVerification,
    checkPermission
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access authentication context
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};