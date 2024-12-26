"""
Core SQLAlchemy declarative base and metadata configuration for the Prior Authorization Management System.
Provides HIPAA-compliant database model foundation with PostgreSQL-specific optimizations.

Version: 1.0.0
"""

# sqlalchemy 2.0+ imports
from sqlalchemy import MetaData
from sqlalchemy.orm import declarative_base
from sqlalchemy import naming

# Define consistent naming convention for database constraints
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",  # Index naming
    "uq": "uq_%(table_name)s_%(column_0_name)s",  # Unique constraint naming
    "ck": "ck_%(table_name)s_%(constraint_name)s",  # Check constraint naming
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # Foreign key naming
    "pk": "pk_%(table_name)s"  # Primary key naming
}

# Configure metadata with PostgreSQL-specific settings and HIPAA compliance
metadata = MetaData(
    naming_convention=NAMING_CONVENTION,
    # Use 'pa' schema for Prior Authorization tables to ensure proper isolation
    schema="pa",
    # Enable PostgreSQL-specific features
    info={
        "postgresql_partition_by": "RANGE",  # Enable table partitioning for large tables
        "postgresql_include_oids": False,  # Disable OIDs for security
        "postgresql_using": "btree",  # Default index type
        "postgresql_tablespace": "pg_default",  # Default tablespace
        "postgresql_with": {
            "fillfactor": 90  # Optimize for updates while maintaining read performance
        }
    }
)

# Create declarative base class with configured metadata
Base = declarative_base(metadata=metadata)

# Configure base class settings
Base.__abstract__ = True  # Mark as abstract base
Base.metadata.schema = "pa"  # Set schema for all derived models

# Add HIPAA-compliant audit trail mixin properties
Base.created_at = None  # Will be implemented by models
Base.updated_at = None  # Will be implemented by models
Base.created_by = None  # Will be implemented by models
Base.updated_by = None  # Will be implemented by models

# Add PostgreSQL-specific model configurations
Base.__table_args__ = {
    'postgresql_partition_by': 'RANGE',  # Enable partitioning by default
    'postgresql_using': 'btree',  # Default index type
    'postgresql_with': {
        'fillfactor': 90,  # Optimize for updates
        'autovacuum_enabled': True,  # Enable automatic cleanup
        'toast_tuple_target': 4096  # Optimize TOAST storage for large fields
    }
}

# Export configured base and metadata for use in models
__all__ = ['Base', 'metadata']