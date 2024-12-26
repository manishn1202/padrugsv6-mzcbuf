// @version react@18.2.0
// @version classnames@2.3.2
import React, { useState, useMemo, useCallback } from 'react';
import classNames from 'classnames';
import Table from '../common/Table';
import Badge from '../common/Badge';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';
import { Size } from '../../types/common';

// Constants for queue management
const VIRTUALIZATION_THRESHOLD = 100;
const SLA_WARNING_THRESHOLD = 0.7; // 70% of SLA time
const SLA_CRITICAL_THRESHOLD = 0.9; // 90% of SLA time

interface QueueListProps {
  requests: PriorAuthRequest[];
  loading?: boolean;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  onRequestSelect: (request: PriorAuthRequest) => void;
  virtualizeThreshold?: number;
}

/**
 * Determines badge variant based on request status with accessibility considerations
 */
const getStatusBadgeVariant = (status: PriorAuthStatus): 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case PriorAuthStatus.APPROVED:
      return 'success';
    case PriorAuthStatus.PENDING_INFO:
      return 'warning';
    case PriorAuthStatus.DENIED:
      return 'error';
    default:
      return 'info';
  }
};

/**
 * Calculates priority level using advanced algorithm considering multiple factors
 */
const getPriorityLevel = (request: PriorAuthRequest): { level: string; score: number } => {
  const ageInHours = (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);
  const slaProgress = ageInHours / request.sla_threshold;
  const confidenceImpact = 1 - (request.confidence_score / 100);

  // Calculate weighted priority score
  const score = (slaProgress * 0.6) + (confidenceImpact * 0.4);

  // Determine priority level
  if (score >= SLA_CRITICAL_THRESHOLD) {
    return { level: 'High', score };
  } else if (score >= SLA_WARNING_THRESHOLD) {
    return { level: 'Medium', score };
  }
  return { level: 'Low', score };
};

/**
 * High-performance queue list component for managing prior authorization reviews
 * Implements virtualization, HIPAA compliance, and accessibility features
 */
const QueueList: React.FC<QueueListProps> = ({
  requests,
  loading = false,
  onSort,
  onRequestSelect,
  virtualizeThreshold = VIRTUALIZATION_THRESHOLD,
}) => {
  // Local state for table sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);

  // Memoized table columns configuration
  const columns = useMemo(() => [
    {
      key: 'priority',
      title: 'Priority',
      width: '100px',
      sortable: true,
      accessibilityLabel: 'Request Priority Level',
      render: (_, request: PriorAuthRequest) => {
        const { level } = getPriorityLevel(request);
        const variant = level === 'High' ? 'error' : level === 'Medium' ? 'warning' : 'info';
        return (
          <Badge 
            variant={variant} 
            size={Size.SM}
            ariaLabel={`Priority: ${level}`}
          >
            {level}
          </Badge>
        );
      }
    },
    {
      key: 'requestId',
      title: 'Request ID',
      width: '120px',
      sortable: true,
      isPHI: true,
      render: (_, request: PriorAuthRequest) => (
        <span className="font-mono text-sm">{request.id}</span>
      )
    },
    {
      key: 'drug',
      title: 'Drug',
      width: '150px',
      sortable: true,
      render: (_, request: PriorAuthRequest) => (
        <span>{request.drug.drug_name}</span>
      )
    },
    {
      key: 'provider',
      title: 'Provider',
      width: '150px',
      sortable: true,
      isPHI: true,
      render: (_, request: PriorAuthRequest) => (
        <span>{request.requester.display}</span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      width: '120px',
      sortable: true,
      render: (_, request: PriorAuthRequest) => (
        <Badge 
          variant={getStatusBadgeVariant(request.status)}
          size={Size.SM}
          ariaLabel={`Status: ${request.status}`}
        >
          {request.status}
        </Badge>
      )
    },
    {
      key: 'age',
      title: 'Age',
      width: '100px',
      sortable: true,
      render: (_, request: PriorAuthRequest) => {
        const age = Date.now() - new Date(request.created_at).getTime();
        const hours = Math.floor(age / (1000 * 60 * 60));
        return `${hours}h`;
      }
    },
    {
      key: 'confidence',
      title: 'AI Match',
      width: '100px',
      sortable: true,
      render: (_, request: PriorAuthRequest) => {
        const score = request.confidence_score;
        const variant = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
        return (
          <Badge 
            variant={variant}
            size={Size.SM}
            ariaLabel={`AI Match Score: ${score}%`}
          >
            {`${score}%`}
          </Badge>
        );
      }
    }
  ], []);

  // Handle sort changes
  const handleSort = useCallback((key: string, order: 'asc' | 'desc') => {
    setSortConfig({ key, order });
    onSort?.(key, order);
  }, [onSort]);

  // Handle row click
  const handleRowClick = useCallback((request: PriorAuthRequest) => {
    onRequestSelect(request);
  }, [onRequestSelect]);

  // Memoized row class name generator
  const getRowClassName = useCallback((request: PriorAuthRequest) => {
    const { level } = getPriorityLevel(request);
    return classNames('queue-list-row', {
      'queue-list-row--high-priority': level === 'High',
      'queue-list-row--medium-priority': level === 'Medium',
      'queue-list-row--low-priority': level === 'Low'
    });
  }, []);

  return (
    <div 
      className="queue-list-container"
      role="region"
      aria-label="Prior Authorization Review Queue"
    >
      <Table
        columns={columns}
        data={requests}
        rowKey="id"
        loading={loading}
        sortable
        secure
        virtualized={requests.length > virtualizeThreshold}
        onSort={handleSort}
        onRowClick={handleRowClick}
        rowClassName={getRowClassName}
        emptyMessage="No prior authorization requests in queue"
      />
    </div>
  );
};

QueueList.displayName = 'QueueList';

export default QueueList;