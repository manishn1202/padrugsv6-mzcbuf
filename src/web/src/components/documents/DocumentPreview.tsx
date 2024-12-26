import React, { useEffect, useState, useCallback } from 'react';
import classNames from 'classnames'; // v2.3.2
import { Loading } from '../common/Loading';
import { Button } from '../common/Button';
import { Document, DocumentResponse, DocumentType, SUPPORTED_MIME_TYPES } from '../../types/documents';
import { Variant, Size } from '../../types/common';

// Constants for document preview configuration
const SUPPORTED_PREVIEW_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const PREVIEW_TIMEOUT_MS = 300000; // 5 minutes
const MAX_PREVIEW_SIZE_MB = 50;

interface DocumentPreviewProps {
  /** Document metadata object */
  document: Document;
  /** Optional callback when preview is closed */
  onClose?: () => void;
  /** Optional callback when document is downloaded */
  onDownload?: () => void;
  /** Optional preview session timeout in milliseconds */
  sessionTimeout?: number;
}

/**
 * A secure document preview component that implements HIPAA-compliant viewing
 * of clinical documents with audit logging and access controls.
 */
const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  onClose,
  onDownload,
  sessionTimeout = PREVIEW_TIMEOUT_MS
}) => {
  // Component state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<DocumentResponse | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Security validation checks
  const isPreviewSupported = SUPPORTED_PREVIEW_TYPES.includes(document.mime_type as any);
  const isFileSizeValid = document.size_bytes <= MAX_PREVIEW_SIZE_MB * 1024 * 1024;

  /**
   * Handles secure document download with audit logging
   */
  const handleDownload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Log download attempt in audit trail
      const auditEntry = {
        timestamp: new Date().toISOString(),
        action: 'DOWNLOAD',
        user_id: 'current_user_id', // Should be injected from auth context
        ip_address: 'user_ip', // Should be obtained from request context
        details: `Downloaded document: ${document.filename}`
      };

      // Add download entry to audit trail
      document.audit_trail.push(auditEntry);

      // Trigger download callback if provided
      onDownload?.();

    } catch (err) {
      setError('Failed to download document. Please try again.');
      console.error('Document download error:', err);
    } finally {
      setLoading(false);
    }
  }, [document, onDownload]);

  /**
   * Renders preview content based on document type
   */
  const renderPreviewContent = useCallback(() => {
    if (!previewData?.download_url) return null;

    switch (document.mime_type) {
      case 'application/pdf':
        return (
          <iframe
            src={previewData.download_url}
            className="w-full h-full border-0"
            title={`PDF preview: ${document.filename}`}
            aria-label={`PDF document preview for ${document.filename}`}
            sandbox="allow-scripts allow-same-origin"
          />
        );

      case 'image/jpeg':
      case 'image/png':
        return (
          <img
            src={previewData.download_url}
            alt={`Preview of ${document.filename}`}
            className="max-w-full max-h-full object-contain"
            onError={() => setError('Failed to load image preview')}
          />
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-gray-600 mb-4">
              Preview not available for this file type
            </p>
            <Button
              variant={Variant.PRIMARY}
              size={Size.MD}
              onClick={handleDownload}
              aria-label={`Download ${document.filename}`}
            >
              Download Document
            </Button>
          </div>
        );
    }
  }, [document, previewData, handleDownload]);

  // Initialize preview session
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const initializePreview = async () => {
      try {
        setLoading(true);
        setError(null);

        // Validate preview requirements
        if (!isPreviewSupported) {
          throw new Error('Document type not supported for preview');
        }

        if (!isFileSizeValid) {
          throw new Error('Document size exceeds preview limit');
        }

        // Log preview attempt in audit trail
        const auditEntry = {
          timestamp: new Date().toISOString(),
          action: 'VIEW',
          user_id: 'current_user_id', // Should be injected from auth context
          ip_address: 'user_ip', // Should be obtained from request context
          details: `Previewed document: ${document.filename}`
        };

        document.audit_trail.push(auditEntry);

        // Set session timeout
        timeoutId = setTimeout(() => {
          setSessionExpired(true);
          setPreviewData(null);
        }, sessionTimeout);

        // Mock preview data - in production, this would come from an API
        setPreviewData({
          download_url: 'secure_url',
          expires_in: sessionTimeout / 1000
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize preview');
        console.error('Preview initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializePreview();

    // Cleanup on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [document, sessionTimeout, isPreviewSupported, isFileSizeValid]);

  // Render preview container
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold truncate" title={document.filename}>
            {document.filename}
          </h2>
          <Button
            variant={Variant.TEXT}
            size={Size.SM}
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <Loading
              size="lg"
              overlay
              text="Loading document preview..."
            />
          )}

          {error && (
            <div className="flex flex-col items-center justify-center p-8">
              <p className="text-error mb-4">{error}</p>
              <Button
                variant={Variant.PRIMARY}
                size={Size.MD}
                onClick={handleDownload}
              >
                Download Instead
              </Button>
            </div>
          )}

          {sessionExpired && (
            <div className="flex flex-col items-center justify-center p-8">
              <p className="text-warning mb-4">
                Preview session has expired for security reasons
              </p>
              <Button
                variant={Variant.PRIMARY}
                size={Size.MD}
                onClick={() => window.location.reload()}
              >
                Refresh Preview
              </Button>
            </div>
          )}

          {!loading && !error && !sessionExpired && renderPreviewContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 p-4 border-t">
          <Button
            variant={Variant.SECONDARY}
            size={Size.MD}
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            variant={Variant.PRIMARY}
            size={Size.MD}
            onClick={handleDownload}
          >
            Download
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;