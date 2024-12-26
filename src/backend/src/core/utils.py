"""
Core utility functions for the Prior Authorization Management System.
Provides common helper functions for data validation, formatting, file handling, 
and other shared functionality with enhanced security and HIPAA compliance.

Version: 1.0.0
"""

import datetime  # version: 3.11+
import uuid  # version: 3.11+
import re  # version: 3.11+
import json  # version: 3.11+
import boto3  # version: 1.26.0
import bleach  # version: 6.0.0
from tenacity import retry, stop_after_attempt  # version: 8.2.2
from typing import Dict, Optional, Any, Union
from datetime import datetime, timezone

from core.logging import LOGGER
from core.exceptions import ValidationException
from core.constants import MAX_FILE_SIZE_MB
from core.cache import CACHE

# Initialize AWS S3 client with proper credentials
s3_client = boto3.client('s3')

# Regular expressions for input validation
PHONE_PATTERN = re.compile(r'^\d{3}-\d{3}-\d{4}$')
SSN_PATTERN = re.compile(r'^\d{3}-\d{2}-\d{4}$')
EMAIL_PATTERN = re.compile(r'^[^@]+@[^@]+\.[^@]+$')

# Allowed MIME types for file uploads
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

@retry(stop=stop_after_attempt(3))
def generate_request_id() -> str:
    """
    Generates a unique request ID for prior authorization requests with enhanced uniqueness.
    
    Returns:
        str: UUID string in format PA-YYYYMMDD-UUID
        
    Example:
        PA-20240315-550e8400-e29b-41d4-a716-446655440000
    """
    try:
        # Get current date in UTC
        current_date = datetime.now(timezone.utc).strftime('%Y%m%d')
        
        # Generate UUID with enhanced entropy
        unique_id = str(uuid.uuid4())
        
        # Combine components
        request_id = f"PA-{current_date}-{unique_id}"
        
        LOGGER.debug(f"Generated request ID: {request_id}")
        return request_id
        
    except Exception as e:
        LOGGER.error(f"Error generating request ID: {str(e)}")
        raise

def validate_file_size(file_size_bytes: int, content_type: str) -> bool:
    """
    Validates if file size is within allowed limits with enhanced security checks.
    
    Args:
        file_size_bytes: Size of file in bytes
        content_type: MIME type of file
        
    Returns:
        bool: True if valid
        
    Raises:
        ValidationException: If file size or type is invalid
    """
    try:
        # Validate input types
        if not isinstance(file_size_bytes, int) or not isinstance(content_type, str):
            raise ValidationException("Invalid input types")
            
        # Convert bytes to MB with precision handling
        file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
        
        # Validate content type
        if content_type not in ALLOWED_MIME_TYPES:
            raise ValidationException(
                f"Invalid file type: {content_type}. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}"
            )
            
        # Check size limit
        if file_size_mb > MAX_FILE_SIZE_MB:
            raise ValidationException(
                f"File size {file_size_mb}MB exceeds maximum allowed size of {MAX_FILE_SIZE_MB}MB"
            )
            
        LOGGER.debug(f"File validation passed: {file_size_mb}MB, type: {content_type}")
        return True
        
    except Exception as e:
        LOGGER.error(f"File validation error: {str(e)}")
        raise

@CACHE.cache(ttl=3600)
def format_fhir_date(date_string: str) -> str:
    """
    Formats date string to FHIR R4 compliant format with caching.
    
    Args:
        date_string: Input date string
        
    Returns:
        str: FHIR R4 formatted date string (YYYY-MM-DD)
        
    Raises:
        ValidationException: If date format is invalid
    """
    try:
        # Parse input date with flexible format support
        if isinstance(date_string, datetime):
            parsed_date = date_string
        else:
            # Try common date formats
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y']:
                try:
                    parsed_date = datetime.strptime(date_string, fmt)
                    break
                except ValueError:
                    continue
            else:
                raise ValidationException(f"Invalid date format: {date_string}")
        
        # Convert to FHIR format
        fhir_date = parsed_date.strftime('%Y-%m-%d')
        
        LOGGER.debug(f"Formatted FHIR date: {fhir_date}")
        return fhir_date
        
    except Exception as e:
        LOGGER.error(f"Date formatting error: {str(e)}")
        raise

def sanitize_input(input_string: str, input_type: str) -> str:
    """
    Sanitizes user input with enhanced security and HIPAA compliance.
    
    Args:
        input_string: Raw input string
        input_type: Type of input ('text', 'phone', 'email', 'ssn')
        
    Returns:
        str: Sanitized input string
        
    Raises:
        ValidationException: If input validation fails
    """
    try:
        if not input_string or not input_type:
            raise ValidationException("Input string and type are required")
            
        # Trim whitespace
        sanitized = input_string.strip()
        
        # Apply type-specific validation
        if input_type == 'phone':
            if not PHONE_PATTERN.match(sanitized):
                raise ValidationException("Invalid phone number format")
        elif input_type == 'email':
            if not EMAIL_PATTERN.match(sanitized):
                raise ValidationException("Invalid email format")
        elif input_type == 'ssn':
            if not SSN_PATTERN.match(sanitized):
                raise ValidationException("Invalid SSN format")
        
        # HTML sanitization for text input
        if input_type == 'text':
            sanitized = bleach.clean(
                sanitized,
                tags=[],  # No HTML tags allowed
                strip=True
            )
        
        LOGGER.debug(f"Input sanitized successfully: type={input_type}")
        return sanitized
        
    except Exception as e:
        LOGGER.error(f"Input sanitization error: {str(e)}")
        raise

@retry(stop=stop_after_attempt(3))
def upload_to_s3(file_data: bytes, file_name: str, content_type: str, metadata: Dict) -> str:
    """
    Uploads file to S3 with enhanced security, encryption, and retry handling.
    
    Args:
        file_data: Binary file data
        file_name: Name of file
        content_type: MIME type of file
        metadata: Additional metadata
        
    Returns:
        str: S3 object URL
        
    Raises:
        ValidationException: If file validation fails
    """
    try:
        # Validate file size and type
        validate_file_size(len(file_data), content_type)
        
        # Prepare metadata with timestamps
        upload_metadata = {
            **metadata,
            'upload_timestamp': datetime.now(timezone.utc).isoformat(),
            'content_type': content_type
        }
        
        # Upload to S3 with server-side encryption
        response = s3_client.put_object(
            Bucket=s3_client.bucket_name,
            Key=file_name,
            Body=file_data,
            ContentType=content_type,
            Metadata=upload_metadata,
            ServerSideEncryption='aws:kms',
            SSEKMSKeyId=s3_client.kms_key_id
        )
        
        # Generate pre-signed URL
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': s3_client.bucket_name,
                'Key': file_name
            },
            ExpiresIn=3600  # URL expires in 1 hour
        )
        
        LOGGER.info(f"File uploaded successfully: {file_name}")
        return url
        
    except Exception as e:
        LOGGER.error(f"S3 upload error: {str(e)}")
        raise

@CACHE.cache(ttl=86400)
def calculate_age(birth_date: str) -> int:
    """
    Calculates age from birthdate with timezone handling and caching.
    
    Args:
        birth_date: Birth date string in YYYY-MM-DD format
        
    Returns:
        int: Age in years
        
    Raises:
        ValidationException: If date format is invalid
    """
    try:
        # Parse birth date
        birth_date = datetime.strptime(birth_date, '%Y-%m-%d')
        
        # Get current date in UTC
        today = datetime.now(timezone.utc)
        
        # Calculate age
        age = today.year - birth_date.year
        
        # Adjust for birth date not yet occurred this year
        if today.month < birth_date.month or \
           (today.month == birth_date.month and today.day < birth_date.day):
            age -= 1
            
        if age < 0 or age > 150:  # Basic sanity check
            raise ValidationException(f"Invalid age calculated: {age}")
            
        LOGGER.debug(f"Calculated age: {age}")
        return age
        
    except Exception as e:
        LOGGER.error(f"Age calculation error: {str(e)}")
        raise

# Export public interface
__all__ = [
    'generate_request_id',
    'validate_file_size',
    'format_fhir_date',
    'sanitize_input',
    'upload_to_s3',
    'calculate_age'
]