import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'classnames';

import { ROUTES } from '../../config/routes';
import Icon from '../common/Icon';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';
import { Size } from '../../types/common';

interface NavigationProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional callback for navigation events */
  onNavigate?: (path: string) => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
  badge?: number;
  status?: 'active' | 'pending' | 'error';
}

/**
 * Primary navigation component for the Prior Authorization Management System.
 * Implements role-based access control, real-time status updates, and HIPAA compliance.
 */
const Navigation: React.FC<NavigationProps> = ({
  className,
  onNavigate
}) => {
  // Refs for navigation container and resize observer
  const navRef = useRef<HTMLElement>(null);
  const resizeObserver = useRef<ResizeObserver>();

  // Get authentication state and session status
  const { user, isAuthenticated, sessionStatus } = useAuth();

  // Memoized navigation items based on user role
  const navItems = useMemo(() => {
    if (!user) return [];

    const items: NavItem[] = [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        roles: [UserRole.PROVIDER, UserRole.PAYER_REVIEWER, UserRole.MEDICAL_DIRECTOR]
      },
      {
        path: '/requests',
        label: 'Prior Authorizations',
        icon: 'requests',
        roles: [UserRole.PROVIDER],
        badge: 0 // Updated dynamically
      },
      {
        path: '/review',
        label: 'Review Queue',
        icon: 'review',
        roles: [UserRole.PAYER_REVIEWER, UserRole.MEDICAL_DIRECTOR],
        badge: 0 // Updated dynamically
      },
      {
        path: '/escalations',
        label: 'Escalations',
        icon: 'escalation',
        roles: [UserRole.MEDICAL_DIRECTOR],
        badge: 0 // Updated dynamically
      },
      {
        path: '/reports',
        label: 'Analytics',
        icon: 'analytics',
        roles: [UserRole.PROVIDER, UserRole.PAYER_REVIEWER, UserRole.MEDICAL_DIRECTOR]
      },
      {
        path: '/admin',
        label: 'Administration',
        icon: 'admin',
        roles: [UserRole.SYSTEM_ADMIN]
      }
    ];

    return items.filter(item => item.roles.includes(user.role));
  }, [user]);

  // Handle navigation item click
  const handleNavClick = useCallback((path: string) => {
    onNavigate?.(path);
  }, [onNavigate]);

  // Handle keyboard navigation
  const handleKeyNav = useCallback((event: React.KeyboardEvent, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavClick(path);
    }
  }, [handleNavClick]);

  // Setup responsive navigation
  useEffect(() => {
    if (!navRef.current) return;

    resizeObserver.current = new ResizeObserver(entries => {
      const navElement = entries[0];
      if (navElement) {
        const isMobile = navElement.contentRect.width < 768;
        navRef.current?.classList.toggle('nav--mobile', isMobile);
      }
    });

    resizeObserver.current.observe(navRef.current);

    return () => {
      if (resizeObserver.current && navRef.current) {
        resizeObserver.current.unobserve(navRef.current);
      }
    };
  }, []);

  // Monitor session status for navigation updates
  useEffect(() => {
    if (sessionStatus === 'EXPIRED') {
      // Handle session expiration
      onNavigate?.('/login');
    }
  }, [sessionStatus, onNavigate]);

  if (!isAuthenticated) return null;

  return (
    <nav
      ref={navRef}
      className={clsx('navigation', className)}
      role="navigation"
      aria-label="Main navigation"
    >
      <ul className="navigation__list">
        {navItems.map(item => (
          <li key={item.path} className="navigation__item">
            <NavLink
              to={item.path}
              className={({ isActive }) => clsx(
                'navigation__link',
                {
                  'navigation__link--active': isActive,
                  'navigation__link--has-badge': item.badge !== undefined,
                  'navigation__link--has-status': item.status
                }
              )}
              onClick={() => handleNavClick(item.path)}
              onKeyDown={(e) => handleKeyNav(e, item.path)}
              role="menuitem"
              aria-current={({ isActive }) => isActive ? 'page' : undefined}
            >
              <Icon 
                name={item.icon} 
                size={Size.MD}
                className="navigation__icon"
                aria-hidden="true"
              />
              <span className="navigation__label">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span 
                  className="navigation__badge"
                  aria-label={`${item.badge} items`}
                >
                  {item.badge}
                </span>
              )}
              {item.status && (
                <span 
                  className={`navigation__status navigation__status--${item.status}`}
                  aria-label={`Status: ${item.status}`}
                />
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <style jsx>{`
        .navigation {
          width: 100%;
          background: var(--color-background-alt);
          border-bottom: var(--border-width-base) solid var(--color-border);
        }

        .navigation__list {
          display: flex;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .navigation__link {
          display: flex;
          align-items: center;
          padding: var(--spacing-md) var(--spacing-lg);
          color: var(--color-text-primary);
          text-decoration: none;
          transition: all var(--transition-duration-base);
          position: relative;
        }

        .navigation__link:hover {
          background: var(--color-background);
        }

        .navigation__link--active {
          color: var(--color-primary);
          background: var(--color-primary-50);
        }

        .navigation__icon {
          margin-right: var(--spacing-sm);
        }

        .navigation__badge {
          position: absolute;
          top: var(--spacing-xs);
          right: var(--spacing-xs);
          min-width: 20px;
          height: 20px;
          padding: 0 var(--spacing-xs);
          border-radius: var(--border-radius-full);
          background: var(--color-primary);
          color: white;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .navigation__status {
          width: 8px;
          height: 8px;
          border-radius: var(--border-radius-full);
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
        }

        .navigation__status--active {
          background: var(--color-success);
        }

        .navigation__status--pending {
          background: var(--color-warning);
        }

        .navigation__status--error {
          background: var(--color-error);
        }

        /* Mobile styles */
        .nav--mobile .navigation__list {
          flex-direction: column;
        }

        .nav--mobile .navigation__link {
          padding: var(--spacing-md);
        }

        /* Accessibility */
        .navigation__link:focus {
          outline: none;
          box-shadow: var(--shadow-focus);
        }

        @media (prefers-reduced-motion: reduce) {
          .navigation__link {
            transition: none;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navigation;