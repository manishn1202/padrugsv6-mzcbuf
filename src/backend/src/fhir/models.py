"""
FHIR Resource Models for Prior Authorization System
Implements FHIR R4 data structures with HIPAA compliance and validation

Version: 1.0.0
Author: Prior Authorization System Team
"""

from datetime import datetime
from typing import Dict, List, Optional, Union
from uuid import UUID, uuid4

# pydantic v2.0+
from pydantic import BaseModel, Field, validator, model_validator

# fhir.resources v6.5+
from fhir.resources import (
    FHIRAbstractModel,
    construct_fhir_element
)
from fhir.resources.patient import Patient
from fhir.resources.medication import Medication
from fhir.resources.claim import Claim
from fhir.resources.bundle import Bundle
from fhir.resources.coverage import Coverage
from fhir.resources.organization import Organization
from fhir.resources.practitioner import Practitioner, PractitionerRole

# Constants for FHIR Resource validation
RESOURCE_TYPES = [
    "Patient", "Medication", "Claim", "Bundle", 
    "Coverage", "Organization", "Practitioner", 
    "PractitionerRole"
]

BUNDLE_TYPES = [
    "collection", "transaction", "batch", 
    "history", "searchset"
]

CLAIM_TYPES = [
    "prior-authorization", "predetermination",
    "preauthorization-request"
]

AUDIT_LEVELS = [
    "create", "update", "delete", "view"
]

class FHIRMetadata(BaseModel):
    """FHIR Resource metadata with versioning and audit support"""
    versionId: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Version identifier for the resource"
    )
    lastUpdated: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp"
    )
    profile: Optional[List[str]] = Field(
        default=None,
        description="FHIR profiles this resource claims to conform to"
    )
    security: Optional[List[Dict]] = Field(
        default=None,
        description="Security labels applied to this resource"
    )
    tag: Optional[List[Dict]] = Field(
        default=None,
        description="Tags applied to this resource"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class FHIRBaseModel(BaseModel):
    """
    Base class for all FHIR resources implementing core functionality
    with HIPAA compliance and audit logging support
    """
    resourceType: str = Field(
        ...,  # Required field
        description="FHIR resource type"
    )
    id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Logical id of the resource"
    )
    meta: FHIRMetadata = Field(
        default_factory=FHIRMetadata,
        description="Metadata about the resource"
    )
    extension: Optional[List[Dict]] = Field(
        default=None,
        description="Additional content defined by implementations"
    )
    modifierExtension: Optional[List[Dict]] = Field(
        default=None,
        description="Extensions that modify meaning/interpretation"
    )

    def __init__(self, **data):
        """Initialize FHIR resource with validation and audit setup"""
        super().__init__(**data)
        self._validate_resource_type()
        self._setup_audit_logging()

    @model_validator(mode='before')
    def validate_resource(cls, values):
        """Validate FHIR resource structure and HIPAA compliance"""
        if not isinstance(values, dict):
            raise ValueError("Invalid FHIR resource format")
        
        resource_type = values.get('resourceType')
        if not resource_type or resource_type not in RESOURCE_TYPES:
            raise ValueError(f"Invalid or missing resourceType: {resource_type}")
        
        # Ensure meta information exists
        if 'meta' not in values:
            values['meta'] = FHIRMetadata().model_dump()
            
        return values

    def _validate_resource_type(self):
        """Validate resource type against allowed FHIR types"""
        if self.resourceType not in RESOURCE_TYPES:
            raise ValueError(f"Invalid FHIR resource type: {self.resourceType}")

    def _setup_audit_logging(self):
        """Configure audit logging for HIPAA compliance"""
        self._audit_trail = []
        self._setup_audit_handlers()

    def _setup_audit_handlers(self):
        """Set up audit event handlers for resource operations"""
        self._audit_handlers = {
            'create': self._log_create,
            'update': self._log_update,
            'delete': self._log_delete,
            'view': self._log_view
        }

    def _log_audit_event(self, event_type: str, details: Dict):
        """Log an audit event with HIPAA-compliant information"""
        if event_type not in AUDIT_LEVELS:
            raise ValueError(f"Invalid audit event type: {event_type}")
            
        audit_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'resource_id': self.id,
            'resource_type': self.resourceType,
            'version_id': self.meta.versionId,
            'details': details
        }
        self._audit_trail.append(audit_entry)

    def _log_create(self, details: Dict):
        """Log resource creation event"""
        self._log_audit_event('create', details)

    def _log_update(self, details: Dict):
        """Log resource update event"""
        self._log_audit_event('update', details)

    def _log_delete(self, details: Dict):
        """Log resource deletion event"""
        self._log_audit_event('delete', details)

    def _log_view(self, details: Dict):
        """Log resource view event"""
        self._log_audit_event('view', details)

    def to_dict(self, include_meta: bool = True) -> Dict:
        """
        Convert resource to FHIR JSON format with validation
        
        Args:
            include_meta: Whether to include metadata in output
            
        Returns:
            Dict containing FHIR JSON representation
        """
        data = self.model_dump(exclude_none=True)
        
        if not include_meta:
            data.pop('meta', None)
            
        # Log view event
        self._log_view({'action': 'resource_export'})
        
        return data

    @classmethod
    def from_dict(cls, data: Dict, validate_strict: bool = True) -> 'FHIRBaseModel':
        """
        Create resource from FHIR JSON with validation
        
        Args:
            data: FHIR JSON data
            validate_strict: Whether to perform strict validation
            
        Returns:
            FHIRBaseModel instance
        """
        if validate_strict:
            # Validate against FHIR resource definition
            resource_type = data.get('resourceType')
            if resource_type not in RESOURCE_TYPES:
                raise ValueError(f"Invalid resource type: {resource_type}")
                
            # Validate required fields
            if 'id' not in data:
                data['id'] = str(uuid4())
                
        instance = cls(**data)
        instance._log_create({'action': 'resource_import'})
        return instance

    def validate(self) -> bool:
        """
        Validate resource against FHIR specifications
        
        Returns:
            bool indicating validation success
        """
        try:
            # Validate resource type
            self._validate_resource_type()
            
            # Validate structure using pydantic
            self.model_dump()
            
            # Validate HIPAA compliance
            if not hasattr(self, '_audit_trail'):
                raise ValueError("Missing audit trail")
                
            return True
            
        except Exception as e:
            raise ValueError(f"Resource validation failed: {str(e)}")