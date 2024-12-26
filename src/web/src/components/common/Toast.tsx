import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMediaQuery } from '@mui/material';
import clsx from 'clsx';
import { Colors } from '../../types/common';
import Icon from '../common/Icon';

// Toast Types and Interfaces
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose: () => void;
  className?: string;
  position?: ToastPosition;
}

// Helper function to get appropriate icon and aria-label based on toast type
const getToastIcon = (type: ToastType): { name: string; ariaLabel: string } => {
  const icons = {
    success: { name: 'success', ariaLabel: 'Success notification' },
    error: { name: 'error', ariaLabel: 'Error notification' },
    warning: { name: 'warning', ariaLabel: 'Warning notification' },
    info: { name: 'info', ariaLabel: 'Information notification' }
  };
  return icons[type];
};

// Helper function to get colors based on toast type
const getToastColor = (type: ToastType) => {
  const colors: Record<ToastType, { color: string; bgColor: string }> = {
    success: { color: Colors.success, bgColor: `${Colors.success}1A` }, // 10% opacity
    error: { color: Colors.error, bgColor: `${Colors.error}1A` },
    warning: { color: Colors.warning, bgColor: `${Colors.warning}1A` },
    info: { color: Colors.info, bgColor: `${Colors.info}1A` }
  };
  return colors[type];
};

// Animation variants based on position and motion preferences
const getAnimationVariants = (prefersReducedMotion: boolean, isMobile: boolean) => {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 }
    };
  }

  return {
    initial: { opacity: 0, y: isMobile ? 50 : -50, scale: 0.9 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: [0.4, 0, 1, 1]
      }
    }
  };
};

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 5000, // Default duration of 5 seconds
  onClose,
  className,
  position = 'top-right'
}) => {
  const timerRef = useRef<NodeJS.Timeout>();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Handle toast dismissal
  const handleClose = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onClose();
  }, [onClose]);

  // Set up auto-dismiss timer
  useEffect(() => {
    if (duration && duration > 0) {
      timerRef.current = setTimeout(handleClose, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, handleClose]);

  // Handle keyboard interactions
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  // Get toast styling
  const { color, bgColor } = getToastColor(type);
  const { name: iconName, ariaLabel } = getToastIcon(type);
  
  // Animation variants based on preferences
  const variants = getAnimationVariants(prefersReducedMotion || false, isMobile);

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={clsx(
          'toast',
          `toast--${type}`,
          `toast--${position}`,
          isMobile && 'toast--mobile',
          className
        )}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        style={{ backgroundColor: bgColor }}
        onKeyDown={handleKeyPress}
        tabIndex={0}
        drag={isMobile ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.9}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.y) > 50) {
            handleClose();
          }
        }}
      >
        <div className="toast__content">
          <Icon 
            name={iconName}
            className="toast__icon"
            color={color}
            ariaLabel={ariaLabel}
          />
          <span className="toast__message">{message}</span>
          <button
            type="button"
            className="toast__close"
            onClick={handleClose}
            aria-label="Close notification"
          >
            <Icon name="close" color={color} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Default styles for the Toast component - include in your CSS/SCSS
 *
 * .toast {
 *   position: fixed;
 *   min-width: 300px;
 *   max-width: 500px;
 *   padding: 16px;
 *   border-radius: 8px;
 *   box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
 *   z-index: 1000;
 * 
 *   &--top-right { top: 24px; right: 24px; }
 *   &--top-left { top: 24px; left: 24px; }
 *   &--bottom-right { bottom: 24px; right: 24px; }
 *   &--bottom-left { bottom: 24px; left: 24px; }
 *   &--top-center { top: 24px; left: 50%; transform: translateX(-50%); }
 *   &--bottom-center { bottom: 24px; left: 50%; transform: translateX(-50%); }
 * 
 *   &--mobile {
 *     min-width: unset;
 *     width: calc(100% - 32px);
 *     margin: 0 16px;
 *   }
 * 
 *   &__content {
 *     display: flex;
 *     align-items: center;
 *     gap: 12px;
 *   }
 * 
 *   &__icon {
 *     flex-shrink: 0;
 *   }
 * 
 *   &__message {
 *     flex-grow: 1;
 *     font-size: 14px;
 *     line-height: 1.5;
 *   }
 * 
 *   &__close {
 *     padding: 4px;
 *     border: none;
 *     background: none;
 *     cursor: pointer;
 *     opacity: 0.7;
 *     transition: opacity 0.2s;
 *     
 *     &:hover {
 *       opacity: 1;
 *     }
 *   }
 * }
 */

export default Toast;