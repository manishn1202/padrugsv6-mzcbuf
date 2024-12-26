"""
HIPAA-compliant SQLAlchemy model for user management with comprehensive security controls.
Implements role-based access control and security audit capabilities.

Version: 1.0.0
"""

from datetime import datetime, timedelta
import uuid
from typing import Optional

from sqlalchemy import Column, String, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import validates

from db.base import Base
from core.constants import UserRole, MAX_LOGIN_ATTEMPTS
from core.security import get_password_hash

class User(Base):
    """
    HIPAA-compliant user model implementing comprehensive security controls and audit capabilities.
    Supports role-based access control and tracks security-relevant events.
    """
    __tablename__ = "users"

    # Primary identifier
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Authentication fields
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    
    # Personal information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    
    # Access control
    role = Column(String(50), nullable=False)
    organization = Column(String(255), nullable=False)
    npi_number = Column(String(10), nullable=True)  # National Provider Identifier
    
    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Security tracking
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    password_changed_at = Column(DateTime, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, email: str, password: str, first_name: str, last_name: str,
                 role: UserRole, organization: str, npi_number: Optional[str] = None):
        """
        Initialize user with required fields and security measures.

        Args:
            email: User's email address
            password: Plain text password (will be hashed)
            first_name: User's first name
            last_name: User's last name
            role: UserRole enum value
            organization: User's organization name
            npi_number: Optional National Provider Identifier
        """
        self.email = email
        self.hashed_password = get_password_hash(password)
        self.first_name = first_name
        self.last_name = last_name
        self.role = role
        self.organization = organization
        self.npi_number = npi_number
        
        # Initialize security fields
        self.password_changed_at = datetime.utcnow()
        self.failed_login_attempts = 0
        self.is_active = True
        self.is_verified = False

    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"

    @validates('email')
    def validate_email(self, key: str, email: str) -> str:
        """Validate email format and length."""
        if not email or len(email) > 255 or '@' not in email:
            raise ValueError("Invalid email address")
        return email.lower()

    @validates('role')
    def validate_role(self, key: str, role: str) -> str:
        """Validate role against UserRole enum."""
        if role not in [r.value for r in UserRole]:
            raise ValueError(f"Invalid role: {role}")
        return role

    @validates('npi_number')
    def validate_npi(self, key: str, npi: Optional[str]) -> Optional[str]:
        """Validate NPI number format if provided."""
        if npi and (not npi.isdigit() or len(npi) != 10):
            raise ValueError("Invalid NPI number format")
        return npi

    def increment_failed_login(self) -> bool:
        """
        Increment failed login attempts and check account lock status.
        
        Returns:
            bool: True if account is locked, False otherwise
        """
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
            self.is_active = False
            return True
        return False

    def reset_failed_login(self) -> None:
        """Reset failed login counter and update last login timestamp."""
        self.failed_login_attempts = 0
        self.last_login_at = datetime.utcnow()

    def check_password_expiry(self, max_age_days: int = 90) -> bool:
        """
        Check if password has expired based on age.
        
        Args:
            max_age_days: Maximum allowed password age in days
            
        Returns:
            bool: True if password has expired, False otherwise
        """
        if not self.password_changed_at:
            return True
        
        expiry_date = self.password_changed_at + timedelta(days=max_age_days)
        return datetime.utcnow() > expiry_date

    def __repr__(self) -> str:
        """String representation of User."""
        return f"<User {self.email} ({self.role})>"