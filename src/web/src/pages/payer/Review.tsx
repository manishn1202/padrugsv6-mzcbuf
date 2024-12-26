import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // @version 6.11.0
import ReviewForm from '../../components/payer/ReviewForm';
import ClinicalCriteriaMatch from '../../components/payer/ClinicalCriteriaMatch';
import EvidenceViewer from '../../components/payer/EvidenceViewer';
import useQuery from '../../hooks/useQuery';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';
import { EvidenceMatch } from '../../types/clinical';
import { ApiError } from '../../types/api';
import { ROLE_PERMISSIONS, TOKEN_CONFIG } from '../../config/auth';
import { API_ENDPOINTS } from '../../config/api';

/**
 * Props interface for the ReviewPage component
 */
interface ReviewPageProps {
  /** Optional initial request data */
  initialRequest?: PriorAuthRequest;
}

/**
 * ReviewPage component implements the payer review interface for evaluating
 * prior authorization requests with AI-assisted criteria matching.
 * Implements HIPAA compliance and comprehensive audit logging.
 */
const ReviewPage: React.FC<ReviewPageProps> = ({ initialRequest }) => {
  // Router hooks
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  // State management
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceMatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch request data with caching and auto-refresh
  const {
    data: request,
    loading: isLoading,
    error: requestError,
    refetch: refetchRequest
  } = useQuery<PriorAuthRequest>(
    `${API_ENDPOINTS.PRIOR_AUTH.BASE}/${requestId}`,
    {
      enabled: !!requestId,
      initialData: initialRequest,
      cacheEnabled: true,
      refetchInterval: 30000, // Refresh every 30 seconds
      cacheKey: `pa-request-${requestId}`
    }
  );

  // Memoize evidence matches for performance
  const evidenceMatches = useMemo(() => {
    if (!request?.evidence) return [];
    return Object.entries(request.evidence.evidence_mapping).map(([criteria, match]) => ({
      evidenceData: {
        content: match.matched_text.join(' '),
        source: match.source_location,
        timestamp: new Date(request.evidence.evaluated_at)
      },
      matchScore: match.confidence,
      matchedCriteria: [criteria],
      highlightedText: match.matched_text,
      context: [{
        before: '',
        match: match.matched_text[0],
        after: ''
      }]
    }));
  }, [request?.evidence]);

  // Handle evidence selection
  const handleEvidenceSelect = useCallback((evidence: EvidenceMatch) => {
    setSelectedEvidence(evidence);
  }, []);

  // Handle review submission with audit logging
  const handleDecisionSubmit = useCallback(async (decision: {
    status: PriorAuthStatus;
    notes: string;
    escalateToMD: boolean;
    escalationReason?: string;
  }) => {
    if (!request || !requestId) return;

    try {
      setIsSubmitting(true);

      // Create audit log entry
      const auditData = {
        requestId,
        reviewerId: localStorage.getItem(TOKEN_CONFIG.ID_TOKEN_KEY),
        action: 'REVIEW_SUBMISSION',
        decision: decision.status,
        timestamp: new Date().toISOString(),
        evidenceUsed: selectedEvidence ? [selectedEvidence.evidenceData.source] : []
      };

      // Submit decision
      await Promise.all([
        // Update request status
        fetch(`${API_ENDPOINTS.PRIOR_AUTH.UPDATE.replace(':id', requestId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY)}`
          },
          body: JSON.stringify({
            status: decision.status,
            notes: decision.notes,
            escalated: decision.escalateToMD,
            escalationReason: decision.escalationReason,
            evidenceUsed: selectedEvidence,
            confidence_score: request.confidence_score
          })
        }),
        // Create audit log
        fetch(API_ENDPOINTS.MONITORING.METRICS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY)}`
          },
          body: JSON.stringify(auditData)
        })
      ]);

      // Navigate back to queue on success
      navigate('/payer/queue');

    } catch (error) {
      console.error('Review submission failed:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [request, requestId, selectedEvidence, navigate]);

  // Effect for session timeout monitoring
  useEffect(() => {
    const sessionTimeout = setTimeout(() => {
      // Redirect to login on session expiry
      navigate('/login');
    }, TOKEN_CONFIG.TOKEN_ROTATION.ROTATION_INTERVAL * 1000);

    return () => clearTimeout(sessionTimeout);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="review-page__loading" role="alert" aria-busy="true">
        Loading request details...
      </div>
    );
  }

  if (requestError || !request) {
    return (
      <div className="review-page__error" role="alert">
        {(requestError as ApiError)?.message || 'Error loading request'}
      </div>
    );
  }

  return (
    <div 
      className="review-page"
      role="main"
      aria-label="Prior Authorization Review"
    >
      <header className="review-page__header">
        <h1>Review Request #{requestId}</h1>
        <div className="review-page__meta">
          <span>Submitted: {new Date(request.submitted_at).toLocaleString()}</span>
          <span>Provider: {request.provider_id}</span>
          <span>Patient MRN: {request.patient_mrn}</span>
        </div>
      </header>

      <div className="review-page__content">
        <div className="review-page__evidence">
          <ClinicalCriteriaMatch
            evidence={request.evidence}
            matches={evidenceMatches}
            onEvidenceSelect={handleEvidenceSelect}
            className="review-page__criteria-match"
          />
          
          <EvidenceViewer
            evidence={request.evidence}
            onEvidenceSelect={handleEvidenceSelect}
            className="review-page__evidence-viewer"
          />
        </div>

        <div className="review-page__review-form">
          <ReviewForm
            request={request}
            onSubmit={handleDecisionSubmit}
            isLoading={isSubmitting}
          />
        </div>
      </div>

      <style jsx>{`
        .review-page {
          padding: var(--spacing-lg);
          max-width: 1200px;
          margin: 0 auto;
        }

        .review-page__header {
          margin-bottom: var(--spacing-xl);
        }

        .review-page__meta {
          display: flex;
          gap: var(--spacing-md);
          color: var(--color-text-secondary);
        }

        .review-page__content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: var(--spacing-lg);
        }

        .review-page__evidence {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        @media (max-width: 992px) {
          .review-page__content {
            grid-template-columns: 1fr;
          }
        }

        .review-page__loading,
        .review-page__error {
          padding: var(--spacing-xl);
          text-align: center;
          background: var(--color-background);
          border-radius: var(--border-radius-lg);
        }
      `}</style>
    </div>
  );
};

export default ReviewPage;