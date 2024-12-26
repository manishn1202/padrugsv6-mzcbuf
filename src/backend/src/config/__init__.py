"""
Configuration initialization module for Prior Authorization Management System.
Consolidates and exports all configuration settings with HIPAA compliance,
security controls, and monitoring setup.

Version: 1.0.0
"""

import logging
from os import environ  # version: 3.11+
from typing import Dict, Optional

# Internal imports
from config.settings import APP_SETTINGS
from config.logging import configure_logging
from config.security import initialize_security
from config.database import init_db

# Configure root logger
logger = logging.getLogger(__name__)

# Global environment setting
ENV = environ.get('ENV', 'development')

async def initialize_app() -> Dict:
    """
    Initializes all application configurations with comprehensive validation,
    security controls, and monitoring setup.

    Returns:
        Dict: Complete application configuration dictionary with validated settings

    Raises:
        RuntimeError: If initialization fails
        ValueError: If configuration validation fails
    """
    try:
        logger.info(f"Initializing Prior Authorization Management System in {ENV} environment")

        # Step 1: Validate environment and prerequisites
        if ENV not in ['development', 'staging', 'production']:
            raise ValueError(f"Invalid environment: {ENV}")

        # Step 2: Configure logging with PHI protection
        logging_config = configure_logging(
            environment=ENV,
            additional_config={
                'app_name': APP_SETTINGS['APP_NAME'],
                'include_phi_masking': True
            }
        )
        logger.info("Logging configuration initialized with PHI protection")

        # Step 3: Initialize security configurations
        security_initialized = await initialize_security()
        if not security_initialized:
            raise RuntimeError("Security initialization failed")
        logger.info("Security controls initialized successfully")

        # Step 4: Initialize database connections
        engine, session_factory = await init_db()
        logger.info("Database connections initialized successfully")

        # Step 5: Validate complete configuration
        config = {
            'app': APP_SETTINGS,
            'environment': ENV,
            'logging': logging_config,
            'database': {
                'engine': engine,
                'session_factory': session_factory
            }
        }

        # Step 6: Perform final validation
        _validate_configuration(config)
        logger.info("Configuration validation completed successfully")

        return config

    except Exception as e:
        logger.error(f"Application initialization failed: {str(e)}")
        raise RuntimeError(f"Failed to initialize application: {str(e)}") from e

def _validate_configuration(config: Dict) -> None:
    """
    Validates the complete configuration against HIPAA requirements.

    Args:
        config: Configuration dictionary to validate

    Raises:
        ValueError: If configuration is invalid
    """
    # Validate required settings
    required_settings = [
        ('app', 'APP_NAME'),
        ('app', 'DEBUG'),
        ('environment',),
        ('logging',),
        ('database', 'engine'),
        ('database', 'session_factory')
    ]

    for setting_path in required_settings:
        current = config
        for key in setting_path:
            if key not in current:
                raise ValueError(f"Missing required configuration: {'.'.join(setting_path)}")
            current = current[key]

    # Validate environment-specific settings
    if config['environment'] == 'production':
        if config['app']['DEBUG']:
            raise ValueError("Debug mode must be disabled in production")

    logger.info("Configuration validation completed")

def get_app_settings() -> Dict:
    """
    Retrieves the current application settings.

    Returns:
        Dict: Current application settings
    """
    return APP_SETTINGS

# Export public interface
__all__ = [
    'initialize_app',
    'get_app_settings',
    'APP_SETTINGS',
    'engine',
    'SessionLocal'
]

# Initialize logging for the configuration module
logger.setLevel(logging.INFO)