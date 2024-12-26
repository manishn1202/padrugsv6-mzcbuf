import React, { forwardRef } from 'react';
import classNames from 'classnames';
// classnames@2.3.2

import { ComponentProps, Size, Variant } from '../../types/common';

/**
 * Props interface for Button component
 * @extends ComponentProps
 */
export interface ButtonProps extends ComponentProps {
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Visual variant of the button */
  variant?: Variant;
  /** Size variant of the button */
  size?: Size;
  /** Click handler function */
  onClick?: () => void;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * Style configuration for button variants
 */
const variantStyles = {
  [Variant.PRIMARY]: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-darker',
  [Variant.SECONDARY]: 'bg-secondary text-white hover:bg-secondary-dark active:bg-secondary-darker',
  [Variant.OUTLINE]: 'border border-primary text-primary hover:bg-gray-50 active:bg-gray-100',
  [Variant.TEXT]: 'text-primary hover:bg-gray-50 active:bg-gray-100'
};

/**
 * Style configuration for button sizes
 */
const sizeStyles = {
  [Size.SM]: 'px-4 py-2 text-sm',
  [Size.MD]: 'px-6 py-3 text-base',
  [Size.LG]: 'px-8 py-4 text-lg'
};

/**
 * A reusable button component that implements the design system specifications
 * with support for different variants, sizes, states and accessibility features.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      type = 'button',
      variant = Variant.PRIMARY,
      size = Size.MD,
      disabled = false,
      loading = false,
      onClick,
      className,
      children,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    // Handle keyboard interactions
    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.();
      }
    };

    // Compose class names based on props
    const buttonClasses = classNames(
      // Base styles
      'inline-flex items-center justify-center rounded-md font-medium',
      'transition-all duration-200 ease-in-out',
      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
      
      // Variant and size styles
      variantStyles[variant],
      sizeStyles[size],
      
      // State styles
      {
        'opacity-50 cursor-not-allowed': disabled,
        'cursor-wait': loading,
      },
      
      // Custom classes
      className
    );

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        onClick={onClick}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        
        {/* Button content */}
        {children}
      </button>
    );
  }
);

// Display name for dev tools
Button.displayName = 'Button';

export default Button;