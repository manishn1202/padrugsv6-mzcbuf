"""
Celery task definitions for clinical data processing and evidence analysis.
Implements HIPAA-compliant asynchronous processing with enhanced performance monitoring.

Version: 1.0.0
"""

import logging
import uuid
from typing import Dict, List, Optional
from datetime import datetime

from celery import Task
from opentelemetry import trace  # version: 1.12.0
from opentelemetry.trace import Status, StatusCode

from workers.celery import celery_app
from services.clinical import ClinicalService
from ai.criteria_matcher import CriteriaMatcher
from core.exceptions import ValidationException
from core.logging import get_request_logger

# Constants for task configuration
RETRY_BACKOFF = 60  # Exponential backoff starting at 60 seconds
MAX_RETRIES = 3  # Maximum number of retry attempts
TASK_SOFT_TIMEOUT = 1500  # Task timeout in seconds
CIRCUIT_BREAKER_THRESHOLD = 0.5  # Circuit breaker threshold for error rate
METRICS_INTERVAL = 60  # Metrics collection interval in seconds

# Initialize tracer
tracer = trace.get_tracer(__name__)

class BaseTask(Task):
    """Base task class with enhanced error handling and monitoring."""

    _circuit_breaker_counter = 0
    _total_requests = 0

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure with enhanced error tracking."""
        self._circuit_breaker_counter += 1
        self._total_requests += 1

        # Calculate error rate
        error_rate = self._circuit_breaker_counter / max(self._total_requests, 1)

        logger = get_request_logger(task_id)
        logger.error(
            f"Task {task_id} failed",
            extra={
                'error': str(exc),
                'args': args,
                'kwargs': kwargs,
                'error_rate': error_rate
            }
        )

        # Check circuit breaker threshold
        if error_rate > CIRCUIT_BREAKER_THRESHOLD:
            logger.critical(
                "Circuit breaker threshold exceeded",
                extra={'error_rate': error_rate}
            )

    def on_success(self, retval, task_id, args, kwargs):
        """Handle successful task completion."""
        self._total_requests += 1
        
        logger = get_request_logger(task_id)
        logger.info(
            f"Task {task_id} completed successfully",
            extra={
                'args': args,
                'kwargs': kwargs
            }
        )

@celery_app.task(
    base=BaseTask,
    bind=True,
    queue='clinical',
    max_retries=MAX_RETRIES,
    soft_time_limit=TASK_SOFT_TIMEOUT,
    priority=8
)
async def process_clinical_data(
    self,
    request_id: uuid.UUID,
    data_type: str,
    fhir_data: Dict
) -> Dict:
    """
    Process clinical data with HIPAA compliance and performance monitoring.

    Args:
        request_id: Prior authorization request ID
        data_type: Type of clinical data
        fhir_data: FHIR-formatted clinical data

    Returns:
        Dict containing processed clinical data and analysis results

    Raises:
        ValidationException: If data validation fails
    """
    with tracer.start_as_current_span("process_clinical_data") as span:
        try:
            span.set_attribute("request_id", str(request_id))
            logger = get_request_logger(str(request_id))

            logger.info(
                "Processing clinical data",
                extra={
                    'request_id': str(request_id),
                    'data_type': data_type
                }
            )

            # Initialize clinical service
            clinical_service = ClinicalService()

            # Create clinical record with validation
            result = await clinical_service.create_clinical_record(
                request_id=request_id,
                data_type=data_type,
                fhir_data=fhir_data
            )

            span.set_status(Status(StatusCode.OK))
            return result

        except ValidationException as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(
                f"Clinical data validation failed: {str(e)}",
                extra={'request_id': str(request_id)}
            )
            raise self.retry(
                exc=e,
                countdown=RETRY_BACKOFF * (2 ** self.request.retries)
            )
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(
                f"Clinical data processing failed: {str(e)}",
                extra={'request_id': str(request_id)}
            )
            raise

@celery_app.task(
    base=BaseTask,
    bind=True,
    queue='clinical',
    max_retries=MAX_RETRIES,
    soft_time_limit=TASK_SOFT_TIMEOUT,
    priority=9
)
async def match_clinical_criteria(
    self,
    request_id: uuid.UUID,
    evidence_ids: List[uuid.UUID],
    criteria_ids: List[uuid.UUID]
) -> Dict:
    """
    Match clinical evidence against policy criteria with AI assistance.

    Args:
        request_id: Prior authorization request ID
        evidence_ids: List of clinical evidence IDs to evaluate
        criteria_ids: List of policy criteria IDs to match against

    Returns:
        Dict containing match results and confidence scores

    Raises:
        ValidationException: If matching fails
    """
    with tracer.start_as_current_span("match_clinical_criteria") as span:
        try:
            span.set_attribute("request_id", str(request_id))
            logger = get_request_logger(str(request_id))

            logger.info(
                "Starting criteria matching",
                extra={
                    'request_id': str(request_id),
                    'evidence_count': len(evidence_ids),
                    'criteria_count': len(criteria_ids)
                }
            )

            # Initialize criteria matcher
            criteria_matcher = CriteriaMatcher()

            # Perform matching with retries
            match_result = await criteria_matcher.match_criteria(
                request_id=request_id,
                evidence_ids=evidence_ids,
                criteria_ids=criteria_ids
            )

            span.set_status(Status(StatusCode.OK))
            return match_result.to_dict()

        except ValidationException as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(
                f"Criteria matching failed: {str(e)}",
                extra={'request_id': str(request_id)}
            )
            raise self.retry(
                exc=e,
                countdown=RETRY_BACKOFF * (2 ** self.request.retries)
            )
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(
                f"Unexpected error during criteria matching: {str(e)}",
                extra={'request_id': str(request_id)}
            )
            raise

@celery_app.task(
    base=BaseTask,
    bind=True,
    queue='clinical',
    max_retries=MAX_RETRIES,
    soft_time_limit=TASK_SOFT_TIMEOUT,
    priority=7
)
async def import_fhir_clinical_data(
    self,
    request_id: uuid.UUID,
    patient_id: str
) -> Dict:
    """
    Import clinical data from FHIR server with HIPAA compliance.

    Args:
        request_id: Prior authorization request ID
        patient_id: FHIR patient identifier

    Returns:
        Dict containing imported clinical data

    Raises:
        ValidationException: If FHIR import fails
    """
    with tracer.start_as_current_span("import_fhir_clinical_data") as span:
        try:
            span.set_attribute("request_id", str(request_id))
            logger = get_request_logger(str(request_id))

            logger.info(
                "Importing FHIR clinical data",
                extra={
                    'request_id': str(request_id),
                    'patient_id': patient_id
                }
            )

            # Initialize clinical service
            clinical_service = ClinicalService()

            # Import FHIR data with validation
            result = await clinical_service.import_fhir_data(
                request_id=request_id,
                patient_id=patient_id
            )

            span.set_status(Status(StatusCode.OK))
            return result

        except ValidationException as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(
                f"FHIR data import failed: {str(e)}",
                extra={
                    'request_id': str(request_id),
                    'patient_id': patient_id
                }
            )
            raise self.retry(
                exc=e,
                countdown=RETRY_BACKOFF * (2 ** self.request.retries)
            )
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR))
            logger.error(
                f"Unexpected error during FHIR import: {str(e)}",
                extra={
                    'request_id': str(request_id),
                    'patient_id': patient_id
                }
            )
            raise