import React, { useState, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import Card from '../common/Card';
import { ClinicalEvidence, EvidenceMatch } from '../../types/clinical';
import { PriorAuthRequest } from '../../types/priorAuth';

// Version comments for third-party imports
// react@18.2.0
// classnames@2.3.2

/**
 * Interface for evidence details with confidence scoring
 */
interface EvidenceDetail {
  matched_text: string[];
  confidence: number;
  source_location: string;
}

/**
 * Interface for audit information tracking
 */
interface AuditInfo {
  timestamp: Date;
  user_id: string;
  action: 'override' | 'validate' | 'reject';
  reason?: string;
}

/**
 * Props interface for the PolicyCriteria component
 */
interface PolicyCriteriaProps {
  /** Prior authorization request with security context */
  request: PriorAuthRequest;
  /** Callback for criteria updates with audit trail */
  onCriteriaUpdate: (criteriaId: string, matched: boolean, auditInfo: AuditInfo) => void;
  /** Security context for HIPAA compliance */
  securityContext: {
    user_id: string;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Secure component for displaying and managing drug policy criteria matches
 * Implements HIPAA-compliant evidence display with AI-assisted matching
 */
const PolicyCriteria: React.FC<PolicyCriteriaProps> = React.memo(({
  request,
  onCriteriaUpdate,
  securityContext
}) => {
  // State for expanded criteria items
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  
  // State for audit trail
  const [auditLog, setAuditLog] = useState<AuditInfo[]>([]);

  // Calculate confidence score thresholds
  const CONFIDENCE_THRESHOLDS = {
    HIGH: 90,
    MEDIUM: 70,
    LOW: 50
  };

  /**
   * Securely formats evidence text for display
   * Implements PHI redaction and security controls
   */
  const formatEvidenceText = useCallback((evidence: EvidenceDetail): string => {
    if (!securityContext.permissions.includes('view_clinical_evidence')) {
      return '[REDACTED]';
    }
    return evidence.matched_text.join(' ');
  }, [securityContext]);

  /**
   * Generates confidence score indicator with accessibility support
   */
  const renderConfidenceIndicator = useCallback((score: number): JSX.Element => {
    const colorClass = score >= CONFIDENCE_THRESHOLDS.HIGH ? 'text-success' :
      score >= CONFIDENCE_THRESHOLDS.MEDIUM ? 'text-warning' : 'text-error';

    return (
      <div 
        className={classNames('confidence-indicator', colorClass)}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="score">{score}%</span>
        <div className="progress-bar" style={{ width: `${score}%` }} />
      </div>
    );
  }, []);

  /**
   * Handles secure criteria override with audit logging
   */
  const handleCriteriaOverride = useCallback((
    criteriaId: string,
    matched: boolean,
    reason: string
  ) => {
    if (!securityContext.permissions.includes('override_criteria')) {
      console.error('Unauthorized criteria override attempt');
      return;
    }

    const auditInfo: AuditInfo = {
      timestamp: new Date(),
      user_id: securityContext.user_id,
      action: matched ? 'validate' : 'reject',
      reason
    };

    setAuditLog(prev => [...prev, auditInfo]);
    onCriteriaUpdate(criteriaId, matched, auditInfo);
  }, [securityContext, onCriteriaUpdate]);

  /**
   * Renders individual criteria item with evidence
   */
  const renderCriteriaItem = useCallback((
    criteriaId: string,
    label: string,
    evidence: Record<string, EvidenceDetail>
  ): JSX.Element => {
    const isExpanded = expandedCriteria.has(criteriaId);
    const avgConfidence = Object.values(evidence).reduce(
      (sum, e) => sum + e.confidence, 0
    ) / Object.keys(evidence).length;

    return (
      <Card
        key={criteriaId}
        className="criteria-item"
        variant="outlined"
        padding="medium"
        role="region"
        ariaLabel={`Policy criteria: ${label}`}
      >
        <div className="criteria-header">
          <h3>{label}</h3>
          {renderConfidenceIndicator(avgConfidence)}
          <button
            className="expand-button"
            onClick={() => setExpandedCriteria(prev => {
              const next = new Set(prev);
              isExpanded ? next.delete(criteriaId) : next.add(criteriaId);
              return next;
            })}
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Collapse' : 'Expand'} Evidence
          </button>
        </div>

        {isExpanded && (
          <div className="evidence-details">
            {Object.entries(evidence).map(([key, detail]) => (
              <div key={key} className="evidence-item">
                <p className="evidence-text">
                  {formatEvidenceText(detail)}
                </p>
                <p className="evidence-source">
                  Source: {detail.source_location}
                </p>
              </div>
            ))}

            {securityContext.permissions.includes('override_criteria') && (
              <div className="override-controls">
                <button
                  onClick={() => handleCriteriaOverride(criteriaId, true, 'Manual validation')}
                  className="validate-button"
                >
                  Validate Match
                </button>
                <button
                  onClick={() => handleCriteriaOverride(criteriaId, false, 'Insufficient evidence')}
                  className="reject-button"
                >
                  Reject Match
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }, [expandedCriteria, securityContext, handleCriteriaOverride, renderConfidenceIndicator, formatEvidenceText]);

  // Calculate overall match statistics
  const matchStats = useMemo(() => {
    const evidence = request.evidence;
    const totalCriteria = Object.keys(evidence.evidence_mapping).length;
    const matchedCriteria = Object.values(evidence.evidence_mapping)
      .filter(e => e.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM).length;

    return {
      totalCriteria,
      matchedCriteria,
      overallConfidence: evidence.confidence_score
    };
  }, [request.evidence, CONFIDENCE_THRESHOLDS.MEDIUM]);

  return (
    <div className="policy-criteria-container">
      <Card className="criteria-summary" padding="medium">
        <h2>Policy Criteria Evaluation</h2>
        <div className="summary-stats">
          <p>Matched Criteria: {matchStats.matchedCriteria} / {matchStats.totalCriteria}</p>
          <p>Overall Confidence: {renderConfidenceIndicator(matchStats.overallConfidence)}</p>
        </div>
      </Card>

      <div className="criteria-list">
        {Object.entries(request.evidence.evidence_mapping).map(([criteriaId, evidence]) => (
          renderCriteriaItem(
            criteriaId,
            `Criteria ${criteriaId}`,
            evidence
          )
        ))}
      </div>

      {auditLog.length > 0 && (
        <Card className="audit-trail" padding="medium">
          <h3>Audit Trail</h3>
          <ul>
            {auditLog.map((entry, index) => (
              <li key={index}>
                {entry.timestamp.toLocaleString()}: {entry.action} by {entry.user_id}
                {entry.reason && ` - ${entry.reason}`}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
});

PolicyCriteria.displayName = 'PolicyCriteria';

export default PolicyCriteria;