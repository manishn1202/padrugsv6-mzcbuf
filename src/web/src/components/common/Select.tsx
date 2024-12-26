import React, { useEffect, useRef, useState, useCallback } from 'react';
import classNames from 'classnames';
import { ComponentProps, Size } from '../../types/common';

// @version classnames@2.3.2
// @version react@18.2.0

/**
 * Interface for select options with comprehensive type safety
 */
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

/**
 * Props interface for Select component extending base ComponentProps
 */
interface SelectProps extends ComponentProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onBlur?: (event: React.FocusEvent) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: Size;
  error?: string;
  multiple?: boolean;
  name?: string;
  id?: string;
  renderOption?: (option: SelectOption) => React.ReactNode;
}

/**
 * A reusable select dropdown component that supports single and multi-select modes
 * with comprehensive accessibility features and keyboard navigation.
 */
export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      value,
      onChange,
      onBlur,
      options,
      placeholder = 'Select an option',
      size = Size.MD,
      error,
      multiple = false,
      disabled = false,
      className,
      name,
      id,
      renderOption,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchTimeout = useRef<NodeJS.Timeout>();

    // Handle click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
          setFocusedIndex(-1);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get selected option label(s)
    const getSelectedLabel = useCallback(() => {
      if (multiple && Array.isArray(value)) {
        return value
          .map(
            (v) => options.find((option) => option.value === v)?.label || ''
          )
          .join(', ');
      }
      return (
        options.find((option) => option.value === value)?.label || placeholder
      );
    }, [value, options, multiple, placeholder]);

    // Handle option selection
    const handleSelect = (option: SelectOption) => {
      if (option.disabled) return;

      if (multiple && Array.isArray(value)) {
        const newValue = value.includes(option.value)
          ? value.filter((v) => v !== option.value)
          : [...value, option.value];
        onChange(newValue);
      } else {
        onChange(option.value);
        setIsOpen(false);
      }
    };

    // Handle keyboard navigation
    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            handleSelect(options[focusedIndex]);
          } else {
            setIsOpen(true);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setFocusedIndex(-1);
          break;
        default:
          // Handle search by typing
          if (/^[a-zA-Z0-9]$/.test(event.key)) {
            clearTimeout(searchTimeout.current);
            setSearchTerm((prev) => prev + event.key);
            searchTimeout.current = setTimeout(() => setSearchTerm(''), 500);
          }
      }
    };

    // Filter options based on search term
    const filteredOptions = options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div
        ref={mergeRefs(ref, containerRef)}
        className={classNames(
          'relative inline-block w-full',
          {
            'opacity-50 cursor-not-allowed': disabled,
          },
          className
        )}
      >
        <div
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-labelledby={`${id}-label`}
          aria-disabled={disabled}
          className={classNames(
            'flex items-center justify-between w-full px-4 bg-white border rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500',
            {
              'border-error-500': error,
              'border-gray-300': !error,
              'h-8 text-sm': size === Size.SM,
              'h-10 text-base': size === Size.MD,
              'h-12 text-lg': size === Size.LG,
            }
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
        >
          <span
            className={classNames('truncate', {
              'text-gray-400': !value || (Array.isArray(value) && !value.length),
            })}
          >
            {getSelectedLabel()}
          </span>
          <svg
            className={classNames('w-5 h-5 ml-2 transition-transform', {
              'rotate-180': isOpen,
            })}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {isOpen && (
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-multiselectable={multiple}
            className="absolute z-10 w-full py-1 mt-1 overflow-auto bg-white border rounded shadow-lg max-h-60"
          >
            {filteredOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={
                  multiple
                    ? Array.isArray(value) && value.includes(option.value)
                    : value === option.value
                }
                aria-disabled={option.disabled}
                className={classNames(
                  'px-4 py-2 cursor-pointer focus:outline-none',
                  {
                    'bg-primary-50': focusedIndex === index,
                    'bg-primary-100':
                      multiple
                        ? Array.isArray(value) && value.includes(option.value)
                        : value === option.value,
                    'opacity-50 cursor-not-allowed': option.disabled,
                    'hover:bg-primary-50': !option.disabled,
                  }
                )}
                onClick={() => handleSelect(option)}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <>
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="ml-2 text-sm text-gray-500">
                        {option.description}
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-1 text-sm text-error-500" role="alert">
            {error}
          </p>
        )}

        {/* Hidden native select for form submission */}
        <select
          name={name}
          value={value}
          onChange={() => {}}
          multiple={multiple}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

// Utility function to merge refs
const mergeRefs = <T extends any>(...refs: React.Ref<T>[]) => {
  return (instance: T) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(instance);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T>).current = instance;
      }
    });
  };
};

Select.displayName = 'Select';