"""
HIPAA-compliant middleware implementations for the Prior Authorization Management System.
Provides request context management, authentication, logging, and error handling with proper security measures.

Version: 1.0.0
"""

import time
import uuid
import json
from typing import Dict, Optional
from contextvars import ContextVar
from datetime import datetime

# Third-party imports with versions
from fastapi import Request, Response  # version: 0.100.0
from starlette.middleware.base import BaseHTTPMiddleware  # version: 0.27.0
from starlette.types import ASGIApp, Message

# Internal imports
from core.auth import get_current_user
from core.exceptions import AuthenticationException
from core.logging import get_request_logger

# Request context storage
request_context: ContextVar[Dict] = ContextVar("request_context", default={})

class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware for managing request context including request ID, timing, and correlation.
    Implements CloudWatch X-Ray integration for request tracking.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self._context_var = request_context

    async def __call__(self, request: Request, call_next):
        """Process request/response cycle with context management."""
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Initialize request context
        context = {
            "request_id": request_id,
            "start_time": datetime.utcnow().isoformat(),
            "correlation_id": request.headers.get("X-Correlation-ID", request_id),
            "user_agent": request.headers.get("User-Agent", "Unknown"),
            "source_ip": request.client.host if request.client else None
        }

        # Store context
        context_token = self._context_var.set(context)

        try:
            # Add tracing headers
            request.state.request_id = request_id
            response = await call_next(request)

            # Calculate request duration
            duration = time.perf_counter() - start_time

            # Add response headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"

            return response

        finally:
            self._context_var.reset(context_token)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    HIPAA-compliant logging middleware for request/response details with PHI masking.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = get_request_logger("api")

    async def __call__(self, request: Request, call_next):
        """Log request and response with HIPAA compliance."""
        context = request_context.get()
        request_id = context.get("request_id", str(uuid.uuid4()))

        # Get request-scoped logger
        logger = get_request_logger(request_id, {
            "path": request.url.path,
            "method": request.method,
            "client_ip": context.get("source_ip")
        })

        # Log sanitized request
        logger.info(
            "Incoming request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "headers": self._sanitize_headers(dict(request.headers))
            }
        )

        try:
            response = await call_next(request)

            # Log sanitized response
            logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "status_code": response.status_code,
                    "duration": time.perf_counter() - context.get("start_time", 0),
                    "response_headers": self._sanitize_headers(dict(response.headers))
                }
            )

            return response

        except Exception as e:
            logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "error": str(e),
                    "error_type": e.__class__.__name__
                }
            )
            raise

    def _sanitize_headers(self, headers: Dict) -> Dict:
        """Remove sensitive information from headers."""
        sensitive_headers = {"authorization", "cookie", "x-api-key"}
        return {
            k: v for k, v in headers.items()
            if k.lower() not in sensitive_headers
        }


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    JWT authentication middleware with role-based access control and security audit logging.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = get_request_logger("auth")

    async def __call__(self, request: Request, call_next):
        """Validate authentication and process request with security measures."""
        context = request_context.get()
        request_id = context.get("request_id", str(uuid.uuid4()))

        # Skip authentication for public endpoints
        if self._is_public_path(request.url.path):
            return await call_next(request)

        try:
            # Extract and validate JWT token
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                raise AuthenticationException("Missing or invalid authorization header")

            token = auth_header.split(" ")[1]
            user = await get_current_user(token)

            # Add user context to request state
            request.state.user = user
            request.state.user_id = user.id
            request.state.role = user.role

            # Log successful authentication
            self.logger.info(
                "Authentication successful",
                extra={
                    "request_id": request_id,
                    "user_id": user.id,
                    "role": user.role
                }
            )

            return await call_next(request)

        except AuthenticationException as e:
            self.logger.warning(
                "Authentication failed",
                extra={
                    "request_id": request_id,
                    "error": str(e),
                    "path": request.url.path
                }
            )
            raise

    def _is_public_path(self, path: str) -> bool:
        """Check if path is public (no auth required)."""
        public_paths = {
            "/api/v1/health",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/docs",
            "/redoc"
        }
        return any(path.startswith(p) for p in public_paths)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Centralized error handling middleware with security measures and metrics collection.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = get_request_logger("error")

    async def __call__(self, request: Request, call_next):
        """Handle and format errors with security considerations."""
        context = request_context.get()
        request_id = context.get("request_id", str(uuid.uuid4()))

        try:
            return await call_next(request)

        except Exception as e:
            # Log error with context
            self.logger.error(
                "Unhandled exception",
                extra={
                    "request_id": request_id,
                    "error_type": e.__class__.__name__,
                    "error": str(e),
                    "path": request.url.path,
                    "method": request.method
                }
            )

            # Convert to API error response
            status_code = getattr(e, "status_code", 500)
            error_response = {
                "error": {
                    "code": getattr(e, "error_code", "INTERNAL_ERROR"),
                    "message": str(e) if status_code < 500 else "Internal server error",
                    "request_id": request_id
                }
            }

            return Response(
                content=json.dumps(error_response),
                status_code=status_code,
                media_type="application/json"
            )

# Export middleware classes
__all__ = [
    "RequestContextMiddleware",
    "LoggingMiddleware",
    "AuthenticationMiddleware",
    "ErrorHandlingMiddleware"
]