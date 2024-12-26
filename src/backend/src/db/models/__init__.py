"""
Database models initialization module for the Prior Authorization Management System.
Provides HIPAA-compliant model registration with dependency validation and performance optimization.

Version: 1.0.0
"""

import logging
from typing import List, Dict, Type

from sqlalchemy.orm import declarative_base

# Import models with version tracking
from db.models.users import User  # v1.0.0
from db.models.prior_auth import PriorAuthRequest  # v1.0.0
from db.models.clinical import ClinicalData, ClinicalEvidence  # v1.0.0

# Configure logging
logger = logging.getLogger(__name__)

class ModelRegistrationError(Exception):
    """Custom exception for model registration errors."""
    pass

def _validate_model_dependencies(registered_models: List[Type[declarative_base]]) -> bool:
    """
    Validates proper model registration order and dependency relationships.
    Ensures HIPAA-compliant data model organization.

    Args:
        registered_models: List of SQLAlchemy models to validate

    Returns:
        bool: True if dependencies are valid

    Raises:
        ModelRegistrationError: If dependency validation fails
    """
    try:
        # Track model dependencies
        dependency_map: Dict[str, List[str]] = {
            'User': [],  # Base model with no dependencies
            'PriorAuthRequest': [],  # Independent model
            'ClinicalData': ['PriorAuthRequest'],  # Depends on PriorAuthRequest
            'ClinicalEvidence': ['ClinicalData']  # Depends on ClinicalData
        }

        # Validate all required models are registered
        registered_model_names = [model.__name__ for model in registered_models]
        for model_name in dependency_map.keys():
            if model_name not in registered_model_names:
                raise ModelRegistrationError(f"Required model {model_name} not registered")

        # Validate dependency order
        for model_name, dependencies in dependency_map.items():
            model_idx = registered_model_names.index(model_name)
            for dependency in dependencies:
                dep_idx = registered_model_names.index(dependency)
                if dep_idx > model_idx:
                    raise ModelRegistrationError(
                        f"Invalid registration order: {model_name} depends on {dependency}"
                    )

        logger.info("Model dependency validation successful")
        return True

    except Exception as e:
        logger.error(f"Model dependency validation failed: {str(e)}")
        raise ModelRegistrationError(f"Dependency validation failed: {str(e)}")

def _initialize_model_registry() -> None:
    """
    Initializes SQLAlchemy model registry with performance optimizations
    and HIPAA compliance settings.
    """
    try:
        # Define models in dependency order
        models = [
            User,  # Base user model
            PriorAuthRequest,  # Core PA request model
            ClinicalData,  # Clinical data with PHI
            ClinicalEvidence  # AI matching evidence
        ]

        # Validate model dependencies
        _validate_model_dependencies(models)

        # Configure model-wide settings
        for model in models:
            # Enable lazy loading by default for performance
            if hasattr(model, '__mapper__'):
                model.__mapper__.lazy_loaded_columns = True

            # Ensure HIPAA audit fields are present
            required_audit_fields = ['created_at', 'updated_at', 'version']
            for field in required_audit_fields:
                if not hasattr(model, field):
                    logger.warning(f"Model {model.__name__} missing audit field: {field}")

        logger.info("Model registry initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize model registry: {str(e)}")
        raise

# Initialize models on module import
_initialize_model_registry()

# Export models with version tracking
__all__ = [
    'User',  # v1.0.0
    'PriorAuthRequest',  # v1.0.0
    'ClinicalData',  # v1.0.0
    'ClinicalEvidence'  # v1.0.0
]

# Module version
__version__ = '1.0.0'