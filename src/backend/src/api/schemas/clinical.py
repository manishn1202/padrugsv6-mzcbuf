"""
Pydantic schemas for clinical data validation and serialization with HIPAA compliance and FHIR validation.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

# pydantic v2.0+
from pydantic import BaseModel, Field, validator, model_validator

# Internal imports
from db.models.clinical import ClinicalDataType
from fhir.models import FHIRBaseModel, RESOURCE_TYPES

# Allowed clinical data types for validation
ALLOWED_DATA_TYPES = [t.value for t in ClinicalDataType]

# PHI field patterns for validation
PHI_PATTERNS = {
    "mrn": r"^\d{6,10}$",  # Medical Record Number
    "ssn": r"^\d{3}-\d{2}-\d{4}$",  # Social Security Number
    "dob": r"^\d{4}-\d{2}-\d{2}$"  # Date of Birth
}

class SecurityTag(BaseModel):
    """Schema for security and privacy tags"""
    tag_type: str = Field(
        ...,
        description="Type of security tag",
        examples=["PHI", "RESTRICTED", "SENSITIVE"]
    )
    value: str = Field(
        ...,
        description="Tag value",
        examples=["CONTAINS_PHI", "CONFIDENTIAL"]
    )
    added_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the tag was added"
    )
    added_by: Optional[UUID] = Field(
        None,
        description="User who added the tag"
    )

class ClinicalDataBase(BaseModel):
    """
    Base schema for HIPAA-compliant clinical data validation.
    Implements strict validation for PHI and security requirements.
    """
    id: UUID = Field(
        default_factory=UUID,
        description="Unique identifier for clinical data record"
    )
    request_id: UUID = Field(
        ...,
        description="Associated prior authorization request ID"
    )
    data_type: str = Field(
        ...,
        description="Type of clinical data",
        examples=ALLOWED_DATA_TYPES
    )
    patient_data: Dict = Field(
        ...,
        description="FHIR-compliant patient clinical data"
    )
    recorded_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the clinical data was recorded"
    )
    contains_phi: bool = Field(
        default=True,
        description="Indicates if data contains PHI"
    )
    security_tags: List[SecurityTag] = Field(
        default_factory=list,
        description="Security and privacy tags"
    )

    @validator("data_type")
    def validate_data_type(cls, value: str) -> str:
        """Validates clinical data type with security checks"""
        if value.upper() not in ALLOWED_DATA_TYPES:
            raise ValueError(f"Invalid data type: {value}. Must be one of {ALLOWED_DATA_TYPES}")
        return value.upper()

    @validator("patient_data")
    def validate_patient_data(cls, value: Dict) -> Dict:
        """Validates patient data for PHI compliance and FHIR conformance"""
        if not isinstance(value, dict):
            raise ValueError("Patient data must be a valid JSON object")

        # Validate FHIR resource type if present
        if "resourceType" in value:
            if value["resourceType"] not in RESOURCE_TYPES:
                raise ValueError(f"Invalid FHIR resource type: {value['resourceType']}")

        # Validate PHI fields if present
        for field, pattern in PHI_PATTERNS.items():
            if field in value:
                import re
                if not re.match(pattern, str(value[field])):
                    raise ValueError(f"Invalid {field} format")

        return value

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"

class ClinicalEvidenceSchema(BaseModel):
    """
    Enhanced schema for clinical evidence matching results with audit support.
    Implements validation for AI-generated evidence and confidence scoring.
    """
    id: UUID = Field(
        default_factory=UUID,
        description="Unique identifier for evidence record"
    )
    clinical_data_id: UUID = Field(
        ...,
        description="Associated clinical data record ID"
    )
    criteria_id: UUID = Field(
        ...,
        description="Associated policy criteria ID"
    )
    confidence_score: float = Field(
        ...,
        description="AI matching confidence score",
        ge=0.0,
        le=1.0
    )
    evidence_mapping: Dict = Field(
        ...,
        description="Mapping of evidence to policy criteria"
    )
    evaluated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the evidence was evaluated"
    )
    evaluator_id: Optional[UUID] = Field(
        None,
        description="ID of AI model or user who evaluated"
    )
    audit_trail: List[Dict] = Field(
        default_factory=list,
        description="Audit trail of evidence evaluation"
    )

    @validator("confidence_score")
    def validate_confidence_score(cls, value: float) -> float:
        """Validates AI confidence score with enhanced precision"""
        if not 0 <= value <= 1:
            raise ValueError("Confidence score must be between 0 and 1")
        # Round to 4 decimal places for consistency
        return round(value, 4)

    @validator("evidence_mapping")
    def validate_evidence_mapping(cls, value: Dict) -> Dict:
        """Validates evidence mapping against criteria schema"""
        if not isinstance(value, dict):
            raise ValueError("Evidence mapping must be a valid JSON object")

        required_fields = {"criteria_matches", "evidence_sources"}
        missing_fields = required_fields - set(value.keys())
        if missing_fields:
            raise ValueError(f"Missing required fields in evidence mapping: {missing_fields}")

        # Validate evidence sources
        if not isinstance(value["evidence_sources"], list):
            raise ValueError("Evidence sources must be a list")

        return value

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"

# Export schemas
__all__ = ["ClinicalDataBase", "ClinicalEvidenceSchema", "SecurityTag"]