"""
Main API initialization module for Prior Authorization Management System.
Configures FastAPI application with enhanced security, monitoring, and HIPAA compliance.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware  # version: 0.100+
from fastapi.middleware.gzip import GZipMiddleware  # version: 0.100+
from opentelemetry import trace  # version: 1.20.0
from prometheus_client import Counter, Histogram  # version: 0.16.0

# Internal imports
from api.routes import api_router
from api.middleware import (
    RequestContextMiddleware,
    LoggingMiddleware,
    AuthenticationMiddleware,
    ErrorHandlingMiddleware
)
from api.dependencies import get_db, get_cache, get_current_user_dependency
from core.logging import setup_logging
from config.settings import APP_SETTINGS, SECURITY_SETTINGS

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Initialize metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency')
ERROR_COUNT = Counter('http_errors_total', 'Total HTTP errors', ['status_code'])

# CORS configuration
CORS_ORIGINS = [
    "http://localhost:3000",  # Development
    "https://*.priorauth.com"  # Production
]

# API prefix
API_PREFIX = "/api/v1"

# Security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-XSS-Protection": "1; mode=block",
    "Content-Security-Policy": "default-src 'self'",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Referrer-Policy": "strict-origin-when-cross-origin"
}

def create_application() -> FastAPI:
    """
    Create and configure FastAPI application with enhanced security and monitoring.
    
    Returns:
        FastAPI: Configured application instance
    """
    # Initialize FastAPI with OpenAPI configuration
    app = FastAPI(
        title="Prior Authorization Management System",
        description="HIPAA-compliant API for managing prior authorizations",
        version="1.0.0",
        docs_url="/api/docs" if APP_SETTINGS['DEBUG'] else None,
        redoc_url="/api/redoc" if APP_SETTINGS['DEBUG'] else None,
        openapi_url="/api/openapi.json" if APP_SETTINGS['DEBUG'] else None
    )

    # Configure logging
    setup_logging(
        app_name="prior_auth_api",
        log_level="DEBUG" if APP_SETTINGS['DEBUG'] else "INFO",
        enable_cloudwatch=True
    )

    # Add CORS middleware with security settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Response-Time"],
        max_age=3600
    )

    # Add security and monitoring middleware
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(AuthenticationMiddleware)
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Add request metrics middleware
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next) -> Response:
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path
        ).inc()

        with REQUEST_LATENCY.time():
            response = await call_next(request)

        if 400 <= response.status_code < 600:
            ERROR_COUNT.labels(
                status_code=response.status_code
            ).inc()

        return response

    # Add security headers middleware
    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next) -> Response:
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers[key] = value
        return response

    # Include API router with version prefix
    app.include_router(api_router, prefix=API_PREFIX)

    # Add health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": APP_SETTINGS['API_VERSION']}

    # Add startup event handler
    @app.on_event("startup")
    async def startup_event():
        # Initialize database connection pool
        await get_db(None).__aenter__()
        # Initialize cache connection
        get_cache()
        logging.info("Application startup complete")

    # Add shutdown event handler
    @app.on_event("shutdown")
    async def shutdown_event():
        # Close database connections
        await get_db(None).__aexit__(None, None, None)
        # Close cache connections
        cache = get_cache()
        await cache.close()
        logging.info("Application shutdown complete")

    return app

def shutdown_application(app: FastAPI) -> None:
    """
    Gracefully shut down the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    try:
        # Close database connections
        get_db(None).__aexit__(None, None, None)
        
        # Close cache connections
        cache = get_cache()
        cache.close()
        
        # Close tracer
        trace.get_tracer(__name__).shutdown()
        
        logging.info("Application shutdown successful")
        
    except Exception as e:
        logging.error(f"Error during application shutdown: {str(e)}")
        raise

# Export public interface
__all__ = [
    "create_application",
    "shutdown_application"
]