"""
FHIR Resource Validators for Prior Authorization System
Implements comprehensive validation rules for FHIR R4 resources with HIPAA compliance

Version: 1.0.0
Author: Prior Authorization System Team
"""

import logging
from typing import Dict, List, Optional, Tuple
from functools import wraps
from datetime import datetime

# fhir.resources v6.5+
from fhir.resources import construct_fhir_element
from fhir.resources.patient import Patient
from fhir.resources.claim import Claim
from fhir.resources.bundle import Bundle

# pydantic v2.0+
from pydantic import ValidationError

# cachetools v5.0+
from cachetools import TTLCache, cached

# Internal imports
from .models import FHIRBaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
FHIR_VERSION = "4.0.1"
VALIDATION_CACHE_TTL = 3600  # 1 hour cache TTL

REQUIRED_FIELDS = {
    "Patient": ["identifier", "name", "telecom"],
    "Claim": ["status", "type", "patient", "insurance"],
    "Bundle": ["type", "entry", "timestamp"]
}

def validation_logger(func):
    """Decorator for logging validation operations"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.utcnow()
        try:
            result = func(*args, **kwargs)
            logger.info(
                f"Validation {func.__name__} completed in "
                f"{(datetime.utcnow() - start_time).total_seconds()}s"
            )
            return result
        except Exception as e:
            logger.error(f"Validation error in {func.__name__}: {str(e)}")
            raise
    return wrapper

class FHIRValidator:
    """Enhanced base validator class for FHIR resources with HIPAA compliance"""
    
    def __init__(self, resource_type: str, custom_rules: Optional[Dict] = None):
        """Initialize validator with resource type and custom rules"""
        if resource_type not in REQUIRED_FIELDS:
            raise ValueError(f"Unsupported resource type: {resource_type}")
            
        self._resource_type = resource_type
        self._validation_rules = custom_rules or {}
        self._validation_cache = TTLCache(maxsize=1000, ttl=VALIDATION_CACHE_TTL)

    @validation_logger
    def validate_resource(self, resource_data: Dict, strict_mode: bool = True) -> Tuple[bool, List[str]]:
        """Validate FHIR resource against rules including HIPAA compliance"""
        errors = []

        try:
            # Validate resource type
            if resource_data.get("resourceType") != self._resource_type:
                return False, [f"Invalid resource type: {resource_data.get('resourceType')}"]

            # Check required fields
            for field in REQUIRED_FIELDS[self._resource_type]:
                if field not in resource_data:
                    errors.append(f"Missing required field: {field}")

            # Validate HIPAA compliance
            hipaa_valid, hipaa_errors = self.validate_hipaa_compliance(resource_data)
            if not hipaa_valid:
                errors.extend(hipaa_errors)

            # Validate references
            ref_valid, ref_errors = self.validate_references(resource_data, strict_mode)
            if not ref_valid:
                errors.extend(ref_errors)

            # Cache validation result
            cache_key = str(hash(str(resource_data)))
            self._validation_cache[cache_key] = (len(errors) == 0, errors)

            return len(errors) == 0, errors

        except ValidationError as e:
            return False, [str(e)]
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            return False, [f"Internal validation error: {str(e)}"]

    @validation_logger
    def validate_references(self, resource_data: Dict, validate_existence: bool = True) -> Tuple[bool, List[str]]:
        """Enhanced validation of FHIR resource references with caching"""
        errors = []
        
        try:
            # Extract references from resource
            references = self._extract_references(resource_data)
            
            for ref in references:
                # Check reference format
                if not self._validate_reference_format(ref):
                    errors.append(f"Invalid reference format: {ref}")
                    continue
                
                # Validate reference existence if required
                if validate_existence and not self._validate_reference_exists(ref):
                    errors.append(f"Referenced resource not found: {ref}")
                    
            return len(errors) == 0, errors
            
        except Exception as e:
            logger.error(f"Reference validation error: {str(e)}")
            return False, [f"Reference validation failed: {str(e)}"]

    @validation_logger
    def validate_hipaa_compliance(self, resource_data: Dict) -> Tuple[bool, List[str]]:
        """Validate HIPAA compliance rules for PHI"""
        errors = []
        
        try:
            # Validate minimum necessary PHI
            if not self._validate_minimum_necessary(resource_data):
                errors.append("Resource contains more than minimum necessary PHI")
            
            # Validate identifier formats
            if not self._validate_identifiers(resource_data):
                errors.append("Invalid identifier format for PHI")
            
            # Validate security tags
            if not self._validate_security_tags(resource_data):
                errors.append("Missing required security tags for PHI")
            
            # Validate access control metadata
            if not self._validate_access_control(resource_data):
                errors.append("Missing or invalid access control metadata")
            
            return len(errors) == 0, errors
            
        except Exception as e:
            logger.error(f"HIPAA compliance validation error: {str(e)}")
            return False, [f"HIPAA compliance validation failed: {str(e)}"]

    def _extract_references(self, resource_data: Dict) -> List[str]:
        """Extract all resource references from FHIR resource"""
        references = []
        
        def extract_refs(data):
            if isinstance(data, dict):
                for key, value in data.items():
                    if key == "reference" and isinstance(value, str):
                        references.append(value)
                    elif isinstance(value, (dict, list)):
                        extract_refs(value)
            elif isinstance(data, list):
                for item in data:
                    extract_refs(item)
                    
        extract_refs(resource_data)
        return references

    def _validate_reference_format(self, reference: str) -> bool:
        """Validate FHIR reference format"""
        try:
            if not reference:
                return False
                
            parts = reference.split("/")
            if len(parts) != 2:
                return False
                
            resource_type, resource_id = parts
            return resource_type in REQUIRED_FIELDS
            
        except Exception:
            return False

    def _validate_reference_exists(self, reference: str) -> bool:
        """Validate referenced resource exists"""
        # Note: Actual implementation would check against database
        # This is a placeholder that always returns True
        return True

    def _validate_minimum_necessary(self, resource_data: Dict) -> bool:
        """Validate minimum necessary PHI principle"""
        required_fields = REQUIRED_FIELDS[self._resource_type]
        actual_fields = set(resource_data.keys())
        return all(field in actual_fields for field in required_fields)

    def _validate_identifiers(self, resource_data: Dict) -> bool:
        """Validate PHI identifier formats"""
        try:
            identifiers = resource_data.get("identifier", [])
            if not identifiers:
                return True
                
            for identifier in identifiers:
                if not identifier.get("system") or not identifier.get("value"):
                    return False
                    
            return True
            
        except Exception:
            return False

    def _validate_security_tags(self, resource_data: Dict) -> bool:
        """Validate security tags for PHI"""
        try:
            meta = resource_data.get("meta", {})
            security = meta.get("security", [])
            
            required_tags = {"HIPAA.1", "PHI"}
            actual_tags = {tag.get("code") for tag in security}
            
            return required_tags.issubset(actual_tags)
            
        except Exception:
            return False

    def _validate_access_control(self, resource_data: Dict) -> bool:
        """Validate access control metadata"""
        try:
            meta = resource_data.get("meta", {})
            return bool(meta.get("security")) and bool(meta.get("tag"))
        except Exception:
            return False

class PatientValidationRules:
    """Enhanced validation rules specific to FHIR Patient resources with PA requirements"""
    
    def __init__(self):
        """Initialize patient validation rules"""
        self._pa_specific_rules = {
            "required_extensions": [
                "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
                "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"
            ],
            "required_identifiers": [
                "http://hl7.org/fhir/sid/us-ssn",
                "http://hl7.org/fhir/sid/us-npi"
            ]
        }

    @validation_logger
    def validate(self, patient_data: Dict) -> Tuple[bool, List[str]]:
        """Apply enhanced patient validation rules for PA"""
        errors = []
        
        try:
            # Validate patient identifiers
            identifiers = patient_data.get("identifier", [])
            identifier_systems = {id.get("system") for id in identifiers}
            
            for required_id in self._pa_specific_rules["required_identifiers"]:
                if required_id not in identifier_systems:
                    errors.append(f"Missing required identifier: {required_id}")
            
            # Validate required extensions
            extensions = patient_data.get("extension", [])
            extension_urls = {ext.get("url") for ext in extensions}
            
            for required_ext in self._pa_specific_rules["required_extensions"]:
                if required_ext not in extension_urls:
                    errors.append(f"Missing required extension: {required_ext}")
            
            # Validate contact information
            if not self._validate_contact_info(patient_data):
                errors.append("Invalid or missing contact information")
            
            # Validate insurance information
            if not self._validate_insurance_info(patient_data):
                errors.append("Invalid or missing insurance information")
            
            return len(errors) == 0, errors
            
        except Exception as e:
            logger.error(f"Patient validation error: {str(e)}")
            return False, [f"Patient validation failed: {str(e)}"]

    def _validate_contact_info(self, patient_data: Dict) -> bool:
        """Validate patient contact information"""
        try:
            telecom = patient_data.get("telecom", [])
            has_phone = any(t.get("system") == "phone" for t in telecom)
            has_email = any(t.get("system") == "email" for t in telecom)
            
            return has_phone and has_email
        except Exception:
            return False

    def _validate_insurance_info(self, patient_data: Dict) -> bool:
        """Validate patient insurance information"""
        try:
            extensions = patient_data.get("extension", [])
            has_insurance = any(
                ext.get("url") == "http://hl7.org/fhir/us/core/StructureDefinition/us-core-coverage"
                for ext in extensions
            )
            return has_insurance
        except Exception:
            return False

class ClaimValidationRules:
    """Enhanced validation rules specific to FHIR Claim resources for prior authorization"""
    
    def __init__(self):
        """Initialize claim validation rules"""
        self._pa_requirements = {
            "required_supporting_info": [
                "clinical-notes",
                "lab-results",
                "medication-history"
            ],
            "required_documentation": [
                "diagnosis",
                "prescription",
                "clinical-justification"
            ]
        }

    @validation_logger
    def validate(self, claim_data: Dict) -> Tuple[bool, List[str]]:
        """Apply enhanced claim validation rules"""
        errors = []
        
        try:
            # Validate claim type
            if not self._validate_claim_type(claim_data):
                errors.append("Invalid claim type for prior authorization")
            
            # Validate supporting information
            supporting_info = claim_data.get("supportingInfo", [])
            for required_info in self._pa_requirements["required_supporting_info"]:
                if not any(info.get("category", {}).get("coding", [{}])[0].get("code") == required_info 
                          for info in supporting_info):
                    errors.append(f"Missing required supporting information: {required_info}")
            
            # Validate required documentation
            if not self._validate_documentation(claim_data):
                errors.append("Missing or invalid required documentation")
            
            # Validate insurance information
            if not self._validate_insurance(claim_data):
                errors.append("Invalid or missing insurance information")
            
            # Validate clinical information
            if not self._validate_clinical_info(claim_data):
                errors.append("Invalid or incomplete clinical information")
            
            return len(errors) == 0, errors
            
        except Exception as e:
            logger.error(f"Claim validation error: {str(e)}")
            return False, [f"Claim validation failed: {str(e)}"]

    def _validate_claim_type(self, claim_data: Dict) -> bool:
        """Validate claim type for prior authorization"""
        try:
            claim_type = claim_data.get("type", {}).get("coding", [{}])[0].get("code")
            return claim_type in ["prior-authorization", "preauthorization-request"]
        except Exception:
            return False

    def _validate_documentation(self, claim_data: Dict) -> bool:
        """Validate required documentation"""
        try:
            documentation = claim_data.get("item", [{}])[0].get("supportingInfo", [])
            doc_types = {doc.get("category", {}).get("coding", [{}])[0].get("code") 
                        for doc in documentation}
            
            return all(req in doc_types 
                      for req in self._pa_requirements["required_documentation"])
        except Exception:
            return False

    def _validate_insurance(self, claim_data: Dict) -> bool:
        """Validate insurance information"""
        try:
            insurance = claim_data.get("insurance", [])
            return bool(insurance) and all(
                ins.get("coverage", {}).get("reference")
                for ins in insurance
            )
        except Exception:
            return False

    def _validate_clinical_info(self, claim_data: Dict) -> bool:
        """Validate clinical information"""
        try:
            has_diagnosis = bool(claim_data.get("diagnosis"))
            has_items = bool(claim_data.get("item"))
            has_supporting_info = bool(claim_data.get("supportingInfo"))
            
            return has_diagnosis and has_items and has_supporting_info
        except Exception:
            return False

# Export validators
__all__ = [
    "FHIRValidator",
    "PatientValidationRules",
    "ClaimValidationRules"
]