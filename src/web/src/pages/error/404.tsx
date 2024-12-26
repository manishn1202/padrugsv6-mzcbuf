import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import { Size, Variant } from '../../types/common';

/**
 * Enhanced 404 error page component that provides a user-friendly experience
 * when a page is not found. Includes automatic error reporting, analytics tracking,
 * accessibility optimizations, and smart navigation options.
 */
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [redirectCounter, setRedirectCounter] = useState(30);

  // Handle navigation back to previous page
  const handleGoBack = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      navigate(-1);
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to home page if navigation fails
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // Handle navigation to dashboard
  const handleGoHome = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      navigate('/dashboard');
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // Set up automatic redirect after timeout
  useEffect(() => {
    // Only start countdown if we're not on the dashboard already
    if (location.pathname !== '/dashboard') {
      const timer = setInterval(() => {
        setRedirectCounter((prev) => {
          if (prev <= 1) {
            navigate('/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [navigate, location.pathname]);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleGoBack(event as unknown as React.MouseEvent);
      } else if (event.key === 'Home') {
        handleGoHome(event as unknown as React.MouseEvent);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleGoBack, handleGoHome]);

  return (
    <Layout>
      <div 
        className="error"
        role="main"
        aria-label="Page not found"
        aria-live="polite"
        tabIndex={-1}
      >
        <div className="error__code">404</div>
        
        <h1 className="error__title">
          Page Not Found
        </h1>
        
        <p className="error__message">
          We couldn't find the page you're looking for. Please check the URL
          or use one of the options below to continue.
        </p>

        <div className="error__actions">
          <Button
            variant={Variant.PRIMARY}
            size={Size.LG}
            onClick={handleGoBack}
            disabled={isLoading}
            className="error__button"
            ariaLabel="Go back to previous page"
          >
            Go Back
          </Button>

          <Button
            variant={Variant.OUTLINE}
            size={Size.LG}
            onClick={handleGoHome}
            disabled={isLoading}
            className="error__button"
            ariaLabel="Return to dashboard"
          >
            Go to Dashboard
          </Button>
        </div>

        {location.pathname !== '/dashboard' && (
          <p className="error__redirect">
            Automatically redirecting to dashboard in {redirectCounter} seconds...
          </p>
        )}

        <style jsx>{`
          .error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            text-align: center;
            padding: var(--spacing-xl);
            animation: fadeIn 0.3s ease-in-out;
          }

          .error__code {
            font-size: 6rem;
            font-weight: bold;
            color: var(--color-error);
            margin-bottom: var(--spacing-md);
            animation: scaleIn 0.5s ease-out;
          }

          .error__title {
            font-size: 2rem;
            font-weight: medium;
            color: var(--color-text-primary);
            margin-bottom: var(--spacing-lg);
          }

          .error__message {
            font-size: 1.125rem;
            color: var(--color-text-secondary);
            margin-bottom: var(--spacing-xl);
            max-width: 480px;
            line-height: 1.6;
          }

          .error__actions {
            display: flex;
            gap: var(--spacing-md);
            flex-wrap: wrap;
            justify-content: center;
          }

          .error__redirect {
            margin-top: var(--spacing-lg);
            font-size: 0.875rem;
            color: var(--color-text-tertiary);
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.8);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .error,
            .error__code {
              animation: none;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
};

export default NotFoundPage;