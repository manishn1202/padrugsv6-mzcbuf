import React from 'react';
import classNames from 'classnames';
import Card from '../common/Card';
import Icon from '../common/Icon';
import { Size } from '../../types/common';

/**
 * Props interface for AnalyticsCard component
 */
interface AnalyticsCardProps {
  /** Title of the analytics metric */
  title: string;
  /** Current value of the metric */
  value: number | string;
  /** Icon name to display */
  icon: string;
  /** Direction of metric change */
  trend: 'up' | 'down' | 'neutral';
  /** Percentage change in metric value */
  percentageChange: number;
  /** Optional CSS class name */
  className?: string;
  /** Locale for number formatting */
  locale?: string;
}

/**
 * Returns the appropriate color class based on trend direction
 * following design system color tokens
 */
const getTrendColor = (trend: 'up' | 'down' | 'neutral'): string => {
  switch (trend) {
    case 'up':
      return 'text-success'; // #28A745
    case 'down':
      return 'text-error'; // #DC3545
    default:
      return 'text-secondary'; // #6C757D
  }
};

/**
 * Formats percentage value with proper sign and localization
 */
const formatPercentage = (value: number, locale: string = 'en-US'): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
};

/**
 * AnalyticsCard component displays KPI metrics with trend indicators
 * in a card format following the design system specifications.
 * 
 * @example
 * ```tsx
 * <AnalyticsCard
 *   title="Processing Time"
 *   value="2.5 days"
 *   icon="timer"
 *   trend="down"
 *   percentageChange={-70}
 * />
 * ```
 */
const AnalyticsCard: React.FC<AnalyticsCardProps> = React.memo(({
  title,
  value,
  icon,
  trend,
  percentageChange,
  className,
  locale = 'en-US'
}) => {
  // Get trend color based on direction
  const trendColorClass = getTrendColor(trend);
  
  // Format percentage change with sign and localization
  const formattedChange = formatPercentage(percentageChange, locale);

  return (
    <Card 
      variant="elevated"
      padding="large"
      className={classNames('analytics-card', className)}
      role="region"
      ariaLabel={`${title} analytics card`}
    >
      <div className="analytics-card__header">
        <Icon 
          name={icon}
          size={Size.LG}
          className="analytics-card__icon"
          ariaLabel={`${title} icon`}
        />
        <h3 className="analytics-card__title">{title}</h3>
      </div>

      <div className="analytics-card__content">
        <div className="analytics-card__value" aria-label={`Current value: ${value}`}>
          {value}
        </div>
        
        <div 
          className={classNames(
            'analytics-card__trend',
            trendColorClass
          )}
          aria-label={`Trend: ${trend}, Change: ${formattedChange}`}
        >
          <Icon 
            name={trend === 'up' ? 'arrow-up' : trend === 'down' ? 'arrow-down' : 'arrow-right'}
            size={Size.SM}
            className="analytics-card__trend-icon"
          />
          <span className="analytics-card__percentage">
            {formattedChange}
          </span>
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
AnalyticsCard.displayName = 'AnalyticsCard';

export default AnalyticsCard;

/**
 * Default styles for the AnalyticsCard component
 * These should be included in your CSS/SCSS files
 *
 * .analytics-card {
 *   min-width: 240px;
 * }
 * 
 * .analytics-card__header {
 *   display: flex;
 *   align-items: center;
 *   gap: var(--spacing-md);
 *   margin-bottom: var(--spacing-md);
 * }
 * 
 * .analytics-card__icon {
 *   color: var(--color-primary);
 * }
 * 
 * .analytics-card__title {
 *   font-size: var(--font-size-md);
 *   font-weight: var(--font-weight-medium);
 *   color: var(--color-text-secondary);
 *   margin: 0;
 * }
 * 
 * .analytics-card__content {
 *   display: flex;
 *   align-items: baseline;
 *   justify-content: space-between;
 * }
 * 
 * .analytics-card__value {
 *   font-size: var(--font-size-2xl);
 *   font-weight: var(--font-weight-bold);
 *   color: var(--color-text-primary);
 * }
 * 
 * .analytics-card__trend {
 *   display: flex;
 *   align-items: center;
 *   gap: var(--spacing-xs);
 *   font-size: var(--font-size-sm);
 *   font-weight: var(--font-weight-medium);
 * }
 * 
 * .text-success {
 *   color: var(--color-success);
 * }
 * 
 * .text-error {
 *   color: var(--color-error);
 * }
 * 
 * .text-secondary {
 *   color: var(--color-text-secondary);
 * }
 */