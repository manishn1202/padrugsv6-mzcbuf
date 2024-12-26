"""
Core implementation of the AI-powered criteria matching system for Prior Authorization Management System.
Provides secure, HIPAA-compliant matching of clinical evidence against policy criteria with enhanced validation.

Version: 1.0.0
"""

import asyncio
import logging
from typing import List, Dict, Optional
from uuid import UUID
from datetime import datetime
from functools import wraps

# Internal imports
from ai.models import ClinicalEvidence, PolicyCriteria, MatchResult
from ai.claude_client import ClaudeClient
from ai.evidence_analyzer import EvidenceAnalyzer
from core.exceptions import ValidationException
from core.logging import LOGGER

# Constants for matching configuration
MIN_MATCH_CONFIDENCE = 0.75  # Minimum confidence score for criteria match
MANDATORY_CRITERIA_THRESHOLD = 0.85  # Higher threshold for mandatory criteria
MAX_MATCHING_RETRIES = 3  # Maximum retries for failed matches
CACHE_EXPIRY_SECONDS = 3600  # Cache expiry time in seconds
CONCURRENT_MATCH_LIMIT = 5  # Maximum concurrent matching operations

def audit_log(func):
    """Decorator for HIPAA-compliant audit logging of matching operations."""
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        request_id = kwargs.get('request_id') or (args[0] if args else None)
        start_time = datetime.utcnow()
        
        try:
            result = await func(self, *args, **kwargs)
            
            # Log successful operation
            LOGGER.info(
                f"Criteria matching completed for request {request_id}",
                extra={
                    'request_id': str(request_id),
                    'duration_ms': (datetime.utcnow() - start_time).total_seconds() * 1000,
                    'confidence_score': result.overall_confidence if result else None,
                    'operation': func.__name__
                }
            )
            
            return result
            
        except Exception as e:
            # Log error with context
            LOGGER.error(
                f"Criteria matching failed for request {request_id}: {str(e)}",
                extra={
                    'request_id': str(request_id),
                    'duration_ms': (datetime.utcnow() - start_time).total_seconds() * 1000,
                    'error': str(e),
                    'operation': func.__name__
                }
            )
            raise
            
    return wrapper

class CriteriaMatcher:
    """
    Core class implementing AI-powered criteria matching with enhanced security and performance.
    Provides HIPAA-compliant matching of clinical evidence against policy criteria.
    """

    def __init__(self, claude_client: ClaudeClient, evidence_analyzer: EvidenceAnalyzer) -> None:
        """
        Initialize criteria matcher with required dependencies and security configuration.

        Args:
            claude_client: HIPAA-compliant Claude AI client
            evidence_analyzer: Evidence analysis and validation component
        """
        self._claude_client = claude_client
        self._evidence_analyzer = evidence_analyzer
        self._logger = logging.getLogger(__name__)
        self._criteria_cache: Dict[str, Dict] = {}
        
        self._logger.info("CriteriaMatcher initialized with HIPAA-compliant configuration")

    @audit_log
    async def match_criteria(
        self,
        request_id: UUID,
        evidence_list: List[ClinicalEvidence],
        criteria_list: List[PolicyCriteria]
    ) -> MatchResult:
        """
        Match clinical evidence against policy criteria with enhanced security and performance.

        Args:
            request_id: Unique request identifier
            evidence_list: List of clinical evidence to evaluate
            criteria_list: List of policy criteria to match against

        Returns:
            MatchResult containing match scores and recommendation

        Raises:
            ValidationException: If evidence or criteria validation fails
        """
        try:
            # Validate input data
            if not evidence_list or not criteria_list:
                raise ValidationException(
                    "Missing required input data",
                    {"error": "Evidence and criteria lists cannot be empty"}
                )

            # Analyze evidence quality
            evidence_quality = {}
            for evidence in evidence_list:
                quality_result = await self._evidence_analyzer.validate_evidence_quality(evidence)
                if quality_result['score'] < MIN_MATCH_CONFIDENCE:
                    self._logger.warning(
                        f"Evidence quality below threshold for {evidence.id}",
                        extra={
                            'request_id': str(request_id),
                            'evidence_id': str(evidence.id),
                            'quality_score': quality_result['score']
                        }
                    )
                evidence_quality[evidence.id] = quality_result

            # Process criteria in parallel with concurrency limit
            tasks = []
            semaphore = asyncio.Semaphore(CONCURRENT_MATCH_LIMIT)
            
            for criteria in criteria_list:
                task = self._process_criteria(
                    request_id,
                    criteria,
                    evidence_list,
                    evidence_quality,
                    semaphore
                )
                tasks.append(task)

            criteria_results = await asyncio.gather(*tasks)

            # Aggregate results
            criteria_scores = {}
            evidence_mapping = {}
            missing_criteria = []

            for result in criteria_results:
                criteria_id = result['criteria_id']
                criteria_scores[criteria_id] = result['score']
                evidence_mapping[criteria_id] = result['matching_evidence']
                
                if result['score'] < MIN_MATCH_CONFIDENCE:
                    missing_criteria.append(criteria_id)

            # Calculate overall confidence
            overall_confidence = (
                sum(criteria_scores.values()) / len(criteria_scores)
                if criteria_scores else 0.0
            )

            # Create match result
            match_result = MatchResult(
                request_id=request_id,
                overall_confidence=overall_confidence,
                criteria_scores=criteria_scores,
                evidence_mapping=evidence_mapping,
                missing_criteria=missing_criteria
            )

            # Generate recommendation
            match_result.recommendation = match_result.get_recommendation()

            return match_result

        except Exception as e:
            self._logger.error(
                f"Criteria matching failed: {str(e)}",
                extra={'request_id': str(request_id)}
            )
            raise ValidationException(
                "Failed to complete criteria matching",
                {"error": str(e)}
            )

    async def _process_criteria(
        self,
        request_id: UUID,
        criteria: PolicyCriteria,
        evidence_list: List[ClinicalEvidence],
        evidence_quality: Dict,
        semaphore: asyncio.Semaphore
    ) -> Dict:
        """
        Process individual criteria against evidence with concurrency control.

        Args:
            request_id: Request identifier
            criteria: Policy criteria to evaluate
            evidence_list: Available clinical evidence
            evidence_quality: Pre-computed evidence quality scores
            semaphore: Concurrency control semaphore

        Returns:
            Dict containing match results for the criteria
        """
        async with semaphore:
            try:
                # Check cache first
                cache_key = f"{criteria.id}:{','.join(str(e.id) for e in evidence_list)}"
                if cache_key in self._criteria_cache:
                    return self._criteria_cache[cache_key]

                # Match criteria against each evidence item
                matching_evidence = []
                best_score = 0.0

                for evidence in evidence_list:
                    # Skip low-quality evidence
                    if evidence_quality[evidence.id]['score'] < MIN_MATCH_CONFIDENCE:
                        continue

                    # Perform AI-powered matching
                    match_result = await self._claude_client.analyze_clinical_evidence(
                        evidence.clinical_data,
                        criteria.requirements,
                        str(request_id)
                    )

                    confidence_score = match_result.get('confidence_score', 0.0)
                    if confidence_score > best_score:
                        best_score = confidence_score
                        
                    if confidence_score >= (
                        MANDATORY_CRITERIA_THRESHOLD if criteria.mandatory
                        else MIN_MATCH_CONFIDENCE
                    ):
                        matching_evidence.append(evidence.id)

                result = {
                    'criteria_id': criteria.id,
                    'score': best_score,
                    'matching_evidence': matching_evidence
                }

                # Cache result
                self._criteria_cache[cache_key] = result
                return result

            except Exception as e:
                self._logger.error(
                    f"Criteria processing failed: {str(e)}",
                    extra={
                        'request_id': str(request_id),
                        'criteria_id': str(criteria.id)
                    }
                )
                raise

    def evaluate_mandatory_criteria(
        self,
        criteria_scores: Dict[UUID, float],
        criteria_list: List[PolicyCriteria]
    ) -> bool:
        """
        Evaluate if all mandatory criteria are satisfied with enhanced validation.

        Args:
            criteria_scores: Dictionary of criteria scores
            criteria_list: List of policy criteria

        Returns:
            bool indicating if all mandatory criteria are met
        """
        try:
            mandatory_criteria = [c for c in criteria_list if c.mandatory]
            
            for criteria in mandatory_criteria:
                score = criteria_scores.get(criteria.id, 0.0)
                if score < MANDATORY_CRITERIA_THRESHOLD:
                    self._logger.warning(
                        f"Mandatory criteria not met: {criteria.id}",
                        extra={
                            'criteria_id': str(criteria.id),
                            'score': score,
                            'threshold': MANDATORY_CRITERIA_THRESHOLD
                        }
                    )
                    return False

            return True

        except Exception as e:
            self._logger.error(f"Error evaluating mandatory criteria: {str(e)}")
            return False