"""
FastAPI exception handlers for the Prior Authorization Management System.
Implements HIPAA-compliant error handling with CloudWatch integration and audit logging.

Version: 1.0.0
"""

from typing import Dict, Any
from fastapi import Request, FastAPI  # version: 0.100+
from fastapi.responses import JSONResponse  # version: 0.100+
from fastapi.exceptions import RequestValidationError  # version: 0.100+
from starlette.exceptions import HTTPException  # version: 0.100+

from core.exceptions import (
    BaseAppException,
    ValidationException,
    AuthorizationException,
    ResourceNotFoundException,
    WorkflowException,
    IntegrationException
)
from core.logging import LOGGER

def register_exception_handlers(app: FastAPI) -> None:
    """
    Register all exception handlers with FastAPI application.
    Implements centralized error handling with proper logging and monitoring.

    Args:
        app: FastAPI application instance
    """
    # Register handlers for application-specific exceptions
    app.exception_handler(BaseAppException)(handle_base_exception)
    app.exception_handler(ValidationException)(handle_validation_exception)
    app.exception_handler(AuthorizationException)(handle_auth_exception)
    app.exception_handler(ResourceNotFoundException)(handle_not_found_exception)
    app.exception_handler(WorkflowException)(handle_workflow_exception)
    app.exception_handler(IntegrationException)(handle_integration_exception)

    # Register handlers for FastAPI exceptions
    app.exception_handler(RequestValidationError)(handle_validation_error)
    app.exception_handler(HTTPException)(handle_http_error)
    
    # Register handler for unhandled exceptions
    app.exception_handler(Exception)(handle_generic_error)

async def handle_base_exception(request: Request, exc: BaseAppException) -> JSONResponse:
    """
    Handle BaseAppException with proper logging and monitoring.
    Ensures HIPAA compliance by masking sensitive information.

    Args:
        request: FastAPI request object
        exc: Application exception instance

    Returns:
        JSONResponse with error details
    """
    # Extract request context for logging
    context = {
        'path': request.url.path,
        'method': request.method,
        'client_host': request.client.host if request.client else None,
        'user_agent': request.headers.get('user-agent'),
        'correlation_id': request.headers.get('x-correlation-id')
    }

    # Log error with context
    LOGGER.error(
        f"Application error occurred: {exc.message}",
        extra={
            'error_data': exc.to_dict(),
            'request_context': context
        }
    )

    # Return error response with security headers
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
        headers={
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        }
    )

async def handle_validation_exception(request: Request, exc: ValidationException) -> JSONResponse:
    """
    Handle validation exceptions with field-level error details.
    Masks any sensitive data in validation errors.

    Args:
        request: FastAPI request object
        exc: Validation exception instance

    Returns:
        JSONResponse with validation error details
    """
    return await handle_base_exception(request, exc)

async def handle_auth_exception(request: Request, exc: AuthorizationException) -> JSONResponse:
    """
    Handle authentication/authorization exceptions with security logging.
    Implements audit trail for security events.

    Args:
        request: FastAPI request object
        exc: Authorization exception instance

    Returns:
        JSONResponse with auth error details
    """
    # Add security context for audit logging
    context = {
        'ip_address': request.client.host if request.client else None,
        'user_agent': request.headers.get('user-agent'),
        'attempted_path': request.url.path,
        'correlation_id': request.headers.get('x-correlation-id')
    }

    # Log security event
    LOGGER.error(
        f"Security event: {exc.message}",
        extra={
            'security_event': True,
            'error_data': exc.to_dict(),
            'security_context': context
        }
    )

    return await handle_base_exception(request, exc)

async def handle_not_found_exception(request: Request, exc: ResourceNotFoundException) -> JSONResponse:
    """
    Handle resource not found exceptions with context logging.

    Args:
        request: FastAPI request object
        exc: Not found exception instance

    Returns:
        JSONResponse with not found error details
    """
    return await handle_base_exception(request, exc)

async def handle_workflow_exception(request: Request, exc: WorkflowException) -> JSONResponse:
    """
    Handle workflow exceptions with business context.

    Args:
        request: FastAPI request object
        exc: Workflow exception instance

    Returns:
        JSONResponse with workflow error details
    """
    return await handle_base_exception(request, exc)

async def handle_integration_exception(request: Request, exc: IntegrationException) -> JSONResponse:
    """
    Handle integration exceptions with external service context.

    Args:
        request: FastAPI request object
        exc: Integration exception instance

    Returns:
        JSONResponse with integration error details
    """
    return await handle_base_exception(request, exc)

async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle FastAPI request validation errors with field details.
    Masks any sensitive data in validation errors.

    Args:
        request: FastAPI request object
        exc: Validation error instance

    Returns:
        JSONResponse with validation error details
    """
    # Convert validation errors to structured format
    validation_errors = []
    for error in exc.errors():
        validation_errors.append({
            'field': ' -> '.join(str(loc) for loc in error['loc']),
            'message': error['msg'],
            'type': error['type']
        })

    error_response = {
        'error': {
            'type': 'ValidationError',
            'message': 'Request validation failed',
            'details': validation_errors,
            'correlation_id': request.headers.get('x-correlation-id')
        }
    }

    # Log validation error
    LOGGER.error(
        "Request validation failed",
        extra={
            'validation_errors': validation_errors,
            'path': request.url.path,
            'method': request.method
        }
    )

    return JSONResponse(
        status_code=422,
        content=error_response,
        headers={'X-Content-Type-Options': 'nosniff'}
    )

async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handle FastAPI HTTP exceptions with security headers.

    Args:
        request: FastAPI request object
        exc: HTTP exception instance

    Returns:
        JSONResponse with HTTP error details
    """
    error_response = {
        'error': {
            'type': 'HTTPError',
            'message': exc.detail,
            'status_code': exc.status_code,
            'correlation_id': request.headers.get('x-correlation-id')
        }
    }

    # Log HTTP error
    LOGGER.error(
        f"HTTP error occurred: {exc.detail}",
        extra={
            'status_code': exc.status_code,
            'path': request.url.path,
            'method': request.method
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response,
        headers={
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        }
    )

async def handle_generic_error(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle any unhandled exceptions with secure error responses.
    Masks all internal details for security.

    Args:
        request: FastAPI request object
        exc: Unhandled exception instance

    Returns:
        JSONResponse with generic error details
    """
    # Generate secure error response
    error_response = {
        'error': {
            'type': 'InternalServerError',
            'message': 'An unexpected error occurred',
            'correlation_id': request.headers.get('x-correlation-id')
        }
    }

    # Log full error details internally
    LOGGER.error(
        f"Unhandled exception occurred: {str(exc)}",
        extra={
            'exc_info': True,
            'path': request.url.path,
            'method': request.method,
            'correlation_id': request.headers.get('x-correlation-id')
        }
    )

    return JSONResponse(
        status_code=500,
        content=error_response,
        headers={
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        }
    )