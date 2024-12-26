// @version react@18.2.0
// @version classnames@2.3.2
import React, { useMemo, useCallback } from 'react';
import classNames from 'classnames';
import { ComponentProps } from '../../types/common';
import { usePagination } from '../../hooks/usePagination';

interface PaginationProps extends ComponentProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  ariaLabel?: string;
  showPageSizeSelector?: boolean;
  maxVisiblePages?: number;
  loadingState?: boolean;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_MAX_VISIBLE_PAGES = 5;

const Pagination: React.FC<PaginationProps> = React.memo(({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  ariaLabel = 'Pagination navigation',
  showPageSizeSelector = true,
  maxVisiblePages = DEFAULT_MAX_VISIBLE_PAGES,
  loadingState = false,
  disabled = false,
  className,
}) => {
  // Initialize pagination hook with current state
  const {
    paginationState,
    handlePageChange,
    handlePageSizeChange,
    totalPages,
    ariaProps,
  } = usePagination({
    initialPage: currentPage,
    initialPageSize: pageSize,
    totalItems,
    minPageSize: Math.min(...pageSizeOptions),
    maxPageSize: Math.max(...pageSizeOptions),
  }, onPageChange);

  // Calculate visible page numbers
  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    // Adjust start if end is at max pages
    if (end === totalPages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  // Memoized event handlers
  const handlePrevious = useCallback(() => {
    if (!disabled && !loadingState && currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  }, [currentPage, disabled, loadingState, handlePageChange]);

  const handleNext = useCallback(() => {
    if (!disabled && !loadingState && currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, disabled, loadingState, handlePageChange]);

  const handlePageSizeSelectChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!disabled && !loadingState) {
      const newSize = parseInt(event.target.value, 10);
      handlePageSizeChange(newSize);
      onPageSizeChange(newSize);
    }
  }, [disabled, loadingState, handlePageSizeChange, onPageSizeChange]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent, page: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePageChange(page);
    }
  }, [handlePageChange]);

  const containerClasses = classNames(
    'pagination-container',
    {
      'pagination-disabled': disabled,
      'pagination-loading': loadingState,
    },
    className
  );

  return (
    <nav
      className={containerClasses}
      role="navigation"
      aria-label={ariaLabel}
      {...ariaProps}
    >
      <div className="pagination-controls">
        {/* Previous button */}
        <button
          type="button"
          className="pagination-button"
          onClick={handlePrevious}
          disabled={disabled || loadingState || currentPage === 1}
          aria-label="Go to previous page"
          aria-disabled={currentPage === 1}
        >
          <span aria-hidden="true">&laquo;</span>
          <span className="sr-only">Previous</span>
        </button>

        {/* Page numbers */}
        <ul className="pagination-list" role="list">
          {visiblePages.map((page) => (
            <li key={page} className="pagination-item">
              <button
                type="button"
                className={classNames('pagination-button', {
                  'pagination-button-active': page === currentPage,
                })}
                onClick={() => handlePageChange(page)}
                onKeyDown={(e) => handleKeyDown(e, page)}
                disabled={disabled || loadingState}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            </li>
          ))}
        </ul>

        {/* Next button */}
        <button
          type="button"
          className="pagination-button"
          onClick={handleNext}
          disabled={disabled || loadingState || currentPage === totalPages}
          aria-label="Go to next page"
          aria-disabled={currentPage === totalPages}
        >
          <span aria-hidden="true">&raquo;</span>
          <span className="sr-only">Next</span>
        </button>
      </div>

      {/* Page size selector */}
      {showPageSizeSelector && (
        <div className="pagination-size-selector">
          <label
            htmlFor="pageSize"
            className="pagination-size-label"
          >
            Items per page:
          </label>
          <select
            id="pageSize"
            className="pagination-size-select"
            value={pageSize}
            onChange={handlePageSizeSelectChange}
            disabled={disabled || loadingState}
            aria-label="Select number of items per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Screen reader status */}
      <div className="sr-only" role="status" aria-live="polite">
        {loadingState ? (
          'Loading page results...'
        ) : (
          `Showing page ${currentPage} of ${totalPages}`
        )}
      </div>
    </nav>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;