"""
FastAPI dependency injection module implementing HIPAA-compliant dependencies for authentication,
database sessions, caching, and other core services with enhanced security and monitoring.

Version: 1.0.0
"""

import logging
from typing import AsyncGenerator, Callable, Dict, List, Optional
from contextlib import asynccontextmanager
from datetime import datetime

# Third-party imports with versions
from fastapi import Depends, HTTPException, Security, Request  # version: 0.100.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: 2.0.0
from circuitbreaker import circuit  # version: 1.4.0
from prometheus_client import Counter, Histogram  # version: 0.16.0

# Internal imports
from core.auth import AuthManager
from core.cache import RedisCache
from core.exceptions import AuthorizationException, BaseAppException
from core.logging import LOGGER
from db.base import SessionLocal
from config.settings import SECURITY_SETTINGS, APP_SETTINGS

# Initialize metrics
DEPENDENCY_ERRORS = Counter('dependency_errors_total', 'Total dependency errors', ['dependency'])
DEPENDENCY_LATENCY = Histogram('dependency_latency_seconds', 'Dependency execution latency', ['dependency'])

# Initialize global instances
auth_manager = AuthManager()
cache_instance: Optional[RedisCache] = None

def get_cache_instance() -> RedisCache:
    """
    Singleton pattern for Redis cache instance.
    
    Returns:
        RedisCache: Global cache instance
    """
    global cache_instance
    if cache_instance is None:
        cache_instance = RedisCache()
    return cache_instance

@asynccontextmanager
async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Enhanced database session dependency with connection pooling, monitoring and audit logging.
    
    Args:
        request: FastAPI request object for context
        
    Yields:
        AsyncSession: Database session with pooling
    """
    session_id = f"session_{datetime.utcnow().timestamp()}"
    start_time = datetime.utcnow()
    
    # Log session creation
    LOGGER.info(
        "Creating database session",
        extra={
            'session_id': session_id,
            'request_id': request.state.request_id,
            'user_id': getattr(request.state, 'user_id', None)
        }
    )
    
    try:
        async with SessionLocal() as session:
            # Add session context
            session.info['session_id'] = session_id
            session.info['request_id'] = request.state.request_id
            session.info['start_time'] = start_time
            
            yield session
            
            # Commit if no errors
            await session.commit()
            
    except Exception as e:
        # Log error and rollback
        LOGGER.error(
            f"Database session error: {str(e)}",
            extra={'session_id': session_id}
        )
        DEPENDENCY_ERRORS.labels(dependency='database').inc()
        await session.rollback()
        raise
        
    finally:
        # Log session metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        DEPENDENCY_LATENCY.labels(dependency='database').observe(duration)
        
        LOGGER.info(
            "Closing database session",
            extra={
                'session_id': session_id,
                'duration_seconds': duration
            }
        )

@circuit(failure_threshold=3, recovery_timeout=30)
def get_cache() -> RedisCache:
    """
    Enhanced Redis cache dependency with circuit breaker and monitoring.
    
    Returns:
        RedisCache: Redis cache instance
        
    Raises:
        HTTPException: If cache is unavailable
    """
    try:
        cache = get_cache_instance()
        # Verify cache connection
        cache._test_connection()
        return cache
        
    except Exception as e:
        DEPENDENCY_ERRORS.labels(dependency='cache').inc()
        LOGGER.error(f"Cache dependency error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Cache service unavailable"
        )

async def get_current_user_dependency(
    request: Request,
    token: str = Security(auth_manager.oauth2_scheme)
) -> Dict:
    """
    Enhanced current user dependency with MFA validation and audit logging.
    
    Args:
        request: FastAPI request object
        token: JWT access token
        
    Returns:
        dict: Current user information
        
    Raises:
        AuthorizationException: If authentication fails
    """
    start_time = datetime.utcnow()
    
    try:
        # Validate token and get user
        user = await auth_manager.validate_session(token)
        
        # Verify MFA if required
        if SECURITY_SETTINGS['MFA_REQUIRED']:
            mfa_token = request.headers.get('X-MFA-Token')
            if not mfa_token:
                raise AuthorizationException("MFA token required")
                
            await auth_manager.validate_mfa(user['user_id'], mfa_token)
        
        # Add user context to request
        request.state.user_id = user['user_id']
        request.state.user_role = user['role']
        
        # Log successful authentication
        LOGGER.info(
            "User authenticated",
            extra={
                'user_id': user['user_id'],
                'role': user['role'],
                'request_id': request.state.request_id
            }
        )
        
        return user
        
    except Exception as e:
        DEPENDENCY_ERRORS.labels(dependency='auth').inc()
        LOGGER.error(f"Authentication error: {str(e)}")
        raise
        
    finally:
        duration = (datetime.utcnow() - start_time).total_seconds()
        DEPENDENCY_LATENCY.labels(dependency='auth').observe(duration)

def check_permissions_dependency(required_permissions: List[str]) -> Callable:
    """
    Enhanced permission checking dependency with caching.
    
    Args:
        required_permissions: List of required permissions
        
    Returns:
        Callable: Permission checking function
    """
    async def check_permissions(
        request: Request,
        current_user: Dict = Depends(get_current_user_dependency)
    ) -> bool:
        cache = get_cache()
        cache_key = f"permissions:{current_user['user_id']}"
        
        try:
            # Check cached permissions
            if cached_perms := await cache.get(cache_key):
                user_permissions = cached_perms
            else:
                # Get permissions from auth manager
                user_permissions = await auth_manager.get_user_permissions(
                    current_user['user_id']
                )
                # Cache permissions
                await cache.set(cache_key, user_permissions, ttl=300)
            
            # Verify permissions
            has_permission = all(
                perm in user_permissions for perm in required_permissions
            )
            
            if not has_permission:
                raise AuthorizationException(
                    "Insufficient permissions",
                    details={
                        'required': required_permissions,
                        'user_permissions': user_permissions
                    }
                )
            
            return True
            
        except Exception as e:
            DEPENDENCY_ERRORS.labels(dependency='permissions').inc()
            LOGGER.error(f"Permission check error: {str(e)}")
            raise
            
    return check_permissions

# Export public interface
__all__ = [
    'get_db',
    'get_cache',
    'get_current_user_dependency',
    'check_permissions_dependency'
]