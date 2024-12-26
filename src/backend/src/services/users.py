"""
HIPAA-compliant user management service implementing secure authentication, authorization,
and profile management with comprehensive security controls and audit logging.

Version: 1.0.0
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

# Third-party imports with versions
import boto3  # version: 1.26.0
import redis  # version: 4.5.4
from prometheus_client import Counter, Histogram  # version: 0.16.0

from db.repositories.users import UserRepository
from core.logging import AuditLogger
from core.cache import RedisCache, create_cache_key
from core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    SecurityContext
)
from core.exceptions import (
    AuthorizationException,
    ValidationException,
    ResourceNotFoundException
)
from core.constants import (
    UserRole,
    MAX_LOGIN_ATTEMPTS,
    PASSWORD_MIN_LENGTH,
    JWT_EXPIRY_SECONDS,
    REFRESH_TOKEN_EXPIRY_SECONDS
)

# Prometheus metrics
AUTH_ATTEMPTS = Counter('auth_attempts_total', 'Total authentication attempts', ['status'])
MFA_ATTEMPTS = Counter('mfa_attempts_total', 'Total MFA validation attempts', ['status'])
AUTH_LATENCY = Histogram('auth_operation_latency_seconds', 'Authentication operation latency')

class UserService:
    """
    HIPAA-compliant service class for user management operations with comprehensive
    security controls, audit logging, and performance optimization.
    """

    def __init__(
        self,
        repository: UserRepository,
        audit_logger: AuditLogger,
        cache: RedisCache
    ) -> None:
        """
        Initialize user service with required dependencies.

        Args:
            repository: User repository instance
            audit_logger: HIPAA-compliant audit logger
            cache: Redis cache instance
        """
        self._repository = repository
        self._audit_logger = audit_logger
        self._cache = cache
        
        # Initialize AWS Cognito client for MFA
        self._cognito_client = boto3.client('cognito-idp')
        
        # Initialize rate limiting with Redis
        self._rate_limit_prefix = "rate_limit:auth:"
        self._rate_limit_window = 300  # 5 minutes
        self._rate_limit_max_attempts = 5

    async def _check_rate_limit(self, identifier: str) -> bool:
        """
        Check rate limiting for authentication attempts.

        Args:
            identifier: User identifier (email or IP)

        Returns:
            bool: True if rate limit exceeded
        """
        key = f"{self._rate_limit_prefix}{identifier}"
        try:
            current = await self._cache.get(key)
            if current and int(current) >= self._rate_limit_max_attempts:
                return True
            
            await self._cache.set(
                key,
                str(int(current or 0) + 1),
                ttl=self._rate_limit_window
            )
            return False
        except Exception as e:
            self._audit_logger.log_security_event(
                "rate_limit_error",
                details={"error": str(e), "identifier": identifier}
            )
            return False

    async def authenticate_user(
        self,
        email: str,
        password: str,
        mfa_code: Optional[str] = None,
        request_ip: Optional[str] = None
    ) -> Dict:
        """
        Authenticate user with enhanced security controls and MFA validation.

        Args:
            email: User email
            password: User password
            mfa_code: Optional MFA code
            request_ip: Request IP address for rate limiting

        Returns:
            Dict containing authentication result with tokens

        Raises:
            AuthorizationException: If authentication fails
            ValidationException: If input validation fails
        """
        start_time = datetime.utcnow()

        try:
            # Check rate limiting
            if request_ip and await self._check_rate_limit(request_ip):
                raise AuthorizationException(
                    message="Rate limit exceeded",
                    details={"window_seconds": self._rate_limit_window}
                )

            # Validate input
            if not email or not password:
                raise ValidationException(
                    message="Email and password are required",
                    validation_errors={"email": "Required", "password": "Required"}
                )

            # Get user from cache or repository
            cache_key = create_cache_key("user", email.lower())
            user = await self._cache.get(cache_key)
            
            if not user:
                user = await self._repository.get_by_email(email.lower())
                if user:
                    await self._cache.set(cache_key, user)

            if not user:
                AUTH_ATTEMPTS.labels(status="failed").inc()
                raise AuthorizationException(message="Invalid credentials")

            # Verify account status
            if not user.is_active:
                raise AuthorizationException(
                    message="Account is locked",
                    details={"locked_until": user.locked_until}
                )

            # Verify password
            if not verify_password(password, user.hashed_password):
                locked = await self._handle_failed_login(user)
                AUTH_ATTEMPTS.labels(status="failed").inc()
                if locked:
                    raise AuthorizationException(
                        message="Account locked due to multiple failed attempts",
                        details={"locked_until": user.locked_until}
                    )
                raise AuthorizationException(message="Invalid credentials")

            # Validate MFA if required
            if user.mfa_enabled:
                if not mfa_code:
                    raise ValidationException(
                        message="MFA code required",
                        validation_errors={"mfa_code": "Required"}
                    )
                
                mfa_valid = await self.validate_mfa(user.id, mfa_code)
                if not mfa_valid:
                    MFA_ATTEMPTS.labels(status="failed").inc()
                    raise AuthorizationException(message="Invalid MFA code")
                
                MFA_ATTEMPTS.labels(status="success").inc()

            # Generate tokens
            access_token = create_access_token({
                "sub": str(user.id),
                "role": user.role,
                "org": user.organization
            })
            
            refresh_token = create_refresh_token({
                "sub": str(user.id),
                "role": user.role
            })

            # Update user status
            await self._repository.update(user.id, {
                "last_login_at": datetime.utcnow(),
                "failed_login_attempts": 0
            })

            # Clear rate limit
            if request_ip:
                await self._cache.delete(f"{self._rate_limit_prefix}{request_ip}")

            # Audit log successful login
            await self._audit_logger.log_security_event(
                "user_login",
                user_id=user.id,
                details={
                    "email": user.email,
                    "role": user.role,
                    "ip": request_ip
                }
            )

            AUTH_ATTEMPTS.labels(status="success").inc()
            AUTH_LATENCY.observe((datetime.utcnow() - start_time).total_seconds())

            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": JWT_EXPIRY_SECONDS,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "role": user.role,
                    "organization": user.organization,
                    "first_name": user.first_name,
                    "last_name": user.last_name
                }
            }

        except (AuthorizationException, ValidationException):
            raise
        except Exception as e:
            self._audit_logger.log_security_event(
                "authentication_error",
                details={"error": str(e), "email": email}
            )
            raise AuthorizationException(message="Authentication failed")

    async def _handle_failed_login(self, user: Dict) -> bool:
        """
        Handle failed login attempt with account locking.

        Args:
            user: User object

        Returns:
            bool: True if account was locked
        """
        user.failed_login_attempts += 1
        locked = user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS
        
        update_data = {
            "failed_login_attempts": user.failed_login_attempts
        }
        
        if locked:
            locked_until = datetime.utcnow() + timedelta(minutes=30)
            update_data.update({
                "is_active": False,
                "locked_until": locked_until
            })

        await self._repository.update(user.id, update_data)
        
        await self._audit_logger.log_security_event(
            "failed_login",
            user_id=user.id,
            details={
                "attempts": user.failed_login_attempts,
                "locked": locked
            }
        )
        
        return locked

    async def validate_mfa(self, user_id: uuid.UUID, mfa_code: str) -> bool:
        """
        Validate MFA code using AWS Cognito.

        Args:
            user_id: User ID
            mfa_code: MFA code to validate

        Returns:
            bool: True if MFA code is valid

        Raises:
            ValidationException: If MFA code is invalid
        """
        try:
            # Get user's MFA secret from Cognito
            user = await self._repository.get_by_id(user_id)
            if not user:
                raise ResourceNotFoundException(
                    resource_type="User",
                    resource_id=str(user_id)
                )

            response = self._cognito_client.verify_software_token(
                AccessToken=user.cognito_access_token,
                UserCode=mfa_code
            )

            valid = response.get('Status') == 'SUCCESS'
            
            await self._audit_logger.log_security_event(
                "mfa_validation",
                user_id=user_id,
                details={"valid": valid}
            )
            
            return valid

        except Exception as e:
            self._audit_logger.log_security_event(
                "mfa_validation_error",
                user_id=user_id,
                details={"error": str(e)}
            )
            return False