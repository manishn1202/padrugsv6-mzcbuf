import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// @testing-library/react@13.4.0
import userEvent from '@testing-library/user-event';
// @testing-library/user-event@14.0.0
import { describe, it, expect, jest } from '@jest/globals';
// @jest/globals@29.0.0

import Button from '../../../src/components/common/Button';
import { Size, Variant } from '../../../src/types/common';

// Helper function to create test props with mock handlers
const createTestProps = (overrides = {}) => ({
  onClick: jest.fn(),
  onKeyDown: jest.fn(),
  children: 'Test Button',
  ...overrides,
});

// Helper function to render Button with default or custom props
const renderButton = (props = {}) => {
  const defaultProps = createTestProps();
  return render(<Button {...defaultProps} {...props} />);
};

describe('Button Component', () => {
  // Core Rendering Tests
  describe('rendering', () => {
    it('renders with default props', () => {
      renderButton();
      const button = screen.getByRole('button', { name: /test button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('bg-primary', 'text-white');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
    });

    it('renders with custom className', () => {
      renderButton({ className: 'custom-class' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('renders with aria-label when provided', () => {
      renderButton({ ariaLabel: 'Custom Label' });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });
  });

  // Variant Tests
  describe('variants', () => {
    it('renders PRIMARY variant with correct styles', () => {
      renderButton({ variant: Variant.PRIMARY });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary', 'text-white', 'hover:bg-primary-dark');
    });

    it('renders SECONDARY variant with correct styles', () => {
      renderButton({ variant: Variant.SECONDARY });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary', 'text-white', 'hover:bg-secondary-dark');
    });

    it('renders OUTLINE variant with correct styles', () => {
      renderButton({ variant: Variant.OUTLINE });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border', 'border-primary', 'text-primary');
    });

    it('renders TEXT variant with correct styles', () => {
      renderButton({ variant: Variant.TEXT });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-primary', 'hover:bg-gray-50');
    });
  });

  // Size Tests
  describe('sizes', () => {
    it('renders SM size with correct styles', () => {
      renderButton({ size: Size.SM });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
    });

    it('renders MD size with correct styles', () => {
      renderButton({ size: Size.MD });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-3', 'text-base');
    });

    it('renders LG size with correct styles', () => {
      renderButton({ size: Size.LG });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-8', 'py-4', 'text-lg');
    });
  });

  // State Tests
  describe('states', () => {
    it('shows loading spinner when loading is true', () => {
      renderButton({ loading: true });
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
    });

    it('disables button and shows correct styles when disabled', () => {
      renderButton({ disabled: true });
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('applies focus styles when focused', async () => {
      renderButton();
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-primary');
    });
  });

  // Interaction Tests
  describe('interactions', () => {
    it('calls onClick when clicked', async () => {
      const onClick = jest.fn();
      renderButton({ onClick });
      
      await userEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const onClick = jest.fn();
      renderButton({ onClick, disabled: true });
      
      await userEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const onClick = jest.fn();
      renderButton({ onClick, loading: true });
      
      await userEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // Keyboard Navigation Tests
  describe('keyboard navigation', () => {
    it('triggers onClick on Enter key press', async () => {
      const onClick = jest.fn();
      renderButton({ onClick });
      
      const button = screen.getByRole('button');
      await userEvent.type(button, '{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('triggers onClick on Space key press', async () => {
      const onClick = jest.fn();
      renderButton({ onClick });
      
      const button = screen.getByRole('button');
      await userEvent.type(button, ' ');
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger onClick on other key presses', async () => {
      const onClick = jest.fn();
      renderButton({ onClick });
      
      const button = screen.getByRole('button');
      await userEvent.type(button, 'A');
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // Accessibility Tests
  describe('accessibility', () => {
    it('has correct role and attributes', () => {
      renderButton();
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-disabled', 'false');
    });

    it('is keyboard focusable when not disabled', () => {
      renderButton();
      const button = screen.getByRole('button');
      
      button.focus();
      expect(button).toHaveFocus();
    });

    it('is not keyboard focusable when disabled', () => {
      renderButton({ disabled: true });
      const button = screen.getByRole('button');
      
      button.focus();
      expect(button).not.toHaveFocus();
    });

    it('has proper focus visible styles', () => {
      renderButton();
      const button = screen.getByRole('button');
      
      button.focus();
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-primary', 'focus:ring-offset-2');
    });
  });
});