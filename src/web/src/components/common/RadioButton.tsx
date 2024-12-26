import React, { useId } from 'react';
import classNames from 'classnames';
import { ComponentProps } from '../types/common';

/**
 * Props interface for the RadioButton component
 * @version 1.0.0
 */
interface RadioButtonProps extends ComponentProps {
  /** Unique name for the radio button */
  name: string;
  /** Current value of the radio button */
  value: string;
  /** Whether the radio button is checked */
  checked: boolean;
  /** Label text for the radio button */
  label: string;
  /** Optional description text */
  description?: string;
  /** Error message to display */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Name of the radio button group */
  groupName?: string;
  /** Data test ID for testing */
  dataTestId?: string;
  /** Change handler for the radio button */
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * A HIPAA-compliant, accessible radio button component for healthcare forms.
 * Implements WCAG 2.1 AA standards and enhanced error handling.
 *
 * @param props - RadioButton component props
 * @returns JSX.Element - Rendered radio button component
 */
const RadioButton: React.FC<RadioButtonProps> = ({
  name,
  value,
  checked,
  onChange,
  label,
  description,
  disabled = false,
  error,
  className,
  required = false,
  groupName,
  dataTestId,
}) => {
  // Generate unique IDs for accessibility
  const uniqueId = useId();
  const inputId = `radio-${uniqueId}`;
  const descriptionId = description ? `desc-${uniqueId}` : undefined;
  const errorId = error ? `error-${uniqueId}` : undefined;
  const groupAriaLabel = groupName || 'Radio button group';

  // Combine className with default styles
  const wrapperClasses = classNames(
    'relative flex items-center mb-4',
    {
      'opacity-50 cursor-not-allowed': disabled,
    },
    className
  );

  const labelClasses = classNames(
    'ml-3 text-base text-gray-900',
    {
      'text-gray-400': disabled,
    }
  );

  /**
   * Handle keyboard interactions for accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!disabled) {
        const syntheticEvent = {
          target: {
            name,
            value,
            checked: !checked,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }
  };

  return (
    <div className={wrapperClasses} data-testid={dataTestId}>
      <div className="relative flex items-start">
        {/* Hidden radio input for native functionality */}
        <input
          type="radio"
          id={inputId}
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-describedby={classNames(descriptionId, errorId)}
          aria-invalid={!!error}
          aria-required={required}
          aria-label={label}
          role="radio"
          aria-checked={checked}
          onKeyDown={handleKeyDown}
          data-testid={`${dataTestId}-input`}
        />

        {/* Custom radio button styling */}
        <div
          className={classNames(
            'w-5 h-5 border-2 rounded-full transition-colors',
            {
              'border-primary-600 bg-primary-600': checked && !disabled,
              'border-gray-300 bg-gray-100': disabled,
              'border-error-600': error,
              'border-gray-300': !checked && !error && !disabled,
            }
          )}
          aria-hidden="true"
        >
          {/* Inner dot for selected state */}
          {checked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
          )}
        </div>

        {/* Label and description */}
        <div className="ml-3">
          <label
            htmlFor={inputId}
            className={labelClasses}
          >
            {label}
            {required && <span className="text-error-600 ml-1">*</span>}
          </label>
          
          {description && (
            <p
              id={descriptionId}
              className="mt-1 text-sm text-gray-500"
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          id={errorId}
          className="mt-2 text-sm text-error-600 animate-fadeIn"
          role="alert"
        >
          <svg
            className="mr-1 inline-block w-4 h-4 text-error-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
};

export default RadioButton;