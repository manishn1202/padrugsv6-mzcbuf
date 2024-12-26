// React types for component props
// @version react@18.2.0
import { ReactNode } from 'react';

/**
 * Base interface for common component props used across the application
 */
export interface ComponentProps {
  /** Child elements/content */
  children?: ReactNode;
  /** Optional CSS class name for styling */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether the component is in a loading state */
  loading?: boolean;
}

/**
 * Common size variants for components
 */
export enum Size {
  SM = 'sm',
  MD = 'md',
  LG = 'lg'
}

/**
 * Common style variants for components
 */
export enum Variant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  OUTLINE = 'outline',
  TEXT = 'text'
}

/**
 * Theme options for the application
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

/**
 * Color palette type definitions based on design system specifications
 */
export type Colors = {
  /** Primary brand color - used for main actions and emphasis */
  primary: '#0066CC';
  /** Secondary brand color - used for supporting elements */
  secondary: '#00A3E0';
  /** Success state color - used for positive actions/feedback */
  success: '#28A745';
  /** Warning state color - used for cautionary feedback */
  warning: '#FFC107';
  /** Error state color - used for negative actions/feedback */
  error: '#DC3545';
};

/**
 * Spacing scale type definitions for consistent layout spacing
 * Base unit is 8px with multipliers
 */
export type Spacing = {
  /** Base spacing unit (8px) */
  base: 8;
  /** Extra small spacing (4px) - 0.5x base */
  xs: 4;
  /** Small spacing (8px) - 1x base */
  sm: 8;
  /** Medium spacing (16px) - 2x base */
  md: 16;
  /** Large spacing (24px) - 3x base */
  lg: 24;
  /** Extra large spacing (32px) - 4x base */
  xl: 32;
};

/**
 * Font size type definitions based on design system typography
 */
export type FontSize = {
  /** Small text size */
  sm: '0.875rem';
  /** Base text size */
  base: '1rem';
  /** Large text size */
  lg: '1.125rem';
  /** Extra large text size */
  xl: '1.25rem';
};

/**
 * Common status types for requests/items
 */
export type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Common alignment options
 */
export type Alignment = 'left' | 'center' | 'right';

/**
 * Common position options
 */
export type Position = 'top' | 'right' | 'bottom' | 'left';

/**
 * Utility type for making all properties optional
 */
export type PartialProps<T> = Partial<T>;

/**
 * Utility type for making all properties required
 */
export type RequiredProps<T> = Required<T>;

/**
 * Utility type for picking specific properties
 */
export type PickProps<T, K extends keyof T> = Pick<T, K>;

/**
 * Base button props extending common component props
 */
export interface ButtonProps extends ComponentProps {
  /** Button variant */
  variant?: Variant;
  /** Button size */
  size?: Size;
  /** Click handler */
  onClick?: () => void;
  /** Type of button */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Base input props extending common component props
 */
export interface InputProps extends ComponentProps {
  /** Input name */
  name: string;
  /** Input label */
  label?: string;
  /** Input value */
  value?: string | number;
  /** Change handler */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Error message */
  error?: string;
  /** Whether field is required */
  required?: boolean;
  /** Input type */
  type?: 'text' | 'number' | 'email' | 'password';
}

/**
 * Base form props extending common component props
 */
export interface FormProps extends ComponentProps {
  /** Form submission handler */
  onSubmit: (event: React.FormEvent) => void;
  /** Whether form is being submitted */
  isSubmitting?: boolean;
  /** Form validation errors */
  errors?: Record<string, string>;
}