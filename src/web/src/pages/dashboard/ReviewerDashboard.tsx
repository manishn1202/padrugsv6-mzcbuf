import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { useSelector, useDispatch } from 'react-redux';
import AnalyticsCard from '../../components/dashboard/AnalyticsCard';
import ProcessingTimeChart from '../../components/dashboard/ProcessingTimeChart';
import Card from '../../components/common/Card';
import { PriorAuthRequest, PriorAuthStatus } from '../../types/priorAuth';

// @version react-query@4.0.0
// @version react-redux@8.0.5
// @version react@18.2.0

/**
 * Interface for dashboard metrics following HIPAA compliance
 */
interface DashboardMetrics {
  processingTime: number;
  approvalRate: number;
  firstPassRate: number;
  aiMatchConfidence: number;
  reviewerProductivity: number;
  slaCompliance: number;
}

/**
 * Interface for filter options
 */
interface FilterOptions {
  timeRange: 'day' | 'week' | 'month';
  status?: PriorAuthStatus[];
  reviewerId?: string;
}

/**
 * Fetches and calculates dashboard metrics with error handling
 */
const fetchDashboardMetrics = async (
  timeRange: string,
  filterCriteria: FilterOptions
): Promise<DashboardMetrics> => {
  const response = await fetch(`/api/v1/metrics/dashboard?timeRange=${timeRange}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(filterCriteria),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard metrics');
  }

  return response.json();
};

/**
 * ReviewerDashboard component implements the main dashboard interface for PA reviewers
 * with real-time metrics, AI-assisted review capabilities, and HIPAA compliance
 */
const ReviewerDashboard: React.FC = () => {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    timeRange: 'week',
  });

  // Fetch dashboard metrics using react-query for caching and auto-refresh
  const { data: metrics, isLoading, error } = useQuery(
    ['dashboardMetrics', filterOptions],
    () => fetchDashboardMetrics(filterOptions.timeRange, filterOptions),
    {
      refetchInterval: 300000, // Refresh every 5 minutes
      staleTime: 60000, // Consider data stale after 1 minute
    }
  );

  // Get PA requests from Redux store
  const requests = useSelector((state: any) => state.priorAuth.requests);

  const handleTimeRangeChange = useCallback((range: 'day' | 'week' | 'month') => {
    setFilterOptions(prev => ({
      ...prev,
      timeRange: range,
    }));
  }, []);

  if (error) {
    return (
      <Card 
        variant="outlined" 
        padding="large"
        className="dashboard-error"
        role="alert"
      >
        <h2>Error Loading Dashboard</h2>
        <p>Failed to load dashboard metrics. Please try again later.</p>
      </Card>
    );
  }

  return (
    <div className="reviewer-dashboard" role="main">
      <header className="reviewer-dashboard__header">
        <h1>Prior Authorization Review Dashboard</h1>
        <div className="reviewer-dashboard__filters">
          <select
            value={filterOptions.timeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value as 'day' | 'week' | 'month')}
            aria-label="Select time range"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </header>

      <div className="reviewer-dashboard__metrics">
        <AnalyticsCard
          title="Processing Time"
          value={`${metrics?.processingTime.toFixed(1)} hours`}
          icon="timer"
          trend={metrics?.processingTime < 48 ? 'down' : 'up'}
          percentageChange={-70}
          className="dashboard-metric"
        />
        
        <AnalyticsCard
          title="Approval Rate"
          value={`${(metrics?.approvalRate || 0).toFixed(1)}%`}
          icon="check-circle"
          trend={metrics?.approvalRate > 75 ? 'up' : 'down'}
          percentageChange={25}
          className="dashboard-metric"
        />

        <AnalyticsCard
          title="AI Match Confidence"
          value={`${(metrics?.aiMatchConfidence || 0).toFixed(1)}%`}
          icon="ai"
          trend={metrics?.aiMatchConfidence > 90 ? 'up' : 'neutral'}
          percentageChange={15}
          className="dashboard-metric"
        />

        <AnalyticsCard
          title="SLA Compliance"
          value={`${(metrics?.slaCompliance || 0).toFixed(1)}%`}
          icon="clock"
          trend={metrics?.slaCompliance > 95 ? 'up' : 'down'}
          percentageChange={5}
          className="dashboard-metric"
        />
      </div>

      <div className="reviewer-dashboard__charts">
        <ProcessingTimeChart
          requests={requests}
          timeRange={filterOptions.timeRange}
          baselineProcessingTime={48}
          className="dashboard-chart"
        />
      </div>

      <style jsx>{`
        .reviewer-dashboard {
          padding: var(--spacing-lg);
          background-color: var(--color-background);
        }

        .reviewer-dashboard__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-xl);
        }

        .reviewer-dashboard__metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .reviewer-dashboard__charts {
          display: grid;
          gap: var(--spacing-lg);
        }

        .dashboard-metric {
          height: 100%;
        }

        .dashboard-chart {
          min-height: 400px;
        }

        .dashboard-error {
          text-align: center;
          color: var(--color-error);
        }

        @media (max-width: var(--breakpoint-md)) {
          .reviewer-dashboard__header {
            flex-direction: column;
            gap: var(--spacing-md);
          }

          .reviewer-dashboard__metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ReviewerDashboard;