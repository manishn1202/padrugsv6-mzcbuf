import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import { Size, Variant } from '../../types/common';

/**
 * 500 Internal Server Error page component that provides a user-friendly error message
 * and recovery options while maintaining HIPAA compliance and accessibility standards.
 */
const InternalServerError: React.FC = () => {
  const navigate = useNavigate();
  const { resetBoundary } = useErrorBoundary();

  /**
   * Handles returning to the dashboard/home page and resetting error state
   */
  const handleReturnHome = useCallback(() => {
    // Reset any error boundaries
    resetBoundary();
    // Navigate to home page
    navigate('/', { replace: true });
  }, [navigate, resetBoundary]);

  return (
    <Layout>
      <div 
        className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
        role="main"
        aria-labelledby="error-heading"
      >
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Error Icon */}
          <div className="mx-auto h-24 w-24 text-error-500">
            <svg
              className="h-full w-full"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <div>
            <h1
              id="error-heading"
              className="text-3xl font-bold text-gray-900 mb-2"
            >
              Internal Server Error
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              We apologize for the inconvenience. Our team has been notified and is working to resolve the issue.
            </p>
          </div>

          {/* Recovery Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant={Variant.PRIMARY}
              size={Size.LG}
              onClick={handleReturnHome}
              ariaLabel="Return to homepage"
            >
              Return to Homepage
            </Button>
            <Button
              variant={Variant.OUTLINE}
              size={Size.LG}
              onClick={() => window.location.reload()}
              ariaLabel="Refresh page"
            >
              Refresh Page
            </Button>
          </div>

          {/* Support Information */}
          <div className="mt-8 text-sm text-gray-500">
            <p>
              If the problem persists, please contact our support team at{' '}
              <a
                href="mailto:support@pamanagement.com"
                className="text-primary hover:text-primary-dark"
              >
                support@pamanagement.com
              </a>
            </p>
            <p className="mt-2">
              Error Reference: {crypto.randomUUID().split('-')[0]}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .text-error-500 {
          color: var(--color-error);
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </Layout>
  );
};

export default InternalServerError;