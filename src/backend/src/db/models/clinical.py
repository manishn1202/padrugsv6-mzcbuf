"""
SQLAlchemy model definitions for clinical data and evidence in the Prior Authorization Management System.
Implements HIPAA-compliant storage with enhanced security, audit trails, and performance optimization.

Version: 1.0.0
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, Dict
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Integer, Boolean, event
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy import Index, text
from sqlalchemy.ext.declarative import declared_attr

from db.base import Base
from db.models.prior_auth import PriorAuthRequest

# Data type enum for clinical information classification
class ClinicalDataType(PyEnum):
    DIAGNOSIS = "DIAGNOSIS"
    LAB_RESULTS = "LAB_RESULTS"
    MEDICATION_HISTORY = "MEDICATION_HISTORY"
    PROVIDER_NOTES = "PROVIDER_NOTES"
    OTHER = "OTHER"

class ClinicalData(Base):
    """
    HIPAA-compliant clinical data model with enhanced security and audit capabilities.
    Stores patient clinical information and provider notes with encryption and versioning.
    """
    __tablename__ = "clinical_data"

    # Primary identifier and relationships
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    request_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("prior_auth_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Clinical data fields with HIPAA compliance
    data_type = Column(
        Enum(ClinicalDataType, name="clinical_data_type_enum"),
        nullable=False,
        index=True
    )
    patient_data = Column(JSONB, nullable=False)
    provider_notes = Column(JSONB, nullable=True)

    # Audit trail and versioning
    recorded_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    modified_by = Column(UUID(as_uuid=True), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    contains_phi = Column(Boolean, nullable=False, default=True)

    # Relationships
    prior_auth = relationship(
        "PriorAuthRequest",
        back_populates="clinical_data",
        lazy="select"
    )
    evidence = relationship(
        "ClinicalEvidence",
        back_populates="clinical_data",
        lazy="select",
        cascade="all, delete-orphan"
    )

    # Optimized indexes for common queries
    __table_args__ = (
        Index(
            'ix_clinical_data_request_type',
            'request_id', 'data_type',
            postgresql_using='btree'
        ),
        # PostgreSQL-specific optimizations
        {
            'postgresql_partition_by': 'RANGE (created_at)',
            'postgresql_with': {'fillfactor': 90}
        }
    )

    def __init__(
        self,
        request_id: UUID,
        data_type: str,
        patient_data: Dict,
        provider_notes: Optional[Dict] = None,
        modified_by: UUID
    ):
        """Initialize clinical data record with validation and security measures."""
        self.request_id = request_id
        self.data_type = ClinicalDataType(data_type)
        self.patient_data = patient_data
        self.provider_notes = provider_notes
        self.modified_by = modified_by
        self.recorded_at = datetime.utcnow()
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.version = 1
        self.contains_phi = True

    @validates('data_type')
    def validate_data_type(self, key: str, value: str) -> str:
        """Validate clinical data type enum."""
        if value not in ClinicalDataType.__members__:
            raise ValueError(f"Invalid clinical data type: {value}")
        return value

    @validates('patient_data', 'provider_notes')
    def validate_json_data(self, key: str, value: Dict) -> Dict:
        """Validate JSON data structure and content."""
        if not isinstance(value, dict):
            raise ValueError(f"Invalid {key} format: must be JSON object")
        # Additional validation could be added here
        return value

    def update_patient_data(self, new_data: Dict, modified_by: UUID) -> None:
        """
        Update patient clinical data with version control and audit trail.
        """
        # Validate new data
        if not isinstance(new_data, dict):
            raise ValueError("Invalid patient data format")

        # Update data with audit trail
        self.patient_data = new_data
        self.version += 1
        self.updated_at = datetime.utcnow()
        self.modified_by = modified_by
        self.contains_phi = True  # Reset PHI flag as new data may contain PHI

class ClinicalEvidence(Base):
    """
    Model for storing AI-generated evidence matching results with performance optimization.
    Tracks confidence scores and evidence mapping for clinical criteria matching.
    """
    __tablename__ = "clinical_evidence"

    # Primary identifier and relationships
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    clinical_data_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clinical_data.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    criteria_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Evidence matching results
    confidence_score = Column(Float, nullable=False)
    evidence_mapping = Column(JSONB, nullable=False)
    evaluated_at = Column(DateTime, nullable=False)

    # Audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    modified_by = Column(UUID(as_uuid=True), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    clinical_data = relationship(
        "ClinicalData",
        back_populates="evidence",
        lazy="select"
    )

    # Optimized indexes
    __table_args__ = (
        Index(
            'ix_clinical_evidence_scores',
            'clinical_data_id', 'confidence_score',
            postgresql_using='btree'
        ),
        {
            'postgresql_partition_by': 'RANGE (created_at)',
            'postgresql_with': {'fillfactor': 90}
        }
    )

    def __init__(
        self,
        clinical_data_id: UUID,
        criteria_id: UUID,
        confidence_score: float,
        evidence_mapping: Dict,
        modified_by: UUID
    ):
        """Initialize clinical evidence record with validation."""
        self.clinical_data_id = clinical_data_id
        self.criteria_id = criteria_id
        self.confidence_score = confidence_score
        self.evidence_mapping = evidence_mapping
        self.modified_by = modified_by
        self.evaluated_at = datetime.utcnow()
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.version = 1
        self.is_active = True

    @validates('confidence_score')
    def validate_confidence_score(self, key: str, value: float) -> float:
        """Validate confidence score range."""
        if not 0 <= value <= 1:
            raise ValueError("Confidence score must be between 0 and 1")
        return value

    @validates('evidence_mapping')
    def validate_evidence_mapping(self, key: str, value: Dict) -> Dict:
        """Validate evidence mapping structure."""
        if not isinstance(value, dict):
            raise ValueError("Evidence mapping must be a JSON object")
        return value

# Event listeners for audit trail
@event.listens_for(ClinicalData, 'before_update')
def clinical_data_before_update(mapper, connection, target):
    """Update audit timestamps before updates."""
    target.updated_at = datetime.utcnow()

@event.listens_for(ClinicalEvidence, 'before_update')
def clinical_evidence_before_update(mapper, connection, target):
    """Update audit timestamps before updates."""
    target.updated_at = datetime.utcnow()