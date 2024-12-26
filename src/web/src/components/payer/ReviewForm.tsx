import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form'; // @version 7.45.0
import classNames from 'classnames'; // @version 2.3.2

import Button from '../common/Button';
import RadioButton from '../common/RadioButton';
import TextArea from '../common/TextArea';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';
import { ClinicalEvidence } from '../../types/clinical';

// Confidence score thresholds for visual indicators
const CONFIDENCE_THRESHOLDS = {
  HIGH: 90,
  MEDIUM: 70,
  LOW: 50,
};

interface ReviewFormProps {
  request: PriorAuthRequest;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  isLoading: boolean;
  confidenceThresholds?: typeof CONFIDENCE_THRESHOLDS;
}

interface ReviewFormData {
  decision: PriorAuthStatus;
  notes: string;
  escalateToMD: boolean;
  escalationReason?: string;
  confidenceScore: number;
}

/**
 * Enhanced review form component for prior authorization decisions
 * Implements AI-assisted criteria matching and validation
 */
const ReviewForm: React.FC<ReviewFormProps> = ({
  request,
  onSubmit,
  isLoading,
  confidenceThresholds = CONFIDENCE_THRESHOLDS,
}) => {
  // Form state management with react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<ReviewFormData>({
    defaultValues: {
      decision: PriorAuthStatus.IN_REVIEW,
      notes: '',
      escalateToMD: false,
      confidenceScore: request.confidence_score,
    },
  });

  const [showEscalationReason, setShowEscalationReason] = useState(false);
  const watchDecision = watch('decision');
  const watchEscalateToMD = watch('escalateToMD');

  // Update escalation reason visibility
  useEffect(() => {
    setShowEscalationReason(watchEscalateToMD);
  }, [watchEscalateToMD]);

  // Get confidence level indicator
  const getConfidenceLevel = (score: number): string => {
    if (score >= confidenceThresholds.HIGH) return 'high';
    if (score >= confidenceThresholds.MEDIUM) return 'medium';
    if (score >= confidenceThresholds.LOW) return 'low';
    return 'insufficient';
  };

  // Render evidence matches with confidence indicators
  const renderEvidenceMatches = (evidence: ClinicalEvidence) => {
    return Object.entries(evidence.evidence_mapping).map(([criteria, match]) => (
      <div 
        key={criteria}
        className={classNames(
          'p-4 rounded-lg mb-4',
          {
            'bg-success-50': match.confidence >= confidenceThresholds.HIGH,
            'bg-warning-50': match.confidence >= confidenceThresholds.MEDIUM && match.confidence < confidenceThresholds.HIGH,
            'bg-error-50': match.confidence < confidenceThresholds.MEDIUM,
          }
        )}
      >
        <h4 className="font-medium mb-2">{criteria}</h4>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {match.matched_text.map((text, index) => (
              <p key={index} className="text-sm text-gray-600">{text}</p>
            ))}
          </div>
          <div className="ml-4">
            <span className="text-sm font-medium">
              {Math.round(match.confidence)}%
            </span>
          </div>
        </div>
      </div>
    ));
  };

  // Form submission handler
  const onFormSubmit = async (data: ReviewFormData) => {
    try {
      await onSubmit({
        ...data,
        confidenceScore: request.confidence_score,
      });
    } catch (error) {
      console.error('Review submission failed:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      className="space-y-6"
      aria-label="Prior Authorization Review Form"
    >
      {/* Evidence Summary */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-4">Clinical Evidence Review</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Overall Confidence Score:</span>
            <span 
              className={classNames('px-3 py-1 rounded-full text-sm font-medium', {
                'bg-success-100 text-success-800': getConfidenceLevel(request.confidence_score) === 'high',
                'bg-warning-100 text-warning-800': getConfidenceLevel(request.confidence_score) === 'medium',
                'bg-error-100 text-error-800': getConfidenceLevel(request.confidence_score) === 'low',
              })}
            >
              {Math.round(request.confidence_score)}%
            </span>
          </div>
          {renderEvidenceMatches(request.evidence)}
        </div>
      </div>

      {/* Decision Radio Buttons */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Review Decision</h3>
        <RadioButton
          name="decision"
          value={PriorAuthStatus.APPROVED}
          checked={watchDecision === PriorAuthStatus.APPROVED}
          label="Approve"
          onChange={e => setValue('decision', PriorAuthStatus.APPROVED)}
          error={errors.decision?.message}
          required
        />
        <RadioButton
          name="decision"
          value={PriorAuthStatus.DENIED}
          checked={watchDecision === PriorAuthStatus.DENIED}
          label="Deny"
          onChange={e => setValue('decision', PriorAuthStatus.DENIED)}
          error={errors.decision?.message}
          required
        />
        <RadioButton
          name="decision"
          value={PriorAuthStatus.PENDING_INFO}
          checked={watchDecision === PriorAuthStatus.PENDING_INFO}
          label="Request Additional Information"
          onChange={e => setValue('decision', PriorAuthStatus.PENDING_INFO)}
          error={errors.decision?.message}
          required
        />
      </div>

      {/* Review Notes */}
      <TextArea
        id="review-notes"
        name="notes"
        label="Review Notes"
        value={watch('notes')}
        onChange={e => setValue('notes', e.target.value)}
        error={!!errors.notes}
        errorMessage={errors.notes?.message}
        required
        rows={4}
        maxLength={1000}
      />

      {/* Escalation Checkbox */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="escalateToMD"
          {...register('escalateToMD')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="escalateToMD" className="text-sm font-medium text-gray-700">
          Escalate to Medical Director
        </label>
      </div>

      {/* Escalation Reason */}
      {showEscalationReason && (
        <TextArea
          id="escalation-reason"
          name="escalationReason"
          label="Escalation Reason"
          value={watch('escalationReason') || ''}
          onChange={e => setValue('escalationReason', e.target.value)}
          error={!!errors.escalationReason}
          errorMessage={errors.escalationReason?.message}
          required
          rows={2}
          maxLength={500}
        />
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isLoading}
          loading={isLoading}
          className="w-full sm:w-auto"
        >
          Submit Review
        </Button>
      </div>
    </form>
  );
};

export default ReviewForm;