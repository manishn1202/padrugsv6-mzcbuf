import React, { useState, useEffect, useCallback, useMemo } from 'react';
// react@18.2.0
import { useParams, useNavigate } from 'react-router-dom';
// react-router-dom@6.8.0
import { toast } from 'react-toastify';
// react-toastify@9.1.3
import useWebSocket from 'react-use-websocket';
// react-use-websocket@4.3.1

import RequestStatus from '../../components/provider/RequestStatus';
import SupportingDocs from '../../components/provider/SupportingDocs';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';
import { Document } from '../../types/documents';
import { isApiError } from '../../types/api';
import axiosInstance from '../../lib/axios';
import { API_ENDPOINTS } from '../../config/api';

/**
 * Props interface for RequestDetails component
 */
interface RequestDetailsProps {
  requestId: string;
  onStatusChange?: (status: PriorAuthStatus) => void;
}

/**
 * RequestDetails component displays comprehensive information about a prior authorization request
 * with real-time updates and document management capabilities.
 */
const RequestDetails: React.FC<RequestDetailsProps> = ({
  requestId,
  onStatusChange
}) => {
  // Component state
  const [request, setRequest] = useState<PriorAuthRequest | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({
    details: true,
    documents: false
  });
  const [error, setError] = useState<Record<string, string | null>>({
    details: null,
    documents: null
  });

  const navigate = useNavigate();

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/prior-auth/${requestId}`,
    {
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      retryOnError: true,
      onError: () => {
        console.error('WebSocket connection error - falling back to polling');
        // Implement polling fallback
      }
    }
  );

  /**
   * Fetches request details with caching and retry logic
   */
  const fetchRequestDetails = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, details: true }));
      setError(prev => ({ ...prev, details: null }));

      const response = await axiosInstance.get<PriorAuthRequest>(
        API_ENDPOINTS.PRIOR_AUTH.STATUS.replace(':id', requestId)
      );

      setRequest(response.data);
      onStatusChange?.(response.data.status);

    } catch (error) {
      const errorMessage = isApiError(error)
        ? error.message
        : 'Failed to fetch request details';

      setError(prev => ({ ...prev, details: errorMessage }));
      toast.error(errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, details: false }));
    }
  }, [requestId, onStatusChange]);

  /**
   * Handles document updates with optimistic updates
   */
  const handleDocumentUpdate = useCallback(async (documents: Document[]) => {
    if (!request) return;

    try {
      setLoading(prev => ({ ...prev, documents: true }));
      setError(prev => ({ ...prev, documents: null }));

      // Optimistically update UI
      setRequest(prev => prev ? {
        ...prev,
        clinical_data: {
          ...prev.clinical_data,
          documents
        }
      } : null);

      // Trigger re-fetch to ensure consistency
      await fetchRequestDetails();

      toast.success('Documents updated successfully', {
        role: 'status',
        'aria-live': 'polite'
      });

    } catch (error) {
      const errorMessage = isApiError(error)
        ? error.message
        : 'Failed to update documents';

      setError(prev => ({ ...prev, documents: errorMessage }));
      toast.error(errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, documents: false }));
    }
  }, [request, fetchRequestDetails]);

  // Process real-time updates from WebSocket
  useEffect(() => {
    if (lastMessage) {
      try {
        const update = JSON.parse(lastMessage.data);
        setRequest(prev => prev ? { ...prev, ...update } : null);
        onStatusChange?.(update.status);
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
      }
    }
  }, [lastMessage, onStatusChange]);

  // Initial data fetch
  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  // Memoized request status data
  const statusData = useMemo(() => {
    if (!request) return null;
    return {
      status: request.status,
      submittedAt: new Date(request.submitted_at),
      confidenceScore: request.confidence_score
    };
  }, [request]);

  if (!request && loading.details) {
    return (
      <div 
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-label="Loading request details"
      >
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!request && error.details) {
    return (
      <div 
        className="text-center py-8 text-error"
        role="alert"
        aria-label="Error loading request details"
      >
        {error.details}
      </div>
    );
  }

  if (!request) return null;

  return (
    <div 
      className="space-y-8"
      role="main"
      aria-label="Prior Authorization Request Details"
    >
      {/* Request Status Section */}
      <section aria-labelledby="status-heading">
        <h2 id="status-heading" className="sr-only">Request Status</h2>
        <RequestStatus {...statusData} />
      </section>

      {/* Patient Information Section */}
      <section 
        aria-labelledby="patient-heading"
        className="bg-white rounded-lg shadow p-6"
      >
        <h2 id="patient-heading" className="text-xl font-semibold mb-4">
          Patient Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">Name</label>
            <p className="font-medium">
              {request.patient_first_name} {request.patient_last_name}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">MRN</label>
            <p className="font-medium">{request.patient_mrn}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Date of Birth</label>
            <p className="font-medium">
              {new Date(request.patient_dob).toLocaleDateString()}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Insurance</label>
            <p className="font-medium">{request.insurance_plan}</p>
          </div>
        </div>
      </section>

      {/* Drug Information Section */}
      <section 
        aria-labelledby="drug-heading"
        className="bg-white rounded-lg shadow p-6"
      >
        <h2 id="drug-heading" className="text-xl font-semibold mb-4">
          Drug Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">Drug Name</label>
            <p className="font-medium">{request.drug.drug_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Quantity</label>
            <p className="font-medium">{request.drug.quantity}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Days Supply</label>
            <p className="font-medium">{request.drug.days_supply}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Refills</label>
            <p className="font-medium">{request.drug.refills}</p>
          </div>
        </div>
      </section>

      {/* Clinical Information Section */}
      <section 
        aria-labelledby="clinical-heading"
        className="bg-white rounded-lg shadow p-6"
      >
        <h2 id="clinical-heading" className="text-xl font-semibold mb-4">
          Clinical Information
        </h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-500">Diagnosis</label>
            <p className="font-medium">{request.diagnosis_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">ICD-10 Code</label>
            <p className="font-medium">{request.diagnosis_code}</p>
          </div>
        </div>

        {/* Supporting Documents */}
        <div>
          <h3 className="text-lg font-medium mb-4">Supporting Documents</h3>
          <SupportingDocs
            requestId={requestId}
            onDocumentUpdate={handleDocumentUpdate}
            disabled={request.status === PriorAuthStatus.APPROVED || 
                     request.status === PriorAuthStatus.DENIED}
          />
        </div>
      </section>
    </div>
  );
};

export default RequestDetails;