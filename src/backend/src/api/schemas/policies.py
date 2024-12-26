"""
Pydantic schema models for drug policy and prior authorization criteria management.
Implements comprehensive validation, versioning, and AI-assisted matching capabilities.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, constr  # version: 2.0+
from pydantic.types import Json  # version: 2.0+

from api.schemas.responses import BaseResponse
from db.models.policies import DrugPolicy

class PolicyCriterionBase(BaseModel):
    """
    Base schema model for policy criterion data with enhanced validation rules.
    """
    description: constr(min_length=10, max_length=1000) = Field(
        ...,
        description="Detailed description of the criterion requirement"
    )
    weight: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Criterion weight for scoring (0.0 to 1.0)"
    )
    required: bool = Field(
        default=True,
        description="Whether this criterion is mandatory"
    )
    validation_rules: Dict = Field(
        ...,
        description="JSON schema for criterion validation"
    )
    criterion_type: str = Field(
        ...,
        description="Type of criterion (e.g., clinical, administrative)"
    )
    evidence_requirements: Json = Field(
        ...,
        description="Required evidence documentation schema"
    )
    ai_validation_config: Dict = Field(
        default_factory=dict,
        description="AI-specific validation configuration"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Patient must have failed at least two preferred alternatives",
                "weight": 0.8,
                "required": True,
                "validation_rules": {
                    "min_failures": 2,
                    "timeframe_months": 12
                },
                "criterion_type": "clinical",
                "evidence_requirements": {
                    "document_types": ["clinical_note", "prescription_history"],
                    "required_fields": ["medication", "start_date", "end_date", "reason_for_discontinuation"]
                }
            }
        }

class DrugPolicyBase(BaseModel):
    """
    Base schema model for drug policy data with versioning support.
    """
    drug_code: constr(min_length=5, max_length=50) = Field(
        ...,
        description="Unique drug identifier code"
    )
    name: constr(min_length=3, max_length=255) = Field(
        ...,
        description="Drug policy name"
    )
    version: constr(regex=r"^\d+\.\d+\.\d+$") = Field(
        ...,
        description="Semantic version of the policy"
    )
    active: bool = Field(
        default=True,
        description="Whether this policy version is active"
    )
    effective_date: datetime = Field(
        ...,
        description="Policy effective date"
    )
    expiry_date: Optional[datetime] = Field(
        None,
        description="Optional policy expiration date"
    )
    formulary_status: str = Field(
        ...,
        description="Drug formulary status"
    )
    coverage_rules: Dict = Field(
        ...,
        description="Coverage and reimbursement rules"
    )
    version_metadata: Dict = Field(
        default_factory=dict,
        description="Version control metadata"
    )
    previous_versions: List[str] = Field(
        default_factory=list,
        description="List of previous version numbers"
    )
    external_mappings: Dict = Field(
        default_factory=dict,
        description="External system identifier mappings"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "drug_code": "J0178",
                "name": "Eylea Prior Authorization Policy",
                "version": "1.0.0",
                "active": True,
                "effective_date": "2024-01-01T00:00:00Z",
                "formulary_status": "preferred",
                "coverage_rules": {
                    "quantity_limit": 2,
                    "days_supply": 28,
                    "refills": 5
                }
            }
        }

class PolicyMatchResultResponse(BaseResponse):
    """
    Enhanced schema for policy matching result response with AI insights.
    """
    match_id: UUID = Field(
        ...,
        description="Unique identifier for the match result"
    )
    policy_id: UUID = Field(
        ...,
        description="Associated drug policy ID"
    )
    request_id: UUID = Field(
        ...,
        description="Prior authorization request ID"
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="AI confidence score for the match"
    )
    evidence_mapping: Dict = Field(
        ...,
        description="Mapping of criteria to supporting evidence"
    )
    missing_criteria: Optional[Dict] = Field(
        None,
        description="Details of unmet criteria"
    )
    recommended_decision: str = Field(
        ...,
        description="AI-recommended decision"
    )
    evaluated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of evaluation"
    )
    ai_analysis_details: Dict = Field(
        ...,
        description="Detailed AI analysis results"
    )
    alternative_recommendations: List[Dict] = Field(
        default_factory=list,
        description="Alternative policy recommendations"
    )
    compliance_validation: Dict = Field(
        ...,
        description="HIPAA compliance validation results"
    )
    audit_metadata: Dict = Field(
        default_factory=dict,
        description="Audit trail metadata"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "match_id": "123e4567-e89b-12d3-a456-426614174000",
                "policy_id": "123e4567-e89b-12d3-a456-426614174001",
                "request_id": "123e4567-e89b-12d3-a456-426614174002",
                "confidence_score": 0.95,
                "evidence_mapping": {
                    "criterion_1": {
                        "evidence_id": "doc123",
                        "confidence": 0.98
                    }
                },
                "recommended_decision": "APPROVE",
                "ai_analysis_details": {
                    "key_factors": ["prior_therapy_failure", "diagnosis_match"],
                    "confidence_breakdown": {"clinical": 0.96, "administrative": 0.94}
                }
            }
        }

# Export schema models
__all__ = [
    'PolicyCriterionBase',
    'DrugPolicyBase',
    'PolicyMatchResultResponse'
]