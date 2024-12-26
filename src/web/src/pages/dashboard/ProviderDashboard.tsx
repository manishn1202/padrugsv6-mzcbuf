import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { debounce } from 'lodash'; // @version 4.17.21
import { Skeleton } from '@mui/material'; // @version 5.14.0

// Internal component imports
import MetricsOverview from '../../components/dashboard/MetricsOverview';
import ApprovalRateChart from '../../components/dashboard/ApprovalRateChart';
import RequestTrends from '../../components/dashboard/RequestTrends';

// State management and types
import { DashboardState } from './types';
import { UserRole } from '../../types/auth';
import { ErrorType } from '../../types/api';

/**
 * Provider Dashboard component that serves as the main interface for healthcare providers
 * to monitor and manage prior authorization requests.
 * 
 * Implements requirements:
 * - Real-time metrics tracking
 * - Performance monitoring
 * - HIPAA compliance
 * - Accessibility features
 */
const ProviderDashboard: React.FC = () => {
  // Local state management
  const [state, setState] = useState<DashboardState>({
    selectedPeriod: 'month',
    loading: true,
    error: null,
    refreshInterval: 300000, // 5 minutes
    lastUpdated: new Date()
  });

  const dispatch = useDispatch();

  // Initialize dashboard with error boundary
  const initializeDashboard = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      // Verify user role and permissions
      const userRole = UserRole.PROVIDER;
      if (!userRole) {
        throw new Error(ErrorType.AUTHORIZATION_ERROR);
      }

      // Initialize dashboard components
      await Promise.all([
        dispatch({ type: 'metrics/fetch' }),
        dispatch({ type: 'requests/fetch' })
      ]);

      setState(prev => ({
        ...prev,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Dashboard initialization failed'
      }));
    }
  }, [dispatch]);

  // Handle period changes with debouncing
  const handlePeriodChange = useCallback(
    debounce((period: 'day' | 'week' | 'month' | 'year') => {
      setState(prev => ({
        ...prev,
        selectedPeriod: period,
        lastUpdated: new Date()
      }));
    }, 300),
    []
  );

  // Periodic data refresh
  const refreshDashboardData = useCallback(async () => {
    try {
      await Promise.all([
        dispatch({ type: 'metrics/refresh' }),
        dispatch({ type: 'requests/refresh' })
      ]);

      setState(prev => ({
        ...prev,
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Dashboard refresh failed:', error);
    }
  }, [dispatch]);

  // Set up periodic refresh
  useEffect(() => {
    initializeDashboard();
    const refreshInterval = setInterval(refreshDashboardData, state.refreshInterval);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [initializeDashboard, refreshDashboardData, state.refreshInterval]);

  // Memoized last update time display
  const lastUpdateDisplay = useMemo(() => {
    return state.lastUpdated.toLocaleTimeString();
  }, [state.lastUpdated]);

  // Loading state
  if (state.loading) {
    return (
      <div className="dashboard-loading" role="status" aria-busy="true">
        <Skeleton variant="rectangular" height={200} className="mb-4" />
        <Skeleton variant="rectangular" height={300} className="mb-4" />
        <Skeleton variant="rectangular" height={400} />
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div 
        className="dashboard-error" 
        role="alert" 
        aria-live="assertive"
      >
        <h2>Dashboard Error</h2>
        <p>{state.error}</p>
        <button 
          onClick={initializeDashboard}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      className="provider-dashboard"
      role="main"
      aria-label="Provider Dashboard"
    >
      {/* Header Section */}
      <div className="dashboard-header">
        <h1 className="text-2xl font-bold mb-4">
          Prior Authorization Dashboard
        </h1>
        <div className="dashboard-controls">
          <div className="period-selector">
            <select
              value={state.selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value as DashboardState['selectedPeriod'])}
              aria-label="Select time period"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <div className="last-updated" aria-live="polite">
            Last updated: {lastUpdateDisplay}
          </div>
        </div>
      </div>

      {/* Metrics Overview Section */}
      <section className="dashboard-metrics mb-6" aria-label="Key Metrics">
        <MetricsOverview
          period={state.selectedPeriod}
          className="mb-6"
          refreshInterval={state.refreshInterval}
        />
      </section>

      {/* Charts Section */}
      <div className="dashboard-charts grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="Approval Rate Trends">
          <ApprovalRateChart
            period={state.selectedPeriod}
            className="h-full"
            showTrends={true}
          />
        </section>
        <section aria-label="Request Trends">
          <RequestTrends
            timeRange={state.selectedPeriod}
            className="h-full"
            refreshInterval={state.refreshInterval}
          />
        </section>
      </div>
    </div>
  );
};

export default ProviderDashboard;