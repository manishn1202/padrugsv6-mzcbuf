"""
Prior Authorization Management System - Database Repositories Module
Provides centralized access to HIPAA-compliant database repositories with comprehensive
audit logging and performance monitoring.

Version: 1.0.0
Author: PA Management System Team
"""

# Import repository classes
from db.repositories.users import UserRepository
from db.repositories.prior_auth import PriorAuthRepository
from db.repositories.clinical import ClinicalRepository

# Module version
__version__ = "1.0.0"
__author__ = "PA Management System Team"

# Export repository classes for centralized access
__all__ = [
    "UserRepository",
    "PriorAuthRepository", 
    "ClinicalRepository"
]

# Repository class documentation
"""
Available Repositories:

UserRepository:
    HIPAA-compliant user management with secure password handling and audit logging.
    Key operations:
    - get_by_id: Retrieve user by UUID
    - get_by_email: Retrieve user by email
    - create: Create new user with security checks
    - update: Update user with audit trail
    - delete: Soft delete user
    - get_by_role: Query users by role

PriorAuthRepository:
    High-performance prior authorization request management.
    Key operations:
    - create: Create new PA request
    - get_by_id: Retrieve PA request by UUID
    - update_status: Update request status with validation
    - add_clinical_info: Add clinical data to request
    - get_provider_requests: Get requests by provider
    - get_pending_reviews: Get requests pending review

ClinicalRepository:
    Secure clinical data and evidence management with PHI protection.
    Key operations:
    - create_clinical_data: Create new clinical data record
    - get_clinical_data: Retrieve clinical data by UUID
    - create_evidence: Create new evidence record
    - get_evidence_by_clinical_data: Get evidence for clinical data
    - update_clinical_data: Update clinical data with audit
"""