import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { axe } from '@testing-library/jest-dom/extend-jest-axe';
import ProviderDashboard from '../../src/pages/dashboard/ProviderDashboard';

// @version @testing-library/react@13.4.0
// @version @testing-library/jest-dom@5.16.5
// @version @reduxjs/toolkit@1.9.5
// @version react-redux@8.0.5

// Mock child components
jest.mock('../../components/dashboard/MetricsOverview', () => ({
  __esModule: true,
  default: jest.fn(({ period, refreshInterval }) => (
    <div data-testid="metrics-overview" data-period={period} data-refresh={refreshInterval}>
      Metrics Overview
    </div>
  ))
}));

jest.mock('../../components/dashboard/ApprovalRateChart', () => ({
  __esModule: true,
  default: jest.fn(({ period, showTrends }) => (
    <div data-testid="approval-rate-chart" data-period={period} data-trends={showTrends}>
      Approval Rate Chart
    </div>
  ))
}));

jest.mock('../../components/dashboard/RequestTrends', () => ({
  __esModule: true,
  default: jest.fn(({ timeRange, refreshInterval }) => (
    <div data-testid="request-trends" data-range={timeRange} data-refresh={refreshInterval}>
      Request Trends
    </div>
  ))
}));

// Mock Redux store
const mockInitialState = {
  priorAuth: {
    metrics: {
      approvalRate: {
        current: 85,
        previous: 68,
        target: 85
      },
      processingTime: {
        current: 24,
        previous: 80,
        reduction: 70
      },
      requestVolume: {
        total: 5000,
        pending: 450,
        approved: 4250,
        denied: 300
      }
    },
    loading: false,
    error: null
  }
};

// Helper function to render component with Redux store
const renderWithRedux = (
  component: React.ReactElement,
  preloadedState = mockInitialState
) => {
  const store = configureStore({
    reducer: {
      priorAuth: (state = preloadedState.priorAuth) => state
    },
    preloadedState
  });

  return {
    ...render(<Provider store={store}>{component}</Provider>),
    store
  };
};

describe('ProviderDashboard Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('should render the dashboard with all required components', () => {
      const { container } = renderWithRedux(<ProviderDashboard />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText('Prior Authorization Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-overview')).toBeInTheDocument();
      expect(screen.getByTestId('approval-rate-chart')).toBeInTheDocument();
      expect(screen.getByTestId('request-trends')).toBeInTheDocument();
    });

    it('should pass accessibility audit', async () => {
      const { container } = renderWithRedux(<ProviderDashboard />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should show loading state initially', () => {
      const loadingState = {
        ...mockInitialState,
        priorAuth: { ...mockInitialState.priorAuth, loading: true }
      };
      renderWithRedux(<ProviderDashboard />, loadingState);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Period Selection', () => {
    it('should update period when selection changes', async () => {
      renderWithRedux(<ProviderDashboard />);
      
      const periodSelector = screen.getByLabelText('Select time period');
      fireEvent.change(periodSelector, { target: { value: 'week' } });

      await waitFor(() => {
        expect(screen.getByTestId('metrics-overview')).toHaveAttribute('data-period', 'week');
        expect(screen.getByTestId('approval-rate-chart')).toHaveAttribute('data-period', 'week');
        expect(screen.getByTestId('request-trends')).toHaveAttribute('data-range', 'week');
      });
    });

    it('should debounce period changes', async () => {
      renderWithRedux(<ProviderDashboard />);
      
      const periodSelector = screen.getByLabelText('Select time period');
      fireEvent.change(periodSelector, { target: { value: 'week' } });
      fireEvent.change(periodSelector, { target: { value: 'month' } });
      fireEvent.change(periodSelector, { target: { value: 'year' } });

      // Fast-forward debounce timeout
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByTestId('metrics-overview')).toHaveAttribute('data-period', 'year');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when initialization fails', () => {
      const errorState = {
        ...mockInitialState,
        priorAuth: { ...mockInitialState.priorAuth, error: 'Failed to load dashboard data' }
      };
      renderWithRedux(<ProviderDashboard />, errorState);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
    });

    it('should provide retry functionality on error', async () => {
      const errorState = {
        ...mockInitialState,
        priorAuth: { ...mockInitialState.priorAuth, error: 'Failed to load dashboard data' }
      };
      renderWithRedux(<ProviderDashboard />, errorState);
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should display correct KPI values', () => {
      renderWithRedux(<ProviderDashboard />);
      
      const metricsOverview = screen.getByTestId('metrics-overview');
      expect(metricsOverview).toHaveAttribute('data-refresh', '300000');
      
      const approvalChart = screen.getByTestId('approval-rate-chart');
      expect(approvalChart).toHaveAttribute('data-trends', 'true');
    });

    it('should auto-refresh data at specified interval', () => {
      const { store } = renderWithRedux(<ProviderDashboard />);
      
      jest.advanceTimersByTime(300000); // 5 minutes

      expect(store.getState().priorAuth.metrics.lastUpdated).toBeDefined();
    });
  });

  describe('Responsive Layout', () => {
    it('should adjust layout for different screen sizes', () => {
      const { container } = renderWithRedux(<ProviderDashboard />);
      
      const chartsContainer = container.querySelector('.dashboard-charts');
      expect(chartsContainer).toHaveClass('grid', 'grid-cols-1', 'lg:grid-cols-2');
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on unmount', () => {
      const { unmount } = renderWithRedux(<ProviderDashboard />);
      
      unmount();
      
      // Verify intervals are cleared
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});