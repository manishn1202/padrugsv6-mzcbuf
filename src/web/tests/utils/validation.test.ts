import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // @version ^29.0.0
import { z } from 'zod'; // @version ^3.22.0
import {
  validateRequired,
  validateEmail,
  validatePhone,
  validateNumericRange,
  ValidationSchemas,
  EMAIL_REGEX,
  PHONE_REGEX,
  MAX_DRUG_QUANTITY,
  MIN_DAYS_SUPPLY,
  MAX_DAYS_SUPPLY,
  MAX_REFILLS,
  CLINICAL_CODE_SYSTEMS
} from '../../src/utils/validation';

describe('validateRequired', () => {
  it('should return error for undefined value', () => {
    const result = validateRequired(undefined, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField is required'
    });
  });

  it('should return error for null value', () => {
    const result = validateRequired(null, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField is required'
    });
  });

  it('should return error for empty string', () => {
    const result = validateRequired('', 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField cannot be empty'
    });
  });

  it('should return error for whitespace-only string', () => {
    const result = validateRequired('   ', 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField cannot be empty'
    });
  });

  it('should return null for valid string value', () => {
    const result = validateRequired('valid value', 'testField');
    expect(result).toBeNull();
  });

  it('should return null for valid number value', () => {
    const result = validateRequired(42, 'testField');
    expect(result).toBeNull();
  });

  it('should return null for zero value', () => {
    const result = validateRequired(0, 'testField');
    expect(result).toBeNull();
  });
});

describe('validateEmail', () => {
  it('should return error for invalid email format', () => {
    const invalidEmails = [
      'test@',
      '@domain.com',
      'test@domain',
      'test.domain.com',
      'test@domain..com'
    ];

    invalidEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result).toEqual({
        field: 'email',
        message: 'Invalid email format'
      });
    });
  });

  it('should return error for SQL injection patterns', () => {
    const result = validateEmail("test@domain.com' OR '1'='1");
    expect(result).not.toBeNull();
  });

  it('should return error for XSS patterns', () => {
    const result = validateEmail('<script>alert("xss")</script>@domain.com');
    expect(result).not.toBeNull();
  });

  it('should enforce maximum length', () => {
    const longEmail = 'a'.repeat(256) + '@domain.com';
    const result = validateEmail(longEmail);
    expect(result).not.toBeNull();
  });

  it('should return null for valid email formats', () => {
    const validEmails = [
      'test@domain.com',
      'test.name@domain.com',
      'test+label@domain.com',
      'test@sub.domain.com'
    ];

    validEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result).toBeNull();
    });
  });
});

describe('validatePhone', () => {
  it('should return error for invalid phone formats', () => {
    const invalidPhones = [
      '123',
      '123-456-7890',
      '(123) 456-7890',
      'abc12345678'
    ];

    invalidPhones.forEach(phone => {
      const result = validatePhone(phone);
      expect(result).not.toBeNull();
    });
  });

  it('should return error for non-numeric characters', () => {
    const result = validatePhone('+1abc4567890');
    expect(result).not.toBeNull();
  });

  it('should enforce length constraints', () => {
    const shortPhone = '+1';
    const longPhone = '+' + '1'.repeat(16);
    
    expect(validatePhone(shortPhone)).not.toBeNull();
    expect(validatePhone(longPhone)).not.toBeNull();
  });

  it('should return null for valid E.164 formats', () => {
    const validPhones = [
      '+12345678901',
      '+442071234567',
      '+61291234567'
    ];

    validPhones.forEach(phone => {
      const result = validatePhone(phone);
      expect(result).toBeNull();
    });
  });
});

describe('validateNumericRange', () => {
  it('should return error for below minimum value', () => {
    const result = validateNumericRange(5, 10, 20, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField must be between 10 and 20'
    });
  });

  it('should return error for above maximum value', () => {
    const result = validateNumericRange(25, 10, 20, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField must be between 10 and 20'
    });
  });

  it('should return error for non-numeric value', () => {
    const result = validateNumericRange(NaN, 10, 20, 'testField');
    expect(result).toEqual({
      field: 'testField',
      message: 'testField must be a valid number'
    });
  });

  it('should handle boundary values correctly', () => {
    expect(validateNumericRange(10, 10, 20, 'testField')).toBeNull();
    expect(validateNumericRange(20, 10, 20, 'testField')).toBeNull();
  });

  it('should handle decimal precision', () => {
    expect(validateNumericRange(15.5, 10, 20, 'testField')).toBeNull();
    expect(validateNumericRange(10.001, 10, 20, 'testField')).toBeNull();
  });
});

describe('ValidationSchemas', () => {
  describe('drugRequest schema', () => {
    const validDrugRequest = {
      drugName: 'TestDrug',
      quantity: 30,
      daysSupply: 30,
      refills: 2
    };

    it('should validate valid drug request', () => {
      const result = ValidationSchemas.drugRequest.safeParse(validDrugRequest);
      expect(result.success).toBe(true);
    });

    it('should enforce quantity limits', () => {
      const invalidRequest = {
        ...validDrugRequest,
        quantity: MAX_DRUG_QUANTITY + 1
      };
      const result = ValidationSchemas.drugRequest.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should enforce days supply limits', () => {
      const invalidRequest = {
        ...validDrugRequest,
        daysSupply: MAX_DAYS_SUPPLY + 1
      };
      const result = ValidationSchemas.drugRequest.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should enforce refills limits', () => {
      const invalidRequest = {
        ...validDrugRequest,
        refills: MAX_REFILLS + 1
      };
      const result = ValidationSchemas.drugRequest.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('clinicalData schema', () => {
    const validClinicalData = {
      diagnosis: [{
        code: 'E11.9',
        system: CLINICAL_CODE_SYSTEMS[0],
        display: 'Type 2 diabetes mellitus without complications'
      }],
      labResults: [{
        code: '2339-0',
        system: CLINICAL_CODE_SYSTEMS[1],
        value: 7.2,
        unit: '%',
        effectiveDate: new Date()
      }]
    };

    it('should validate valid clinical data', () => {
      const result = ValidationSchemas.clinicalData.safeParse(validClinicalData);
      expect(result.success).toBe(true);
    });

    it('should require at least one diagnosis', () => {
      const invalidData = {
        ...validClinicalData,
        diagnosis: []
      };
      const result = ValidationSchemas.clinicalData.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate code systems', () => {
      const invalidData = {
        ...validClinicalData,
        diagnosis: [{
          ...validClinicalData.diagnosis[0],
          system: 'invalid-system'
        }]
      };
      const result = ValidationSchemas.clinicalData.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('patientInfo schema', () => {
    const validPatientInfo = {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      email: 'john.doe@example.com',
      phone: '+12345678901',
      insuranceId: 'INS123456'
    };

    it('should validate valid patient info', () => {
      const result = ValidationSchemas.patientInfo.safeParse(validPatientInfo);
      expect(result.success).toBe(true);
    });

    it('should validate email format', () => {
      const invalidInfo = {
        ...validPatientInfo,
        email: 'invalid-email'
      };
      const result = ValidationSchemas.patientInfo.safeParse(invalidInfo);
      expect(result.success).toBe(false);
    });

    it('should validate phone format', () => {
      const invalidInfo = {
        ...validPatientInfo,
        phone: '123-456-7890'
      };
      const result = ValidationSchemas.patientInfo.safeParse(invalidInfo);
      expect(result.success).toBe(false);
    });

    it('should require all fields', () => {
      const requiredFields = [
        'firstName',
        'lastName',
        'dateOfBirth',
        'email',
        'phone',
        'insuranceId'
      ];

      requiredFields.forEach(field => {
        const invalidInfo = { ...validPatientInfo };
        delete invalidInfo[field];
        const result = ValidationSchemas.patientInfo.safeParse(invalidInfo);
        expect(result.success).toBe(false);
      });
    });
  });
});