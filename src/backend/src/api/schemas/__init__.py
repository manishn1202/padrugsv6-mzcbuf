"""
Initialization module for API schema models in the Prior Authorization Management System.
Centralizes schema exports and implements HIPAA-compliant data validation.

Version: 1.0.0
"""

# Import response schemas
from api.schemas.responses import (  # version: 1.0.0
    BaseResponse,
    ErrorResponse, 
    ValidationErrorResponse,
    PriorAuthResponse
)

# Import clinical data schemas
from api.schemas.clinical import (  # version: 1.0.0
    ClinicalDataBase,
    ClinicalEvidenceSchema,
    SecurityTag
)

# Import prior authorization schemas
from api.schemas.prior_auth import (  # version: 1.0.0
    DrugRequest,
    PriorAuthRequest,
    PriorAuthResponse as PAResponse
)

# Re-export all schemas with clear namespace
__all__ = [
    # Base response schemas
    'BaseResponse',
    'ErrorResponse',
    'ValidationErrorResponse',
    
    # Clinical data schemas
    'ClinicalDataBase',
    'ClinicalEvidenceSchema',
    'SecurityTag',
    
    # Prior authorization schemas
    'DrugRequest',
    'PriorAuthRequest',
    'PriorAuthResponse',
    
    # Type aliases for clarity
    'PAResponse'  # Alias for PriorAuthResponse
]

# Schema version for API compatibility
SCHEMA_VERSION = "1.0.0"

# Schema configuration for HIPAA compliance
SCHEMA_CONFIG = {
    'validate_all': True,  # Enable validation for all fields
    'validate_assignment': True,  # Validate on attribute assignment
    'extra': 'forbid',  # Prevent extra fields for security
    'allow_mutation': False,  # Immutable models for audit trail
    'allow_population_by_field_name': True,  # Support field aliases
    'use_enum_values': True  # Use enum values in serialization
}

# Configure schema defaults
def configure_schemas():
    """Configure global schema settings for HIPAA compliance"""
    from pydantic import BaseModel
    
    # Apply HIPAA-compliant configuration to all schemas
    BaseModel.Config = type('Config', (), SCHEMA_CONFIG)

# Initialize schema configuration
configure_schemas()