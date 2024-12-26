"""
Pydantic schema models for standardized API responses in the Prior Authorization Management System.
Implements HIPAA-compliant response structures with comprehensive error handling, request tracing, 
and monitoring integration.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, constr  # version: 2.0+
from fastapi import HTTPException  # version: 0.100+

from core.exceptions import BaseAppException
from core.constants import PriorAuthStatus

class BaseResponse(BaseModel):
    """
    Base response model for all API endpoints with tracing and monitoring support.
    Implements standardized response structure with request tracking.
    """
    success: bool = Field(
        default=True,
        description="Indicates if the request was successful"
    )
    status_code: int = Field(
        default=200,
        ge=100,
        le=599,
        description="HTTP status code"
    )
    message: str = Field(
        default="",
        description="Response message"
    )
    request_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique request identifier for tracing"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Response timestamp in UTC"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional response metadata"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class ErrorResponse(BaseModel):
    """
    HIPAA-compliant error response model with monitoring integration.
    Implements secure error reporting without exposing sensitive information.
    """
    error_code: str = Field(
        ...,
        pattern="^[A-Z][A-Z0-9_]*$",
        description="Standardized error code"
    )
    error_message: str = Field(
        ...,
        description="User-friendly error message"
    )
    correlation_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Error correlation ID for tracing"
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional error details"
    )
    request_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Original request ID"
    )

    @classmethod
    def from_exception(cls, exc: BaseAppException, request_id: Optional[str] = None) -> "ErrorResponse":
        """
        Create error response from application exception.
        
        Args:
            exc: Application exception instance
            request_id: Optional request ID for tracing
            
        Returns:
            ErrorResponse instance
        """
        return cls(
            error_code=exc.__class__.__name__.upper(),
            error_message=exc.message,
            correlation_id=exc.error_id,
            details=exc.details,
            request_id=request_id or str(uuid4())
        )

class ValidationErrorResponse(ErrorResponse):
    """
    Specialized error response for input validation failures.
    Provides detailed field-level validation errors.
    """
    validation_errors: List[Dict[str, Any]] = Field(
        ...,
        description="List of field-level validation errors"
    )

    @classmethod
    def from_validation_error(cls, errors: List[Dict[str, Any]], request_id: Optional[str] = None) -> "ValidationErrorResponse":
        """
        Create validation error response from validation errors.
        
        Args:
            errors: List of validation errors
            request_id: Optional request ID for tracing
            
        Returns:
            ValidationErrorResponse instance
        """
        return cls(
            error_code="VALIDATION_ERROR",
            error_message="Request validation failed",
            validation_errors=errors,
            request_id=request_id or str(uuid4())
        )

class PriorAuthResponse(BaseResponse):
    """
    Response model for prior authorization requests with status tracking.
    Implements HIPAA-compliant response structure for PA decisions.
    """
    request_id: str = Field(
        ...,
        description="Prior authorization request ID"
    )
    status: PriorAuthStatus = Field(
        ...,
        description="Current status of the PA request"
    )
    decision: Optional[str] = Field(
        None,
        description="Decision details if available"
    )
    details: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional decision details"
    )
    decision_timestamp: Optional[datetime] = Field(
        None,
        description="Timestamp of the decision"
    )
    reviewer_id: Optional[str] = Field(
        None,
        description="ID of the reviewing entity"
    )

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v),
            PriorAuthStatus: lambda v: v.value
        }

# Export response models
__all__ = [
    'BaseResponse',
    'ErrorResponse',
    'ValidationErrorResponse',
    'PriorAuthResponse'
]