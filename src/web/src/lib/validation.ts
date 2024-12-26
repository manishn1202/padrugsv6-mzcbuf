// @version zod@3.22.0
import { z } from 'zod';
import { ClinicalDataType } from '../types/clinical';

/**
 * Interface for validation results with detailed error reporting
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  errorCodes: string[];
  fieldErrors: Record<string, string>;
}

/**
 * Constants for validation rules
 */
const VALIDATION_CONSTANTS = {
  EMAIL: {
    MAX_LENGTH: 254,
    MIN_LENGTH: 3,
    PATTERN: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  },
  PHONE: {
    DIGITS: 10,
    PATTERN: /^(?:\+1|1)?[-. ]?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/
  },
  CLINICAL: {
    MAX_TEXT_LENGTH: 50000,
    ALLOWED_FILE_TYPES: ['pdf', 'jpg', 'png', 'dcm']
  }
} as const;

/**
 * Validates email addresses using RFC 5322 standard with additional security checks
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export function validateEmail(email: string): boolean {
  if (!email?.trim()) {
    return false;
  }

  const sanitizedEmail = email.trim().toLowerCase();

  // Length validation
  if (
    sanitizedEmail.length > VALIDATION_CONSTANTS.EMAIL.MAX_LENGTH ||
    sanitizedEmail.length < VALIDATION_CONSTANTS.EMAIL.MIN_LENGTH
  ) {
    return false;
  }

  // Format validation using RFC 5322 pattern
  if (!VALIDATION_CONSTANTS.EMAIL.PATTERN.test(sanitizedEmail)) {
    return false;
  }

  // Domain validation
  const [, domain] = sanitizedEmail.split('@');
  if (!domain || !domain.includes('.') || domain.endsWith('.')) {
    return false;
  }

  return true;
}

/**
 * Validates US phone numbers in various formats with strict formatting rules
 * @param phone - Phone number to validate
 * @returns boolean indicating if phone number is valid
 */
export function validatePhone(phone: string): boolean {
  if (!phone?.trim()) {
    return false;
  }

  // Remove all non-numeric characters
  const numericPhone = phone.replace(/\D/g, '');

  // Check length
  if (numericPhone.length !== VALIDATION_CONSTANTS.PHONE.DIGITS) {
    return false;
  }

  // Format validation
  if (!VALIDATION_CONSTANTS.PHONE.PATTERN.test(phone)) {
    return false;
  }

  // Area code validation (cannot start with 0 or 1)
  const areaCode = parseInt(numericPhone.substring(0, 3));
  if (areaCode < 200) {
    return false;
  }

  // Exchange code validation (cannot start with 0 or 1)
  const exchangeCode = parseInt(numericPhone.substring(3, 6));
  if (exchangeCode < 200) {
    return false;
  }

  return true;
}

/**
 * Zod schema for patient data validation
 */
const patientDataSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['M', 'F', 'O']),
  medicalRecordNumber: z.string().min(1).max(50),
  diagnoses: z.array(z.string()).min(1)
});

/**
 * Zod schema for lab results validation
 */
const labResultsSchema = z.object({
  testName: z.string().min(1).max(100),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resultValue: z.string().or(z.number()),
  unitOfMeasure: z.string(),
  referenceRange: z.string().optional(),
  abnormalFlag: z.enum(['H', 'L', 'N']).optional(),
  performingLab: z.string()
});

/**
 * Validates clinical data based on data type with HIPAA compliance checks
 * @param dataType - Type of clinical data being validated
 * @param data - Clinical data object to validate
 * @returns ValidationResult object with validation details
 */
export function validateClinicalData(
  dataType: ClinicalDataType,
  data: Record<string, any>
): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    errors: [],
    errorCodes: [],
    fieldErrors: {}
  };

  try {
    switch (dataType) {
      case ClinicalDataType.PATIENT_DATA:
        const patientValidation = patientDataSchema.safeParse(data);
        if (!patientValidation.success) {
          result.errors = patientValidation.error.errors.map(err => err.message);
          result.errorCodes = patientValidation.error.errors.map(err => `PATIENT_${err.code}`);
          patientValidation.error.errors.forEach(err => {
            if (err.path) {
              result.fieldErrors[err.path.join('.')] = err.message;
            }
          });
        } else {
          result.isValid = true;
        }
        break;

      case ClinicalDataType.LAB_RESULTS:
        const labValidation = labResultsSchema.safeParse(data);
        if (!labValidation.success) {
          result.errors = labValidation.error.errors.map(err => err.message);
          result.errorCodes = labValidation.error.errors.map(err => `LAB_${err.code}`);
          labValidation.error.errors.forEach(err => {
            if (err.path) {
              result.fieldErrors[err.path.join('.')] = err.message;
            }
          });
        } else {
          result.isValid = true;
        }
        break;

      default:
        result.errors.push('Unsupported clinical data type');
        result.errorCodes.push('CLINICAL_UNSUPPORTED_TYPE');
    }

    // Additional HIPAA compliance checks
    if (result.isValid) {
      const sensitiveFields = findSensitiveFields(data);
      if (sensitiveFields.length > 0) {
        result.isValid = false;
        result.errors.push('Data contains unencrypted sensitive information');
        result.errorCodes.push('HIPAA_UNENCRYPTED_PHI');
        sensitiveFields.forEach(field => {
          result.fieldErrors[field] = 'Field contains unencrypted sensitive data';
        });
      }
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push('Validation processing error occurred');
    result.errorCodes.push('VALIDATION_PROCESSING_ERROR');
  }

  return result;
}

/**
 * Helper function to identify potentially sensitive fields in data
 * @param data - Data object to check for sensitive fields
 * @returns Array of field paths containing sensitive data
 */
function findSensitiveFields(data: Record<string, any>): string[] {
  const sensitiveFields: string[] = [];
  const sensitivePatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, // Credit card
    /\b[A-Z]{2}\d{6}\b/ // Driver's license (basic pattern)
  ];

  function traverse(obj: any, path: string[] = []) {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = [...path, key];
      
      if (typeof value === 'string') {
        if (sensitivePatterns.some(pattern => pattern.test(value))) {
          sensitiveFields.push(currentPath.join('.'));
        }
      } else if (typeof value === 'object') {
        traverse(value, currentPath);
      }
    });
  }

  traverse(data);
  return sensitiveFields;
}