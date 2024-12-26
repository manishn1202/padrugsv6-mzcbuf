import React from 'react';
import classnames from 'classnames';
import '../../styles/variables.css';

type ProgressBarVariant = 'primary' | 'success' | 'warning' | 'error';
type ProgressBarSize = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  /** Progress percentage (0-100) */
  value: number;
  /** Visual style variant */
  variant?: ProgressBarVariant;
  /** Size variant */
  size?: ProgressBarSize;
  /** Accessible label text */
  label?: string;
  /** Whether to display numeric progress value */
  showValue?: boolean;
  /** Whether to show progress animation */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const getProgressBarClasses = (props: ProgressBarProps): string => {
  const { variant = 'primary', size = 'md', animated, className } = props;
  
  return classnames(
    'progress-bar',
    `progress-bar--${variant}`,
    `progress-bar--${size}`,
    {
      'progress-bar--animated': animated,
    },
    className
  );
};

const getProgressBarStyles = (value: number): React.CSSProperties => {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  return {
    width: `${clampedValue}%`,
    transition: `width var(--transition-duration-base) var(--transition-timing)`,
  };
};

const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  value,
  variant = 'primary',
  size = 'md',
  label,
  showValue = false,
  animated = false,
  className,
}) => {
  // Generate component classes and styles
  const classes = getProgressBarClasses({ value, variant, size, animated, className });
  const progressStyles = getProgressBarStyles(value);

  // Define variant-specific colors from design system
  const variantColors = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  // Define size-specific heights
  const sizeHeights = {
    sm: 'var(--spacing-xs)',  // 4px
    md: 'var(--spacing-sm)',  // 8px
    lg: 'var(--spacing-md)',  // 16px
  };

  const containerStyles: React.CSSProperties = {
    height: sizeHeights[size],
    backgroundColor: 'var(--color-background)',
    borderRadius: 'var(--border-radius-full)',
    overflow: 'hidden',
    position: 'relative',
  };

  const fillStyles: React.CSSProperties = {
    ...progressStyles,
    backgroundColor: variantColors[variant],
    height: '100%',
    borderRadius: 'var(--border-radius-full)',
    position: 'absolute',
    left: 0,
    top: 0,
  };

  const valueStyles: React.CSSProperties = {
    position: 'absolute',
    right: 'var(--spacing-sm)',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: size === 'sm' ? 'var(--color-text-primary)' : 'var(--color-background-alt)',
    zIndex: 1,
  };

  if (animated) {
    fillStyles.animation = `progress-bar-stripes var(--transition-duration-slow) linear infinite`;
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={classes}
      style={containerStyles}
      data-testid="progress-bar"
    >
      <div 
        className="progress-bar__fill"
        style={fillStyles}
        data-testid="progress-bar-fill"
      />
      {showValue && size !== 'sm' && (
        <span 
          className="progress-bar__value"
          style={valueStyles}
          data-testid="progress-bar-value"
        >
          {`${Math.round(value)}%`}
        </span>
      )}
    </div>
  );
});

// Display name for debugging
ProgressBar.displayName = 'ProgressBar';

// Default props
ProgressBar.defaultProps = {
  variant: 'primary',
  size: 'md',
  showValue: false,
  animated: false,
};

// CSS animations
const styles = `
  @keyframes progress-bar-stripes {
    from {
      background-position: 1rem 0;
    }
    to {
      background-position: 0 0;
    }
  }

  .progress-bar--animated .progress-bar__fill {
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.15) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.15) 50%,
      rgba(255, 255, 255, 0.15) 75%,
      transparent 75%,
      transparent
    );
    background-size: 1rem 1rem;
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default ProgressBar;