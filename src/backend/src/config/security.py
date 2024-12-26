"""
HIPAA-compliant security configuration module for Prior Authorization Management System.
Implements secure authentication, encryption, and audit logging with AWS KMS integration.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional
import boto3  # version: 1.26.0
from passlib.context import CryptContext  # version: 1.7.4
from cryptography.fernet import Fernet  # version: 41.0.0

from config.settings import SECURITY_SETTINGS
from core.security import SecurityContext

# Configure logging
logger = logging.getLogger(__name__)

# Import security settings with validation
JWT_SECRET_KEY = SECURITY_SETTINGS['SECRET_KEY']
if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY is required")

JWT_ALGORITHM = SECURITY_SETTINGS['JWT_ALGORITHM']
ACCESS_TOKEN_EXPIRE_MINUTES = SECURITY_SETTINGS['ACCESS_TOKEN_EXPIRE_MINUTES']
REFRESH_TOKEN_EXPIRE_DAYS = SECURITY_SETTINGS['REFRESH_TOKEN_EXPIRE_DAYS']
KMS_KEY_ID = SECURITY_SETTINGS['KMS_KEY_ID']

# HIPAA-compliant password hashing configuration
PASSWORD_CONTEXT = CryptContext(
    schemes=['bcrypt'],
    deprecated='auto',
    bcrypt__rounds=12  # Industry standard for HIPAA compliance
)

# Encryption configuration
ENCRYPTION_KEY_LENGTH = 32  # 256-bit keys for HIPAA compliance

class SecurityConfig:
    """HIPAA-compliant security configuration management class."""
    
    def __init__(self):
        """Initializes security configuration with HIPAA compliance."""
        self._kms_client = boto3.client(
            'kms',
            config=boto3.Config(
                retries={'max_attempts': 3},
                connect_timeout=5,
                read_timeout=10
            )
        )
        self._pwd_context = PASSWORD_CONTEXT
        self._encryption_key = None
        self._audit_config = {
            'enabled': True,
            'log_level': logging.INFO,
            'include_user_context': True
        }
        
        # Validate initial configuration
        self.validate_configuration()

    def rotate_encryption_key(self) -> bool:
        """
        Rotates encryption key with audit logging.
        
        Returns:
            bool: True if rotation successful
        
        Raises:
            RuntimeError: If key rotation fails
        """
        try:
            # Generate new key using KMS
            new_key = self._get_new_encryption_key()
            
            # Validate new key
            if len(new_key) != ENCRYPTION_KEY_LENGTH:
                raise ValueError("Invalid key length")
            
            # Log key rotation event (without sensitive data)
            logger.info("Encryption key rotation initiated", extra={
                'event_type': 'key_rotation',
                'timestamp': self._get_timestamp()
            })
            
            # Update current key
            self._encryption_key = new_key
            
            return True
            
        except Exception as e:
            logger.error(f"Key rotation failed: {str(e)}")
            raise RuntimeError("Failed to rotate encryption key") from e

    def validate_configuration(self) -> bool:
        """
        Validates security configuration against HIPAA requirements.
        
        Returns:
            bool: True if configuration is HIPAA-compliant
        
        Raises:
            ValueError: If configuration fails validation
        """
        try:
            # Validate JWT settings
            if len(JWT_SECRET_KEY) < 32:
                raise ValueError("JWT secret key must be at least 32 characters")
                
            if JWT_ALGORITHM not in ['HS256', 'HS384', 'HS512']:
                raise ValueError("Invalid JWT algorithm")
            
            # Validate KMS configuration
            try:
                self._kms_client.describe_key(KeyId=KMS_KEY_ID)
            except Exception as e:
                raise ValueError(f"Invalid KMS key configuration: {str(e)}")
            
            # Validate password configuration
            if self._pwd_context.default_scheme() != 'bcrypt':
                raise ValueError("Password hashing must use bcrypt")
            
            # Validate audit logging
            if not self._audit_config['enabled']:
                raise ValueError("Audit logging must be enabled")
            
            logger.info("Security configuration validated successfully")
            return True
            
        except Exception as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            raise

    def _get_new_encryption_key(self) -> bytes:
        """
        Generates new encryption key using KMS.
        
        Returns:
            bytes: New encryption key
            
        Raises:
            RuntimeError: If key generation fails
        """
        try:
            response = self._kms_client.generate_data_key(
                KeyId=KMS_KEY_ID,
                KeySpec='AES_256',
                EncryptionContext={
                    'purpose': 'data_encryption',
                    'application': 'prior_auth_system'
                }
            )
            return response['Plaintext']
        except Exception as e:
            logger.error(f"Failed to generate new encryption key: {str(e)}")
            raise RuntimeError("Key generation failed") from e

    @staticmethod
    def _get_timestamp() -> str:
        """Returns ISO format timestamp for audit logging."""
        from datetime import datetime
        return datetime.utcnow().isoformat()

def initialize_security() -> bool:
    """
    Initializes security configurations with HIPAA compliance validation.
    
    Returns:
        bool: True if initialization successful
        
    Raises:
        SecurityConfigError: If initialization fails
    """
    try:
        # Create and validate security configuration
        security_config = SecurityConfig()
        
        # Initialize encryption key
        with SecurityContext() as ctx:
            ctx.audit_log("Security initialization started")
            
            # Verify KMS access
            if not KMS_KEY_ID:
                raise ValueError("KMS key ID is required")
            
            # Initialize password context
            if not PASSWORD_CONTEXT.verify("test", PASSWORD_CONTEXT.hash("test")):
                raise RuntimeError("Password context verification failed")
            
            ctx.audit_log("Security initialization completed")
        
        logger.info("Security initialization successful")
        return True
        
    except Exception as e:
        logger.error(f"Security initialization failed: {str(e)}")
        raise

def get_encryption_key() -> bytes:
    """
    Retrieves and validates encryption key from AWS KMS with audit logging.
    
    Returns:
        bytes: Validated encryption key bytes
        
    Raises:
        RuntimeError: If key retrieval fails
    """
    try:
        kms_client = boto3.client('kms')
        response = kms_client.generate_data_key(
            KeyId=KMS_KEY_ID,
            KeySpec='AES_256',
            EncryptionContext={
                'purpose': 'data_encryption',
                'application': 'prior_auth_system'
            }
        )
        
        # Log key generation (without sensitive data)
        logger.info("Encryption key generated", extra={
            'event_type': 'key_generation',
            'timestamp': SecurityConfig._get_timestamp()
        })
        
        return response['Plaintext']
        
    except Exception as e:
        logger.error(f"Failed to retrieve encryption key: {str(e)}")
        raise RuntimeError("Encryption key retrieval failed") from e

def get_security_context() -> SecurityContext:
    """
    Creates and returns a SecurityContext instance with audit capability.
    
    Returns:
        SecurityContext: Configured security context with audit logging
        
    Raises:
        RuntimeError: If context creation fails
    """
    try:
        return SecurityContext()
    except Exception as e:
        logger.error(f"Failed to create security context: {str(e)}")
        raise RuntimeError("Security context creation failed") from e

# Export public interface
__all__ = [
    'initialize_security',
    'get_security_context',
    'SecurityConfig'
]