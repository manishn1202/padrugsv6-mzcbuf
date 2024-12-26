import React, { memo, useCallback, useMemo } from 'react';
import classnames from 'classnames';
// @version sanitize-html@2.11.0
import sanitizeHtml from 'sanitize-html';
import { ClinicalEvidence, EvidenceMatch } from '../../types/clinical';
import { ComponentProps } from '../../types/common';

// HIPAA-compliant sanitization options
const SANITIZE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'span'],
  allowedAttributes: {
    'span': ['class', 'data-confidence']
  },
  allowedClasses: {
    'span': ['highlight', 'match']
  }
};

interface ClinicalCriteriaMatchProps extends ComponentProps {
  evidence: ClinicalEvidence;
  matches: EvidenceMatch[];
  onEvidenceSelect: (match: EvidenceMatch) => void;
  isLoading?: boolean;
  errorBoundaryFallback?: React.ReactNode;
}

// Custom hook for evidence matching logic
const useEvidenceMatching = (evidence: ClinicalEvidence, matches: EvidenceMatch[]) => {
  return useMemo(() => {
    const processedMatches = matches.map(match => ({
      ...match,
      // Sanitize evidence content for security
      evidenceData: {
        ...match.evidenceData,
        content: sanitizeHtml(match.evidenceData.content, SANITIZE_OPTIONS)
      },
      // Generate accessibility labels
      ariaLabel: `Evidence match with ${match.matchScore}% confidence score. ${match.matchedCriteria.length} criteria matched.`
    }));

    const confidenceStats = {
      average: matches.reduce((acc, m) => acc + m.matchScore, 0) / matches.length,
      highest: Math.max(...matches.map(m => m.matchScore)),
      lowest: Math.min(...matches.map(m => m.matchScore))
    };

    return {
      processedMatches,
      confidenceStats
    };
  }, [evidence, matches]);
};

// Error boundary component for graceful error handling
class ClinicalCriteriaMatchError extends React.Component<{
  fallback: React.ReactNode;
  children: React.ReactNode;
}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ClinicalCriteriaMatch Error:', error);
    // Implement error logging/reporting here
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const ClinicalCriteriaMatch: React.FC<ClinicalCriteriaMatchProps> = memo(({
  evidence,
  matches,
  onEvidenceSelect,
  className,
  isLoading,
  errorBoundaryFallback,
  ...props
}) => {
  const baseClassName = 'clinical-criteria-match';
  const { processedMatches, confidenceStats } = useEvidenceMatching(evidence, matches);

  const handleMatchSelect = useCallback((match: EvidenceMatch) => {
    onEvidenceSelect(match);
  }, [onEvidenceSelect]);

  const renderMatchItem = useCallback((match: EvidenceMatch & { ariaLabel: string }) => (
    <div
      key={`${match.evidenceData.source}-${match.matchScore}`}
      className={`${baseClassName}__item`}
      role="listitem"
      aria-label={match.ariaLabel}
      onClick={() => handleMatchSelect(match)}
      onKeyPress={(e) => e.key === 'Enter' && handleMatchSelect(match)}
      tabIndex={0}
    >
      <div className={`${baseClassName}__score`}>
        <span className={`${baseClassName}__score-value`}>
          {Math.round(match.matchScore)}%
        </span>
        <div 
          className={`${baseClassName}__score-bar`}
          style={{ width: `${match.matchScore}%` }}
          role="progressbar"
          aria-valuenow={match.matchScore}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className={`${baseClassName}__content`}>
        <div 
          className={`${baseClassName}__evidence`}
          dangerouslySetInnerHTML={{ __html: match.evidenceData.content }}
        />
        <div className={`${baseClassName}__metadata`}>
          <span>Source: {match.evidenceData.source}</span>
          <span>Matched Criteria: {match.matchedCriteria.length}</span>
          <time dateTime={match.evidenceData.timestamp.toISOString()}>
            {match.evidenceData.timestamp.toLocaleDateString()}
          </time>
        </div>
      </div>
    </div>
  ), [handleMatchSelect, baseClassName]);

  if (isLoading) {
    return (
      <div className={classnames(baseClassName, `${baseClassName}--loading`, className)} {...props}>
        <div className={`${baseClassName}__loading`} role="alert" aria-busy="true">
          Loading evidence matches...
        </div>
      </div>
    );
  }

  return (
    <ClinicalCriteriaMatchError fallback={errorBoundaryFallback || <div>Error loading evidence matches</div>}>
      <div 
        className={classnames(baseClassName, className)}
        {...props}
        role="region"
        aria-label="Clinical criteria matches"
      >
        <div className={`${baseClassName}__summary`}>
          <h3>Evidence Matches</h3>
          <div className={`${baseClassName}__stats`}>
            <span>Average Confidence: {Math.round(confidenceStats.average)}%</span>
            <span>Highest Match: {Math.round(confidenceStats.highest)}%</span>
            <span>Lowest Match: {Math.round(confidenceStats.lowest)}%</span>
          </div>
        </div>

        <div 
          className={`${baseClassName}__matches`}
          role="list"
        >
          {processedMatches.map(renderMatchItem)}
        </div>
      </div>
    </ClinicalCriteriaMatchError>
  );
});

ClinicalCriteriaMatch.displayName = 'ClinicalCriteriaMatch';

export default ClinicalCriteriaMatch;