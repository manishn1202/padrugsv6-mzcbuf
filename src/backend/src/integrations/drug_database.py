"""
First Databank API integration client for Prior Authorization Management System.
Implements HIPAA-compliant drug information lookup, formulary verification, and policy criteria retrieval
with enhanced caching, retry handling, and monitoring.

Version: 1.0.0
"""

import json
from datetime import datetime
from typing import Dict, Optional
from uuid import uuid4

import httpx  # version: 0.24.0
from tenacity import (  # version: 8.2.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from cachetools import TTLCache  # version: 5.3.0

from core.logging import LOGGER
from api.schemas.formulary import DrugBase

# API Configuration
API_BASE_URL = "https://api.fdb.com/v1/"
REQUEST_TIMEOUT = 30  # seconds
MAX_RETRIES = 3
CACHE_TTL = 3600  # 1 hour
MAX_CACHE_SIZE = 10000
RATE_LIMIT_PER_HOUR = 5000

class DrugDatabaseClient:
    """
    Enhanced client for interacting with First Databank API with caching, retry handling,
    and HIPAA compliance.
    """

    def __init__(
        self,
        api_key: str,
        cache_size: int = MAX_CACHE_SIZE,
        cache_ttl: int = CACHE_TTL
    ) -> None:
        """
        Initialize the First Databank API client with enhanced configuration.

        Args:
            api_key: First Databank API key
            cache_size: Maximum number of cached responses
            cache_ttl: Cache time-to-live in seconds
        """
        if not api_key:
            raise ValueError("API key is required")

        self._api_key = api_key
        self._cache = TTLCache(maxsize=cache_size, ttl=cache_ttl)
        
        # Configure HTTP client with connection pooling and timeouts
        self._client = httpx.AsyncClient(
            base_url=API_BASE_URL,
            timeout=REQUEST_TIMEOUT,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        )

        LOGGER.info("Initialized First Databank API client")

    async def get_drug_info(self, drug_code: str) -> Dict:
        """
        Retrieve detailed drug information by drug code with caching.

        Args:
            drug_code: National Drug Code (NDC)

        Returns:
            Dict containing validated drug information

        Raises:
            ValidationError: If drug code format is invalid
            DrugDatabaseError: If API request fails
        """
        # Validate drug code format
        if not drug_code or not isinstance(drug_code, str):
            raise ValueError("Invalid drug code format")

        # Check cache first
        cache_key = f"drug_info:{drug_code}"
        if cache_key in self._cache:
            LOGGER.info(f"Cache hit for drug info: {drug_code}")
            return self._cache[cache_key]

        try:
            # Make API request with retry handling
            response = await self._make_request(
                endpoint=f"drugs/{drug_code}",
                params={"include": "details,manufacturer"}
            )

            # Validate and transform response
            drug_info = {
                "drug_code": drug_code,
                "name": response["name"],
                "manufacturer": response["manufacturer"]["name"],
                "dosage_form": response["details"]["dosageForm"],
                "strength": response["details"]["strength"],
                "route": response["details"]["route"]
            }

            # Cache successful response
            self._cache[cache_key] = drug_info
            
            LOGGER.info(f"Retrieved drug info for: {drug_code}")
            return drug_info

        except Exception as e:
            LOGGER.error(f"Failed to retrieve drug info: {str(e)}")
            raise

    async def verify_formulary(self, drug_code: str, plan_id: str) -> Dict:
        """
        Verify drug coverage status in formulary with enhanced validation.

        Args:
            drug_code: National Drug Code (NDC)
            plan_id: Insurance plan identifier

        Returns:
            Dict containing validated formulary verification result

        Raises:
            ValidationError: If input parameters are invalid
            DrugDatabaseError: If API request fails
        """
        # Validate input parameters
        if not all([drug_code, plan_id]):
            raise ValueError("Drug code and plan ID are required")

        # Check cache first
        cache_key = f"formulary:{drug_code}:{plan_id}"
        if cache_key in self._cache:
            LOGGER.info(f"Cache hit for formulary verification: {drug_code}")
            return self._cache[cache_key]

        try:
            # Make API request with retry handling
            response = await self._make_request(
                endpoint="formulary/verify",
                params={
                    "drug_code": drug_code,
                    "plan_id": plan_id,
                    "include": "coverage,restrictions"
                }
            )

            # Validate and transform response
            formulary_status = {
                "covered": response["covered"],
                "tier": response.get("tier"),
                "requires_pa": response.get("requires_prior_auth", False),
                "quantity_limit": response.get("quantity_limit"),
                "step_therapy": response.get("step_therapy"),
                "restrictions": response.get("restrictions", [])
            }

            # Cache successful response
            self._cache[cache_key] = formulary_status
            
            LOGGER.info(f"Verified formulary status for drug: {drug_code}")
            return formulary_status

        except Exception as e:
            LOGGER.error(f"Failed to verify formulary: {str(e)}")
            raise

    async def get_policy_criteria(self, drug_code: str, plan_id: str) -> Dict:
        """
        Retrieve prior authorization policy criteria with validation.

        Args:
            drug_code: National Drug Code (NDC)
            plan_id: Insurance plan identifier

        Returns:
            Dict containing validated policy criteria

        Raises:
            ValidationError: If input parameters are invalid
            DrugDatabaseError: If API request fails
        """
        # Validate input parameters
        if not all([drug_code, plan_id]):
            raise ValueError("Drug code and plan ID are required")

        # Check cache first
        cache_key = f"policy:{drug_code}:{plan_id}"
        if cache_key in self._cache:
            LOGGER.info(f"Cache hit for policy criteria: {drug_code}")
            return self._cache[cache_key]

        try:
            # Make API request with retry handling
            response = await self._make_request(
                endpoint="policy/criteria",
                params={
                    "drug_code": drug_code,
                    "plan_id": plan_id,
                    "include": "requirements,alternatives"
                }
            )

            # Validate and transform response
            policy_criteria = {
                "requirements": response["requirements"],
                "clinical_criteria": response.get("clinical_criteria", []),
                "documentation": response.get("required_documentation", []),
                "alternatives": response.get("alternative_drugs", []),
                "validity_period": response.get("validity_period"),
                "updated_at": response.get("last_updated")
            }

            # Cache successful response
            self._cache[cache_key] = policy_criteria
            
            LOGGER.info(f"Retrieved policy criteria for drug: {drug_code}")
            return policy_criteria

        except Exception as e:
            LOGGER.error(f"Failed to retrieve policy criteria: {str(e)}")
            raise

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPError))
    )
    async def _make_request(self, endpoint: str, params: Dict) -> Dict:
        """
        Make HTTP request to First Databank API with enhanced error handling.

        Args:
            endpoint: API endpoint path
            params: Request parameters

        Returns:
            Dict containing API response data

        Raises:
            DrugDatabaseError: If API request fails
        """
        request_id = str(uuid4())
        
        try:
            # Add request tracing
            headers = {
                "X-Request-ID": request_id,
                "X-Correlation-ID": request_id
            }

            # Make API request
            response = await self._client.get(
                endpoint,
                params=params,
                headers=headers
            )
            response.raise_for_status()

            return response.json()

        except httpx.TimeoutException:
            LOGGER.error(f"Request timeout for endpoint: {endpoint}")
            raise
        except httpx.HTTPError as e:
            LOGGER.error(f"HTTP error {e.response.status_code} for endpoint: {endpoint}")
            raise
        except Exception as e:
            LOGGER.error(f"Unexpected error in API request: {str(e)}")
            raise

    async def close(self) -> None:
        """Close HTTP client connection pool."""
        await self._client.aclose()

    async def __aenter__(self) -> "DrugDatabaseClient":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()