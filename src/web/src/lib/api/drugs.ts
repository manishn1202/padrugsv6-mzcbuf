/**
 * Drug-related API client module for the Prior Authorization Management System.
 * Implements comprehensive drug search, formulary verification, and policy criteria retrieval
 * with enhanced error handling, caching, and rate limiting support.
 * @version 1.0.0
 */

import axiosInstance from '../axios';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { API_ENDPOINTS, API_RATE_LIMITS } from '../../config/api';

// Cache configuration
const CACHE_CONFIG = {
  DRUG_SEARCH: 5 * 60 * 1000, // 5 minutes
  DRUG_DETAILS: 15 * 60 * 1000, // 15 minutes
  POLICY_CRITERIA: 30 * 60 * 1000, // 30 minutes
};

// Types
export interface Drug {
  id: string;
  name: string;
  code: string;
  therapeutic_class: string;
  manufacturer: string;
  strength: string;
  dosage_form: string;
  route: string;
}

export interface DrugDetails extends Drug {
  indications: string[];
  contraindications: string[];
  side_effects: string[];
  interactions: string[];
  dosing_info: {
    adult: string;
    pediatric?: string;
    geriatric?: string;
    renal_adjustment?: string;
    hepatic_adjustment?: string;
  };
}

export interface FormularyStatus {
  covered: boolean;
  tier: number;
  restrictions: {
    prior_auth_required: boolean;
    step_therapy_required: boolean;
    quantity_limits?: {
      amount: number;
      period: string;
    };
  };
  alternatives?: Drug[];
}

export interface PolicyCriteria {
  id: string;
  drug_id: string;
  payer_id: string;
  criteria: {
    clinical_requirements: string[];
    documentation_requirements: string[];
    step_therapy_requirements?: string[];
    renewal_criteria?: string[];
  };
  effective_date: string;
  last_updated: string;
}

export interface PaginationParams {
  page: number;
  page_size: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
}

// Cache implementation
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Searches for drugs by name, code or therapeutic class with pagination and caching
 * @param query - Search query string
 * @param params - Pagination parameters
 * @returns Promise with paginated drug search results
 */
export async function searchDrugs(
  query: string,
  params: PaginationParams
): Promise<PaginatedResponse<Drug>> {
  // Validate query length
  if (query.length < 3) {
    throw new Error('Search query must be at least 3 characters long');
  }

  // Check cache
  const cacheKey = `drug_search_${query}_${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.DRUG_SEARCH) {
    return cached.data;
  }

  // Make API request
  const response = await axiosInstance.get<PaginatedResponse<Drug>>(
    API_ENDPOINTS.FORMULARY.SEARCH,
    {
      params: {
        query,
        ...params,
      },
      headers: {
        'X-Rate-Limit': API_RATE_LIMITS.FORMULARY,
      },
    }
  );

  // Cache successful response
  cache.set(cacheKey, {
    data: response.data,
    timestamp: Date.now(),
  });

  return response.data;
}

/**
 * Gets detailed information about a specific drug with caching
 * @param drugId - Unique drug identifier
 * @returns Promise with detailed drug information
 */
export async function getDrugDetails(
  drugId: string
): Promise<ApiResponse<DrugDetails>> {
  // Validate drug ID
  if (!drugId.match(/^[A-Z0-9-]+$/i)) {
    throw new Error('Invalid drug ID format');
  }

  // Check cache
  const cacheKey = `drug_details_${drugId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.DRUG_DETAILS) {
    return cached.data;
  }

  // Make API request
  const response = await axiosInstance.get<ApiResponse<DrugDetails>>(
    API_ENDPOINTS.FORMULARY.DETAILS.replace(':id', drugId)
  );

  // Cache successful response
  cache.set(cacheKey, {
    data: response.data,
    timestamp: Date.now(),
  });

  return response.data;
}

/**
 * Verifies if a drug is in the payer's formulary with real-time checking
 * @param drugId - Unique drug identifier
 * @param payerId - Unique payer identifier
 * @returns Promise with formulary status and coverage details
 */
export async function verifyFormulary(
  drugId: string,
  payerId: string
): Promise<ApiResponse<FormularyStatus>> {
  // Validate inputs
  if (!drugId || !payerId) {
    throw new Error('Drug ID and Payer ID are required');
  }

  // Real-time verification - no caching
  const response = await axiosInstance.get<ApiResponse<FormularyStatus>>(
    `${API_ENDPOINTS.FORMULARY.DETAILS.replace(':id', drugId)}/coverage/${payerId}`,
    {
      timeout: 5000, // Shorter timeout for real-time checks
    }
  );

  return response.data;
}

/**
 * Gets prior authorization policy criteria for a drug with caching
 * @param drugId - Unique drug identifier
 * @param payerId - Unique payer identifier
 * @returns Promise with policy criteria and requirements
 */
export async function getDrugPolicyCriteria(
  drugId: string,
  payerId: string
): Promise<ApiResponse<PolicyCriteria>> {
  // Validate inputs
  if (!drugId || !payerId) {
    throw new Error('Drug ID and Payer ID are required');
  }

  // Check cache
  const cacheKey = `policy_criteria_${drugId}_${payerId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.POLICY_CRITERIA) {
    return cached.data;
  }

  // Make API request
  const response = await axiosInstance.get<ApiResponse<PolicyCriteria>>(
    `${API_ENDPOINTS.FORMULARY.POLICIES.replace(':id', drugId)}/${payerId}`
  );

  // Cache successful response
  cache.set(cacheKey, {
    data: response.data,
    timestamp: Date.now(),
  });

  return response.data;
}