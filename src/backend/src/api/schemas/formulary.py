"""
Pydantic schema models for drug formulary and coverage information in the Prior Authorization Management System.
Implements HIPAA-compliant validation rules and type checking for drug information, formulary entries,
and coverage details.

Version: 1.0.0
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, constr  # version: 2.0+

from api.schemas.responses import BaseResponse

# Custom type definitions with validation
DrugCode = constr(regex=r'^\d{4,5}-\d{3,4}-\d{2}$')  # NDC format validation
DrugName = constr(min_length=2, max_length=255)
Manufacturer = constr(min_length=2, max_length=255)
DosageForm = constr(min_length=2, max_length=100)
Strength = constr(min_length=1, max_length=100)

class DrugBase(BaseModel):
    """Base Pydantic model for drug information with enhanced validation."""
    
    drug_code: DrugCode = Field(
        ...,
        description="National Drug Code (NDC) in standard format",
        example="12345-678-90"
    )
    name: DrugName = Field(
        ...,
        description="Drug name including strength and form",
        example="Metformin HCl 500mg Tablets"
    )
    manufacturer: Manufacturer = Field(
        ...,
        description="Drug manufacturer name",
        example="AstraZeneca"
    )
    dosage_form: DosageForm = Field(
        ...,
        description="Pharmaceutical dosage form",
        example="Tablet"
    )
    strength: Strength = Field(
        ...,
        description="Drug strength with units",
        example="500mg"
    )

    class Config:
        """Pydantic model configuration."""
        from_attributes = True
        json_schema_extra = {
            "example": {
                "drug_code": "12345-678-90",
                "name": "Metformin HCl 500mg Tablets",
                "manufacturer": "AstraZeneca",
                "dosage_form": "Tablet",
                "strength": "500mg"
            }
        }

class DrugCreate(DrugBase):
    """Schema for creating new drug entries with strict validation."""
    
    active: bool = Field(
        default=True,
        description="Whether the drug is currently active in the formulary"
    )
    route_of_administration: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Route of drug administration",
        example="Oral"
    )

class DrugResponse(DrugBase):
    """Schema for drug information responses with audit trails."""
    
    id: UUID = Field(
        ...,
        description="Unique identifier for the drug"
    )
    active: bool = Field(
        ...,
        description="Whether the drug is currently active"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of drug record creation"
    )
    updated_at: Optional[datetime] = Field(
        None,
        description="Timestamp of last update"
    )
    created_by: UUID = Field(
        ...,
        description="ID of user who created the record"
    )
    updated_by: Optional[UUID] = Field(
        None,
        description="ID of user who last updated the record"
    )

class FormularyEntryBase(BaseModel):
    """Base Pydantic model for formulary entries with enhanced validation."""
    
    drug_id: UUID = Field(
        ...,
        description="Reference to associated drug"
    )
    tier: int = Field(
        ...,
        ge=1,
        le=6,
        description="Formulary tier (1-6)",
        example=2
    )
    requires_pa: bool = Field(
        default=False,
        description="Whether prior authorization is required"
    )
    quantity_limit: bool = Field(
        default=False,
        description="Whether quantity limits apply"
    )
    max_days_supply: Optional[int] = Field(
        None,
        ge=1,
        le=365,
        description="Maximum days supply allowed",
        example=30
    )
    max_quantity: Optional[int] = Field(
        None,
        gt=0,
        description="Maximum quantity allowed per fill",
        example=60
    )
    alternative_drugs: List[UUID] = Field(
        default_factory=list,
        description="List of alternative drug IDs"
    )
    pa_criteria: List[str] = Field(
        default_factory=list,
        description="Prior authorization criteria"
    )

class FormularyEntryCreate(FormularyEntryBase):
    """Schema for creating new formulary entries."""
    
    effective_date: datetime = Field(
        default_factory=datetime.utcnow,
        description="When the formulary entry becomes effective"
    )
    end_date: Optional[datetime] = Field(
        None,
        description="When the formulary entry expires"
    )

class FormularyEntryResponse(FormularyEntryBase):
    """Schema for formulary entry responses with audit information."""
    
    id: UUID = Field(
        ...,
        description="Unique identifier for the formulary entry"
    )
    effective_date: datetime = Field(
        ...,
        description="When the formulary entry becomes effective"
    )
    end_date: Optional[datetime] = Field(
        None,
        description="When the formulary entry expires"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of record creation"
    )
    updated_at: Optional[datetime] = Field(
        None,
        description="Timestamp of last update"
    )
    created_by: UUID = Field(
        ...,
        description="ID of user who created the record"
    )
    updated_by: Optional[UUID] = Field(
        None,
        description="ID of user who last updated the record"
    )

class DrugFormularyResponse(BaseResponse):
    """Combined response schema for drug and formulary information."""
    
    drug: DrugResponse = Field(
        ...,
        description="Drug information"
    )
    formulary_entry: FormularyEntryResponse = Field(
        ...,
        description="Formulary entry information"
    )

# Export schemas
__all__ = [
    'DrugBase',
    'DrugCreate',
    'DrugResponse',
    'FormularyEntryBase',
    'FormularyEntryCreate',
    'FormularyEntryResponse',
    'DrugFormularyResponse'
]