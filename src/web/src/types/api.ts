/**
 * Core TypeScript type definitions for API request/response interfaces and error handling
 * in the Prior Authorization Management System frontend.
 * @version 1.0.0
 */

/**
 * Generic interface for standardized API responses with enhanced tracking capabilities
 * @template T The type of data contained in the response
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly message: string;
  readonly data: T;
  readonly timestamp: string;
  readonly request_id: string;
}

/**
 * Enum defining all possible API error types for consistent error handling
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

/**
 * Interface for field-level validation errors
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Comprehensive interface for API error responses with validation support
 */
export interface ApiError {
  readonly status_code: number;
  readonly error_type: ErrorType;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly validation_errors?: ValidationError[];
  readonly request_id: string;
}

/**
 * Enum for tracking API request processing status
 */
export enum RequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Enum for API result sorting direction
 */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * Enhanced interface for pagination, sorting, and filtering parameters
 */
export interface PaginationParams {
  readonly page: number;
  readonly page_size: number;
  readonly sort_by?: string;
  readonly sort_direction?: SortDirection;
  readonly filters?: Record<string, unknown>;
}

/**
 * Enhanced generic interface for paginated API responses with navigation helpers
 * @template T The type of items being paginated
 */
export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly page_size: number;
  readonly total_pages: number;
  readonly has_next: boolean;
  readonly has_previous: boolean;
}

/**
 * Type guard to check if an error is an API error
 * @param error The error to check
 * @returns boolean indicating if the error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error_type' in error &&
    'status_code' in error
  );
}

/**
 * Type guard to check if a response is paginated
 * @param response The response to check
 * @returns boolean indicating if the response is a PaginatedResponse
 */
export function isPaginatedResponse<T>(
  response: unknown
): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'items' in response &&
    'total' in response &&
    'page' in response
  );
}