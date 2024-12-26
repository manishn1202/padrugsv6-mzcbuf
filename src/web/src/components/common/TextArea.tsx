import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // @version 2.3.2
import { ComponentProps } from '../../types/common';

/**
 * Props interface for the TextArea component extending base ComponentProps
 */
interface TextAreaProps extends ComponentProps {
  /** Unique field identifier for form handling */
  name: string;
  /** DOM identifier for accessibility and label association */
  id: string;
  /** Controlled input value */
  value: string;
  /** Placeholder text for empty state */
  placeholder?: string;
  /** Accessible label for the textarea */
  label: string;
  /** Indicates if field is mandatory */
  required?: boolean;
  /** Error state indicator */
  error?: boolean;
  /** Error message for invalid input */
  errorMessage?: string;
  /** Initial number of visible text rows */
  rows?: number;
  /** Maximum character limit for input */
  maxLength?: number;
  /** Change event handler with debounce support */
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Blur event handler for validation */
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
}

/**
 * A comprehensive, accessible textarea component for clinical data input
 * Features auto-resize, validation, and HIPAA compliance support
 */
const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      name,
      id,
      value,
      placeholder,
      label,
      required = false,
      error = false,
      errorMessage,
      rows = 3,
      maxLength,
      disabled = false,
      className,
      onChange,
      onBlur,
    },
    ref
  ) => {
    // Refs and state
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [characterCount, setCharacterCount] = useState(0);

    // Combine external ref with internal ref
    const combinedRef = (node: HTMLTextAreaElement) => {
      textareaRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    // Auto-resize textarea based on content
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [value]);

    // Update character count
    useEffect(() => {
      setCharacterCount(value.length);
    }, [value]);

    // Handle focus events
    const handleFocus = () => setIsFocused(true);
    const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(event);
    };

    // Generate unique IDs for accessibility
    const errorId = `${id}-error`;
    const counterId = `${id}-counter`;

    // Dynamic class names based on component state
    const textareaClasses = classNames(
      'form-textarea',
      'w-full',
      'px-3',
      'py-2',
      'border',
      'rounded-md',
      'transition-all',
      'duration-200',
      'resize-none',
      {
        'border-gray-300 bg-white': !error && !isFocused,
        'border-primary-500 ring-1 ring-primary-500': isFocused && !error,
        'border-error-500 ring-1 ring-error-500': error,
        'bg-gray-100 cursor-not-allowed opacity-75': disabled,
      },
      className
    );

    return (
      <div className="relative">
        {/* Label */}
        <label
          htmlFor={id}
          className={classNames('block text-sm font-medium mb-1', {
            'text-error-500': error,
            'text-gray-700': !error,
          })}
        >
          {label}
          {required && <span className="text-error-500 ml-1">*</span>}
        </label>

        {/* Textarea */}
        <textarea
          ref={combinedRef}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          className={textareaClasses}
          aria-invalid={error}
          aria-required={required}
          aria-describedby={classNames({
            [errorId]: error && errorMessage,
            [counterId]: maxLength,
          })}
          data-testid={`textarea-${id}`}
        />

        {/* Error message */}
        {error && errorMessage && (
          <div
            id={errorId}
            className="text-error-500 text-sm mt-1"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {/* Character counter */}
        {maxLength && (
          <div
            id={counterId}
            className={classNames('text-sm mt-1 text-right', {
              'text-gray-500': characterCount < maxLength,
              'text-error-500': characterCount >= maxLength,
            })}
          >
            {characterCount}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);

// Display name for debugging
TextArea.displayName = 'TextArea';

export default TextArea;