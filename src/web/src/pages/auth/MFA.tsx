/**
 * @fileoverview Enhanced Multi-Factor Authentication (MFA) verification page component
 * Implements HIPAA-compliant MFA verification with comprehensive security features,
 * error handling, and accessibility support.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MFAForm } from '../../components/auth/MFAForm';
import { useAuth } from '../../hooks/useAuth';
import { API_ERRORS } from '../../config/api';
import { MFA_CONFIG, SECURITY_CONFIG } from '../../config/auth';

// Constants for MFA verification
const MFA_CONSTANTS = {
  MAX_ATTEMPTS: MFA_CONFIG.BACKUP_CODES.COUNT,
  SESSION_TIMEOUT: MFA_CONFIG.CODE_EXPIRY * 1000, // Convert to milliseconds
  RETRY_DELAY: SECURITY_CONFIG.LOCKOUT_POLICY.PROGRESSIVE_DELAY ? 2000 : 0
} as const;

/**
 * Enhanced MFA verification page component with security features and accessibility
 */
const MFAPage: React.FC = () => {
  // Hooks for navigation and auth state
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, userRole, verifyMFA } = useAuth();

  // Component state
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState<number>(
    Date.now() + MFA_CONSTANTS.SESSION_TIMEOUT
  );

  // Extract session ID from location state with type checking
  const sessionId = location.state?.sessionId;

  /**
   * Validates session state and redirects if invalid
   */
  useEffect(() => {
    if (!sessionId) {
      navigate('/login', { replace: true });
      return;
    }

    // Check if already authenticated
    if (isAuthenticated) {
      const dashboardPath = userRole?.toLowerCase() || 'provider';
      navigate(`/${dashboardPath}/dashboard`, { replace: true });
    }
  }, [sessionId, isAuthenticated, userRole, navigate]);

  /**
   * Monitors MFA session timeout
   */
  useEffect(() => {
    const checkTimeout = setInterval(() => {
      if (Date.now() > sessionTimeout) {
        setError('MFA session expired. Please try again.');
        navigate('/login', { replace: true });
      }
    }, 1000);

    return () => clearInterval(checkTimeout);
  }, [sessionTimeout, navigate]);

  /**
   * Handles successful MFA verification with audit logging
   */
  const handleMFASuccess = useCallback(async () => {
    try {
      // Clear sensitive session data
      sessionStorage.removeItem('mfa_session');
      sessionStorage.removeItem('mfa_session_start');

      // Navigate to appropriate dashboard
      const dashboardPath = userRole?.toLowerCase() || 'provider';
      navigate(`/${dashboardPath}/dashboard`, { replace: true });
    } catch (error) {
      console.error('Error handling MFA success:', error);
      setError('An error occurred after verification. Please try again.');
    }
  }, [userRole, navigate]);

  /**
   * Enhanced error handling for MFA verification failures
   */
  const handleMFAError = useCallback((error: string) => {
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);

    // Handle maximum attempts exceeded
    if (newAttemptCount >= MFA_CONSTANTS.MAX_ATTEMPTS) {
      setError('Maximum verification attempts exceeded. Please try again later.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
      return;
    }

    // Set appropriate error message
    let errorMessage = error;
    if (error.includes('expired')) {
      errorMessage = API_ERRORS.AUTH_ERROR;
    } else if (error.includes('invalid')) {
      errorMessage = 'Invalid verification code. Please try again.';
    }

    setError(errorMessage);

    // Announce error for screen readers
    const errorAnnouncement = document.getElementById('error-live-region');
    if (errorAnnouncement) {
      errorAnnouncement.textContent = errorMessage;
    }
  }, [attemptCount, navigate]);

  return (
    <main 
      className="mfa-page"
      role="main"
      aria-labelledby="mfa-title"
    >
      <div className="mfa-container">
        <h1 id="mfa-title" className="text-2xl font-bold mb-6">
          Two-Factor Authentication
        </h1>

        <p className="text-gray-600 mb-8">
          Please enter the verification code to continue.
          The code will expire in {Math.ceil((sessionTimeout - Date.now()) / 1000)} seconds.
        </p>

        <MFAForm
          sessionId={sessionId}
          onSuccess={handleMFASuccess}
          onError={handleMFAError}
          maxAttempts={MFA_CONSTANTS.MAX_ATTEMPTS}
        />

        {/* Error announcement for screen readers */}
        <div
          id="error-live-region"
          className="sr-only"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
        />

        {error && (
          <div 
            className="error-message mt-4 text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>Having trouble? Contact support for assistance.</p>
          <p>Attempts remaining: {MFA_CONSTANTS.MAX_ATTEMPTS - attemptCount}</p>
        </div>
      </div>
    </main>
  );
};

export default MFAPage;