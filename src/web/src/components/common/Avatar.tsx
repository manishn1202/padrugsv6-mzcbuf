import React, { useState, useCallback } from 'react';
import classNames from 'classnames';
import { ComponentProps, Size } from '../../types/common';

/**
 * Props interface for Avatar component extending base ComponentProps
 * @extends ComponentProps
 */
interface AvatarProps extends ComponentProps {
  /** User's full name for generating initials and aria-label */
  name: string;
  /** Optional URL for user's profile image */
  imageUrl?: string;
  /** Size variant from Size enum (sm | md | lg) */
  size?: Size;
  /** Optional additional CSS classes */
  className?: string;
  /** Accessibility text for image */
  alt?: string;
}

/**
 * Extracts initials from a user's full name
 * @param {string} name - The full name to extract initials from
 * @returns {string} Uppercase initials (max 2 characters)
 */
const getInitials = (name: string): string => {
  if (!name?.trim()) return '';

  const nameParts = name.trim().split(/\s+/);
  const firstInitial = nameParts[0]?.[0] || '';
  const lastInitial = nameParts[nameParts.length - 1]?.[0] || '';

  return (firstInitial + (nameParts.length > 1 ? lastInitial : ''))
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Avatar component that displays user profile images or initials in a circular format
 * Implements progressive loading, accessibility features, and fallback displays
 * 
 * @component
 * @example
 * ```tsx
 * <Avatar 
 *   name="John Doe"
 *   imageUrl="/path/to/image.jpg"
 *   size={Size.MD}
 *   alt="John Doe's profile picture"
 * />
 * ```
 */
const Avatar: React.FC<AvatarProps> = ({
  name,
  imageUrl,
  size = Size.MD,
  className,
  alt,
  loading = false,
  ...props
}) => {
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  /**
   * Handles image loading errors by showing initials fallback
   */
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  /**
   * Handles successful image load
   */
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Determine if we should show the initials fallback
  const showInitials = !imageUrl || imageError;
  
  // Generate user initials for fallback display
  const initials = getInitials(name);

  // Compute component classes
  const avatarClasses = classNames(
    'avatar',
    `avatar--${size}`,
    {
      'avatar--loading': loading,
      'avatar--with-image': imageUrl && !imageError,
    },
    className
  );

  return (
    <div
      className={avatarClasses}
      role="img"
      aria-label={alt || `${name}'s avatar`}
      {...props}
    >
      {!showInitials && imageUrl && (
        <img
          src={imageUrl}
          alt={alt || name}
          className={classNames('avatar-image', {
            'avatar-image--loaded': imageLoaded
          })}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      
      {/* Fallback initials display */}
      {showInitials && (
        <div className="avatar-fallback" aria-hidden="true">
          {initials}
        </div>
      )}
    </div>
  );
};

// Define size-specific dimensions in pixels
const AVATAR_SIZES = {
  [Size.SM]: 32,
  [Size.MD]: 40,
  [Size.LG]: 48,
};

// Apply styles using CSS-in-JS with design system tokens
const styles = `
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--color-secondary);
    color: #FFFFFF;
    font-family: var(--font-family-primary);
    font-weight: var(--font-weight-medium);
    overflow: hidden;
    position: relative;
  }

  .avatar--sm {
    width: ${AVATAR_SIZES[Size.SM]}px;
    height: ${AVATAR_SIZES[Size.SM]}px;
    font-size: var(--font-size-sm);
  }

  .avatar--md {
    width: ${AVATAR_SIZES[Size.MD]}px;
    height: ${AVATAR_SIZES[Size.MD]}px;
    font-size: var(--font-size-base);
  }

  .avatar--lg {
    width: ${AVATAR_SIZES[Size.LG]}px;
    height: ${AVATAR_SIZES[Size.LG]}px;
    font-size: var(--font-size-lg);
  }

  .avatar--loading {
    opacity: 0.7;
    cursor: progress;
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
  }

  .avatar-image--loaded {
    opacity: 1;
  }

  .avatar-fallback {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default Avatar;