/**
 * @fileoverview Main header component for the Prior Authorization Management System.
 * Implements secure session management, user profile display, and notification controls
 * with comprehensive accessibility features and HIPAA compliance.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import Avatar from '../common/Avatar';
import NotificationBell from '../notifications/NotificationBell';
import { useAuth } from '../../hooks/useAuth';
import { SessionStatus } from '../../hooks/useAuth';
import { Theme } from '../../types/common';

/**
 * Props interface for Header component with enhanced accessibility
 */
interface HeaderProps extends React.ComponentProps<'header'> {
  /** Additional CSS classes for styling customization */
  className?: string;
  /** Handler for session timeout events */
  onSessionTimeout?: (event: CustomEvent) => void;
  /** Handler for notification interactions */
  onNotificationClick?: (event: React.MouseEvent) => void;
  /** Current theme setting */
  theme?: Theme;
}

/**
 * Main header component that displays application branding, user profile,
 * and notification controls with comprehensive security features.
 */
const Header: React.FC<HeaderProps> = ({
  className,
  onSessionTimeout,
  onNotificationClick,
  theme = Theme.LIGHT,
  ...props
}) => {
  const { user, sessionStatus, lastActivity, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [sessionWarning, setSessionWarning] = useState<boolean>(false);

  /**
   * Handles user profile menu interactions
   */
  const handleProfileClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsProfileOpen(prev => !prev);
  }, []);

  /**
   * Handles secure logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      // Clear any sensitive data from localStorage
      localStorage.clear();
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  /**
   * Monitors session status and triggers warnings/timeouts
   */
  useEffect(() => {
    if (sessionStatus === SessionStatus.IDLE && !sessionWarning) {
      setSessionWarning(true);
      // Dispatch session warning event
      const warningEvent = new CustomEvent('sessionWarning', {
        detail: { lastActivity }
      });
      window.dispatchEvent(warningEvent);
    }

    if (sessionStatus === SessionStatus.EXPIRED) {
      onSessionTimeout?.(new CustomEvent('sessionTimeout'));
      handleLogout();
    }
  }, [sessionStatus, sessionWarning, lastActivity, onSessionTimeout, handleLogout]);

  return (
    <header
      className={classNames(
        'header',
        {
          'header--dark': theme === Theme.DARK,
          'header--warning': sessionWarning
        },
        className
      )}
      role="banner"
      aria-label="Application header"
      {...props}
    >
      {/* Logo and branding */}
      <div className="header__brand">
        <img
          src="/logo.svg"
          alt="Prior Authorization Management System"
          className="header__logo"
        />
      </div>

      {/* Right-side controls */}
      <div className="header__controls" role="navigation">
        {/* Notification bell */}
        <NotificationBell
          onClick={onNotificationClick}
          className="header__notification"
          ariaLabel="View notifications"
        />

        {/* User profile */}
        <div className="header__profile">
          <button
            className="header__profile-button"
            onClick={handleProfileClick}
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
            aria-label="User profile menu"
          >
            <Avatar
              name={`${user?.firstName} ${user?.lastName}`}
              imageUrl={user?.imageUrl}
              size="md"
              className="header__avatar"
            />
            <span className="header__user-name">
              {user?.firstName} {user?.lastName}
            </span>
          </button>

          {/* Profile dropdown menu */}
          {isProfileOpen && (
            <div
              className="header__profile-menu"
              role="menu"
              aria-label="User profile options"
            >
              <button
                className="header__menu-item"
                onClick={() => window.location.href = '/profile'}
                role="menuitem"
              >
                Profile Settings
              </button>
              <button
                className="header__menu-item"
                onClick={handleLogout}
                role="menuitem"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Session warning dialog */}
        {sessionWarning && (
          <div
            className="header__session-warning"
            role="alert"
            aria-live="polite"
          >
            <p>Your session will expire soon due to inactivity.</p>
            <button
              onClick={() => setSessionWarning(false)}
              className="header__warning-button"
            >
              Continue Session
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

// Apply styles using CSS-in-JS with design system tokens
const styles = `
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-4) var(--spacing-8);
    background: var(--color-background-primary);
    border-bottom: 1px solid var(--color-border);
    height: var(--header-height);
    position: sticky;
    top: 0;
    z-index: var(--z-index-header);
    transition: all var(--transition-standard);
  }

  .header--dark {
    background: var(--color-background-primary-dark);
    border-color: var(--color-border-dark);
  }

  .header--warning {
    border-bottom-color: var(--color-warning);
  }

  .header__brand {
    display: flex;
    align-items: center;
  }

  .header__logo {
    height: var(--logo-height);
    width: auto;
  }

  .header__controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
  }

  .header__profile {
    position: relative;
  }

  .header__profile-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    border-radius: var(--radius-md);
    transition: background var(--transition-standard);
  }

  .header__profile-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--spacing-2);
    background: var(--color-background-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    min-width: 200px;
  }

  .header__menu-item {
    display: block;
    width: 100%;
    padding: var(--spacing-2) var(--spacing-4);
    text-align: left;
    transition: background var(--transition-standard);
  }

  .header__session-warning {
    position: fixed;
    bottom: var(--spacing-4);
    right: var(--spacing-4);
    padding: var(--spacing-4);
    background: var(--color-warning-light);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }

  .header__warning-button {
    margin-top: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-warning);
    color: var(--color-white);
    border-radius: var(--radius-sm);
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default React.memo(Header);