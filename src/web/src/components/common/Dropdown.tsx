import React, { useState, useRef, useEffect, useCallback } from 'react';
import classNames from 'classnames';
import { ComponentProps } from '../../types/common';
import Icon from './Icon';

/**
 * Interface defining the structure of dropdown options
 */
export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

/**
 * Props interface for the Dropdown component extending base ComponentProps
 */
export interface DropdownProps extends ComponentProps {
  /** Array of selectable options */
  options: DropdownOption[];
  /** Currently selected value(s) */
  value: string | string[] | null;
  /** Selection change handler */
  onChange: (value: string | string[]) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Enable multiple selection mode */
  multiple?: boolean;
  /** Enable search/filter functionality */
  searchable?: boolean;
  /** Size variant of dropdown */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state indicator */
  loading?: boolean;
  /** Error message for validation */
  error?: string;
}

/**
 * A comprehensive dropdown component that provides a customizable select menu with
 * support for single/multiple selection, search functionality, keyboard navigation,
 * and full accessibility compliance.
 */
const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  multiple = false,
  searchable = false,
  size = 'md',
  loading = false,
  disabled = false,
  error,
  className
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // Refs for DOM elements
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Memoized filtered options
  const filteredOptions = React.useMemo(() => {
    if (!searchText) return options;
    const normalizedSearch = searchText.toLowerCase();
    return options.filter(option => 
      option.label.toLowerCase().includes(normalizedSearch)
    );
  }, [options, searchText]);

  /**
   * Handles option selection/deselection
   */
  const handleOptionClick = useCallback((optionValue: string, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (disabled) return;

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  }, [disabled, multiple, onChange, value]);

  /**
   * Handles keyboard navigation and selection
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0) {
          handleOptionClick(
            filteredOptions[focusedIndex].value.toString(),
            event as unknown as React.MouseEvent
          );
        }
        break;

      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;

      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [disabled, filteredOptions, focusedIndex, handleOptionClick]);

  /**
   * Click outside handler to close dropdown
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Focus management for keyboard navigation
   */
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Compute display value
  const displayValue = React.useMemo(() => {
    if (!value) return placeholder;
    
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return placeholder;
      const selectedLabels = value
        .map(v => options.find(opt => opt.value.toString() === v)?.label)
        .filter(Boolean);
      return selectedLabels.join(', ');
    }
    
    const selectedOption = options.find(opt => opt.value.toString() === value);
    return selectedOption ? selectedOption.label : placeholder;
  }, [value, options, placeholder, multiple]);

  // Build class names
  const dropdownClasses = classNames(
    'dropdown',
    `dropdown--${size}`,
    {
      'dropdown--open': isOpen,
      'dropdown--disabled': disabled,
      'dropdown--error': error,
      'dropdown--loading': loading,
    },
    className
  );

  return (
    <div 
      ref={dropdownRef}
      className={dropdownClasses}
      onKeyDown={handleKeyDown}
    >
      <div
        className="dropdown__trigger"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="dropdown-options"
        aria-label={placeholder}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="dropdown__value">{displayValue}</span>
        <Icon 
          name="chevron-down"
          className={classNames('dropdown__arrow', {
            'dropdown__arrow--open': isOpen
          })}
          size="sm"
        />
      </div>

      {isOpen && (
        <div 
          ref={optionsRef}
          className="dropdown__options"
          role="listbox"
          id="dropdown-options"
          aria-multiselectable={multiple}
        >
          {searchable && (
            <div className="dropdown__search">
              <input
                ref={searchInputRef}
                type="text"
                className="dropdown__search-input"
                placeholder="Search..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="dropdown__no-results">No results found</div>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = multiple 
                ? Array.isArray(value) && value.includes(option.value.toString())
                : value === option.value.toString();

              return (
                <div
                  key={option.value}
                  className={classNames('dropdown__option', {
                    'dropdown__option--selected': isSelected,
                    'dropdown__option--focused': index === focusedIndex,
                    'dropdown__option--disabled': option.disabled
                  })}
                  role="option"
                  aria-selected={isSelected}
                  onClick={e => handleOptionClick(option.value.toString(), e)}
                >
                  {option.icon && (
                    <span className="dropdown__option-icon">{option.icon}</span>
                  )}
                  <span className="dropdown__option-label">{option.label}</span>
                  {isSelected && multiple && (
                    <Icon name="check" size="sm" className="dropdown__check" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {error && (
        <div className="dropdown__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default Dropdown;