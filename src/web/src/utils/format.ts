import { format as dateFormat } from 'date-fns';
import { Colors } from '../types/common';

// Constants for color mapping from common types
const STATUS_COLORS: Colors = {
  primary: '#0066CC',
  secondary: '#00A3E0',
  success: '#28A745',
  warning: '#FFC107',
  error: '#DC3545'
};

/**
 * Formats a number as USD currency
 * @version 1.0.0
 * @param amount - Number to format as currency
 * @returns Formatted currency string with $ symbol and 2 decimal places
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formats a decimal as percentage
 * @version 1.0.0
 * @param value - Decimal value to format as percentage
 * @returns Formatted percentage string with % symbol
 */
export const formatPercentage = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '';
  }

  const percentage = Math.min(value * 100, 100); // Cap at 100%
  return `${percentage.toFixed(1)}%`;
};

/**
 * Formats a phone number string into (XXX) XXX-XXXX format
 * @version 1.0.0
 * @param phoneNumber - Phone number string to format
 * @returns Formatted phone number string
 */
export const formatPhoneNumber = (phoneNumber: string | undefined | null): string => {
  if (!phoneNumber) {
    return '';
  }

  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Validate length
  if (cleaned.length !== 10) {
    return '';
  }

  // Format as (XXX) XXX-XXXX
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

/**
 * Formats and validates National Provider Identifier (NPI) number
 * Implements the NPI checksum algorithm per HIPAA standards
 * @version 1.0.0
 * @param npi - NPI number to format and validate
 * @returns Formatted NPI number if valid, empty string if invalid
 */
export const formatNPI = (npi: string | undefined | null): string => {
  if (!npi) {
    return '';
  }

  // Remove non-numeric characters
  const cleaned = npi.replace(/\D/g, '');

  // Validate length
  if (cleaned.length !== 10) {
    return '';
  }

  // NPI checksum validation
  const digits = cleaned.split('').map(Number);
  const checkDigit = digits.pop()!;
  
  // Calculate checksum
  let sum = 0;
  digits.forEach((digit, index) => {
    sum += index % 2 === 0 ? digit * 2 : digit;
  });
  
  const calculatedCheck = (10 - (sum % 10)) % 10;

  // Validate checksum
  if (calculatedCheck !== checkDigit) {
    console.warn(`Invalid NPI checksum for: ${npi}`);
    return '';
  }

  // Format with proper spacing
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
};

/**
 * Formats National Drug Code (NDC) with proper separators
 * Supports both 10 and 11 digit formats per FDA standards
 * @version 1.0.0
 * @param ndc - NDC code to format
 * @returns Formatted NDC code with proper hyphens
 */
export const formatDrugCode = (ndc: string | undefined | null): string => {
  if (!ndc) {
    return '';
  }

  // Remove non-numeric characters
  const cleaned = ndc.replace(/\D/g, '');

  // Handle 10-digit format
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }

  // Handle 11-digit format
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
  }

  console.warn(`Invalid NDC length for: ${ndc}`);
  return '';
};

/**
 * Formats request status with appropriate color and label
 * @version 1.0.0
 * @param status - Status string to format
 * @returns Formatted status object with color, label and optional icon
 */
export const formatStatus = (status: string): { 
  color: string; 
  label: string; 
  icon?: string;
} => {
  const statusMap: Record<string, {
    color: string;
    label: string;
    icon?: string;
  }> = {
    pending: {
      color: STATUS_COLORS.warning,
      label: 'Pending Review',
      icon: 'clock'
    },
    approved: {
      color: STATUS_COLORS.success,
      label: 'Approved',
      icon: 'check-circle'
    },
    denied: {
      color: STATUS_COLORS.error,
      label: 'Denied',
      icon: 'x-circle'
    },
    inProgress: {
      color: STATUS_COLORS.primary,
      label: 'In Progress',
      icon: 'refresh'
    }
  };

  return statusMap[status.toLowerCase()] || {
    color: STATUS_COLORS.secondary,
    label: status,
    icon: 'question-circle'
  };
};

/**
 * Formats a date string according to specified format
 * @version date-fns@2.30.0
 * @param date - Date to format
 * @param formatString - Optional format string (defaults to MM/dd/yyyy)
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | number | null | undefined,
  formatString: string = 'MM/dd/yyyy'
): string => {
  if (!date) {
    return '';
  }

  try {
    return dateFormat(new Date(date), formatString);
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};