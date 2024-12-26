"""
SQLAlchemy models for drug policy and prior authorization criteria management.
Implements HIPAA-compliant storage with comprehensive versioning, audit trails,
and AI-assisted matching support.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import Dict, List, Optional

# SQLAlchemy 2.0+ imports
from sqlalchemy import Column, String, Boolean, DateTime, Float, JSON, ForeignKey  # version: 2.0.0
from sqlalchemy.dialects.postgresql import UUID  # version: 2.0.0
from sqlalchemy.orm import relationship  # version: 2.0.0
import uuid

# Internal imports
from db.base import Base

class DrugPolicy(Base):
    """
    SQLAlchemy model for versioned drug policies with comprehensive audit trail support.
    Implements HIPAA-compliant storage of drug policy definitions and criteria.
    """
    __tablename__ = 'drug_policies'

    # Primary key and identifiers
    policy_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_code = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    version = Column(String(20), nullable=False)
    
    # Status and temporal tracking
    active = Column(Boolean, nullable=False, default=True)
    effective_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime)
    
    # Audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    updated_by = Column(UUID(as_uuid=True), nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False)

    # Relationships
    criteria = relationship("PolicyCriterion", back_populates="policy", cascade="all, delete-orphan")
    match_results = relationship("PolicyMatchResult", back_populates="policy")

    def __init__(self, drug_code: str, name: str, version: str, 
                 effective_date: datetime, created_by: uuid.UUID):
        """Initialize drug policy with versioning and audit support."""
        self.drug_code = drug_code
        self.name = name
        self.version = version
        self.effective_date = effective_date
        self.created_by = created_by
        self.updated_by = created_by
        self.active = True
        self.is_deleted = False

    def __repr__(self):
        return f"<DrugPolicy(drug_code='{self.drug_code}', version='{self.version}')>"


class PolicyCriterion(Base):
    """
    SQLAlchemy model for weighted policy criteria with validation rules.
    Supports AI-assisted matching through weighted scoring and evidence mapping.
    """
    __tablename__ = 'policy_criteria'

    # Primary key and relationships
    criterion_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey('drug_policies.policy_id'), nullable=False)
    
    # Criterion definition
    description = Column(String(1000), nullable=False)
    weight = Column(Float, nullable=False, default=1.0)
    required = Column(Boolean, nullable=False, default=True)
    validation_rules = Column(JSON, nullable=False)
    
    # Audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    updated_by = Column(UUID(as_uuid=True), nullable=False)

    # Relationships
    policy = relationship("DrugPolicy", back_populates="criteria")
    match_evidence = relationship("PolicyMatchResult", secondary="criterion_evidence")

    def __init__(self, policy_id: uuid.UUID, description: str, weight: float,
                 required: bool, validation_rules: Dict, created_by: uuid.UUID):
        """Initialize policy criterion with weights and validation rules."""
        self.policy_id = policy_id
        self.description = description
        self.weight = max(0.0, min(1.0, weight))  # Normalize weight to [0,1]
        self.required = required
        self.validation_rules = validation_rules
        self.created_by = created_by
        self.updated_by = created_by

    def __repr__(self):
        return f"<PolicyCriterion(description='{self.description[:50]}...', weight={self.weight})>"


class PolicyMatchResult(Base):
    """
    SQLAlchemy model for AI-powered policy matching results.
    Stores confidence scores, evidence mapping, and recommended decisions.
    """
    __tablename__ = 'policy_match_results'

    # Primary key and relationships
    match_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id = Column(UUID(as_uuid=True), ForeignKey('drug_policies.policy_id'), nullable=False)
    request_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Match results
    confidence_score = Column(Float, nullable=False)
    evidence_mapping = Column(JSON, nullable=False)
    missing_criteria = Column(JSON, nullable=True)
    recommended_decision = Column(String(50), nullable=False)
    
    # Temporal tracking
    evaluated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=False)

    # Relationships
    policy = relationship("DrugPolicy", back_populates="match_results")

    def __init__(self, policy_id: uuid.UUID, request_id: uuid.UUID,
                 confidence_score: float, evidence_mapping: Dict,
                 missing_criteria: Optional[Dict], recommended_decision: str,
                 created_by: uuid.UUID):
        """Initialize policy match result with evidence mapping."""
        self.policy_id = policy_id
        self.request_id = request_id
        self.confidence_score = max(0.0, min(1.0, confidence_score))
        self.evidence_mapping = evidence_mapping
        self.missing_criteria = missing_criteria
        self.recommended_decision = recommended_decision
        self.created_by = created_by
        self.evaluated_at = datetime.utcnow()

    def __repr__(self):
        return f"<PolicyMatchResult(confidence={self.confidence_score}, decision='{self.recommended_decision}')>"