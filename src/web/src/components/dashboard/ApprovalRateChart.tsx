import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Tooltip } from '@mui/material'; // @version 5.14.0
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { fetchPriorAuthList, selectPriorAuthMetrics } from '../../store/priorAuth/priorAuthSlice';
import { PriorAuthStatus } from '../../types/priorAuth';

/**
 * Props for the ApprovalRateChart component
 */
interface ApprovalRateChartProps {
  /** Time period for approval rate calculation */
  period?: 'daily' | 'weekly' | 'monthly';
  /** Optional additional CSS classes */
  className?: string;
  /** Toggle trend indicators display */
  showTrends?: boolean;
  /** Enable metric export functionality */
  enableExport?: boolean;
}

/**
 * Interface for approval rate metrics with trends
 */
interface ApprovalMetrics {
  overallRate: number;
  firstPassRate: number;
  totalRequests: number;
  trends: {
    overall: number;
    firstPass: number;
  };
}

/**
 * Calculates approval rate metrics with trend analysis from prior auth requests
 */
const calculateApprovalMetrics = React.useCallback((requests: any[], period: string): ApprovalMetrics => {
  // Filter requests based on time period
  const now = new Date();
  const periodStart = new Date();
  switch (period) {
    case 'daily':
      periodStart.setDate(now.getDate() - 1);
      break;
    case 'weekly':
      periodStart.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      periodStart.setMonth(now.getMonth() - 1);
      break;
  }

  const filteredRequests = requests.filter(req => 
    new Date(req.created_at) >= periodStart
  );

  // Calculate metrics
  const totalRequests = filteredRequests.length;
  const approvedRequests = filteredRequests.filter(
    req => req.status === PriorAuthStatus.APPROVED
  ).length;
  const firstPassApprovals = filteredRequests.filter(
    req => req.status === PriorAuthStatus.APPROVED && !req.clinical_data.evidence
  ).length;

  // Calculate rates
  const overallRate = totalRequests ? (approvedRequests / totalRequests) * 100 : 0;
  const firstPassRate = totalRequests ? (firstPassApprovals / totalRequests) * 100 : 0;

  // Calculate trends (compare with previous period)
  const previousPeriodStart = new Date(periodStart);
  switch (period) {
    case 'daily':
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      break;
    case 'weekly':
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      break;
    case 'monthly':
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      break;
  }

  const previousRequests = requests.filter(req =>
    new Date(req.created_at) >= previousPeriodStart &&
    new Date(req.created_at) < periodStart
  );

  const previousOverallRate = previousRequests.length ?
    (previousRequests.filter(req => req.status === PriorAuthStatus.APPROVED).length / previousRequests.length) * 100 : 0;
  const previousFirstPassRate = previousRequests.length ?
    (previousRequests.filter(req => req.status === PriorAuthStatus.APPROVED && !req.clinical_data.evidence).length / previousRequests.length) * 100 : 0;

  return {
    overallRate,
    firstPassRate,
    totalRequests,
    trends: {
      overall: overallRate - previousOverallRate,
      firstPass: firstPassRate - previousFirstPassRate
    }
  };
}, []);

/**
 * Component that displays approval rate metrics and trends with interactive features
 */
const ApprovalRateChart: React.FC<ApprovalRateChartProps> = ({
  period = 'monthly',
  className,
  showTrends = true,
  enableExport = false
}) => {
  const dispatch = useDispatch();
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const requests = useSelector(selectPriorAuthMetrics);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on mount and period change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await dispatch(fetchPriorAuthList());
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dispatch, selectedPeriod]);

  // Calculate metrics using memoization
  const metrics = useMemo(() => 
    calculateApprovalMetrics(requests, selectedPeriod),
    [requests, selectedPeriod, calculateApprovalMetrics]
  );

  // Handle period selection
  const handlePeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly') => {
    setSelectedPeriod(newPeriod);
  };

  // Handle export if enabled
  const handleExport = () => {
    if (!enableExport) return;
    
    const exportData = {
      period: selectedPeriod,
      metrics,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approval-rates-${selectedPeriod}-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      variant="elevated"
      padding="large"
      className={className}
      role="region"
      ariaLabel="Approval Rate Metrics"
    >
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Approval Rates</h2>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded ${selectedPeriod === 'daily' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => handlePeriodChange('daily')}
          >
            Daily
          </button>
          <button
            className={`px-3 py-1 rounded ${selectedPeriod === 'weekly' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => handlePeriodChange('weekly')}
          >
            Weekly
          </button>
          <button
            className={`px-3 py-1 rounded ${selectedPeriod === 'monthly' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => handlePeriodChange('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Metrics Display */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <span className="text-gray-500">Loading metrics...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Approval Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Tooltip title="Percentage of all approved prior authorization requests">
                <span className="text-sm font-medium">Overall Approval Rate</span>
              </Tooltip>
              {showTrends && (
                <span className={`text-sm ${metrics.trends.overall >= 0 ? 'text-success' : 'text-error'}`}>
                  {metrics.trends.overall >= 0 ? '↑' : '↓'} {Math.abs(metrics.trends.overall).toFixed(1)}%
                </span>
              )}
            </div>
            <ProgressBar
              value={metrics.overallRate}
              variant="primary"
              size="lg"
              showValue
              animated
              label="Overall approval rate progress"
            />
          </div>

          {/* First-Pass Approval Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Tooltip title="Percentage of requests approved without additional information">
                <span className="text-sm font-medium">First-Pass Rate</span>
              </Tooltip>
              {showTrends && (
                <span className={`text-sm ${metrics.trends.firstPass >= 0 ? 'text-success' : 'text-error'}`}>
                  {metrics.trends.firstPass >= 0 ? '↑' : '↓'} {Math.abs(metrics.trends.firstPass).toFixed(1)}%
                </span>
              )}
            </div>
            <ProgressBar
              value={metrics.firstPassRate}
              variant="success"
              size="lg"
              showValue
              animated
              label="First-pass approval rate progress"
            />
          </div>

          {/* Total Requests */}
          <div className="mt-4 flex justify-between items-center">
            <Tooltip title="Total number of prior authorization requests in selected period">
              <span className="text-sm text-gray-600">
                Total Requests: {metrics.totalRequests.toLocaleString()}
              </span>
            </Tooltip>
            {enableExport && (
              <button
                onClick={handleExport}
                className="text-sm text-primary hover:text-primary-dark"
                aria-label="Export metrics data"
              >
                Export Data
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default ApprovalRateChart;