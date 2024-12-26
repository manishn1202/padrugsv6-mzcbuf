/**
 * Centralized routing configuration for Prior Authorization Management System
 * Implements secure route protection, role-based access control, and lazy loading
 * @version 1.0.0
 */

import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { UserRole } from '../types/auth';

// Lazy load components for code splitting
const Login = lazy(() => import('../pages/auth/Login'));
const ProviderDashboard = lazy(() => import('../pages/dashboard/ProviderDashboard'));
const RequestDetails = lazy(() => import('../pages/provider/RequestDetails'));
const Review = lazy(() => import('../pages/payer/Review'));

/**
 * Extended route configuration with enhanced access control and loading management
 */
export interface AppRoute extends RouteObject {
  /** Allowed user roles for route access */
  roles?: UserRole[];
  /** Whether route is accessible without authentication */
  isPublic?: boolean;
  /** Whether route requires MFA verification */
  requiresMFA?: boolean;
  /** Whether to prefetch route component */
  prefetch?: boolean;
}

/**
 * Application route configuration with role-based access control
 * and enhanced security features
 */
export const ROUTES: AppRoute[] = [
  // Public routes
  {
    path: '/',
    element: <Login />,
    isPublic: true,
    prefetch: true
  },
  {
    path: '/auth',
    isPublic: true,
    children: [
      {
        path: 'login',
        element: <Login />,
        prefetch: true
      }
    ]
  },

  // Provider routes
  {
    path: '/provider',
    roles: [UserRole.PROVIDER],
    requiresMFA: true,
    children: [
      {
        path: 'dashboard',
        element: <ProviderDashboard />,
        prefetch: true
      },
      {
        path: 'requests/:id',
        element: <RequestDetails />
      }
    ]
  },

  // Payer routes
  {
    path: '/payer',
    roles: [UserRole.PAYER_REVIEWER, UserRole.MEDICAL_DIRECTOR],
    requiresMFA: true,
    children: [
      {
        path: 'review/:id',
        element: <Review />
      }
    ]
  },

  // Medical Director routes
  {
    path: '/medical-director',
    roles: [UserRole.MEDICAL_DIRECTOR],
    requiresMFA: true,
    children: [
      {
        path: 'escalations',
        element: lazy(() => import('../pages/payer/Escalations')),
        prefetch: true
      }
    ]
  },

  // System Admin routes
  {
    path: '/admin',
    roles: [UserRole.SYSTEM_ADMIN],
    requiresMFA: true,
    children: [
      {
        path: 'users',
        element: lazy(() => import('../pages/admin/Users')),
        prefetch: true
      },
      {
        path: 'audit-logs',
        element: lazy(() => import('../pages/admin/AuditLogs'))
      }
    ]
  },

  // Error routes
  {
    path: '*',
    element: lazy(() => import('../pages/errors/NotFound')),
    isPublic: true
  },
  {
    path: '/unauthorized',
    element: lazy(() => import('../pages/errors/Unauthorized')),
    isPublic: true
  },
  {
    path: '/error',
    element: lazy(() => import('../pages/errors/Error')),
    isPublic: true
  }
];

/**
 * Helper function to check if a route requires authentication
 */
export const requiresAuth = (route: AppRoute): boolean => {
  return !route.isPublic;
};

/**
 * Helper function to check if a route requires MFA
 */
export const requiresMFA = (route: AppRoute): boolean => {
  return !!route.requiresMFA;
};

/**
 * Helper function to check if a user has permission to access a route
 */
export const hasRouteAccess = (route: AppRoute, userRole?: UserRole): boolean => {
  if (route.isPublic) return true;
  if (!userRole || !route.roles) return false;
  return route.roles.includes(userRole);
};

export default ROUTES;