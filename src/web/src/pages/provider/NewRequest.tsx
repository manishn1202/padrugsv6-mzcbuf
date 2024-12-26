import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { ErrorBoundary } from 'react-error-boundary';

import PriorAuthForm from '../../components/provider/PriorAuthForm';
import { createPriorAuth } from '../../lib/api/priorAuth';
import { useNotification } from '../../hooks/useNotification';
import { PriorAuthRequest } from '../../types/priorAuth';
import { isApiError } from '../../types/api';

/**
 * Provider portal page component for creating new prior authorization requests.
 * Implements HIPAA-compliant form submission with EMR integration and secure document handling.
 */
const NewRequest: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  // Component state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);

  /**
   * Handles form submission with validation and error handling
   */
  const handleSubmit = useCallback(async (formData: PriorAuthRequest) => {
    try {
      setIsSubmitting(true);
      setSubmissionProgress(25);

      // Log submission attempt for audit trail
      console.info('Initiating PA request submission:', {
        provider_id: formData.provider_id,
        patient_mrn: formData.patient_mrn,
        drug_code: formData.drug.drug_code,
        timestamp: new Date().toISOString()
      });

      setSubmissionProgress(50);

      // Submit request through API
      const response = await createPriorAuth(formData);

      setSubmissionProgress(75);

      // Update cache with new request
      queryClient.invalidateQueries(['priorAuth', 'list']);
      queryClient.setQueryData(['priorAuth', response.request_id], response);

      setSubmissionProgress(100);

      // Show success notification
      showNotification({
        type: 'success',
        title: 'Prior Authorization Submitted',
        message: `Request ID: ${response.request_id}`,
        duration: 5000
      });

      // Navigate to request details
      navigate(`/requests/${response.request_id}`);

    } catch (error) {
      // Handle API errors
      if (isApiError(error)) {
        showNotification({
          type: 'error',
          title: 'Submission Failed',
          message: error.message,
          duration: 7000
        });
        console.error('PA request submission failed:', error);
      } else {
        showNotification({
          type: 'error',
          title: 'System Error',
          message: 'An unexpected error occurred. Please try again.',
          duration: 7000
        });
        console.error('Unexpected error during PA submission:', error);
      }
    } finally {
      setIsSubmitting(false);
      setSubmissionProgress(0);
    }
  }, [navigate, queryClient, showNotification]);

  /**
   * Handles form validation errors
   */
  const handleValidationError = useCallback((error: Error) => {
    showNotification({
      type: 'warning',
      title: 'Validation Error',
      message: error.message,
      duration: 5000
    });
    console.warn('PA form validation error:', error);
  }, [showNotification]);

  /**
   * Handles component errors
   */
  const handleError = useCallback((error: Error) => {
    console.error('NewRequest component error:', error);
    showNotification({
      type: 'error',
      title: 'System Error',
      message: 'An error occurred loading the form. Please refresh the page.',
      duration: 0 // Persist until dismissed
    });
  }, [showNotification]);

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div className="p-4 text-error-500" role="alert">
          <h2 className="text-lg font-semibold mb-2">Error Loading Form</h2>
          <p>{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 text-primary-500 hover:text-primary-700"
          >
            Refresh Page
          </button>
        </div>
      )}
      onError={handleError}
    >
      <div 
        className="max-w-4xl mx-auto py-8 px-4"
        data-testid="new-request-page"
      >
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            New Prior Authorization Request
          </h1>
          <p className="mt-2 text-gray-600">
            Submit a new prior authorization request with required clinical documentation
          </p>
        </header>

        <PriorAuthForm
          onSubmit={handleSubmit}
          onValidationError={handleValidationError}
          disabled={isSubmitting}
          progress={submissionProgress}
          payerId="UHC" // Default to UnitedHealthcare per requirements
        />
      </div>
    </ErrorBoundary>
  );
};

export default NewRequest;