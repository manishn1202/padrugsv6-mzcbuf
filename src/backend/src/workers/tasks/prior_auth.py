"""
Celery task definitions for asynchronous processing of prior authorization requests.
Implements HIPAA-compliant clinical evidence evaluation, status updates, and audit logging.

Version: 1.0.0
"""

import asyncio
import uuid
from typing import Dict, List, Optional
from datetime import datetime
from functools import wraps

from prometheus_client import Counter, Histogram  # version: 0.16+

from workers.celery import celery_app
from services.prior_auth import PriorAuthService
from core.logging import get_request_logger

# Retry policy for task failures
RETRY_POLICY = {
    'max_retries': 3,
    'interval_start': 60,  # Start with 1 minute delay
    'interval_step': 60,   # Increase by 1 minute each retry
    'interval_max': 300    # Maximum 5 minute delay
}

# Queue configuration
TASK_QUEUE = 'prior_auth'

# Prometheus metrics
METRICS = {
    'processing_time': Histogram(
        'pa_processing_time_seconds',
        'Time spent processing PA requests',
        ['task_type']
    ),
    'request_count': Counter(
        'pa_requests_total',
        'Total number of PA requests processed',
        ['status']
    ),
    'error_count': Counter(
        'pa_errors_total',
        'Total number of PA processing errors',
        ['error_type']
    )
}

def audit_log(func):
    """Decorator for HIPAA-compliant audit logging of task operations."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        request_id = kwargs.get('request_id') or (args[0] if args else None)
        start_time = datetime.utcnow()
        logger = get_request_logger(str(request_id))

        try:
            result = await func(*args, **kwargs)
            logger.info(
                f"Task {func.__name__} completed successfully",
                extra={
                    'request_id': str(request_id),
                    'duration_ms': (datetime.utcnow() - start_time).total_seconds() * 1000,
                    'task_name': func.__name__
                }
            )
            return result

        except Exception as e:
            logger.error(
                f"Task {func.__name__} failed: {str(e)}",
                extra={
                    'request_id': str(request_id),
                    'duration_ms': (datetime.utcnow() - start_time).total_seconds() * 1000,
                    'task_name': func.__name__,
                    'error': str(e)
                }
            )
            METRICS['error_count'].labels(error_type=e.__class__.__name__).inc()
            raise

    return wrapper

@celery_app.task(
    queue=TASK_QUEUE,
    **RETRY_POLICY,
    bind=True,
    name='prior_auth.process_clinical_evidence'
)
@audit_log
async def process_clinical_evidence_task(
    self,
    request_id: str,
    clinical_evidence: List[Dict],
    security_context: Dict
) -> Dict:
    """
    Process and evaluate clinical evidence for a prior authorization request.
    
    Args:
        request_id: Prior authorization request ID
        clinical_evidence: List of clinical evidence to evaluate
        security_context: Security context for HIPAA compliance
        
    Returns:
        Dict containing match results and recommendation
        
    Raises:
        ValidationException: If evidence validation fails
        WorkflowException: If workflow state transition is invalid
    """
    logger = get_request_logger(request_id)
    logger.info(
        "Starting clinical evidence processing",
        extra={
            'request_id': request_id,
            'evidence_count': len(clinical_evidence)
        }
    )

    try:
        # Track request metrics
        METRICS['request_count'].labels(status='processing').inc()

        # Initialize service with security context
        service = PriorAuthService(security_context=security_context)

        # Process clinical evidence with timing
        with METRICS['processing_time'].labels(task_type='evidence_processing').time():
            results = await service.process_clinical_evidence(
                request_id=uuid.UUID(request_id),
                clinical_evidence=clinical_evidence
            )

        # Update metrics based on result
        if results.get('recommendation') == 'APPROVE':
            METRICS['request_count'].labels(status='approved').inc()
        elif results.get('recommendation') == 'DENY':
            METRICS['request_count'].labels(status='denied').inc()
        else:
            METRICS['request_count'].labels(status='review').inc()

        logger.info(
            "Clinical evidence processing completed",
            extra={
                'request_id': request_id,
                'confidence_score': results.get('confidence_score'),
                'recommendation': results.get('recommendation')
            }
        )

        return results

    except Exception as e:
        logger.error(
            f"Clinical evidence processing failed: {str(e)}",
            extra={'request_id': request_id}
        )
        METRICS['error_count'].labels(error_type=e.__class__.__name__).inc()
        raise

@celery_app.task(
    queue=TASK_QUEUE,
    **RETRY_POLICY,
    bind=True,
    name='prior_auth.update_request_status'
)
@audit_log
async def update_request_status_task(
    self,
    request_id: str,
    new_status: str,
    review_notes: Optional[Dict] = None,
    security_context: Dict = None
) -> Dict:
    """
    Update the status of a prior authorization request.
    
    Args:
        request_id: Prior authorization request ID
        new_status: New status value
        review_notes: Optional review notes and decision details
        security_context: Security context for HIPAA compliance
        
    Returns:
        Dict containing update status and audit trail
        
    Raises:
        ValidationException: If status update is invalid
        WorkflowException: If workflow state transition is invalid
    """
    logger = get_request_logger(request_id)
    logger.info(
        "Starting request status update",
        extra={
            'request_id': request_id,
            'new_status': new_status
        }
    )

    try:
        # Track status update metrics
        METRICS['request_count'].labels(status='updating').inc()

        # Initialize service with security context
        service = PriorAuthService(security_context=security_context)

        # Update request status with timing
        with METRICS['processing_time'].labels(task_type='status_update').time():
            result = await service.update_request_status(
                request_id=uuid.UUID(request_id),
                new_status=new_status,
                review_notes=review_notes
            )

        # Update metrics based on new status
        METRICS['request_count'].labels(status=new_status.lower()).inc()

        logger.info(
            "Request status update completed",
            extra={
                'request_id': request_id,
                'new_status': new_status,
                'success': result.get('success', False)
            }
        )

        return result

    except Exception as e:
        logger.error(
            f"Request status update failed: {str(e)}",
            extra={
                'request_id': request_id,
                'new_status': new_status
            }
        )
        METRICS['error_count'].labels(error_type=e.__class__.__name__).inc()
        raise

# Export task functions
__all__ = [
    'process_clinical_evidence_task',
    'update_request_status_task'
]