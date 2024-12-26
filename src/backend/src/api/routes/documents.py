"""
FastAPI router for HIPAA-compliant document management endpoints.
Implements secure document upload, retrieval, and listing with comprehensive PHI protection.

Version: 1.0.0
"""

# Standard library imports - Python 3.11+
import uuid
from typing import Optional
from datetime import datetime

# FastAPI imports - version: 0.100.0
from fastapi import (
    APIRouter, 
    Depends, 
    File, 
    UploadFile, 
    HTTPException,
    BackgroundTasks,
    Query
)
from fastapi.responses import StreamingResponse
from fastapi_limiter.depends import RateLimiter

# Internal imports
from api.schemas.documents import DocumentCreate, DocumentResponse, DocumentList
from services.documents import DocumentService
from core.security import SecurityContext
from core.logging import LOGGER
from db.models.documents import DocumentType

# Initialize router
router = APIRouter(prefix="/api/v1/documents", tags=["Documents"])

# Constants
SUPPORTED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]
MAX_FILE_SIZE = 52428800  # 50MB
RATE_LIMIT_UPLOADS = "100/hour"
RATE_LIMIT_DOWNLOADS = "300/hour"

logger = LOGGER.getChild("documents_router")

@router.post("/", 
    response_model=DocumentResponse,
    dependencies=[Depends(RateLimiter(times=100, hours=1))])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    request_id: uuid.UUID = Query(..., description="Prior authorization request ID"),
    document_type: DocumentType = Query(..., description="Type of clinical document"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_dependency)
) -> DocumentResponse:
    """
    Upload and validate a document for a prior authorization request with security scanning.

    Args:
        background_tasks: FastAPI background tasks
        file: Uploaded file
        request_id: Associated prior auth request ID
        document_type: Type of clinical document
        db: Database session
        current_user: Authenticated user information

    Returns:
        DocumentResponse: Created document details with secure download URL

    Raises:
        HTTPException: If validation fails or upload errors occur
    """
    try:
        # Validate file size
        file_size = 0
        contents = await file.read()
        file_size = len(contents)
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed ({MAX_FILE_SIZE} bytes)"
            )

        # Validate mime type
        if file.content_type not in SUPPORTED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}"
            )

        # Initialize document service
        document_service = DocumentService(db)

        # Create document with encryption
        with SecurityContext() as security_ctx:
            encrypted_content = security_ctx.encrypt(contents)
            
            document = await document_service.upload_document(
                file_content=encrypted_content,
                filename=file.filename,
                mime_type=file.content_type,
                document_type=document_type,
                request_id=request_id,
                user_id=current_user["id"]
            )

        # Schedule background virus scan
        background_tasks.add_task(
            document_service.scan_document,
            document.id,
            current_user["id"]
        )

        logger.info(
            f"Document uploaded successfully: {document.id}",
            extra={
                "document_id": str(document.id),
                "request_id": str(request_id),
                "user_id": str(current_user["id"]),
                "file_size": file_size
            }
        )

        return document

    except Exception as e:
        logger.error(
            f"Document upload failed: {str(e)}",
            extra={
                "request_id": str(request_id),
                "user_id": str(current_user["id"]),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to upload document"
        )

@router.get("/{document_id}",
    dependencies=[Depends(RateLimiter(times=300, hours=1))])
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_dependency)
) -> StreamingResponse:
    """
    Securely retrieve a document by ID with access control and audit logging.

    Args:
        document_id: Document UUID
        db: Database session
        current_user: Authenticated user information

    Returns:
        StreamingResponse: Encrypted document stream with proper headers

    Raises:
        HTTPException: If document not found or access denied
    """
    try:
        document_service = DocumentService(db)
        
        # Get document with access validation
        document_data = await document_service.get_document(
            document_id=document_id,
            user_id=current_user["id"]
        )

        # Create streaming response with security headers
        headers = {
            "Content-Type": document_data["mime_type"],
            "Content-Disposition": f'attachment; filename="{document_data["filename"]}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate"
        }

        return StreamingResponse(
            document_data["content"],
            headers=headers,
            media_type=document_data["mime_type"]
        )

    except Exception as e:
        logger.error(
            f"Document retrieval failed: {str(e)}",
            extra={
                "document_id": str(document_id),
                "user_id": str(current_user["id"]),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=404,
            detail="Document not found or access denied"
        )

@router.get("/request/{request_id}",
    response_model=DocumentList)
async def list_request_documents(
    request_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    sort_by: Optional[str] = Query(None, description="Sort field"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user_dependency)
) -> DocumentList:
    """
    List all documents for a prior authorization request with pagination.

    Args:
        request_id: Prior authorization request ID
        page: Page number for pagination
        size: Number of items per page
        sort_by: Field to sort by
        db: Database session
        current_user: Authenticated user information

    Returns:
        DocumentList: Paginated list of documents with metadata

    Raises:
        HTTPException: If request not found or access denied
    """
    try:
        document_service = DocumentService(db)
        
        # Get paginated documents
        documents = await document_service.get_request_documents(
            request_id=request_id,
            user_id=current_user["id"],
            page=page,
            size=size,
            sort_by=sort_by
        )

        logger.info(
            f"Retrieved documents for request: {request_id}",
            extra={
                "request_id": str(request_id),
                "user_id": str(current_user["id"]),
                "page": page,
                "size": size
            }
        )

        return documents

    except Exception as e:
        logger.error(
            f"Failed to list request documents: {str(e)}",
            extra={
                "request_id": str(request_id),
                "user_id": str(current_user["id"]),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=404,
            detail="Request not found or access denied"
        )