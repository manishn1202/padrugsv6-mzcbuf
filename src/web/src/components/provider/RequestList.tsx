// @version react@18.2.0
// @version react-redux@8.0.5
// @version date-fns@2.30.0
// @version @tanstack/react-virtual@3.0.0
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { format } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import Table from '../common/Table';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';

// Constants for performance optimization
const CACHE_TTL = 300000; // 5 minutes
const ROW_HEIGHT = 48;
const DEFAULT_PAGE_SIZE = 10;

interface RequestListProps {
  pageSize?: number;
  onRequestClick?: (request: PriorAuthRequest) => void;
  cacheTimeout?: number;
  showPHI?: boolean;
}

/**
 * RequestList Component
 * Displays a secure, high-performance table of prior authorization requests
 * with real-time updates and PHI protection
 * 
 * @version 1.0.0
 * @security HIPAA-compliant PHI handling
 * @accessibility WCAG 2.1 AA compliant
 */
const RequestList: React.FC<RequestListProps> = ({
  pageSize = DEFAULT_PAGE_SIZE,
  onRequestClick,
  cacheTimeout = CACHE_TTL,
  showPHI = false,
}) => {
  // Redux state management
  const dispatch = useDispatch();
  const requests = useSelector((state: any) => state.priorAuth.requests);
  const loading = useSelector((state: any) => state.priorAuth.loading);
  const totalItems = useSelector((state: any) => state.priorAuth.totalItems);

  // Local state management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Cache invalidation timer
  useEffect(() => {
    const cacheTimer = setInterval(() => {
      dispatch({ type: 'INVALIDATE_REQUEST_CACHE' });
    }, cacheTimeout);

    return () => clearInterval(cacheTimer);
  }, [cacheTimeout, dispatch]);

  // Table columns configuration with PHI protection
  const columns = useMemo(() => [
    {
      key: 'created_at',
      title: 'Date',
      width: '150px',
      sortable: true,
      render: (value: Date) => format(new Date(value), 'MM/dd/yyyy HH:mm'),
    },
    {
      key: 'patient_last_name',
      title: 'Patient',
      width: '200px',
      sortable: true,
      isPHI: true,
      render: (value: string, record: PriorAuthRequest) => showPHI ? 
        `${record.patient_last_name}, ${record.patient_first_name}` :
        '*** Protected ***',
    },
    {
      key: 'drug',
      title: 'Medication',
      width: '200px',
      sortable: true,
      render: (value: any) => value.drug_name,
    },
    {
      key: 'status',
      title: 'Status',
      width: '150px',
      sortable: true,
      render: (value: PriorAuthStatus) => (
        <span className={`status-badge status-${value.toLowerCase()}`}>
          {value.replace('_', ' ')}
        </span>
      ),
    },
  ], [showPHI]);

  // Handle sort changes
  const handleSort = useCallback((field: string, order: 'asc' | 'desc') => {
    setSortField(field);
    setSortOrder(order);
    dispatch({
      type: 'FETCH_REQUESTS',
      payload: { page: currentPage, sortField: field, sortOrder: order },
    });
  }, [currentPage, dispatch]);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    dispatch({
      type: 'FETCH_REQUESTS',
      payload: { page, sortField, sortOrder },
    });
  }, [sortField, sortOrder, dispatch]);

  // Handle row clicks with optimistic UI updates
  const handleRowClick = useCallback((request: PriorAuthRequest) => {
    if (onRequestClick && !loadingStates[request.id]) {
      setLoadingStates(prev => ({ ...prev, [request.id]: true }));
      
      // Optimistic UI update
      dispatch({
        type: 'UPDATE_REQUEST_STATUS',
        payload: { id: request.id, status: 'IN_REVIEW' },
      });

      onRequestClick(request);
      
      // Reset loading state after delay
      setTimeout(() => {
        setLoadingStates(prev => ({ ...prev, [request.id]: false }));
      }, 500);
    }
  }, [onRequestClick, loadingStates, dispatch]);

  // Real-time status update subscription
  useEffect(() => {
    const statusSubscription = dispatch({
      type: 'SUBSCRIBE_TO_STATUS_UPDATES',
      payload: { pageSize, currentPage },
    });

    return () => {
      dispatch({
        type: 'UNSUBSCRIBE_FROM_STATUS_UPDATES',
        payload: statusSubscription,
      });
    };
  }, [pageSize, currentPage, dispatch]);

  // Audit logging for PHI access
  useEffect(() => {
    if (showPHI) {
      dispatch({
        type: 'LOG_PHI_ACCESS',
        payload: {
          component: 'RequestList',
          action: 'VIEW',
          timestamp: new Date(),
        },
      });
    }
  }, [showPHI, dispatch]);

  return (
    <div 
      className="request-list-container"
      data-testid="request-list"
      onCopy={showPHI ? undefined : (e) => e.preventDefault()}
    >
      <Table
        columns={columns}
        data={requests}
        rowKey="id"
        pageSize={pageSize}
        currentPage={currentPage}
        totalItems={totalItems}
        loading={loading}
        sortable={true}
        secure={!showPHI}
        virtualized={true}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onRowClick={handleRowClick}
        rowClassName={(record) => 
          loadingStates[record.id] ? 'row-loading' : ''
        }
        emptyMessage="No prior authorization requests found"
      />
    </div>
  );
};

export default React.memo(RequestList);