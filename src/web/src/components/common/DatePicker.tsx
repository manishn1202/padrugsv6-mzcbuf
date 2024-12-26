import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDatePicker from 'react-datepicker'; // @version 4.8.0
import { format, isValid, isAfter, isBefore } from 'date-fns'; // @version 2.30.0
import { ComponentProps } from '../../types/common';

// Import required CSS for react-datepicker
import 'react-datepicker/dist/react-datepicker.css';

/**
 * Props interface for the DatePicker component extending base ComponentProps
 */
export interface DatePickerProps extends ComponentProps {
  /** Selected date value */
  value: Date | null;
  /** Date change handler function */
  onChange: (date: Date | null) => void;
  /** Input field name */
  name: string;
  /** Input label text */
  label?: string;
  /** Error message if validation fails */
  error?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Localization identifier */
  locale?: string;
  /** Required field flag */
  required?: boolean;
  /** Array of disabled dates */
  excludeDates?: Date[];
}

/**
 * Memoized date formatting function
 */
const formatDate = (date: Date | null, locale: string = 'en-US'): string => {
  if (!date || !isValid(date)) return '';
  return format(date, 'MM/dd/yyyy', { locale });
};

/**
 * Date range validation function
 */
const validateDateRange = (date: Date | null, minDate?: Date, maxDate?: Date): boolean => {
  if (!date || !isValid(date)) return false;
  
  if (minDate && isBefore(date, minDate)) return false;
  if (maxDate && isAfter(date, maxDate)) return false;
  
  return true;
};

/**
 * Enterprise-grade DatePicker component with comprehensive accessibility support
 * and validation capabilities.
 */
const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  name,
  label,
  error,
  disabled = false,
  className = '',
  minDate,
  maxDate,
  locale = 'en-US',
  required = false,
  excludeDates = [],
}) => {
  // Component state
  const [focused, setFocused] = useState<boolean>(false);
  const [touched, setTouched] = useState<boolean>(false);
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [lastValidValue, setLastValidValue] = useState<Date | null>(value);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useMemo(() => `${name}-error`, [name]);

  // Computed states
  const hasError = Boolean(error);
  const isValid = value ? validateDateRange(value, minDate, maxDate) : !required;

  // Effect to update last valid value
  useEffect(() => {
    if (value && isValid) {
      setLastValidValue(value);
    }
  }, [value, isValid]);

  // Handlers
  const handleDateChange = useCallback((date: Date | null) => {
    setTouched(true);
    onChange(date);
    setCalendarOpen(false);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setCalendarOpen(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
    setTouched(true);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        setCalendarOpen(false);
        break;
      case 'Enter':
      case ' ':
        setCalendarOpen(!calendarOpen);
        break;
      default:
        break;
    }
  }, [calendarOpen]);

  // Class names
  const containerClasses = [
    'relative',
    'date-picker-container',
    className,
    disabled && 'date-picker-disabled',
    hasError && 'date-picker-error',
    focused && 'date-picker-focused',
    touched && 'date-picker-touched'
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={containerClasses}
      role="group"
      aria-labelledby={`${name}-label`}
    >
      {label && (
        <label
          id={`${name}-label`}
          htmlFor={name}
          className="block text-sm font-medium mb-1"
        >
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}

      <ReactDatePicker
        selected={value}
        onChange={handleDateChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        name={name}
        id={name}
        ref={inputRef}
        disabled={disabled}
        minDate={minDate}
        maxDate={maxDate}
        excludeDates={excludeDates}
        locale={locale}
        dateFormat="MM/dd/yyyy"
        showPopperArrow={false}
        open={calendarOpen}
        className={`
          w-full
          px-3
          py-2
          border
          rounded-md
          shadow-sm
          focus:outline-none
          focus:ring-2
          focus:ring-primary
          ${hasError ? 'border-error' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        `}
        aria-invalid={hasError}
        aria-required={required}
        aria-describedby={error ? errorId : undefined}
        placeholderText="MM/DD/YYYY"
        autoComplete="off"
      />

      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-1 text-sm text-error"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default React.memo(DatePicker);