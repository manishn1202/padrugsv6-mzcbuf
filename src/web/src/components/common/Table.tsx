// @version react@18.2.0
// @version classnames@2.3.2
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { ComponentProps } from '../../types/common';
import Loading from './Loading';
import Pagination from './Pagination';

// Column configuration interface with PHI handling
export interface Column<T = any> {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  isPHI?: boolean;
  accessibilityLabel?: string;
  render?: (value: any, record: T) => React.ReactNode;
}

// Table props interface extending base component props
export interface TableProps<T = any> extends ComponentProps {
  columns: Column<T>[];
  data: T[];
  rowKey: string | ((record: T) => string);
  pageSize?: number;
  currentPage?: number;
  totalItems?: number;
  sortable?: boolean;
  secure?: boolean;
  virtualized?: boolean;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  emptyMessage?: string;
  rowClassName?: string | ((record: T) => string);
  onRowClick?: (record: T) => void;
  headerClassName?: string;
  cellClassName?: string;
}

// Constants for virtualization and accessibility
const VIRTUAL_ROW_HEIGHT = 48;
const VIEWPORT_BUFFER = 5;
const DEFAULT_PAGE_SIZE = 10;
const ARIA_SORT_STATES = {
  NONE: 'none',
  ASC: 'ascending',
  DESC: 'descending',
} as const;

/**
 * HIPAA-compliant table component for displaying healthcare data
 * Implements virtualization, sorting, pagination, and accessibility features
 */
const Table = React.memo(<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  pageSize = DEFAULT_PAGE_SIZE,
  currentPage = 1,
  totalItems,
  sortable = true,
  secure = false,
  virtualized = true,
  loading = false,
  className,
  onSort,
  onPageChange,
  onPageSizeChange,
  emptyMessage = 'No data available',
  rowClassName,
  onRowClick,
  headerClassName,
  cellClassName,
}: TableProps<T>) => {
  // State for sorting and virtualization
  const [sortState, setSortState] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: pageSize });
  const tableRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

  // Memoized row key getter
  const getRowKey = useCallback(
    (record: T) => (typeof rowKey === 'function' ? rowKey(record) : record[rowKey]),
    [rowKey]
  );

  // Handle column sort
  const handleSort = useCallback(
    (key: string) => {
      if (!sortable || loading) return;

      const newOrder = sortState?.key === key && sortState.order === 'asc' ? 'desc' : 'asc';
      setSortState({ key, order: newOrder });
      onSort?.(key, newOrder);
    },
    [sortable, loading, sortState, onSort]
  );

  // Virtualization scroll handler
  const handleScroll = useCallback(() => {
    if (!virtualized || !tableRef.current) return;

    const { scrollTop, clientHeight } = tableRef.current;
    const start = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
    const visibleCount = Math.ceil(clientHeight / VIRTUAL_ROW_HEIGHT);
    
    setVisibleRange({
      start: Math.max(0, start - VIEWPORT_BUFFER),
      end: Math.min(data.length, start + visibleCount + VIEWPORT_BUFFER)
    });
  }, [virtualized, data.length]);

  // Set up virtualization scroll listener
  useEffect(() => {
    const tableElement = tableRef.current;
    if (virtualized && tableElement) {
      tableElement.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => tableElement.removeEventListener('scroll', handleScroll);
    }
  }, [virtualized, handleScroll]);

  // Render table header cell
  const renderHeaderCell = useCallback((column: Column<T>) => {
    const isSorted = sortState?.key === column.key;
    const ariaSort = isSorted 
      ? sortState.order === 'asc' ? ARIA_SORT_STATES.ASC : ARIA_SORT_STATES.DESC
      : ARIA_SORT_STATES.NONE;

    return (
      <th
        key={column.key}
        style={{ width: column.width }}
        className={classNames('table-header-cell', headerClassName, {
          'table-header-cell--sortable': column.sortable && sortable,
          'table-header-cell--sorted': isSorted,
          'table-header-cell--secure': secure && column.isPHI
        })}
        onClick={() => column.sortable && handleSort(column.key)}
        role="columnheader"
        aria-sort={column.sortable ? ariaSort : undefined}
        aria-label={column.accessibilityLabel || column.title}
      >
        <div className="table-header-cell-content">
          {column.title}
          {column.sortable && sortable && (
            <span className="table-sort-icon" aria-hidden="true">
              {isSorted ? (sortState.order === 'asc' ? '↑' : '↓') : '↕'}
            </span>
          )}
        </div>
      </th>
    );
  }, [sortState, sortable, secure, headerClassName, handleSort]);

  // Render table cell with PHI protection
  const renderCell = useCallback((record: T, column: Column<T>) => {
    const value = record[column.key];
    const content = column.render ? column.render(value, record) : value;

    return (
      <td
        key={column.key}
        className={classNames('table-cell', cellClassName, {
          'table-cell--secure': secure && column.isPHI,
          'table-cell--phi': column.isPHI
        })}
        data-phi={column.isPHI ? 'true' : undefined}
      >
        {content}
      </td>
    );
  }, [secure, cellClassName]);

  // Calculate virtualized styles
  const virtualizedStyles = useMemo(() => ({
    height: data.length * VIRTUAL_ROW_HEIGHT,
    transform: `translateY(${visibleRange.start * VIRTUAL_ROW_HEIGHT}px)`
  }), [data.length, visibleRange.start]);

  // Render table content
  const tableContent = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={columns.length} className="table-loading-cell">
            <Loading size="lg" text="Loading data..." />
          </td>
        </tr>
      );
    }

    if (!data.length) {
      return (
        <tr>
          <td colSpan={columns.length} className="table-empty-cell">
            {emptyMessage}
          </td>
        </tr>
      );
    }

    const rowsToRender = virtualized ? 
      data.slice(visibleRange.start, visibleRange.end) : 
      data;

    return rowsToRender.map((record) => (
      <tr
        key={getRowKey(record)}
        className={classNames('table-row', {
          'table-row--clickable': !!onRowClick,
          [typeof rowClassName === 'function' ? rowClassName(record) : rowClassName || '']: true
        })}
        onClick={() => onRowClick?.(record)}
        role="row"
      >
        {columns.map((column) => renderCell(record, column))}
      </tr>
    ));
  }, [
    loading, columns, data, virtualized, visibleRange, 
    emptyMessage, getRowKey, onRowClick, rowClassName, renderCell
  ]);

  return (
    <div className={classNames('table-container', className)} ref={tableRef}>
      <table
        className={classNames('table', {
          'table--secure': secure,
          'table--loading': loading,
          'table--empty': !data.length,
          'table--virtualized': virtualized
        })}
        role="grid"
        aria-busy={loading}
        aria-rowcount={totalItems || data.length}
      >
        <thead ref={headerRef}>
          <tr role="row">
            {columns.map(renderHeaderCell)}
          </tr>
        </thead>
        <tbody style={virtualized ? virtualizedStyles : undefined}>
          {tableContent}
        </tbody>
      </table>

      {(totalItems !== undefined && onPageChange) && (
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange!}
          disabled={loading}
        />
      )}
    </div>
  );
});

Table.displayName = 'Table';

export default Table;