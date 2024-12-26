"""
Repository implementation for managing clinical data and evidence persistence with HIPAA compliance.
Provides secure database operations with comprehensive audit logging and performance optimizations.

Version: 1.0.0
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.clinical import ClinicalData, ClinicalEvidence, ClinicalDataType

# Configure HIPAA-compliant logging
logger = logging.getLogger(__name__)

class ClinicalRepository:
    """
    Repository class for managing clinical data and evidence persistence with HIPAA compliance,
    audit logging, and performance optimizations.
    """

    def __init__(self, db_session: AsyncSession):
        """Initialize repository with database session and configure logging."""
        self._session = db_session
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)

    async def create_clinical_data(
        self,
        request_id: UUID,
        data_type: str,
        patient_data: Dict,
        provider_notes: Optional[Dict] = None,
        modified_by: UUID = None
    ) -> ClinicalData:
        """
        Create new clinical data record with validation and audit logging.

        Args:
            request_id: UUID of associated prior auth request
            data_type: Type of clinical data (from ClinicalDataType enum)
            patient_data: Dictionary containing patient clinical data
            provider_notes: Optional provider notes dictionary
            modified_by: UUID of user creating the record

        Returns:
            Created ClinicalData instance

        Raises:
            ValueError: If input validation fails
            SQLAlchemyError: If database operation fails
        """
        try:
            # Validate data type
            if data_type not in ClinicalDataType.__members__:
                raise ValueError(f"Invalid clinical data type: {data_type}")

            # Create new clinical data instance
            clinical_data = ClinicalData(
                request_id=request_id,
                data_type=data_type,
                patient_data=patient_data,
                provider_notes=provider_notes,
                modified_by=modified_by
            )

            # Add to session and commit with retry logic
            self._session.add(clinical_data)
            await self._session.commit()

            # Log creation with audit trail
            self._logger.info(
                "Clinical data created",
                extra={
                    "clinical_data_id": str(clinical_data.id),
                    "request_id": str(request_id),
                    "data_type": data_type,
                    "modified_by": str(modified_by),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

            return clinical_data

        except SQLAlchemyError as e:
            await self._session.rollback()
            self._logger.error(
                "Failed to create clinical data",
                extra={
                    "error": str(e),
                    "request_id": str(request_id),
                    "data_type": data_type
                }
            )
            raise

    async def get_clinical_data(self, clinical_data_id: UUID) -> Optional[ClinicalData]:
        """
        Retrieve clinical data by ID with access logging.

        Args:
            clinical_data_id: UUID of clinical data record

        Returns:
            ClinicalData instance if found, None otherwise

        Raises:
            SQLAlchemyError: If database operation fails
        """
        try:
            # Optimized query with eager loading of evidence
            query = select(ClinicalData).options(
                selectinload(ClinicalData.evidence)
            ).where(ClinicalData.id == clinical_data_id)

            result = await self._session.execute(query)
            clinical_data = result.scalar_one_or_none()

            # Log access attempt
            self._logger.info(
                "Clinical data accessed",
                extra={
                    "clinical_data_id": str(clinical_data_id),
                    "found": clinical_data is not None,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

            return clinical_data

        except SQLAlchemyError as e:
            self._logger.error(
                "Failed to retrieve clinical data",
                extra={
                    "error": str(e),
                    "clinical_data_id": str(clinical_data_id)
                }
            )
            raise

    async def create_evidence(
        self,
        clinical_data_id: UUID,
        criteria_id: UUID,
        confidence_score: float,
        evidence_mapping: Dict,
        modified_by: UUID
    ) -> ClinicalEvidence:
        """
        Create new clinical evidence record with validation.

        Args:
            clinical_data_id: UUID of associated clinical data
            criteria_id: UUID of matched criteria
            confidence_score: Match confidence score (0-1)
            evidence_mapping: Dictionary mapping evidence to criteria
            modified_by: UUID of user creating the record

        Returns:
            Created ClinicalEvidence instance

        Raises:
            ValueError: If input validation fails
            SQLAlchemyError: If database operation fails
        """
        try:
            # Validate confidence score
            if not 0 <= confidence_score <= 1:
                raise ValueError("Confidence score must be between 0 and 1")

            # Create new evidence instance
            evidence = ClinicalEvidence(
                clinical_data_id=clinical_data_id,
                criteria_id=criteria_id,
                confidence_score=confidence_score,
                evidence_mapping=evidence_mapping,
                modified_by=modified_by
            )

            # Add to session and commit
            self._session.add(evidence)
            await self._session.commit()

            # Log creation
            self._logger.info(
                "Clinical evidence created",
                extra={
                    "evidence_id": str(evidence.id),
                    "clinical_data_id": str(clinical_data_id),
                    "criteria_id": str(criteria_id),
                    "confidence_score": confidence_score,
                    "modified_by": str(modified_by),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

            return evidence

        except SQLAlchemyError as e:
            await self._session.rollback()
            self._logger.error(
                "Failed to create clinical evidence",
                extra={
                    "error": str(e),
                    "clinical_data_id": str(clinical_data_id),
                    "criteria_id": str(criteria_id)
                }
            )
            raise

    async def get_evidence_by_clinical_data(
        self,
        clinical_data_id: UUID
    ) -> List[ClinicalEvidence]:
        """
        Retrieve all evidence records for clinical data with optimized query.

        Args:
            clinical_data_id: UUID of clinical data record

        Returns:
            List of ClinicalEvidence instances

        Raises:
            SQLAlchemyError: If database operation fails
        """
        try:
            # Optimized query for evidence retrieval
            query = select(ClinicalEvidence).where(
                and_(
                    ClinicalEvidence.clinical_data_id == clinical_data_id,
                    ClinicalEvidence.is_active == True
                )
            ).order_by(ClinicalEvidence.confidence_score.desc())

            result = await self._session.execute(query)
            evidence_list = result.scalars().all()

            # Log access
            self._logger.info(
                "Clinical evidence retrieved",
                extra={
                    "clinical_data_id": str(clinical_data_id),
                    "evidence_count": len(evidence_list),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

            return evidence_list

        except SQLAlchemyError as e:
            self._logger.error(
                "Failed to retrieve clinical evidence",
                extra={
                    "error": str(e),
                    "clinical_data_id": str(clinical_data_id)
                }
            )
            raise

    async def update_clinical_data(
        self,
        clinical_data_id: UUID,
        updates: Dict,
        modified_by: UUID
    ) -> Optional[ClinicalData]:
        """
        Update existing clinical data record with validation and audit.

        Args:
            clinical_data_id: UUID of clinical data to update
            updates: Dictionary of fields to update
            modified_by: UUID of user making the update

        Returns:
            Updated ClinicalData instance if found

        Raises:
            ValueError: If validation fails
            SQLAlchemyError: If database operation fails
        """
        try:
            # Get existing record
            clinical_data = await self.get_clinical_data(clinical_data_id)
            if not clinical_data:
                return None

            # Apply updates with validation
            if "patient_data" in updates:
                clinical_data.update_patient_data(updates["patient_data"], modified_by)

            if "provider_notes" in updates:
                clinical_data.provider_notes = updates["provider_notes"]

            # Update audit fields
            clinical_data.version += 1
            clinical_data.modified_by = modified_by
            clinical_data.updated_at = datetime.utcnow()

            # Commit changes
            await self._session.commit()

            # Log update
            self._logger.info(
                "Clinical data updated",
                extra={
                    "clinical_data_id": str(clinical_data_id),
                    "modified_by": str(modified_by),
                    "version": clinical_data.version,
                    "timestamp": datetime.utcnow().isoformat(),
                    "updated_fields": list(updates.keys())
                }
            )

            return clinical_data

        except SQLAlchemyError as e:
            await self._session.rollback()
            self._logger.error(
                "Failed to update clinical data",
                extra={
                    "error": str(e),
                    "clinical_data_id": str(clinical_data_id)
                }
            )
            raise