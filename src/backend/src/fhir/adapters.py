"""
FHIR Adapters Module for Prior Authorization System
Provides interfaces and implementations for converting between internal data models and FHIR R4 resources

Version: 1.0.0
Author: Prior Authorization System Team
"""

from typing import Dict, List, Optional, Union, Type
from functools import wraps
from datetime import datetime
import logging

# fhir.resources v6.5+
from fhir.resources import construct_fhir_element
from fhir.resources.patient import Patient
from fhir.resources.claim import Claim
from fhir.resources.bundle import Bundle
from fhir.resources.coverage import Coverage

# pydantic v2.0+
from pydantic import BaseModel

# cachetools v5.0+
from cachetools import TTLCache

# hipaa_logger v1.2+
from hipaa_logger import AuditLogger

# Internal imports
from .models import FHIRBaseModel
from .validators import FHIRValidator, PatientValidationRules, ClaimValidationRules

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
FHIR_VERSION = "4.0.1"
CACHE_TTL = 300  # 5 minutes cache TTL
PA_EXTENSIONS = [
    "http://pa.example.com/fhir/StructureDefinition/prior-auth",
    "http://pa.example.com/fhir/StructureDefinition/pa-status",
    "http://pa.example.com/fhir/StructureDefinition/pa-history"
]

def performance_monitor(func):
    """Decorator for monitoring adapter performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.utcnow()
        try:
            result = func(*args, **kwargs)
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"Operation {func.__name__} completed in {duration}s")
            return result
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            raise
    return wrapper

def audit_log(func):
    """Decorator for HIPAA-compliant audit logging"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            # Log successful operation
            args[0]._logger.log_event(
                event_type="resource_conversion",
                resource_type=args[0].__class__.__name__,
                operation=func.__name__,
                status="success"
            )
            return result
        except Exception as e:
            # Log failed operation
            args[0]._logger.log_event(
                event_type="resource_conversion",
                resource_type=args[0].__class__.__name__,
                operation=func.__name__,
                status="error",
                error=str(e)
            )
            raise
    return wrapper

class FHIRAdapter:
    """Enhanced base adapter class with caching, audit logging, and PA extensions support"""
    
    def __init__(self, config: Dict):
        """Initialize enhanced base adapter"""
        self._validator = FHIRValidator(self.__class__.__name__, config.get("validation_rules"))
        self._cache = TTLCache(maxsize=1000, ttl=CACHE_TTL)
        self._logger = AuditLogger(
            app_name="pa_system",
            component="fhir_adapter",
            compliance_level="HIPAA"
        )
        self._pa_extensions = PA_EXTENSIONS

    @audit_log
    @performance_monitor
    def to_fhir(self, internal_model: BaseModel, use_cache: bool = True) -> Dict:
        """Convert internal model to FHIR resource with validation caching"""
        try:
            # Check cache if enabled
            if use_cache:
                cache_key = hash(str(internal_model))
                if cache_key in self._cache:
                    return self._cache[cache_key]

            # Convert to FHIR
            fhir_dict = self._convert_to_fhir(internal_model)

            # Add PA extensions
            fhir_dict = self._add_pa_extensions(fhir_dict, internal_model)

            # Validate
            is_valid, errors = self._validator.validate_resource(fhir_dict)
            if not is_valid:
                raise ValueError(f"FHIR validation failed: {errors}")

            # Cache result
            if use_cache:
                self._cache[cache_key] = fhir_dict

            return fhir_dict

        except Exception as e:
            logger.error(f"FHIR conversion error: {str(e)}")
            raise

    def _convert_to_fhir(self, internal_model: BaseModel) -> Dict:
        """Template method for FHIR conversion - to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement _convert_to_fhir")

    def _add_pa_extensions(self, fhir_dict: Dict, internal_model: BaseModel) -> Dict:
        """Add PA-specific extensions to FHIR resource"""
        if "extension" not in fhir_dict:
            fhir_dict["extension"] = []

        # Add PA status extension
        fhir_dict["extension"].append({
            "url": "http://pa.example.com/fhir/StructureDefinition/pa-status",
            "valueCode": getattr(internal_model, "pa_status", "unknown")
        })

        # Add PA history extension
        if hasattr(internal_model, "pa_history"):
            fhir_dict["extension"].append({
                "url": "http://pa.example.com/fhir/StructureDefinition/pa-history",
                "valueReference": {
                    "reference": f"Bundle/{internal_model.pa_history}"
                }
            })

        return fhir_dict

class PatientAdapter(FHIRAdapter):
    """Enhanced adapter for FHIR Patient resources with PA-specific extensions"""
    
    def __init__(self, pa_config: Dict):
        """Initialize enhanced patient adapter"""
        super().__init__(pa_config)
        self._patient_validator = PatientValidationRules()
        self._required_extensions = pa_config.get("required_extensions", [])

    @audit_log
    @performance_monitor
    def _convert_to_fhir(self, patient: BaseModel) -> Dict:
        """Convert internal patient model to FHIR Patient with PA extensions"""
        fhir_patient = {
            "resourceType": "Patient",
            "id": str(patient.id),
            "meta": {
                "versionId": str(patient.version),
                "lastUpdated": datetime.utcnow().isoformat(),
                "profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
                "security": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                        "code": "R",
                        "display": "Restricted"
                    }
                ]
            },
            "identifier": [
                {
                    "system": "http://hl7.org/fhir/sid/us-ssn",
                    "value": patient.ssn
                },
                {
                    "system": "http://pa.example.com/fhir/identifiers/member-id",
                    "value": patient.member_id
                }
            ],
            "active": True,
            "name": [
                {
                    "use": "official",
                    "family": patient.last_name,
                    "given": [patient.first_name]
                }
            ],
            "telecom": [
                {
                    "system": "phone",
                    "value": patient.phone,
                    "use": "home"
                },
                {
                    "system": "email",
                    "value": patient.email
                }
            ],
            "gender": patient.gender,
            "birthDate": patient.birth_date.isoformat(),
            "address": [
                {
                    "use": "home",
                    "line": [patient.address_line1, patient.address_line2],
                    "city": patient.city,
                    "state": patient.state,
                    "postalCode": patient.postal_code,
                    "country": "US"
                }
            ]
        }

        # Validate patient-specific rules
        is_valid, errors = self._patient_validator.validate(fhir_patient)
        if not is_valid:
            raise ValueError(f"Patient validation failed: {errors}")

        return fhir_patient

# Register adapters
ADAPTER_REGISTRY = {
    "Patient": PatientAdapter,
    "Claim": None,  # Implement ClaimAdapter similarly
    "Bundle": None,  # Implement BundleAdapter similarly
    "Coverage": None  # Implement CoverageAdapter similarly
}

__all__ = [
    "FHIRAdapter",
    "PatientAdapter",
    "ADAPTER_REGISTRY",
    "PA_EXTENSIONS"
]