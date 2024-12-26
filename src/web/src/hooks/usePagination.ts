// @version react@18.2.0
import { useState, useCallback, useMemo, useEffect } from 'react';
import { PaginationParams } from '../types/common';

/**
 * Parameters for initializing the pagination hook
 */
interface UsePaginationParams {
  /** Starting page number (must be >= 1) */
  initialPage: number;
  /** Initial number of items per page (must be >= 1) */
  initialPageSize: number;
  /** Total number of items to paginate */
  totalItems: number;
  /** Optional minimum page size (defaults to 1) */
  minPageSize?: number;
  /** Optional maximum page size */
  maxPageSize?: number;
}

/**
 * Return type for the usePagination hook
 */
interface UsePaginationReturn {
  /** Current pagination state */
  paginationState: PaginationParams;
  /** Handler for page changes */
  handlePageChange: (newPage: number) => void;
  /** Handler for page size changes */
  handlePageSizeChange: (newSize: number) => void;
  /** Total number of pages */
  totalPages: number;
  /** ARIA properties for accessibility */
  ariaProps: {
    'aria-label': string;
    'aria-current': number;
    'aria-total': number;
  };
}

/**
 * Calculates the total number of pages based on total items and page size
 * @param totalItems - Total number of items to paginate
 * @param pageSize - Number of items per page
 * @returns Total number of pages (minimum 1)
 */
const calculateTotalPages = (totalItems: number, pageSize: number): number => {
  if (totalItems < 0 || pageSize <= 0) {
    throw new Error('Invalid pagination parameters');
  }
  return Math.max(1, Math.ceil(totalItems / pageSize));
};

/**
 * Custom hook for managing pagination state with performance optimization and accessibility
 * @param initialParams - Initial pagination parameters and validation rules
 * @param onPageChange - Optional callback for page change events
 * @returns Pagination state, handlers, and accessibility props
 */
export const usePagination = (
  {
    initialPage,
    initialPageSize,
    totalItems,
    minPageSize = 1,
    maxPageSize,
  }: UsePaginationParams,
  onPageChange?: (page: number, size: number) => void
): UsePaginationReturn => {
  // Validate initial parameters
  if (initialPage < 1 || initialPageSize < minPageSize) {
    throw new Error('Invalid initial pagination parameters');
  }

  if (maxPageSize && initialPageSize > maxPageSize) {
    throw new Error('Initial page size exceeds maximum allowed');
  }

  // Initialize pagination state
  const [paginationState, setPaginationState] = useState<PaginationParams>({
    page: initialPage,
    size: initialPageSize,
  });

  // Memoize total pages calculation
  const totalPages = useMemo(
    () => calculateTotalPages(totalItems, paginationState.size),
    [totalItems, paginationState.size]
  );

  // Handler for page changes with validation
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) {
        return;
      }

      setPaginationState((prev) => {
        const updatedState = { ...prev, page: newPage };
        onPageChange?.(newPage, prev.size);
        return updatedState;
      });
    },
    [totalPages, onPageChange]
  );

  // Handler for page size changes with validation and page recalculation
  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      if (
        newSize < minPageSize ||
        (maxPageSize && newSize > maxPageSize)
      ) {
        return;
      }

      setPaginationState((prev) => {
        // Recalculate current page based on new size to maintain item position
        const newTotalPages = calculateTotalPages(totalItems, newSize);
        const newPage = Math.min(prev.page, newTotalPages);
        
        const updatedState = { page: newPage, size: newSize };
        onPageChange?.(newPage, newSize);
        return updatedState;
      });
    },
    [totalItems, minPageSize, maxPageSize, onPageChange]
  );

  // Ensure current page is valid when total items changes
  useEffect(() => {
    if (paginationState.page > totalPages) {
      handlePageChange(totalPages);
    }
  }, [totalPages, paginationState.page, handlePageChange]);

  // ARIA properties for accessibility
  const ariaProps = useMemo(
    () => ({
      'aria-label': 'Pagination navigation',
      'aria-current': paginationState.page,
      'aria-total': totalPages,
    }),
    [paginationState.page, totalPages]
  );

  return {
    paginationState,
    handlePageChange,
    handlePageSizeChange,
    totalPages,
    ariaProps,
  };
};
```

This implementation includes:

1. Type-safe interfaces for hook parameters and return values
2. Performance optimizations using useMemo and useCallback
3. Comprehensive validation of pagination parameters
4. Accessibility support with ARIA properties
5. Automatic page recalculation when page size changes
6. Boundary checks for page navigation
7. Optional callback support for page changes
8. Memoized calculations to prevent unnecessary rerenders
9. Error handling for invalid parameters
10. Support for minimum and maximum page sizes

The hook can be used in components like this:

```typescript
const { 
  paginationState, 
  handlePageChange, 
  handlePageSizeChange, 
  totalPages,
  ariaProps 
} = usePagination({
  initialPage: 1,
  initialPageSize: 10,
  totalItems: 100,
  minPageSize: 5,
  maxPageSize: 50
});