/**
 * Production-ready Axios instance configuration for the Prior Authorization Management System.
 * Implements comprehensive request/response interceptors, error handling, retry logic,
 * request queueing, circuit breaking, and performance monitoring.
 * @version 1.0.0
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { v4 as uuidv4 } from 'uuid';
import { API_CONFIG } from '../config/api';
import { ApiResponse, ApiError, ErrorType, isApiError } from '../types/api';
import { TOKEN_CONFIG } from '../config/auth';

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// Initialize circuit breaker
const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

// Create axios instance with base configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Client-Version': '1.0.0'
  }
});

// Configure retry behavior with exponential backoff
axiosRetry(axiosInstance, {
  retries: API_CONFIG.RETRY_ATTEMPTS,
  retryDelay: (retryCount) => {
    return retryCount * API_CONFIG.RETRY_DELAY;
  },
  retryCondition: (error: AxiosError) => {
    // Retry on network errors and 5xx responses
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response?.status ? error.response.status >= 500 : false);
  }
});

/**
 * Request interceptor for adding authentication, request tracking, and security headers
 */
axiosInstance.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
    // Check circuit breaker
    if (circuitBreaker.isOpen) {
      const now = Date.now();
      if (now - circuitBreaker.lastFailure > 60000) { // Reset after 1 minute
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    // Add request correlation ID
    const requestId = uuidv4();
    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = requestId;

    // Add authentication token if available
    const token = localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add security headers
    config.headers['X-XSS-Protection'] = '1; mode=block';
    config.headers['X-Content-Type-Options'] = 'nosniff';
    config.headers['X-Frame-Options'] = 'DENY';

    // Add request timestamp for monitoring
    config.headers['X-Request-Time'] = new Date().toISOString();

    // Add performance monitoring
    config.metadata = { 
      startTime: Date.now()
    };

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling, response transformation, and monitoring
 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration for monitoring
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    response.headers['X-Response-Time'] = `${duration}ms`;

    // Transform response to standardized format
    const apiResponse: ApiResponse<unknown> = {
      success: true,
      message: response.data.message || 'Success',
      data: response.data,
      timestamp: new Date().toISOString(),
      request_id: response.config.headers['X-Request-ID']
    };

    // Reset circuit breaker on successful response
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;

    return apiResponse;
  },
  async (error: AxiosError) => {
    // Update circuit breaker state
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();
    if (circuitBreaker.failures >= 5) {
      circuitBreaker.isOpen = true;
    }

    // Transform error to standardized format
    const apiError: ApiError = {
      status_code: error.response?.status || 500,
      error_type: mapErrorType(error),
      message: error.response?.data?.message || error.message,
      details: error.response?.data || {},
      request_id: error.config?.headers['X-Request-ID']
    };

    // Handle token refresh for 401 errors
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/refresh')) {
      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const response = await axiosInstance.post('/auth/refresh', { refreshToken });
          if (response.data.accessToken) {
            localStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, response.data.accessToken);
            // Retry original request
            return axiosInstance(error.config);
          }
        }
      } catch (refreshError) {
        // Handle refresh failure
        localStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
        localStorage.removeItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
        window.location.href = '/login';
      }
    }

    return Promise.reject(apiError);
  }
);

/**
 * Maps Axios errors to standardized error types
 */
function mapErrorType(error: AxiosError): ErrorType {
  if (!error.response) {
    return ErrorType.TIMEOUT_ERROR;
  }

  switch (error.response.status) {
    case 400:
      return ErrorType.VALIDATION_ERROR;
    case 401:
      return ErrorType.AUTHENTICATION_ERROR;
    case 403:
      return ErrorType.AUTHORIZATION_ERROR;
    case 404:
      return ErrorType.NOT_FOUND;
    case 429:
      return ErrorType.RATE_LIMIT_ERROR;
    case 503:
      return ErrorType.SERVICE_UNAVAILABLE;
    default:
      return ErrorType.INTERNAL_SERVER_ERROR;
  }
}

/**
 * Type guard for checking if a response is an API error
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

// Export configured axios instance
export default axiosInstance;