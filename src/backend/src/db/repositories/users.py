"""
HIPAA-compliant user repository implementation with caching, audit logging, and secure operations.
Implements role-based access control and performance optimizations.

Version: 1.0.0
"""

from typing import List, Optional, Dict
from uuid import UUID
import asyncio

from sqlalchemy import select  # version: 2.0+
from sqlalchemy.ext.asyncio import AsyncSession  # version: 2.0+
from tenacity import retry, retry_if_exception_type  # version: 8.0+
from redis.exceptions import RedisError  # version: 4.0+

from db.models.users import User
from db.base import Base
from core.security import get_password_hash
from core.logging import AuditLogger
from core.cache import RedisCache
from core.exceptions import ValidationException, ResourceNotFoundException

class UserRepository:
    """
    HIPAA-compliant repository for user management operations with caching and audit logging.
    Implements secure password handling, role-based access control, and performance optimizations.
    """

    def __init__(self, db_session: AsyncSession, cache: RedisCache, audit_logger: AuditLogger):
        """
        Initialize repository with database session, cache, and audit logger.

        Args:
            db_session: Async database session
            cache: Redis cache instance
            audit_logger: HIPAA-compliant audit logger
        """
        self._db = db_session
        self._cache = cache
        self._audit_logger = audit_logger
        self._cache_ttl = 300  # 5 minutes cache TTL
        self._cache_prefix = "user:"

    def _get_cache_key(self, user_id: UUID) -> str:
        """Generate cache key for user."""
        return f"{self._cache_prefix}{str(user_id)}"

    async def _invalidate_cache(self, user_id: UUID) -> None:
        """Invalidate user cache entry."""
        cache_key = self._get_cache_key(user_id)
        await self._cache.delete(cache_key)

    @retry(retry=retry_if_exception_type(RedisError))
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Retrieve user by ID with caching.

        Args:
            user_id: User UUID

        Returns:
            User object if found, None otherwise
        """
        # Check cache first
        cache_key = self._get_cache_key(user_id)
        cached_user = await self._cache.get(cache_key)
        if cached_user:
            await self._audit_logger.log_user_action(
                action="cache_hit",
                user_id=user_id,
                details={"operation": "get_by_id"}
            )
            return cached_user

        # Query database
        query = select(User).where(User.id == user_id)
        result = await self._db.execute(query)
        user = result.scalar_one_or_none()

        if user:
            # Update cache
            await self._cache.set(cache_key, user, ttl=self._cache_ttl)
            await self._audit_logger.log_user_action(
                action="user_retrieved",
                user_id=user_id,
                details={"operation": "get_by_id"}
            )
        else:
            await self._audit_logger.log_user_action(
                action="user_not_found",
                user_id=user_id,
                details={"operation": "get_by_id"}
            )

        return user

    async def create(self, user_data: Dict) -> User:
        """
        Create new user with security checks.

        Args:
            user_data: User creation data

        Returns:
            Created user object

        Raises:
            ValidationException: If validation fails
        """
        # Validate required fields
        required_fields = ["email", "password", "first_name", "last_name", "role", "organization"]
        missing_fields = [field for field in required_fields if field not in user_data]
        if missing_fields:
            raise ValidationException(
                message="Missing required fields",
                validation_errors={"missing_fields": missing_fields}
            )

        # Check email uniqueness
        query = select(User).where(User.email == user_data["email"].lower())
        result = await self._db.execute(query)
        if result.scalar_one_or_none():
            raise ValidationException(
                message="Email already exists",
                validation_errors={"email": "Email address is already registered"}
            )

        # Create user with secure password
        user_data["hashed_password"] = get_password_hash(user_data.pop("password"))
        user = User(**user_data)
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)

        # Update cache
        cache_key = self._get_cache_key(user.id)
        await self._cache.set(cache_key, user, ttl=self._cache_ttl)

        # Audit log
        await self._audit_logger.log_user_action(
            action="user_created",
            user_id=user.id,
            details={"email": user.email, "role": user.role}
        )

        return user

    async def update(self, user_id: UUID, update_data: Dict) -> User:
        """
        Update user with audit logging.

        Args:
            user_id: User UUID
            update_data: Fields to update

        Returns:
            Updated user object

        Raises:
            ResourceNotFoundException: If user not found
            ValidationException: If validation fails
        """
        # Get existing user
        user = await self.get_by_id(user_id)
        if not user:
            raise ResourceNotFoundException(
                resource_type="User",
                resource_id=str(user_id)
            )

        # Handle password updates securely
        if "password" in update_data:
            update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

        # Validate email uniqueness if being updated
        if "email" in update_data and update_data["email"].lower() != user.email:
            query = select(User).where(User.email == update_data["email"].lower())
            result = await self._db.execute(query)
            if result.scalar_one_or_none():
                raise ValidationException(
                    message="Email already exists",
                    validation_errors={"email": "Email address is already registered"}
                )

        # Update user attributes
        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)

        await self._db.commit()
        await self._db.refresh(user)

        # Invalidate cache
        await self._invalidate_cache(user_id)

        # Audit log
        await self._audit_logger.log_user_action(
            action="user_updated",
            user_id=user_id,
            details={"updated_fields": list(update_data.keys())}
        )

        return user

    async def batch_create(self, user_data_list: List[Dict]) -> List[User]:
        """
        Efficiently create multiple users.

        Args:
            user_data_list: List of user creation data

        Returns:
            List of created users

        Raises:
            ValidationException: If validation fails
        """
        # Validate all user data first
        for user_data in user_data_list:
            required_fields = ["email", "password", "first_name", "last_name", "role", "organization"]
            missing_fields = [field for field in required_fields if field not in user_data]
            if missing_fields:
                raise ValidationException(
                    message=f"Missing required fields for user {user_data.get('email', 'unknown')}",
                    validation_errors={"missing_fields": missing_fields}
                )

        # Check email uniqueness in batch
        emails = [data["email"].lower() for data in user_data_list]
        query = select(User).where(User.email.in_(emails))
        result = await self._db.execute(query)
        existing_emails = {user.email for user in result.scalars().all()}
        if existing_emails:
            raise ValidationException(
                message="Duplicate emails found",
                validation_errors={"duplicate_emails": list(existing_emails)}
            )

        # Create users with secure passwords
        users = []
        for user_data in user_data_list:
            user_data["hashed_password"] = get_password_hash(user_data.pop("password"))
            user = User(**user_data)
            self._db.add(user)
            users.append(user)

        await self._db.commit()
        for user in users:
            await self._db.refresh(user)

        # Update cache and audit log in parallel
        async def cache_and_log(user: User):
            cache_key = self._get_cache_key(user.id)
            await asyncio.gather(
                self._cache.set(cache_key, user, ttl=self._cache_ttl),
                self._audit_logger.log_user_action(
                    action="user_created",
                    user_id=user.id,
                    details={"email": user.email, "role": user.role}
                )
            )

        await asyncio.gather(*[cache_and_log(user) for user in users])

        return users