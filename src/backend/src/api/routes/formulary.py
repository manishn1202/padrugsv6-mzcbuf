"""
FastAPI router module for drug formulary and coverage verification endpoints.
Implements HIPAA-compliant, high-performance endpoints with caching and security controls.

Version: 1.0.0
"""

from typing import Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Internal imports
from services.formulary import FormularyService
from api.schemas.formulary import (
    DrugResponse, FormularyEntryResponse, DrugFormularyResponse
)
from core.cache import RedisCache, create_cache_key
from core.exceptions import ResourceNotFoundException, ValidationException
from core.logging import LOGGER

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/api/v1/formulary",
    tags=["formulary"]
)

# Initialize security scheme
security = HTTPBearer()

# Initialize services and cache
formulary_service = FormularyService()
secure_cache = RedisCache()

async def get_secure_cache() -> RedisCache:
    """Dependency for secure cache access."""
    return secure_cache

@router.get(
    "/{drug_id}/coverage",
    response_model=FormularyEntryResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Drug not found"},
        401: {"description": "Unauthorized"},
        500: {"description": "Internal server error"}
    }
)
async def get_drug_coverage(
    drug_id: UUID,
    plan_id: str,
    request: Request,
    cache: RedisCache = Depends(get_secure_cache),
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> FormularyEntryResponse:
    """
    Get drug coverage information and formulary status with HIPAA compliance.

    Args:
        drug_id: Drug UUID
        plan_id: Insurance plan identifier
        request: FastAPI request object
        cache: Secure cache instance
        credentials: Security credentials

    Returns:
        FormularyEntryResponse: Drug coverage and formulary information
    """
    try:
        # Generate cache key
        cache_key = create_cache_key(
            namespace="formulary",
            identifier=f"{drug_id}:{plan_id}",
            version="v1"
        )

        # Check cache first
        cached_response = await cache.get(cache_key)
        if cached_response:
            LOGGER.info(f"Cache hit for drug coverage: {drug_id}")
            return FormularyEntryResponse(**cached_response)

        # Get coverage from service
        coverage = await formulary_service.get_drug_coverage(
            drug_id=drug_id,
            plan_id=plan_id,
            correlation_id=str(request.state.correlation_id)
        )

        # Cache the response
        await cache.set(cache_key, coverage.dict(), ttl=300)  # 5 minutes TTL

        return coverage

    except ResourceNotFoundException as e:
        LOGGER.error(f"Drug not found: {drug_id}", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        LOGGER.error(f"Error getting drug coverage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post(
    "/verify",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Invalid request"},
        401: {"description": "Unauthorized"},
        500: {"description": "Internal server error"}
    }
)
async def verify_drug_coverage(
    drug_code: str,
    plan_id: str,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Dict[str, Any]:
    """
    Verify drug coverage with secure validation.

    Args:
        drug_code: National Drug Code (NDC)
        plan_id: Insurance plan identifier
        request: FastAPI request object
        credentials: Security credentials

    Returns:
        Dict containing verification result with coverage status
    """
    try:
        # Verify coverage
        verification = await formulary_service.verify_drug_coverage(
            drug_code=drug_code,
            plan_id=plan_id,
            correlation_id=str(request.state.correlation_id)
        )

        return {
            "status": "success",
            "coverage": verification,
            "request_id": str(request.state.correlation_id)
        }

    except ValidationException as e:
        LOGGER.error(f"Invalid request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        LOGGER.error(f"Error verifying coverage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get(
    "/{drug_id}/policy",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Drug not found"},
        401: {"description": "Unauthorized"},
        500: {"description": "Internal server error"}
    }
)
async def get_policy_requirements(
    drug_id: UUID,
    plan_id: str,
    request: Request,
    cache: RedisCache = Depends(get_secure_cache),
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Dict[str, Any]:
    """
    Get PA policy requirements with security controls.

    Args:
        drug_id: Drug UUID
        plan_id: Insurance plan identifier
        request: FastAPI request object
        cache: Secure cache instance
        credentials: Security credentials

    Returns:
        Dict containing policy criteria and requirements
    """
    try:
        # Generate cache key
        cache_key = create_cache_key(
            namespace="policy",
            identifier=f"{drug_id}:{plan_id}",
            version="v1"
        )

        # Check cache first
        cached_response = await cache.get(cache_key)
        if cached_response:
            LOGGER.info(f"Cache hit for policy requirements: {drug_id}")
            return cached_response

        # Get policy requirements
        policy = await formulary_service.get_policy_requirements(
            drug_id=drug_id,
            plan_id=plan_id,
            correlation_id=str(request.state.correlation_id)
        )

        # Cache the response
        await cache.set(cache_key, policy, ttl=300)  # 5 minutes TTL

        return policy

    except ResourceNotFoundException as e:
        LOGGER.error(f"Drug not found: {drug_id}", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        LOGGER.error(f"Error getting policy requirements: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )