/**
 * Custom React hook for standardized API data fetching with enhanced error handling,
 * caching, request cancellation, and automatic refetching capabilities.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '../lib/axios';
import { ApiResponse, ApiError } from '../types/api';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Maximum retry attempts for failed requests
const MAX_RETRY_COUNT = 3;

// Base retry delay in milliseconds
const RETRY_DELAY = 1000;

// Global request cache using Map
const queryCache = new Map<string, {
  data: any;
  timestamp: number;
  version: number;
}>();

// Track pending requests to implement request deduplication
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Interface for query configuration options
 */
interface QueryOptions<T> {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Automatic refetch interval in milliseconds */
  refetchInterval?: number;
  /** Enable/disable caching */
  cacheEnabled?: boolean;
  /** Number of retry attempts for failed requests */
  retryCount?: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay?: number;
  /** Enable/disable request deduplication */
  deduplicate?: boolean;
  /** Initial data value */
  initialData?: T;
  /** Cache key override */
  cacheKey?: string;
  /** Transform function for response data */
  transform?: (data: any) => T;
}

/**
 * Interface for query result object
 */
interface QueryResult<T> {
  /** The fetched data */
  data: T | null;
  /** Loading state indicator */
  loading: boolean;
  /** Error state */
  error: ApiError | null;
  /** Function to manually refetch data */
  refetch: () => Promise<void>;
  /** Indicates if cached data is stale */
  isStale: boolean;
}

/**
 * Custom hook for fetching data from the API with comprehensive error handling,
 * caching, and request lifecycle management.
 * 
 * @param url - The API endpoint URL
 * @param options - Configuration options for the query
 * @returns QueryResult object containing data, loading state, error state, and utilities
 */
export function useQuery<T>(url: string, options: QueryOptions<T> = {}): QueryResult<T> {
  // Destructure options with defaults
  const {
    enabled = true,
    refetchInterval,
    cacheEnabled = true,
    retryCount = MAX_RETRY_COUNT,
    retryDelay = RETRY_DELAY,
    deduplicate = true,
    initialData = null,
    cacheKey = url,
    transform = (data: any) => data as T,
  } = options;

  // Component state
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Refs for cleanup and request cancellation
  const cancelTokenRef = useRef(axiosInstance.CancelToken.source());
  const refetchIntervalRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef<boolean>(true);

  /**
   * Safely updates state only if component is mounted
   */
  const safeSetState = useCallback(<S>(setter: React.Dispatch<React.SetStateAction<S>>, value: S) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  /**
   * Checks if cached data is valid
   */
  const isValidCache = useCallback((timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_TTL;
  }, []);

  /**
   * Main fetch function with retry logic and caching
   */
  const fetchData = useCallback(async (retryAttempt = 0): Promise<void> => {
    // Clear any existing retry timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    try {
      // Check cache first if enabled
      if (cacheEnabled) {
        const cached = queryCache.get(cacheKey);
        if (cached && isValidCache(cached.timestamp)) {
          safeSetState(setData, transform(cached.data));
          safeSetState(setLoading, false);
          safeSetState(setError, null);
          return;
        }
      }

      // Handle request deduplication
      if (deduplicate && pendingRequests.has(cacheKey)) {
        const response = await pendingRequests.get(cacheKey);
        safeSetState(setData, transform(response.data));
        return;
      }

      safeSetState(setLoading, true);
      safeSetState(setError, null);

      // Create new request promise
      const request = axiosInstance.get<ApiResponse<T>>(url, {
        cancelToken: cancelTokenRef.current.token
      });

      // Track pending request if deduplication is enabled
      if (deduplicate) {
        pendingRequests.set(cacheKey, request);
      }

      const response = await request;

      // Clear pending request
      if (deduplicate) {
        pendingRequests.delete(cacheKey);
      }

      // Transform and validate response data
      const transformedData = transform(response.data);

      // Update cache if enabled
      if (cacheEnabled) {
        queryCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now(),
          version: (queryCache.get(cacheKey)?.version || 0) + 1
        });
      }

      safeSetState(setData, transformedData);
      safeSetState(setLoading, false);
      safeSetState(setIsStale, false);

    } catch (error: any) {
      // Handle request cancellation
      if (axiosInstance.isCancel(error)) {
        return;
      }

      // Implement retry logic
      if (retryAttempt < retryCount) {
        retryTimeoutRef.current = setTimeout(() => {
          fetchData(retryAttempt + 1);
        }, retryDelay * Math.pow(2, retryAttempt));
        return;
      }

      safeSetState(setError, error);
      safeSetState(setLoading, false);
    }
  }, [url, cacheKey, cacheEnabled, deduplicate, retryCount, retryDelay, transform, safeSetState, isValidCache]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async (): Promise<void> => {
    // Invalidate cache for this query
    if (cacheEnabled) {
      queryCache.delete(cacheKey);
    }
    await fetchData();
  }, [cacheKey, cacheEnabled, fetchData]);

  // Setup effect for initial fetch and refetch interval
  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetchData();

    // Setup refetch interval if configured
    if (refetchInterval) {
      refetchIntervalRef.current = setInterval(() => {
        setIsStale(true);
        fetchData();
      }, refetchInterval);
    }

    // Cleanup function
    return () => {
      mountedRef.current = false;
      cancelTokenRef.current.cancel('Component unmounted');
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [enabled, fetchData, refetchInterval]);

  return {
    data,
    loading,
    error,
    refetch,
    isStale
  };
}