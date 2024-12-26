"""
Health check endpoints for Prior Authorization Management System.
Implements comprehensive system monitoring, dependency checks, and AWS infrastructure health monitoring.

Version: 1.0.0
"""

import time
import psutil  # version: 5.9.0
import boto3  # version: 1.26.0
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, status
from sqlalchemy import text
from redis import Redis  # version: 4.5.0

from api.schemas.responses import BaseResponse
from core.logging import LOGGER
from config.settings import (
    APP_SETTINGS,
    DATABASE_SETTINGS,
    CACHE_SETTINGS,
    AWS_SETTINGS
)

# Initialize router
router = APIRouter(prefix='/health', tags=['Health'])

# AWS clients for infrastructure checks
cloudwatch = boto3.client('cloudwatch')
s3 = boto3.client('s3')

# Process start time for uptime calculation
PROCESS_START_TIME = time.time()

def check_database() -> Dict[str, Any]:
    """
    Check PostgreSQL database connectivity and health.
    
    Returns:
        Dict containing database health status and metrics
    """
    from sqlalchemy import create_engine
    
    try:
        # Create database URL
        db_url = f"postgresql://{DATABASE_SETTINGS['DB_USER']}:{DATABASE_SETTINGS['DB_PASSWORD']}@" \
                 f"{DATABASE_SETTINGS['DB_HOST']}:{DATABASE_SETTINGS['DB_PORT']}/{DATABASE_SETTINGS['DB_NAME']}"
        
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Execute health check query
            result = conn.execute(text("SELECT 1")).scalar()
            
            return {
                "status": "healthy" if result == 1 else "unhealthy",
                "latency_ms": round(time.time() * 1000),
                "connections": engine.pool.size()
            }
    except Exception as e:
        LOGGER.error(f"Database health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

def check_redis() -> Dict[str, Any]:
    """
    Check Redis cache connectivity and health.
    
    Returns:
        Dict containing Redis health status and metrics
    """
    try:
        redis_client = Redis(
            host=CACHE_SETTINGS['REDIS_HOST'],
            port=CACHE_SETTINGS['REDIS_PORT'],
            db=CACHE_SETTINGS['REDIS_DB'],
            password=CACHE_SETTINGS['REDIS_PASSWORD'],
            socket_timeout=5
        )
        
        # Test Redis connection
        redis_client.ping()
        info = redis_client.info()
        
        return {
            "status": "healthy",
            "used_memory": info['used_memory_human'],
            "connected_clients": info['connected_clients'],
            "uptime_days": info['uptime_in_days']
        }
    except Exception as e:
        LOGGER.error(f"Redis health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

def check_aws_services() -> Dict[str, Any]:
    """
    Check AWS service health including S3 and CloudWatch.
    
    Returns:
        Dict containing AWS services health status
    """
    try:
        # Check S3 bucket access
        s3.head_bucket(Bucket=AWS_SETTINGS['S3_BUCKET'])
        
        # Check CloudWatch metrics
        cloudwatch.put_metric_data(
            Namespace='PriorAuth/Health',
            MetricData=[{
                'MetricName': 'HealthCheck',
                'Value': 1,
                'Unit': 'Count'
            }]
        )
        
        return {
            "status": "healthy",
            "s3_bucket": AWS_SETTINGS['S3_BUCKET'],
            "region": AWS_SETTINGS['AWS_REGION']
        }
    except Exception as e:
        LOGGER.error(f"AWS services health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

def get_system_metrics() -> Dict[str, Any]:
    """
    Get system-level metrics including CPU, memory, and disk usage.
    
    Returns:
        Dict containing system metrics
    """
    return {
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent,
        "uptime_seconds": int(time.time() - PROCESS_START_TIME)
    }

@router.get('/', status_code=status.HTTP_200_OK)
async def get_health() -> BaseResponse:
    """
    Basic health check endpoint that returns system status.
    
    Returns:
        BaseResponse with basic health status
    """
    system_metrics = get_system_metrics()
    
    return BaseResponse(
        success=True,
        message="System is healthy",
        status_code=status.HTTP_200_OK,
        metadata={
            "version": APP_SETTINGS['API_VERSION'],
            "environment": APP_SETTINGS.get('ENV', 'production'),
            "uptime": system_metrics['uptime_seconds'],
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@router.get('/ready', status_code=status.HTTP_200_OK)
async def get_readiness() -> BaseResponse:
    """
    Comprehensive readiness probe that checks all system dependencies.
    
    Returns:
        BaseResponse with detailed component health status
    """
    # Check all components
    db_status = check_database()
    redis_status = check_redis()
    aws_status = check_aws_services()
    system_metrics = get_system_metrics()
    
    # Determine overall health
    components_healthy = all(
        status['status'] == 'healthy' 
        for status in [db_status, redis_status, aws_status]
    )
    
    return BaseResponse(
        success=components_healthy,
        message="System readiness check completed",
        status_code=status.HTTP_200_OK if components_healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        metadata={
            "database": db_status,
            "redis": redis_status,
            "aws": aws_status,
            "system": system_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@router.get('/live', status_code=status.HTTP_200_OK)
async def get_liveness() -> BaseResponse:
    """
    Kubernetes liveness probe endpoint with basic process health check.
    
    Returns:
        BaseResponse with basic liveness status
    """
    system_metrics = get_system_metrics()
    
    # Check if system metrics are within acceptable ranges
    is_healthy = (
        system_metrics['cpu_percent'] < 95 and
        system_metrics['memory_percent'] < 95 and
        system_metrics['disk_percent'] < 95
    )
    
    return BaseResponse(
        success=is_healthy,
        message="Liveness check completed",
        status_code=status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        metadata={
            "system": system_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
    )