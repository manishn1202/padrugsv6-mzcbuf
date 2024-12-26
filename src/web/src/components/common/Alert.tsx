import React, { useRef, useEffect } from 'react';
import classNames from 'classnames';
import { ComponentProps } from '../../types/common';
import Icon from './Icon';

/**
 * Props interface for Alert component extending base ComponentProps
 */
export interface AlertProps extends ComponentProps {
  /** Alert severity level determining styling and behavior */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Alert message content supporting both text and rich content */
  message: string | React.ReactNode;
  /** Controls whether alert can be manually dismissed */
  dismissible?: boolean;
  /** Callback function triggered on alert dismissal */
  onDismiss?: () => void;
  /** Duration in milliseconds before auto-dismissal (0 to disable) */
  autoClose?: number;
  /** Pauses auto-close timer when hovering over alert */
  pauseOnHover?: boolean;
}

/**
 * Alert type configuration mapping
 */
const ALERT_CONFIG = {
  info: {
    backgroundColor: '#E3F2FD',
    borderColor: '#0066CC',
    textColor: '#0066CC',
    iconName: 'info'
  },
  success: {
    backgroundColor: '#E8F5E9',
    borderColor: '#28A745',
    textColor: '#28A745',
    iconName: 'success'
  },
  warning: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFC107',
    textColor: '#FFC107',
    iconName: 'warning'
  },
  error: {
    backgroundColor: '#FFEBEE',
    borderColor: '#DC3545',
    textColor: '#DC3545',
    iconName: 'error'
  }
};

/**
 * Custom hook to manage auto-close functionality
 */
const useAutoClose = (
  autoClose: number,
  onDismiss?: () => void,
  pauseOnHover?: boolean
): { handleMouseEnter: () => void; handleMouseLeave: () => void } => {
  const timerRef = useRef<NodeJS.Timeout>();

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const startTimer = () => {
    if (autoClose > 0 && onDismiss) {
      clearTimer();
      timerRef.current = setTimeout(onDismiss, autoClose);
    }
  };

  useEffect(() => {
    startTimer();
    return () => clearTimer();
  }, [autoClose, onDismiss]);

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      clearTimer();
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      startTimer();
    }
  };

  return { handleMouseEnter, handleMouseLeave };
};

/**
 * Alert component for displaying system messages and notifications
 * with support for multiple severity levels and accessibility features
 */
export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  message,
  dismissible = false,
  onDismiss,
  autoClose = 0,
  pauseOnHover = true,
  className,
  ...props
}) => {
  const config = ALERT_CONFIG[type];
  const { handleMouseEnter, handleMouseLeave } = useAutoClose(
    autoClose,
    onDismiss,
    pauseOnHover
  );

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (dismissible && event.key === 'Escape' && onDismiss) {
      onDismiss();
    }
  };

  const alertClasses = classNames(
    'alert',
    `alert--${type}`,
    {
      'alert--dismissible': dismissible
    },
    className
  );

  const alertStyles: React.CSSProperties = {
    backgroundColor: config.backgroundColor,
    borderColor: config.borderColor,
    color: config.textColor
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={alertClasses}
      style={alertStyles}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={dismissible ? 0 : undefined}
      {...props}
    >
      <div className="alert__content">
        <Icon
          name={config.iconName}
          size="md"
          color={config.textColor}
          className="alert__icon"
          aria-hidden="true"
        />
        <div className="alert__message">{message}</div>
      </div>

      {dismissible && onDismiss && (
        <button
          type="button"
          className="alert__close"
          onClick={onDismiss}
          aria-label="Close alert"
        >
          <Icon
            name="close"
            size="sm"
            color={config.textColor}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
};

/**
 * Default styles for the Alert component
 * These should be included in your CSS/SCSS files
 *
 * .alert {
 *   position: relative;
 *   display: flex;
 *   align-items: flex-start;
 *   justify-content: space-between;
 *   padding: 1rem;
 *   margin-bottom: 1rem;
 *   border-left: 4px solid;
 *   border-radius: 4px;
 *   transition: opacity 0.2s ease;
 * }
 *
 * .alert__content {
 *   display: flex;
 *   align-items: flex-start;
 *   gap: 0.75rem;
 * }
 *
 * .alert__message {
 *   flex: 1;
 * }
 *
 * .alert__close {
 *   padding: 0.25rem;
 *   background: none;
 *   border: none;
 *   cursor: pointer;
 *   opacity: 0.7;
 *   transition: opacity 0.2s ease;
 * }
 *
 * .alert__close:hover {
 *   opacity: 1;
 * }
 *
 * .alert--dismissible {
 *   padding-right: 3rem;
 * }
 */

export default Alert;