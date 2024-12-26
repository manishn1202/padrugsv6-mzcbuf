import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.45.0
import * as yup from 'yup'; // v1.2.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import PatientInfo from './PatientInfo';
import DrugSelection from './DrugSelection';
import SupportingDocs from './SupportingDocs';
import { Button } from '../common/Button';
import { ClinicalData } from '../../types/clinical';
import { DrugRequest, PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';
import { Document, DocumentType } from '../../types/documents';
import { Size, Variant } from '../../types/common';

// Form validation schema
const validationSchema = yup.object().shape({
  patient_data: yup.object().required('Patient information is required'),
  drug: yup.object().shape({
    drug_code: yup.string().required('Drug selection is required'),
    quantity: yup.number().required('Quantity is required').min(1),
    days_supply: yup.number().required('Days supply is required').min(1),
    refills: yup.number().required('Refills is required').min(0)
  }),
  documents: yup.array().min(1, 'At least one supporting document is required')
});

interface PriorAuthFormProps {
  /** Initial form data for editing existing requests */
  initialData?: Partial<PriorAuthRequest>;
  /** Insurance payer ID for formulary verification */
  payerId: string;
  /** Form submission handler */
  onSubmit: (data: PriorAuthRequest) => Promise<void>;
  /** Error handler */
  onError: (error: Error) => void;
  /** Encryption status handler */
  onEncryptionStatus: (status: boolean) => void;
  /** Disable form editing */
  disabled?: boolean;
}

/**
 * A comprehensive HIPAA-compliant prior authorization form component.
 * Implements EMR integration, real-time formulary verification, secure document management,
 * and advanced validation with accessibility support.
 */
export const PriorAuthForm: React.FC<PriorAuthFormProps> = ({
  initialData,
  payerId,
  onSubmit,
  onError,
  onEncryptionStatus,
  disabled = false
}) => {
  // Form state management with validation
  const { control, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm({
    defaultValues: initialData || {
      status: PriorAuthStatus.DRAFT,
      patient_data: {},
      drug: {
        quantity: 0,
        days_supply: 0,
        refills: 0
      },
      documents: []
    },
    validationSchema
  });

  // Component state
  const [clinicalData, setClinicalData] = useState<ClinicalData>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isEncrypted, setIsEncrypted] = useState(false);

  // Watch form values for cross-field validation
  const formValues = watch();

  /**
   * Handles patient data changes with EMR synchronization
   */
  const handlePatientDataChange = useCallback((data: ClinicalData) => {
    setClinicalData(data);
    setValue('patient_data', data.patient_data, { shouldValidate: true });
  }, [setValue]);

  /**
   * Handles drug selection with formulary verification
   */
  const handleDrugChange = useCallback((drug: DrugRequest) => {
    setValue('drug', drug, { shouldValidate: true });
  }, [setValue]);

  /**
   * Handles document updates with encryption verification
   */
  const handleDocumentUpdate = useCallback((updatedDocs: Document[]) => {
    setDocuments(updatedDocs);
    setValue('documents', updatedDocs, { shouldValidate: true });

    // Verify all documents are encrypted
    const allEncrypted = updatedDocs.every(doc => doc.encryption_status === 'ENCRYPTED');
    setIsEncrypted(allEncrypted);
    onEncryptionStatus(allEncrypted);
  }, [setValue, onEncryptionStatus]);

  /**
   * Form submission handler with comprehensive validation
   */
  const onFormSubmit = useCallback(async (formData: PriorAuthRequest) => {
    try {
      // Verify encryption status
      if (!isEncrypted) {
        throw new Error('All documents must be encrypted before submission');
      }

      // Prepare request data
      const requestData: PriorAuthRequest = {
        ...formData,
        status: PriorAuthStatus.SUBMITTED,
        clinical_data: clinicalData!,
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      await onSubmit(requestData);
    } catch (error) {
      onError(error as Error);
    }
  }, [clinicalData, isEncrypted, onSubmit, onError]);

  // Update encryption status when documents change
  useEffect(() => {
    const allEncrypted = documents.every(doc => doc.encryption_status === 'ENCRYPTED');
    setIsEncrypted(allEncrypted);
    onEncryptionStatus(allEncrypted);
  }, [documents, onEncryptionStatus]);

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div className="text-error-500 p-4" role="alert">
          Error loading form: {error.message}
        </div>
      )}
    >
      <form 
        onSubmit={handleSubmit(onFormSubmit)}
        className="space-y-8"
        noValidate
      >
        {/* Patient Information Section */}
        <section aria-labelledby="patient-info-heading">
          <h2 id="patient-info-heading" className="text-xl font-semibold mb-4">
            Patient Information
          </h2>
          <Controller
            name="patient_data"
            control={control}
            render={({ field }) => (
              <PatientInfo
                initialData={field.value}
                onChange={handlePatientDataChange}
                disabled={disabled}
                onEmrImport={(success) => {
                  if (!success) {
                    onError(new Error('EMR import failed'));
                  }
                }}
              />
            )}
          />
          {errors.patient_data && (
            <p className="text-error-500 mt-2" role="alert">
              {errors.patient_data.message}
            </p>
          )}
        </section>

        {/* Drug Selection Section */}
        <section aria-labelledby="drug-selection-heading">
          <h2 id="drug-selection-heading" className="text-xl font-semibold mb-4">
            Medication Details
          </h2>
          <Controller
            name="drug"
            control={control}
            render={({ field }) => (
              <DrugSelection
                value={field.value}
                onChange={handleDrugChange}
                payerId={payerId}
                error={errors.drug?.message}
              />
            )}
          />
        </section>

        {/* Supporting Documents Section */}
        <section aria-labelledby="documents-heading">
          <h2 id="documents-heading" className="text-xl font-semibold mb-4">
            Supporting Documentation
          </h2>
          <Controller
            name="documents"
            control={control}
            render={({ field }) => (
              <SupportingDocs
                requestId={field.value?.request_id || ''}
                onDocumentUpdate={handleDocumentUpdate}
                disabled={disabled}
              />
            )}
          />
          {errors.documents && (
            <p className="text-error-500 mt-2" role="alert">
              {errors.documents.message}
            </p>
          )}
        </section>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant={Variant.OUTLINE}
            size={Size.LG}
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={Variant.PRIMARY}
            size={Size.LG}
            disabled={disabled || isSubmitting || !isEncrypted}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </ErrorBoundary>
  );
};

export default PriorAuthForm;