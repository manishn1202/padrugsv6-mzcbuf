"""
FastAPI router module implementing RESTful endpoints for drug policy management and prior authorization criteria evaluation.
Provides HIPAA-compliant API endpoints with enhanced security, monitoring, and audit logging.

Version: 1.0.0
"""

from uuid import UUID
from typing import Dict, List, Optional
from datetime import datetime

# FastAPI imports
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi_limiter import RateLimiter
from prometheus_client import Counter, Histogram
from circuitbreaker import circuit

# Internal imports
from services.policies import PolicyService
from core.logging import HIPAALogger
from core.exceptions import (
    ValidationException, 
    ResourceNotFoundException,
    AuthorizationException
)
from core.security import verify_token
from db.models.policies import DrugPolicy, PolicyCriterion

# Initialize router with prefix and tags
router = APIRouter(
    prefix="/api/v1/policies",
    tags=["policies"]
)

# Initialize HIPAA-compliant logger
logger = HIPAALogger(__name__)

# Prometheus metrics
POLICY_REQUESTS = Counter(
    'policy_api_requests_total',
    'Total number of policy API requests',
    ['endpoint', 'status']
)

POLICY_LATENCY = Histogram(
    'policy_api_latency_seconds',
    'Policy API endpoint latency',
    ['endpoint']
)

# Rate limiting settings
RATE_LIMIT_POLICY_CREATE = RateLimiter(times=10, seconds=60)
RATE_LIMIT_POLICY_UPDATE = RateLimiter(times=20, seconds=60)
RATE_LIMIT_CRITERIA_EVAL = RateLimiter(times=30, seconds=60)

# OAuth2 scheme for token validation
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
    """Validate JWT token and return current user."""
    try:
        payload = verify_token(token)
        return {
            "user_id": payload["sub"],
            "role": payload["role"],
            "permissions": payload.get("permissions", [])
        }
    except Exception as e:
        raise AuthorizationException("Invalid authentication credentials")

def check_policy_permissions(required_permissions: List[str]):
    """Decorator to check user permissions for policy operations."""
    async def permission_checker(
        current_user: Dict = Depends(get_current_user)
    ) -> Dict:
        user_permissions = set(current_user.get("permissions", []))
        if not all(perm in user_permissions for perm in required_permissions):
            raise AuthorizationException(
                "Insufficient permissions for this operation"
            )
        return current_user
    return permission_checker

@router.post(
    "/",
    response_model=DrugPolicy,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RATE_LIMIT_POLICY_CREATE)]
)
@circuit(failure_threshold=5, recovery_timeout=30)
async def create_policy(
    request: Request,
    policy_data: Dict,
    current_user: Dict = Depends(check_policy_permissions(["manage_policies"]))
) -> DrugPolicy:
    """
    Create new drug policy with HIPAA-compliant validation and auditing.

    Args:
        request: FastAPI request object
        policy_data: Policy creation data
        current_user: Authenticated user information

    Returns:
        DrugPolicy: Created policy details

    Raises:
        ValidationException: If policy data is invalid
        AuthorizationException: If user lacks required permissions
    """
    with POLICY_LATENCY.labels("create_policy").time():
        try:
            # Generate correlation ID for request tracking
            correlation_id = str(UUID.uuid4())
            
            # Log request with HIPAA compliance
            logger.audit_log(
                "Policy creation initiated",
                correlation_id=correlation_id,
                user_id=current_user["user_id"],
                data={
                    "drug_code": policy_data.get("drug_code"),
                    "name": policy_data.get("name")
                }
            )

            # Create policy via service
            policy_service = PolicyService()
            created_policy = await policy_service.create_drug_policy(
                policy_data=policy_data,
                user_id=current_user["user_id"]
            )

            # Record success metric
            POLICY_REQUESTS.labels(
                endpoint="create_policy",
                status="success"
            ).inc()

            return created_policy

        except ValidationException as e:
            POLICY_REQUESTS.labels(
                endpoint="create_policy",
                status="validation_error"
            ).inc()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            POLICY_REQUESTS.labels(
                endpoint="create_policy",
                status="error"
            ).inc()
            logger.error(
                f"Policy creation failed: {str(e)}",
                correlation_id=correlation_id,
                user_id=current_user["user_id"]
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create policy"
            )

@router.post(
    "/{policy_id}/criteria",
    response_model=PolicyCriterion,
    dependencies=[Depends(RATE_LIMIT_POLICY_UPDATE)]
)
@circuit(failure_threshold=5, recovery_timeout=30)
async def add_criterion(
    request: Request,
    policy_id: UUID,
    criterion_data: Dict,
    current_user: Dict = Depends(check_policy_permissions(["manage_policies"]))
) -> PolicyCriterion:
    """
    Add criterion to existing policy with validation.

    Args:
        request: FastAPI request object
        policy_id: UUID of target policy
        criterion_data: Criterion details
        current_user: Authenticated user information

    Returns:
        PolicyCriterion: Created criterion details

    Raises:
        ValidationException: If criterion data is invalid
        ResourceNotFoundException: If policy not found
    """
    with POLICY_LATENCY.labels("add_criterion").time():
        try:
            correlation_id = str(UUID.uuid4())
            
            logger.audit_log(
                "Policy criterion addition initiated",
                correlation_id=correlation_id,
                user_id=current_user["user_id"],
                data={
                    "policy_id": str(policy_id),
                    "criterion_type": criterion_data.get("type")
                }
            )

            policy_service = PolicyService()
            created_criterion = await policy_service.add_policy_criterion(
                policy_id=policy_id,
                criterion_data=criterion_data,
                user_id=current_user["user_id"]
            )

            POLICY_REQUESTS.labels(
                endpoint="add_criterion",
                status="success"
            ).inc()

            return created_criterion

        except (ValidationException, ResourceNotFoundException) as e:
            POLICY_REQUESTS.labels(
                endpoint="add_criterion",
                status="validation_error"
            ).inc()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            POLICY_REQUESTS.labels(
                endpoint="add_criterion",
                status="error"
            ).inc()
            logger.error(
                f"Criterion addition failed: {str(e)}",
                correlation_id=correlation_id,
                user_id=current_user["user_id"]
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add criterion"
            )

@router.post(
    "/evaluate",
    dependencies=[Depends(RATE_LIMIT_CRITERIA_EVAL)]
)
@circuit(failure_threshold=5, recovery_timeout=30)
async def evaluate_request(
    request: Request,
    evaluation_data: Dict,
    current_user: Dict = Depends(check_policy_permissions(["evaluate_policies"]))
) -> Dict:
    """
    Evaluate prior authorization request against policy criteria.

    Args:
        request: FastAPI request object
        evaluation_data: Request and evidence data
        current_user: Authenticated user information

    Returns:
        Dict: Evaluation results with confidence scores

    Raises:
        ValidationException: If evaluation data is invalid
    """
    with POLICY_LATENCY.labels("evaluate_request").time():
        try:
            correlation_id = str(UUID.uuid4())
            
            logger.audit_log(
                "Policy evaluation initiated",
                correlation_id=correlation_id,
                user_id=current_user["user_id"],
                data={
                    "request_id": evaluation_data.get("request_id"),
                    "drug_code": evaluation_data.get("drug_code")
                }
            )

            policy_service = PolicyService()
            evaluation_result = await policy_service.evaluate_prior_auth_request(
                request_id=evaluation_data["request_id"],
                drug_code=evaluation_data["drug_code"],
                clinical_evidence=evaluation_data["evidence"],
                user_id=current_user["user_id"]
            )

            POLICY_REQUESTS.labels(
                endpoint="evaluate_request",
                status="success"
            ).inc()

            return evaluation_result

        except ValidationException as e:
            POLICY_REQUESTS.labels(
                endpoint="evaluate_request",
                status="validation_error"
            ).inc()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            POLICY_REQUESTS.labels(
                endpoint="evaluate_request",
                status="error"
            ).inc()
            logger.error(
                f"Policy evaluation failed: {str(e)}",
                correlation_id=correlation_id,
                user_id=current_user["user_id"]
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to evaluate request"
            )

@router.patch(
    "/{policy_id}/status",
    response_model=DrugPolicy,
    dependencies=[Depends(RATE_LIMIT_POLICY_UPDATE)]
)
@circuit(failure_threshold=5, recovery_timeout=30)
async def update_policy_status(
    request: Request,
    policy_id: UUID,
    status_update: Dict,
    current_user: Dict = Depends(check_policy_permissions(["manage_policies"]))
) -> DrugPolicy:
    """
    Update policy active status with audit trail.

    Args:
        request: FastAPI request object
        policy_id: UUID of target policy
        status_update: New status details
        current_user: Authenticated user information

    Returns:
        DrugPolicy: Updated policy details

    Raises:
        ValidationException: If status update is invalid
        ResourceNotFoundException: If policy not found
    """
    with POLICY_LATENCY.labels("update_policy_status").time():
        try:
            correlation_id = str(UUID.uuid4())
            
            logger.audit_log(
                "Policy status update initiated",
                correlation_id=correlation_id,
                user_id=current_user["user_id"],
                data={
                    "policy_id": str(policy_id),
                    "new_status": status_update.get("active")
                }
            )

            policy_service = PolicyService()
            updated_policy = await policy_service.update_policy_status(
                policy_id=policy_id,
                active=status_update["active"],
                user_id=current_user["user_id"]
            )

            POLICY_REQUESTS.labels(
                endpoint="update_policy_status",
                status="success"
            ).inc()

            return updated_policy

        except (ValidationException, ResourceNotFoundException) as e:
            POLICY_REQUESTS.labels(
                endpoint="update_policy_status",
                status="validation_error"
            ).inc()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            POLICY_REQUESTS.labels(
                endpoint="update_policy_status",
                status="error"
            ).inc()
            logger.error(
                f"Policy status update failed: {str(e)}",
                correlation_id=correlation_id,
                user_id=current_user["user_id"]
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update policy status"
            )