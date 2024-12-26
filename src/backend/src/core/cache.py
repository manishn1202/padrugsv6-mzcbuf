"""
HIPAA-compliant Redis caching module implementing high-performance, fault-tolerant caching
with encryption, monitoring, and circuit breaker patterns.

Version: 1.0.0
"""

import json  # version: 3.11+
import pickle  # version: 3.11+
import time
from datetime import datetime, timedelta
from typing import Any, Optional, Dict
from functools import wraps

from redis import Redis  # version: 4.5.0+
from cryptography.fernet import Fernet  # version: 40.0.0+
from prometheus_client import Counter, Histogram  # version: 0.16.0+

from config.settings import APP_SETTINGS, CACHE_SETTINGS
from core.exceptions import IntegrationException
from core.logging import LOGGER

# Prometheus metrics
CACHE_HITS = Counter('cache_hits_total', 'Total cache hits', ['operation'])
CACHE_MISSES = Counter('cache_misses_total', 'Total cache misses', ['operation'])
CACHE_ERRORS = Counter('cache_errors_total', 'Total cache errors', ['operation'])
CACHE_LATENCY = Histogram('cache_operation_latency_seconds', 'Cache operation latency')

class CircuitBreaker:
    """Circuit breaker pattern implementation for fault tolerance."""
    
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of failures before opening circuit
            reset_timeout: Seconds before attempting reset
        """
        self._is_open = False
        self._failure_count = 0
        self._failure_threshold = failure_threshold
        self._reset_timeout = None

    def execute(self, operation: callable) -> Any:
        """
        Execute operation with circuit breaker protection.
        
        Args:
            operation: Function to execute
            
        Returns:
            Operation result
            
        Raises:
            IntegrationException: If circuit is open
        """
        if self._is_open:
            if self._reset_timeout and datetime.now() >= self._reset_timeout:
                self._is_open = False
                self._failure_count = 0
            else:
                raise IntegrationException("Circuit breaker is open")

        try:
            result = operation()
            self._failure_count = 0
            return result
        except Exception as e:
            self._failure_count += 1
            if self._failure_count >= self._failure_threshold:
                self._is_open = True
                self._reset_timeout = datetime.now() + timedelta(seconds=self._reset_timeout)
            raise e

class RedisCache:
    """HIPAA-compliant Redis cache implementation with encryption and monitoring."""

    def __init__(
        self,
        host: str = CACHE_SETTINGS['REDIS_HOST'],
        port: int = CACHE_SETTINGS['REDIS_PORT'],
        db: int = CACHE_SETTINGS['REDIS_DB'],
        pool_config: Dict = None
    ):
        """
        Initialize Redis cache with encryption and monitoring.
        
        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
            pool_config: Connection pool configuration
        """
        # Initialize Redis connection pool
        default_pool_config = {
            'max_connections': 50,
            'socket_timeout': 5,
            'socket_connect_timeout': 5,
            'retry_on_timeout': True
        }
        pool_config = {**default_pool_config, **(pool_config or {})}
        
        self._client = Redis(
            host=host,
            port=port,
            db=db,
            password=CACHE_SETTINGS.get('REDIS_PASSWORD'),
            ssl=True,
            **pool_config
        )

        # Initialize encryption
        self._cipher = Fernet(CACHE_SETTINGS['ENCRYPTION_KEY'].encode())
        
        # Set defaults
        self._prefix = CACHE_SETTINGS['KEY_PREFIX']
        self._default_ttl = CACHE_SETTINGS['DEFAULT_TIMEOUT']
        
        # Initialize circuit breaker
        self._circuit_breaker = CircuitBreaker()
        
        # Test connection and encryption
        self._test_connection()

    def _test_connection(self) -> None:
        """Test Redis connection and encryption."""
        try:
            test_key = f"{self._prefix}test"
            test_value = "connection_test"
            self.set(test_key, test_value, ttl=60)
            result = self.get(test_key)
            if result != test_value:
                raise IntegrationException("Cache encryption verification failed")
            self._client.delete(test_key)
        except Exception as e:
            LOGGER.error(f"Cache initialization failed: {str(e)}")
            raise IntegrationException(f"Failed to initialize cache: {str(e)}")

    def get(self, key: str) -> Optional[Any]:
        """
        Get and decrypt cached value.
        
        Args:
            key: Cache key
            
        Returns:
            Decrypted cached value or None
        """
        start_time = time.time()
        prefixed_key = f"{self._prefix}{key}"

        try:
            def get_operation():
                encrypted_value = self._client.get(prefixed_key)
                if encrypted_value is None:
                    CACHE_MISSES.labels(operation='get').inc()
                    return None
                
                decrypted_value = self._cipher.decrypt(encrypted_value)
                deserialized_value = pickle.loads(decrypted_value)
                
                CACHE_HITS.labels(operation='get').inc()
                return deserialized_value

            result = self._circuit_breaker.execute(get_operation)
            CACHE_LATENCY.observe(time.time() - start_time)
            return result

        except Exception as e:
            CACHE_ERRORS.labels(operation='get').inc()
            LOGGER.error(f"Cache get error for key {key}: {str(e)}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Encrypt and cache value.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds
            
        Returns:
            Success status
        """
        start_time = time.time()
        prefixed_key = f"{self._prefix}{key}"
        ttl = ttl or self._default_ttl

        try:
            def set_operation():
                serialized_value = pickle.dumps(value)
                encrypted_value = self._cipher.encrypt(serialized_value)
                return self._client.setex(
                    prefixed_key,
                    ttl,
                    encrypted_value
                )

            success = self._circuit_breaker.execute(set_operation)
            CACHE_LATENCY.observe(time.time() - start_time)
            return bool(success)

        except Exception as e:
            CACHE_ERRORS.labels(operation='set').inc()
            LOGGER.error(f"Cache set error for key {key}: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete cached value.
        
        Args:
            key: Cache key
            
        Returns:
            Success status
        """
        start_time = time.time()
        prefixed_key = f"{self._prefix}{key}"

        try:
            def delete_operation():
                return self._client.delete(prefixed_key)

            success = self._circuit_breaker.execute(delete_operation)
            CACHE_LATENCY.observe(time.time() - start_time)
            return bool(success)

        except Exception as e:
            CACHE_ERRORS.labels(operation='delete').inc()
            LOGGER.error(f"Cache delete error for key {key}: {str(e)}")
            return False

def create_cache_key(namespace: str, identifier: str, version: str = "v1") -> str:
    """
    Generate versioned cache key.
    
    Args:
        namespace: Key namespace
        identifier: Unique identifier
        version: Cache version
        
    Returns:
        Formatted cache key
    """
    if not namespace or not identifier:
        raise ValueError("Namespace and identifier are required")
        
    return f"{namespace}:{version}:{identifier}"

# Export public interface
__all__ = [
    'RedisCache',
    'create_cache_key'
]