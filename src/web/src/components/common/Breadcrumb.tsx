import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import classNames from 'classnames';
import Icon from './Icon';
import { ComponentProps } from '../../types/common';

/**
 * Interface for individual breadcrumb items
 */
interface BreadcrumbItem {
  /** Display text for the breadcrumb item */
  label: string;
  /** Navigation path for the breadcrumb item */
  path: string;
  /** Whether this is the current active item */
  active?: boolean;
  /** Optional icon name for visual enhancement */
  icon?: string;
}

/**
 * Props interface for Breadcrumb component
 */
interface BreadcrumbProps extends ComponentProps {
  /** Array of breadcrumb items to display */
  items: BreadcrumbItem[];
  /** Optional custom separator icon name */
  separator?: string;
  /** Maximum number of items to display before truncating */
  maxItems?: number;
  /** Custom aria-label for the breadcrumb navigation */
  ariaLabel?: string;
}

/**
 * A breadcrumb navigation component that displays the current page location
 * within the application hierarchy. Supports both static and dynamic navigation
 * paths with enhanced accessibility and responsive design.
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = 'chevron-right',
  className,
  maxItems = 5,
  ariaLabel = 'Page navigation'
}) => {
  /**
   * Handles truncation of breadcrumb items when exceeding maxItems
   */
  const truncateItems = (items: BreadcrumbItem[], maxItems: number): BreadcrumbItem[] => {
    if (items.length <= maxItems) return items;

    const truncatedItems: BreadcrumbItem[] = [];
    const ellipsisItem: BreadcrumbItem = {
      label: '...',
      path: '',
      active: false
    };

    // Always show first item
    truncatedItems.push(items[0]);

    // Add ellipsis if there are hidden items
    if (items.length > maxItems) {
      truncatedItems.push(ellipsisItem);
    }

    // Add remaining visible items
    const remainingCount = maxItems - 2; // Account for first item and ellipsis
    const endItems = items.slice(-remainingCount);
    truncatedItems.push(...endItems);

    return truncatedItems;
  };

  /**
   * Memoized truncated items array
   */
  const displayItems = useMemo(() => {
    return truncateItems(items, maxItems);
  }, [items, maxItems]);

  /**
   * Renders a single breadcrumb item with proper accessibility attributes
   */
  const renderItem = (item: BreadcrumbItem, index: number, isLast: boolean) => {
    const itemClasses = classNames(
      'transition-colors duration-200 outline-none',
      {
        'text-gray-600 hover:text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2': !item.active,
        'text-gray-900 font-medium pointer-events-none': item.active,
        'truncate max-w-[160px] sm:max-w-[240px]': true
      }
    );

    const content = (
      <>
        {item.icon && (
          <Icon 
            name={item.icon}
            className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0"
            aria-hidden="true"
          />
        )}
        <span>{item.label}</span>
      </>
    );

    // Render as span if active/last item, Link if not
    const itemElement = item.active || isLast ? (
      <span 
        className={itemClasses}
        aria-current="page"
      >
        {content}
      </span>
    ) : (
      <Link
        to={item.path}
        className={itemClasses}
        aria-label={`Navigate to ${item.label}`}
      >
        {content}
      </Link>
    );

    return (
      <li 
        key={index}
        className="flex items-center"
      >
        {itemElement}
        
        {!isLast && (
          <Icon
            name={separator}
            className="w-5 h-5 mx-2 text-gray-400 rtl:rotate-180"
            aria-hidden="true"
          />
        )}
      </li>
    );
  };

  // Don't render if no items
  if (!items?.length) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={classNames(
        'min-w-0 w-full',
        className
      )}
    >
      <ol
        className="flex items-center flex-wrap gap-y-2 text-sm"
        role="list"
      >
        {displayItems.map((item, index) => 
          renderItem(item, index, index === displayItems.length - 1)
        )}
      </ol>
    </nav>
  );
};

export default Breadcrumb;