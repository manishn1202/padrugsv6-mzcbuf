/**
 * API client library for patient-related operations in the Prior Authorization Management System.
 * Implements FHIR-compliant interfaces, secure data handling, and comprehensive search capabilities.
 * @version 1.0.0
 */

import axiosInstance from '../axios';
import { ApiResponse, PaginatedResponse, SortDirection } from '../../types/api';
import { ClinicalData } from '../../types/clinical';
import { API_ENDPOINTS, API_RATE_LIMITS } from '../../config/api';

/**
 * Interface for FHIR-compliant patient resource
 */
interface Patient {
  id: string;
  resourceType: 'Patient';
  identifier: Array<{
    system: string;
    value: string;
  }>;
  active: boolean;
  name: Array<{
    use: string;
    family: string;
    given: string[];
  }>;
  birthDate: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  address?: Array<{
    use: string;
    type: string;
    line: string[];
    city: string;
    state: string;
    postalCode: string;
  }>;
  telecom?: Array<{
    system: string;
    value: string;
    use: string;
  }>;
}

/**
 * Interface for FHIR Bundle containing patient data
 */
interface FhirBundle {
  resourceType: 'Bundle';
  type: 'searchset' | 'collection';
  total: number;
  entry: Array<{
    resource: Patient | ClinicalData;
  }>;
}

/**
 * Interface for patient search parameters
 */
interface PatientSearchParams {
  query?: string;
  pageSize?: number;
  pageNumber?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  filters?: {
    active?: boolean;
    gender?: string;
    ageRange?: {
      min?: number;
      max?: number;
    };
    location?: string;
  };
}

/**
 * Search for patients with comprehensive filtering and HIPAA-compliant logging
 * @param searchParams - Search parameters including pagination and filters
 * @returns Promise with paginated patient results
 */
export async function searchPatients(
  searchParams: PatientSearchParams
): Promise<ApiResponse<PaginatedResponse<Patient>>> {
  const params = {
    q: searchParams.query,
    page_size: searchParams.pageSize || 20,
    page_number: searchParams.pageNumber || 1,
    sort_by: searchParams.sortBy,
    sort_direction: searchParams.sortDirection,
    ...searchParams.filters
  };

  return axiosInstance.get<ApiResponse<PaginatedResponse<Patient>>>(
    API_ENDPOINTS.PRIOR_AUTH.SEARCH,
    {
      params,
      headers: {
        'X-Rate-Limit': API_RATE_LIMITS.DEFAULT.toString(),
        'X-HIPAA-Audit': 'true'
      }
    }
  );
}

/**
 * Retrieve detailed patient information by ID with FHIR validation
 * @param patientId - Unique patient identifier
 * @returns Promise with patient details
 */
export async function getPatientById(
  patientId: string
): Promise<ApiResponse<Patient>> {
  return axiosInstance.get<ApiResponse<Patient>>(
    `${API_ENDPOINTS.PRIOR_AUTH.BASE}/patients/${patientId}`,
    {
      headers: {
        'Accept': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
        'X-HIPAA-Audit': 'true'
      }
    }
  );
}

/**
 * Retrieve patient's clinical data with PHI protection and audit logging
 * @param patientId - Unique patient identifier
 * @returns Promise with protected clinical data
 */
export async function getPatientClinicalData(
  patientId: string
): Promise<ApiResponse<ClinicalData>> {
  return axiosInstance.get<ApiResponse<ClinicalData>>(
    `${API_ENDPOINTS.CLINICAL.EVIDENCE}/patients/${patientId}`,
    {
      headers: {
        'X-PHI-Protection': 'enabled',
        'X-HIPAA-Audit': 'true',
        'X-Minimum-Necessary': 'true'
      }
    }
  );
}

/**
 * Retrieve FHIR R4 compliant patient bundle with version negotiation
 * @param patientId - Unique patient identifier
 * @returns Promise with FHIR bundle
 */
export async function getPatientFhirBundle(
  patientId: string
): Promise<ApiResponse<FhirBundle>> {
  return axiosInstance.get<ApiResponse<FhirBundle>>(
    `${API_ENDPOINTS.PRIOR_AUTH.BASE}/patients/${patientId}/$everything`,
    {
      headers: {
        'Accept': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
        'X-FHIR-Elements': 'Patient,Condition,Medication,Observation',
        'X-HIPAA-Audit': 'true'
      }
    }
  );
}

/**
 * Create new patient record with FHIR validation
 * @param patientData - FHIR-compliant patient resource
 * @returns Promise with created patient
 */
export async function createPatient(
  patientData: Omit<Patient, 'id'>
): Promise<ApiResponse<Patient>> {
  return axiosInstance.post<ApiResponse<Patient>>(
    `${API_ENDPOINTS.PRIOR_AUTH.BASE}/patients`,
    patientData,
    {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
        'X-HIPAA-Audit': 'true'
      }
    }
  );
}

/**
 * Update existing patient record with FHIR validation
 * @param patientId - Unique patient identifier
 * @param patientData - Updated patient data
 * @returns Promise with updated patient
 */
export async function updatePatient(
  patientId: string,
  patientData: Partial<Patient>
): Promise<ApiResponse<Patient>> {
  return axiosInstance.put<ApiResponse<Patient>>(
    `${API_ENDPOINTS.PRIOR_AUTH.BASE}/patients/${patientId}`,
    patientData,
    {
      headers: {
        'Content-Type': 'application/fhir+json',
        'X-FHIR-Version': '4.0.1',
        'X-HIPAA-Audit': 'true',
        'If-Match': '*'
      }
    }
  );
}