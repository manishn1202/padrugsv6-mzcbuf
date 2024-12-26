"""
FHIR Module Initialization
Provides centralized access to FHIR functionality for prior authorization workflows.
Implements HIPAA-compliant FHIR operations with validation and monitoring.

Version: 1.0.0
Author: Prior Authorization System Team
"""

# External imports
from fhir.resources import construct_fhir_element  # version: 6.5+
from prometheus_client import Counter, Histogram  # version: 0.17+

# Internal imports
from .models import FHIRBaseModel
from .validators import (
    FHIRValidator,
    PatientValidationRules,
    ClaimValidationRules
)
from .client import FHIRClient

# FHIR configuration constants
FHIR_VERSION = "4.0.1"
SUPPORTED_RESOURCES = [
    "Patient", "Claim", "Bundle", "Coverage", 
    "Medication", "PriorAuthorization"
]
HIPAA_VALIDATION_ENABLED = True
METRICS_ENABLED = True
CACHE_TTL_SECONDS = 300  # 5 minutes

# Prometheus metrics
if METRICS_ENABLED:
    fhir_request_counter = Counter(
        'fhir_requests_total',
        'Total FHIR API requests',
        ['resource_type', 'operation']
    )
    
    fhir_validation_errors = Counter(
        'fhir_validation_errors_total',
        'Total FHIR validation errors',
        ['resource_type', 'error_type']
    )
    
    fhir_request_duration = Histogram(
        'fhir_request_duration_seconds',
        'FHIR request duration in seconds',
        ['resource_type', 'operation']
    )

def validate_fhir_version():
    """Validate FHIR version compatibility"""
    if not FHIR_VERSION.startswith("4."):
        raise ValueError(
            f"Unsupported FHIR version: {FHIR_VERSION}. Must use FHIR R4."
        )

def setup_fhir_client(base_url: str, auth_token: str) -> FHIRClient:
    """
    Create and configure a FHIR client instance.
    
    Args:
        base_url: FHIR server base URL
        auth_token: Authentication token
        
    Returns:
        Configured FHIRClient instance
    """
    validate_fhir_version()
    
    client_config = {
        'timeout': 30,
        'cache_ttl': CACHE_TTL_SECONDS,
        'validate_responses': HIPAA_VALIDATION_ENABLED
    }
    
    return FHIRClient(
        base_url=base_url,
        auth_token=auth_token,
        config=client_config
    )

def get_resource_validator(resource_type: str) -> FHIRValidator:
    """
    Get appropriate validator for FHIR resource type.
    
    Args:
        resource_type: FHIR resource type
        
    Returns:
        Resource-specific validator instance
    """
    if resource_type not in SUPPORTED_RESOURCES:
        raise ValueError(f"Unsupported resource type: {resource_type}")
        
    if resource_type == "Patient":
        return FHIRValidator(
            resource_type=resource_type,
            custom_rules=PatientValidationRules()
        )
    elif resource_type == "Claim":
        return FHIRValidator(
            resource_type=resource_type,
            custom_rules=ClaimValidationRules()
        )
    else:
        return FHIRValidator(resource_type=resource_type)

# Initialize FHIR module
validate_fhir_version()

# Export public interface
__all__ = [
    # Core FHIR models
    'FHIRBaseModel',
    
    # Validation
    'FHIRValidator',
    'PatientValidationRules',
    'ClaimValidationRules',
    
    # Client interface
    'FHIRClient',
    'setup_fhir_client',
    'get_resource_validator',
    
    # Constants
    'FHIR_VERSION',
    'SUPPORTED_RESOURCES',
    'HIPAA_VALIDATION_ENABLED'
]