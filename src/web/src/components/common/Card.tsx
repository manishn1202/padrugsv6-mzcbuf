import React from 'react';
import classNames from 'classnames';
import styles from '../../styles/components.css';

/**
 * Props interface for the Card component
 */
interface CardProps {
  /** Child elements to render inside the card */
  children: React.ReactNode;
  /** Visual variant of the card */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Padding size using design system spacing units */
  padding?: 'none' | 'small' | 'medium' | 'large';
  /** Optional additional CSS classes */
  className?: string;
  /** Optional click handler */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** ARIA role for accessibility */
  role?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * Generates class names for the card based on props
 */
const getCardClasses = React.useCallback(
  (
    variant: CardProps['variant'] = 'default',
    padding: CardProps['padding'] = 'medium',
    className?: string
  ): string => {
    const paddingSizeMap = {
      none: '',
      small: styles['card--padding-sm'],
      medium: styles['card--padding-md'],
      large: styles['card--padding-lg'],
    };

    const variantMap = {
      default: '',
      elevated: styles['card--elevated'],
      outlined: styles['card--outlined'],
    };

    return classNames(
      styles.card,
      variantMap[variant],
      paddingSizeMap[padding],
      className
    );
  },
  []
);

/**
 * Card component that provides a consistent container layout with configurable styles
 * 
 * @example
 * ```tsx
 * <Card variant="elevated" padding="medium" ariaLabel="Status Summary">
 *   <h2>Status Overview</h2>
 *   <p>Content goes here</p>
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = React.memo(({
  children,
  variant = 'default',
  padding = 'medium',
  className,
  onClick,
  role = 'region',
  ariaLabel,
}) => {
  // Generate combined class names
  const cardClasses = getCardClasses(variant, padding, className);

  // Determine if the card should be interactive
  const isInteractive = Boolean(onClick);

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyPress={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' && onClick) {
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;