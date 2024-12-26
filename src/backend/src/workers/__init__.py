"""
Workers package initialization for Prior Authorization Management System.
Provides centralized access to asynchronous task processing capabilities with HIPAA-compliant configurations.

Version: 1.0.0
"""

# Import Celery application instance
from workers.celery import celery_app

# Import task modules
from workers.tasks.clinical import (
    process_clinical_data,
    match_clinical_criteria,
    import_fhir_clinical_data
)
from workers.tasks.documents import (
    process_document_upload,
    scan_document,
    cleanup_expired_documents
)
from workers.tasks.notifications import (
    send_status_notification,
    send_info_request_notification
)
from workers.tasks.prior_auth import (
    process_clinical_evidence_task,
    update_request_status_task
)

# Task module registry for auto-discovery
TASK_MODULES = [
    'workers.tasks.clinical',
    'workers.tasks.documents',
    'workers.tasks.notifications',
    'workers.tasks.prior_auth'
]

# Queue configuration with optimized concurrency settings
TASK_QUEUES = {
    'clinical': {
        'concurrency': 4,  # Optimized for CPU-intensive clinical processing
        'prefetch_multiplier': 2  # Moderate prefetching for balanced throughput
    },
    'documents': {
        'concurrency': 2,  # Limited by I/O and virus scanning
        'prefetch_multiplier': 4  # Higher prefetch for I/O-bound tasks
    },
    'notifications': {
        'concurrency': 8,  # High concurrency for fast notification delivery
        'prefetch_multiplier': 1  # Minimal prefetch to prevent overload
    },
    'prior_auth': {
        'concurrency': 4,  # Balanced for mixed workload
        'prefetch_multiplier': 2  # Moderate prefetch for stability
    }
}

# Export public interface
__all__ = [
    # Celery application
    'celery_app',
    
    # Clinical tasks
    'process_clinical_data',
    'match_clinical_criteria',
    'import_fhir_clinical_data',
    
    # Document tasks
    'process_document_upload',
    'scan_document',
    'cleanup_expired_documents',
    
    # Notification tasks
    'send_status_notification',
    'send_info_request_notification',
    
    # Prior auth tasks
    'process_clinical_evidence_task',
    'update_request_status_task',
    
    # Configuration
    'TASK_MODULES',
    'TASK_QUEUES'
]