"""
Core exception classes for the Prior Authorization Management System.
Implements HIPAA-compliant error handling with CloudWatch integration and audit logging.

Version: 1.0.0
"""

import uuid
import json
from typing import Dict, Optional, Any
from datetime import datetime

from fastapi import HTTPException  # version: 0.100+
import boto3  # version: 1.26+

from core.constants import PriorAuthStatus
from core.logging import LOGGER

# CloudWatch client for metrics
cloudwatch = boto3.client('cloudwatch')  # version: 1.26+

class BaseAppException(Exception):
    """
    Base exception class for all application-specific exceptions.
    Implements HIPAA-compliant error handling with enhanced logging and monitoring.
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Dict] = None,
        correlation_id: Optional[str] = None,
        request_context: Optional[Dict] = None
    ) -> None:
        """
        Initialize base exception with enhanced logging and monitoring.

        Args:
            message: Error message (must not contain PHI)
            status_code: HTTP status code
            details: Additional error details
            correlation_id: Request correlation ID for tracing
            request_context: Additional request context for logging
        """
        self.error_id = str(uuid.uuid4())
        self.timestamp = datetime.utcnow().isoformat()
        self.message = self._sanitize_message(message)
        self.status_code = status_code
        self.details = self._sanitize_details(details or {})
        self.correlation_id = correlation_id
        self.request_context = self._sanitize_context(request_context or {})

        # Call parent constructor
        super().__init__(self.message)

        # Log error with context
        self._log_error()
        
        # Send metrics to CloudWatch
        self._send_metrics()

    def _sanitize_message(self, message: str) -> str:
        """
        Sanitize error message to ensure no PHI is included.
        
        Args:
            message: Raw error message
            
        Returns:
            Sanitized message string
        """
        # Remove any potential PHI patterns (e.g., SSN, phone numbers)
        sanitized = message
        phi_patterns = {
            'ssn': r'\d{3}-\d{2}-\d{4}',
            'phone': r'\d{3}-\d{3}-\d{4}',
            'email': r'[^@]+@[^@]+\.[^@]+'
        }
        
        for pattern in phi_patterns.values():
            sanitized = sanitized.replace(pattern, '[REDACTED]')
        
        return sanitized

    def _sanitize_details(self, details: Dict) -> Dict:
        """
        Sanitize error details to remove any PHI.
        
        Args:
            details: Raw error details
            
        Returns:
            Sanitized details dictionary
        """
        sensitive_fields = {
            'patient_name', 'dob', 'ssn', 'mrn', 'address',
            'phone', 'email', 'insurance_id'
        }
        
        sanitized = {}
        for key, value in details.items():
            if key.lower() in sensitive_fields:
                sanitized[key] = '[REDACTED]'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_details(value)
            else:
                sanitized[key] = value
                
        return sanitized

    def _sanitize_context(self, context: Dict) -> Dict:
        """
        Sanitize request context to remove sensitive information.
        
        Args:
            context: Raw request context
            
        Returns:
            Sanitized context dictionary
        """
        # Remove sensitive headers
        sensitive_headers = {'authorization', 'cookie', 'x-api-key'}
        if 'headers' in context:
            context['headers'] = {
                k: v for k, v in context['headers'].items()
                if k.lower() not in sensitive_headers
            }
        
        return context

    def _log_error(self) -> None:
        """Log error details to CloudWatch with proper context."""
        log_data = {
            'error_id': self.error_id,
            'timestamp': self.timestamp,
            'status_code': self.status_code,
            'message': self.message,
            'correlation_id': self.correlation_id,
            'exception_type': self.__class__.__name__
        }

        if self.details:
            log_data['details'] = self.details

        LOGGER.error(
            f"Application error occurred: {self.message}",
            extra={
                'error_data': log_data,
                'request_context': self.request_context
            }
        )

    def _send_metrics(self) -> None:
        """Send error metrics to CloudWatch."""
        try:
            cloudwatch.put_metric_data(
                Namespace='PriorAuth/Errors',
                MetricData=[
                    {
                        'MetricName': 'ErrorCount',
                        'Value': 1,
                        'Unit': 'Count',
                        'Dimensions': [
                            {
                                'Name': 'ErrorType',
                                'Value': self.__class__.__name__
                            },
                            {
                                'Name': 'StatusCode',
                                'Value': str(self.status_code)
                            }
                        ]
                    }
                ]
            )
        except Exception as e:
            LOGGER.error(f"Failed to send error metrics: {str(e)}")

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert exception to dictionary format for API responses.
        
        Returns:
            Dictionary representation of the error
        """
        return {
            'error': {
                'id': self.error_id,
                'type': self.__class__.__name__,
                'message': self.message,
                'status_code': self.status_code,
                'timestamp': self.timestamp,
                'correlation_id': self.correlation_id,
                'details': self.details
            }
        }

class ValidationException(BaseAppException):
    """
    Exception for data validation errors with field-level details.
    """
    
    def __init__(
        self,
        message: str,
        validation_errors: Dict,
        correlation_id: Optional[str] = None
    ) -> None:
        """
        Initialize validation exception with detailed error tracking.

        Args:
            message: Error message
            validation_errors: Dictionary of field-level validation errors
            correlation_id: Request correlation ID
        """
        sanitized_errors = self._sanitize_validation_errors(validation_errors)
        
        super().__init__(
            message=message,
            status_code=400,
            details={'validation_errors': sanitized_errors},
            correlation_id=correlation_id
        )

    def _sanitize_validation_errors(self, errors: Dict) -> Dict:
        """
        Sanitize validation errors to remove any PHI.
        
        Args:
            errors: Raw validation errors
            
        Returns:
            Sanitized validation errors
        """
        sanitized = {}
        for field, error in errors.items():
            # Remove any field values that might contain PHI
            if isinstance(error, dict):
                sanitized[field] = self._sanitize_validation_errors(error)
            else:
                sanitized[field] = str(error).replace(field, '[FIELD]')
        return sanitized

class AuthorizationException(BaseAppException):
    """
    Exception for authorization and authentication errors.
    """
    
    def __init__(
        self,
        message: str,
        correlation_id: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> None:
        """
        Initialize authorization exception.

        Args:
            message: Error message
            correlation_id: Request correlation ID
            details: Additional error details
        """
        super().__init__(
            message=message,
            status_code=401,
            details=details,
            correlation_id=correlation_id
        )

class ResourceNotFoundException(BaseAppException):
    """
    Exception for resource not found errors.
    """
    
    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        correlation_id: Optional[str] = None
    ) -> None:
        """
        Initialize resource not found exception.

        Args:
            resource_type: Type of resource that was not found
            resource_id: ID of the resource
            correlation_id: Request correlation ID
        """
        message = f"{resource_type} not found with ID: {resource_id}"
        super().__init__(
            message=message,
            status_code=404,
            details={
                'resource_type': resource_type,
                'resource_id': resource_id
            },
            correlation_id=correlation_id
        )

class WorkflowException(BaseAppException):
    """
    Exception for prior authorization workflow errors.
    """
    
    def __init__(
        self,
        message: str,
        current_status: PriorAuthStatus,
        correlation_id: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> None:
        """
        Initialize workflow exception.

        Args:
            message: Error message
            current_status: Current status of the prior authorization
            correlation_id: Request correlation ID
            details: Additional error details
        """
        workflow_details = details or {}
        workflow_details['current_status'] = current_status
        
        super().__init__(
            message=message,
            status_code=422,
            details=workflow_details,
            correlation_id=correlation_id
        )

# Export exception classes
__all__ = [
    'BaseAppException',
    'ValidationException',
    'AuthorizationException',
    'ResourceNotFoundException',
    'WorkflowException'
]