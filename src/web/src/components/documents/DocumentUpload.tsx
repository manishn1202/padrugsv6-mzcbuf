import React, { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
// react-toastify@9.1.3
import ClamAV from '@djadmin/clamav-client';
// @djadmin/clamav-client@1.2.0

import { FileUpload } from '../common/FileUpload';
import { uploadDocument } from '../../lib/api/documents';
import { 
  Document,
  DocumentType,
  EncryptionStatus,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  AuditEntry
} from '../../types/documents';
import { ApiError, ErrorType } from '../../types/api';

/**
 * Props interface for DocumentUpload component with enhanced security features
 */
interface DocumentUploadProps {
  /** ID of the prior authorization request */
  requestId: string;
  /** Type of clinical document being uploaded */
  documentType: DocumentType;
  /** Callback when upload is complete */
  onUploadComplete: (document: Document) => void;
  /** Disable upload functionality */
  disabled?: boolean;
  /** Maximum allowed file size in bytes */
  maxFileSize?: number;
  /** List of allowed MIME types */
  allowedMimeTypes?: string[];
}

/**
 * A specialized document upload component for handling clinical document uploads
 * with HIPAA compliance, encryption verification, and security controls.
 */
export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  requestId,
  documentType,
  onUploadComplete,
  disabled = false,
  maxFileSize = MAX_FILE_SIZE_BYTES,
  allowedMimeTypes = SUPPORTED_MIME_TYPES
}) => {
  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Creates an audit entry for document operations
   */
  const createAuditEntry = (action: 'UPLOAD' | 'ERROR', details?: string): AuditEntry => {
    return {
      timestamp: new Date().toISOString(),
      action,
      user_id: 'current-user-id', // Would come from auth context
      ip_address: window.location.hostname,
      details
    };
  };

  /**
   * Performs virus scan on file before upload
   */
  const scanFile = async (file: File): Promise<boolean> => {
    try {
      const clamav = new ClamAV({
        removeInfected: true,
        quarantineInfected: true,
        scanLog: true
      });
      
      const scanResult = await clamav.scanFile(file);
      return scanResult.isClean;
    } catch (error) {
      console.error('Virus scan failed:', error);
      return false;
    }
  };

  /**
   * Handles file selection with enhanced security validation
   */
  const handleFileSelect = useCallback(async (
    file: File,
    encryptionStatus: EncryptionStatus
  ) => {
    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Create audit entry for upload attempt
      const auditEntry = createAuditEntry('UPLOAD', `Attempting upload of ${file.name}`);

      // Perform virus scan
      const isClean = await scanFile(file);
      if (!isClean) {
        throw new Error('File failed virus scan');
      }

      // Create upload request
      const uploadRequest = {
        file,
        document_type: documentType,
        request_id: requestId,
        encryption_required: true
      };

      // Upload file with progress tracking
      const uploadedDocument = await uploadDocument(uploadRequest, (progress) => {
        setUploadProgress(progress);
      });

      // Verify encryption status
      if (encryptionStatus !== EncryptionStatus.ENCRYPTED) {
        throw new Error('File encryption verification failed');
      }

      // Update audit trail and notify success
      auditEntry.details = `Successfully uploaded ${file.name}`;
      uploadedDocument.audit_trail = [auditEntry];

      onUploadComplete(uploadedDocument);
      toast.success('Document uploaded successfully', {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
      });

    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  }, [requestId, documentType, onUploadComplete]);

  /**
   * Handles file validation and security errors
   */
  const handleError = (error: unknown) => {
    // Create audit entry for error
    const auditEntry = createAuditEntry('ERROR', 
      error instanceof Error ? error.message : 'Unknown error during upload'
    );

    // Format error message based on type
    let errorMessage = 'An error occurred during upload';
    if (error instanceof ApiError) {
      switch (error.error_type) {
        case ErrorType.VALIDATION_ERROR:
          errorMessage = 'File validation failed';
          break;
        case ErrorType.INTERNAL_SERVER_ERROR:
          errorMessage = 'Server error during upload';
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Show error notification
    toast.error(errorMessage, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
    });

    // Log error to console for debugging
    console.error('Document upload error:', error);
  };

  return (
    <div
      role="region"
      aria-label="Clinical document upload"
      aria-busy={isLoading}
    >
      <FileUpload
        onFileSelect={handleFileSelect}
        onError={handleError}
        onProgress={setUploadProgress}
        documentType={documentType}
        maxSizeBytes={maxFileSize}
        acceptedTypes={allowedMimeTypes}
        disabled={disabled || isLoading}
        encryptionRequired={true}
      />

      {isLoading && (
        <div 
          className="mt-4" 
          role="progressbar" 
          aria-valuenow={uploadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200 ease-in-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Uploading document... {uploadProgress}%
          </p>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;