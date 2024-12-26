"""
Service layer for managing HIPAA-compliant document operations in the Prior Authorization Management System.
Implements secure document handling with encryption, access control, and comprehensive audit logging.

Version: 1.0.0
"""

# Standard library imports - Python 3.11+
import os
from datetime import datetime, timedelta
from typing import List, Optional, BinaryIO
from uuid import UUID

# Third-party imports
import boto3  # version: 1.26.0
from botocore.exceptions import ClientError  # version: 1.29.0
from fastapi import HTTPException  # version: 0.100.0

# Internal imports
from db.models.documents import Document, DocumentType
from db.repositories.documents import DocumentRepository
from core.security import SecurityContext
from core.logging import LOGGER

# Constants
S3_BUCKET = os.getenv('DOCUMENT_BUCKET_NAME')
S3_PRESIGNED_EXPIRY = 3600  # 1 hour
SUPPORTED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
RETENTION_PERIOD_YEARS = 7
MAX_RETRIES = 3

class DocumentService:
    """
    Service class for managing HIPAA-compliant document operations with comprehensive 
    security, audit logging, and retention management.
    """

    def __init__(self, repository: DocumentRepository):
        """
        Initialize document service with dependencies and connection pooling.

        Args:
            repository: Document repository instance
        """
        self._repository = repository
        self._s3_client = boto3.client(
            's3',
            config=boto3.Config(
                max_pool_connections=50,
                retries={'max_attempts': MAX_RETRIES}
            )
        )
        self._security_context = SecurityContext()
        self._cache = {}
        self.logger = LOGGER.getChild('DocumentService')

    async def upload_document(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
        document_type: DocumentType,
        request_id: UUID,
        user_id: UUID
    ) -> Document:
        """
        Upload document to S3 with encryption and audit logging.

        Args:
            file_content: Document binary content
            filename: Original filename
            mime_type: Document MIME type
            document_type: Type of clinical document
            request_id: Associated prior auth request ID
            user_id: User performing the upload

        Returns:
            Created document instance

        Raises:
            HTTPException: If validation fails or upload errors occur
        """
        try:
            # Validate file
            if len(file_content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size exceeds maximum allowed ({MAX_FILE_SIZE} bytes)"
                )

            if mime_type not in SUPPORTED_MIME_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {mime_type}"
                )

            # Generate unique S3 key with timestamp
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            s3_key = f"documents/{request_id}/{timestamp}_{filename}"

            # Calculate retention date
            retention_date = datetime.utcnow() + timedelta(days=365 * RETENTION_PERIOD_YEARS)

            # Encrypt file content
            with self._security_context as security:
                encrypted_content = security.encrypt(file_content)
                encryption_metadata = {
                    "encrypted": True,
                    "encryption_date": datetime.utcnow().isoformat(),
                    "encryption_type": "AES-256-GCM"
                }

            # Upload to S3 with retry logic
            try:
                self._s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=s3_key,
                    Body=encrypted_content,
                    ContentType=mime_type,
                    Metadata={
                        'retention_date': retention_date.isoformat(),
                        'document_type': document_type.value,
                        'uploaded_by': str(user_id)
                    },
                    ServerSideEncryption='aws:kms'
                )
            except ClientError as e:
                self.logger.error(f"S3 upload failed: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to upload document to storage"
                )

            # Create document record
            document = await self._repository.create_document(
                filename=filename,
                s3_key=s3_key,
                mime_type=mime_type,
                size_bytes=len(file_content),
                document_type=document_type,
                request_id=request_id,
                uploaded_by=user_id,
                encryption_metadata=encryption_metadata
            )

            self.logger.info(
                f"Document uploaded successfully: {document.id}",
                extra={
                    "document_id": str(document.id),
                    "request_id": str(request_id),
                    "user_id": str(user_id),
                    "file_size": len(file_content)
                }
            )

            return document

        except Exception as e:
            self.logger.error(f"Document upload failed: {str(e)}")
            raise

    async def get_document(
        self,
        document_id: UUID,
        user_id: UUID
    ) -> dict:
        """
        Retrieve document with presigned URL and access validation.

        Args:
            document_id: Document UUID
            user_id: User requesting access

        Returns:
            Document data with presigned URL

        Raises:
            HTTPException: If document not found or access denied
        """
        try:
            # Check cache first
            cache_key = f"{document_id}_{user_id}"
            if cache_key in self._cache:
                cached = self._cache[cache_key]
                if datetime.utcnow() < cached['expires']:
                    return cached['data']

            # Get document metadata
            document = await self._repository.get_document(
                document_id=document_id,
                accessed_by=user_id,
                access_reason="document_download"
            )

            # Generate presigned URL
            try:
                presigned_url = self._s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': S3_BUCKET,
                        'Key': document.s3_key,
                        'ResponseContentType': document.mime_type,
                        'ResponseContentDisposition': f'attachment; filename="{document.filename}"'
                    },
                    ExpiresIn=S3_PRESIGNED_EXPIRY,
                    HttpMethod='GET'
                )
            except ClientError as e:
                self.logger.error(f"Failed to generate presigned URL: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate document access URL"
                )

            # Prepare response data
            document_data = {
                'id': str(document.id),
                'filename': document.filename,
                'mime_type': document.mime_type,
                'size_bytes': document.size_bytes,
                'document_type': document.document_type,
                'created_at': document.created_at.isoformat(),
                'download_url': presigned_url
            }

            # Cache the result
            self._cache[cache_key] = {
                'data': document_data,
                'expires': datetime.utcnow() + timedelta(seconds=S3_PRESIGNED_EXPIRY)
            }

            self.logger.info(
                f"Document access granted: {document.id}",
                extra={
                    "document_id": str(document.id),
                    "user_id": str(user_id),
                    "access_type": "download"
                }
            )

            return document_data

        except Exception as e:
            self.logger.error(f"Document retrieval failed: {str(e)}")
            raise

    async def get_request_documents(
        self,
        request_id: UUID,
        user_id: UUID
    ) -> List[Document]:
        """
        Get all documents associated with a prior authorization request.

        Args:
            request_id: Prior authorization request ID
            user_id: User requesting access

        Returns:
            List of document records
        """
        try:
            documents = await self._repository.get_request_documents(
                request_id=request_id,
                accessed_by=user_id
            )

            self.logger.info(
                f"Retrieved {len(documents)} documents for request: {request_id}",
                extra={
                    "request_id": str(request_id),
                    "user_id": str(user_id),
                    "document_count": len(documents)
                }
            )

            return documents

        except Exception as e:
            self.logger.error(f"Failed to retrieve request documents: {str(e)}")
            raise

    async def delete_document(
        self,
        document_id: UUID,
        user_id: UUID,
        deletion_reason: str
    ) -> bool:
        """
        Soft delete document with audit trail.

        Args:
            document_id: Document UUID
            user_id: User performing deletion
            deletion_reason: Reason for deletion

        Returns:
            True if successful

        Raises:
            HTTPException: If deletion fails
        """
        try:
            success = await self._repository.delete_document(
                document_id=document_id,
                deleted_by=user_id,
                deletion_reason=deletion_reason
            )

            if success:
                # Remove from cache
                cache_keys = [k for k in self._cache if k.startswith(f"{document_id}_")]
                for key in cache_keys:
                    self._cache.pop(key, None)

                self.logger.info(
                    f"Document deleted: {document_id}",
                    extra={
                        "document_id": str(document_id),
                        "user_id": str(user_id),
                        "deletion_reason": deletion_reason
                    }
                )

            return success

        except Exception as e:
            self.logger.error(f"Document deletion failed: {str(e)}")
            raise