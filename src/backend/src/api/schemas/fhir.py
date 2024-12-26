"""
FHIR R4 Pydantic Schemas for Prior Authorization API
Implements comprehensive validation and HIPAA-compliant data handling

Version: 1.0.0
Author: Prior Authorization System Team
"""

from typing import Dict, List, Optional, Union
from uuid import UUID

# pydantic v2.0+
from pydantic import BaseModel, Field, validator, UUID4

# Internal imports
from ...fhir.models import FHIRBaseModel
from ...fhir.validators import FHIRValidator, PatientValidationRules, ClaimValidationRules

# Constants for FHIR resource validation
SUPPORTED_RESOURCES = [
    "Patient", "Medication", "Coverage", "Claim", 
    "ClaimResponse", "Bundle", "Organization", "Practitioner"
]

RESOURCE_TYPES = {
    "Patient": "Patient",
    "Medication": "Medication", 
    "Coverage": "Coverage",
    "Claim": "Claim",
    "ClaimResponse": "ClaimResponse",
    "Bundle": "Bundle",
    "Organization": "Organization",
    "Practitioner": "Practitioner"
}

AUDIT_ENABLED = True

def validate_resource_type(resource_type: str, expected_type: str, audit_enabled: bool = AUDIT_ENABLED) -> bool:
    """
    Enhanced FHIR resource type validator with audit logging
    
    Args:
        resource_type: The resource type to validate
        expected_type: The expected resource type
        audit_enabled: Whether to enable audit logging
        
    Returns:
        bool: True if valid, raises ValueError if invalid
    """
    if not resource_type:
        raise ValueError("Resource type cannot be empty")
        
    if resource_type not in SUPPORTED_RESOURCES:
        raise ValueError(f"Unsupported resource type: {resource_type}")
        
    if resource_type != expected_type:
        raise ValueError(f"Resource type mismatch. Expected {expected_type}, got {resource_type}")
        
    return True

class PatientSchema(FHIRBaseModel):
    """
    Enhanced FHIR Patient resource schema with PHI protection and validation
    """
    resourceType: str = Field(
        "Patient",
        const=True,
        description="FHIR resource type - fixed as Patient"
    )
    id: UUID4 = Field(
        ...,
        description="Logical id of the resource"
    )
    identifier: List[Dict] = Field(
        ...,
        description="Patient identifiers (MRN, SSN, etc)",
        min_items=1
    )
    name: List[Dict] = Field(
        ...,
        description="Patient names",
        min_items=1
    )
    gender: str = Field(
        ...,
        description="Patient gender",
        pattern="^(male|female|other|unknown)$"
    )
    birthDate: str = Field(
        ...,
        description="Patient birth date",
        pattern="^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
    )
    telecom: Optional[List[Dict]] = Field(
        None,
        description="Patient contact details"
    )
    address: Optional[List[Dict]] = Field(
        None,
        description="Patient addresses"
    )
    meta: Dict = Field(
        ...,
        description="Metadata about the resource"
    )

    @validator("resourceType")
    def validate_patient_type(cls, v):
        """Validate Patient resource type"""
        validate_resource_type(v, "Patient")
        return v

    def __init__(self, **data):
        """Initialize Patient schema with validation"""
        super().__init__(**data)
        self._validator = FHIRValidator("Patient")
        self._rules = PatientValidationRules()

    def validate(self) -> bool:
        """
        Validate Patient resource against FHIR and HIPAA rules
        
        Returns:
            bool: True if valid, raises ValueError if invalid
        """
        # Validate base FHIR structure
        is_valid, errors = self._validator.validate_resource(self.model_dump())
        if not is_valid:
            raise ValueError(f"Patient validation failed: {errors}")

        # Validate PA-specific rules
        is_valid, errors = self._rules.validate(self.model_dump())
        if not is_valid:
            raise ValueError(f"Patient PA validation failed: {errors}")

        return True

class ClaimSchema(FHIRBaseModel):
    """
    Enhanced FHIR Claim resource schema for prior authorization requests
    """
    resourceType: str = Field(
        "Claim",
        const=True,
        description="FHIR resource type - fixed as Claim"
    )
    id: UUID4 = Field(
        ...,
        description="Logical id of the resource"
    )
    status: str = Field(
        ...,
        description="Claim status",
        pattern="^(active|cancelled|draft|entered-in-error)$"
    )
    type: Dict = Field(
        ...,
        description="Prior authorization claim type"
    )
    patient: Dict = Field(
        ...,
        description="Patient reference"
    )
    insurance: List[Dict] = Field(
        ...,
        description="Insurance coverage information",
        min_items=1
    )
    supportingInfo: List[Dict] = Field(
        ...,
        description="Supporting clinical information",
        min_items=1
    )
    item: List[Dict] = Field(
        ...,
        description="Products or services",
        min_items=1
    )
    meta: Dict = Field(
        ...,
        description="Metadata about the resource"
    )

    @validator("resourceType")
    def validate_claim_type(cls, v):
        """Validate Claim resource type"""
        validate_resource_type(v, "Claim")
        return v

    @validator("type")
    def validate_pa_type(cls, v):
        """Validate prior authorization claim type"""
        coding = v.get("coding", [{}])[0]
        if coding.get("code") not in ["prior-authorization", "preauthorization-request"]:
            raise ValueError("Invalid claim type for prior authorization")
        return v

    def __init__(self, **data):
        """Initialize Claim schema with validation"""
        super().__init__(**data)
        self._validator = FHIRValidator("Claim")
        self._rules = ClaimValidationRules()

    def validate(self) -> bool:
        """
        Validate Claim resource against FHIR and PA rules
        
        Returns:
            bool: True if valid, raises ValueError if invalid
        """
        # Validate base FHIR structure
        is_valid, errors = self._validator.validate_resource(self.model_dump())
        if not is_valid:
            raise ValueError(f"Claim validation failed: {errors}")

        # Validate PA-specific rules
        is_valid, errors = self._rules.validate(self.model_dump())
        if not is_valid:
            raise ValueError(f"Claim PA validation failed: {errors}")

        return True

__all__ = [
    "PatientSchema",
    "ClaimSchema",
    "validate_resource_type",
    "SUPPORTED_RESOURCES",
    "RESOURCE_TYPES"
]