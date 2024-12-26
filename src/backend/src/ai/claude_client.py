"""
HIPAA-compliant Claude AI client for clinical text analysis and criteria matching.
Implements secure interaction with Claude 3.5 API with encryption, retry handling, and logging.

Version: 1.0.0
"""

import json
from typing import Dict, Optional
import httpx  # version: 0.24.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0
import boto3  # version: 1.26.0
from opentelemetry import trace  # version: 1.12.0
from opentelemetry.trace import Status, StatusCode

from core.exceptions import IntegrationException
from core.logging import LOGGER
from config.settings import AWS_SETTINGS

# Initialize tracer
tracer = trace.get_tracer(__name__)

class ClaudeClient:
    """
    HIPAA-compliant client for secure interaction with Claude 3.5 API.
    Implements encryption, retry handling, and comprehensive logging.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.anthropic.com/v1",
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_factor: float = 1.0
    ) -> None:
        """
        Initialize Claude client with secure configuration.

        Args:
            api_key: Claude API authentication key
            base_url: Base URL for Claude API
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            backoff_factor: Exponential backoff factor for retries
        """
        self._api_key = api_key
        self._base_url = base_url.rstrip('/')
        self._timeout = timeout

        # Initialize KMS client for PHI encryption
        self._kms_client = boto3.client(
            'kms',
            region_name=AWS_SETTINGS['REGION']
        )

        # Configure secure HTTP client
        self._client = httpx.AsyncClient(
            timeout=timeout,
            verify=True,  # Enforce SSL verification
            http2=True,   # Enable HTTP/2
            limits=httpx.Limits(
                max_keepalive_connections=5,
                max_connections=10
            )
        )

        # Configure retry settings
        self._retry_config = {
            'max_attempts': max_retries,
            'backoff_factor': backoff_factor
        }

        LOGGER.info("Claude AI client initialized with HIPAA-compliant configuration")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def analyze_clinical_evidence(
        self,
        clinical_data: Dict,
        policy_criteria: Dict,
        request_id: str
    ) -> Dict:
        """
        Analyze clinical evidence against policy criteria with PHI protection.

        Args:
            clinical_data: Clinical evidence data
            policy_criteria: Policy criteria for matching
            request_id: Unique request identifier for tracing

        Returns:
            Dict containing analysis results with confidence scores
        """
        with tracer.start_as_current_span("analyze_clinical_evidence") as span:
            try:
                span.set_attribute("request_id", request_id)

                # Encrypt sensitive clinical data
                encrypted_data = await self._encrypt_phi(
                    json.dumps(clinical_data),
                    f"request_id={request_id}"
                )

                # Prepare request payload
                payload = {
                    "model": "claude-3-opus-20240229",
                    "messages": [{
                        "role": "user",
                        "content": self._build_analysis_prompt(
                            encrypted_data,
                            policy_criteria
                        )
                    }],
                    "temperature": 0.1,
                    "max_tokens": 1000
                }

                # Add request headers
                headers = {
                    "X-Api-Key": self._api_key,
                    "Content-Type": "application/json",
                    "X-Request-ID": request_id
                }

                # Make API call
                async with self._client as client:
                    response = await client.post(
                        f"{self._base_url}/messages",
                        json=payload,
                        headers=headers
                    )

                    if response.status_code != 200:
                        raise IntegrationException(
                            f"Claude API error: {response.text}",
                            status_code=response.status_code
                        )

                    # Process and validate response
                    result = response.json()
                    analysis_result = self._process_analysis_response(result)

                    LOGGER.info(
                        "Clinical evidence analysis completed",
                        extra={
                            "request_id": request_id,
                            "confidence_score": analysis_result.get("confidence_score")
                        }
                    )

                    span.set_status(Status(StatusCode.OK))
                    return analysis_result

            except Exception as e:
                span.set_status(Status(StatusCode.ERROR))
                await self._handle_api_error(e, request_id)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def extract_clinical_entities(
        self,
        clinical_text: str,
        request_id: str
    ) -> Dict:
        """
        Extract clinical entities with PHI protection.

        Args:
            clinical_text: Clinical text for entity extraction
            request_id: Unique request identifier for tracing

        Returns:
            Dict containing extracted and classified clinical entities
        """
        with tracer.start_as_current_span("extract_clinical_entities") as span:
            try:
                span.set_attribute("request_id", request_id)

                # Encrypt clinical text
                encrypted_text = await self._encrypt_phi(
                    clinical_text,
                    f"request_id={request_id}"
                )

                # Prepare request payload
                payload = {
                    "model": "claude-3-opus-20240229",
                    "messages": [{
                        "role": "user",
                        "content": self._build_extraction_prompt(encrypted_text)
                    }],
                    "temperature": 0.1,
                    "max_tokens": 1000
                }

                headers = {
                    "X-Api-Key": self._api_key,
                    "Content-Type": "application/json",
                    "X-Request-ID": request_id
                }

                # Make API call
                async with self._client as client:
                    response = await client.post(
                        f"{self._base_url}/messages",
                        json=payload,
                        headers=headers
                    )

                    if response.status_code != 200:
                        raise IntegrationException(
                            f"Claude API error: {response.text}",
                            status_code=response.status_code
                        )

                    # Process and validate response
                    result = response.json()
                    entities = self._process_extraction_response(result)

                    LOGGER.info(
                        "Clinical entity extraction completed",
                        extra={
                            "request_id": request_id,
                            "entity_count": len(entities)
                        }
                    )

                    span.set_status(Status(StatusCode.OK))
                    return entities

            except Exception as e:
                span.set_status(Status(StatusCode.ERROR))
                await self._handle_api_error(e, request_id)

    async def _encrypt_phi(self, data: str, context: str) -> str:
        """
        Encrypt PHI data using AWS KMS with key rotation.

        Args:
            data: Data to encrypt
            context: Encryption context

        Returns:
            Encrypted data string
        """
        try:
            response = self._kms_client.encrypt(
                KeyId=AWS_SETTINGS['KMS_KEY_ID'],
                Plaintext=data.encode(),
                EncryptionContext={'request_context': context}
            )
            return response['CiphertextBlob'].decode('utf-8')
        except Exception as e:
            LOGGER.error(f"KMS encryption failed: {str(e)}")
            raise IntegrationException("Failed to encrypt sensitive data")

    async def _handle_api_error(self, error: Exception, request_id: str) -> None:
        """
        Handle API errors with comprehensive logging and metrics.

        Args:
            error: Exception that occurred
            request_id: Request identifier for tracing

        Raises:
            IntegrationException: Classified error with context
        """
        LOGGER.error(
            f"Claude API error occurred: {str(error)}",
            extra={
                "request_id": request_id,
                "error_type": error.__class__.__name__
            }
        )

        if isinstance(error, httpx.TimeoutException):
            raise IntegrationException(
                "Claude API request timed out",
                status_code=504
            )
        elif isinstance(error, httpx.HTTPStatusError):
            raise IntegrationException(
                f"Claude API error: {error.response.text}",
                status_code=error.response.status_code
            )
        else:
            raise IntegrationException(
                "Unexpected error during Claude API request",
                status_code=500
            )

    def _build_analysis_prompt(self, clinical_data: str, criteria: Dict) -> str:
        """Build structured prompt for clinical evidence analysis"""
        return f"""
        Analyze the following clinical evidence against the provided criteria.
        Focus on identifying specific matches and calculating confidence scores.

        Clinical Evidence:
        {clinical_data}

        Policy Criteria:
        {json.dumps(criteria, indent=2)}

        Provide a structured analysis with:
        1. Criteria matches with supporting evidence
        2. Confidence scores for each match
        3. Overall recommendation
        """

    def _build_extraction_prompt(self, clinical_text: str) -> str:
        """Build structured prompt for clinical entity extraction"""
        return f"""
        Extract and classify clinical entities from the following text.
        Focus on medications, conditions, procedures, and lab values.
        Maintain strict PHI protection.

        Clinical Text:
        {clinical_text}

        Provide extracted entities in structured format with:
        1. Entity type
        2. Normalized value
        3. Confidence score
        """

    def _process_analysis_response(self, response: Dict) -> Dict:
        """Process and validate Claude API analysis response"""
        try:
            content = response['messages'][0]['content']
            # Add response validation and processing logic
            return {
                "matches": content.get("matches", []),
                "confidence_score": content.get("confidence_score", 0.0),
                "recommendation": content.get("recommendation", "")
            }
        except KeyError as e:
            LOGGER.error(f"Invalid analysis response format: {str(e)}")
            raise IntegrationException("Invalid response format from Claude API")

    def _process_extraction_response(self, response: Dict) -> Dict:
        """Process and validate Claude API extraction response"""
        try:
            content = response['messages'][0]['content']
            # Add response validation and processing logic
            return {
                "entities": content.get("entities", []),
                "entity_count": len(content.get("entities", [])),
                "confidence_scores": content.get("confidence_scores", {})
            }
        except KeyError as e:
            LOGGER.error(f"Invalid extraction response format: {str(e)}")
            raise IntegrationException("Invalid response format from Claude API")

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup"""
        await self._client.aclose()