"""
Repository class for HIPAA-compliant document management in the Prior Authorization Management System.
Implements secure storage, audit trails, and retention policy enforcement.

Version: 1.0.0
"""

# Standard library imports - Python 3.11+
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

# SQLAlchemy imports - v2.0+
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

# Internal imports
from db.models.documents import Document, DocumentType
from core.exceptions import ResourceNotFoundException
from core.logging import LOGGER

class DocumentRepository:
    """
    Repository class for managing document storage and retrieval with HIPAA compliance,
    audit trails, and retention policy enforcement.
    """

    def __init__(self, db_session: AsyncSession):
        """Initialize document repository with database session."""
        self.db_session = db_session
        self.logger = LOGGER.getChild('DocumentRepository')

    async def create_document(
        self,
        filename: str,
        s3_key: str,
        mime_type: str,
        size_bytes: int,
        document_type: DocumentType,
        request_id: UUID,
        uploaded_by: UUID,
        contains_phi: bool = True
    ) -> Document:
        """
        Create a new document record with audit trail and retention policy.

        Args:
            filename: Original filename
            s3_key: S3 storage key
            mime_type: Document MIME type
            size_bytes: File size in bytes
            document_type: Type of clinical document
            request_id: Associated prior auth request ID
            uploaded_by: User ID who uploaded the document
            contains_phi: Whether document contains PHI

        Returns:
            Created Document instance
        """
        try:
            # Create encryption metadata for PHI
            encryption_metadata = {
                "encrypted": contains_phi,
                "encryption_date": datetime.utcnow().isoformat(),
                "encryption_type": "AES-256-GCM" if contains_phi else None
            }

            # Create new document instance
            document = Document(
                filename=filename,
                s3_key=s3_key,
                mime_type=mime_type,
                size_bytes=size_bytes,
                document_type=document_type,
                request_id=request_id,
                uploaded_by=uploaded_by,
                encryption_metadata=encryption_metadata
            )

            self.db_session.add(document)
            await self.db_session.commit()
            await self.db_session.refresh(document)

            self.logger.info(
                f"Document created: {document.id}",
                extra={
                    "document_id": str(document.id),
                    "request_id": str(request_id),
                    "uploaded_by": str(uploaded_by)
                }
            )

            return document

        except Exception as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to create document: {str(e)}",
                extra={"error": str(e)}
            )
            raise

    async def get_document(
        self,
        document_id: UUID,
        accessed_by: UUID,
        access_reason: str
    ) -> Document:
        """
        Retrieve document by ID with access logging and permission validation.

        Args:
            document_id: Document UUID
            accessed_by: User ID accessing the document
            access_reason: Reason for access (audit trail)

        Returns:
            Retrieved Document instance

        Raises:
            ResourceNotFoundException: If document not found
        """
        try:
            query = select(Document).where(
                and_(
                    Document.id == document_id,
                    Document.is_deleted == False,
                    Document.retention_date > datetime.utcnow()
                )
            )
            
            result = await self.db_session.execute(query)
            document = result.scalar_one_or_none()

            if not document:
                raise ResourceNotFoundException(
                    resource_type="Document",
                    resource_id=str(document_id)
                )

            # Update access audit trail
            document.update_last_accessed(accessed_by)
            
            # Log access for HIPAA compliance
            self.logger.info(
                f"Document accessed: {document_id}",
                extra={
                    "document_id": str(document_id),
                    "accessed_by": str(accessed_by),
                    "access_reason": access_reason,
                    "contains_phi": document.encryption_metadata.get("encrypted", False)
                }
            )

            await self.db_session.commit()
            return document

        except ResourceNotFoundException:
            raise
        except Exception as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to retrieve document: {str(e)}",
                extra={"error": str(e)}
            )
            raise

    async def get_request_documents(
        self,
        request_id: UUID,
        accessed_by: UUID
    ) -> List[Document]:
        """
        Get all documents for a prior auth request with access control.

        Args:
            request_id: Prior authorization request ID
            accessed_by: User ID accessing the documents

        Returns:
            List of accessible documents
        """
        try:
            query = select(Document).where(
                and_(
                    Document.request_id == request_id,
                    Document.is_deleted == False,
                    Document.retention_date > datetime.utcnow()
                )
            ).order_by(Document.created_at.desc())

            result = await self.db_session.execute(query)
            documents = result.scalars().all()

            # Update access audit trail for each document
            for doc in documents:
                doc.update_last_accessed(accessed_by)

            await self.db_session.commit()

            self.logger.info(
                f"Retrieved {len(documents)} documents for request: {request_id}",
                extra={
                    "request_id": str(request_id),
                    "accessed_by": str(accessed_by),
                    "document_count": len(documents)
                }
            )

            return documents

        except Exception as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to retrieve request documents: {str(e)}",
                extra={"error": str(e)}
            )
            raise

    async def update_document(
        self,
        document_id: UUID,
        update_data: dict,
        modified_by: UUID
    ) -> Document:
        """
        Update document metadata with versioning and audit trail.

        Args:
            document_id: Document UUID
            update_data: Dictionary of fields to update
            modified_by: User ID making the modification

        Returns:
            Updated Document instance
        """
        try:
            document = await self.get_document(
                document_id=document_id,
                accessed_by=modified_by,
                access_reason="document_update"
            )

            # Only allow updating specific fields
            allowed_fields = {'filename', 'document_type', 'encryption_metadata'}
            update_fields = {
                k: v for k, v in update_data.items() 
                if k in allowed_fields
            }

            # Update document fields
            for field, value in update_fields.items():
                setattr(document, field, value)

            document.updated_at = datetime.utcnow()
            await self.db_session.commit()
            await self.db_session.refresh(document)

            self.logger.info(
                f"Document updated: {document_id}",
                extra={
                    "document_id": str(document_id),
                    "modified_by": str(modified_by),
                    "updated_fields": list(update_fields.keys())
                }
            )

            return document

        except Exception as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to update document: {str(e)}",
                extra={"error": str(e)}
            )
            raise

    async def delete_document(
        self,
        document_id: UUID,
        deleted_by: UUID,
        deletion_reason: str
    ) -> bool:
        """
        Soft delete document with audit trail.

        Args:
            document_id: Document UUID
            deleted_by: User ID performing deletion
            deletion_reason: Reason for deletion (audit trail)

        Returns:
            True if successful
        """
        try:
            document = await self.get_document(
                document_id=document_id,
                accessed_by=deleted_by,
                access_reason="document_deletion"
            )

            # Perform soft delete
            success = document.soft_delete(deleted_by)
            if success:
                # Add deletion metadata
                document.encryption_metadata.update({
                    "deleted_at": datetime.utcnow().isoformat(),
                    "deleted_by": str(deleted_by),
                    "deletion_reason": deletion_reason
                })

                await self.db_session.commit()

                self.logger.info(
                    f"Document deleted: {document_id}",
                    extra={
                        "document_id": str(document_id),
                        "deleted_by": str(deleted_by),
                        "deletion_reason": deletion_reason
                    }
                )

            return success

        except Exception as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to delete document: {str(e)}",
                extra={"error": str(e)}
            )
            raise