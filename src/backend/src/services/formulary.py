"""
Service layer for managing drug formulary operations in the Prior Authorization Management System.
Implements HIPAA-compliant formulary verification, drug information management, and caching.

Version: 1.0.0
"""

import asyncio
from datetime import datetime
from typing import Dict, Optional, List
from uuid import UUID

from tenacity import (  # version: 8.2.2
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from db.repositories.formulary import FormularyRepository
from integrations.drug_database import DrugDatabaseClient
from core.cache import CacheManager, create_cache_key
from core.exceptions import ResourceNotFoundException, ValidationException
from core.logging import LOGGER
from api.schemas.formulary import DrugBase, FormularyEntryCreate

class FormularyService:
    """
    Service class for managing drug formulary operations with caching and monitoring.
    Implements HIPAA-compliant drug information retrieval and formulary verification.
    """

    def __init__(
        self,
        repository: FormularyRepository,
        drug_db_client: DrugDatabaseClient,
        cache_manager: CacheManager
    ) -> None:
        """
        Initialize formulary service with dependencies.

        Args:
            repository: Database repository for formulary operations
            drug_db_client: First Databank API client
            cache_manager: Cache manager for response caching
        """
        self._repository = repository
        self._drug_db_client = drug_db_client
        self._cache_manager = cache_manager
        self._cache_namespace = "formulary"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def get_drug_info(
        self,
        drug_code: str,
        correlation_id: Optional[str] = None
    ) -> Dict:
        """
        Get comprehensive drug information with caching.

        Args:
            drug_code: National Drug Code (NDC)
            correlation_id: Optional request correlation ID

        Returns:
            Dict containing drug and formulary information

        Raises:
            ValidationException: If drug code is invalid
            ResourceNotFoundException: If drug not found
        """
        LOGGER.info(f"Retrieving drug info for code: {drug_code}", extra={"correlation_id": correlation_id})

        # Check cache first
        cache_key = create_cache_key(self._cache_namespace, f"drug:{drug_code}")
        cached_info = await self._cache_manager.get(cache_key)
        if cached_info:
            LOGGER.debug(f"Cache hit for drug code: {drug_code}")
            return cached_info

        try:
            # Get drug info from database
            drug = await self._repository.get_drug_by_code(drug_code)
            
            if not drug:
                # Fetch from First Databank if not in database
                drug_info = await self._drug_db_client.get_drug_info(drug_code)
                
                # Create drug record
                drug = await self._repository.create_drug(
                    DrugBase(**drug_info),
                    created_by=UUID("00000000-0000-0000-0000-000000000000")  # System user
                )

            # Get formulary entry
            formulary_entry = await self._repository.get_formulary_entry(drug.id)

            # Combine information
            response = {
                "drug": {
                    "id": str(drug.id),
                    "drug_code": drug.ndc_code,
                    "name": drug.name,
                    "manufacturer": drug.manufacturer,
                    "dosage_form": drug.dosage_form,
                    "strength": drug.strength,
                    "active": drug.active
                },
                "formulary_entry": formulary_entry.dict() if formulary_entry else None
            }

            # Cache the response
            await self._cache_manager.set(cache_key, response, ttl=3600)
            
            LOGGER.info(f"Successfully retrieved drug info for: {drug_code}")
            return response

        except Exception as e:
            LOGGER.error(f"Error retrieving drug info: {str(e)}", extra={
                "drug_code": drug_code,
                "correlation_id": correlation_id
            })
            raise

    async def verify_coverage(
        self,
        drug_code: str,
        plan_id: str,
        correlation_id: Optional[str] = None
    ) -> Dict:
        """
        Verify drug coverage status in formulary.

        Args:
            drug_code: National Drug Code (NDC)
            plan_id: Insurance plan identifier
            correlation_id: Optional request correlation ID

        Returns:
            Dict containing coverage verification result
        """
        LOGGER.info(f"Verifying coverage for drug: {drug_code}", extra={"correlation_id": correlation_id})

        cache_key = create_cache_key(self._cache_namespace, f"coverage:{drug_code}:{plan_id}")
        cached_result = await self._cache_manager.get(cache_key)
        if cached_result:
            return cached_result

        try:
            # Verify coverage with First Databank
            coverage = await self._drug_db_client.verify_formulary(drug_code, plan_id)

            # Get policy criteria if PA required
            if coverage.get("requires_pa"):
                criteria = await self._drug_db_client.get_policy_criteria(drug_code, plan_id)
                coverage["pa_criteria"] = criteria.get("requirements", [])

            # Cache the result
            await self._cache_manager.set(cache_key, coverage, ttl=1800)  # 30 minutes
            
            LOGGER.info(f"Successfully verified coverage for drug: {drug_code}")
            return coverage

        except Exception as e:
            LOGGER.error(f"Error verifying coverage: {str(e)}", extra={
                "drug_code": drug_code,
                "plan_id": plan_id,
                "correlation_id": correlation_id
            })
            raise

    async def create_formulary_entry(
        self,
        entry: FormularyEntryCreate,
        created_by: UUID,
        correlation_id: Optional[str] = None
    ) -> Dict:
        """
        Create new formulary entry with audit trail.

        Args:
            entry: Formulary entry creation data
            created_by: User ID creating the entry
            correlation_id: Optional request correlation ID

        Returns:
            Created formulary entry
        """
        LOGGER.info("Creating formulary entry", extra={"correlation_id": correlation_id})

        try:
            # Create entry
            formulary_entry = await self._repository.create_formulary_entry(
                drug_id=entry.drug_id,
                tier=entry.tier,
                requires_pa=entry.requires_pa,
                created_by=created_by,
                pa_criteria=entry.pa_criteria,
                quantity_limit=entry.quantity_limit,
                max_days_supply=entry.max_days_supply,
                max_quantity=entry.max_quantity
            )

            # Invalidate related caches
            cache_keys = [
                create_cache_key(self._cache_namespace, f"drug:{str(entry.drug_id)}"),
                create_cache_key(self._cache_namespace, f"formulary:{str(entry.drug_id)}")
            ]
            await asyncio.gather(*[
                self._cache_manager.invalidate(key) for key in cache_keys
            ])

            LOGGER.info(f"Created formulary entry for drug: {entry.drug_id}")
            return formulary_entry.dict()

        except Exception as e:
            LOGGER.error(f"Error creating formulary entry: {str(e)}", extra={
                "drug_id": str(entry.drug_id),
                "correlation_id": correlation_id
            })
            raise

    async def update_coverage(
        self,
        entry_id: UUID,
        updates: Dict,
        updated_by: UUID,
        correlation_id: Optional[str] = None
    ) -> Dict:
        """
        Update existing formulary entry with audit trail.

        Args:
            entry_id: Formulary entry ID
            updates: Fields to update
            updated_by: User ID making the update
            correlation_id: Optional request correlation ID

        Returns:
            Updated formulary entry
        """
        LOGGER.info(f"Updating formulary entry: {entry_id}", extra={"correlation_id": correlation_id})

        try:
            # Update entry
            updated_entry = await self._repository.update_formulary_entry(
                entry_id=entry_id,
                updated_by=updated_by,
                **updates
            )

            # Invalidate related caches
            cache_keys = [
                create_cache_key(self._cache_namespace, f"drug:{str(updated_entry.drug_id)}"),
                create_cache_key(self._cache_namespace, f"formulary:{str(updated_entry.drug_id)}")
            ]
            await asyncio.gather(*[
                self._cache_manager.invalidate(key) for key in cache_keys
            ])

            LOGGER.info(f"Updated formulary entry: {entry_id}")
            return updated_entry.dict()

        except Exception as e:
            LOGGER.error(f"Error updating formulary entry: {str(e)}", extra={
                "entry_id": str(entry_id),
                "correlation_id": correlation_id
            })
            raise

    async def sync_drug_data(
        self,
        drug_codes: List[str],
        correlation_id: Optional[str] = None
    ) -> Dict:
        """
        Synchronize drug data with First Databank.

        Args:
            drug_codes: List of NDC codes to sync
            correlation_id: Optional request correlation ID

        Returns:
            Dict containing sync results
        """
        LOGGER.info(f"Starting drug data sync for {len(drug_codes)} drugs", 
                   extra={"correlation_id": correlation_id})

        results = {
            "total": len(drug_codes),
            "updated": 0,
            "failed": 0,
            "errors": []
        }

        for drug_code in drug_codes:
            try:
                await self.get_drug_info(drug_code, correlation_id)
                results["updated"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "drug_code": drug_code,
                    "error": str(e)
                })

        LOGGER.info(f"Completed drug data sync. Updated: {results['updated']}, Failed: {results['failed']}")
        return results