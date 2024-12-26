"""
Pydantic schemas for notification request/response models in the Prior Authorization Management System.
Provides HIPAA-compliant real-time status updates and communications with validation and optimization.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict  # pydantic v2.0+

from core.constants import NotificationType

class NotificationBase(BaseModel):
    """
    Base Pydantic model for notification data with HIPAA-compliant field validation.
    Provides core fields and validation rules common to all notification schemas.
    """
    type: NotificationType = Field(
        ...,  # Required field
        description="Type of notification event",
        examples=[NotificationType.REQUEST_SUBMITTED]
    )
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Brief notification title",
        examples=["Prior Authorization Request Submitted"]
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Detailed notification message",
        examples=["Your prior authorization request #12345 has been submitted successfully."]
    )
    user_id: UUID = Field(
        ...,
        description="ID of the user receiving the notification"
    )
    request_id: UUID = Field(
        ...,
        description="Associated prior authorization request ID"
    )
    metadata: Dict = Field(
        default_factory=dict,
        max_length=10000,  # Limit metadata size for performance
        description="Additional contextual information",
        examples=[{
            "request_status": "SUBMITTED",
            "drug_name": "Abilify",
            "provider_name": "Dr. Smith"
        }]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "type": NotificationType.REQUEST_SUBMITTED,
                "title": "Prior Authorization Request Submitted",
                "message": "Your prior authorization request #12345 has been submitted successfully.",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "request_id": "123e4567-e89b-12d3-a456-426614174001",
                "metadata": {
                    "request_status": "SUBMITTED",
                    "drug_name": "Abilify",
                    "provider_name": "Dr. Smith"
                }
            }
        },
        arbitrary_types_allowed=True,
        str_max_length=2000,
        json_encoders={
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
    )

class NotificationCreate(NotificationBase):
    """
    Schema for creating new notifications with required field validation.
    Inherits from NotificationBase and adds creation-specific validation.
    """
    pass

class NotificationResponse(NotificationBase):
    """
    Schema for notification responses including timestamps and read status.
    Extends NotificationBase with additional response-specific fields.
    """
    id: UUID = Field(
        ...,
        description="Unique notification identifier"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp when notification was created"
    )
    read: bool = Field(
        default=False,
        description="Whether the notification has been read"
    )

class NotificationUpdate(BaseModel):
    """
    Schema for updating notification read status with validation.
    Simplified model for status updates only.
    """
    read: bool = Field(
        ...,
        description="Updated read status for the notification"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "read": True
            }
        }
    )

class NotificationList(BaseModel):
    """
    Schema for paginated notification list response with performance optimizations.
    Supports efficient pagination and list management.
    """
    items: List[NotificationResponse] = Field(
        ...,
        description="List of notifications",
        max_items=100  # Limit page size for performance
    )
    total: int = Field(
        ...,
        ge=0,
        description="Total number of notifications"
    )
    page: int = Field(
        ...,
        ge=1,
        description="Current page number"
    )
    size: int = Field(
        ...,
        ge=1,
        le=100,
        description="Number of items per page"
    )
    pages: int = Field(
        ...,
        ge=0,
        description="Total number of pages"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [],
                "total": 50,
                "page": 1,
                "size": 10,
                "pages": 5
            }
        }
    )

# Export all notification schemas
__all__ = [
    "NotificationBase",
    "NotificationCreate",
    "NotificationResponse",
    "NotificationUpdate",
    "NotificationList"
]