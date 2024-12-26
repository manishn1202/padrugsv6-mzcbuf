import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames'; // @version 2.3.2
import debounce from 'lodash/debounce'; // @version 4.17.21
import { Select } from '../common/Select';
import { DatePicker } from '../common/DatePicker';
import { PriorAuthStatus } from '../../types/priorAuth';

/**
 * Interface defining the filter state for queue management
 */
interface QueueFilters {
  status: PriorAuthStatus[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  priority: string[];
  drugTypes: string[];
  searchTerm: string;
}

/**
 * Props interface for QueueFilters component
 */
interface QueueFiltersProps {
  filters: QueueFilters;
  onFilterChange: (filters: QueueFilters) => Promise<void>;
  isLoading?: boolean;
  onError?: (error: Error) => void;
}

/**
 * Priority options for filtering
 */
const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
];

/**
 * Drug type options for filtering
 */
const DRUG_TYPE_OPTIONS = [
  { value: 'specialty', label: 'Specialty' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'controlled', label: 'Controlled Substance' },
  { value: 'other', label: 'Other' },
];

/**
 * Status options mapped from PriorAuthStatus enum
 */
const STATUS_OPTIONS = Object.entries(PriorAuthStatus).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase(),
}));

/**
 * High-performance queue filtering component with optimized handling for large datasets
 */
export const QueueFilters: React.FC<QueueFiltersProps> = ({
  filters,
  onFilterChange,
  isLoading = false,
  onError,
}) => {
  // Local state for filter values with validation
  const [localFilters, setLocalFilters] = useState<QueueFilters>(filters);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Cache for frequently used filter combinations
  const filterCache = useMemo(() => new Map<string, QueueFilters>(), []);

  // Debounced filter application to prevent excessive API calls
  const debouncedApplyFilters = useCallback(
    debounce(async (newFilters: QueueFilters) => {
      try {
        setIsApplying(true);
        await onFilterChange(newFilters);
        
        // Cache successful filter combinations
        const cacheKey = JSON.stringify(newFilters);
        filterCache.set(cacheKey, newFilters);
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setIsApplying(false);
      }
    }, 300),
    [onFilterChange, onError]
  );

  // Effect to sync local filters with prop filters
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Handler for status filter changes
  const handleStatusChange = useCallback((selectedStatus: string[]) => {
    const newFilters = {
      ...localFilters,
      status: selectedStatus as PriorAuthStatus[],
    };
    setLocalFilters(newFilters);
    debouncedApplyFilters(newFilters);
  }, [localFilters, debouncedApplyFilters]);

  // Handler for date range changes
  const handleDateChange = useCallback((type: 'start' | 'end', date: Date | null) => {
    const newFilters = {
      ...localFilters,
      dateRange: {
        ...localFilters.dateRange,
        [type]: date,
      },
    };
    setLocalFilters(newFilters);
    debouncedApplyFilters(newFilters);
  }, [localFilters, debouncedApplyFilters]);

  // Handler for priority filter changes
  const handlePriorityChange = useCallback((selectedPriorities: string[]) => {
    const newFilters = {
      ...localFilters,
      priority: selectedPriorities,
    };
    setLocalFilters(newFilters);
    debouncedApplyFilters(newFilters);
  }, [localFilters, debouncedApplyFilters]);

  // Handler for drug type filter changes
  const handleDrugTypeChange = useCallback((selectedTypes: string[]) => {
    const newFilters = {
      ...localFilters,
      drugTypes: selectedTypes,
    };
    setLocalFilters(newFilters);
    debouncedApplyFilters(newFilters);
  }, [localFilters, debouncedApplyFilters]);

  // Reset filters to default state
  const handleResetFilters = useCallback(() => {
    const defaultFilters: QueueFilters = {
      status: [],
      dateRange: { start: null, end: null },
      priority: [],
      drugTypes: [],
      searchTerm: '',
    };
    setLocalFilters(defaultFilters);
    debouncedApplyFilters(defaultFilters);
    filterCache.clear();
  }, [debouncedApplyFilters]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div className="flex flex-col">
          <label htmlFor="status-filter" className="text-sm font-medium mb-1">
            Status
          </label>
          <Select
            id="status-filter"
            value={localFilters.status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            multiple
            disabled={isLoading || isApplying}
            placeholder="Select status"
          />
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-col gap-2">
          <DatePicker
            name="start-date"
            label="Start Date"
            value={localFilters.dateRange.start}
            onChange={(date) => handleDateChange('start', date)}
            maxDate={localFilters.dateRange.end || undefined}
            disabled={isLoading || isApplying}
          />
          <DatePicker
            name="end-date"
            label="End Date"
            value={localFilters.dateRange.end}
            onChange={(date) => handleDateChange('end', date)}
            minDate={localFilters.dateRange.start || undefined}
            disabled={isLoading || isApplying}
          />
        </div>

        {/* Priority Filter */}
        <div className="flex flex-col">
          <label htmlFor="priority-filter" className="text-sm font-medium mb-1">
            Priority
          </label>
          <Select
            id="priority-filter"
            value={localFilters.priority}
            onChange={handlePriorityChange}
            options={PRIORITY_OPTIONS}
            multiple
            disabled={isLoading || isApplying}
            placeholder="Select priority"
          />
        </div>

        {/* Drug Type Filter */}
        <div className="flex flex-col">
          <label htmlFor="drug-type-filter" className="text-sm font-medium mb-1">
            Drug Type
          </label>
          <Select
            id="drug-type-filter"
            value={localFilters.drugTypes}
            onChange={handleDrugTypeChange}
            options={DRUG_TYPE_OPTIONS}
            multiple
            disabled={isLoading || isApplying}
            placeholder="Select drug type"
          />
        </div>
      </div>

      {/* Filter Actions */}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={handleResetFilters}
          disabled={isLoading || isApplying}
          className={classNames(
            'px-4 py-2 text-sm font-medium rounded-md',
            'text-gray-700 bg-white border border-gray-300',
            'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          Reset Filters
        </button>
      </div>

      {/* Loading Indicator */}
      {(isLoading || isApplying) && (
        <div
          className="absolute inset-0 bg-white/50 flex items-center justify-center"
          aria-live="polite"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      )}
    </div>
  );
};

export default React.memo(QueueFilters);