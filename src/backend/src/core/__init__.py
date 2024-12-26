"""
Core module initialization for Prior Authorization Management System.
Provides centralized access to constants, exceptions, and logging utilities
while maintaining HIPAA compliance and security controls.

Version: 1.0.0
"""

# Import constants and enums
from core.constants import (
    PriorAuthStatus,
    UserRole,
    DocumentType,
    NotificationType
)

# Import exception classes
from core.exceptions import (
    BaseAppException,
    ValidationException,
    AuthenticationException,
    AuthorizationException
)

# Import logging utilities
from core.logging import (
    setup_logging,
    get_request_logger
)

# Package version
__version__ = '1.0.0'

# Initialize core module logging
setup_logging(
    app_name='prior_auth_core',
    log_level='INFO',
    enable_cloudwatch=True
)

# Module logger
LOGGER = get_request_logger('core_module')

# Log module initialization
LOGGER.info(
    f"Core module initialized - Version {__version__}",
    extra={'module': 'core', 'version': __version__}
)

# Export public interface
__all__ = [
    # Version
    '__version__',
    
    # Status and Role Enums
    'PriorAuthStatus',
    'UserRole',
    'DocumentType',
    'NotificationType',
    
    # Exception Classes
    'BaseAppException',
    'ValidationException',
    'AuthenticationException', 
    'AuthorizationException',
    
    # Logging Utilities
    'setup_logging',
    'get_request_logger'
]

# Validate core dependencies are properly initialized
def _validate_core_initialization():
    """
    Validates that all core dependencies are properly initialized.
    Checks enum values, exception classes and logging configuration.
    """
    try:
        # Validate enums
        assert PriorAuthStatus.SUBMITTED.value == "SUBMITTED"
        assert UserRole.PROVIDER.value == "PROVIDER"
        assert DocumentType.CLINICAL_NOTE.value == "CLINICAL_NOTE"
        assert NotificationType.REQUEST_SUBMITTED.value == "REQUEST_SUBMITTED"
        
        # Validate exceptions can be instantiated
        BaseAppException("Test exception")
        ValidationException("Test validation", {"field": "error"})
        
        # Validate logger is configured
        LOGGER.debug("Core initialization validation complete")
        
    except Exception as e:
        LOGGER.error(
            f"Core module initialization failed: {str(e)}",
            extra={'error': str(e)}
        )
        raise RuntimeError("Failed to initialize core module") from e

# Run initialization validation
_validate_core_initialization()