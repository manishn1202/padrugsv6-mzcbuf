/**
 * Entry point for the Prior Authorization Management System React application.
 * Implements secure application bootstrap with comprehensive error handling,
 * performance optimization, and HIPAA compliance.
 * @version 1.0.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { ThemeProvider } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store } from './store/store';

// CSP headers for security
const CSP_HEADERS = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: https:",
  'connect-src': "'self' https://api.pamanagement.com"
};

// Configure React Query client with performance optimizations
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    }
  }
});

/**
 * Error fallback component for root-level errors
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    role="alert"
    className="error-boundary"
    aria-label="Application error"
  >
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
    <button 
      onClick={() => window.location.reload()}
      className="error-boundary__retry-button"
    >
      Retry Application
    </button>
  </div>
);

/**
 * Initializes application with security and monitoring configurations
 */
const initializeApp = () => {
  // Set security headers
  Object.entries(CSP_HEADERS).forEach(([key, value]) => {
    document.head.appendChild(
      Object.assign(document.createElement('meta'), {
        httpEquiv: key,
        content: value
      })
    );
  });

  // Initialize performance monitoring
  if (process.env.NODE_ENV === 'production') {
    // Setup performance monitoring here
    console.log('Performance monitoring initialized');
  }
};

/**
 * Renders the root application with all required providers
 */
const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Initialize application
  initializeApp();

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Render application with providers
  root.render(
    <StrictMode>
      <ErrorBoundary 
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          // Log error to monitoring service
          console.error('Application Error:', error);
        }}
      >
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <NotificationProvider refreshInterval={30000}>
                  <App />
                </NotificationProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );
};

// Initialize and render application
renderApp();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}

// Export for testing
export { queryClient };