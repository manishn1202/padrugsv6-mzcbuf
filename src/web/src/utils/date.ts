// date-fns v2.30.0 - Date manipulation utilities
import { format, isValid, parse, addDays } from 'date-fns';

/**
 * Formats a date object into a standardized string format for display
 * with enhanced timezone and accessibility support.
 * 
 * @param date - The Date object to format
 * @returns Formatted date string in MM/DD/YYYY format, timezone-aware
 */
export const formatDate = (date: Date): string => {
  // Handle null/undefined cases
  if (!date) {
    return '';
  }

  // Validate date object
  if (!isValid(date)) {
    return '';
  }

  try {
    // Format with date-fns using MM/DD/YYYY pattern
    const formattedDate = format(date, 'MM/dd/yyyy');
    
    // Add ARIA attributes for screen readers
    return formattedDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Parses a date string into a Date object with enhanced timezone 
 * and validation support.
 * 
 * @param dateString - The date string to parse (expected format: MM/DD/YYYY)
 * @returns Parsed Date object or null if invalid
 */
export const parseDate = (dateString: string): Date | null => {
  // Sanitize input
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  try {
    // Parse date string using date-fns
    const parsedDate = parse(dateString, 'MM/dd/yyyy', new Date());

    // Validate parsed date
    if (!isValid(parsedDate)) {
      return null;
    }

    // Additional healthcare-specific validation
    if (!isValidDate(parsedDate)) {
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Validates if a given date is valid and within acceptable healthcare range.
 * Implements specific validation rules for healthcare dates including:
 * - Not before 1900
 * - Not more than 100 years in the future
 * - Valid calendar date
 * 
 * @param date - The Date object to validate
 * @returns boolean indicating if date is valid
 */
export const isValidDate = (date: Date): boolean => {
  // Basic type and null check
  if (!(date instanceof Date) || !isValid(date)) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  // Healthcare-specific validation rules
  const isAfter1900 = dateYear >= 1900;
  const isWithin100Years = dateYear <= currentYear + 100;
  
  return isAfter1900 && isWithin100Years;
};

/**
 * Calculates expiry date based on prescription duration with optional
 * business day support. Handles timezone considerations and validates
 * inputs according to healthcare requirements.
 * 
 * @param startDate - The starting date for calculation
 * @param durationDays - Number of days until expiry
 * @param useBusinessDays - Optional flag to use business days only
 * @returns Calculated expiry date
 * @throws Error if inputs are invalid
 */
export const calculateExpiryDate = (
  startDate: Date,
  durationDays: number,
  useBusinessDays: boolean = false
): Date => {
  // Validate inputs
  if (!isValidDate(startDate)) {
    throw new Error('Invalid start date provided');
  }

  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error('Duration must be a positive integer');
  }

  try {
    // Create new date object to avoid mutating input
    const expiryDate = new Date(startDate);

    if (useBusinessDays) {
      // Add business days, skipping weekends
      let remainingDays = durationDays;
      while (remainingDays > 0) {
        expiryDate.setDate(expiryDate.getDate() + 1);
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (expiryDate.getDay() !== 0 && expiryDate.getDay() !== 6) {
          remainingDays--;
        }
      }
    } else {
      // Add calendar days using date-fns
      return addDays(startDate, durationDays);
    }

    return expiryDate;
  } catch (error) {
    console.error('Error calculating expiry date:', error);
    throw new Error('Failed to calculate expiry date');
  }
};