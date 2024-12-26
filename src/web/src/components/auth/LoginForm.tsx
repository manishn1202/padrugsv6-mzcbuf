/**
 * @fileoverview HIPAA-compliant authentication form component with comprehensive security controls
 * Implements secure JWT-based login with AWS Cognito integration and MFA support
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
// @version react-hook-form@7.45.0
import { useForm } from 'react-hook-form';
// @version yup@1.2.0
import * as yup from 'yup';
// @version dompurify@3.0.5
import DOMPurify from 'dompurify';

import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Variant, Size } from '../../types/common';
import { SECURITY_CONFIG } from '../../config/auth';

// Form validation schema with security requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .max(255)
    .trim(),
  password: yup
    .string()
    .required('Password is required')
    .min(SECURITY_CONFIG.PASSWORD_POLICY.MIN_LENGTH, `Password must be at least ${SECURITY_CONFIG.PASSWORD_POLICY.MIN_LENGTH} characters`)
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[!@#$%^&*]/, 'Password must contain at least one special character')
    .max(128),
  rememberMe: yup.boolean()
});

interface LoginFormProps {
  onSuccess: () => void;
  onMFARequired: () => void;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Secure login form component with comprehensive security controls
 * and HIPAA-compliant authentication implementation
 */
export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onMFARequired }) => {
  // Authentication hook with security features
  const { login, loading, error: authError } = useAuth();

  // Form state management with validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors
  } = useForm<LoginFormData>({
    mode: 'onBlur',
    resolver: yup.object().shape(loginSchema)
  });

  // Local state for rate limiting and security
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Reset lockout after timeout
  useEffect(() => {
    if (isLocked) {
      const lockoutTimer = setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
      }, SECURITY_CONFIG.LOCKOUT_POLICY.LOCKOUT_DURATION * 1000);

      return () => clearTimeout(lockoutTimer);
    }
  }, [isLocked]);

  /**
   * Handles form submission with security measures
   */
  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      // Check rate limiting
      const now = Date.now();
      if (now - lastAttemptTime < 1000) { // Minimum 1 second between attempts
        return;
      }

      // Check lockout status
      if (isLocked) {
        setError('root', {
          message: 'Account is temporarily locked. Please try again later.'
        });
        return;
      }

      // Sanitize input data
      const sanitizedEmail = DOMPurify.sanitize(data.email).trim();
      const sanitizedPassword = data.password; // Don't sanitize password to preserve special characters

      // Attempt login
      const response = await login({
        email: sanitizedEmail,
        password: sanitizedPassword,
        clientId: process.env.REACT_APP_COGNITO_CLIENT_ID!
      });

      // Handle MFA challenge
      if (response.mfaRequired) {
        onMFARequired();
        return;
      }

      // Reset security counters on success
      setLoginAttempts(0);
      setLastAttemptTime(now);
      clearErrors();
      onSuccess();

    } catch (error) {
      // Update security counters
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      setLastAttemptTime(now);

      // Handle lockout
      if (newAttempts >= SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS) {
        setIsLocked(true);
        setError('root', {
          message: 'Account locked due to too many failed attempts'
        });
        return;
      }

      // Handle specific error cases
      if (error instanceof Error) {
        setError('root', {
          message: error.message
        });
      } else {
        setError('root', {
          message: 'An unexpected error occurred'
        });
      }
    }
  }, [login, loginAttempts, lastAttemptTime, isLocked, onSuccess, onMFARequired, setError, clearErrors]);

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-label="Login form"
      noValidate
    >
      {/* Email input */}
      <Input
        id="email"
        type="email"
        label="Email Address"
        error={errors.email?.message}
        disabled={loading || isLocked}
        autoComplete="email"
        required
        {...register('email')}
      />

      {/* Password input */}
      <Input
        id="password"
        type="password"
        label="Password"
        error={errors.password?.message}
        disabled={loading || isLocked}
        autoComplete="current-password"
        required
        {...register('password')}
      />

      {/* Remember me checkbox */}
      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            className="form-checkbox"
            {...register('rememberMe')}
          />
          <span className="ml-2">Remember me</span>
        </label>
      </div>

      {/* Error messages */}
      {(errors.root || authError) && (
        <div 
          className="text-error text-sm"
          role="alert"
          aria-live="polite"
        >
          {errors.root?.message || authError}
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        variant={Variant.PRIMARY}
        size={Size.LG}
        className="w-full"
        disabled={loading || isLocked}
        loading={loading}
        ariaLabel="Sign in"
      >
        Sign In
      </Button>
    </form>
  );
};

export default LoginForm;