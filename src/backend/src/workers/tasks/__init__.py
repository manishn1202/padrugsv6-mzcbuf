"""
Main entry point for Celery task definitions in the Prior Authorization Management System.
Consolidates and exports all asynchronous tasks for clinical processing, document management,
notifications, and prior authorization workflows.

Version: 1.0.0
"""

# Import clinical processing tasks
from workers.tasks.clinical import (
    process_clinical_data,  # Clinical data processing task
    match_clinical_criteria,  # AI-powered criteria matching task
    import_fhir_clinical_data  # FHIR data import task
)

# Import document management tasks
from workers.tasks.documents import (
    scan_document,  # Document virus scanning task
    process_document_upload,  # Document upload processing task
    cleanup_expired_documents  # Document cleanup task
)

# Import notification tasks
from workers.tasks.notifications import (
    send_status_notification,  # Status update notification task
    send_info_request_notification  # Information request notification task
)

# Import prior authorization tasks
from workers.tasks.prior_auth import (
    process_clinical_evidence_task,  # Clinical evidence processing task
    update_request_status_task  # Request status update task
)

# Export all task functions for Celery discovery
__all__ = [
    # Clinical tasks
    'process_clinical_data',
    'match_clinical_criteria',
    'import_fhir_clinical_data',
    
    # Document tasks
    'scan_document',
    'process_document_upload',
    'cleanup_expired_documents',
    
    # Notification tasks
    'send_status_notification',
    'send_info_request_notification',
    
    # Prior authorization tasks
    'process_clinical_evidence_task',
    'update_request_status_task'
]

# Task routing configuration
task_routes = {
    # Clinical tasks
    'clinical.*': {'queue': 'clinical'},
    'workers.tasks.clinical.*': {'queue': 'clinical'},
    
    # Document tasks
    'documents.*': {'queue': 'documents'},
    'workers.tasks.documents.*': {'queue': 'documents'},
    
    # Notification tasks
    'notifications.*': {'queue': 'notifications'},
    'workers.tasks.notifications.*': {'queue': 'notifications'},
    
    # Prior authorization tasks
    'prior_auth.*': {'queue': 'prior_auth'},
    'workers.tasks.prior_auth.*': {'queue': 'prior_auth'}
}

# Task priority configuration
task_priority = {
    # High priority tasks
    'notifications.send_status': 9,
    'notifications.send_info_request': 9,
    'clinical.match_clinical_criteria': 8,
    
    # Medium priority tasks
    'clinical.process_clinical_data': 7,
    'prior_auth.process_clinical_evidence': 7,
    'prior_auth.update_request_status': 7,
    
    # Lower priority tasks
    'clinical.import_fhir_clinical_data': 6,
    'documents.scan_document': 5,
    'documents.process_document_upload': 5,
    'documents.cleanup_expired_documents': 3
}

# Task retry configuration
task_retry_policy = {
    'max_retries': 3,
    'interval_start': 60,  # Start with 1 minute delay
    'interval_step': 60,   # Increase by 1 minute each retry
    'interval_max': 300    # Maximum 5 minute delay
}