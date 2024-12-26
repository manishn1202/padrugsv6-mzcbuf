"""
Pydantic schemas for prior authorization request validation and serialization.
Implements HIPAA-compliant data validation with performance optimizations.

Version: 1.0.0
"""

from datetime import datetime, date
from typing import Dict, List, Optional
from uuid import UUID

# pydantic v2.0+
from pydantic import BaseModel, Field, validator, model_validator

# Internal imports
from core.constants import PriorAuthStatus
from api.schemas.clinical import ClinicalDataBase, ClinicalEvidenceSchema

class DrugRequest(BaseModel):
    """
    Schema for comprehensive drug-related information validation in PA requests.
    Implements strict validation for drug quantities and FHIR mapping.
    """
    drug_code: str = Field(
        ...,
        description="Drug code identifier",
        min_length=5,
        max_length=20
    )
    drug_name: str = Field(
        ...,
        description="Drug name",
        min_length=2,
        max_length=200
    )
    quantity: float = Field(
        ...,
        description="Drug quantity",
        gt=0,
        le=999
    )
    days_supply: int = Field(
        ...,
        description="Days supply",
        ge=1,
        le=365
    )
    refills: int = Field(
        ...,
        description="Number of refills",
        ge=0,
        le=12
    )
    form: str = Field(
        ...,
        description="Drug form",
        max_length=50
    )
    strength: str = Field(
        ...,
        description="Drug strength",
        max_length=50
    )
    route: str = Field(
        ...,
        description="Administration route",
        max_length=50
    )
    ndc_code: Optional[str] = Field(
        None,
        description="National Drug Code",
        regex=r"^\d{4,5}-\d{3,4}-\d{1,2}$"
    )
    fhir_mapping: Dict = Field(
        default_factory=dict,
        description="FHIR resource mapping"
    )

    @validator("quantity")
    def validate_quantity(cls, value: float) -> float:
        """Validates drug quantity with enhanced precision"""
        if value <= 0:
            raise ValueError("Quantity must be greater than 0")
        if value > 999:
            raise ValueError("Quantity exceeds maximum allowed")
        # Round to 3 decimal places for precision
        return round(value, 3)

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"

class PriorAuthRequest(BaseModel):
    """
    Main schema for prior authorization request validation with HIPAA compliance.
    Implements comprehensive validation for all PA request fields.
    """
    id: Optional[UUID] = Field(
        default=None,
        description="Unique request identifier"
    )
    provider_id: UUID = Field(
        ...,
        description="Provider identifier"
    )
    patient_mrn: str = Field(
        ...,
        description="Patient Medical Record Number",
        min_length=6,
        max_length=20,
        regex=r"^[A-Za-z0-9-]+$"
    )
    patient_first_name: str = Field(
        ...,
        description="Patient first name",
        min_length=1,
        max_length=100
    )
    patient_last_name: str = Field(
        ...,
        description="Patient last name",
        min_length=1,
        max_length=100
    )
    patient_dob: date = Field(
        ...,
        description="Patient date of birth"
    )
    insurance_id: str = Field(
        ...,
        description="Insurance identifier",
        min_length=5,
        max_length=50
    )
    insurance_plan: str = Field(
        ...,
        description="Insurance plan name",
        min_length=2,
        max_length=100
    )
    drug: DrugRequest = Field(
        ...,
        description="Drug request details"
    )
    diagnosis_code: str = Field(
        ...,
        description="ICD-10 diagnosis code",
        regex=r"^[A-Z]\d{2}(\.\d{1,2})?$"
    )
    diagnosis_name: str = Field(
        ...,
        description="Diagnosis description",
        min_length=2,
        max_length=200
    )
    status: PriorAuthStatus = Field(
        default=PriorAuthStatus.DRAFT,
        description="Request status"
    )
    clinical_data: Optional[ClinicalDataBase] = Field(
        None,
        description="Clinical documentation"
    )
    evidence: Optional[ClinicalEvidenceSchema] = Field(
        None,
        description="AI matching evidence"
    )
    confidence_score: Optional[float] = Field(
        None,
        description="Overall confidence score",
        ge=0.0,
        le=1.0
    )
    submitted_at: Optional[datetime] = Field(
        None,
        description="Submission timestamp"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    version: str = Field(
        default="1.0",
        description="Schema version"
    )
    audit_trail: Dict = Field(
        default_factory=dict,
        description="Audit trail data"
    )
    fhir_bundle: Optional[Dict] = Field(
        None,
        description="FHIR resource bundle"
    )

    @validator("submitted_at", "created_at", "updated_at")
    def validate_dates(cls, value: datetime, values: Dict) -> datetime:
        """Validates request dates with audit trail"""
        if not value:
            return value

        # Validate created_at is not in future
        if value > datetime.utcnow():
            raise ValueError("Date cannot be in the future")

        # Validate submitted_at is after created_at
        if "created_at" in values and value < values["created_at"]:
            raise ValueError("Submitted date must be after creation date")

        # Validate updated_at is after created_at
        if "created_at" in values and value < values["created_at"]:
            raise ValueError("Update date must be after creation date")

        return value

    @model_validator(mode='after')
    def validate_request(self) -> 'PriorAuthRequest':
        """Validates complete request object"""
        # Ensure submitted requests have clinical data
        if self.status != PriorAuthStatus.DRAFT and not self.clinical_data:
            raise ValueError("Clinical data required for submission")

        # Validate confidence score presence for AI matching
        if self.evidence and self.confidence_score is None:
            raise ValueError("Confidence score required with evidence")

        return self

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"

class PriorAuthResponse(BaseModel):
    """
    Schema for prior authorization API responses with AI matching results.
    Implements validation for response data including evidence mapping.
    """
    request_id: UUID = Field(
        ...,
        description="Request identifier"
    )
    request: PriorAuthRequest = Field(
        ...,
        description="Complete request data"
    )
    match_score: float = Field(
        ...,
        description="AI matching confidence score",
        ge=0.0,
        le=1.0
    )
    missing_criteria: List[str] = Field(
        default_factory=list,
        description="Missing policy criteria"
    )
    status_message: str = Field(
        ...,
        description="Status message",
        max_length=500
    )
    processed_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Processing timestamp"
    )
    ai_evidence: Dict = Field(
        default_factory=dict,
        description="AI matching evidence"
    )
    fhir_response: Optional[Dict] = Field(
        None,
        description="FHIR response bundle"
    )
    audit_log: Dict = Field(
        default_factory=dict,
        description="Processing audit log"
    )

    @validator("match_score")
    def validate_match_score(cls, value: float) -> float:
        """Validates AI match score with confidence thresholds"""
        if not 0 <= value <= 1:
            raise ValueError("Match score must be between 0 and 1")
        # Round to 4 decimal places for precision
        return round(value, 4)

    class Config:
        """Pydantic model configuration"""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
        validate_assignment = True
        extra = "forbid"

# Export schemas for use in API layer
__all__ = [
    "DrugRequest",
    "PriorAuthRequest", 
    "PriorAuthResponse"
]