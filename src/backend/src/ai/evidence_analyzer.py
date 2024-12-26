"""
Clinical evidence analysis component for Prior Authorization Management System.
Implements HIPAA-compliant validation and evaluation of clinical evidence quality.

Version: 1.0.0
"""

import asyncio
import logging
from typing import List, Dict, Optional, TypedDict
from datetime import datetime
from functools import cache

# Internal imports
from ai.models import ClinicalEvidence
from ai.claude_client import ClaudeClient
from core.exceptions import ValidationException
from core.security import SecurityContext

# Constants for evidence validation
MIN_EVIDENCE_QUALITY_SCORE = 0.70
REQUIRED_CLINICAL_ENTITIES = [
    "diagnosis", "medications", "lab_results", 
    "treatment_history", "contraindications", "allergies"
]
MAX_EVIDENCE_AGE_DAYS = 365
ENTITY_WEIGHTS = {
    "diagnosis": 0.25,
    "medications": 0.25,
    "lab_results": 0.20,
    "treatment_history": 0.15,
    "contraindications": 0.10,
    "allergies": 0.05
}
CACHE_TTL_SECONDS = 3600

# Type definitions
class QualityResult(TypedDict):
    score: float
    missing_entities: List[str]
    entity_scores: Dict[str, float]
    age_score: float
    recommendation: str

class EvidenceAnalyzer:
    """
    Core class for analyzing and validating clinical evidence quality with HIPAA compliance.
    Implements comprehensive validation, scoring, and security measures.
    """

    def __init__(self, claude_client: ClaudeClient, security_context: SecurityContext) -> None:
        """
        Initialize evidence analyzer with enhanced security and caching.

        Args:
            claude_client: HIPAA-compliant Claude AI client
            security_context: Security context for PHI handling
        """
        self._claude_client = claude_client
        self._security_context = security_context
        self._logger = logging.getLogger(__name__)
        self._validation_cache = {}

    async def validate_evidence_quality(self, evidence: ClinicalEvidence) -> QualityResult:
        """
        Validate evidence quality with enhanced security and caching.

        Args:
            evidence: Clinical evidence to validate

        Returns:
            QualityResult containing comprehensive quality assessment

        Raises:
            ValidationException: If evidence fails validation
        """
        try:
            # Validate evidence data model
            if not evidence.clinical_data:
                raise ValidationException(
                    "Missing clinical data",
                    {"clinical_data": "Required field is empty"}
                )

            # Check evidence age
            age_days = (datetime.utcnow() - evidence.recorded_at).days
            if age_days > MAX_EVIDENCE_AGE_DAYS:
                raise ValidationException(
                    "Evidence exceeds maximum age",
                    {"age": f"Evidence is {age_days} days old (max {MAX_EVIDENCE_AGE_DAYS})"}
                )

            # Extract clinical entities using Claude
            encrypted_data = self._security_context.encrypt(
                str(evidence.clinical_data).encode()
            )
            
            extracted_entities = await self._claude_client.extract_clinical_entities(
                encrypted_data.decode(),
                str(evidence.id)
            )

            # Validate completeness
            completeness_results = self.check_evidence_completeness(extracted_entities)

            # Calculate quality score
            quality_score = self.calculate_evidence_quality_score(
                completeness_results,
                extracted_entities,
                evidence.recorded_at
            )

            # Generate recommendation
            recommendation = "APPROVE" if quality_score >= MIN_EVIDENCE_QUALITY_SCORE else "REVIEW"

            # Prepare validation result
            result: QualityResult = {
                "score": quality_score,
                "missing_entities": completeness_results["missing"],
                "entity_scores": completeness_results["entity_scores"],
                "age_score": self._calculate_age_score(evidence.recorded_at),
                "recommendation": recommendation
            }

            self._logger.info(
                f"Evidence validation completed for {evidence.id}",
                extra={
                    "evidence_id": str(evidence.id),
                    "quality_score": quality_score,
                    "recommendation": recommendation
                }
            )

            return result

        except Exception as e:
            self._logger.error(
                f"Evidence validation failed: {str(e)}",
                extra={"evidence_id": str(evidence.id)}
            )
            raise ValidationException(
                "Failed to validate evidence quality",
                {"error": str(e)}
            )

    def check_evidence_completeness(self, extracted_entities: Dict) -> Dict:
        """
        Enhanced completeness check with weighted scoring.

        Args:
            extracted_entities: Dictionary of extracted clinical entities

        Returns:
            Dict containing completeness results and scores
        """
        present_entities = set(extracted_entities.get("entities", {}).keys())
        missing_entities = set(REQUIRED_CLINICAL_ENTITIES) - present_entities

        # Calculate entity-specific scores
        entity_scores = {}
        for entity in REQUIRED_CLINICAL_ENTITIES:
            if entity in present_entities:
                confidence = extracted_entities["entities"][entity].get("confidence", 0.0)
                entity_scores[entity] = confidence * ENTITY_WEIGHTS[entity]
            else:
                entity_scores[entity] = 0.0

        # Calculate weighted completeness score
        total_score = sum(entity_scores.values())
        max_possible = sum(ENTITY_WEIGHTS.values())
        completeness_score = total_score / max_possible if max_possible > 0 else 0.0

        return {
            "score": completeness_score,
            "missing": list(missing_entities),
            "entity_scores": entity_scores,
            "total_entities": len(present_entities),
            "required_entities": len(REQUIRED_CLINICAL_ENTITIES)
        }

    def calculate_evidence_quality_score(
        self,
        completeness_results: Dict,
        extracted_entities: Dict,
        evidence_date: datetime
    ) -> float:
        """
        Calculate comprehensive quality score with multiple factors.

        Args:
            completeness_results: Results from completeness check
            extracted_entities: Extracted clinical entities
            evidence_date: Date evidence was recorded

        Returns:
            float: Weighted quality score between 0 and 1
        """
        # Calculate age-based score
        age_score = self._calculate_age_score(evidence_date)

        # Get completeness score
        completeness_score = completeness_results["score"]

        # Calculate entity quality score
        entity_quality = 0.0
        if extracted_entities.get("confidence_scores"):
            quality_scores = extracted_entities["confidence_scores"].values()
            entity_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0

        # Weighted combination of scores
        final_score = (
            completeness_score * 0.5 +  # Completeness weight
            entity_quality * 0.3 +      # Entity quality weight
            age_score * 0.2             # Age relevance weight
        )

        return round(min(max(final_score, 0.0), 1.0), 2)

    def _calculate_age_score(self, evidence_date: datetime) -> float:
        """
        Calculate age-based relevance score.

        Args:
            evidence_date: Date evidence was recorded

        Returns:
            float: Age relevance score between 0 and 1
        """
        age_days = (datetime.utcnow() - evidence_date).days
        if age_days <= 0:
            return 1.0
        elif age_days >= MAX_EVIDENCE_AGE_DAYS:
            return 0.0
        else:
            return 1.0 - (age_days / MAX_EVIDENCE_AGE_DAYS)