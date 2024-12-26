"""
Unit test package initialization module for Prior Authorization Management System.
Configures secure test environment with HIPAA compliance measures and audit logging.

Version: 1.0.0
"""

import os  # version: latest
import logging  # version: latest
import pytest  # version: 7.3.1
import pytest_asyncio  # version: 0.21.0
import boto3  # version: 1.26.0
from cryptography.fernet import Fernet  # version: 41.0.0

from tests.conftest import TEST_DATABASE_URL, TEST_PERFORMANCE_SETTINGS
from src.config.settings import Settings
from src.config.logging import configure_logging
from src.core.logging import HIPAACompliantFormatter, CloudWatchHandler

# Register test plugins with security annotations
pytest_plugins = [
    "tests.unit.fixtures.auth",  # Authentication fixtures
    "tests.unit.fixtures.database",  # Database fixtures
    "tests.unit.fixtures.api",  # API test fixtures
    "tests.unit.fixtures.mocks"  # Mock service fixtures
]

# Test environment configuration with security controls
UNIT_TEST_MARKER = pytest.mark.unit
TEST_TIMEOUT = 60  # seconds
SECURITY_LEVEL = "HIPAA_COMPLIANT"
LOG_LEVEL = "INFO"

# Test data encryption configuration
TEST_ENCRYPTION_KEY = Fernet.generate_key()
TEST_CIPHER_SUITE = Fernet(TEST_ENCRYPTION_KEY)

def pytest_configure(config):
    """
    Configure pytest with enhanced security measures and HIPAA compliance.
    
    Args:
        config: Pytest configuration object
    """
    # Set secure test environment variables
    os.environ["ENV"] = "test"
    os.environ["TESTING"] = "1"
    os.environ["HIPAA_COMPLIANT"] = "true"
    os.environ["TEST_ENCRYPTION_KEY"] = TEST_ENCRYPTION_KEY.decode()
    
    # Configure HIPAA-compliant test logging
    log_config = configure_logging(
        environment="test",
        additional_config={
            "handlers": {
                "unit_test": {
                    "class": "logging.FileHandler",
                    "filename": "unit_test.log",
                    "mode": "w",
                    "level": LOG_LEVEL,
                    "formatter": "hipaa_compliant"
                },
                "cloudwatch": {
                    "()": CloudWatchHandler,
                    "log_group": "prior-auth-unit-tests",
                    "log_stream": "unit-tests",
                    "kms_key_id": os.getenv("AWS_KMS_KEY_ID"),
                    "formatter": "hipaa_compliant"
                }
            }
        }
    )
    logging.config.dictConfig(log_config)
    
    # Register custom test markers with security annotations
    config.addinivalue_line(
        "markers",
        "unit: mark test as unit test with security isolation"
    )
    config.addinivalue_line(
        "markers", 
        "hipaa: mark test as requiring HIPAA compliance validation"
    )
    config.addinivalue_line(
        "markers",
        "phi_data: mark test as containing protected health information"
    )
    
    # Configure test timeouts for security boundaries
    config.addinivalue_line(
        "timeout",
        str(TEST_TIMEOUT)
    )
    
    # Set up secure test database configuration
    Settings.configure_test_database(
        url=TEST_DATABASE_URL,
        performance_settings=TEST_PERFORMANCE_SETTINGS,
        encryption_key=TEST_ENCRYPTION_KEY
    )
    
    # Configure test coverage tracking
    config.option.cov_config = ".coveragerc"
    config.option.cov_branch = True
    config.option.cov_report = {
        "term-missing": True,
        "html": "coverage_report"
    }

def setup_secure_logging(log_level: str) -> None:
    """
    Configure secure logging with PHI protection for unit tests.
    
    Args:
        log_level: Logging level to use
    """
    # Initialize CloudWatch logger for test monitoring
    cloudwatch = boto3.client('logs')
    
    # Create HIPAA-compliant formatter
    formatter = HIPAACompliantFormatter(
        mask_char="*",
        mask_length=8,
        sensitive_fields=[
            "patient_name", "dob", "ssn", "mrn",
            "address", "phone", "email", "insurance_id"
        ]
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Add secure file handler
    file_handler = logging.FileHandler("unit_test.log")
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
    
    # Add CloudWatch handler if AWS credentials available
    if os.getenv("AWS_ACCESS_KEY_ID"):
        cloudwatch_handler = CloudWatchHandler(
            log_group="prior-auth-unit-tests",
            log_stream="unit-tests",
            kms_key_id=os.getenv("AWS_KMS_KEY_ID")
        )
        cloudwatch_handler.setFormatter(formatter)
        root_logger.addHandler(cloudwatch_handler)

    logging.info(
        "Unit test logging configured",
        extra={
            "security_level": SECURITY_LEVEL,
            "environment": "test"
        }
    )

# Initialize secure logging on module import
setup_secure_logging(LOG_LEVEL)

# Export public interface
__all__ = [
    "pytest_plugins",
    "UNIT_TEST_MARKER",
    "SECURITY_LEVEL",
    "TEST_ENCRYPTION_KEY",
    "TEST_CIPHER_SUITE"
]