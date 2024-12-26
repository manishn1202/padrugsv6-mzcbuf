"""
Repository class for handling database operations related to drug formulary and coverage information.
Implements high-performance CRUD operations with caching for the Prior Authorization Management System.

Version: 1.0.0
"""

from typing import List, Optional, Tuple, Dict
from uuid import UUID
import time

# SQLAlchemy imports (version 2.0+)
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

# Internal imports
from db.models.formulary import Drug, FormularyEntry
from core.exceptions import ResourceNotFoundException
from core.cache import RedisCache, create_cache_key
from core.logging import LOGGER

class FormularyRepository:
    """
    Repository class for high-performance drug formulary database operations with caching support.
    Implements HIPAA-compliant data access patterns and optimized query execution.
    """

    def __init__(self, db_session: AsyncSession, cache_manager: RedisCache):
        """
        Initialize formulary repository with database session and cache manager.

        Args:
            db_session: Async database session
            cache_manager: Redis cache manager instance
        """
        self._session = db_session
        self._cache = cache_manager
        self._cache_namespace = "formulary"
        self._cache_ttl = 300  # 5 minutes cache TTL

    async def get_drug_by_id(self, drug_id: UUID) -> Drug:
        """
        Retrieve drug by UUID with caching.

        Args:
            drug_id: Drug UUID

        Returns:
            Drug model instance

        Raises:
            ResourceNotFoundException: If drug not found
        """
        # Check cache first
        cache_key = create_cache_key(self._cache_namespace, f"drug:{str(drug_id)}")
        cached_drug = self._cache.get(cache_key)
        
        if cached_drug:
            LOGGER.debug(f"Cache hit for drug_id: {drug_id}")
            return cached_drug

        # Build optimized query
        query = (
            select(Drug)
            .where(Drug.id == drug_id)
            .where(Drug.active == True)
        )

        try:
            result = await self._session.execute(query)
            drug = result.scalar_one_or_none()

            if not drug:
                raise ResourceNotFoundException("Drug", str(drug_id))

            # Cache the result
            self._cache.set(cache_key, drug, ttl=self._cache_ttl)
            return drug

        except Exception as e:
            LOGGER.error(f"Error retrieving drug {drug_id}: {str(e)}")
            raise

    async def search_drugs(
        self,
        search_term: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        filters: Optional[Dict] = None
    ) -> Tuple[List[Drug], int]:
        """
        Search drugs by multiple criteria with pagination.

        Args:
            search_term: Optional search term for drug name/code
            limit: Maximum number of results
            offset: Pagination offset
            filters: Optional filters dictionary

        Returns:
            Tuple of (drug list, total count)
        """
        # Build base query
        query = select(Drug).where(Drug.active == True)

        # Apply search term if provided
        if search_term:
            search_filter = or_(
                Drug.name.ilike(f"%{search_term}%"),
                Drug.ndc_code.ilike(f"%{search_term}%"),
                Drug.manufacturer.ilike(f"%{search_term}%")
            )
            query = query.where(search_filter)

        # Apply additional filters
        if filters:
            if filters.get("manufacturer"):
                query = query.where(Drug.manufacturer == filters["manufacturer"])
            if filters.get("dosage_form"):
                query = query.where(Drug.dosage_form == filters["dosage_form"])
            if filters.get("route"):
                query = query.where(Drug.route_of_administration == filters["route"])

        # Get total count for pagination
        count_query = select(Drug.id).where(query.whereclause)
        total_count = await self._session.scalar(count_query.with_only_columns([Drug.id]))

        # Apply pagination
        query = query.offset(offset).limit(limit)

        # Execute query
        try:
            result = await self._session.execute(query)
            drugs = result.scalars().all()
            return drugs, total_count

        except Exception as e:
            LOGGER.error(f"Error searching drugs: {str(e)}")
            raise

    async def get_formulary_entry(
        self,
        drug_id: UUID,
        include_inactive: bool = False
    ) -> Optional[FormularyEntry]:
        """
        Get formulary entry for a drug with caching.

        Args:
            drug_id: Drug UUID
            include_inactive: Whether to include inactive entries

        Returns:
            FormularyEntry if found, None otherwise
        """
        cache_key = create_cache_key(
            self._cache_namespace,
            f"formulary:{str(drug_id)}"
        )
        
        # Check cache
        cached_entry = self._cache.get(cache_key)
        if cached_entry:
            return cached_entry

        # Build query
        query = (
            select(FormularyEntry)
            .where(FormularyEntry.drug_id == drug_id)
        )

        if not include_inactive:
            query = query.where(FormularyEntry.end_date.is_(None))

        try:
            result = await self._session.execute(query)
            entry = result.scalar_one_or_none()

            if entry:
                self._cache.set(cache_key, entry, ttl=self._cache_ttl)

            return entry

        except Exception as e:
            LOGGER.error(f"Error retrieving formulary entry for drug {drug_id}: {str(e)}")
            raise

    async def create_formulary_entry(
        self,
        drug_id: UUID,
        tier: int,
        requires_pa: bool,
        created_by: UUID,
        pa_criteria: Optional[List[str]] = None,
        quantity_limit: bool = False,
        max_days_supply: Optional[int] = None,
        max_quantity: Optional[int] = None
    ) -> FormularyEntry:
        """
        Create new formulary entry with audit trail.

        Args:
            drug_id: Drug UUID
            tier: Formulary tier
            requires_pa: Whether PA is required
            created_by: User UUID creating entry
            pa_criteria: Optional PA criteria list
            quantity_limit: Whether quantity limits apply
            max_days_supply: Maximum days supply
            max_quantity: Maximum quantity

        Returns:
            Created FormularyEntry

        Raises:
            ResourceNotFoundException: If drug not found
        """
        # Verify drug exists
        await self.get_drug_by_id(drug_id)

        # Create entry
        entry = FormularyEntry(
            drug_id=drug_id,
            tier=tier,
            requires_pa=requires_pa,
            created_by=created_by
        )

        if pa_criteria:
            entry.pa_criteria = pa_criteria
        entry.quantity_limit = quantity_limit
        entry.max_days_supply = max_days_supply
        entry.max_quantity = max_quantity

        try:
            self._session.add(entry)
            await self._session.commit()
            await self._session.refresh(entry)

            # Invalidate cache
            cache_key = create_cache_key(
                self._cache_namespace,
                f"formulary:{str(drug_id)}"
            )
            self._cache.delete(cache_key)

            return entry

        except Exception as e:
            await self._session.rollback()
            LOGGER.error(f"Error creating formulary entry: {str(e)}")
            raise

    async def update_formulary_entry(
        self,
        entry_id: UUID,
        updated_by: UUID,
        **updates
    ) -> FormularyEntry:
        """
        Update existing formulary entry with audit trail.

        Args:
            entry_id: FormularyEntry UUID
            updated_by: User UUID making update
            **updates: Fields to update

        Returns:
            Updated FormularyEntry

        Raises:
            ResourceNotFoundException: If entry not found
        """
        # Get existing entry
        query = select(FormularyEntry).where(FormularyEntry.id == entry_id)
        result = await self._session.execute(query)
        entry = result.scalar_one_or_none()

        if not entry:
            raise ResourceNotFoundException("FormularyEntry", str(entry_id))

        # Update fields
        for field, value in updates.items():
            if hasattr(entry, field):
                setattr(entry, field, value)
        
        entry.updated_by = updated_by

        try:
            await self._session.commit()
            await self._session.refresh(entry)

            # Invalidate cache
            cache_key = create_cache_key(
                self._cache_namespace,
                f"formulary:{str(entry.drug_id)}"
            )
            self._cache.delete(cache_key)

            return entry

        except Exception as e:
            await self._session.rollback()
            LOGGER.error(f"Error updating formulary entry: {str(e)}")
            raise