/**
 * Provider portal page component for displaying and managing prior authorization requests.
 * Implements real-time status tracking, filtering, sorting, and HIPAA-compliant data display.
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ErrorBoundary } from 'react-error-boundary';
import RequestList from '../../components/provider/RequestList';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuth } from '../../hooks/useAuth';
import { PriorAuthRequest } from '../../types/priorAuth';
import { API_ENDPOINTS, API_ERRORS } from '../../config/api';
import axiosInstance from '../../lib/axios';

// Constants for performance optimization
const DEFAULT_PAGE_SIZE = 10;
const QUERY_STALE_TIME = 30000; // 30 seconds
const ERROR_RETRY_COUNT = 3;

interface RequestsPageProps {
  pageSize?: number;
  initialFilters?: Record<string, unknown>;
}

/**
 * Main provider portal page for managing prior authorization requests
 */
const RequestsPage: React.FC<RequestsPageProps> = ({
  pageSize = DEFAULT_PAGE_SIZE,
  initialFilters = {}
}) => {
  const navigate = useNavigate();
  const { user, validatePermission } = useAuth();
  const [currentFilters, setCurrentFilters] = useState(initialFilters);

  // Query for fetching PA requests with real-time updates
  const {
    data: requestsData,
    isLoading,
    error,
    refetch
  } = useQuery(
    ['priorAuthRequests', currentFilters],
    async () => {
      const response = await axiosInstance.get(API_ENDPOINTS.PRIOR_AUTH.SEARCH, {
        params: {
          provider_id: user?.id,
          page_size: pageSize,
          ...currentFilters
        }
      });
      return response.data;
    },
    {
      enabled: !!user?.id,
      staleTime: QUERY_STALE_TIME,
      retry: ERROR_RETRY_COUNT,
      refetchInterval: 30000, // Real-time updates every 30 seconds
      onError: (err) => {
        console.error('Error fetching requests:', err);
      }
    }
  );

  // Breadcrumb configuration
  const breadcrumbItems = useMemo(() => [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Prior Authorization Requests', path: '/requests', active: true }
  ], []);

  // Handle request selection and navigation
  const handleRequestClick = useCallback(async (request: PriorAuthRequest) => {
    try {
      // Validate user has permission to view request details
      const hasAccess = await validatePermission('VIEW_REQUEST_DETAILS');
      if (!hasAccess) {
        throw new Error(API_ERRORS.AUTH_ERROR);
      }

      // Navigate to request details with security context
      navigate(`/requests/${request.id}`, {
        state: { 
          requestId: request.id,
          accessValidated: true,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      console.error('Error accessing request:', err);
    }
  }, [navigate, validatePermission]);

  // Set up real-time status updates
  useEffect(() => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL!);
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'REQUEST_STATUS_UPDATE') {
        refetch();
      }
    };

    return () => {
      ws.close();
    };
  }, [refetch]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div className="error-container" role="alert">
      <h2>Error Loading Requests</h2>
      <pre>{error.message}</pre>
      <button 
        onClick={resetErrorBoundary}
        className="button button--primary"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={refetch}
    >
      <div className="requests-page">
        <header className="requests-page__header">
          <Breadcrumb 
            items={breadcrumbItems}
            className="mb-4"
          />
          <h1 className="text-2xl font-bold mb-6">
            Prior Authorization Requests
          </h1>
        </header>

        <main className="requests-page__content">
          <RequestList
            pageSize={pageSize}
            onRequestClick={handleRequestClick}
            showPHI={true} // Enable PHI display for providers
            cacheTimeout={QUERY_STALE_TIME}
          />
        </main>

        {/* Loading and error states */}
        {isLoading && (
          <div className="loading-overlay">
            Loading requests...
          </div>
        )}
        
        {error && (
          <div className="error-message" role="alert">
            {error instanceof Error ? error.message : API_ERRORS.SERVER_ERROR}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(RequestsPage);