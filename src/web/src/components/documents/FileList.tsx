import React, { useEffect, useState, useCallback } from 'react';
// react@18.2.0
import { formatDistanceToNow } from 'date-fns';
// date-fns@2.30.0
import { useVirtualizer } from '@tanstack/react-virtual';
// @tanstack/react-virtual@3.0.0

import Button from '../common/Button';
import Icon from '../common/Icon';
import { Document, DocumentType, EncryptionStatus } from '../../types/documents';
import { Size, Variant } from '../../types/common';

/**
 * Props interface for the FileList component
 */
interface FileListProps {
  /** Array of document metadata with encryption status */
  documents: Document[];
  /** Loading state indicator for accessibility */
  loading?: boolean;
  /** Secure document deletion callback with audit logging */
  onDelete: (id: string) => Promise<void>;
  /** Secure document download callback with temporary URL */
  onDownload: (id: string) => Promise<void>;
  /** Optional document type filters */
  filterTypes?: DocumentType[];
  /** Number of documents per page */
  pageSize?: number;
}

/**
 * Maps document types to appropriate icon names with encryption indicators
 */
const getDocumentTypeIcon = (type: DocumentType, encryptionStatus: EncryptionStatus): string => {
  const baseIcon = {
    [DocumentType.CLINICAL_NOTES]: 'notes',
    [DocumentType.LAB_RESULTS]: 'lab',
    [DocumentType.PRESCRIPTION]: 'prescription',
    [DocumentType.MEDICAL_RECORDS]: 'records',
    [DocumentType.IMAGING_RESULTS]: 'imaging',
    [DocumentType.PRIOR_AUTH_FORMS]: 'form'
  }[type];

  // Add encryption status indicator
  const encryptionIndicator = {
    [EncryptionStatus.ENCRYPTED]: '-secure',
    [EncryptionStatus.PENDING]: '-pending',
    [EncryptionStatus.FAILED]: '-warning'
  }[encryptionStatus];

  return `${baseIcon}${encryptionIndicator}`;
};

/**
 * Formats file size in bytes to human readable format
 */
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * A HIPAA-compliant document list component that displays uploaded clinical documents
 * with secure handling, encryption status, and accessibility features.
 */
export const FileList: React.FC<FileListProps> = ({
  documents,
  loading = false,
  onDelete,
  onDownload,
  filterTypes,
  pageSize = 20
}) => {
  // State for filtered documents and loading states
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [activeFilters, setActiveFilters] = useState<DocumentType[]>(filterTypes || []);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  // Virtual scrolling container ref
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Set up virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: filteredDocs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 5
  });

  // Filter documents when filters or documents change
  useEffect(() => {
    const filtered = activeFilters.length > 0
      ? documents.filter(doc => activeFilters.includes(doc.document_type))
      : documents;
    setFilteredDocs(filtered);
  }, [documents, activeFilters]);

  // Secure document deletion handler
  const handleDelete = useCallback(async (id: string) => {
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      await onDelete(id);
    } catch (error) {
      console.error('Error deleting document:', error);
      // Show error notification (implement based on your notification system)
    } finally {
      setDeletingIds(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    }
  }, [onDelete]);

  // Secure document download handler
  const handleDownload = useCallback(async (id: string) => {
    try {
      setDownloadingIds(prev => new Set(prev).add(id));
      await onDownload(id);
    } catch (error) {
      console.error('Error downloading document:', error);
      // Show error notification (implement based on your notification system)
    } finally {
      setDownloadingIds(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
    }
  }, [onDownload]);

  return (
    <div className="w-full" role="region" aria-label="Clinical documents list">
      {/* Filter controls */}
      {filterTypes && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Document type filters">
          {filterTypes.map(type => (
            <Button
              key={type}
              variant={activeFilters.includes(type) ? Variant.PRIMARY : Variant.OUTLINE}
              size={Size.SM}
              onClick={() => setActiveFilters(prev =>
                prev.includes(type)
                  ? prev.filter(t => t !== type)
                  : [...prev, type]
              )}
              aria-pressed={activeFilters.includes(type)}
            >
              {type.replace('_', ' ')}
            </Button>
          ))}
        </div>
      )}

      {/* Virtual scrolling document list */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto border border-gray-200 rounded-lg"
        aria-busy={loading}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const doc = filteredDocs[virtualRow.index];
            const isDeleting = deletingIds.has(doc.id);
            const isDownloading = downloadingIds.has(doc.id);

            return (
              <div
                key={doc.id}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <div className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50">
                  {/* Document icon and info */}
                  <div className="flex items-center space-x-4">
                    <Icon
                      name={getDocumentTypeIcon(doc.document_type, doc.encryption_status)}
                      size={Size.MD}
                      aria-label={`${doc.document_type} - ${doc.encryption_status}`}
                    />
                    <div>
                      <h3 className="font-medium text-gray-900">{doc.filename}</h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(doc.size_bytes)} •{' '}
                        {formatDistanceToNow(new Date(doc.uploaded_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={Variant.OUTLINE}
                      size={Size.SM}
                      onClick={() => handleDownload(doc.id)}
                      disabled={isDownloading || doc.encryption_status !== EncryptionStatus.ENCRYPTED}
                      loading={isDownloading}
                      aria-label={`Download ${doc.filename}`}
                    >
                      <Icon name="download" size={Size.SM} className="mr-1" />
                      Download
                    </Button>
                    <Button
                      variant={Variant.OUTLINE}
                      size={Size.SM}
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeleting}
                      loading={isDeleting}
                      aria-label={`Delete ${doc.filename}`}
                    >
                      <Icon name="delete" size={Size.SM} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {!loading && filteredDocs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No documents found
          {activeFilters.length > 0 && ' matching the selected filters'}
        </div>
      )}
    </div>
  );
};

export default FileList;