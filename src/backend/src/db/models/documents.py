"""
SQLAlchemy model definitions for HIPAA-compliant document management in the Prior Authorization Management System.
Implements secure storage, comprehensive audit trails, and access tracking for clinical documents.

Version: 1.0.0
"""

# Standard library imports - Python 3.11+
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

# SQLAlchemy imports - v2.0+
from sqlalchemy import (
    Column, String, DateTime, Integer, Boolean, ForeignKey, 
    Index, event, text
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property

# Internal imports
from db.base import Base
from db.models.prior_auth import PriorAuthRequest

class DocumentType(Enum):
    """Enumeration of supported clinical document types with retention policies."""
    LAB_RESULT = "LAB_RESULT"
    CLINICAL_NOTE = "CLINICAL_NOTE"
    PRESCRIPTION = "PRESCRIPTION"
    INSURANCE_CARD = "INSURANCE_CARD"
    MEDICAL_HISTORY = "MEDICAL_HISTORY"
    DIAGNOSTIC_IMAGE = "DIAGNOSTIC_IMAGE"
    TREATMENT_PLAN = "TREATMENT_PLAN"
    OTHER = "OTHER"

    def get_retention_period(self) -> int:
        """Return retention period in days based on document type."""
        retention_periods = {
            DocumentType.LAB_RESULT: 7 * 365,  # 7 years
            DocumentType.CLINICAL_NOTE: 7 * 365,
            DocumentType.PRESCRIPTION: 7 * 365,
            DocumentType.INSURANCE_CARD: 2 * 365,  # 2 years
            DocumentType.MEDICAL_HISTORY: 7 * 365,
            DocumentType.DIAGNOSTIC_IMAGE: 7 * 365,
            DocumentType.TREATMENT_PLAN: 7 * 365,
            DocumentType.OTHER: 7 * 365
        }
        return retention_periods.get(self, 7 * 365)  # Default 7 years

class Document(Base):
    """
    HIPAA-compliant document metadata model with comprehensive audit trails
    and secure storage integration.
    """
    __tablename__ = "documents"

    # Primary identifier
    id = Column(
        PGUUID(as_uuid=True), 
        primary_key=True, 
        default=uuid4,
        server_default=text("gen_random_uuid()")
    )

    # Document metadata
    filename = Column(String(255), nullable=False)
    s3_key = Column(String(512), nullable=False, unique=True)
    mime_type = Column(String(128), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    document_type = Column(
        String(32),
        nullable=False
    )

    # Relationships
    request_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("prior_auth_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    prior_auth = relationship(
        "PriorAuthRequest",
        back_populates="documents",
        lazy="select"
    )

    # Security and audit fields
    uploaded_by = Column(PGUUID(as_uuid=True), nullable=False)
    encryption_metadata = Column(JSONB, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    last_accessed_at = Column(DateTime, nullable=True)
    last_accessed_by = Column(PGUUID(as_uuid=True), nullable=True)
    retention_date = Column(DateTime, nullable=False)

    # HIPAA-compliant audit trail
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Optimized indexes
    __table_args__ = (
        Index(
            'ix_documents_request_type',
            'request_id',
            'document_type',
            postgresql_using='btree'
        ),
        Index(
            'ix_documents_retention',
            'retention_date',
            'is_deleted',
            postgresql_using='btree'
        ),
        {
            'postgresql_partition_by': 'RANGE (created_at)',
            'postgresql_with': {'fillfactor': 90}
        }
    )

    def __init__(
        self,
        filename: str,
        s3_key: str,
        mime_type: str,
        size_bytes: int,
        document_type: DocumentType,
        request_id: UUID,
        uploaded_by: UUID,
        encryption_metadata: dict
    ):
        """Initialize document record with security metadata."""
        self.filename = filename
        self.s3_key = s3_key
        self.mime_type = mime_type
        self.size_bytes = size_bytes
        self.document_type = document_type.value
        self.request_id = request_id
        self.uploaded_by = uploaded_by
        self.encryption_metadata = encryption_metadata
        self.retention_date = datetime.utcnow() + timedelta(
            days=document_type.get_retention_period()
        )

    @validates('mime_type', 'size_bytes')
    def validate_metadata(self, key: str, value: any) -> any:
        """Validate document metadata fields."""
        if key == 'mime_type':
            allowed_types = [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/dicom',
                'text/plain'
            ]
            if value not in allowed_types:
                raise ValueError(f"Unsupported MIME type: {value}")
        
        elif key == 'size_bytes':
            max_size = 100 * 1024 * 1024  # 100MB
            if value <= 0 or value > max_size:
                raise ValueError(f"Invalid file size: {value}")
        
        return value

    def update_last_accessed(self, accessed_by: UUID) -> None:
        """Update access audit trail with user information."""
        self.last_accessed_at = datetime.utcnow()
        self.last_accessed_by = accessed_by
        self.updated_at = datetime.utcnow()

    def soft_delete(self, deleted_by: UUID) -> bool:
        """Mark document as deleted while maintaining audit trail."""
        if self.is_deleted:
            return False
        
        self.is_deleted = True
        self.updated_at = datetime.utcnow()
        self.last_accessed_by = deleted_by
        self.last_accessed_at = datetime.utcnow()
        return True

    @hybrid_property
    def is_expired(self) -> bool:
        """Check if document has exceeded retention period."""
        return datetime.utcnow() > self.retention_date

# Event listeners for additional audit trail
@event.listens_for(Document, 'before_update')
def receive_before_update(mapper, connection, target):
    """Update audit timestamp before updates."""
    target.updated_at = datetime.utcnow()