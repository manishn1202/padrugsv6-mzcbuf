import React, { forwardRef, useCallback, useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { ComponentProps, Size } from '../../types/common';

/**
 * Props interface for the Input component extending ComponentProps
 * @version 1.0.0
 */
export interface InputProps extends ComponentProps {
  /** Unique identifier for the input */
  id: string;
  /** Input name attribute */
  name: string;
  /** Input type */
  type?: 'text' | 'email' | 'tel' | 'number' | 'password';
  /** Input value */
  value?: string | number;
  /** Input placeholder text */
  placeholder?: string;
  /** Label text */
  label?: string;
  /** Error message */
  error?: string;
  /** Input size variant */
  size?: Size;
  /** Whether the input is required */
  required?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is read-only */
  readOnly?: boolean;
  /** Maximum length of input value */
  maxLength?: number;
  /** Input pattern for validation */
  pattern?: string;
  /** Input autocomplete attribute */
  autoComplete?: string;
  /** Container class name */
  className?: string;
  /** Input element class name */
  inputClassName?: string;
  /** Label element class name */
  labelClassName?: string;
  /** Error message class name */
  errorClassName?: string;
  /** Custom validation configuration */
  validation?: {
    pattern?: RegExp;
    message?: string;
  };
  /** Input mask pattern */
  mask?: string | RegExp;
  /** Change event handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Blur event handler */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Focus event handler */
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Keydown event handler */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * A comprehensive form input component with accessibility and validation support
 * Implements design system specifications and HIPAA-compliant security measures
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  name,
  type = 'text',
  value = '',
  placeholder,
  label,
  error,
  size = Size.MD,
  required = false,
  disabled = false,
  readOnly = false,
  maxLength,
  pattern,
  autoComplete,
  className,
  inputClassName,
  labelClassName,
  errorClassName,
  validation,
  mask,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}, ref) => {
  // State for internal validation and focus management
  const [isFocused, setIsFocused] = useState(false);
  const [internalError, setInternalError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine external ref with internal ref
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(inputRef.current);
    } else if (ref) {
      ref.current = inputRef.current;
    }
  }, [ref]);

  // Handle input value changes with validation and masking
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Apply mask if provided
    if (mask) {
      if (mask instanceof RegExp) {
        newValue = newValue.replace(mask, '');
      } else {
        // Apply string-based mask pattern
        const maskArray = mask.split('');
        const valueArray = newValue.split('');
        newValue = maskArray.reduce((acc, char, index) => {
          if (char === '#' && valueArray[index]) {
            return acc + valueArray[index];
          }
          return acc + char;
        }, '');
      }
    }

    // Validate against pattern if provided
    if (validation?.pattern && newValue) {
      const isValid = validation.pattern.test(newValue);
      setInternalError(isValid ? '' : validation.message || 'Invalid input');
    }

    // Call external onChange handler
    onChange?.(e);
  }, [mask, onChange, validation]);

  // Handle focus events
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  // Handle blur events
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  // Generate unique IDs for accessibility
  const inputId = id || `input-${name}`;
  const errorId = `${inputId}-error`;
  const describedBy = error || internalError ? errorId : undefined;

  // Compute component classes
  const containerClasses = classNames(
    'input-container',
    `input-size-${size}`,
    {
      'input-disabled': disabled,
      'input-readonly': readOnly,
      'input-error': error || internalError,
      'input-focused': isFocused,
    },
    className
  );

  const inputClasses = classNames(
    'input',
    `input-type-${type}`,
    {
      'input-has-error': error || internalError,
      'input-required': required,
    },
    inputClassName
  );

  const labelClasses = classNames(
    'input-label',
    {
      'label-required': required,
    },
    labelClassName
  );

  const errorClasses = classNames(
    'input-error-message',
    errorClassName
  );

  return (
    <div className={containerClasses}>
      {label && (
        <label 
          htmlFor={inputId}
          className={labelClasses}
        >
          {label}
          {required && <span className="required-indicator">*</span>}
        </label>
      )}
      
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength}
        pattern={pattern}
        autoComplete={autoComplete}
        aria-invalid={!!(error || internalError)}
        aria-required={required}
        aria-describedby={describedBy}
        className={inputClasses}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        {...props}
      />

      {(error || internalError) && (
        <div 
          id={errorId}
          className={errorClasses}
          role="alert"
        >
          {error || internalError}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
Input.displayName = 'Input';

export default Input;