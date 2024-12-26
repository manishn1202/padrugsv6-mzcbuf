import { useState, useEffect } from 'react'; // v18.2.0

/**
 * A custom hook that provides debouncing functionality to delay the execution of rapidly changing values.
 * Useful for optimizing performance in scenarios like search inputs, form validation, and API calls.
 * 
 * @template T The type of the value being debounced
 * @param {T} value The value to debounce
 * @param {number} delay The delay in milliseconds before the value updates
 * @returns {T} The debounced value
 * 
 * @example
 * // Basic usage with search input
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 * 
 * @example
 * // Usage with form validation
 * const [formValue, setFormValue] = useState('');
 * const debouncedValue = useDebounce(formValue, 300);
 * 
 * @example
 * // Usage with API calls
 * const [queryParam, setQueryParam] = useState('');
 * const debouncedQuery = useDebounce(queryParam, 400);
 */
const useDebounce = <T>(value: T, delay: number): T => {
  // Store the debounced value in state
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Validate delay in development mode
    if (process.env.NODE_ENV === 'development') {
      if (delay < 0) {
        console.warn('useDebounce: delay should be a positive number');
      }
    }

    // Create a timeout to update the debounced value after the specified delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout if value changes or component unmounts
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]); // Only re-run effect if value or delay changes

  return debouncedValue;
};

export default useDebounce;