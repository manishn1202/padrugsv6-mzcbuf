import { useState, useCallback } from 'react'; // @version 18.2.0
import {
  validateRequired,
  validateEmail,
  validatePhone,
  validateNumericRange,
} from '../utils/validation';
import { ValidationError } from '../types/common';

// Types for form management
type FormValues = Record<string, any>;
type FormErrors = Record<string, ValidationError>;
type FormTouched = Record<string, boolean>;

interface ValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnMount?: boolean;
}

interface FieldMetadata {
  value: any;
  error?: ValidationError;
  touched: boolean;
  initialValue: any;
}

interface FieldHelpers {
  setValue: (value: any) => void;
  setTouched: (touched: boolean) => void;
  setError: (error: ValidationError | undefined) => void;
}

interface UseFormReturn {
  values: FormValues;
  errors: FormErrors;
  touched: FormTouched;
  isSubmitting: boolean;
  isValidating: boolean;
  handleChange: (event: React.ChangeEvent<any>) => void;
  handleBlur: (event: React.FocusEvent<any>) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  resetForm: () => void;
  setFieldValue: (field: string, value: any) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  validateField: (field: string) => Promise<ValidationError | undefined>;
  validateForm: () => Promise<FormErrors>;
  getFieldMeta: (field: string) => FieldMetadata;
  getFieldHelpers: (field: string) => FieldHelpers;
}

/**
 * Enhanced form management hook with HIPAA-compliant validation and security
 * @param initialValues - Initial form values
 * @param validationSchema - Validation schema for form fields
 * @param validationOptions - Options for validation behavior
 * @param onSubmit - Form submission handler
 */
export const useForm = (
  initialValues: FormValues,
  validationSchema: Record<string, (value: any) => ValidationError | null>,
  validationOptions: ValidationOptions = {},
  onSubmit: (values: FormValues) => Promise<void>
): UseFormReturn => {
  // Initialize form state
  const [values, setValues] = useState<FormValues>(sanitizeInitialValues(initialValues));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Sanitizes initial form values to prevent XSS
   */
  function sanitizeInitialValues(values: FormValues): FormValues {
    const sanitized: FormValues = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') {
        sanitized[key] = value.replace(/[<>]/g, ''); // Basic XSS prevention
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Validates a single field
   */
  const validateField = useCallback(async (
    field: string
  ): Promise<ValidationError | undefined> => {
    if (!validationSchema[field]) return undefined;

    const value = values[field];
    let error: ValidationError | null = null;

    // Required field validation
    if (validationSchema[field]) {
      error = validationSchema[field](value);
    }

    // Special validations based on field type
    if (!error && value) {
      switch (field) {
        case 'email':
          error = validateEmail(value);
          break;
        case 'phone':
          error = validatePhone(value);
          break;
        case 'quantity':
        case 'daysSupply':
          error = validateNumericRange(value, 1, 365, field);
          break;
      }
    }

    // Update errors state
    setErrors(prev => ({
      ...prev,
      [field]: error || undefined
    }));

    return error || undefined;
  }, [values, validationSchema]);

  /**
   * Validates entire form
   */
  const validateForm = useCallback(async (): Promise<FormErrors> => {
    setIsValidating(true);
    const validationPromises = Object.keys(validationSchema).map(validateField);
    const validationResults = await Promise.all(validationPromises);

    const newErrors: FormErrors = {};
    Object.keys(validationSchema).forEach((field, index) => {
      if (validationResults[index]) {
        newErrors[field] = validationResults[index] as ValidationError;
      }
    });

    setErrors(newErrors);
    setIsValidating(false);
    return newErrors;
  }, [validateField, validationSchema]);

  /**
   * Secure change handler with sanitization
   */
  const handleChange = useCallback((event: React.ChangeEvent<any>) => {
    const { name, value, type } = event.target;
    let sanitizedValue = value;

    // Sanitize string inputs
    if (type === 'text' || type === 'email' || type === 'tel') {
      sanitizedValue = value.replace(/[<>]/g, '');
    }

    setValues(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));

    if (validationOptions.validateOnChange) {
      validateField(name);
    }
  }, [validationOptions.validateOnChange, validateField]);

  /**
   * Blur handler with validation
   */
  const handleBlur = useCallback((event: React.FocusEvent<any>) => {
    const { name } = event.target;

    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    if (validationOptions.validateOnBlur) {
      validateField(name);
    }
  }, [validationOptions.validateOnBlur, validateField]);

  /**
   * Secure form submission handler
   */
  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const formErrors = await validateForm();
      if (Object.keys(formErrors).length === 0) {
        await onSubmit(values);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      // Log validation/submission errors for audit purposes
      logValidationError(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateForm, onSubmit]);

  /**
   * Logs validation errors for HIPAA compliance audit
   */
  function logValidationError(error: any) {
    // Implementation would connect to logging service
    console.error('Validation Error:', {
      timestamp: new Date().toISOString(),
      error,
      formId: values.id
    });
  }

  /**
   * Secure field value setter
   */
  const setFieldValue = useCallback((field: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));

    if (validationOptions.validateOnChange) {
      validateField(field);
    }
  }, [validationOptions.validateOnChange, validateField]);

  /**
   * Field touched setter
   */
  const setFieldTouched = useCallback((field: string, touched: boolean) => {
    setTouched(prev => ({
      ...prev,
      [field]: touched
    }));
  }, []);

  /**
   * Form reset handler
   */
  const resetForm = useCallback(() => {
    setValues(sanitizeInitialValues(initialValues));
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsValidating(false);
  }, [initialValues]);

  /**
   * Get field metadata
   */
  const getFieldMeta = useCallback((field: string): FieldMetadata => {
    return {
      value: values[field],
      error: errors[field],
      touched: touched[field] || false,
      initialValue: initialValues[field]
    };
  }, [values, errors, touched, initialValues]);

  /**
   * Get field helpers
   */
  const getFieldHelpers = useCallback((field: string): FieldHelpers => {
    return {
      setValue: (value: any) => setFieldValue(field, value),
      setTouched: (touched: boolean) => setFieldTouched(field, touched),
      setError: (error: ValidationError | undefined) => 
        setErrors(prev => ({ ...prev, [field]: error }))
    };
  }, [setFieldValue, setFieldTouched]);

  // Run initial validation if configured
  useState(() => {
    if (validationOptions.validateOnMount) {
      validateForm();
    }
  });

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm,
    getFieldMeta,
    getFieldHelpers
  };
};