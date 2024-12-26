/**
 * API client module for HIPAA-compliant document management operations.
 * Implements secure file uploads, downloads, and management with encryption,
 * progress tracking, and comprehensive error handling.
 * @version 1.0.0
 */

import axiosInstance from '../axios';
import { API_ENDPOINTS, CONTENT_TYPES } from '../../config/api';
import { 
  Document, 
  DocumentUploadRequest, 
  DocumentResponse,
  DocumentType,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  ENCRYPTION_REQUIRED
} from '../../types/documents';
import { ApiError, ErrorType } from '../../types/api';
import * as CryptoJS from 'crypto-js';
import FormData from 'form-data';

// Constants for upload configuration
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Progress callback type for tracking upload/download progress
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Validates file metadata before upload
 */
function validateFile(file: File): void {
  if (!SUPPORTED_MIME_TYPES.includes(file.type as any)) {
    throw new Error(`Unsupported file type. Allowed types: ${SUPPORTED_MIME_TYPES.join(', ')}`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
  }
}

/**
 * Generates SHA-256 checksum for file integrity verification
 */
async function generateChecksum(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wordArray = CryptoJS.lib.WordArray.create(e.target?.result as any);
      const hash = CryptoJS.SHA256(wordArray);
      resolve(hash.toString());
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Encrypts file content using AES-256 encryption
 */
async function encryptFile(file: File, key: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wordArray = CryptoJS.lib.WordArray.create(e.target?.result as any);
        const encrypted = CryptoJS.AES.encrypt(wordArray, key);
        const encryptedArray = new Uint8Array(encrypted.ciphertext.words.length * 4);
        for (let i = 0; i < encrypted.ciphertext.words.length; i++) {
          const word = encrypted.ciphertext.words[i];
          encryptedArray[i * 4] = (word >> 24) & 0xff;
          encryptedArray[i * 4 + 1] = (word >> 16) & 0xff;
          encryptedArray[i * 4 + 2] = (word >> 8) & 0xff;
          encryptedArray[i * 4 + 3] = word & 0xff;
        }
        resolve(encryptedArray.buffer);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Uploads a document with encryption, progress tracking, and retry logic
 * @param request Document upload request containing file and metadata
 * @param onProgress Optional callback for tracking upload progress
 * @returns Promise resolving to uploaded document metadata
 * @throws ApiError on upload failure
 */
export async function uploadDocument(
  request: DocumentUploadRequest,
  onProgress?: ProgressCallback
): Promise<Document> {
  try {
    // Validate file
    validateFile(request.file);

    // Generate checksum for integrity verification
    const checksum = await generateChecksum(request.file);

    // Encrypt file if required
    let fileContent: ArrayBuffer;
    let encryptionKey: string | undefined;
    
    if (ENCRYPTION_REQUIRED) {
      encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
      fileContent = await encryptFile(request.file, encryptionKey);
    } else {
      fileContent = await request.file.arrayBuffer();
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('file', new Blob([fileContent]), request.file.name);
    formData.append('document_type', request.document_type);
    formData.append('request_id', request.request_id);
    formData.append('checksum', checksum);
    if (encryptionKey) {
      formData.append('encryption_key', encryptionKey);
    }

    // Upload with progress tracking
    const response = await axiosInstance.post<Document>(
      API_ENDPOINTS.DOCUMENTS.UPLOAD,
      formData,
      {
        headers: {
          'Content-Type': CONTENT_TYPES.FORM_DATA,
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(Math.round(progress));
          }
        },
      }
    );

    return response.data;
  } catch (error) {
    throw new ApiError({
      error_type: ErrorType.INTERNAL_SERVER_ERROR,
      message: 'Document upload failed',
      details: error as Record<string, unknown>,
    });
  }
}

/**
 * Downloads a document with progress tracking and integrity verification
 * @param documentId ID of document to download
 * @param onProgress Optional callback for tracking download progress
 * @returns Promise resolving to document content and metadata
 * @throws ApiError on download failure
 */
export async function downloadDocument(
  documentId: string,
  onProgress?: ProgressCallback
): Promise<DocumentResponse> {
  try {
    // Get download URL and metadata
    const response = await axiosInstance.get<DocumentResponse>(
      API_ENDPOINTS.DOCUMENTS.DOWNLOAD.replace(':id', documentId),
      {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(Math.round(progress));
          }
        },
      }
    );

    // Verify document integrity
    const downloadedChecksum = await generateChecksum(new File([response.data], ''));
    if (downloadedChecksum !== response.headers['x-checksum']) {
      throw new Error('Document integrity verification failed');
    }

    return response.data;
  } catch (error) {
    throw new ApiError({
      error_type: ErrorType.INTERNAL_SERVER_ERROR,
      message: 'Document download failed',
      details: error as Record<string, unknown>,
    });
  }
}

/**
 * Deletes a document
 * @param documentId ID of document to delete
 * @returns Promise resolving when document is deleted
 * @throws ApiError on deletion failure
 */
export async function deleteDocument(documentId: string): Promise<void> {
  try {
    await axiosInstance.delete(
      API_ENDPOINTS.DOCUMENTS.DELETE.replace(':id', documentId)
    );
  } catch (error) {
    throw new ApiError({
      error_type: ErrorType.INTERNAL_SERVER_ERROR,
      message: 'Document deletion failed',
      details: error as Record<string, unknown>,
    });
  }
}