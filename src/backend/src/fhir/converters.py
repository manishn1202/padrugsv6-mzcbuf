"""
FHIR Resource Converters for Prior Authorization System
Handles bidirectional conversion between internal models and FHIR R4 resources

Version: 1.0.0
Author: Prior Authorization System Team
"""

from typing import Dict, List, Optional, Union
from datetime import datetime
import logging
from functools import wraps

# fhir.resources v6.5+
from fhir.resources import construct_fhir_element
from fhir.resources.patient import Patient
from fhir.resources.claim import Claim
from fhir.resources.bundle import Bundle

# pydantic v2.0+
from pydantic import ValidationError

# Internal imports
from .models import FHIRBaseModel
from .validators import FHIRValidator, PatientValidationRules, ClaimValidationRules

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
FHIR_VERSION = "4.0.1"
HIPAA_COMPLIANCE_RULES = {
    "phi_fields": [
        "identifier", "name", "telecom", "address", "birthDate",
        "ssn", "mrn", "insurance"
    ],
    "required_security": {
        "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
        "code": "R",  # Restricted
        "display": "Restricted"
    }
}

def monitor_performance(func):
    """Decorator for monitoring converter performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.utcnow()
        try:
            result = func(*args, **kwargs)
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"Converter {func.__name__} completed in {duration}s")
            return result
        except Exception as e:
            logger.error(f"Converter error in {func.__name__}: {str(e)}")
            raise
    return wrapper

def validate_hipaa_compliance(func):
    """Decorator for validating HIPAA compliance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        if isinstance(result, dict):
            # Validate PHI fields have security tags
            meta = result.get("meta", {})
            security = meta.get("security", [])
            if not any(tag.get("code") == HIPAA_COMPLIANCE_RULES["required_security"]["code"] 
                      for tag in security):
                raise ValueError("Missing required HIPAA security tags")
        return result
    return wrapper

class BaseConverter:
    """Base converter class with HIPAA compliance and FHIR validation"""
    
    def __init__(self, resource_type: str, compliance_rules: Optional[Dict] = None):
        """Initialize base converter with validation support"""
        self._resource_type = resource_type
        self._validator = FHIRValidator(resource_type)
        self._validation_cache = {}
        self._compliance_rules = compliance_rules or HIPAA_COMPLIANCE_RULES

    def _add_security_tags(self, resource_data: Dict) -> Dict:
        """Add HIPAA security tags to resource"""
        if "meta" not in resource_data:
            resource_data["meta"] = {}
        if "security" not in resource_data["meta"]:
            resource_data["meta"]["security"] = []
            
        resource_data["meta"]["security"].append(
            self._compliance_rules["required_security"]
        )
        return resource_data

    @validate_hipaa_compliance
    def validate_fhir(self, fhir_data: Dict, strict_mode: bool = True) -> Dict:
        """Validate FHIR resource with HIPAA compliance"""
        # Validate resource structure
        valid, errors = self._validator.validate_resource(fhir_data, strict_mode)
        if not valid:
            raise ValidationError(f"FHIR validation failed: {errors}")
            
        # Add required security tags
        fhir_data = self._add_security_tags(fhir_data)
        
        return fhir_data

class PatientConverter(BaseConverter):
    """Patient resource converter with PA-specific extensions"""
    
    def __init__(self, pa_config: Optional[Dict] = None):
        """Initialize patient converter with PA extensions"""
        super().__init__("Patient")
        self._pa_extensions = pa_config or {}
        self._patient_validator = PatientValidationRules()

    @monitor_performance
    @validate_hipaa_compliance
    def to_fhir(self, patient_data: Dict, pa_context: Optional[Dict] = None) -> Dict:
        """Convert internal patient data to FHIR Patient resource"""
        try:
            # Create base FHIR Patient
            fhir_patient = {
                "resourceType": "Patient",
                "id": patient_data.get("id"),
                "meta": {
                    "versionId": str(datetime.utcnow().timestamp()),
                    "lastUpdated": datetime.utcnow().isoformat(),
                    "profile": [
                        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
                    ]
                },
                "identifier": self._convert_identifiers(patient_data.get("identifiers", [])),
                "active": True,
                "name": self._convert_names(patient_data.get("name", {})),
                "telecom": self._convert_telecom(patient_data.get("contact", {})),
                "gender": patient_data.get("gender"),
                "birthDate": patient_data.get("birth_date"),
                "address": self._convert_addresses(patient_data.get("addresses", []))
            }

            # Add PA-specific extensions
            if pa_context:
                fhir_patient["extension"] = self._add_pa_extensions(pa_context)

            # Add insurance information
            if patient_data.get("insurance"):
                fhir_patient["extension"].append(self._convert_insurance(
                    patient_data["insurance"]
                ))

            # Validate FHIR structure and HIPAA compliance
            valid, errors = self._patient_validator.validate(fhir_patient)
            if not valid:
                raise ValidationError(f"Patient validation failed: {errors}")

            return self.validate_fhir(fhir_patient)

        except Exception as e:
            logger.error(f"Patient conversion error: {str(e)}")
            raise

    @monitor_performance
    def from_fhir(self, fhir_data: Dict) -> Dict:
        """Convert FHIR Patient resource to internal format"""
        try:
            # Validate incoming FHIR data
            fhir_data = self.validate_fhir(fhir_data)

            # Convert to internal format
            internal_patient = {
                "id": fhir_data.get("id"),
                "identifiers": self._extract_identifiers(fhir_data.get("identifier", [])),
                "name": self._extract_names(fhir_data.get("name", [])),
                "contact": self._extract_telecom(fhir_data.get("telecom", [])),
                "gender": fhir_data.get("gender"),
                "birth_date": fhir_data.get("birthDate"),
                "addresses": self._extract_addresses(fhir_data.get("address", [])),
                "insurance": self._extract_insurance(fhir_data.get("extension", []))
            }

            return internal_patient

        except Exception as e:
            logger.error(f"FHIR Patient conversion error: {str(e)}")
            raise

    def _convert_identifiers(self, identifiers: List[Dict]) -> List[Dict]:
        """Convert internal identifiers to FHIR format"""
        fhir_identifiers = []
        for identifier in identifiers:
            fhir_identifiers.append({
                "system": identifier.get("system"),
                "value": identifier.get("value"),
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": identifier.get("type", "MR")
                    }]
                }
            })
        return fhir_identifiers

    def _convert_names(self, name_data: Dict) -> List[Dict]:
        """Convert internal name format to FHIR format"""
        return [{
            "use": "official",
            "family": name_data.get("family"),
            "given": name_data.get("given", []),
            "prefix": name_data.get("prefix", []),
            "suffix": name_data.get("suffix", [])
        }]

    def _convert_telecom(self, contact_data: Dict) -> List[Dict]:
        """Convert internal contact info to FHIR telecom format"""
        telecom = []
        for system, value in contact_data.items():
            if value:
                telecom.append({
                    "system": system,
                    "value": value,
                    "use": "home"
                })
        return telecom

    def _convert_addresses(self, addresses: List[Dict]) -> List[Dict]:
        """Convert internal addresses to FHIR format"""
        return [{
            "use": addr.get("use", "home"),
            "type": addr.get("type", "physical"),
            "line": addr.get("lines", []),
            "city": addr.get("city"),
            "state": addr.get("state"),
            "postalCode": addr.get("postal_code"),
            "country": addr.get("country", "USA")
        } for addr in addresses]

    def _add_pa_extensions(self, pa_context: Dict) -> List[Dict]:
        """Add PA-specific extensions to FHIR Patient"""
        extensions = []
        
        # Add US Core extensions
        if pa_context.get("race"):
            extensions.append({
                "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
                "extension": [{
                    "url": "ombCategory",
                    "valueCoding": {
                        "system": "urn:oid:2.16.840.1.113883.6.238",
                        "code": pa_context["race"]
                    }
                }]
            })

        if pa_context.get("ethnicity"):
            extensions.append({
                "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
                "extension": [{
                    "url": "ombCategory",
                    "valueCoding": {
                        "system": "urn:oid:2.16.840.1.113883.6.238",
                        "code": pa_context["ethnicity"]
                    }
                }]
            })

        return extensions

    def _convert_insurance(self, insurance_data: Dict) -> Dict:
        """Convert insurance information to FHIR extension"""
        return {
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-coverage",
            "valueReference": {
                "reference": f"Coverage/{insurance_data.get('id')}",
                "display": insurance_data.get("display")
            }
        }

    def _extract_identifiers(self, fhir_identifiers: List[Dict]) -> List[Dict]:
        """Extract internal identifiers from FHIR format"""
        return [{
            "system": identifier.get("system"),
            "value": identifier.get("value"),
            "type": identifier.get("type", {}).get("coding", [{}])[0].get("code", "MR")
        } for identifier in fhir_identifiers]

    def _extract_names(self, fhir_names: List[Dict]) -> Dict:
        """Extract internal name format from FHIR format"""
        if not fhir_names:
            return {}
        name = fhir_names[0]  # Use first name entry
        return {
            "family": name.get("family"),
            "given": name.get("given", []),
            "prefix": name.get("prefix", []),
            "suffix": name.get("suffix", [])
        }

    def _extract_telecom(self, fhir_telecom: List[Dict]) -> Dict:
        """Extract internal contact info from FHIR telecom format"""
        contact = {}
        for telecom in fhir_telecom:
            system = telecom.get("system")
            if system:
                contact[system] = telecom.get("value")
        return contact

    def _extract_addresses(self, fhir_addresses: List[Dict]) -> List[Dict]:
        """Extract internal addresses from FHIR format"""
        return [{
            "use": addr.get("use", "home"),
            "type": addr.get("type", "physical"),
            "lines": addr.get("line", []),
            "city": addr.get("city"),
            "state": addr.get("state"),
            "postal_code": addr.get("postalCode"),
            "country": addr.get("country", "USA")
        } for addr in fhir_addresses]

    def _extract_insurance(self, fhir_extensions: List[Dict]) -> Optional[Dict]:
        """Extract insurance information from FHIR extensions"""
        for ext in fhir_extensions:
            if ext.get("url") == "http://hl7.org/fhir/us/core/StructureDefinition/us-core-coverage":
                reference = ext.get("valueReference", {})
                return {
                    "id": reference.get("reference", "").split("/")[-1],
                    "display": reference.get("display")
                }
        return None

# Export converters
__all__ = [
    "BaseConverter",
    "PatientConverter"
]