"""
Main entry point for the Prior Authorization Management System FastAPI application.
Implements a high-performance, HIPAA-compliant API server with comprehensive security controls.

Version: 1.0.0
"""

import logging
import signal
import sys
from typing import Dict

# Third-party imports with versions
from fastapi import FastAPI  # version: 0.100.0
from fastapi.middleware.cors import CORSMiddleware  # version: 0.100.0
import uvicorn  # version: 0.23.0
from prometheus_client import make_asgi_app, Counter, Histogram  # version: 0.17.0

# Internal imports
from config.settings import APP_SETTINGS
from api.middleware import (
    RequestContextMiddleware,
    LoggingMiddleware,
    SecurityMiddleware,
    AuthenticationMiddleware,
    ErrorHandlingMiddleware
)
from api.routers import (
    prior_auth_router,
    clinical_router,
    document_router,
    formulary_router,
    notification_router
)
from core.logging import setup_logging, LOGGER
from core.exceptions import BaseAppException

# Initialize metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

# Initialize FastAPI application
app = FastAPI(
    title=APP_SETTINGS['APP_NAME'],
    version=APP_SETTINGS['API_VERSION'],
    docs_url='/api/docs',
    redoc_url='/api/redoc',
    openapi_url='/api/openapi.json'
)

def configure_middleware(app: FastAPI) -> None:
    """
    Configure comprehensive middleware stack for security, monitoring, and performance.
    
    Args:
        app: FastAPI application instance
    """
    # CORS middleware with strict origin validation
    app.add_middleware(
        CORSMiddleware,
        allow_origins=APP_SETTINGS['CORS_ORIGINS'],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=3600
    )

    # Request context and tracing
    app.add_middleware(RequestContextMiddleware)

    # HIPAA-compliant logging
    app.add_middleware(LoggingMiddleware)

    # Security headers and HIPAA compliance
    app.add_middleware(SecurityMiddleware)

    # Authentication and authorization
    app.add_middleware(AuthenticationMiddleware)

    # Error handling
    app.add_middleware(ErrorHandlingMiddleware)

    # Prometheus metrics
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

def configure_routes(app: FastAPI) -> None:
    """
    Configure API routes with proper versioning and documentation.
    
    Args:
        app: FastAPI application instance
    """
    # Health check endpoints
    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    @app.get("/health/detailed")
    async def detailed_health():
        return {
            "status": "healthy",
            "version": APP_SETTINGS['API_VERSION'],
            "environment": APP_SETTINGS.get('ENV', 'production')
        }

    # Mount API routers
    api_prefix = f"/api/{APP_SETTINGS['API_VERSION']}"
    app.include_router(prior_auth_router, prefix=f"{api_prefix}/prior-auth")
    app.include_router(clinical_router, prefix=f"{api_prefix}/clinical")
    app.include_router(document_router, prefix=f"{api_prefix}/documents")
    app.include_router(formulary_router, prefix=f"{api_prefix}/formulary")
    app.include_router(notification_router, prefix=f"{api_prefix}/notifications")

def configure_logging() -> None:
    """Setup HIPAA-compliant logging configuration."""
    setup_logging(
        app_name=APP_SETTINGS['APP_NAME'],
        log_level=APP_SETTINGS.get('LOG_LEVEL', 'INFO'),
        enable_cloudwatch=True,
        additional_config={
            'disable_existing_loggers': False,
            'propagate': True
        }
    )

def handle_shutdown(signum: int, frame) -> None:
    """
    Handle graceful shutdown on system signals.
    
    Args:
        signum: Signal number
        frame: Current stack frame
    """
    LOGGER.info("Received shutdown signal, initiating graceful shutdown")
    sys.exit(0)

def main() -> None:
    """
    Application entry point with proper startup and shutdown handling.
    Configures and starts the ASGI server with optimized settings.
    """
    try:
        # Configure logging
        configure_logging()
        LOGGER.info(f"Starting {APP_SETTINGS['APP_NAME']}")

        # Configure middleware
        configure_middleware(app)
        LOGGER.info("Middleware stack configured")

        # Configure routes
        configure_routes(app)
        LOGGER.info("API routes configured")

        # Register signal handlers
        signal.signal(signal.SIGTERM, handle_shutdown)
        signal.signal(signal.SIGINT, handle_shutdown)

        # Start server
        uvicorn.run(
            "main:app",
            host=APP_SETTINGS['HOST'],
            port=APP_SETTINGS['PORT'],
            workers=4,
            loop="uvloop",
            http="httptools",
            log_level=APP_SETTINGS.get('LOG_LEVEL', 'info').lower(),
            access_log=True,
            proxy_headers=True,
            forwarded_allow_ips="*",
            timeout_keep_alive=APP_SETTINGS.get('REQUEST_TIMEOUT', 30)
        )

    except Exception as e:
        LOGGER.error(f"Failed to start application: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

# Export FastAPI application instance
__all__ = ['app']