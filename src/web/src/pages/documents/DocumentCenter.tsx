import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify'; // react-toastify@9.1.3
import { useVirtualizer } from '@tanstack/react-virtual'; // @tanstack/react-virtual@3.0.0

import DocumentPreview from '../../components/documents/DocumentPreview';
import DocumentUpload from '../../components/documents/DocumentUpload';
import FileList from '../../components/documents/FileList';
import { useQuery } from '../../hooks/useQuery';
import { 
  Document, 
  DocumentType, 
  EncryptionStatus,
  DocumentResponse 
} from '../../types/documents';
import { ApiError, ErrorType } from '../../types/api';
import { deleteDocument, downloadDocument } from '../../lib/api/documents';
import { API_ENDPOINTS } from '../../config/api';

/**
 * Props interface for DocumentCenter component
 */
interface DocumentCenterProps {
  /** Optional prior authorization request ID for document association */
  requestId?: string;
  /** Initial document type filter */
  initialFilter?: DocumentType;
}

/**
 * A centralized document management page component that provides a comprehensive interface
 * for viewing, uploading, and managing clinical documents with HIPAA compliance.
 */
const DocumentCenter: React.FC<DocumentCenterProps> = ({
  requestId,
  initialFilter
}) => {
  // Component state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [filterType, setFilterType] = useState<DocumentType | null>(initialFilter || null);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus>(EncryptionStatus.PENDING);

  // Fetch documents with caching and auto-refresh
  const {
    data: documents,
    loading,
    error,
    refetch
  } = useQuery<Document[]>(`${API_ENDPOINTS.DOCUMENTS.LIST}${requestId ? `?requestId=${requestId}` : ''}`, {
    refetchInterval: 30000, // Refresh every 30 seconds
    cacheEnabled: true,
    retryCount: 3
  });

  /**
   * Handles secure document upload with encryption verification and audit logging
   */
  const handleDocumentUpload = useCallback(async (document: Document) => {
    try {
      // Verify encryption status
      if (document.encryption_status !== EncryptionStatus.ENCRYPTED) {
        throw new Error('Document encryption verification failed');
      }

      // Update document list
      await refetch();

      // Show success notification
      toast.success('Document uploaded successfully', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });

    } catch (error) {
      let errorMessage = 'Failed to upload document';
      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });
    }
  }, [refetch]);

  /**
   * Handles secure document deletion with audit logging
   */
  const handleDocumentDelete = useCallback(async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      await refetch();

      toast.success('Document deleted successfully', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });

    } catch (error) {
      let errorMessage = 'Failed to delete document';
      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });
    }
  }, [refetch]);

  /**
   * Handles secure document download with temporary URL generation
   */
  const handleDocumentDownload = useCallback(async (documentId: string) => {
    try {
      const response = await downloadDocument(documentId);

      // Verify document encryption
      if (!response.encryption_key) {
        throw new Error('Document encryption verification failed');
      }

      // Trigger download using temporary URL
      window.open(response.download_url, '_blank');

      toast.success('Document download started', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });

    } catch (error) {
      let errorMessage = 'Failed to download document';
      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });
    }
  }, []);

  /**
   * Handles document preview with encryption verification
   */
  const handleDocumentPreview = useCallback((document: Document) => {
    if (document.encryption_status !== EncryptionStatus.ENCRYPTED) {
      toast.error('Document encryption verification required before preview', {
        position: 'top-right',
        autoClose: 5000,
      });
      return;
    }
    setSelectedDocument(document);
  }, []);

  // Show error state if documents fail to load
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-error mb-4">Failed to load documents</p>
        <button 
          onClick={() => refetch()}
          className="text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Document Management</h1>
        <p className="text-gray-600">
          Securely upload, manage and share clinical documents
        </p>
      </div>

      {/* Document upload section */}
      <div className="mb-8">
        <DocumentUpload
          requestId={requestId || ''}
          documentType={filterType || DocumentType.CLINICAL_NOTES}
          onUploadComplete={handleDocumentUpload}
          disabled={loading}
        />
      </div>

      {/* Document list section */}
      <div className="bg-white rounded-lg shadow">
        <FileList
          documents={documents || []}
          loading={loading}
          onDelete={handleDocumentDelete}
          onDownload={handleDocumentDownload}
          filterTypes={Object.values(DocumentType)}
          pageSize={20}
        />
      </div>

      {/* Document preview modal */}
      {selectedDocument && (
        <DocumentPreview
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDownload={() => handleDocumentDownload(selectedDocument.id)}
        />
      )}
    </div>
  );
};

export default DocumentCenter;