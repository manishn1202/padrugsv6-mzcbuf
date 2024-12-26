import React, { useState, useCallback } from 'react';
import classNames from 'classnames'; // @version 2.3.2
import { debounce } from 'lodash'; // @version 4.17.21

import Button from '../common/Button';
import TextArea from '../common/TextArea';
import RadioButton from '../common/RadioButton';
import { Variant } from '../../types/common';

/**
 * Enum for possible PA decision types
 */
enum DecisionType {
  APPROVE = 'approve',
  REQUEST_INFO = 'request_info',
  DENY = 'deny',
  ESCALATE = 'escalate'
}

/**
 * Interface for decision data structure
 */
interface DecisionData {
  type: DecisionType;
  notes: string;
  requestId: string;
  timestamp: string;
  reviewerId: string;
}

/**
 * Props interface for DecisionPanel component
 */
interface DecisionPanelProps {
  requestId: string;
  onSubmit: (decision: DecisionData) => Promise<void>;
  isLoading?: boolean;
  className?: string;
  onError?: (error: Error) => void;
  auditLogger?: AuditLogger;
}

/**
 * A secure and accessible panel component for payer reviewers to make and submit
 * prior authorization decisions. Implements HIPAA-compliant data handling.
 */
const DecisionPanel: React.FC<DecisionPanelProps> = ({
  requestId,
  onSubmit,
  isLoading = false,
  className,
  onError,
  auditLogger
}) => {
  // Component state
  const [selectedDecision, setSelectedDecision] = useState<DecisionType | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Maximum retry attempts for submission
  const MAX_RETRIES = 3;
  // Maximum length for notes field
  const MAX_NOTES_LENGTH = 1000;

  /**
   * Validates the decision form data
   * @returns boolean indicating if validation passed
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedDecision) {
      newErrors.decision = 'A decision selection is required';
    }

    if (!notes.trim()) {
      newErrors.notes = 'Notes are required to document the decision';
    } else if (notes.length > MAX_NOTES_LENGTH) {
      newErrors.notes = `Notes must not exceed ${MAX_NOTES_LENGTH} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles decision radio selection changes
   */
  const handleDecisionChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value as DecisionType;
    setSelectedDecision(value);
    setErrors(prev => ({ ...prev, decision: '' }));

    // Log decision selection for audit
    auditLogger?.logUserAction({
      action: 'DECISION_SELECTED',
      requestId,
      details: { decisionType: value }
    });
  }, [requestId, auditLogger]);

  /**
   * Handles notes text changes with debounce
   */
  const handleNotesChange = debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setNotes(value);
    setErrors(prev => ({ ...prev, notes: '' }));
  }, 300);

  /**
   * Handles secure form submission with retry logic
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm() || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Construct decision data
      const decisionData: DecisionData = {
        type: selectedDecision!,
        notes: notes.trim(),
        requestId,
        timestamp: new Date().toISOString(),
        reviewerId: 'current-reviewer-id' // Should be obtained from auth context
      };

      // Log submission attempt
      auditLogger?.logUserAction({
        action: 'DECISION_SUBMIT_ATTEMPT',
        requestId,
        details: { decisionType: selectedDecision }
      });

      // Submit decision
      await onSubmit(decisionData);

      // Log successful submission
      auditLogger?.logUserAction({
        action: 'DECISION_SUBMIT_SUCCESS',
        requestId,
        details: { decisionType: selectedDecision }
      });

      // Reset form
      setSelectedDecision(null);
      setNotes('');
      setRetryCount(0);

    } catch (error) {
      // Handle submission error
      const err = error as Error;
      
      if (retryCount < MAX_RETRIES) {
        // Retry submission
        setRetryCount(prev => prev + 1);
        setTimeout(() => handleSubmit(event), 1000 * retryCount);
      } else {
        // Log failure after max retries
        auditLogger?.logUserAction({
          action: 'DECISION_SUBMIT_FAILURE',
          requestId,
          details: { error: err.message }
        });
        
        onError?.(err);
        setErrors(prev => ({
          ...prev,
          submit: 'Failed to submit decision. Please try again.'
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={classNames(
        'p-4 bg-white rounded-lg shadow',
        { 'opacity-75 pointer-events-none': isSubmitting },
        className
      )}
      aria-label="Prior Authorization Decision Form"
      aria-busy={isSubmitting}
    >
      {/* Decision Options */}
      <div role="radiogroup" aria-label="Decision options">
        <RadioButton
          name="decision"
          value={DecisionType.APPROVE}
          checked={selectedDecision === DecisionType.APPROVE}
          onChange={handleDecisionChange}
          label="Approve"
          error={errors.decision}
          required
          disabled={isSubmitting}
        />
        <RadioButton
          name="decision"
          value={DecisionType.REQUEST_INFO}
          checked={selectedDecision === DecisionType.REQUEST_INFO}
          onChange={handleDecisionChange}
          label="Request Additional Information"
          error={errors.decision}
          required
          disabled={isSubmitting}
        />
        <RadioButton
          name="decision"
          value={DecisionType.DENY}
          checked={selectedDecision === DecisionType.DENY}
          onChange={handleDecisionChange}
          label="Deny"
          error={errors.decision}
          required
          disabled={isSubmitting}
        />
        <RadioButton
          name="decision"
          value={DecisionType.ESCALATE}
          checked={selectedDecision === DecisionType.ESCALATE}
          onChange={handleDecisionChange}
          label="Escalate to MD"
          error={errors.decision}
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Decision Notes */}
      <div className="mt-4">
        <TextArea
          id="decision-notes"
          name="notes"
          label="Decision Notes"
          value={notes}
          onChange={handleNotesChange}
          error={!!errors.notes}
          errorMessage={errors.notes}
          placeholder="Enter detailed notes about your decision..."
          required
          maxLength={MAX_NOTES_LENGTH}
          rows={4}
          disabled={isSubmitting}
        />
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="mt-2 text-error-600 text-sm" role="alert">
          {errors.submit}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex justify-end space-x-3">
        <Button
          type="button"
          variant={Variant.OUTLINE}
          onClick={() => {
            setSelectedDecision(null);
            setNotes('');
            setErrors({});
          }}
          disabled={isSubmitting}
          ariaLabel="Clear decision form"
        >
          Clear
        </Button>
        <Button
          type="submit"
          variant={Variant.PRIMARY}
          loading={isSubmitting}
          disabled={isSubmitting}
          ariaLabel="Submit decision"
        >
          Submit Decision
        </Button>
      </div>
    </form>
  );
};

export default DecisionPanel;