import React from 'react';
import '../../styles/animations.css';
import '../../styles/components.css';

interface LoadingProps {
  /**
   * Size variant of the loading spinner
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Color of the loading spinner
   * @default var(--color-primary)
   */
  color?: string;
  
  /**
   * Whether to show spinner with a semi-transparent background overlay
   * @default false
   */
  overlay?: boolean;
  
  /**
   * Optional loading text to display below spinner
   */
  text?: string;
}

/**
 * Loading spinner component that provides visual feedback during async operations
 * Implements accessibility best practices and supports reduced motion preferences
 * 
 * @version 1.0.0
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  color = 'var(--color-primary)',
  overlay = false,
  text
}) => {
  // Size mappings in pixels
  const sizeMap = {
    sm: '16px',
    md: '32px',
    lg: '48px'
  };

  // Base styles for the spinner
  const spinnerStyle: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    borderWidth: size === 'sm' ? '2px' : '3px',
    borderStyle: 'solid',
    borderColor: `${color}20`, // 20 = 12% opacity
    borderTopColor: color,
    borderRadius: '50%',
    boxSizing: 'border-box'
  };

  // Container styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    ...(overlay && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      zIndex: 'var(--z-index-modal)'
    })
  };

  // Text styles
  const textStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: size === 'sm' ? 'var(--font-size-sm)' : 'var(--font-size-base)',
    textAlign: 'center',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  return (
    <div 
      style={containerStyle}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="loading-spinner"
    >
      <div
        className="loading-spinner"
        style={spinnerStyle}
        aria-hidden="true"
      />
      {text && (
        <span style={textStyle}>
          {text}
        </span>
      )}
      {/* Hidden text for screen readers */}
      <span className="visually-hidden">
        {text || 'Loading content'}
      </span>
    </div>
  );
};

export default Loading;