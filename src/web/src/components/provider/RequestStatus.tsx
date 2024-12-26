import React, { useMemo } from 'react';
import classNames from 'classnames';
import { PriorAuthStatus } from '../../types/priorAuth';
import Badge from '../common/Badge';
import ProgressBar from '../common/ProgressBar';
import { Size } from '../../types/common';

/**
 * Props interface for RequestStatus component
 */
interface RequestStatusProps {
  /** Current status of the prior authorization request */
  status: PriorAuthStatus;
  /** Timestamp when request was submitted */
  submittedAt?: Date;
  /** Timestamp of last status update */
  updatedAt?: Date;
  /** AI matching confidence score */
  confidenceScore?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps PriorAuthStatus to badge variant with HIPAA-compliant colors
 */
const getStatusVariant = (status: PriorAuthStatus): 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case PriorAuthStatus.APPROVED:
      return 'success';
    case PriorAuthStatus.DENIED:
      return 'error';
    case PriorAuthStatus.PENDING_INFO:
      return 'warning';
    case PriorAuthStatus.IN_REVIEW:
    case PriorAuthStatus.SUBMITTED:
      return 'info';
    default:
      return 'info';
  }
};

/**
 * Gets human-readable status label with accessibility support
 */
const getStatusLabel = (status: PriorAuthStatus): string => {
  switch (status) {
    case PriorAuthStatus.DRAFT:
      return 'Draft Request';
    case PriorAuthStatus.SUBMITTED:
      return 'Request Submitted';
    case PriorAuthStatus.IN_REVIEW:
      return 'Under Review';
    case PriorAuthStatus.PENDING_INFO:
      return 'Additional Information Required';
    case PriorAuthStatus.APPROVED:
      return 'Request Approved';
    case PriorAuthStatus.DENIED:
      return 'Request Denied';
    default:
      return 'Unknown Status';
  }
};

/**
 * Calculates progress percentage based on status
 */
const getProgressValue = (status: PriorAuthStatus): number => {
  switch (status) {
    case PriorAuthStatus.DRAFT:
      return 0;
    case PriorAuthStatus.SUBMITTED:
      return 25;
    case PriorAuthStatus.IN_REVIEW:
      return 50;
    case PriorAuthStatus.PENDING_INFO:
      return 75;
    case PriorAuthStatus.APPROVED:
    case PriorAuthStatus.DENIED:
      return 100;
    default:
      return 0;
  }
};

/**
 * RequestStatus component displays the current status of a prior authorization request
 * with visual indicators and progress tracking.
 *
 * @version 1.0.0
 */
export const RequestStatus: React.FC<RequestStatusProps> = React.memo(({
  status,
  submittedAt,
  updatedAt,
  confidenceScore,
  className
}) => {
  // Memoize computed values
  const statusVariant = useMemo(() => getStatusVariant(status), [status]);
  const statusLabel = useMemo(() => getStatusLabel(status), [status]);
  const progressValue = useMemo(() => getProgressValue(status), [status]);

  // Calculate elapsed time if submitted
  const elapsedTime = useMemo(() => {
    if (!submittedAt) return null;
    const elapsed = updatedAt ? updatedAt.getTime() - submittedAt.getTime() : Date.now() - submittedAt.getTime();
    return Math.floor(elapsed / (1000 * 60)); // Convert to minutes
  }, [submittedAt, updatedAt]);

  const containerClasses = classNames(
    'request-status',
    'p-4 rounded-lg border border-gray-200',
    className
  );

  return (
    <div className={containerClasses} role="region" aria-label="Request Status">
      <div className="flex items-center justify-between mb-3">
        <Badge
          variant={statusVariant}
          size={Size.MD}
          className="font-medium"
          aria-label={`Status: ${statusLabel}`}
        >
          {statusLabel}
        </Badge>
        
        {confidenceScore !== undefined && (
          <span 
            className="text-sm text-gray-600"
            aria-label="AI Confidence Score"
          >
            {`${Math.round(confidenceScore)}% Match`}
          </span>
        )}
      </div>

      <ProgressBar
        value={progressValue}
        variant={statusVariant}
        size="md"
        animated={status === PriorAuthStatus.IN_REVIEW}
        label={`Request progress: ${progressValue}%`}
        showValue
      />

      {elapsedTime !== null && (
        <div 
          className="mt-2 text-sm text-gray-600"
          aria-label="Processing Time"
        >
          {`Processing Time: ${elapsedTime} minutes`}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
RequestStatus.displayName = 'RequestStatus';

export default RequestStatus;