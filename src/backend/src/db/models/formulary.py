"""
SQLAlchemy models for drug formulary and coverage information in the Prior Authorization Management System.
Implements secure storage and tracking of drug information, formulary rules, and coverage details with 
HIPAA-compliant audit trails.

Version: 1.0.0
"""

from datetime import datetime
from typing import List, Optional
import uuid

# SQLAlchemy imports (version 2.0+)
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship, validates

# Internal imports
from db.base import Base

class Drug(Base):
    """
    SQLAlchemy model for comprehensive drug information with HIPAA-compliant tracking.
    Stores detailed drug information including NDC codes, dosage forms, and manufacturer details.
    """
    __tablename__ = 'drugs'

    # Primary identification fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ndc_code = Column(String(11), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    manufacturer = Column(String(255), nullable=False)
    
    # Drug specifications
    dosage_form = Column(String(100), nullable=False)
    strength = Column(String(100), nullable=False)
    route_of_administration = Column(String(100), nullable=False)
    
    # Status and control
    active = Column(Boolean, nullable=False, default=True)
    
    # HIPAA-compliant audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    updated_by = Column(UUID(as_uuid=True))

    # Relationships
    formulary_entries = relationship("FormularyEntry", back_populates="drug")

    @validates('ndc_code')
    def validate_ndc_code(self, key: str, ndc_code: str) -> str:
        """Validate NDC code format (11 digits with optional hyphens)."""
        cleaned_code = ndc_code.replace('-', '')
        if not cleaned_code.isdigit() or len(cleaned_code) != 11:
            raise ValueError("Invalid NDC code format. Must be 11 digits.")
        return ndc_code

    def __init__(self, ndc_code: str, name: str, manufacturer: str, 
                 dosage_form: str, strength: str, route_of_administration: str,
                 created_by: uuid.UUID) -> None:
        """Initialize drug model with required fields and audit tracking."""
        self.ndc_code = ndc_code
        self.name = name
        self.manufacturer = manufacturer
        self.dosage_form = dosage_form
        self.strength = strength
        self.route_of_administration = route_of_administration
        self.active = True
        self.created_at = datetime.utcnow()
        self.created_by = created_by

class FormularyEntry(Base):
    """
    SQLAlchemy model for formulary entries with coverage rules and audit trail.
    Manages drug coverage details including tier information, PA requirements, and quantity limits.
    """
    __tablename__ = 'formulary_entries'

    # Primary identification fields
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id = Column(UUID(as_uuid=True), ForeignKey('drugs.id'), nullable=False)
    
    # Coverage details
    tier = Column(Integer, nullable=False)
    requires_pa = Column(Boolean, nullable=False, default=False)
    quantity_limit = Column(Boolean, nullable=False, default=False)
    max_days_supply = Column(Integer)
    max_quantity = Column(Integer)
    
    # Step therapy and alternatives
    alternative_drugs = Column(ARRAY(UUID(as_uuid=True)), default=[])
    pa_criteria = Column(ARRAY(String(500)), default=[])
    
    # Effective dates
    effective_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_date = Column(DateTime)
    
    # HIPAA-compliant audit trail
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    updated_by = Column(UUID(as_uuid=True))

    # Relationships
    drug = relationship("Drug", back_populates="formulary_entries")

    @validates('tier')
    def validate_tier(self, key: str, tier: int) -> int:
        """Validate formulary tier (1-6)."""
        if not 1 <= tier <= 6:
            raise ValueError("Formulary tier must be between 1 and 6")
        return tier

    @validates('max_days_supply')
    def validate_max_days_supply(self, key: str, value: Optional[int]) -> Optional[int]:
        """Validate max days supply (1-365)."""
        if value is not None and not 1 <= value <= 365:
            raise ValueError("Max days supply must be between 1 and 365")
        return value

    def __init__(self, drug_id: uuid.UUID, tier: int, requires_pa: bool,
                 created_by: uuid.UUID) -> None:
        """Initialize formulary entry with coverage rules and audit trail."""
        self.drug_id = drug_id
        self.tier = tier
        self.requires_pa = requires_pa
        self.quantity_limit = False
        self.alternative_drugs = []
        self.pa_criteria = []
        self.effective_date = datetime.utcnow()
        self.created_at = datetime.utcnow()
        self.created_by = created_by

    def is_active(self) -> bool:
        """Check if formulary entry is currently active."""
        now = datetime.utcnow()
        return (self.effective_date <= now and 
                (self.end_date is None or self.end_date > now))

    def requires_prior_authorization(self) -> bool:
        """Check if drug requires prior authorization."""
        return self.requires_pa or bool(self.pa_criteria)