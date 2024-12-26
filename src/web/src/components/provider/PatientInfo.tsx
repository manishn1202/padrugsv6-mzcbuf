import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames';
import { debounce } from 'lodash'; // v4.17.21
import { FhirApi } from '@fhir/api-client'; // v1.0.0

import { Input } from '../common/Input';
import { ClinicalData } from '../../types/clinical';
import { Size } from '../../types/common';

// HIPAA-compliant field validation patterns
const VALIDATION_PATTERNS = {
  phone: /^\d{3}-\d{3}-\d{4}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  mrn: /^[A-Z0-9]{6,10}$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  zip: /^\d{5}(-\d{4})?$/,
};

// Props interface for the PatientInfo component
export interface PatientInfoProps {
  initialData?: ClinicalData;
  onChange: (data: ClinicalData) => void;
  onEmrImport?: (success: boolean, error?: Error) => void;
  disabled?: boolean;
}

// Interface for form field validation state
interface ValidationState {
  [key: string]: string;
}

/**
 * PatientInfo component for capturing and displaying patient information
 * Implements HIPAA compliance and EMR integration via FHIR
 */
export const PatientInfo: React.FC<PatientInfoProps> = ({
  initialData,
  onChange,
  onEmrImport,
  disabled = false,
}) => {
  // Form state management
  const [formData, setFormData] = useState<ClinicalData>(initialData || {
    patient_data: {},
    insurance_info: {},
  } as ClinicalData);
  
  const [errors, setErrors] = useState<ValidationState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [emrStatus, setEmrStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Initialize FHIR client
  const fhirClient = new FhirApi({
    baseUrl: process.env.REACT_APP_FHIR_API_URL,
    headers: {
      'Content-Type': 'application/fhir+json',
    },
  });

  /**
   * Validates a single form field value
   * @param name Field name
   * @param value Field value
   * @returns Validation error message or empty string
   */
  const validateField = useCallback((name: string, value: string): string => {
    if (!value && name !== 'email') {
      return 'This field is required';
    }

    const pattern = VALIDATION_PATTERNS[name as keyof typeof VALIDATION_PATTERNS];
    if (pattern && !pattern.test(value)) {
      switch (name) {
        case 'phone':
          return 'Please enter a valid phone number (XXX-XXX-XXXX)';
        case 'ssn':
          return 'Please enter a valid SSN (XXX-XX-XXXX)';
        case 'email':
          return value ? 'Please enter a valid email address' : '';
        case 'zip':
          return 'Please enter a valid ZIP code';
        default:
          return 'Invalid format';
      }
    }

    return '';
  }, []);

  /**
   * Handles input field changes with validation
   */
  const handleInputChange = useCallback(
    debounce((event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      
      // Validate field
      const error = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: error,
      }));

      // Update form data if valid
      if (!error) {
        setFormData(prev => ({
          ...prev,
          patient_data: {
            ...prev.patient_data,
            [name]: value,
          },
        }));

        // Notify parent component
        onChange(formData);
      }
    }, 300),
    [formData, onChange, validateField]
  );

  /**
   * Imports patient data from EMR via FHIR API
   */
  const handleEmrImport = async () => {
    setIsLoading(true);
    setEmrStatus('loading');

    try {
      // Fetch patient data from FHIR API
      const patientResponse = await fhirClient.search({
        resourceType: 'Patient',
        parameters: {
          identifier: formData.patient_data.mrn,
        },
      });

      if (patientResponse.entry?.[0]?.resource) {
        const fhirPatient = patientResponse.entry[0].resource;
        
        // Map FHIR data to form fields
        const mappedData = {
          firstName: fhirPatient.name?.[0]?.given?.[0] || '',
          lastName: fhirPatient.name?.[0]?.family || '',
          dob: fhirPatient.birthDate || '',
          phone: fhirPatient.telecom?.find(t => t.system === 'phone')?.value || '',
          email: fhirPatient.telecom?.find(t => t.system === 'email')?.value || '',
          address: fhirPatient.address?.[0]?.line?.[0] || '',
          city: fhirPatient.address?.[0]?.city || '',
          state: fhirPatient.address?.[0]?.state || '',
          zip: fhirPatient.address?.[0]?.postalCode || '',
        };

        setFormData(prev => ({
          ...prev,
          patient_data: {
            ...prev.patient_data,
            ...mappedData,
          },
        }));

        setEmrStatus('success');
        onEmrImport?.(true);
      }
    } catch (error) {
      console.error('EMR import error:', error);
      setEmrStatus('error');
      onEmrImport?.(false, error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update parent component when form data changes
  useEffect(() => {
    onChange(formData);
  }, [formData, onChange]);

  return (
    <div className="patient-info-form">
      <div className="form-header">
        <h2>Patient Information</h2>
        <button
          type="button"
          className={classNames('emr-import-btn', {
            'loading': isLoading,
            'success': emrStatus === 'success',
            'error': emrStatus === 'error',
          })}
          onClick={handleEmrImport}
          disabled={disabled || isLoading}
          aria-label="Import from EMR"
        >
          Import from EMR
        </button>
      </div>

      <div className="form-grid">
        <Input
          name="firstName"
          label="First Name"
          value={formData.patient_data.firstName || ''}
          onChange={handleInputChange}
          error={errors.firstName}
          required
          disabled={disabled}
          size={Size.MD}
          aria-label="Patient first name"
        />

        <Input
          name="lastName"
          label="Last Name"
          value={formData.patient_data.lastName || ''}
          onChange={handleInputChange}
          error={errors.lastName}
          required
          disabled={disabled}
          size={Size.MD}
          aria-label="Patient last name"
        />

        <Input
          name="dob"
          label="Date of Birth"
          type="date"
          value={formData.patient_data.dob || ''}
          onChange={handleInputChange}
          error={errors.dob}
          required
          disabled={disabled}
          size={Size.MD}
          aria-label="Patient date of birth"
        />

        <Input
          name="mrn"
          label="Medical Record Number"
          value={formData.patient_data.mrn || ''}
          onChange={handleInputChange}
          error={errors.mrn}
          required
          disabled={disabled}
          size={Size.MD}
          pattern={VALIDATION_PATTERNS.mrn.source}
          aria-label="Medical record number"
        />

        <Input
          name="phone"
          label="Phone Number"
          value={formData.patient_data.phone || ''}
          onChange={handleInputChange}
          error={errors.phone}
          required
          disabled={disabled}
          size={Size.MD}
          pattern={VALIDATION_PATTERNS.phone.source}
          aria-label="Patient phone number"
        />

        <Input
          name="email"
          label="Email Address"
          type="email"
          value={formData.patient_data.email || ''}
          onChange={handleInputChange}
          error={errors.email}
          disabled={disabled}
          size={Size.MD}
          pattern={VALIDATION_PATTERNS.email.source}
          aria-label="Patient email address"
        />

        <Input
          name="address"
          label="Street Address"
          value={formData.patient_data.address || ''}
          onChange={handleInputChange}
          error={errors.address}
          required
          disabled={disabled}
          size={Size.MD}
          aria-label="Patient street address"
        />

        <Input
          name="city"
          label="City"
          value={formData.patient_data.city || ''}
          onChange={handleInputChange}
          error={errors.city}
          required
          disabled={disabled}
          size={Size.MD}
          aria-label="Patient city"
        />

        <Input
          name="state"
          label="State"
          value={formData.patient_data.state || ''}
          onChange={handleInputChange}
          error={errors.state}
          required
          disabled={disabled}
          size={Size.MD}
          maxLength={2}
          aria-label="Patient state"
        />

        <Input
          name="zip"
          label="ZIP Code"
          value={formData.patient_data.zip || ''}
          onChange={handleInputChange}
          error={errors.zip}
          required
          disabled={disabled}
          size={Size.MD}
          pattern={VALIDATION_PATTERNS.zip.source}
          aria-label="Patient ZIP code"
        />
      </div>
    </div>
  );
};

export default PatientInfo;