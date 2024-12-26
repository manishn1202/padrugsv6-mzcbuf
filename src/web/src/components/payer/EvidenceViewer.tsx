import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { ClinicalEvidence, EvidenceMatch } from '../../types/clinical';

/**
 * Props interface for the EvidenceViewer component
 */
interface EvidenceViewerProps {
  /** Clinical evidence data with AI matching results */
  evidence: ClinicalEvidence;
  /** Callback when evidence item is selected */
  onEvidenceSelect: (evidence: EvidenceMatch) => void;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Determines ProgressBar variant based on confidence score
 * @param score - Confidence score (0-100)
 */
const getConfidenceVariant = (score: number): 'success' | 'warning' | 'error' => {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
};

/**
 * Sanitizes clinical text for secure display
 * @param text - Raw clinical text
 */
const sanitizeText = (text: string): string => {
  return text.replace(/<[^>]*>/g, '').trim();
};

/**
 * Renders highlighted text with proper sanitization and accessibility
 * @param text - Text content
 * @param highlights - Array of text segments to highlight
 */
const renderHighlightedText = (text: string, highlights: string[]): JSX.Element => {
  const sanitizedText = sanitizeText(text);
  const parts = sanitizedText.split(new RegExp(`(${highlights.join('|')})`, 'gi'));

  return (
    <p className="evidence-text">
      {parts.map((part, index) => {
        const isHighlighted = highlights.some(h => 
          part.toLowerCase() === h.toLowerCase()
        );
        return isHighlighted ? (
          <mark 
            key={index}
            className="evidence-highlight"
            data-testid="evidence-highlight"
          >
            {part}
          </mark>
        ) : part;
      })}
    </p>
  );
};

/**
 * EvidenceViewer component displays clinical evidence and AI-assisted matching results
 * with HIPAA-compliant security measures and accessibility features
 */
const EvidenceViewer: React.FC<EvidenceViewerProps> = React.memo(({
  evidence,
  onEvidenceSelect,
  className
}) => {
  // Memoize evidence mapping for performance
  const evidenceItems = useMemo(() => {
    return Object.entries(evidence.evidence_mapping).map(([criteriaId, match]) => ({
      criteriaId,
      matchedText: match.matched_text,
      confidence: match.confidence,
      sourceLocation: match.source_location
    }));
  }, [evidence.evidence_mapping]);

  // Handle evidence item selection with proper event handling
  const handleEvidenceSelect = useCallback((item: any) => {
    const evidenceMatch: EvidenceMatch = {
      evidenceData: {
        content: sanitizeText(item.matchedText.join(' ')),
        source: item.sourceLocation,
        timestamp: evidence.evaluated_at
      },
      matchScore: item.confidence,
      matchedCriteria: [item.criteriaId],
      highlightedText: item.matchedText,
      context: [{
        before: '',
        match: item.matchedText[0],
        after: ''
      }]
    };
    onEvidenceSelect(evidenceMatch);
  }, [evidence.evaluated_at, onEvidenceSelect]);

  return (
    <div 
      className={classNames('evidence-viewer', className)}
      data-testid="evidence-viewer"
      role="region"
      aria-label="Clinical Evidence Review"
    >
      <div className="evidence-header">
        <h2 className="evidence-title">
          Clinical Evidence Analysis
        </h2>
        <div className="evidence-meta">
          <span>Evaluated: {new Date(evidence.evaluated_at).toLocaleString()}</span>
          <span>Model: {evidence.model_version}</span>
        </div>
      </div>

      <div className="evidence-content">
        {evidenceItems.map((item, index) => (
          <Card
            key={`${item.criteriaId}-${index}`}
            variant="outlined"
            padding="medium"
            className="evidence-item"
            onClick={() => handleEvidenceSelect(item)}
            role="button"
            ariaLabel={`Evidence match with ${item.confidence}% confidence`}
          >
            <div className="evidence-item-header">
              <h3 className="evidence-criteria">
                Criteria {index + 1}
              </h3>
              <ProgressBar
                value={item.confidence}
                variant={getConfidenceVariant(item.confidence)}
                size="sm"
                showValue
                label={`Confidence score: ${item.confidence}%`}
              />
            </div>

            <div className="evidence-item-content">
              {renderHighlightedText(
                item.matchedText.join(' '), 
                item.matchedText
              )}
              <div className="evidence-source">
                Source: {item.sourceLocation}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {evidenceItems.length === 0 && (
        <div 
          className="evidence-empty"
          role="alert"
        >
          No matching evidence found
        </div>
      )}

      <style jsx>{`
        .evidence-viewer {
          padding: var(--spacing-md);
        }

        .evidence-header {
          margin-bottom: var(--spacing-lg);
        }

        .evidence-title {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-sm);
        }

        .evidence-meta {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          display: flex;
          gap: var(--spacing-md);
        }

        .evidence-content {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .evidence-item {
          cursor: pointer;
          transition: all var(--transition-duration-base);
        }

        .evidence-item:hover {
          box-shadow: var(--shadow-md);
        }

        .evidence-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-sm);
        }

        .evidence-criteria {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
        }

        .evidence-item-content {
          color: var(--color-text-primary);
        }

        .evidence-text {
          margin-bottom: var(--spacing-sm);
          line-height: var(--line-height-base);
        }

        .evidence-highlight {
          background-color: var(--color-warning-light);
          padding: 0 var(--spacing-2xs);
          border-radius: var(--border-radius-sm);
        }

        .evidence-source {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .evidence-empty {
          text-align: center;
          padding: var(--spacing-xl);
          color: var(--color-text-secondary);
          background: var(--color-background);
          border-radius: var(--border-radius-md);
        }

        @media (prefers-reduced-motion: reduce) {
          .evidence-item {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
});

// Display name for debugging
EvidenceViewer.displayName = 'EvidenceViewer';

export default EvidenceViewer;