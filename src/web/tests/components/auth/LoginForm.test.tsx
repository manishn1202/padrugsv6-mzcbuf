/**
 * @fileoverview Comprehensive test suite for the LoginForm component
 * Validates HIPAA-compliant authentication flow, security controls,
 * form validation, error handling, accessibility, and MFA integration
 * @version 1.0.0
 */

import React from 'react';
// @version @testing-library/react@14.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
// @version @testing-library/user-event@14.0.0
import userEvent from '@testing-library/user-event';
// @version vitest@0.34.0
import { vi, describe, beforeEach, it, expect } from 'vitest';
// @version @axe-core/react@4.7.3
import { axe, toHaveNoViolations } from '@axe-core/react';

import { LoginForm } from '../../../../src/components/auth/LoginForm';
import { useAuth } from '../../../../src/hooks/useAuth';
import { SECURITY_CONFIG } from '../../../../src/config/auth';

// Mock useAuth hook
vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Test data
const mockCredentials = {
  email: 'test@example.com',
  password: 'SecurePass123!@',
  mfa_code: '123456'
};

// Mock functions
const mockOnSuccess = vi.fn();
const mockOnMFARequired = vi.fn();

describe('LoginForm', () => {
  // Set up mock implementations before each test
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useAuth hook implementation
    (useAuth as jest.Mock).mockReturnValue({
      login: vi.fn(),
      loading: false,
      error: null,
      verifyMFA: vi.fn()
    });
  });

  describe('Form Rendering and Accessibility', () => {
    it('should render all form elements correctly', () => {
      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Verify form elements
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should meet accessibility requirements', async () => {
      const { container } = render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Run accessibility tests
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify ARIA attributes
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Login form');
      
      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('aria-required', 'true');
      
      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Test invalid email
      const emailInput = screen.getByLabelText(/email address/i);
      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();

      // Test valid email
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, mockCredentials.email);
      fireEvent.blur(emailInput);

      expect(screen.queryByText(/invalid email format/i)).not.toBeInTheDocument();
    });

    it('should validate password against security policy', async () => {
      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      const passwordInput = screen.getByLabelText(/password/i);

      // Test password without uppercase
      await userEvent.type(passwordInput, 'weakpassword123!');
      fireEvent.blur(passwordInput);
      expect(await screen.findByText(/must contain at least one uppercase letter/i)).toBeInTheDocument();

      // Test password without special character
      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, 'WeakPassword123');
      fireEvent.blur(passwordInput);
      expect(await screen.findByText(/must contain at least one special character/i)).toBeInTheDocument();

      // Test valid password
      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, mockCredentials.password);
      fireEvent.blur(passwordInput);
      expect(screen.queryByText(/password must contain/i)).not.toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      const mockLogin = vi.fn().mockResolvedValue({ mfaRequired: false });
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        loading: false,
        error: null
      });

      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Fill and submit form
      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: mockCredentials.email,
          password: mockCredentials.password,
          clientId: expect.any(String)
        });
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle MFA requirement', async () => {
      const mockLogin = vi.fn().mockResolvedValue({ mfaRequired: true });
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        loading: false,
        error: null
      });

      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Submit form
      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnMFARequired).toHaveBeenCalled();
        expect(mockOnSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Security Controls', () => {
    it('should implement rate limiting', async () => {
      const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        loading: false,
        error: null
      });

      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Attempt multiple failed logins
      for (let i = 0; i < SECURITY_CONFIG.LOCKOUT_POLICY.MAX_ATTEMPTS + 1; i++) {
        await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
        await userEvent.type(screen.getByLabelText(/password/i), 'WrongPass123!');
        await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
        
        // Clear inputs for next attempt
        await userEvent.clear(screen.getByLabelText(/email address/i));
        await userEvent.clear(screen.getByLabelText(/password/i));
      }

      // Verify account lockout
      expect(await screen.findByText(/account locked due to too many failed attempts/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });

    it('should sanitize input data', async () => {
      const mockLogin = vi.fn().mockResolvedValue({ mfaRequired: false });
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        loading: false,
        error: null
      });

      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      // Test XSS attempt
      const maliciousEmail = '"><script>alert("xss")</script>';
      await userEvent.type(screen.getByLabelText(/email address/i), maliciousEmail);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({
          email: expect.not.stringContaining('<script>')
        }));
      });
    });
  });

  describe('Error Handling', () => {
    it('should display authentication errors', async () => {
      const mockError = new Error('Invalid credentials');
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn().mockRejectedValue(mockError),
        loading: false,
        error: mockError
      });

      render(
        <LoginForm 
          onSuccess={mockOnSuccess} 
          onMFARequired={mockOnMFARequired} 
        />
      );

      await userEvent.type(screen.getByLabelText(/email address/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });
});