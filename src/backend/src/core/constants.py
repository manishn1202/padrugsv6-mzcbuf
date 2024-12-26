"""
Core system-wide constants and enumerations for the Prior Authorization Management System.
Defines standardized values used across the application to ensure consistent behavior and HIPAA compliance.

Version: 1.0.0
"""

from enum import Enum, StrEnum

# API Configuration
API_VERSION = "v1"

# File Upload Limits (in MB)
MAX_FILE_SIZE_MB = 10  # HIPAA-compliant document size limit

# Prior Authorization Request Limits
MAX_DRUG_QUANTITY = 999  # Maximum allowed drug quantity per request
MIN_DAYS_SUPPLY = 1  # Minimum days supply for medication
MAX_DAYS_SUPPLY = 365  # Maximum days supply (1 year)
MAX_REFILLS = 12  # Maximum number of refills allowed
CRITERIA_MATCH_THRESHOLD = 0.85  # Minimum AI match confidence score

# Security Constants
MAX_LOGIN_ATTEMPTS = 5  # Maximum failed login attempts before account lockout
PASSWORD_MIN_LENGTH = 12  # Minimum password length per HIPAA requirements
JWT_EXPIRY_SECONDS = 3600  # JWT token expiry (1 hour)
REFRESH_TOKEN_EXPIRY_SECONDS = 604800  # Refresh token expiry (7 days)

# Performance Tuning
REQUEST_TIMEOUT_SECONDS = 30  # API request timeout
MAX_BATCH_SIZE = 100  # Maximum batch processing size
CACHE_TTL_SECONDS = 300  # Cache time-to-live (5 minutes)
MAX_CONCURRENT_REQUESTS = 1000  # Maximum concurrent API requests
RATE_LIMIT_PER_MINUTE = 300  # API rate limit per client

class PriorAuthStatus(StrEnum):
    """
    Enumeration of prior authorization request statuses throughout the workflow lifecycle.
    Uses StrEnum for direct JSON serialization support.
    """
    DRAFT = "DRAFT"  # Initial draft status
    SUBMITTED = "SUBMITTED"  # Submitted to payer
    IN_REVIEW = "IN_REVIEW"  # Under payer review
    PENDING_INFO = "PENDING_INFO"  # Additional information requested
    APPROVED = "APPROVED"  # Request approved
    DENIED = "DENIED"  # Request denied
    CANCELLED = "CANCELLED"  # Request cancelled by provider
    EXPIRED = "EXPIRED"  # Request expired without decision
    APPEALED = "APPEALED"  # Under appeal review

class UserRole(StrEnum):
    """
    Enumeration of system user roles with associated access levels and permissions.
    Aligned with HIPAA role-based access control requirements.
    """
    PROVIDER = "PROVIDER"  # Healthcare provider submitting PAs
    REVIEWER = "REVIEWER"  # Payer staff reviewing PAs
    MEDICAL_DIRECTOR = "MEDICAL_DIRECTOR"  # Senior medical reviewer
    ADMIN = "ADMIN"  # System administrator
    AUDITOR = "AUDITOR"  # Compliance auditor
    SYSTEM = "SYSTEM"  # System service account

class DocumentType(StrEnum):
    """
    Enumeration of HIPAA-compliant document types supported by the system.
    Used for proper categorization and handling of uploaded files.
    """
    CLINICAL_NOTE = "CLINICAL_NOTE"  # Clinical documentation
    LAB_RESULT = "LAB_RESULT"  # Laboratory results
    PRESCRIPTION = "PRESCRIPTION"  # Prescription documentation
    INSURANCE_CARD = "INSURANCE_CARD"  # Insurance information
    PRIOR_AUTH_FORM = "PRIOR_AUTH_FORM"  # PA form documentation
    APPEAL_LETTER = "APPEAL_LETTER"  # Appeal documentation
    MEDICAL_RECORD = "MEDICAL_RECORD"  # Complete medical record
    OTHER = "OTHER"  # Other supporting documentation

class NotificationType(StrEnum):
    """
    Enumeration of system notification types for workflow events.
    Used for consistent event handling and user notifications.
    """
    REQUEST_SUBMITTED = "REQUEST_SUBMITTED"  # New PA submission
    REQUEST_UPDATED = "REQUEST_UPDATED"  # PA request updated
    REQUEST_APPROVED = "REQUEST_APPROVED"  # PA request approved
    REQUEST_DENIED = "REQUEST_DENIED"  # PA request denied
    INFO_NEEDED = "INFO_NEEDED"  # Additional information requested
    REVIEW_ASSIGNED = "REVIEW_ASSIGNED"  # PA assigned to reviewer
    APPEAL_FILED = "APPEAL_FILED"  # Appeal submitted
    EXPIRY_WARNING = "EXPIRY_WARNING"  # PA nearing expiration
    SECURITY_ALERT = "SECURITY_ALERT"  # Security-related alert

# Export all enums for use across the application
__all__ = [
    "PriorAuthStatus",
    "UserRole",
    "DocumentType",
    "NotificationType"
]