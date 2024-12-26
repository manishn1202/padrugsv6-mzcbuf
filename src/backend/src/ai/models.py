"""
Core data models for the AI-powered prior authorization system.
Provides Pydantic models with validation logic for clinical evidence, policy criteria, and matching results.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union, Literal
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, validator, root_validator  # pydantic v2.0+

# Global constants for validation
MIN_CONFIDENCE_SCORE = 0.75  # Minimum acceptable confidence score for matches
MAX_EVIDENCE_AGE_DAYS = 365  # Maximum age of clinical evidence in days
VALID_SOURCE_TYPES = Literal["EMR", "DOCUMENT", "MANUAL"]
VALID_CRITERIA_TYPES = Literal["CLINICAL", "ADMINISTRATIVE", "FORMULARY"]


class ClinicalEvidence(BaseModel):
    """
    Pydantic model representing clinical evidence extracted from documents or EMR.
    Includes validation logic for evidence age and confidence scoring.
    """
    id: UUID = Field(default_factory=uuid4)
    source_type: VALID_SOURCE_TYPES
    source_id: str = Field(..., min_length=1, max_length=255)
    clinical_data: Dict[str, Union[str, int, float, bool, Dict, List]] = Field(...)
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    metadata: Optional[Dict[str, Union[str, int, float, bool]]] = Field(default_factory=dict)

    @root_validator(pre=True)
    def initialize_evidence(cls, values: Dict) -> Dict:
        """Initialize and validate clinical evidence instance."""
        if "id" not in values:
            values["id"] = uuid4()
        if "recorded_at" not in values:
            values["recorded_at"] = datetime.utcnow()
        if "metadata" not in values:
            values["metadata"] = {}
        if not values.get("clinical_data"):
            raise ValueError("clinical_data is required and cannot be empty")
        return values

    @validator("recorded_at")
    def validate_age(cls, v: datetime) -> datetime:
        """Validate evidence age against maximum allowed age."""
        age_days = (datetime.utcnow() - v).days
        if age_days > MAX_EVIDENCE_AGE_DAYS:
            raise ValueError(
                f"Evidence age ({age_days} days) exceeds maximum allowed age "
                f"({MAX_EVIDENCE_AGE_DAYS} days)"
            )
        return v

    @validator("confidence_score")
    def validate_confidence(cls, v: Optional[float]) -> Optional[float]:
        """Validate confidence score range and minimum threshold."""
        if v is not None:
            if v < MIN_CONFIDENCE_SCORE:
                raise ValueError(
                    f"Confidence score {v} is below minimum threshold "
                    f"of {MIN_CONFIDENCE_SCORE}"
                )
        return v


class PolicyCriteria(BaseModel):
    """
    Pydantic model representing policy requirements for prior authorization.
    Includes validation logic for criteria weights and rules.
    """
    id: UUID = Field(default_factory=uuid4)
    criteria_type: VALID_CRITERIA_TYPES
    description: str = Field(..., min_length=1, max_length=1000)
    requirements: Dict[str, Union[str, Dict, List]] = Field(...)
    mandatory: bool = Field(default=True)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)
    validation_rules: Optional[Dict[str, Union[str, Dict]]] = Field(default_factory=dict)

    @root_validator(pre=True)
    def initialize_criteria(cls, values: Dict) -> Dict:
        """Initialize and validate policy criteria instance."""
        if "id" not in values:
            values["id"] = uuid4()
        if "weight" not in values:
            values["weight"] = 1.0
        if "validation_rules" not in values:
            values["validation_rules"] = {}
        if not values.get("requirements"):
            raise ValueError("requirements is required and cannot be empty")
        return values

    @validator("weight")
    def validate_weight(cls, v: float) -> float:
        """Validate and normalize weight value to [0.0, 1.0] range."""
        if v < 0.0:
            return 0.0
        if v > 1.0:
            return 1.0
        return v

    @validator("validation_rules")
    def validate_rules(cls, v: Optional[Dict]) -> Optional[Dict]:
        """Validate rule schema and structure."""
        if v is None:
            return {}
        
        valid_rule_types = {"regex", "range", "enum", "dependency"}
        for rule_name, rule_def in v.items():
            if isinstance(rule_def, dict):
                rule_type = rule_def.get("type")
                if rule_type not in valid_rule_types:
                    raise ValueError(f"Invalid rule type: {rule_type}")
                if "value" not in rule_def:
                    raise ValueError(f"Missing value for rule: {rule_name}")
        return v


class MatchResult(BaseModel):
    """
    Pydantic model representing the result of matching clinical evidence against policy criteria.
    Includes validation logic and recommendation generation.
    """
    id: UUID = Field(default_factory=uuid4)
    request_id: UUID = Field(...)
    overall_confidence: float = Field(..., ge=0.0, le=1.0)
    criteria_scores: Dict[UUID, float] = Field(...)
    evidence_mapping: Dict[UUID, List[UUID]] = Field(...)
    missing_criteria: List[UUID] = Field(default_factory=list)
    recommendation: Optional[Literal["APPROVE", "DENY", "REVIEW"]] = None
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

    @root_validator(pre=True)
    def initialize_match(cls, values: Dict) -> Dict:
        """Initialize and validate match result instance."""
        if "id" not in values:
            values["id"] = uuid4()
        if "evaluated_at" not in values:
            values["evaluated_at"] = datetime.utcnow()
        if "missing_criteria" not in values:
            values["missing_criteria"] = []
        
        # Calculate overall confidence if not provided
        if "overall_confidence" not in values and "criteria_scores" in values:
            scores = values["criteria_scores"].values()
            values["overall_confidence"] = sum(scores) / len(scores) if scores else 0.0
            
        return values

    @validator("overall_confidence", "criteria_scores")
    def validate_confidence(cls, v: Union[float, Dict[UUID, float]]) -> Union[float, Dict[UUID, float]]:
        """Validate overall and individual criteria confidence scores."""
        if isinstance(v, float):
            if v < 0.0 or v > 1.0:
                raise ValueError("Confidence score must be between 0.0 and 1.0")
        elif isinstance(v, dict):
            for score in v.values():
                if not isinstance(score, float) or score < 0.0 or score > 1.0:
                    raise ValueError("All criteria scores must be floats between 0.0 and 1.0")
        return v

    def get_recommendation(self) -> Literal["APPROVE", "DENY", "REVIEW"]:
        """Generate recommendation based on match results and confidence scores."""
        # Automatic denial if any mandatory criteria are missing
        if self.missing_criteria:
            return "DENY"
        
        # Check if overall confidence meets minimum threshold
        if self.overall_confidence >= MIN_CONFIDENCE_SCORE:
            # Verify all individual criteria meet minimum threshold
            if all(score >= MIN_CONFIDENCE_SCORE for score in self.criteria_scores.values()):
                return "APPROVE"
        
        # Default to manual review if automatic approval/denial criteria not met
        return "REVIEW"