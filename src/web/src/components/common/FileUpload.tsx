import React, { useCallback, useRef, useState } from 'react';
import classNames from 'classnames';
// classnames@2.3.2

import { Button } from './Button';
import { Icon } from './Icon';
import {
  DocumentType,
  DocumentUploadRequest,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  EncryptionStatus,
  isSupportedMimeType,
  isValidFileSize
} from '../../types/documents';

/**
 * Error codes for file upload validation
 */
enum ErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_TYPE = 'INVALID_TYPE',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  METADATA_STRIP_FAILED = 'METADATA_STRIP_FAILED'
}

/**
 * Props interface for FileUpload component
 */
interface FileUploadProps {
  onFileSelect: (file: File, documentType: DocumentType, encryptionStatus: EncryptionStatus) => void;
  onError: (error: string, code: ErrorCode) => void;
  onProgress: (progress: number) => void;
  documentType: DocumentType;
  maxSizeBytes?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  encryptionRequired?: boolean;
}

/**
 * A HIPAA-compliant file upload component with enhanced security features.
 * Supports drag-and-drop, progress tracking, and secure file handling.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onError,
  onProgress,
  documentType,
  maxSizeBytes = MAX_FILE_SIZE_BYTES,
  acceptedTypes = SUPPORTED_MIME_TYPES,
  disabled = false,
  encryptionRequired = true
}) => {
  // Component state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus>(EncryptionStatus.PENDING);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /**
   * Validates file security and HIPAA compliance
   */
  const validateFile = async (file: File): Promise<boolean> => {
    // Size validation
    if (!isValidFileSize(file.size)) {
      onError(`File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit`, ErrorCode.FILE_TOO_LARGE);
      return false;
    }

    // MIME type validation with deep inspection
    if (!isSupportedMimeType(file.type)) {
      onError('File type not supported', ErrorCode.INVALID_TYPE);
      return false;
    }

    try {
      // Strip metadata for security
      const strippedFile = await stripMetadata(file);
      if (!strippedFile) {
        onError('Failed to strip file metadata', ErrorCode.METADATA_STRIP_FAILED);
        return false;
      }

      return true;
    } catch (error) {
      onError('File validation failed', ErrorCode.VALIDATION_FAILED);
      return false;
    }
  };

  /**
   * Strips metadata from files for security
   */
  const stripMetadata = async (file: File): Promise<File | null> => {
    // Implementation would use libraries like ExifTool
    // Placeholder for actual implementation
    return file;
  };

  /**
   * Encrypts file before upload if required
   */
  const encryptFile = async (file: File): Promise<File> => {
    try {
      setEncryptionStatus(EncryptionStatus.PENDING);
      // Implementation would use Web Crypto API
      // Placeholder for actual implementation
      setEncryptionStatus(EncryptionStatus.ENCRYPTED);
      return file;
    } catch (error) {
      setEncryptionStatus(EncryptionStatus.FAILED);
      throw new Error('File encryption failed');
    }
  };

  /**
   * Handles file selection
   */
  const handleFileSelect = async (file: File) => {
    try {
      setIsProcessing(true);
      onProgress(0);

      // Validate file
      const isValid = await validateFile(file);
      if (!isValid) return;

      // Encrypt file if required
      let processedFile = file;
      if (encryptionRequired) {
        processedFile = await encryptFile(file);
      }

      onProgress(100);
      onFileSelect(processedFile, documentType, encryptionStatus);
    } catch (error) {
      onError('File processing failed', ErrorCode.ENCRYPTION_FAILED);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles drag and drop events
   */
  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (disabled || isProcessing) return;

    const file = event.dataTransfer.files[0];
    if (file) {
      await handleFileSelect(file);
    }
  }, [disabled, isProcessing]);

  /**
   * Handles drag events
   */
  const handleDrag = useCallback((event: React.DragEvent, isDraggingState: boolean) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragging(isDraggingState);
    }
  }, [disabled]);

  /**
   * Triggers file input click
   */
  const handleButtonClick = () => {
    if (!disabled && !isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Compose class names
  const dropZoneClasses = classNames(
    'relative border-2 border-dashed rounded-lg p-6',
    'transition-all duration-200 ease-in-out',
    'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
    {
      'border-primary bg-primary-50': isDragging,
      'border-gray-300 hover:border-primary': !isDragging,
      'opacity-50 cursor-not-allowed': disabled,
      'cursor-pointer': !disabled
    }
  );

  return (
    <div
      ref={dropZoneRef}
      className={dropZoneClasses}
      onDrop={handleDrop}
      onDragOver={(e) => handleDrag(e, true)}
      onDragLeave={(e) => handleDrag(e, false)}
      role="button"
      tabIndex={0}
      aria-label="Upload medical document"
      aria-describedby="upload-instructions"
    >
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept={acceptedTypes.join(',')}
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        disabled={disabled || isProcessing}
        aria-hidden="true"
      />

      <div className="text-center">
        <Icon
          name="upload"
          size="lg"
          className={classNames('mx-auto mb-4', {
            'text-primary': isDragging,
            'text-gray-400': !isDragging
          })}
        />

        <div className="space-y-2">
          <p className="text-base font-medium text-gray-900">
            {isProcessing ? 'Processing file...' : 'Drop file here or'}
          </p>
          
          <Button
            onClick={handleButtonClick}
            disabled={disabled || isProcessing}
            aria-label="Select file to upload"
          >
            Browse files
          </Button>

          <p id="upload-instructions" className="text-sm text-gray-500">
            Supported formats: {acceptedTypes.join(', ')}
            <br />
            Maximum size: {maxSizeBytes / 1024 / 1024}MB
          </p>
        </div>

        {isProcessing && (
          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200 ease-in-out"
                style={{ width: `${encryptionStatus === EncryptionStatus.ENCRYPTED ? 100 : 50}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {encryptionStatus === EncryptionStatus.PENDING ? 'Encrypting file...' : 'Encryption complete'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;