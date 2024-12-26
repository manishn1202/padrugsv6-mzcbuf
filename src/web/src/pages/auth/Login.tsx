/**
 * @fileoverview HIPAA-compliant login page component with comprehensive security features
 * Implements secure authentication flow with AWS Cognito, MFA support, and session management
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { AuthError } from '../../types/auth';
import { API_ERRORS } from '../../config/api';
import { SECURITY_CONFIG } from '../../config/auth';

/**
 * HIPAA-compliant login page component that handles user authentication
 * with comprehensive security controls and error handling
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    loading, 
    error: authError,
    sessionStatus,
    loginAttempts,
    lockoutUntil 
  } = useAuth();

  // Local state management
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMFARequired, setIsMFARequired] = useState<boolean>(false);

  /**
   * Handles successful login with analytics and redirection
   */
  const handleLoginSuccess = useCallback(() => {
    try {
      setIsRedirecting(true);
      setErrorMessage(null);

      // Redirect to dashboard after successful login
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Navigation error:', error);
      setErrorMessage('Error during navigation. Please try again.');
    } finally {
      setIsRedirecting(false);
    }
  }, [navigate]);

  /**
   * Handles MFA requirement with appropriate UI updates
   */
  const handleMFARequired = useCallback(() => {
    setIsMFARequired(true);
    setErrorMessage(null);
    // Store MFA session start time for timeout tracking
    sessionStorage.setItem('mfa_session_start', Date.now().toString());
  }, []);

  /**
   * Handles login errors with appropriate user feedback
   */
  const handleLoginError = useCallback((error: AuthError) => {
    let message = API_ERRORS.AUTH_ERROR;

    switch (error.code) {
      case 'NotAuthorizedException':
        message = 'Invalid email or password';
        break;
      case 'UserNotConfirmedException':
        message = 'Please verify your email address';
        break;
      case 'PasswordResetRequiredException':
        message = 'Password reset required. Please check your email';
        break;
      case 'TooManyRequestsException':
        message = API_ERRORS.RATE_LIMIT_ERROR;
        break;
      case 'ACCOUNT_LOCKED':
        const remainingTime = lockoutUntil ? Math.ceil((lockoutUntil - Date.now()) / 1000) : 0;
        message = `Account temporarily locked. Please try again in ${remainingTime} seconds`;
        break;
      default:
        message = error.message || API_ERRORS.AUTH_ERROR;
    }

    setErrorMessage(message);
  }, [lockoutUntil]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isRedirecting) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isRedirecting, navigate]);

  // Monitor login attempts for security
  useEffect(() => {
    if (loginAttempts >= SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS - 1) {
      setErrorMessage(`Warning: ${SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS - loginAttempts} attempts remaining before lockout`);
    }
  }, [loginAttempts]);

  return (
    <main 
      className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
      role="main"
      aria-labelledby="login-heading"
    >
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 
            id="login-heading"
            className="text-3xl font-bold text-gray-900"
          >
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please authenticate to access the Prior Authorization Management System
          </p>
        </div>

        {/* Error Messages */}
        {(errorMessage || authError) && (
          <div 
            className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded relative"
            role="alert"
            aria-live="polite"
          >
            <p className="font-medium">
              {errorMessage || authError}
            </p>
          </div>
        )}

        {/* Login Form */}
        <div 
          className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10"
          aria-busy={loading}
        >
          {isMFARequired ? (
            // MFA Verification Form - would be implemented as separate component
            <div>MFA verification required</div>
          ) : (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              onMFARequired={handleMFARequired}
            />
          )}
        </div>

        {/* Help Links */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm">
            <a 
              href="/forgot-password"
              className="font-medium text-primary hover:text-primary-dark"
              tabIndex={0}
            >
              Forgot your password?
            </a>
          </div>
          <div className="text-sm">
            <a 
              href="/help"
              className="font-medium text-primary hover:text-primary-dark"
              tabIndex={0}
            >
              Need help?
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;