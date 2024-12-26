import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid
} from 'recharts';
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { fetchPriorAuthList } from '../../store/priorAuth/priorAuthSlice';
import { PriorAuthStatus } from '../../types/priorAuth';

// Define component props interface
interface RequestTrendsProps {
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
  className?: string;
  refreshInterval?: number;
}

// Define trend data interface
interface TrendData {
  date: string;
  requestCount: number;
  approvalRate: number;
  processingTime: number;
  firstPassRate: number;
  errorRate: number;
}

// Define metrics interface
interface Metrics {
  averageApprovalRate: number;
  averageProcessingTime: number;
  firstPassImprovement: number;
  targetProcessingReduction: number;
}

const RequestTrends: React.FC<RequestTrendsProps> = React.memo(({
  timeRange = 'month',
  className,
  refreshInterval = 300000 // 5 minutes default
}) => {
  const dispatch = useDispatch();
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Calculate date range based on timeRange
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    switch (timeRange) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default: // month
        start.setMonth(end.getMonth() - 1);
    }
    return { start, end };
  }, [timeRange]);

  // Calculate metrics from trend data
  const metrics = useMemo((): Metrics => {
    if (!trendData.length) return {
      averageApprovalRate: 0,
      averageProcessingTime: 0,
      firstPassImprovement: 0,
      targetProcessingReduction: 0
    };

    const approvalRates = trendData.map(d => d.approvalRate);
    const processingTimes = trendData.map(d => d.processingTime);
    const firstPassRates = trendData.map(d => d.firstPassRate);

    // Calculate averages and improvements
    const avgApproval = approvalRates.reduce((a, b) => a + b, 0) / approvalRates.length;
    const avgProcessing = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const firstPassImprovement = ((firstPassRates[firstPassRates.length - 1] || 0) - 
                                (firstPassRates[0] || 0)) * 100;
    const targetReduction = ((processingTimes[0] || 0) - avgProcessing) / 
                          (processingTimes[0] || 1) * 100;

    return {
      averageApprovalRate: avgApproval,
      averageProcessingTime: avgProcessing,
      firstPassImprovement,
      targetProcessingReduction: targetReduction
    };
  }, [trendData]);

  // Fetch trend data
  const fetchTrendData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dispatch(fetchPriorAuthList({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        pageSize: 1000 // Get enough data for trends
      })).unwrap();

      // Process response into trend data
      const processedData = processTrendData(response.items);
      setTrendData(processedData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch trend data'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, dateRange]);

  // Set up data refresh interval
  useEffect(() => {
    fetchTrendData();
    const interval = setInterval(fetchTrendData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchTrendData, refreshInterval]);

  // Process raw PA request data into trend data
  const processTrendData = (requests: any[]): TrendData[] => {
    const dailyData = new Map<string, {
      requests: number;
      approved: number;
      totalTime: number;
      firstPass: number;
      errors: number;
    }>();

    requests.forEach(req => {
      const date = new Date(req.created_at).toISOString().split('T')[0];
      const current = dailyData.get(date) || {
        requests: 0,
        approved: 0,
        totalTime: 0,
        firstPass: 0,
        errors: 0
      };

      current.requests++;
      if (req.status === PriorAuthStatus.APPROVED) {
        current.approved++;
      }
      if (req.firstPassApproval) {
        current.firstPass++;
      }
      if (req.status === PriorAuthStatus.DENIED) {
        current.errors++;
      }
      current.totalTime += req.processingTime || 0;

      dailyData.set(date, current);
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      requestCount: data.requests,
      approvalRate: (data.approved / data.requests) * 100,
      processingTime: data.totalTime / data.requests,
      firstPassRate: (data.firstPass / data.requests) * 100,
      errorRate: (data.errors / data.requests) * 100
    }));
  };

  return (
    <Card 
      variant="elevated" 
      className={className}
      padding="large"
      ariaLabel="Prior Authorization Request Trends"
    >
      <h2 className="text-xl font-semibold mb-4">Request Trends</h2>
      
      {/* Progress Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-medium mb-2">Processing Time Reduction</h3>
          <ProgressBar
            value={Math.min(metrics.targetProcessingReduction, 70)}
            variant={metrics.targetProcessingReduction >= 70 ? 'success' : 'primary'}
            showValue
            label="Progress towards 70% reduction target"
          />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">First-Pass Approval Improvement</h3>
          <ProgressBar
            value={Math.min(metrics.firstPassImprovement, 25)}
            variant={metrics.firstPassImprovement >= 25 ? 'success' : 'primary'}
            showValue
            label="Progress towards 25% improvement target"
          />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trendData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString()}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}${name.includes('Rate') ? '%' : ' hrs'}`,
                name
              ]}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="approvalRate"
              name="Approval Rate"
              stroke="var(--color-success)"
              strokeWidth={2}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="firstPassRate"
              name="First-Pass Rate"
              stroke="var(--color-primary)"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="processingTime"
              name="Processing Time"
              stroke="var(--color-secondary)"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-4 p-3 bg-error-light text-error rounded">
          {error.message}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
    </Card>
  );
});

RequestTrends.displayName = 'RequestTrends';

export default RequestTrends;