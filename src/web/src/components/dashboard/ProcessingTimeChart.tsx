import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chart, ChartConfiguration, ChartData } from 'chart.js/auto';
import { format, differenceInHours, subDays, subWeeks, subMonths } from 'date-fns';
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { PriorAuthRequest } from '../../types/priorAuth';

// @version chart.js@4.4.0
// @version date-fns@2.30.0

interface ProcessingTimeChartProps {
  /** Array of PA requests with processing time data */
  requests: PriorAuthRequest[];
  /** Time range for chart display */
  timeRange?: 'day' | 'week' | 'month';
  /** Optional CSS class name */
  className?: string;
  /** Baseline processing time in hours for reduction calculation */
  baselineProcessingTime?: number;
}

interface ProcessingTimeMetrics {
  averageTime: number;
  reductionPercentage: number;
  trend: number[];
  targetMet: boolean;
}

/**
 * Calculates processing time metrics from request data
 */
const calculateProcessingMetrics = (
  requests: PriorAuthRequest[],
  baselineTime: number
): ProcessingTimeMetrics => {
  // Filter completed requests with valid timestamps
  const completedRequests = requests.filter(
    (req) => req.submitted_at && req.processed_at
  );

  if (completedRequests.length === 0) {
    return {
      averageTime: 0,
      reductionPercentage: 0,
      trend: [],
      targetMet: false
    };
  }

  // Calculate processing times
  const processingTimes = completedRequests.map((req) =>
    differenceInHours(new Date(req.processed_at), new Date(req.submitted_at))
  );

  // Calculate average time
  const averageTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;

  // Calculate reduction percentage
  const reductionPercentage = ((baselineTime - averageTime) / baselineTime) * 100;

  // Generate trend data
  const trend = processingTimes.slice(-10);

  return {
    averageTime,
    reductionPercentage: Math.max(0, Math.min(100, reductionPercentage)),
    trend,
    targetMet: reductionPercentage >= 70
  };
};

/**
 * Component for visualizing PA processing time metrics and trends
 */
const ProcessingTimeChart: React.FC<ProcessingTimeChartProps> = ({
  requests,
  timeRange = 'week',
  className,
  baselineProcessingTime = 48
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [metrics, setMetrics] = useState<ProcessingTimeMetrics>({
    averageTime: 0,
    reductionPercentage: 0,
    trend: [],
    targetMet: false
  });

  // Calculate date range based on timeRange prop
  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return subDays(now, 1);
      case 'month':
        return subMonths(now, 1);
      case 'week':
      default:
        return subWeeks(now, 1);
    }
  }, [timeRange]);

  // Memoized metrics calculation
  const calculateMetrics = useMemo(() => {
    const dateRange = getDateRange();
    const filteredRequests = requests.filter(
      (req) => new Date(req.submitted_at) >= dateRange
    );
    return calculateProcessingMetrics(filteredRequests, baselineProcessingTime);
  }, [requests, baselineProcessingTime, getDateRange]);

  // Chart rendering function
  const renderChart = useCallback(() => {
    if (!chartRef.current || metrics.trend.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = metrics.trend.map((_, index) => 
      format(subDays(new Date(), metrics.trend.length - index - 1), 'MMM d')
    );

    const chartConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Processing Time (hours)',
          data: metrics.trend,
          borderColor: 'var(--color-primary)',
          backgroundColor: 'rgba(0, 102, 204, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => `${context.parsed.y.toFixed(1)} hours`
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Processing Time (hours)'
            }
          }
        }
      }
    };

    chartInstance.current = new Chart(ctx, chartConfig);
  }, [metrics.trend]);

  // Update metrics when data changes
  useEffect(() => {
    setMetrics(calculateMetrics);
  }, [calculateMetrics]);

  // Render/update chart when metrics change
  useEffect(() => {
    renderChart();
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [renderChart]);

  return (
    <Card 
      variant="default"
      padding="large"
      className={className}
      ariaLabel="Processing Time Metrics"
    >
      <div className="processing-time-chart">
        <div className="processing-time-chart__header">
          <h3>Processing Time Performance</h3>
          <div className="processing-time-chart__metrics">
            <div className="metric">
              <span className="metric__label">Average Time</span>
              <span className="metric__value">
                {metrics.averageTime.toFixed(1)} hours
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">Reduction Target (70%)</span>
              <ProgressBar
                value={metrics.reductionPercentage}
                variant={metrics.targetMet ? 'success' : 'primary'}
                size="md"
                showValue
                animated={!metrics.targetMet}
                label="Processing time reduction progress"
              />
            </div>
          </div>
        </div>
        <div 
          className="processing-time-chart__canvas-container"
          style={{ height: '300px' }}
        >
          <canvas 
            ref={chartRef}
            aria-label="Processing time trend chart"
            role="img"
          />
        </div>
      </div>
    </Card>
  );
};

export default ProcessingTimeChart;
```

This implementation:

1. Creates a responsive chart component that visualizes PA processing times and reduction progress
2. Uses Chart.js for time series visualization with proper styling and animations
3. Implements a progress bar showing progress towards 70% reduction target
4. Provides proper accessibility features with ARIA labels and roles
5. Uses the design system colors and spacing from variables.css
6. Includes proper cleanup of chart instances to prevent memory leaks
7. Implements memoization for performance optimization
8. Supports different time ranges (day/week/month) for trend analysis
9. Provides proper TypeScript typing and documentation

The component can be used in the dashboard like this:

```typescript
<ProcessingTimeChart
  requests={priorAuthRequests}
  timeRange="week"
  baselineProcessingTime={48}
  className="dashboard-chart"
/>