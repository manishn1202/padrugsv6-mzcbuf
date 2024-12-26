import React, { FC, memo, useCallback } from 'react';
import classNames from 'classnames';
import { ComponentProps } from '../../types/common';

/**
 * Props interface for the Checkbox component extending base ComponentProps
 */
interface CheckboxProps extends ComponentProps {
  /** Controlled checked state */
  checked: boolean;
  /** Change handler for checkbox state updates */
  onChange: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Accessible label text - required for WCAG compliance */
  label: string;
  /** Input name for form submission */
  name?: string;
  /** Error message for validation failures */
  error?: string;
  /** Optional custom aria-label override */
  ariaLabel?: string;
  /** Data test id for automated testing */
  testId?: string;
}

/**
 * HIPAA-compliant, accessible checkbox component implementing design system specifications.
 * Supports all standard checkbox states, keyboard navigation, and screen reader announcements.
 * 
 * @version 1.0.0
 * @example
 * <Checkbox
 *   checked={isChecked}
 *   onChange={(checked) => setIsChecked(checked)}
 *   label="I agree to the terms"
 *   name="terms"
 * />
 */
export const Checkbox: FC<CheckboxProps> = memo(({
  checked,
  onChange,
  label,
  name,
  error,
  disabled,
  className,
  ariaLabel,
  testId,
}) => {
  // Memoized change handler to prevent unnecessary re-renders
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(event.target.checked, event);
    }
  }, [onChange, disabled]);

  // Generate unique IDs for accessibility
  const inputId = name || Math.random().toString(36).substr(2, 9);
  const errorId = error ? `${inputId}-error` : undefined;

  // Combine class names based on component state
  const containerClasses = classNames(
    'relative inline-flex items-center gap-2 select-none',
    {
      'cursor-pointer': !disabled,
      'cursor-not-allowed opacity-50': disabled,
    },
    className
  );

  const checkboxClasses = classNames(
    'appearance-none w-4 h-4 border-2 rounded transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    {
      'border-primary-600 bg-primary-600': checked && !error,
      'border-error-500 bg-error-50': error,
      'border-gray-300 bg-white': !checked && !error,
      'hover:border-primary-400': !disabled && !error,
    }
  );

  return (
    <div className={containerClasses}>
      <label
        htmlFor={inputId}
        className="flex items-center gap-2"
      >
        <input
          id={inputId}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={checkboxClasses}
          aria-label={ariaLabel || label}
          aria-invalid={!!error}
          aria-describedby={errorId}
          data-testid={testId}
        />
        <span className="text-sm text-gray-700">
          {label}
        </span>
      </label>

      {error && (
        <div
          id={errorId}
          className="absolute left-0 top-full mt-1 text-xs text-error-500"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Custom checkmark icon for checked state */}
      {checked && (
        <svg
          className="absolute left-0 top-0 w-4 h-4 pointer-events-none text-white"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M13.3 4.3L6 11.6L2.7 8.3C2.3 7.9 1.7 7.9 1.3 8.3C0.9 8.7 0.9 9.3 1.3 9.7L5.3 13.7C5.5 13.9 5.7 14 6 14C6.3 14 6.5 13.9 6.7 13.7L14.7 5.7C15.1 5.3 15.1 4.7 14.7 4.3C14.3 3.9 13.7 3.9 13.3 4.3Z"
            fill="currentColor"
          />
        </svg>
      )}
    </div>
  );
});

// Display name for debugging
Checkbox.displayName = 'Checkbox';