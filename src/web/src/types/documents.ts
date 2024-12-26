/**
 * @fileoverview TypeScript type definitions for secure document management in the Prior Authorization Management System.
 * Ensures HIPAA compliance and proper handling of sensitive clinical documents.
 * @version 1.0.0
 */

/**
 * Supported MIME types for document uploads
 * Restricted to common secure document formats
 */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/dicom',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

/**
 * Maximum file size for document uploads (50MB)
 */
export const MAX_FILE_SIZE_BYTES = 52428800;

/**
 * HIPAA compliance requirement for document encryption
 */
export const ENCRYPTION_REQUIRED = true;

/**
 * Document retention period in days (7 years) per HIPAA requirements
 */
export const DOCUMENT_RETENTION_DAYS = 2555;

/**
 * ISO 8601 timestamp pattern for audit trail entries
 */
export const TIMESTAMP_PATTERN = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$';

/**
 * Enumeration of supported clinical document types
 * Ensures proper categorization and handling of different document types
 */
export enum DocumentType {
  CLINICAL_NOTES = 'CLINICAL_NOTES',
  LAB_RESULTS = 'LAB_RESULTS',
  PRESCRIPTION = 'PRESCRIPTION',
  MEDICAL_RECORDS = 'MEDICAL_RECORDS',
  IMAGING_RESULTS = 'IMAGING_RESULTS',
  PRIOR_AUTH_FORMS = 'PRIOR_AUTH_FORMS'
}

/**
 * Enumeration of document encryption statuses
 */
export enum EncryptionStatus {
  PENDING = 'PENDING',
  ENCRYPTED = 'ENCRYPTED',
  FAILED = 'FAILED'
}

/**
 * Interface for audit trail entries
 * Tracks document access and modifications for HIPAA compliance
 */
export interface AuditEntry {
  timestamp: string;
  action: 'UPLOAD' | 'VIEW' | 'DOWNLOAD' | 'DELETE';
  user_id: string;
  ip_address: string;
  details?: string;
}

/**
 * Comprehensive interface for document metadata
 * Includes required fields for HIPAA compliance tracking
 */
export interface Document {
  id: string;
  filename: string;
  document_type: DocumentType;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  request_id: string;
  encryption_status: EncryptionStatus;
  audit_trail: AuditEntry[];
}

/**
 * Interface for document upload requests
 * Ensures proper encryption and validation during upload
 */
export interface DocumentUploadRequest {
  file: File;
  document_type: DocumentType;
  request_id: string;
  encryption_required: boolean;
}

/**
 * Interface for secure document download responses
 * Includes temporary URLs and encryption keys
 */
export interface DocumentResponse {
  download_url: string;
  expires_in: number; // URL expiration time in seconds
  encryption_key?: string;
}

/**
 * Interface for paginated document lists
 * Supports efficient document management and retrieval
 */
export interface DocumentList {
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Type guard to validate supported MIME types
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType as any);
}

/**
 * Type guard to validate ISO 8601 timestamps
 */
export function isValidTimestamp(timestamp: string): boolean {
  const regex = new RegExp(TIMESTAMP_PATTERN);
  return regex.test(timestamp);
}

/**
 * Type guard to validate document size
 */
export function isValidFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE_BYTES;
}