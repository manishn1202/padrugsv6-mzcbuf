"""
Initialization module for the integrations package that exposes core integration clients for EMR systems,
payer systems, and drug databases. Provides a unified interface for external system integrations in the
Prior Authorization Management System while maintaining HIPAA compliance and secure credential management.

Version: 1.0.0
"""

# Import core integration clients
from .drug_database import DrugDatabaseClient
from .emr import EMRClient
from .payer import (
    PayerClient,
    UnitedHealthcareClient,
    get_payer_client
)

# Package version
__version__ = '1.0.0'

# Export public interface
__all__ = [
    'DrugDatabaseClient',  # First Databank API integration client
    'EMRClient',  # FHIR-compliant EMR integration client
    'PayerClient',  # Base payer integration client
    'UnitedHealthcareClient',  # UnitedHealthcare-specific client
    'get_payer_client',  # Factory function for payer client instantiation
]

# Module docstring for package-level documentation
__doc__ = """
Prior Authorization Management System Integration Package

Provides HIPAA-compliant integration clients for:
- EMR Systems (FHIR R4)
- Payer Systems (UnitedHealthcare)
- Drug Databases (First Databank)

Features:
- Secure credential management
- Enhanced error handling
- Comprehensive audit logging
- Request tracing
- Performance monitoring
- Circuit breaker pattern
- Automatic retries
- Connection pooling

Version: 1.0.0
"""