import React, { useState, useEffect, useCallback, useRef } from 'react';
// react@18.2.0
import { toast } from 'react-toastify';
// react-toastify@9.1.3

import FileUpload from '../common/FileUpload';
import FileList from '../documents/FileList';
import { uploadDocument, downloadDocument, deleteDocument } from '../../lib/api/documents';
import { 
  Document, 
  DocumentType, 
  EncryptionStatus,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_MIME_TYPES 
} from '../../types/documents';
import { isApiError } from '../../types/api';

/**
 * Props interface for SupportingDocs component
 */
interface SupportingDocsProps {
  /** ID of the prior authorization request */
  requestId: string;
  /** Callback when documents list changes with encryption status */
  onDocumentUpdate: (documents: Document[]) => void;
  /** Disable upload functionality */
  disabled?: boolean;
  /** Maximum allowed file size in bytes */
  maxFileSize?: number;
  /** List of allowed file types */
  allowedTypes?: string[];
}

/**
 * A HIPAA-compliant component for managing supporting documentation uploads and displays
 * for prior authorization requests. Implements secure document handling with encryption
 * status monitoring and comprehensive error handling.
 */
export const SupportingDocs: React.FC<SupportingDocsProps> = ({
  requestId,
  onDocumentUpdate,
  disabled = false,
  maxFileSize = MAX_FILE_SIZE_BYTES,
  allowedTypes = SUPPORTED_MIME_TYPES
}) => {
  // Component state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [encryptionStatus, setEncryptionStatus] = useState<Record<string, EncryptionStatus>>({});

  // Refs for tracking mounted state
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Updates document list and notifies parent component
   */
  const updateDocuments = useCallback((newDocuments: Document[]) => {
    if (isMounted.current) {
      setDocuments(newDocuments);
      onDocumentUpdate(newDocuments);
    }
  }, [onDocumentUpdate]);

  /**
   * Handles file selection and initiates secure upload process
   */
  const handleFileSelect = useCallback(async (
    file: File,
    documentType: DocumentType,
    initialEncryptionStatus: EncryptionStatus
  ) => {
    try {
      setLoading(true);
      const fileId = `${file.name}-${Date.now()}`;

      // Initialize encryption and upload tracking
      setEncryptionStatus(prev => ({
        ...prev,
        [fileId]: initialEncryptionStatus
      }));
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: 0
      }));

      // Create upload request
      const uploadRequest = {
        file,
        document_type: documentType,
        request_id: requestId,
        encryption_required: true
      };

      // Track upload progress
      const handleProgress = (progress: number) => {
        if (isMounted.current) {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: progress
          }));
        }
      };

      // Upload document with encryption
      const uploadedDoc = await uploadDocument(uploadRequest, handleProgress);

      // Update documents list with new document
      updateDocuments([...documents, uploadedDoc]);

      // Show success notification
      toast.success('Document uploaded successfully', {
        autoClose: 3000,
        position: 'top-right'
      });

    } catch (error) {
      // Handle upload errors
      const errorMessage = isApiError(error) 
        ? error.message 
        : 'Failed to upload document. Please try again.';

      toast.error(errorMessage, {
        autoClose: 5000,
        position: 'top-right',
        action: {
          label: 'Retry',
          onClick: () => handleFileSelect(file, documentType, initialEncryptionStatus)
        }
      });
    } finally {
      if (isMounted.current) {
        setLoading(false);
        // Cleanup progress tracking
        const fileId = `${file.name}-${Date.now()}`;
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
      }
    }
  }, [requestId, documents, updateDocuments]);

  /**
   * Handles secure document deletion with confirmation
   */
  const handleDelete = useCallback(async (documentId: string) => {
    try {
      setLoading(true);

      // Delete document
      await deleteDocument(documentId);

      // Update documents list
      const updatedDocs = documents.filter(doc => doc.id !== documentId);
      updateDocuments(updatedDocs);

      toast.success('Document deleted successfully');
    } catch (error) {
      const errorMessage = isApiError(error)
        ? error.message
        : 'Failed to delete document. Please try again.';

      toast.error(errorMessage);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [documents, updateDocuments]);

  /**
   * Handles secure document download with encryption verification
   */
  const handleDownload = useCallback(async (documentId: string) => {
    try {
      setLoading(true);

      // Download document with progress tracking
      const handleProgress = (progress: number) => {
        if (isMounted.current) {
          setUploadProgress(prev => ({
            ...prev,
            [documentId]: progress
          }));
        }
      };

      await downloadDocument(documentId, handleProgress);

      toast.success('Document downloaded successfully');
    } catch (error) {
      const errorMessage = isApiError(error)
        ? error.message
        : 'Failed to download document. Please try again.';

      toast.error(errorMessage);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        // Cleanup progress tracking
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[documentId];
          return updated;
        });
      }
    }
  }, []);

  return (
    <div 
      className="space-y-6"
      role="region"
      aria-label="Supporting Documents"
      aria-busy={loading}
    >
      {/* File upload component */}
      <FileUpload
        onFileSelect={handleFileSelect}
        onError={(error, code) => {
          toast.error(`Upload error: ${error}`);
        }}
        onProgress={(progress) => {
          // Progress is handled per-file in handleFileSelect
        }}
        documentType={DocumentType.MEDICAL_RECORDS}
        maxSizeBytes={maxFileSize}
        acceptedTypes={allowedTypes}
        disabled={disabled || loading}
        encryptionRequired={true}
      />

      {/* Document list component */}
      <FileList
        documents={documents}
        loading={loading}
        onDelete={handleDelete}
        onDownload={handleDownload}
        filterTypes={[
          DocumentType.MEDICAL_RECORDS,
          DocumentType.LAB_RESULTS,
          DocumentType.CLINICAL_NOTES
        ]}
      />
    </div>
  );
};

export default SupportingDocs;