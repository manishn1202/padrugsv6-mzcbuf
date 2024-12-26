// @version react@18.2.0
// @version react-router-dom@6.x
// @version use-debounce@9.x
// @version react-virtual@2.x
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import QueueList from '../../components/payer/QueueList';
import QueueFilters from '../../components/payer/QueueFilters';
import { useQuery } from '../../hooks/useQuery';
import { API_ENDPOINTS } from '../../config/api';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';
import { ApiError } from '../../types/api';

/**
 * Interface for queue page state management
 */
interface QueueState {
  filters: {
    status: PriorAuthStatus[];
    dateRange: {
      start: Date | null;
      end: Date | null;
    };
    priority: string[];
    drugTypes: string[];
    searchTerm: string;
  };
  sortKey: string;
  sortOrder: 'asc' | 'desc';
  pageInfo: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * High-performance queue management page component for prior authorization review
 * Implements virtualized list rendering and optimized filtering for 5,000+ requests/hour
 */
const Queue: React.FC = () => {
  const navigate = useNavigate();
  
  // Queue state management
  const [queueState, setQueueState] = useState<QueueState>({
    filters: {
      status: [],
      dateRange: { start: null, end: null },
      priority: [],
      drugTypes: [],
      searchTerm: ''
    },
    sortKey: 'priority',
    sortOrder: 'desc',
    pageInfo: {
      cursor: null,
      hasMore: true
    }
  });

  // Debounced filters to prevent excessive API calls
  const [debouncedFilters] = useDebounce(queueState.filters, 300);

  // Fetch queue data with filters and pagination
  const { data: requests, loading, error, refetch } = useQuery<PriorAuthRequest[]>(
    `${API_ENDPOINTS.PRIOR_AUTH.SEARCH}`,
    {
      enabled: true,
      cacheEnabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
      transform: (response) => response.data,
      cacheKey: JSON.stringify({
        filters: debouncedFilters,
        sort: { key: queueState.sortKey, order: queueState.sortOrder },
        cursor: queueState.pageInfo.cursor
      })
    }
  );

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: QueueState['filters']) => {
    setQueueState(prev => ({
      ...prev,
      filters: newFilters,
      pageInfo: {
        cursor: null,
        hasMore: true
      }
    }));
    await refetch();
  }, [refetch]);

  // Handle sort changes
  const handleSort = useCallback((key: string, order: 'asc' | 'desc') => {
    setQueueState(prev => ({
      ...prev,
      sortKey: key,
      sortOrder: order,
      pageInfo: {
        cursor: null,
        hasMore: true
      }
    }));
  }, []);

  // Handle request selection for review
  const handleRequestSelect = useCallback((request: PriorAuthRequest) => {
    navigate(`/review/${request.id}`, {
      state: { requestData: request }
    });
  }, [navigate]);

  // Load more requests when scrolling
  const handleLoadMore = useCallback(async () => {
    if (!queueState.pageInfo.hasMore || loading) return;

    const response = await fetch(`${API_ENDPOINTS.PRIOR_AUTH.SEARCH}?cursor=${queueState.pageInfo.cursor}`);
    const data = await response.json();

    setQueueState(prev => ({
      ...prev,
      pageInfo: {
        cursor: data.nextCursor,
        hasMore: data.hasMore
      }
    }));
  }, [queueState.pageInfo, loading]);

  // Error handling effect
  useEffect(() => {
    if (error) {
      console.error('Queue data fetch error:', error);
      // Implement error notification/handling here
    }
  }, [error]);

  // Virtualization configuration for optimal performance
  const virtualConfig = useMemo(() => ({
    itemSize: 60, // Height of each row in pixels
    overscan: 5, // Number of items to render beyond visible area
    threshold: 500 // Pixels from bottom before loading more
  }), []);

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          Prior Authorization Review Queue
        </h1>
        <div className="flex items-center space-x-2">
          {loading && (
            <span className="text-gray-500">
              Refreshing queue...
            </span>
          )}
        </div>
      </header>

      <QueueFilters
        filters={queueState.filters}
        onFilterChange={handleFilterChange}
        isLoading={loading}
        onError={(error: Error) => {
          console.error('Filter error:', error);
          // Implement error notification here
        }}
      />

      <div className="flex-1 min-h-0">
        <QueueList
          requests={requests || []}
          loading={loading}
          onSort={handleSort}
          onRequestSelect={handleRequestSelect}
          virtualProps={virtualConfig}
        />
      </div>

      {error && (
        <div 
          role="alert" 
          className="p-4 bg-red-50 text-red-700 rounded-md"
        >
          {(error as ApiError).message || 'An error occurred loading the queue'}
        </div>
      )}
    </div>
  );
};

export default Queue;