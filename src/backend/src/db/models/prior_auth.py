"""
SQLAlchemy model definitions for prior authorization requests with HIPAA compliance
and performance optimizations for high-throughput processing.

Version: 1.0.0
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Enum, Boolean, Integer, event
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Index, text
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.declarative import declared_attr

from db.base import Base

# Status and decision enums for type safety
class PAStatus(PyEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class PADecision(PyEnum):
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    PENDING_INFO = "PENDING_INFO"

class PriorAuthRequest(Base):
    """
    Prior Authorization request model with HIPAA-compliant audit trail and 
    optimized performance characteristics for high-volume processing.
    """
    __tablename__ = "prior_auth_requests"

    # Primary identifier using PostgreSQL native UUID
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    
    # Core reference fields
    provider_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    drug_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Status tracking
    status = Column(
        Enum(PAStatus, name="pa_status_enum"),
        nullable=False,
        default=PAStatus.DRAFT,
        index=True
    )
    decision = Column(
        Enum(PADecision, name="pa_decision_enum"),
        nullable=True
    )
    denial_reason = Column(String(500), nullable=True)
    
    # Timestamps for workflow tracking
    submitted_at = Column(DateTime, nullable=True)
    decision_at = Column(DateTime, nullable=True)
    
    # HIPAA-compliant audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_modified_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_modified_by = Column(UUID(as_uuid=True), nullable=True)
    
    # Data protection and versioning
    contains_phi = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)

    # Relationships with lazy loading configuration
    clinical_data = relationship(
        "ClinicalData",
        back_populates="prior_auth",
        lazy="select",
        cascade="all, delete-orphan"
    )
    
    policy_matches = relationship(
        "PolicyMatch",
        back_populates="prior_auth",
        lazy="select",
        cascade="all, delete-orphan"
    )
    
    documents = relationship(
        "Document",
        back_populates="prior_auth",
        lazy="select",
        cascade="all, delete-orphan"
    )
    
    audit_logs = relationship(
        "AuditLog",
        back_populates="prior_auth",
        lazy="select",
        cascade="all, delete-orphan"
    )

    # Optimized indexes for common queries
    __table_args__ = (
        Index(
            'ix_prior_auth_requests_status_created',
            'status', 'created_at',
            postgresql_using='btree'
        ),
        Index(
            'ix_prior_auth_requests_provider_status',
            'provider_id', 'status',
            postgresql_using='btree'
        ),
        # Additional PostgreSQL-specific configurations
        {
            'postgresql_partition_by': 'RANGE (created_at)',
            'postgresql_with': {'fillfactor': 90}
        }
    )

    def __init__(
        self,
        provider_id: UUID,
        patient_id: UUID,
        drug_id: UUID,
        user_id: Optional[UUID] = None
    ):
        """Initialize prior authorization request with audit trail."""
        self.provider_id = provider_id
        self.patient_id = patient_id
        self.drug_id = drug_id
        self.status = PAStatus.DRAFT
        self.version = 1
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.last_modified_at = self.created_at
        self.last_modified_by = user_id
        self.contains_phi = True

    @validates('status', 'decision')
    def validate_status(self, key: str, value: PyEnum) -> PyEnum:
        """Validate status and decision enum values."""
        if key == 'status' and value not in PAStatus:
            raise ValueError(f"Invalid status: {value}")
        if key == 'decision' and value not in PADecision:
            raise ValueError(f"Invalid decision: {value}")
        return value

    def submit_request(self, user_id: UUID) -> bool:
        """
        Submit the PA request for review with audit trail.
        Returns success status.
        """
        if not all([self.provider_id, self.patient_id, self.drug_id]):
            return False
        
        self.status = PAStatus.SUBMITTED
        self.submitted_at = datetime.utcnow()
        self.version += 1
        self.last_modified_at = datetime.utcnow()
        self.last_modified_by = user_id
        
        # Create audit log entry
        self.audit_logs.append({
            'action': 'SUBMIT',
            'user_id': user_id,
            'timestamp': self.last_modified_at,
            'version': self.version
        })
        
        return True

    def update_decision(
        self,
        decision: str,
        denial_reason: Optional[str] = None,
        user_id: UUID
    ) -> None:
        """Update the PA request decision with audit trail."""
        self.decision = PADecision(decision)
        self.denial_reason = denial_reason
        self.status = PAStatus.COMPLETED
        self.decision_at = datetime.utcnow()
        self.version += 1
        self.last_modified_at = datetime.utcnow()
        self.last_modified_by = user_id
        
        # Create audit log entry
        self.audit_logs.append({
            'action': 'DECISION',
            'user_id': user_id,
            'timestamp': self.last_modified_at,
            'version': self.version,
            'details': {
                'decision': decision,
                'denial_reason': denial_reason
            }
        })

# SQLAlchemy event listeners for additional audit trail
@event.listens_for(PriorAuthRequest, 'before_update')
def receive_before_update(mapper, connection, target):
    """Update audit timestamps before updates."""
    target.updated_at = datetime.utcnow()