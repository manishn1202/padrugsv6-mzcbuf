/**
 * @fileoverview A secure, HIPAA-compliant password reset component implementing
 * multi-step verification with enhanced security features and comprehensive error handling.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import zxcvbn from 'zxcvbn';
import Input from '../common/Input';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';

// Password strength requirements based on HIPAA compliance
const MIN_PASSWORD_LENGTH = 12;
const MIN_PASSWORD_SCORE = 3;

// Form validation schema with enhanced security rules
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Invalid email format'
    ),
  code: yup
    .string()
    .when('step', {
      is: 2,
      then: yup
        .string()
        .required('Verification code is required')
        .matches(/^\d{6}$/, 'Code must be exactly 6 digits')
    }),
  newPassword: yup
    .string()
    .when('step', {
      is: 3,
      then: yup
        .string()
        .required('New password is required')
        .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
        .matches(/[a-z]/, 'Password must include lowercase letters')
        .matches(/[A-Z]/, 'Password must include uppercase letters')
        .matches(/[0-9]/, 'Password must include numbers')
        .matches(/[!@#$%^&*]/, 'Password must include special characters')
        .test('password-strength', 'Password is too weak', value => 
          value ? zxcvbn(value).score >= MIN_PASSWORD_SCORE : false
        )
    }),
  confirmPassword: yup
    .string()
    .when('step', {
      is: 3,
      then: yup
        .string()
        .required('Please confirm your password')
        .oneOf([yup.ref('newPassword')], 'Passwords must match')
    })
});

interface PasswordResetFormData {
  email: string;
  code?: string;
  newPassword?: string;
  confirmPassword?: string;
}

/**
 * Enhanced password reset component with multi-step verification and security features
 */
const PasswordReset: React.FC = () => {
  // Form state management with validation
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<PasswordResetFormData>({
    mode: 'onChange',
    validationSchema
  });

  // Component state
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);

  // Auth hook for reset functionality
  const { resetPassword, verifyCode, updatePassword, loading } = useAuth();

  // Watch password field for strength estimation
  const watchPassword = watch('newPassword');

  // Update password strength score when password changes
  useEffect(() => {
    if (watchPassword) {
      const result = zxcvbn(watchPassword);
      setPasswordStrength(result.score);
    }
  }, [watchPassword]);

  // Check for rate limiting lockout
  const isLocked = useCallback(() => {
    if (!lockoutUntil) return false;
    if (Date.now() >= lockoutUntil) {
      setLockoutUntil(null);
      setAttempts(0);
      return false;
    }
    return true;
  }, [lockoutUntil]);

  // Handle form submission based on current step
  const onSubmit = useCallback(async (data: PasswordResetFormData) => {
    try {
      if (isLocked()) {
        const remainingTime = Math.ceil((lockoutUntil! - Date.now()) / 1000);
        setError(`Too many attempts. Please try again in ${remainingTime} seconds`);
        return;
      }

      setError(null);

      switch (step) {
        case 1:
          await resetPassword(data.email);
          setStep(2);
          break;

        case 2:
          if (data.code) {
            await verifyCode(data.code);
            setStep(3);
          }
          break;

        case 3:
          if (data.newPassword) {
            await updatePassword(data.newPassword);
            // Success - redirect or show confirmation
          }
          break;
      }

      // Reset attempts on success
      setAttempts(0);

    } catch (err) {
      // Increment attempts and implement lockout if needed
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 5) {
        const lockoutDuration = Math.min(Math.pow(2, newAttempts - 5) * 30000, 3600000);
        setLockoutUntil(Date.now() + lockoutDuration);
      }

      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [step, attempts, lockoutUntil, isLocked, resetPassword, verifyCode, updatePassword]);

  // Clear sensitive data when component unmounts
  useEffect(() => {
    return () => {
      setValue('newPassword', '');
      setValue('confirmPassword', '');
    };
  }, [setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="password-reset-form">
      {error && (
        <div role="alert" className="error-message">
          {error}
        </div>
      )}

      {step === 1 && (
        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          error={errors.email?.message}
          autoComplete="email"
          required
          {...register('email')}
        />
      )}

      {step === 2 && (
        <Input
          id="code"
          name="code"
          type="text"
          label="Verification Code"
          error={errors.code?.message}
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          required
          {...register('code')}
        />
      )}

      {step === 3 && (
        <>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            label="New Password"
            error={errors.newPassword?.message}
            autoComplete="new-password"
            required
            {...register('newPassword')}
          />
          
          {watchPassword && (
            <div className="password-strength" aria-live="polite">
              Password Strength: {['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][passwordStrength]}
            </div>
          )}

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm Password"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            required
            {...register('confirmPassword')}
          />
        </>
      )}

      <Button
        type="submit"
        disabled={loading || isLocked()}
        loading={loading}
      >
        {step === 1 ? 'Send Reset Code' : 
         step === 2 ? 'Verify Code' : 
         'Reset Password'}
      </Button>
    </form>
  );
};

export default PasswordReset;