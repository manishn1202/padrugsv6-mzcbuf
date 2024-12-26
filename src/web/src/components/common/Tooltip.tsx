import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import '../../styles/utilities.css';
import '../../styles/components.css';

// Enum for tooltip positions
export enum TooltipPosition {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left'
}

// Props interface with comprehensive type definitions
interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  highContrast?: boolean;
  ariaLabel?: string;
  id?: string;
  isRTL?: boolean;
}

// Constants for positioning and timing
const TOOLTIP_OFFSET = 8;
const DEFAULT_DELAY = 200;
const HIDE_DELAY = 100;

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = TooltipPosition.TOP,
  delay = DEFAULT_DELAY,
  disabled = false,
  highContrast = false,
  ariaLabel,
  id,
  isRTL = false,
}) => {
  // State and refs
  const [isVisible, setIsVisible] = useState(false);
  const [coordinates, setCoordinates] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate tooltip position based on trigger element and viewport
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case TooltipPosition.TOP:
        top = triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case TooltipPosition.BOTTOM:
        top = triggerRect.bottom + TOOLTIP_OFFSET;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case TooltipPosition.LEFT:
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - TOOLTIP_OFFSET;
        break;
      case TooltipPosition.RIGHT:
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + TOOLTIP_OFFSET;
        break;
    }

    // RTL support
    if (isRTL) {
      left = viewportWidth - left - tooltipRect.width;
    }

    // Viewport boundary checks
    if (left < 0) left = TOOLTIP_OFFSET;
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - TOOLTIP_OFFSET;
    }
    if (top < 0) top = TOOLTIP_OFFSET;
    if (top + tooltipRect.height > viewportHeight) {
      top = viewportHeight - tooltipRect.height - TOOLTIP_OFFSET;
    }

    setCoordinates({ top, left });
  }, [position, isRTL]);

  // Show tooltip with delay
  const showTooltip = useCallback(() => {
    if (disabled) return;
    
    clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
      
      // Set ARIA attributes
      if (triggerRef.current) {
        triggerRef.current.setAttribute('aria-expanded', 'true');
      }
    }, delay);
  }, [disabled, delay, calculatePosition]);

  // Hide tooltip with shorter delay
  const hideTooltip = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      
      // Reset ARIA attributes
      if (triggerRef.current) {
        triggerRef.current.setAttribute('aria-expanded', 'false');
      }
    }, HIDE_DELAY);
  }, []);

  // Keyboard event handler for accessibility
  const handleKeyboard = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isVisible) {
      hideTooltip();
    }
  }, [isVisible, hideTooltip]);

  // Event listeners setup and cleanup
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboard);
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
      clearTimeout(showTimeoutRef.current);
      clearTimeout(hideTimeoutRef.current);
    };
  }, [handleKeyboard, calculatePosition]);

  // Memoized class names for performance
  const tooltipClasses = useMemo(() => {
    return [
      'tooltip',
      `tooltip--${position}`,
      isVisible ? 'tooltip--visible' : '',
      highContrast ? 'tooltip--high-contrast' : '',
      isRTL ? 'tooltip--rtl' : ''
    ].filter(Boolean).join(' ');
  }, [position, isVisible, highContrast, isRTL]);

  return (
    <div 
      className="tooltip-wrapper"
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      role="tooltip"
      aria-describedby={id}
      aria-expanded={isVisible}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          id={id}
          className={tooltipClasses}
          style={{
            top: coordinates.top,
            left: coordinates.left,
            position: 'fixed',
          }}
          role="tooltip"
          aria-label={ariaLabel}
        >
          <div className="tooltip__content">
            {content}
          </div>
          <div className="tooltip__arrow" />
        </div>
      )}
    </div>
  );
};

export default Tooltip;