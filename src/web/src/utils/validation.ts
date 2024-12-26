import { z } from 'zod'; // @version 3.22.0
import fhirpath from 'fhirpath'; // @version 3.0.0
import { ValidationError } from '../types/common';

// Constants for validation rules
export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
export const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
export const MAX_DRUG_QUANTITY = 365;
export const MIN_DAYS_SUPPLY = 1;
export const MAX_DAYS_SUPPLY = 90;
export const MAX_REFILLS = 12;
export const MAX_FILE_SIZE = 10485760; // 10MB in bytes
export const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.png', '.tiff'];
export const CLINICAL_CODE_SYSTEMS = [
  'http://snomed.info/sct',
  'http://loinc.org',
  'http://www.nlm.nih.gov/research/umls/rxnorm'
];

/**
 * Validates that a required field has a non-empty value
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated
 * @returns ValidationError if invalid, null if valid
 */
export const validateRequired = (value: any, fieldName: string): ValidationError | null => {
  if (value === undefined || value === null) {
    return {
      field: fieldName,
      message: `${fieldName} is required`
    };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return {
      field: fieldName,
      message: `${fieldName} cannot be empty`
    };
  }

  return null;
};

/**
 * Validates email format using regex pattern
 * @param email - Email address to validate
 * @returns ValidationError if invalid, null if valid
 */
export const validateEmail = (email: string): ValidationError | null => {
  if (!email) {
    return {
      field: 'email',
      message: 'Email is required'
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      field: 'email',
      message: 'Invalid email format'
    };
  }

  return null;
};

/**
 * Validates phone number format using E.164 standard
 * @param phone - Phone number to validate
 * @returns ValidationError if invalid, null if valid
 */
export const validatePhone = (phone: string): ValidationError | null => {
  if (!phone) {
    return {
      field: 'phone',
      message: 'Phone number is required'
    };
  }

  if (!PHONE_REGEX.test(phone)) {
    return {
      field: 'phone',
      message: 'Invalid phone number format (E.164 format required)'
    };
  }

  return null;
};

/**
 * Validates a numeric value falls within specified range
 * @param value - Numeric value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param fieldName - Name of the field being validated
 * @returns ValidationError if invalid, null if valid
 */
export const validateNumericRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationError | null => {
  if (isNaN(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid number`
    };
  }

  if (value < min || value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`
    };
  }

  return null;
};

/**
 * Validates file type against allowed MIME types
 * @param file - File object to validate
 * @returns ValidationError if invalid, null if valid
 */
export const validateFileType = (file: File): ValidationError | null => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  
  if (!ALLOWED_FILE_TYPES.includes(extension)) {
    return {
      field: 'file',
      message: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
    };
  }

  return null;
};

/**
 * Validates file size against maximum allowed size
 * @param file - File object to validate
 * @returns ValidationError if invalid, null if valid
 */
export const validateFileSize = (file: File): ValidationError | null => {
  if (file.size > MAX_FILE_SIZE) {
    return {
      field: 'file',
      message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1048576}MB`
    };
  }

  return null;
};

/**
 * Validates clinical codes against standard code systems
 * @param code - Clinical code to validate
 * @param system - Code system (SNOMED, LOINC, RxNorm)
 * @returns ValidationError if invalid, null if valid
 */
export const validateClinicalCode = (code: string, system: string): ValidationError | null => {
  if (!CLINICAL_CODE_SYSTEMS.includes(system)) {
    return {
      field: 'code',
      message: 'Unsupported code system'
    };
  }

  // Validate code format based on system
  const isValid = fhirpath.evaluate(`${system}|${code}`, 'CodeableConcept');
  if (!isValid) {
    return {
      field: 'code',
      message: `Invalid code format for system ${system}`
    };
  }

  return null;
};

/**
 * Validates date range for clinical relevance
 * @param startDate - Start date to validate
 * @param endDate - End date to validate
 * @param fieldName - Name of the field being validated
 * @returns ValidationError if invalid, null if valid
 */
export const validateDateRange = (
  startDate: Date,
  endDate: Date,
  fieldName: string
): ValidationError | null => {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    return {
      field: fieldName,
      message: 'Invalid start date'
    };
  }

  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    return {
      field: fieldName,
      message: 'Invalid end date'
    };
  }

  if (startDate > endDate) {
    return {
      field: fieldName,
      message: 'Start date must be before end date'
    };
  }

  // Validate date range is within reasonable limits (e.g., not too far in past/future)
  const today = new Date();
  const maxPastDate = new Date();
  maxPastDate.setFullYear(today.getFullYear() - 2); // 2 years in past
  
  const maxFutureDate = new Date();
  maxFutureDate.setFullYear(today.getFullYear() + 1); // 1 year in future

  if (startDate < maxPastDate || endDate > maxFutureDate) {
    return {
      field: fieldName,
      message: 'Date range must be within reasonable limits'
    };
  }

  return null;
};

/**
 * Zod validation schemas for form validation
 */
export const ValidationSchemas = {
  // Drug request form schema
  drugRequest: z.object({
    drugName: z.string().min(1, 'Drug name is required'),
    quantity: z.number()
      .min(1, 'Quantity must be at least 1')
      .max(MAX_DRUG_QUANTITY, `Quantity cannot exceed ${MAX_DRUG_QUANTITY}`),
    daysSupply: z.number()
      .min(MIN_DAYS_SUPPLY, `Days supply must be at least ${MIN_DAYS_SUPPLY}`)
      .max(MAX_DAYS_SUPPLY, `Days supply cannot exceed ${MAX_DAYS_SUPPLY}`),
    refills: z.number()
      .min(0, 'Refills cannot be negative')
      .max(MAX_REFILLS, `Refills cannot exceed ${MAX_REFILLS}`)
  }),

  // Clinical data schema
  clinicalData: z.object({
    diagnosis: z.array(z.object({
      code: z.string(),
      system: z.enum(CLINICAL_CODE_SYSTEMS),
      display: z.string()
    })).min(1, 'At least one diagnosis is required'),
    labResults: z.array(z.object({
      code: z.string(),
      system: z.enum(CLINICAL_CODE_SYSTEMS),
      value: z.number(),
      unit: z.string(),
      effectiveDate: z.date()
    }))
  }),

  // Patient information schema
  patientInfo: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.date(),
    email: z.string().email('Invalid email format'),
    phone: z.string().regex(PHONE_REGEX, 'Invalid phone format'),
    insuranceId: z.string().min(1, 'Insurance ID is required')
  }),

  // Document upload schema
  documentUpload: z.object({
    files: z.array(z.custom<File>())
      .refine(
        (files) => files.every(file => file.size <= MAX_FILE_SIZE),
        'One or more files exceed maximum size limit'
      )
      .refine(
        (files) => files.every(file => 
          ALLOWED_FILE_TYPES.includes(`.${file.name.split('.').pop()?.toLowerCase()}`)),
        'One or more files have invalid file type'
      )
  })
};