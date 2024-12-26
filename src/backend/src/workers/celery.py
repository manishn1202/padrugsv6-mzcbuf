"""
Celery worker configuration for Prior Authorization Management System.
Implements HIPAA-compliant task processing with encryption, monitoring, and high availability.

Version: 1.0.0
"""

from celery import Celery  # version: 5.3.0
from kombu import Queue  # version: 5.3.0
from celery.schedules import crontab  # version: 5.3.0
from functools import wraps

from config.settings import CELERY_SETTINGS
from core.logging import LOGGER, setup_logging

# Queue definitions with priorities
QUEUE_NAMES = {
    'clinical': 'clinical',
    'documents': 'documents',
    'notifications': 'notifications',
    'prior_auth': 'prior_auth',
    'high_priority': 'high_priority',
    'dead_letter': 'dead_letter'
}

# Task routing configuration
TASK_ROUTES = {
    'clinical.*': {'queue': QUEUE_NAMES['clinical']},
    'documents.*': {'queue': QUEUE_NAMES['documents']},
    'notifications.*': {'queue': QUEUE_NAMES['notifications']},
    'prior_auth.*': {'queue': QUEUE_NAMES['prior_auth']},
    'urgent.*': {'queue': QUEUE_NAMES['high_priority']}
}

# Periodic task schedule
BEAT_SCHEDULE = {
    'cleanup-expired-documents': {
        'task': 'documents.cleanup_expired_documents',
        'schedule': 86400,  # Daily
        'options': {'queue': QUEUE_NAMES['documents']}
    },
    'health-check': {
        'task': 'core.health_check',
        'schedule': 300,  # Every 5 minutes
        'options': {'queue': QUEUE_NAMES['high_priority']}
    },
    'metrics-collection': {
        'task': 'core.collect_metrics',
        'schedule': 60,  # Every minute
        'options': {'queue': QUEUE_NAMES['high_priority']}
    }
}

class CeleryConfig:
    """HIPAA-compliant Celery configuration with security and monitoring."""
    
    def __init__(self):
        """Initialize Celery configuration with secure defaults."""
        # Broker and backend settings
        self.broker_url = CELERY_SETTINGS['BROKER_URL']
        self.result_backend = CELERY_SETTINGS['RESULT_BACKEND']
        
        # Security settings
        self.task_serializer = 'json'
        self.result_serializer = 'json'
        self.accept_content = ['json']
        self.task_track_started = True
        
        # Performance settings
        self.task_time_limit = 3600  # 1 hour
        self.worker_prefetch_multiplier = 1
        self.worker_concurrency = CELERY_SETTINGS['WORKER_CONCURRENCY']
        
        # Queue configuration
        self.task_queues = [
            Queue(name, routing_key=name) 
            for name in QUEUE_NAMES.values()
        ]
        
        # Task routing and priorities
        self.task_routes = TASK_ROUTES
        self.task_default_priority = 5
        self.task_inherit_parent_priority = True
        
        # Dead letter configuration
        self.task_annotations = {
            '*': {
                'on_failure': self._handle_task_failure
            }
        }
        
        # State and monitoring
        self.worker_state_db = '/tmp/celery-state'
        self.result_expires = 86400  # 24 hours
        
        # Optimization settings
        self.task_compression = 'gzip'
        self.broker_transport_options = {
            'visibility_timeout': 3600,
            'max_retries': 3,
            'interval_start': 0,
            'interval_step': 0.2,
            'interval_max': 0.5,
        }

    def _handle_task_failure(self, task, exc, task_id, args, kwargs, einfo):
        """Handle failed tasks by moving them to dead letter queue."""
        LOGGER.error(f"Task {task_id} failed: {exc}", extra={
            'task_name': task.name,
            'args': args,
            'kwargs': kwargs,
            'exception': str(exc)
        })
        
        # Republish to dead letter queue
        task.apply_async(
            args=args,
            kwargs=kwargs,
            queue=QUEUE_NAMES['dead_letter']
        )

def ensure_logging(func):
    """Decorator to ensure proper logging setup for Celery tasks."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        setup_logging(
            app_name='celery-worker',
            log_level='INFO',
            enable_cloudwatch=True
        )
        return func(*args, **kwargs)
    return wrapper

@ensure_logging
def init_celery() -> Celery:
    """
    Initialize and configure Celery application with HIPAA-compliant settings.
    
    Returns:
        Celery: Configured Celery application instance
    """
    LOGGER.info("Initializing Celery application")
    
    # Create Celery application
    app = Celery('prior_auth')
    
    # Load configuration
    app.config_from_object(CeleryConfig())
    
    # Configure periodic tasks
    app.conf.beat_schedule = BEAT_SCHEDULE
    
    # Set up task error handling
    app.conf.task_eager_propagates = True
    
    # Enable task events for monitoring
    app.conf.worker_send_task_events = True
    app.conf.task_send_sent_event = True
    
    LOGGER.info("Celery application initialized successfully")
    return app

# Create Celery application instance
celery_app = init_celery()

# Export Celery application
__all__ = ['celery_app']