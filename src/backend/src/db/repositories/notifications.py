"""
Repository class for managing notification data access operations in the Prior Authorization Management System.
Implements HIPAA-compliant notification handling with optimized query patterns and transaction management.

Version: 1.0.0
"""

# Standard library imports
from datetime import datetime
from typing import List, Optional
from uuid import UUID

# SQLAlchemy imports - version 2.0+
from sqlalchemy import select, and_, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

# Internal imports
from db.models.notifications import Notification
from core.constants import NotificationType
from core.logging import LOGGER

class NotificationRepository:
    """
    Repository class for HIPAA-compliant notification data access operations.
    Implements optimized query patterns and proper transaction management.
    """

    def __init__(self, db_session: AsyncSession):
        """
        Initialize repository with database session.

        Args:
            db_session (AsyncSession): SQLAlchemy async database session
        """
        self.db_session = db_session
        self.logger = LOGGER

    async def create_notification(
        self,
        notification_type: NotificationType,
        title: str,
        message: str,
        user_id: UUID,
        request_id: Optional[UUID] = None,
        metadata: Optional[dict] = None
    ) -> Notification:
        """
        Create a new notification with HIPAA-compliant data handling.

        Args:
            notification_type (NotificationType): Type of notification
            title (str): Notification title
            message (str): Notification message
            user_id (UUID): Target user ID
            request_id (UUID, optional): Associated request ID
            metadata (dict, optional): Additional metadata

        Returns:
            Notification: Created notification instance

        Raises:
            SQLAlchemyError: If database operation fails
        """
        try:
            # Create notification instance
            notification = Notification(
                type=notification_type,
                title=title,
                message=message,
                user_id=user_id,
                request_id=request_id,
                metadata=metadata
            )

            # Add to session and commit
            self.db_session.add(notification)
            await self.db_session.commit()
            await self.db_session.refresh(notification)

            self.logger.info(
                f"Created notification: {notification.id}",
                extra={"user_id": str(user_id), "type": notification_type}
            )

            return notification

        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to create notification: {str(e)}",
                extra={"user_id": str(user_id), "type": notification_type}
            )
            raise

    async def get_user_notifications(
        self,
        user_id: UUID,
        unread_only: bool = False,
        offset: int = 0,
        limit: int = 50
    ) -> List[Notification]:
        """
        Get paginated notifications for a user with optimized query patterns.

        Args:
            user_id (UUID): User ID to get notifications for
            unread_only (bool): Filter for unread notifications only
            offset (int): Pagination offset
            limit (int): Maximum number of notifications to return

        Returns:
            List[Notification]: List of notification instances

        Raises:
            SQLAlchemyError: If database query fails
        """
        try:
            # Build base query
            query = select(Notification).where(
                Notification.user_id == user_id
            ).order_by(
                desc(Notification.created_at)
            )

            # Add unread filter if specified
            if unread_only:
                query = query.where(Notification.read == False)

            # Add pagination
            query = query.offset(offset).limit(limit)

            # Execute query
            result = await self.db_session.execute(query)
            notifications = result.scalars().all()

            self.logger.debug(
                f"Retrieved {len(notifications)} notifications",
                extra={"user_id": str(user_id), "unread_only": unread_only}
            )

            return notifications

        except SQLAlchemyError as e:
            self.logger.error(
                f"Failed to get notifications: {str(e)}",
                extra={"user_id": str(user_id)}
            )
            raise

    async def mark_as_read(self, notification_id: UUID) -> bool:
        """
        Mark a notification as read with proper error handling.

        Args:
            notification_id (UUID): ID of notification to mark as read

        Returns:
            bool: True if successful, False otherwise

        Raises:
            SQLAlchemyError: If database operation fails
        """
        try:
            # Update notification read status
            query = update(Notification).where(
                Notification.id == notification_id
            ).values(
                read=True,
                updated_at=datetime.utcnow()
            )

            result = await self.db_session.execute(query)
            await self.db_session.commit()

            success = result.rowcount > 0
            if success:
                self.logger.info(
                    f"Marked notification as read: {notification_id}"
                )

            return success

        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to mark notification as read: {str(e)}",
                extra={"notification_id": str(notification_id)}
            )
            raise

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """
        Mark all notifications as read for a user using bulk operations.

        Args:
            user_id (UUID): User ID to mark notifications for

        Returns:
            int: Number of notifications updated

        Raises:
            SQLAlchemyError: If database operation fails
        """
        try:
            # Bulk update query
            query = update(Notification).where(
                and_(
                    Notification.user_id == user_id,
                    Notification.read == False
                )
            ).values(
                read=True,
                updated_at=datetime.utcnow()
            )

            result = await self.db_session.execute(query)
            await self.db_session.commit()

            count = result.rowcount
            self.logger.info(
                f"Marked {count} notifications as read",
                extra={"user_id": str(user_id)}
            )

            return count

        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to mark all notifications as read: {str(e)}",
                extra={"user_id": str(user_id)}
            )
            raise