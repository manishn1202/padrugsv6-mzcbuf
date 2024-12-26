"""
Celery task definitions for asynchronous notification processing in the Prior Authorization Management System.
Implements high-performance, HIPAA-compliant notification handling with comprehensive error management.

Version: 1.0.0
"""

from uuid import UUID
from datetime import datetime
import redis  # version: 4.5.0+

from workers.celery import celery_app
from services.notifications import NotificationService
from core.constants import NotificationType
from core.logging import LOGGER

# Performance monitoring metrics
NOTIFICATION_METRICS = {
    'success_count': 0,
    'error_count': 0,
    'avg_processing_time': 0
}

@celery_app.task(
    name='notifications.send_status',
    queue='notifications',
    retry_backoff=True,
    max_retries=3,
    task_time_limit=30,
    acks_late=True
)
async def send_status_notification(
    user_id: UUID,
    request_id: UUID,
    status: str,
    context: dict,
    use_cache: bool = True
) -> bool:
    """
    Enhanced Celery task for sending status update notifications with performance optimization.

    Args:
        user_id: Target user ID
        request_id: Prior authorization request ID
        status: Current request status
        context: Additional context data
        use_cache: Whether to use cache for notification checking

    Returns:
        bool: Success status of notification creation
    """
    start_time = datetime.utcnow()
    
    try:
        # Initialize notification service
        notification_service = NotificationService(
            db_session=None,  # Will be injected by service
            batch_size=100,
            cache_ttl=300
        )

        # Validate and mask PHI in context
        masked_context = {
            'drug_name': context.get('drug_name', 'medication'),
            'request_id': str(request_id),
            'status': status,
            'timestamp': datetime.utcnow().isoformat()
        }

        # Map status to notification type
        notification_type = NotificationType[status] if status in NotificationType.__members__ else NotificationType.REQUEST_UPDATED

        # Create notification with retry mechanism
        notification = await notification_service.create_status_notification_batch(
            user_ids=[user_id],
            request_ids=[request_id],
            statuses=[status],
            contexts=[masked_context]
        )

        # Update performance metrics
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        NOTIFICATION_METRICS['success_count'] += 1
        NOTIFICATION_METRICS['avg_processing_time'] = (
            (NOTIFICATION_METRICS['avg_processing_time'] * (NOTIFICATION_METRICS['success_count'] - 1) + processing_time)
            / NOTIFICATION_METRICS['success_count']
        )

        LOGGER.info(
            f"Status notification sent successfully",
            extra={
                'user_id': str(user_id),
                'request_id': str(request_id),
                'status': status,
                'processing_time': processing_time
            }
        )

        return True

    except Exception as e:
        NOTIFICATION_METRICS['error_count'] += 1
        
        LOGGER.error(
            f"Failed to send status notification: {str(e)}",
            extra={
                'user_id': str(user_id),
                'request_id': str(request_id),
                'status': status,
                'error': str(e)
            }
        )
        
        # Retry with exponential backoff
        raise send_status_notification.retry(exc=e)

@celery_app.task(
    name='notifications.send_info_request',
    queue='notifications',
    retry_backoff=True,
    max_retries=3,
    task_time_limit=30,
    acks_late=True
)
async def send_info_request_notification(
    user_id: UUID,
    request_id: UUID,
    required_info: list,
    context: dict,
    batch_mode: bool = False
) -> bool:
    """
    Enhanced Celery task for sending information request notifications with batch processing.

    Args:
        user_id: Target user ID
        request_id: Prior authorization request ID
        required_info: List of required information items
        context: Additional context data
        batch_mode: Whether to use batch processing

    Returns:
        bool: Success status of notification creation
    """
    start_time = datetime.utcnow()
    
    try:
        # Initialize notification service
        notification_service = NotificationService(
            db_session=None,  # Will be injected by service
            batch_size=100 if batch_mode else 1,
            cache_ttl=300
        )

        # Validate and mask PHI in context
        masked_context = {
            'drug_name': context.get('drug_name', 'medication'),
            'request_id': str(request_id),
            'required_info': required_info,
            'timestamp': datetime.utcnow().isoformat()
        }

        # Create notification with batch support
        notification = await notification_service.create_status_notification_batch(
            user_ids=[user_id],
            request_ids=[request_id],
            statuses=[NotificationType.INFO_NEEDED],
            contexts=[masked_context]
        )

        # Update performance metrics
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        NOTIFICATION_METRICS['success_count'] += 1
        NOTIFICATION_METRICS['avg_processing_time'] = (
            (NOTIFICATION_METRICS['avg_processing_time'] * (NOTIFICATION_METRICS['success_count'] - 1) + processing_time)
            / NOTIFICATION_METRICS['success_count']
        )

        LOGGER.info(
            f"Info request notification sent successfully",
            extra={
                'user_id': str(user_id),
                'request_id': str(request_id),
                'required_info_count': len(required_info),
                'processing_time': processing_time
            }
        )

        return True

    except Exception as e:
        NOTIFICATION_METRICS['error_count'] += 1
        
        LOGGER.error(
            f"Failed to send info request notification: {str(e)}",
            extra={
                'user_id': str(user_id),
                'request_id': str(request_id),
                'required_info_count': len(required_info),
                'error': str(e)
            }
        )
        
        # Retry with exponential backoff
        raise send_info_request_notification.retry(exc=e)