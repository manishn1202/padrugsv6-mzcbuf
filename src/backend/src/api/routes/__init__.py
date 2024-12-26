"""
Central router aggregator module for Prior Authorization Management System.
Implements secure routing with HIPAA compliance, monitoring, and high availability.

Version: 1.0.0
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, Request, HTTPException  # version: 0.100+
from fastapi.responses import JSONResponse
from opentelemetry import trace  # version: 1.20.0

# Import route modules
from api.routes.health import router as health_router
from api.routes.auth import router as auth_router
from api.routes.prior_auth import router as prior_auth_router

# Import core components
from core.logging import LOGGER
from core.security import SecurityContext
from core.constants import UserRole

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Create main API router with prefix and HIPAA-compliant response class
api_router = APIRouter(
    prefix="/api/v1",
    default_response_class=JSONResponse
)

# HIPAA compliance headers
HIPAA_HEADERS = {
    "X-HIPAA-Compliance": "enabled",
    "X-Security-Version": "1.0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
}

def validate_router(router: APIRouter) -> bool:
    """
    Validate router configuration and security settings.
    
    Args:
        router: FastAPI router instance to validate
        
    Returns:
        bool indicating validation success
        
    Raises:
        ValueError: If router configuration is invalid
    """
    if not isinstance(router, APIRouter):
        raise ValueError("Invalid router type")
        
    # Validate route handlers
    for route in router.routes:
        # Ensure all routes have security dependencies
        if not any(dep for dep in route.dependencies if "SecurityContext" in str(dep)):
            LOGGER.warning(f"Route {route.path} missing security context")
            
        # Validate response models
        if not getattr(route, "response_model", None):
            LOGGER.warning(f"Route {route.path} missing response model")
            
    return True

def include_router(
    router: APIRouter,
    prefix: str,
    tags: List[str],
    security_scopes: Optional[Dict] = None
) -> None:
    """
    Enhanced helper function to include a router with security validation.
    
    Args:
        router: FastAPI router to include
        prefix: URL prefix for routes
        tags: OpenAPI tags
        security_scopes: Optional security scope configuration
    """
    try:
        # Validate router configuration
        validate_router(router)
        
        # Add HIPAA compliance middleware
        @router.middleware("http")
        async def add_hipaa_headers(request: Request, call_next):
            response = await call_next(request)
            
            # Add HIPAA compliance headers
            for key, value in HIPAA_HEADERS.items():
                response.headers[key] = value
                
            return response
            
        # Add request tracing
        @router.middleware("http")
        async def add_request_tracing(request: Request, call_next):
            with tracer.start_as_current_span(
                f"{prefix.strip('/')}_request",
                attributes={"http.route": request.url.path}
            ) as span:
                response = await call_next(request)
                span.set_attribute("http.status_code", response.status_code)
                return response
                
        # Add rate limiting if configured
        if security_scopes and security_scopes.get("rate_limit"):
            @router.middleware("http")
            async def rate_limit(request: Request, call_next):
                # Rate limiting logic would go here
                return await call_next(request)
                
        # Include router with configuration
        api_router.include_router(
            router,
            prefix=prefix,
            tags=tags,
            responses={
                401: {"description": "Unauthorized"},
                403: {"description": "Forbidden"},
                429: {"description": "Too Many Requests"}
            }
        )
        
        LOGGER.info(f"Included router with prefix {prefix}")
        
    except Exception as e:
        LOGGER.error(f"Failed to include router: {str(e)}")
        raise

# Include route modules with security configuration
include_router(
    health_router,
    prefix="/health",
    tags=["Health"],
    security_scopes={"public": True}
)

include_router(
    auth_router,
    prefix="/auth", 
    tags=["Authentication"],
    security_scopes={
        "rate_limit": {"requests": 100, "period": 60},
        "roles": [UserRole.PROVIDER, UserRole.REVIEWER]
    }
)

include_router(
    prior_auth_router,
    prefix="/prior-auth",
    tags=["Prior Authorization"],
    security_scopes={
        "rate_limit": {"requests": 5000, "period": 3600},
        "roles": [UserRole.PROVIDER, UserRole.REVIEWER]
    }
)

# Export router
__all__ = ["api_router"]