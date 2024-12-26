import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { PriorAuthStatus, PriorAuthRequest } from '../../types/priorAuth';
import { fetchPriorAuthList } from '../../store/priorAuth/priorAuthSlice';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Status colors matching design system
const STATUS_COLORS = {
  [PriorAuthStatus.APPROVED]: '#28A745', // Success green
  [PriorAuthStatus.DENIED]: '#DC3545',   // Error red
  [PriorAuthStatus.IN_REVIEW]: '#FFC107', // Warning yellow
  [PriorAuthStatus.PENDING_INFO]: '#17A2B8', // Info blue
  [PriorAuthStatus.SUBMITTED]: '#007BFF', // Primary blue
  [PriorAuthStatus.DRAFT]: '#6C757D'     // Secondary gray
};

// Chart configuration
const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        font: {
          family: 'Inter',
          size: 12
        },
        generateLabels: (chart: any) => {
          const data = chart.data;
          return data.labels.map((label: string, index: number) => ({
            text: `${label} (${data.datasets[0].data[index]})`,
            fillStyle: data.datasets[0].backgroundColor[index],
            hidden: false,
            index
          }));
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const label = context.label || '';
          const value = context.raw || 0;
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${label}: ${value} (${percentage}%)`;
        }
      }
    }
  },
  animation: {
    duration: 750,
    easing: 'easeInOutQuart'
  }
};

interface StatusDistribution {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor: string[];
    borderWidth: number;
  }[];
}

export const RequestStatusChart: React.FC = () => {
  const dispatch = useDispatch();
  const chartRef = useRef<ChartJS>(null);
  
  // Select requests from Redux store
  const requests = useSelector((state: any) => state.priorAuth.requests);
  const loading = useSelector((state: any) => state.priorAuth.loading);
  const error = useSelector((state: any) => state.priorAuth.error);

  // Calculate status distribution with memoization
  const calculateStatusDistribution = useCallback((requests: PriorAuthRequest[]): StatusDistribution => {
    const distribution = Object.values(PriorAuthStatus).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<string, number>);

    // Process requests in batches for performance
    const BATCH_SIZE = 1000;
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      batch.forEach(request => {
        distribution[request.status]++;
      });
    }

    const labels = Object.keys(distribution);
    const data = Object.values(distribution);
    const backgroundColor = labels.map(status => STATUS_COLORS[status as PriorAuthStatus]);

    return {
      labels,
      datasets: [{
        data,
        backgroundColor,
        borderWidth: 0
      }]
    };
  }, []);

  // Memoize chart data
  const chartData = useMemo(() => {
    return calculateStatusDistribution(Object.values(requests));
  }, [requests, calculateStatusDistribution]);

  // Fetch requests on mount and set up refresh interval
  useEffect(() => {
    const fetchData = () => {
      dispatch(fetchPriorAuthList());
    };

    fetchData();
    const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, [dispatch]);

  // Handle loading and error states
  if (loading) {
    return (
      <div className="request-status-chart-loading" role="status">
        <span>Loading status distribution...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="request-status-chart-error" role="alert">
        <span>Error loading status distribution: {error}</span>
      </div>
    );
  }

  return (
    <div className="request-status-chart" style={{ height: '400px' }}>
      <h3 className="chart-title">Prior Authorization Status Distribution</h3>
      <div className="chart-container">
        <Doughnut
          ref={chartRef}
          data={chartData}
          options={CHART_OPTIONS}
          aria-label="Prior Authorization Status Distribution Chart"
        />
      </div>
    </div>
  );
};

export default RequestStatusChart;