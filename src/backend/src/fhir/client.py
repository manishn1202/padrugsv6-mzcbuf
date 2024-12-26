"""
FHIR Client Implementation for Prior Authorization Management System
Provides secure, HIPAA-compliant interaction with FHIR R4 servers.

Version: 1.0.0
Author: Prior Authorization System Team
"""

import json
import asyncio
from typing import Dict, List, Optional, Union, Any
from datetime import datetime

# External imports
import httpx  # version: 0.24+
import backoff  # version: 2.2+
from tenacity import (  # version: 8.2+
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    CircuitBreaker
)
from cachetools import TTLCache  # version: 5.3+

# Internal imports
from .models import FHIRBaseModel
from .validators import FHIRValidator
from core.exceptions import IntegrationException
from core.logging import LOGGER, get_request_logger
from config.settings import APP_SETTINGS

# Constants
FHIR_TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
RETRY_BACKOFF_MULTIPLIER = 2
CACHE_TTL_SECONDS = 300
CIRCUIT_BREAKER_THRESHOLD = 5
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD_SECONDS = 60

class RateLimiter:
    """Rate limiter implementation for FHIR API requests"""
    
    def __init__(self, max_requests: int, period: int):
        self.max_requests = max_requests
        self.period = period
        self.requests = []
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        """Acquire rate limit permission"""
        async with self._lock:
            now = datetime.utcnow()
            # Remove expired timestamps
            self.requests = [ts for ts in self.requests 
                           if (now - ts).total_seconds() < self.period]
            
            if len(self.requests) >= self.max_requests:
                return False
                
            self.requests.append(now)
            return True

class FHIRClient:
    """
    Enhanced FHIR client for secure, HIPAA-compliant FHIR server interactions
    with comprehensive error handling and monitoring.
    """
    
    def __init__(
        self,
        base_url: str,
        auth_token: str,
        config: Optional[Dict] = None
    ):
        """
        Initialize FHIR client with enhanced security and monitoring.
        
        Args:
            base_url: FHIR server base URL
            auth_token: Authentication token
            config: Additional configuration options
        """
        self._validate_url(base_url)
        self._base_url = base_url.rstrip('/')
        self._auth_token = auth_token
        
        # Initialize configuration
        self._config = config or {}
        self._timeout = self._config.get('timeout', FHIR_TIMEOUT_SECONDS)
        
        # Setup secure HTTP client
        self._client = httpx.AsyncClient(
            timeout=self._timeout,
            verify=True,  # Enforce SSL verification
            follow_redirects=True
        )
        
        # Initialize validator
        self._validator = FHIRValidator(resource_type="Bundle")
        
        # Setup resource cache
        self._resource_cache = TTLCache(
            maxsize=1000,
            ttl=CACHE_TTL_SECONDS
        )
        
        # Initialize circuit breaker
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=CIRCUIT_BREAKER_THRESHOLD,
            recovery_timeout=60,
            name="fhir_client"
        )
        
        # Setup rate limiter
        self._rate_limiter = RateLimiter(
            max_requests=RATE_LIMIT_REQUESTS,
            period=RATE_LIMIT_PERIOD_SECONDS
        )
        
        # Get logger
        self._logger = LOGGER.getChild('fhir_client')

    def _validate_url(self, url: str) -> None:
        """Validate FHIR server URL format and security"""
        if not url.startswith('https://'):
            raise ValueError("FHIR server URL must use HTTPS")

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None
    ) -> Dict:
        """
        Make authenticated request to FHIR server with error handling.
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request payload
            params: Query parameters
            headers: Additional headers
            
        Returns:
            Dict containing FHIR response
        """
        # Check rate limit
        if not await self._rate_limiter.acquire():
            raise IntegrationException(
                message="FHIR API rate limit exceeded",
                status_code=429
            )
        
        # Prepare request
        url = f"{self._base_url}/{endpoint.lstrip('/')}"
        request_headers = {
            'Authorization': f'Bearer {self._auth_token}',
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json',
            **headers or {}
        }
        
        try:
            response = await self._client.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=request_headers
            )
            
            # Handle non-200 responses
            response.raise_for_status()
            
            return response.json()
            
        except httpx.HTTPStatusError as e:
            raise IntegrationException(
                message=f"FHIR server error: {str(e)}",
                status_code=e.response.status_code,
                details={'response': e.response.text}
            )
        except httpx.RequestError as e:
            raise IntegrationException(
                message=f"FHIR request failed: {str(e)}",
                status_code=503
            )

    @retry(
        retry=retry_if_exception_type(IntegrationException),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_BACKOFF_MULTIPLIER),
        before=lambda _: LOGGER.info("Retrying FHIR request...")
    )
    async def get_resource(
        self,
        resource_type: str,
        resource_id: str,
        force_refresh: bool = False
    ) -> FHIRBaseModel:
        """
        Retrieve FHIR resource with caching and error handling.
        
        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID
            force_refresh: Bypass cache if True
            
        Returns:
            Validated FHIR resource
        """
        cache_key = f"{resource_type}:{resource_id}"
        
        # Check cache unless force refresh
        if not force_refresh and cache_key in self._resource_cache:
            self._logger.info(f"Cache hit for {cache_key}")
            return self._resource_cache[cache_key]
        
        # Make request with circuit breaker
        response = await self._circuit_breaker(
            lambda: self._make_request(
                method='GET',
                endpoint=f"{resource_type}/{resource_id}"
            )
        )
        
        # Validate response
        valid, errors = self._validator.validate_resource(response)
        if not valid:
            raise IntegrationException(
                message="Invalid FHIR resource received",
                details={'validation_errors': errors}
            )
        
        # Create resource model
        resource = FHIRBaseModel.from_dict(response)
        
        # Cache valid response
        self._resource_cache[cache_key] = resource
        
        return resource

    async def create_resource(
        self,
        resource_type: str,
        data: Dict
    ) -> FHIRBaseModel:
        """
        Create new FHIR resource with validation.
        
        Args:
            resource_type: FHIR resource type
            data: Resource data
            
        Returns:
            Created FHIR resource
        """
        # Validate request payload
        valid, errors = self._validator.validate_resource(data)
        if not valid:
            raise IntegrationException(
                message="Invalid FHIR resource data",
                details={'validation_errors': errors}
            )
        
        # Make request
        response = await self._make_request(
            method='POST',
            endpoint=resource_type,
            data=data
        )
        
        return FHIRBaseModel.from_dict(response)

    async def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        data: Dict
    ) -> FHIRBaseModel:
        """
        Update existing FHIR resource.
        
        Args:
            resource_type: FHIR resource type
            resource_id: Resource ID
            data: Updated resource data
            
        Returns:
            Updated FHIR resource
        """
        # Validate request payload
        valid, errors = self._validator.validate_resource(data)
        if not valid:
            raise IntegrationException(
                message="Invalid FHIR resource data",
                details={'validation_errors': errors}
            )
        
        # Make request
        response = await self._make_request(
            method='PUT',
            endpoint=f"{resource_type}/{resource_id}",
            data=data
        )
        
        # Invalidate cache
        cache_key = f"{resource_type}:{resource_id}"
        self._resource_cache.pop(cache_key, None)
        
        return FHIRBaseModel.from_dict(response)

    async def search_resources(
        self,
        resource_type: str,
        search_params: Dict[str, Any]
    ) -> List[FHIRBaseModel]:
        """
        Search FHIR resources with parameters.
        
        Args:
            resource_type: FHIR resource type
            search_params: Search parameters
            
        Returns:
            List of matching FHIR resources
        """
        # Make request
        response = await self._make_request(
            method='GET',
            endpoint=resource_type,
            params=search_params
        )
        
        # Handle bundle response
        if response.get('resourceType') != 'Bundle':
            raise IntegrationException(
                message="Invalid search response format"
            )
        
        resources = []
        for entry in response.get('entry', []):
            resource = entry.get('resource')
            if resource:
                resources.append(FHIRBaseModel.from_dict(resource))
                
        return resources

    async def close(self):
        """Clean up resources"""
        await self._client.aclose()

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()