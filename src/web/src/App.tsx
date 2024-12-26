import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Layout from './components/layout/Layout';
import AuthProvider from './contexts/AuthContext';
import NotificationProvider from './contexts/NotificationContext';
import ThemeProvider from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { API_CONFIG } from './config/api';

// Configure query client with performance optimization settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // 5 minutes
      cacheTime: 900000, // 15 minutes
      retry: 3,
      suspense: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 3,
    },
  },
});

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    role="alert" 
    className="error-boundary"
    aria-label="Application error"
  >
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Refresh Page
    </button>
  </div>
);

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div 
    role="status" 
    className="loading-boundary"
    aria-label="Loading application"
  >
    <div className="loading-spinner" />
    <p>Loading...</p>
  </div>
);

/**
 * Protected route wrapper component that handles authentication
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Root application component that provides global context providers,
 * routing configuration, and main application layout.
 */
const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Perform any necessary initialization
        await Promise.all([
          // Add initialization tasks here
        ]);
        setIsInitialized(true);
      } catch (error) {
        console.error('Application initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <LoadingFallback />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NotificationProvider 
                refreshInterval={API_CONFIG.HEALTH_CHECK_INTERVAL}
              >
                <Layout>
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<React.lazy(() => import('./pages/auth/Login'))} />}
                      
                      {/* Protected provider routes */}
                      <Route path="/provider/*" element={
                        <ProtectedRoute>
                          <React.lazy(() => import('./pages/provider/ProviderDashboard'))} />
                        </ProtectedRoute>
                      } />

                      {/* Protected payer routes */}
                      <Route path="/payer/*" element={
                        <ProtectedRoute>
                          <React.lazy(() => import('./pages/payer/Review'))} />
                        </ProtectedRoute>
                      } />

                      {/* Redirect root to login */}
                      <Route path="/" element={<Navigate to="/login" replace />} />

                      {/* 404 route */}
                      <Route path="*" element={
                        <React.lazy(() => import('./pages/errors/NotFound'))} />
                      } />
                    </Routes>
                  </Suspense>
                </Layout>
              </NotificationProvider>
            </AuthProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;