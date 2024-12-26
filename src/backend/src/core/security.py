"""
Core security module implementing HIPAA-compliant security features for the Prior Authorization Management System.
Provides secure password hashing, JWT token management, encryption, and secure context management.

Version: 1.0.0
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from base64 import b64encode, b64decode

# Third-party imports with versions
import jwt  # python-jose[cryptography]==3.3.0
import boto3  # boto3==1.26.0
from passlib.context import CryptContext  # passlib[bcrypt]==1.7.4
from cryptography.fernet import Fernet  # cryptography==41.0.0
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from core.constants import UserRole

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is required")

KMS_KEY_ID = os.getenv('KMS_KEY_ID')
if not KMS_KEY_ID:
    raise ValueError("KMS_KEY_ID environment variable is required")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
MIN_PASSWORD_LENGTH = 12

# Initialize password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # HIPAA-compliant work factor
)

def get_password_hash(password: str) -> str:
    """
    Creates a secure password hash using bcrypt with HIPAA-compliant settings.
    
    Args:
        password: Plain text password to hash
        
    Returns:
        str: Securely hashed password
        
    Raises:
        ValueError: If password doesn't meet minimum requirements
    """
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a password against its hash using constant-time comparison.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Previously hashed password to compare against
        
    Returns:
        bool: True if password matches hash, False otherwise
    """
    if not plain_password or not hashed_password:
        return False
    
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a secure JWT access token with role-based claims.
    
    Args:
        data: Dictionary containing claims to encode in token
        expires_delta: Optional custom expiration time
        
    Returns:
        str: Encoded JWT access token
        
    Raises:
        ValueError: If required claims are missing
    """
    if not data.get("sub"):
        raise ValueError("Subject claim is required")
    
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "token_type": "access"
    })
    
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Token creation error: {str(e)}")
        raise

def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Creates a long-lived JWT refresh token with restricted claims.
    
    Args:
        data: Dictionary containing claims to encode in token
        
    Returns:
        str: Encoded JWT refresh token
    """
    to_encode = {
        "sub": data.get("sub"),
        "role": data.get("role"),
        "token_type": "refresh",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    }
    
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Refresh token creation error: {str(e)}")
        raise

def verify_token(token: str) -> Dict[str, Any]:
    """
    Verifies and decodes a JWT token with role validation.
    
    Args:
        token: JWT token to verify
        
    Returns:
        dict: Decoded token payload
        
    Raises:
        jwt.JWTError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if not payload.get("sub") or not payload.get("exp"):
            raise jwt.JWTError("Missing required claims")
            
        # Verify token hasn't expired
        exp = datetime.fromtimestamp(payload["exp"])
        if datetime.utcnow() >= exp:
            raise jwt.JWTError("Token has expired")
            
        # Validate role if present
        if role := payload.get("role"):
            if role not in [r.value for r in UserRole]:
                raise jwt.JWTError("Invalid role claim")
                
        return payload
        
    except jwt.JWTError as e:
        logger.error(f"Token verification error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected token verification error: {str(e)}")
        raise jwt.JWTError(str(e))

class SecurityContext:
    """
    HIPAA-compliant security context manager for encryption operations using AWS KMS.
    Provides secure key management and audit logging.
    """
    
    def __init__(self):
        """Initialize security context with KMS integration."""
        self._kms_client = boto3.client('kms')
        self._data_key = None
        self._fernet = None
        self._audit_context = {
            "created_at": datetime.utcnow(),
            "operations": []
        }

    def __enter__(self):
        """
        Enters security context with audit logging.
        
        Returns:
            SecurityContext: Self reference
            
        Raises:
            RuntimeError: If KMS key is not accessible
        """
        try:
            # Generate data key using KMS
            response = self._kms_client.generate_data_key(
                KeyId=KMS_KEY_ID,
                KeySpec='AES_256'
            )
            
            # Store encrypted key for later use
            self._data_key = {
                'plaintext': response['Plaintext'],
                'ciphertext': response['CiphertextBlob']
            }
            
            # Initialize Fernet cipher
            self._fernet = Fernet(b64encode(self._data_key['plaintext']))
            
            logger.info("Security context initialized successfully")
            return self
            
        except Exception as e:
            logger.error(f"Failed to initialize security context: {str(e)}")
            raise RuntimeError("Failed to initialize security context") from e

    def __exit__(self, exc_type, exc_value, traceback):
        """
        Securely exits security context and cleans up resources.
        
        Args:
            exc_type: Exception type if an error occurred
            exc_value: Exception value if an error occurred
            traceback: Exception traceback if an error occurred
        """
        try:
            # Securely zero out encryption keys
            if self._data_key:
                self._data_key['plaintext'] = b'\x00' * len(self._data_key['plaintext'])
                self._data_key = None
            
            self._fernet = None
            
            # Log audit trail
            logger.info("Security context closed", extra=self._audit_context)
            
        except Exception as e:
            logger.error(f"Error during security context cleanup: {str(e)}")
            
        finally:
            # Ensure KMS client is closed
            if self._kms_client:
                self._kms_client.close()

    def encrypt(self, data: bytes) -> bytes:
        """
        Encrypts data using Fernet with KMS-derived key.
        
        Args:
            data: Bytes to encrypt
            
        Returns:
            bytes: Encrypted data
            
        Raises:
            ValueError: If input data is invalid
            RuntimeError: If encryption fails
        """
        if not isinstance(data, bytes):
            raise ValueError("Input must be bytes")
            
        try:
            encrypted_data = self._fernet.encrypt(data)
            
            self._audit_context["operations"].append({
                "operation": "encrypt",
                "timestamp": datetime.utcnow(),
                "data_size": len(data)
            })
            
            return encrypted_data
            
        except Exception as e:
            logger.error(f"Encryption error: {str(e)}")
            raise RuntimeError("Encryption failed") from e

    def decrypt(self, encrypted_data: bytes) -> bytes:
        """
        Decrypts data using Fernet with KMS-derived key.
        
        Args:
            encrypted_data: Encrypted bytes to decrypt
            
        Returns:
            bytes: Decrypted data
            
        Raises:
            ValueError: If input data is invalid
            RuntimeError: If decryption fails
        """
        if not isinstance(encrypted_data, bytes):
            raise ValueError("Input must be bytes")
            
        try:
            decrypted_data = self._fernet.decrypt(encrypted_data)
            
            self._audit_context["operations"].append({
                "operation": "decrypt",
                "timestamp": datetime.utcnow(),
                "data_size": len(encrypted_data)
            })
            
            return decrypted_data
            
        except Exception as e:
            logger.error(f"Decryption error: {str(e)}")
            raise RuntimeError("Decryption failed") from e

# Export public interface
__all__ = [
    'get_password_hash',
    'verify_password',
    'create_access_token',
    'create_refresh_token',
    'verify_token',
    'SecurityContext'
]