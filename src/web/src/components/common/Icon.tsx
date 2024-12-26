import React from 'react';
import clsx from 'clsx';
import { Size } from '../../types/common';

/**
 * Props interface for the Icon component
 */
interface IconProps {
  /** Name/identifier of the icon to display */
  name: string;
  /** Size variant of the icon - maps to predefined size classes */
  size?: Size;
  /** Optional color override for the icon */
  color?: string;
  /** Additional CSS classes to apply */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
}

/**
 * Maps size enum values to corresponding CSS classes
 * @param size - Size enum value
 * @returns CSS class name for the specified size
 */
const getSizeClass = (size?: Size): string => {
  switch (size) {
    case Size.SM:
      return 'icon--sm'; // 16px
    case Size.LG:
      return 'icon--lg'; // 32px
    case Size.MD:
    default:
      return 'icon--md'; // 24px
  }
};

/**
 * Icon mapping object containing SVG paths for each icon
 * Based on the design system specifications
 */
const ICON_MAP: Record<string, string> = {
  // Navigation icons
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  user: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  
  // Action icons
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  
  // Status icons
  success: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
};

/**
 * A reusable icon component that renders SVG icons following the application's 
 * design system specifications. Supports different sizes, colors and accessibility features.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size,
  color,
  className,
  ariaLabel
}) => {
  // Get the SVG path for the requested icon
  const iconPath = ICON_MAP[name];
  
  if (!iconPath) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  // Combine size class with any additional classes
  const iconClass = clsx(
    'icon',
    getSizeClass(size),
    className
  );

  // Inline styles for color override
  const style: React.CSSProperties = {
    ...(color && { fill: color })
  };

  return (
    <svg 
      className={iconClass}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel || name}
      style={style}
    >
      <path d={iconPath} />
    </svg>
  );
};

/**
 * Default styles for the Icon component
 * These should be included in your CSS/SCSS files
 *
 * .icon {
 *   display: inline-block;
 *   vertical-align: middle;
 *   fill: currentColor;
 *   transition: fill 0.2s ease;
 * }
 * 
 * .icon--sm {
 *   width: 16px;
 *   height: 16px;
 * }
 * 
 * .icon--md {
 *   width: 24px;
 *   height: 24px;
 * }
 * 
 * .icon--lg {
 *   width: 32px;
 *   height: 32px;
 * }
 */

export default Icon;