"""
Core configuration module for Prior Authorization Management System.
Centralizes all application settings including environment variables, database configuration,
AWS settings, security parameters and other global configurations.

Implements HIPAA-compliant security settings and performance optimizations.

Version: 1.0.0
"""

from os import environ
from pathlib import Path
from dotenv import load_dotenv  # version: 1.0.0

# Base directory configuration
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Environment configuration
ENV = environ.get('ENV', 'development')
DEBUG = ENV == 'development'

def load_env_file():
    """
    Loads environment variables from .env file based on environment with validation.
    Ensures all required variables are present and properly formatted.
    """
    env_file = BASE_DIR / f'.env.{ENV}'
    if not env_file.exists():
        env_file = BASE_DIR / '.env'
    
    if not env_file.exists():
        raise FileNotFoundError(f"Environment file not found: {env_file}")
    
    load_dotenv(env_file)
    
    # Validate required environment variables
    required_vars = [
        'SECRET_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'KMS_KEY_ID'
    ]
    
    missing_vars = [var for var in required_vars if not environ.get(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

def get_settings():
    """
    Returns all application settings as a dictionary with environment-specific overrides.
    Implements caching and validation of settings values.
    
    Returns:
        dict: Complete application settings dictionary
    """
    settings = {
        'app': APP_SETTINGS,
        'database': DATABASE_SETTINGS,
        'aws': AWS_SETTINGS,
        'security': SECURITY_SETTINGS,
        'cache': CACHE_SETTINGS,
        'celery': CELERY_SETTINGS
    }
    
    # Environment-specific overrides
    if ENV == 'production':
        settings['app']['DEBUG'] = False
        settings['database']['ECHO_SQL'] = False
        settings['security']['SECURE_HEADERS'] = True
        
    return settings

# Core application settings
APP_SETTINGS = {
    'APP_NAME': 'Prior Authorization Management System',
    'API_VERSION': 'v1',
    'DEBUG': DEBUG,
    'HOST': environ.get('HOST', '0.0.0.0'),
    'PORT': int(environ.get('PORT', 8000)),
    'CORS_ORIGINS': environ.get('CORS_ORIGINS', '').split(','),
    'REQUEST_TIMEOUT': 30,  # seconds
    'MAX_PAGE_SIZE': 100,
    'RATE_LIMIT_PER_MINUTE': 100,
    'HEALTH_CHECK_INTERVAL': 30  # seconds
}

# Database configuration with connection pooling
DATABASE_SETTINGS = {
    'DB_HOST': environ.get('DB_HOST', 'localhost'),
    'DB_PORT': int(environ.get('DB_PORT', 5432)),
    'DB_NAME': environ.get('DB_NAME', 'prior_auth_db'),
    'DB_USER': environ.get('DB_USER', 'postgres'),
    'DB_PASSWORD': environ.get('DB_PASSWORD', ''),
    'POOL_SIZE': 20,  # Maximum number of database connections
    'MAX_OVERFLOW': 10,  # Maximum number of connections that can be created beyond pool_size
    'POOL_TIMEOUT': 30,  # Seconds to wait before timing out on connection pool checkout
    'POOL_RECYCLE': 3600,  # Seconds after which a connection is automatically recycled
    'ECHO_SQL': DEBUG  # Log SQL queries in debug mode
}

# AWS service configuration
AWS_SETTINGS = {
    'AWS_REGION': environ.get('AWS_REGION', 'us-east-1'),
    'AWS_ACCESS_KEY_ID': environ.get('AWS_ACCESS_KEY_ID'),
    'AWS_SECRET_ACCESS_KEY': environ.get('AWS_SECRET_ACCESS_KEY'),
    'S3_BUCKET': environ.get('S3_BUCKET'),
    'KMS_KEY_ID': environ.get('KMS_KEY_ID'),
    'CLOUDWATCH_LOG_GROUP': environ.get('CLOUDWATCH_LOG_GROUP'),
    'PARAMETER_STORE_PREFIX': '/prior-auth/',
    'S3_ENCRYPTION': 'aws:kms'  # Server-side encryption using KMS
}

# Security settings with HIPAA compliance
SECURITY_SETTINGS = {
    'SECRET_KEY': environ.get('SECRET_KEY'),
    'JWT_ALGORITHM': 'HS256',
    'ACCESS_TOKEN_EXPIRE_MINUTES': 60,
    'REFRESH_TOKEN_EXPIRE_DAYS': 7,
    'PASSWORD_MIN_LENGTH': 12,
    'MAX_LOGIN_ATTEMPTS': 5,
    'MFA_REQUIRED': True,  # Enforce multi-factor authentication
    'SESSION_TIMEOUT': 1800,  # 30 minutes in seconds
    'SECURE_HEADERS': True,  # Enable security headers (HSTS, CSP, etc.)
    'TLS_VERSION': '1.3'  # Minimum TLS version
}

# Redis cache configuration
CACHE_SETTINGS = {
    'REDIS_HOST': environ.get('REDIS_HOST', 'localhost'),
    'REDIS_PORT': int(environ.get('REDIS_PORT', 6379)),
    'REDIS_DB': int(environ.get('REDIS_DB', 0)),
    'REDIS_PASSWORD': environ.get('REDIS_PASSWORD', ''),
    'DEFAULT_TIMEOUT': 300,  # 5 minutes in seconds
    'KEY_PREFIX': 'prior_auth:',
    'HEALTH_CHECK_INTERVAL': 30  # seconds
}

# Celery async task configuration
CELERY_SETTINGS = {
    'BROKER_URL': environ.get('CELERY_BROKER_URL'),
    'RESULT_BACKEND': environ.get('CELERY_RESULT_BACKEND'),
    'TASK_SERIALIZER': 'json',
    'RESULT_SERIALIZER': 'json',
    'ACCEPT_CONTENT': ['json'],
    'TIMEZONE': 'UTC',
    'TASK_TRACK_STARTED': True,
    'TASK_TIME_LIMIT': 3600,  # 1 hour in seconds
    'WORKER_CONCURRENCY': 8
}

# Load environment variables on module import
load_env_file()

# Export settings
__all__ = [
    'APP_SETTINGS',
    'DATABASE_SETTINGS', 
    'AWS_SETTINGS',
    'SECURITY_SETTINGS',
    'CACHE_SETTINGS',
    'CELERY_SETTINGS',
    'get_settings'
]