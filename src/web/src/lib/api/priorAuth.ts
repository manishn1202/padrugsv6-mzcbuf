/**
 * Prior Authorization API client module for handling PA request operations
 * Implements comprehensive error handling, request validation, caching, and high-volume processing
 * @version 1.0.0
 */

import axiosInstance from '../axios';
import CircuitBreaker from 'opossum';
import rateLimit from 'axios-rate-limit';
import { PriorAuthRequest, PriorAuthResponse, PriorAuthStatus } from '../../types/priorAuth';
import { API_ENDPOINTS, API_RATE_LIMITS } from '../../config/api';
import { ApiError, PaginatedResponse, PaginationParams } from '../../types/api';

// Constants
const API_BASE_PATH = API_ENDPOINTS.PRIOR_AUTH.BASE;
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const CACHE_TTL = 300; // 5 minutes
const RATE_LIMIT = API_RATE_LIMITS.DEFAULT;
const RATE_WINDOW = 60000; // 1 minute

// Configure rate limiting
const rateLimitedAxios = rateLimit(axiosInstance, {
  maxRequests: RATE_LIMIT,
  perMilliseconds: RATE_WINDOW
});

// Configure circuit breaker
const breaker = new CircuitBreaker(rateLimitedAxios, {
  timeout: REQUEST_TIMEOUT,
  resetTimeout: 30000,
  errorThresholdPercentage: 50
});

// Simple in-memory cache
const cache = new Map<string, {
  data: any;
  timestamp: number;
}>();

/**
 * Creates a new prior authorization request
 * @param request Prior authorization request data
 * @returns Promise resolving to created request details
 */
export async function createPriorAuth(request: PriorAuthRequest): Promise<PriorAuthResponse> {
  try {
    // Generate request correlation ID
    const correlationId = crypto.randomUUID();

    // Validate request data
    validatePriorAuthRequest(request);

    const response = await breaker.fire(async () => {
      const result = await rateLimitedAxios.post<PriorAuthResponse>(
        `${API_BASE_PATH}/create`,
        request,
        {
          headers: {
            'X-Correlation-ID': correlationId
          }
        }
      );
      return result.data;
    });

    // Cache the response
    cache.set(`request:${response.request_id}`, {
      data: response,
      timestamp: Date.now()
    });

    return response;
  } catch (error) {
    handleApiError(error as ApiError);
    throw error;
  }
}

/**
 * Retrieves a specific prior authorization request by ID
 * @param id Prior authorization request ID
 * @returns Promise resolving to request details
 */
export async function getPriorAuth(id: string): Promise<PriorAuthResponse> {
  try {
    // Check cache first
    const cached = cache.get(`request:${id}`);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL * 1000) {
      return cached.data;
    }

    const response = await breaker.fire(async () => {
      const result = await rateLimitedAxios.get<PriorAuthResponse>(
        `${API_BASE_PATH}/${id}`
      );
      return result.data;
    });

    // Update cache
    cache.set(`request:${id}`, {
      data: response,
      timestamp: Date.now()
    });

    return response;
  } catch (error) {
    handleApiError(error as ApiError);
    throw error;
  }
}

/**
 * Updates an existing prior authorization request
 * @param id Prior authorization request ID
 * @param updates Partial request updates
 * @returns Promise resolving to updated request details
 */
export async function updatePriorAuth(
  id: string,
  updates: Partial<PriorAuthRequest>
): Promise<PriorAuthResponse> {
  try {
    // Validate update data
    validatePriorAuthUpdates(updates);

    // Optimistic cache update
    const cached = cache.get(`request:${id}`);
    if (cached) {
      cached.data.request = { ...cached.data.request, ...updates };
      cache.set(`request:${id}`, cached);
    }

    const response = await breaker.fire(async () => {
      const result = await rateLimitedAxios.put<PriorAuthResponse>(
        `${API_BASE_PATH}/${id}`,
        updates
      );
      return result.data;
    });

    // Update cache with confirmed data
    cache.set(`request:${id}`, {
      data: response,
      timestamp: Date.now()
    });

    return response;
  } catch (error) {
    // Revert optimistic update on error
    if (cached) {
      cache.set(`request:${id}`, cached);
    }
    handleApiError(error as ApiError);
    throw error;
  }
}

/**
 * Lists prior authorization requests with filtering and pagination
 * @param filters Optional filter parameters
 * @param pagination Pagination parameters
 * @returns Promise resolving to paginated request list
 */
export async function listPriorAuths(
  filters?: Record<string, any>,
  pagination?: PaginationParams
): Promise<PaginatedResponse<PriorAuthResponse>> {
  try {
    // Generate cache key from filters and pagination
    const cacheKey = `list:${JSON.stringify(filters)}:${JSON.stringify(pagination)}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL * 1000) {
      return cached.data;
    }

    const response = await breaker.fire(async () => {
      const result = await rateLimitedAxios.get<PaginatedResponse<PriorAuthResponse>>(
        API_BASE_PATH,
        {
          params: {
            ...filters,
            ...pagination
          }
        }
      );
      return result.data;
    });

    // Update cache
    cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    return response;
  } catch (error) {
    handleApiError(error as ApiError);
    throw error;
  }
}

/**
 * Validates prior authorization request data
 * @param request Request data to validate
 * @throws Error if validation fails
 */
function validatePriorAuthRequest(request: PriorAuthRequest): void {
  const requiredFields = [
    'provider_id',
    'patient_mrn',
    'patient_first_name',
    'patient_last_name',
    'patient_dob',
    'insurance_id',
    'insurance_plan',
    'drug',
    'diagnosis_code'
  ];

  for (const field of requiredFields) {
    if (!request[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!request.drug.drug_code || !request.drug.quantity || !request.drug.days_supply) {
    throw new Error('Invalid drug request details');
  }
}

/**
 * Validates prior authorization update data
 * @param updates Update data to validate
 * @throws Error if validation fails
 */
function validatePriorAuthUpdates(updates: Partial<PriorAuthRequest>): void {
  const allowedFields = [
    'status',
    'clinical_data',
    'evidence',
    'confidence_score'
  ];

  const invalidFields = Object.keys(updates).filter(
    field => !allowedFields.includes(field)
  );

  if (invalidFields.length > 0) {
    throw new Error(`Invalid update fields: ${invalidFields.join(', ')}`);
  }

  if (updates.status && !Object.values(PriorAuthStatus).includes(updates.status)) {
    throw new Error('Invalid status value');
  }
}

/**
 * Handles API errors with appropriate logging and transformation
 * @param error API error to handle
 * @throws Transformed error
 */
function handleApiError(error: ApiError): never {
  // Log error details
  console.error('Prior Auth API Error:', {
    status: error.status_code,
    type: error.error_type,
    message: error.message,
    requestId: error.request_id
  });

  // Transform error for client
  throw new Error(error.message || 'An error occurred processing the prior authorization request');
}