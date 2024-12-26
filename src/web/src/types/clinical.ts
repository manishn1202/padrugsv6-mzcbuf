import { BaseEntity } from './common';

/**
 * Enum defining different types of clinical data in the system
 * Used for categorizing and validating clinical information
 * @version 1.0.0
 */
export enum ClinicalDataType {
  PATIENT_DATA = 'PATIENT_DATA',
  PROVIDER_NOTES = 'PROVIDER_NOTES',
  LAB_RESULTS = 'LAB_RESULTS',
  IMAGING = 'IMAGING',
  MEDICATION_HISTORY = 'MEDICATION_HISTORY'
}

/**
 * Interface representing clinical data associated with a prior authorization request
 * Implements HIPAA-compliant data structure with strict typing
 */
export interface ClinicalData extends BaseEntity {
  /** Associated prior authorization request ID */
  request_id: string;
  
  /** Type of clinical data being stored */
  data_type: ClinicalDataType;
  
  /** Structured patient clinical data in FHIR-compliant format */
  patient_data: Record<string, any>;
  
  /** Timestamp when the clinical data was recorded */
  recorded_at: Date;
  
  /** Provider who recorded/submitted the clinical data */
  provider_id: string;
  
  /** Version number for tracking data updates */
  version: number;
}

/**
 * Interface for AI-generated clinical evidence matching results
 * Used for automated criteria evaluation and confidence scoring
 */
export interface ClinicalEvidence extends BaseEntity {
  /** Reference to source clinical data */
  clinical_data_id: string;
  
  /** Reference to matched policy criteria */
  criteria_id: string;
  
  /** AI-generated confidence score (0-100) */
  confidence_score: number;
  
  /** Detailed mapping of evidence to criteria requirements */
  evidence_mapping: {
    /** Criteria requirement key mapped to supporting evidence */
    [key: string]: {
      matched_text: string[];
      confidence: number;
      source_location: string;
    }
  };
  
  /** Timestamp of evidence evaluation */
  evaluated_at: Date;
  
  /** Model version used for evaluation */
  model_version: string;
}

/**
 * Interface for structured provider clinical notes
 * Supports detailed documentation with timestamp tracking
 */
export interface ProviderNotes extends BaseEntity {
  /** Reference to associated clinical data */
  clinical_data_id: string;
  
  /** Provider who authored the notes */
  provider_id: string;
  
  /** Clinical notes content */
  notes: string;
  
  /** Timestamp when notes were recorded */
  noted_at: Date;
  
  /** Optional structured data elements */
  structured_data?: {
    diagnosis_codes: string[];
    treatment_plan: string;
    medications: string[];
  };
}

/**
 * Interface for evidence matching display in review interface
 * Supports highlighting and confidence score visualization
 */
export interface EvidenceMatch {
  /** Source evidence data */
  evidenceData: {
    content: string;
    source: string;
    timestamp: Date;
  };
  
  /** Match confidence score (0-100) */
  matchScore: number;
  
  /** Array of matched criteria identifiers */
  matchedCriteria: string[];
  
  /** Array of highlighted text segments */
  highlightedText: string[];
  
  /** Supporting context around matches */
  context: {
    before: string;
    match: string;
    after: string;
  }[];
}

/**
 * Type for clinical data validation results
 */
export type ClinicalValidationResult = {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    severity: 'ERROR' | 'WARNING';
  }[];
  warnings: string[];
};

/**
 * Type for evidence match filters
 */
export type EvidenceMatchFilter = {
  minConfidence: number;
  criteriaTypes: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  providers?: string[];
};

/**
 * Type for clinical data search parameters
 */
export type ClinicalSearchParams = {
  dataTypes?: ClinicalDataType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  providers?: string[];
  keywords?: string[];
  patientId?: string;
  requestId?: string;
};