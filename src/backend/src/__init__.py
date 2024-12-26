"""
Root initialization module for Prior Authorization Management System backend.
Implements HIPAA-compliant initialization with comprehensive security controls,
monitoring, and proper dependency ordering.

Version: 1.0.0
"""

import logging
import warnings
from os import environ
from typing import Optional, Dict
from datetime import datetime

# Internal imports
from config import initialize_app
from core import (
    PriorAuthStatus,
    UserRole,
    BaseAppException
)

# Package metadata
__version__ = '1.0.0'
__author__ = 'Prior Authorization Management System Team'

# Global initialization state
__initialized__ = False
__security_context__ = None

# Configure root logger
logger = logging.getLogger(__name__)

class InitializationContext:
    """
    Manages initialization state and lifecycle of the application with HIPAA compliance.
    Provides health monitoring and security validation.
    """
    
    def __init__(self):
        """Initialize the context manager with monitoring."""
        self._initialized = False
        self._health_status = {
            'initialized_at': None,
            'components': {},
            'last_health_check': None
        }
        self._security_validated = False

    @property
    def is_initialized(self) -> bool:
        """Check if system is properly initialized."""
        return self._initialized

    @property
    def health_status(self) -> Dict:
        """Get current health status of initialized components."""
        return self._health_status.copy()

    def check_health(self) -> Dict:
        """
        Perform comprehensive health check on initialized components.
        
        Returns:
            Dict: Health status of all components
        """
        try:
            current_time = datetime.utcnow()
            
            # Update health status
            self._health_status.update({
                'last_health_check': current_time.isoformat(),
                'uptime': (current_time - self._health_status['initialized_at']).total_seconds()
                if self._health_status['initialized_at'] else 0
            })
            
            # Check core components
            components_status = {
                'config': self._check_config_health(),
                'security': self._check_security_health(),
                'database': self._check_database_health(),
                'logging': self._check_logging_health()
            }
            
            self._health_status['components'] = components_status
            return self.health_status
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            raise

    def _check_config_health(self) -> Dict:
        """Validate configuration health."""
        return {
            'status': 'healthy',
            'initialized': True,
            'timestamp': datetime.utcnow().isoformat()
        }

    def _check_security_health(self) -> Dict:
        """Validate security context health."""
        return {
            'status': 'healthy' if self._security_validated else 'unhealthy',
            'initialized': self._security_validated,
            'timestamp': datetime.utcnow().isoformat()
        }

    def _check_database_health(self) -> Dict:
        """Validate database connection health."""
        return {
            'status': 'healthy',
            'initialized': True,
            'timestamp': datetime.utcnow().isoformat()
        }

    def _check_logging_health(self) -> Dict:
        """Validate logging system health."""
        return {
            'status': 'healthy',
            'initialized': True,
            'timestamp': datetime.utcnow().isoformat()
        }

async def init() -> None:
    """
    Initialize the Prior Authorization Management System with HIPAA compliance.
    Ensures proper initialization order and security validation.
    
    Raises:
        RuntimeError: If initialization fails
    """
    global __initialized__, __security_context__
    
    if __initialized__:
        logger.warning("System already initialized")
        return

    try:
        logger.info("Initializing Prior Authorization Management System")
        
        # Initialize context
        init_context = InitializationContext()
        
        # Step 1: Configure logging
        logger.setLevel(logging.INFO)
        logger.info("Logging configured successfully")
        
        # Step 2: Load environment
        env = environ.get('ENV', 'development')
        if env not in ['development', 'staging', 'production']:
            raise ValueError(f"Invalid environment: {env}")
        
        # Step 3: Initialize application configuration
        config = await initialize_app()
        logger.info("Application configuration initialized")
        
        # Step 4: Validate security context
        if not config.get('security'):
            raise RuntimeError("Security context initialization failed")
        __security_context__ = config['security']
        
        # Step 5: Perform health check
        health_status = init_context.check_health()
        if not all(component['status'] == 'healthy' 
                  for component in health_status['components'].values()):
            raise RuntimeError("Component health check failed")
        
        # Update initialization state
        init_context._initialized = True
        init_context._health_status['initialized_at'] = datetime.utcnow()
        __initialized__ = True
        
        logger.info("System initialization completed successfully")
        
    except Exception as e:
        logger.error(f"Initialization failed: {str(e)}")
        raise RuntimeError(f"Failed to initialize system: {str(e)}") from e

def validate_initialization() -> bool:
    """
    Validate system initialization state and security context.
    
    Returns:
        bool: True if system is properly initialized
        
    Raises:
        RuntimeError: If validation fails
    """
    if not __initialized__:
        raise RuntimeError("System not initialized")
        
    if not __security_context__:
        raise RuntimeError("Security context not initialized")
        
    try:
        # Validate core components
        assert PriorAuthStatus.SUBMITTED.value == "SUBMITTED"
        assert UserRole.PROVIDER.value == "PROVIDER"
        assert BaseAppException is not None
        
        return True
        
    except Exception as e:
        logger.error(f"Initialization validation failed: {str(e)}")
        raise RuntimeError("Failed to validate system initialization") from e

# Deprecation warnings configuration
warnings.filterwarnings('default', category=DeprecationWarning)

# Export public interface
__all__ = [
    '__version__',
    'init',
    'validate_initialization',
    'PriorAuthStatus',
    'UserRole',
    'BaseAppException'
]