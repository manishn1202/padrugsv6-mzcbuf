/**
 * @fileoverview HIPAA-compliant password reset page component that provides a secure interface
 * for users to reset their passwords through AWS Cognito authentication.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PasswordReset from '../../components/auth/PasswordReset';
import useAuth from '../../hooks/useAuth';
import { SECURITY_CONFIG } from '../../config/auth';
import { API_ERRORS } from '../../config/api';

/**
 * Enhanced password reset page component with comprehensive security features
 * and HIPAA compliance measures.
 */
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { resetPassword, loading, error } = useAuth();

  // Track password reset attempts for rate limiting
  const [attempts, setAttempts] = React.useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = React.useState<number | null>(null);

  /**
   * Implements progressive lockout based on failed attempts
   */
  const handleFailedAttempt = useCallback(() => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS) {
      const lockoutDuration = Math.min(
        Math.pow(2, newAttempts - SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS) * 30000,
        SECURITY_CONFIG.LOCKOUT_POLICY.LOCKOUT_DURATION * 1000
      );
      setLockoutUntil(Date.now() + lockoutDuration);
      toast.error(`Account locked. Please try again in ${Math.ceil(lockoutDuration / 1000)} seconds.`);
    }
  }, [attempts]);

  /**
   * Checks if the reset functionality is currently locked
   */
  const isLocked = useCallback(() => {
    if (!lockoutUntil) return false;
    if (Date.now() >= lockoutUntil) {
      setLockoutUntil(null);
      setAttempts(0);
      return false;
    }
    return true;
  }, [lockoutUntil]);

  /**
   * Handles password reset completion with enhanced security
   */
  const handlePasswordReset = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      // Check for lockout
      if (isLocked()) {
        const remainingTime = Math.ceil((lockoutUntil! - Date.now()) / 1000);
        toast.error(`Too many attempts. Please try again in ${remainingTime} seconds.`);
        return;
      }

      // Attempt password reset
      await resetPassword();

      // Reset attempts on success
      setAttempts(0);
      setLockoutUntil(null);

      // Show success message and redirect
      toast.success('Password reset successful. Please log in with your new password.');
      navigate('/login');

    } catch (err) {
      // Handle specific error cases
      if (err instanceof Error) {
        handleFailedAttempt();
        
        switch (err.message) {
          case 'InvalidPasswordException':
            toast.error('Password does not meet security requirements.');
            break;
          case 'LimitExceededException':
            toast.error('Too many reset attempts. Please try again later.');
            break;
          case 'ExpiredCodeException':
            toast.error('Reset code has expired. Please request a new code.');
            break;
          default:
            toast.error(API_ERRORS.SERVER_ERROR);
        }
      }
    }
  }, [resetPassword, navigate, isLocked, lockoutUntil, handleFailedAttempt]);

  // Clear sensitive data on unmount
  useEffect(() => {
    return () => {
      setAttempts(0);
      setLockoutUntil(null);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please enter your new password below
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div 
              className="mb-4 p-4 rounded-md bg-red-50 border border-red-200"
              role="alert"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <PasswordReset
            onSubmit={handlePasswordReset}
            loading={loading}
            disabled={isLocked()}
          />

          <div className="mt-4 text-sm">
            <p className="text-gray-600">
              Password must meet the following requirements:
            </p>
            <ul className="mt-2 list-disc list-inside text-gray-500">
              <li>At least {SECURITY_CONFIG.PASSWORD_POLICY.MIN_LENGTH} characters long</li>
              <li>Include uppercase and lowercase letters</li>
              <li>Include numbers and special characters</li>
              <li>Cannot be a previously used password</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;