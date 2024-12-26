"""
HIPAA-compliant logging configuration module for Prior Authorization Management System.
Implements secure CloudWatch integration, audit logging, and monitoring capabilities with PHI protection.

Version: 1.0.0
"""

import logging  # version: 3.11+
from os import environ  # version: 3.11+

from config.settings import AWS_SETTINGS, APP_SETTINGS
from core.logging import HIPAACompliantFormatter, CloudWatchHandler

# Environment-specific log levels with secure defaults
LOG_LEVELS = {
    'development': 'DEBUG',
    'staging': 'INFO',
    'production': 'WARNING'
}

# HIPAA-compliant log format with request tracing
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s - %(request_id)s - %(correlation_id)s'

# CloudWatch retention period (7 years for HIPAA compliance)
CLOUDWATCH_RETENTION_DAYS = 2555  # 7 years

# Performance optimization settings
BATCH_SIZE = 1000  # Number of logs to batch before sending
FLUSH_INTERVAL = 60  # Seconds between forced flushes

def configure_logging(environment: str, additional_config: dict = None) -> dict:
    """
    Configures HIPAA-compliant application-wide logging with CloudWatch integration and PHI protection.
    
    Args:
        environment: Deployment environment (development/staging/production)
        additional_config: Optional additional logging configuration
        
    Returns:
        dict: Complete logging configuration dictionary
    
    Raises:
        ValueError: If invalid environment or missing required settings
    """
    if environment not in LOG_LEVELS:
        raise ValueError(f"Invalid environment: {environment}. Must be one of {list(LOG_LEVELS.keys())}")

    # Base configuration with HIPAA compliance
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'hipaa_compliant': {
                '()': HIPAACompliantFormatter,
                'format': LOG_FORMAT,
                'mask_char': '*',
                'mask_length': 8
            }
        },
        'filters': {
            'request_id': {
                '()': 'core.logging.RequestIdFilter'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'hipaa_compliant',
                'filters': ['request_id'],
                'level': LOG_LEVELS[environment]
            },
            'cloudwatch': {
                '()': CloudWatchHandler,
                'log_group': AWS_SETTINGS['CLOUDWATCH_LOG_GROUP'],
                'log_stream': f"{APP_SETTINGS['APP_NAME']}-{environment}",
                'kms_key_id': AWS_SETTINGS['KMS_KEY_ID'],
                'formatter': 'hipaa_compliant',
                'filters': ['request_id'],
                'batch_size': BATCH_SIZE,
                'flush_interval': FLUSH_INTERVAL
            }
        },
        'loggers': {
            '': {  # Root logger
                'handlers': ['console', 'cloudwatch'],
                'level': LOG_LEVELS[environment],
                'propagate': True
            },
            'audit': {  # HIPAA audit logger
                'handlers': ['cloudwatch'],
                'level': 'INFO',
                'propagate': False
            },
            'phi': {  # Protected health information logger
                'handlers': ['cloudwatch'],
                'level': 'INFO',
                'propagate': False
            }
        }
    }

    # Development environment specific settings
    if environment == 'development':
        config['handlers']['console']['level'] = 'DEBUG'
        config['loggers']['']['level'] = 'DEBUG'

    # Production environment specific settings
    if environment == 'production':
        config['handlers']['console']['level'] = 'WARNING'
        config['loggers']['']['level'] = 'WARNING'
        # Ensure PHI logging is strictly controlled
        config['loggers']['phi']['level'] = 'WARNING'

    # Merge additional configuration if provided
    if additional_config:
        _merge_config(config, additional_config)

    return config

def get_cloudwatch_config() -> dict:
    """
    Retrieves secure CloudWatch configuration with HIPAA compliance settings and performance optimization.
    
    Returns:
        dict: CloudWatch configuration with encryption and compliance settings
        
    Raises:
        ValueError: If required AWS settings are missing
    """
    required_settings = ['AWS_REGION', 'KMS_KEY_ID', 'CLOUDWATCH_LOG_GROUP']
    missing_settings = [s for s in required_settings if not AWS_SETTINGS.get(s)]
    
    if missing_settings:
        raise ValueError(f"Missing required AWS settings: {', '.join(missing_settings)}")

    return {
        'log_group_name': AWS_SETTINGS['CLOUDWATCH_LOG_GROUP'],
        'region_name': AWS_SETTINGS['AWS_REGION'],
        'kms_key_id': AWS_SETTINGS['KMS_KEY_ID'],
        'retention_days': CLOUDWATCH_RETENTION_DAYS,
        'performance': {
            'batch_size': BATCH_SIZE,
            'flush_interval': FLUSH_INTERVAL,
            'queue_size': 10000,
            'max_retry_attempts': 3,
            'retry_base_delay': 1.0
        },
        'encryption': {
            'enabled': True,
            'kms_key_id': AWS_SETTINGS['KMS_KEY_ID'],
            'algorithm': 'aws:kms'
        },
        'monitoring': {
            'metric_namespace': 'PriorAuth/Logging',
            'dimensions': {
                'Environment': APP_SETTINGS['ENVIRONMENT'],
                'Application': APP_SETTINGS['APP_NAME']
            },
            'alerts': {
                'error_threshold': 100,
                'latency_threshold': 5000,
                'batch_failure_threshold': 3
            }
        }
    }

def _merge_config(base_config: dict, additional_config: dict) -> None:
    """
    Recursively merges additional configuration into base configuration.
    
    Args:
        base_config: Base configuration dictionary
        additional_config: Additional configuration to merge
    """
    for key, value in additional_config.items():
        if isinstance(value, dict) and key in base_config:
            _merge_config(base_config[key], value)
        else:
            base_config[key] = value

# Export public interface
__all__ = ['configure_logging', 'get_cloudwatch_config', 'LOG_LEVELS']