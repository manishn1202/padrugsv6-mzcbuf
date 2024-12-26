import React, { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'classnames';
import Icon from './Icon';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../config/routes';
import { Size } from '../../types/common';

/**
 * Props interface for the Sidebar component
 */
interface SidebarProps {
  /** Controls sidebar collapsed state */
  isCollapsed: boolean;
  /** Callback for toggling sidebar state */
  onToggle: () => void;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Navigation item structure with role permissions
 */
interface NavItem {
  /** Route path for navigation */
  path: string;
  /** Display label for navigation item */
  label: string;
  /** Icon name from design system */
  icon: string;
  /** Allowed user roles for access control */
  roles: string[];
}

/**
 * A responsive sidebar navigation component that provides role-based menu access
 * for both provider and payer portals in the Prior Authorization Management System.
 */
const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  className
}) => {
  // Authentication context for role-based access
  const { user, isLoading, error } = useAuth();
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  /**
   * Filters navigation items based on user role
   */
  const getNavItems = useCallback(() => {
    if (!user?.role) return [];

    return ROUTES
      .filter(route => !route.isPublic && route.roles?.includes(user.role))
      .map(route => ({
        path: route.path,
        label: route.label || route.path.split('/').pop() || '',
        icon: route.icon || 'default',
        roles: route.roles || []
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [user?.role]);

  // Update navigation items when user role changes
  useEffect(() => {
    if (!isLoading && !error) {
      setNavItems(getNavItems());
    }
  }, [isLoading, error, getNavItems]);

  // Loading state
  if (isLoading) {
    return (
      <div 
        className="sidebar--loading"
        role="complementary"
        aria-label="Navigation loading"
      >
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i}
              className="h-10 bg-gray-200 rounded mb-2"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="sidebar--error"
        role="alert"
      >
        Failed to load navigation
      </div>
    );
  }

  return (
    <aside
      className={clsx(
        'sidebar',
        {
          'sidebar--collapsed': isCollapsed
        },
        className
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Toggle Button */}
      <button
        className="sidebar__toggle"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
      >
        <Icon 
          name={isCollapsed ? 'chevron-right' : 'chevron-left'}
          size={Size.SM}
        />
      </button>

      {/* Navigation Items */}
      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => clsx(
              'sidebar__item',
              {
                'sidebar__item--active': isActive
              }
            )}
            aria-label={item.label}
          >
            <Icon 
              name={item.icon}
              size={Size.MD}
              className="sidebar__icon"
            />
            {!isCollapsed && (
              <span className="sidebar__label">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <style jsx>{`
        .sidebar {
          width: ${isCollapsed ? '64px' : '240px'};
          height: 100vh;
          background: var(--color-background-alt);
          border-right: 1px solid var(--color-border);
          transition: width var(--transition-duration-base) var(--transition-timing);
          position: fixed;
          top: 0;
          left: 0;
          z-index: var(--z-index-sidebar);
          padding: var(--spacing-md);
        }

        .sidebar__toggle {
          position: absolute;
          top: var(--spacing-md);
          right: calc(-1 * var(--spacing-md));
          width: 24px;
          height: 24px;
          background: var(--color-background-alt);
          border: 1px solid var(--color-border);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1;
        }

        .sidebar__nav {
          margin-top: var(--spacing-xl);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .sidebar__item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--border-radius-md);
          color: var(--color-text-primary);
          text-decoration: none;
          transition: all var(--transition-duration-base);
        }

        .sidebar__item:hover {
          background: var(--color-background);
        }

        .sidebar__item--active {
          background: var(--color-primary);
          color: var(--color-background-alt);
        }

        .sidebar__icon {
          flex-shrink: 0;
        }

        .sidebar__label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 768px) {
          .sidebar {
            width: ${isCollapsed ? '0' : '100%'};
          }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
```

This implementation:

1. Creates a responsive sidebar component with collapsible behavior and role-based access control
2. Uses the design system's color tokens and spacing variables
3. Implements proper accessibility features with ARIA labels and roles
4. Handles loading and error states gracefully
5. Provides smooth animations and transitions
6. Supports mobile responsiveness with different layouts
7. Integrates with the authentication system for role-based menu filtering
8. Uses the Icon component for consistent visual elements
9. Implements proper TypeScript typing and documentation
10. Follows the project's routing configuration and navigation structure

The component can be used like this:

```typescript
<Sidebar
  isCollapsed={sidebarCollapsed}
  onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
  className="app-sidebar"
/>