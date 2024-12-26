import React from 'react';
import classNames from 'classnames';
import { ComponentProps, Size } from '../../types/common';

/**
 * Props interface for Badge component extending base ComponentProps
 */
interface BadgeProps extends ComponentProps {
  /** Visual style variant of badge with HIPAA-compliant color contrast */
  variant?: 'success' | 'warning' | 'error' | 'info';
  /** Size variant of badge with responsive scaling */
  size?: Size;
  /** Whether badge has fully rounded corners for enhanced visual styling */
  rounded?: boolean;
}

/**
 * Badge component for displaying status indicators, counts, and labels
 * with HIPAA-compliant styling and accessibility features.
 *
 * @version 1.0.0
 * @example
 * <Badge variant="success" size={Size.MD} rounded>
 *   Approved
 * </Badge>
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'info',
  size = Size.MD,
  rounded = false,
}) => {
  // Base styles for badge component
  const baseStyles = 'inline-flex items-center justify-center font-medium';

  // Variant-specific styles with HIPAA-compliant contrast ratios
  const variantStyles = {
    success: 'bg-green-100 text-green-800 border border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    error: 'bg-red-100 text-red-800 border border-red-200',
    info: 'bg-blue-100 text-blue-800 border border-blue-200',
  };

  // Size-specific styles with responsive scaling
  const sizeStyles = {
    [Size.SM]: 'px-2 py-0.5 text-xs',
    [Size.MD]: 'px-2.5 py-1 text-sm',
    [Size.LG]: 'px-3 py-1.5 text-base',
  };

  // Border radius styles
  const roundedStyles = rounded ? 'rounded-full' : 'rounded-md';

  // Combine all styles using classNames utility
  const badgeStyles = classNames(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    roundedStyles,
    className
  );

  return (
    <span 
      className={badgeStyles}
      role="status"
      aria-label={`${variant} badge`}
    >
      {children}
    </span>
  );
};

/**
 * Default props for Badge component
 */
Badge.defaultProps = {
  variant: 'info',
  size: Size.MD,
  rounded: false,
};

/**
 * Display name for component debugging
 */
Badge.displayName = 'Badge';

export default Badge;