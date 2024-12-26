// @version @types/fhir@4.0.0
import { BaseEntity } from './common';
import { ClinicalData, ClinicalEvidence } from './clinical';
import * as FHIR from '@types/fhir';

/**
 * Enum defining possible statuses for a prior authorization request
 * Tracks request lifecycle from creation through final determination
 */
export enum PriorAuthStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED', 
  IN_REVIEW = 'IN_REVIEW',
  PENDING_INFO = 'PENDING_INFO',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED'
}

/**
 * Interface for drug request information with FHIR R4 compliance
 * Captures complete medication request details including dosage instructions
 */
export interface DrugRequest {
  // Drug identification
  drug_code: string;
  drug_name: string;

  // Prescription details  
  quantity: number;
  days_supply: number;
  refills: number;
  form: string;
  strength: string;
  route: string;

  // FHIR R4 medication request elements
  medicationReference: FHIR.Reference;
  dosageInstruction: FHIR.DosageInstruction[];
}

/**
 * Main interface for prior authorization request data
 * Implements FHIR R4 compliance and supports AI-assisted matching
 */
export interface PriorAuthRequest extends BaseEntity {
  // FHIR resource metadata
  resourceType: string;
  identifier: FHIR.Identifier[];
  subject: FHIR.Reference;
  requester: FHIR.Reference;
  insurance: FHIR.Reference[];

  // Provider information
  provider_id: ID;

  // Patient demographics
  patient_mrn: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: Date;

  // Insurance information
  insurance_id: string;
  insurance_plan: string;

  // Clinical information
  drug: DrugRequest;
  diagnosis_code: string;
  diagnosis_name: string;

  // Request status and processing
  status: PriorAuthStatus;
  clinical_data: ClinicalData;
  evidence: ClinicalEvidence;
  confidence_score: number;

  // Timestamps
  submitted_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Interface for prior authorization API responses
 * Includes determination details and FHIR-compliant outcome coding
 */
export interface PriorAuthResponse {
  // Request identification
  request_id: ID;
  request: PriorAuthRequest;

  // AI matching results
  match_score: number;
  missing_criteria: string[];
  status_message: string;

  // Processing metadata
  processed_at: Date;

  // FHIR R4 outcome elements
  outcome: FHIR.CodeableConcept;
  reason: FHIR.CodeableConcept;
  validPeriod: FHIR.Period;
}