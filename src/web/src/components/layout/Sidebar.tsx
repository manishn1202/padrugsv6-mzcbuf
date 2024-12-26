import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'classnames';
import { ErrorBoundary } from 'react-error-boundary';

import Icon from '../common/Icon';
import ROUTES from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { Size } from '../../types/common';

// Constants for responsive breakpoints and animations
const TRANSITION_DURATION = 200;
const MOBILE_BREAKPOINT = 576;
const TABLET_BREAKPOINT = 992;

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  direction?: 'ltr' | 'rtl';
}

/**
 * Custom hook for managing responsive collapse behavior
 */
const useResponsiveCollapse = () => {
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth <= TABLET_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth <= TABLET_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  return { isCollapsed, toggleCollapse };
};

/**
 * Sidebar component providing main navigation for the Prior Authorization Management System.
 * Implements role-based access control and responsive design.
 */
const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  direction = 'ltr'
}) => {
  const { user } = useAuth();
  const [activeRoute, setActiveRoute] = useState<string>('');

  // Filter navigation items based on user role
  const navigationItems = useMemo(() => {
    if (!user?.role) return [];
    
    return ROUTES.filter(route => {
      // Skip non-navigable routes
      if (!route.path || route.path === '*') return false;
      
      // Check role-based access
      if (route.roles && !route.roles.includes(user.role)) return false;
      
      return true;
    });
  }, [user?.role]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveRoute(path);
    }
  }, []);

  return (
    <ErrorBoundary fallback={<div>Error loading navigation</div>}>
      <aside
        className={clsx(
          'sidebar',
          {
            'sidebar--collapsed': isCollapsed,
            'sidebar--rtl': direction === 'rtl'
          }
        )}
        aria-label="Main navigation"
        style={{
          transition: `width ${TRANSITION_DURATION}ms ease-in-out`,
          width: isCollapsed ? '64px' : '240px'
        }}
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

        {/* Navigation Links */}
        <nav className="sidebar__nav">
          {navigationItems.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) => clsx(
                'sidebar__item',
                {
                  'sidebar__item--active': isActive,
                  'sidebar__item--collapsed': isCollapsed
                }
              )}
              onClick={() => setActiveRoute(route.path)}
              onKeyDown={(e) => handleKeyDown(e, route.path)}
              tabIndex={0}
              aria-current={activeRoute === route.path ? 'page' : undefined}
            >
              <Icon
                name={route.icon || 'default'}
                size={isCollapsed ? Size.LG : Size.MD}
                className="sidebar__icon"
              />
              {!isCollapsed && (
                <span className="sidebar__label">
                  {route.label || route.path.split('/').pop()}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <style jsx>{`
          .sidebar {
            position: fixed;
            top: 0;
            ${direction === 'rtl' ? 'right' : 'left'}: 0;
            height: 100vh;
            background: var(--color-background-alt);
            border-${direction === 'rtl' ? 'left' : 'right'}: 1px solid var(--color-border);
            z-index: var(--z-index-sidebar);
            overflow-x: hidden;
            overflow-y: auto;
          }

          .sidebar__toggle {
            position: absolute;
            top: var(--spacing-md);
            ${direction === 'rtl' ? 'left' : 'right'}: var(--spacing-sm);
            padding: var(--spacing-xs);
            border-radius: var(--border-radius-full);
            background: var(--color-background);
            border: 1px solid var(--color-border);
            cursor: pointer;
            z-index: 1;
          }

          .sidebar__nav {
            padding: var(--spacing-xl) var(--spacing-sm) var(--spacing-sm);
            display: flex;
            flex-direction: column;
            gap: var(--spacing-xs);
          }

          .sidebar__item {
            display: flex;
            align-items: center;
            padding: var(--spacing-sm) var(--spacing-md);
            border-radius: var(--border-radius-md);
            color: var(--color-text-primary);
            text-decoration: none;
            transition: all var(--transition-duration-base) ease-in-out;
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
            margin-${direction === 'rtl' ? 'left' : 'right'}: ${isCollapsed ? '0' : 'var(--spacing-sm)'};
          }

          .sidebar__label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          @media (max-width: ${MOBILE_BREAKPOINT}px) {
            .sidebar {
              transform: translateX(${isCollapsed ? 
                (direction === 'rtl' ? '100%' : '-100%') : '0'
              });
            }
          }
        `}</style>
      </aside>
    </ErrorBoundary>
  );
};

export default Sidebar;
```

This implementation:

1. Creates a responsive sidebar navigation component with collapsible functionality
2. Implements role-based access control using the auth context
3. Supports RTL layouts with proper directional styling
4. Includes comprehensive accessibility features with ARIA attributes
5. Uses CSS transitions for smooth animations
6. Implements keyboard navigation support
7. Includes error boundary for graceful error handling
8. Uses the design system tokens for consistent styling
9. Supports mobile-first responsive design
10. Implements proper route matching and active state handling

The component can be used like this:

```typescript
<Sidebar 
  isCollapsed={isSidebarCollapsed}
  onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
  direction="ltr"
/>