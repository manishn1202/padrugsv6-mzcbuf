/**
 * API client module for clinical data operations in the Prior Authorization Management System.
 * Implements HIPAA-compliant data handling and AI-assisted evidence matching.
 * @version 1.0.0
 */

import axiosInstance from '../axios';
import { ClinicalData, ClinicalEvidence, ClinicalDataType, ClinicalValidationResult } from '../../types/clinical';
import { ApiResponse } from '../../types/api';
import { API_ENDPOINTS } from '../../config/api';

// Base API path for clinical endpoints
const API_BASE_PATH = '/api/v1/clinical';

/**
 * Retrieves clinical data for a specific prior authorization request
 * @param requestId - The ID of the prior authorization request
 * @returns Promise resolving to the clinical data
 */
export async function getClinicalData(requestId: string): Promise<ClinicalData> {
  try {
    const response = await axiosInstance.get<ApiResponse<ClinicalData>>(
      `${API_BASE_PATH}/${requestId}`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Submits new clinical data for a prior authorization request
 * @param requestId - The ID of the prior authorization request
 * @param clinicalData - The clinical data to submit
 * @returns Promise resolving to the created clinical data record
 */
export async function submitClinicalData(
  requestId: string,
  clinicalData: Partial<ClinicalData>
): Promise<ClinicalData> {
  try {
    const response = await axiosInstance.post<ApiResponse<ClinicalData>>(
      `${API_BASE_PATH}`,
      {
        request_id: requestId,
        ...clinicalData,
        recorded_at: new Date().toISOString()
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Updates existing clinical data with version tracking
 * @param clinicalDataId - The ID of the clinical data to update
 * @param updatedData - The updated clinical data
 * @returns Promise resolving to the updated clinical data record
 */
export async function updateClinicalData(
  clinicalDataId: string,
  updatedData: Partial<ClinicalData>
): Promise<ClinicalData> {
  try {
    const response = await axiosInstance.put<ApiResponse<ClinicalData>>(
      `${API_BASE_PATH}/${clinicalDataId}`,
      {
        ...updatedData,
        version: (updatedData.version || 0) + 1
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieves AI-generated evidence matches for clinical data
 * @param clinicalDataId - The ID of the clinical data to analyze
 * @returns Promise resolving to array of evidence matches with confidence scores
 */
export async function getEvidenceMatches(
  clinicalDataId: string
): Promise<ClinicalEvidence[]> {
  try {
    const response = await axiosInstance.get<ApiResponse<ClinicalEvidence[]>>(
      `${API_BASE_PATH}/${clinicalDataId}/evidence`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Validates clinical data against required criteria and HIPAA compliance
 * @param clinicalData - The clinical data to validate
 * @returns Promise resolving to validation results
 */
export async function validateClinicalData(
  clinicalData: Partial<ClinicalData>
): Promise<ClinicalValidationResult> {
  try {
    const response = await axiosInstance.post<ApiResponse<ClinicalValidationResult>>(
      `${API_BASE_PATH}/validate`,
      clinicalData
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieves provider notes for a clinical data record
 * @param clinicalDataId - The ID of the clinical data
 * @returns Promise resolving to provider notes
 */
export async function getProviderNotes(
  clinicalDataId: string
): Promise<ClinicalData> {
  try {
    const response = await axiosInstance.get<ApiResponse<ClinicalData>>(
      `${API_BASE_PATH}/${clinicalDataId}/notes`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Updates provider notes with audit tracking
 * @param clinicalDataId - The ID of the clinical data
 * @param notes - The updated provider notes
 * @returns Promise resolving to updated clinical data
 */
export async function updateProviderNotes(
  clinicalDataId: string,
  notes: string
): Promise<ClinicalData> {
  try {
    const response = await axiosInstance.put<ApiResponse<ClinicalData>>(
      `${API_BASE_PATH}/${clinicalDataId}/notes`,
      { notes }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieves AI-assisted criteria matching results with confidence scoring
 * @param clinicalDataId - The ID of the clinical data
 * @param criteriaId - The ID of the policy criteria to match against
 * @returns Promise resolving to matching results with confidence scores
 */
export async function getAICriteriaMatches(
  clinicalDataId: string,
  criteriaId: string
): Promise<ClinicalEvidence> {
  try {
    const response = await axiosInstance.get<ApiResponse<ClinicalEvidence>>(
      `${API_BASE_PATH}/${clinicalDataId}/matching/${criteriaId}`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}