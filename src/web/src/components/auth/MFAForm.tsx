/**
 * @fileoverview HIPAA-compliant Multi-Factor Authentication form component
 * Implements secure MFA verification with AWS Cognito integration
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash'; // @version 4.17.21
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Variant, Size } from '../../types/common';

// Constants for MFA validation and security
const MFA_CONSTANTS = {
  CODE_LENGTH: 6,
  MAX_ATTEMPTS: 3,
  DEBOUNCE_DELAY: 1000,
  AUTO_SUBMIT_DELAY: 500
} as const;

export interface MFAFormProps {
  /** AWS Cognito session ID for MFA verification */
  sessionId: string;
  /** Callback function on successful verification */
  onSuccess: () => void;
  /** Callback function on verification error */
  onError: (error: string) => void;
  /** Type of MFA (TOTP/SMS) */
  mfaType: 'TOTP' | 'SMS';
  /** Allow remember device option */
  allowRememberDevice?: boolean;
}

/**
 * HIPAA-compliant MFA verification form component
 * Implements secure code verification with rate limiting and validation
 */
export const MFAForm: React.FC<MFAFormProps> = ({
  sessionId,
  onSuccess,
  onError,
  mfaType,
  allowRememberDevice = false
}) => {
  // State management
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(0);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [rememberDevice, setRememberDevice] = useState<boolean>(false);

  // Custom hook for authentication
  const { verifyMFA, resendMFACode } = useAuth();

  // Reset error when code changes
  useEffect(() => {
    setError(null);
  }, [code]);

  // Auto-submit when valid code length is reached
  useEffect(() => {
    if (code.length === MFA_CONSTANTS.CODE_LENGTH && isValid) {
      const timer = setTimeout(() => {
        handleSubmit();
      }, MFA_CONSTANTS.AUTO_SUBMIT_DELAY);
      return () => clearTimeout(timer);
    }
  }, [code, isValid]);

  /**
   * Validates MFA code format and length
   */
  const validateCode = useCallback((value: string): boolean => {
    return /^\d{6}$/.test(value);
  }, []);

  /**
   * Debounced code validation to prevent excessive validation
   */
  const debouncedValidation = useCallback(
    debounce((value: string) => {
      setIsValid(validateCode(value));
    }, MFA_CONSTANTS.DEBOUNCE_DELAY),
    []
  );

  /**
   * Handles MFA code input changes with validation
   */
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, MFA_CONSTANTS.CODE_LENGTH);
    setCode(value);
    debouncedValidation(value);
  }, [debouncedValidation]);

  /**
   * Securely handles MFA code submission with rate limiting
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate attempts
    if (attempts >= MFA_CONSTANTS.MAX_ATTEMPTS) {
      setError('Too many attempts. Please try again later.');
      onError('Maximum verification attempts exceeded');
      return;
    }

    // Validate code format
    if (!validateCode(code)) {
      setError('Invalid code format');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyMFA(code, sessionId);
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      onError(errorMessage);
      setAttempts(prev => prev + 1);
    } finally {
      setLoading(false);
      // Clear sensitive data
      setCode('');
    }
  }, [code, attempts, sessionId, verifyMFA, onSuccess, onError, validateCode]);

  /**
   * Handles MFA code resend request
   */
  const handleResendCode = useCallback(async () => {
    try {
      await resendMFACode(sessionId);
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
      setError(errorMessage);
      onError(errorMessage);
    }
  }, [sessionId, resendMFACode, onError]);

  return (
    <form 
      onSubmit={handleSubmit}
      className="mfa-form"
      aria-label="MFA verification form"
      noValidate
    >
      <div className="mfa-form-content">
        <Input
          id="mfa-code"
          name="mfa-code"
          type="text"
          value={code}
          onChange={handleCodeChange}
          label="Enter verification code"
          placeholder="Enter 6-digit code"
          maxLength={MFA_CONSTANTS.CODE_LENGTH}
          error={error || undefined}
          disabled={loading}
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="\d*"
          aria-invalid={!!error}
          aria-describedby={error ? 'mfa-error' : undefined}
        />

        {allowRememberDevice && (
          <label className="remember-device">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={loading}
            />
            <span>Remember this device for 30 days</span>
          </label>
        )}

        <div className="mfa-actions">
          <Button
            type="submit"
            variant={Variant.PRIMARY}
            size={Size.MD}
            disabled={!isValid || loading || attempts >= MFA_CONSTANTS.MAX_ATTEMPTS}
            loading={loading}
            aria-label="Verify MFA code"
          >
            Verify Code
          </Button>

          <Button
            type="button"
            variant={Variant.TEXT}
            size={Size.MD}
            onClick={handleResendCode}
            disabled={loading}
            aria-label="Resend verification code"
          >
            Resend Code
          </Button>
        </div>

        {error && (
          <div 
            id="mfa-error" 
            className="mfa-error" 
            role="alert" 
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>
    </form>
  );
};

export default MFAForm;