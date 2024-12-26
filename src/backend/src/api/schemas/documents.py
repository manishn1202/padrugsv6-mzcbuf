"""
Pydantic schemas for document management in the Prior Authorization Management System.
Implements HIPAA-compliant document handling with strict validation and security controls.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, UUID4, constr, conint  # pydantic v2.0+
from core.constants import DocumentType

# Security and validation constants
SUPPORTED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg", 
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
DOWNLOAD_URL_EXPIRY = 900  # 15 minutes in seconds
REQUIRED_HASH_STRENGTH = 256  # Required SHA-256 hash strength
FILENAME_PATTERN = r"^[a-zA-Z0-9._-]+$"  # Secure filename pattern

class DocumentBase(BaseModel):
    """
    Base schema for document metadata with enhanced security validation.
    Implements HIPAA-compliant document handling requirements.
    """
    filename: constr(min_length=1, max_length=255, pattern=FILENAME_PATTERN) = Field(
        ...,
        description="Secure document filename",
        example="lab_results_2024.pdf"
    )
    mime_type: constr(min_length=1, max_length=100) = Field(
        ...,
        description="Document MIME type",
        example="application/pdf"
    )
    size_bytes: conint(gt=0, lt=MAX_FILE_SIZE) = Field(
        ...,
        description="Document size in bytes",
        example=1048576
    )
    document_type: DocumentType = Field(
        ...,
        description="Type of clinical document",
        example=DocumentType.CLINICAL_NOTE
    )
    file_hash: str = Field(
        ...,
        description="SHA-256 file hash for integrity verification",
        example="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    retention_days: int = Field(
        default=2555,  # 7 years default retention
        ge=1,
        le=3650,
        description="Document retention period in days"
    )

    @classmethod
    def validate_mime_type(cls, mime_type: str) -> bool:
        """
        Validates document MIME type against supported types with security checks.
        
        Args:
            mime_type: Document MIME type to validate
            
        Returns:
            bool: True if valid, raises ValidationError if invalid
            
        Raises:
            ValidationError: If mime_type is invalid or potentially malicious
        """
        if not mime_type or mime_type.strip() == "":
            raise ValueError("MIME type cannot be empty")
        
        if mime_type not in SUPPORTED_MIME_TYPES:
            raise ValueError(f"Unsupported MIME type: {mime_type}")
        
        return True

    @classmethod
    def validate_file_hash(cls, file_hash: str) -> bool:
        """
        Validates file hash for integrity verification.
        
        Args:
            file_hash: SHA-256 hash of the file
            
        Returns:
            bool: True if valid, raises ValidationError if invalid
            
        Raises:
            ValidationError: If hash is invalid or weak
        """
        if not file_hash or len(file_hash) != 64:
            raise ValueError("Invalid hash length - SHA-256 required")
        
        if not all(c in "0123456789abcdefABCDEF" for c in file_hash):
            raise ValueError("Invalid hash format")
            
        return True

class DocumentCreate(DocumentBase):
    """
    Schema for document upload request with HIPAA compliance measures.
    Extends DocumentBase with additional security metadata.
    """
    request_id: UUID4 = Field(
        ...,
        description="Associated prior authorization request ID"
    )
    encryption_key_id: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="KMS encryption key identifier"
    )
    audit_metadata: Dict = Field(
        default_factory=dict,
        description="Audit trail metadata"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "filename": "clinical_notes.pdf",
                "mime_type": "application/pdf",
                "size_bytes": 1048576,
                "document_type": "CLINICAL_NOTE",
                "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "retention_days": 2555,
                "request_id": "123e4567-e89b-12d3-a456-426614174000",
                "encryption_key_id": "arn:aws:kms:region:account:key/key-id",
                "audit_metadata": {
                    "source_system": "EMR",
                    "upload_ip": "10.0.0.1",
                    "user_agent": "Mozilla/5.0"
                }
            }
        }

class DocumentResponse(DocumentBase):
    """
    Schema for document retrieval response with security controls.
    Extends DocumentBase with access and audit information.
    """
    id: UUID4 = Field(
        ...,
        description="Unique document identifier"
    )
    download_url: str = Field(
        ...,
        description="Temporary secure download URL"
    )
    uploaded_at: datetime = Field(
        ...,
        description="Document upload timestamp"
    )
    uploaded_by: UUID4 = Field(
        ...,
        description="User ID who uploaded the document"
    )
    url_expires_at: datetime = Field(
        ...,
        description="Download URL expiration timestamp"
    )
    security_metadata: Dict = Field(
        default_factory=dict,
        description="Security-related metadata"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "filename": "clinical_notes.pdf",
                "mime_type": "application/pdf",
                "size_bytes": 1048576,
                "document_type": "CLINICAL_NOTE",
                "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "download_url": "https://example.com/download/secure-token",
                "uploaded_at": "2024-01-01T12:00:00Z",
                "uploaded_by": "123e4567-e89b-12d3-a456-426614174000",
                "url_expires_at": "2024-01-01T12:15:00Z",
                "security_metadata": {
                    "encryption_status": "encrypted",
                    "access_count": 0,
                    "last_accessed": None
                }
            }
        }

class DocumentList(BaseModel):
    """
    Schema for paginated document list response with filtering capabilities.
    Implements secure pagination and filtering controls.
    """
    items: List[DocumentResponse] = Field(
        ...,
        description="List of documents"
    )
    total: int = Field(
        ...,
        ge=0,
        description="Total number of documents"
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
        description="Page size"
    )
    filters: Optional[Dict] = Field(
        default=None,
        description="Applied filters"
    )
    sort_by: Optional[str] = Field(
        default=None,
        description="Sort field"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "items": [],
                "total": 0,
                "page": 1,
                "size": 20,
                "filters": {
                    "document_type": "CLINICAL_NOTE",
                    "date_range": {
                        "start": "2024-01-01",
                        "end": "2024-01-31"
                    }
                },
                "sort_by": "-uploaded_at"
            }
        }

# Export schemas for use in API endpoints
__all__ = [
    "DocumentBase",
    "DocumentCreate",
    "DocumentResponse",
    "DocumentList"
]