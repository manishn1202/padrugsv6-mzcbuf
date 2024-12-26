import { useState, useEffect, useCallback } from 'react';

/**
 * Type definition for media query event handler function
 */
type MediaQueryHandler = (event: MediaQueryListEvent) => void;

/**
 * Type for handling window object in SSR context
 */
type SSRSafeWindow = Window | undefined;

/**
 * Custom React hook that provides media query matching functionality.
 * Supports SSR, includes proper cleanup, and handles browser compatibility.
 * 
 * @version React 18.2.0
 * @param {string} query - CSS media query string (e.g. '(min-width: 768px)')
 * @returns {boolean} True if media query matches, false otherwise
 * 
 * @example
 * ```tsx
 * const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
 * 
 * // Use in components
 * return (
 *   <div>
 *     {isTablet ? <TabletLayout /> : <DefaultLayout />}
 *   </div>
 * );
 * ```
 */
const useMediaQuery = (query: string): boolean => {
  // Safely check for window object (SSR compatibility)
  const getSSRSafeWindow = (): SSRSafeWindow => {
    return typeof window !== 'undefined' ? window : undefined;
  };

  // Get initial state by checking media query match if in browser context
  const getInitialState = (): boolean => {
    const win = getSSRSafeWindow();
    try {
      return win?.matchMedia?.(query)?.matches ?? false;
    } catch (error) {
      console.warn(`Invalid media query: ${query}`, error);
      return false;
    }
  };

  // Initialize state with proper type
  const [matches, setMatches] = useState<boolean>(getInitialState());

  // Memoized handler to prevent unnecessary re-renders
  const handleChange = useCallback((event: MediaQueryListEvent): void => {
    setMatches(event.matches);
  }, []);

  useEffect(() => {
    const win = getSSRSafeWindow();

    // Return early if in SSR context or matchMedia not supported
    if (!win?.matchMedia) {
      return undefined;
    }

    let mediaQueryList: MediaQueryList;
    
    try {
      mediaQueryList = win.matchMedia(query);
      
      // Set initial state
      setMatches(mediaQueryList.matches);

      // Handle modern browsers
      if (typeof mediaQueryList.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', handleChange);
      } 
      // Handle older browsers (e.g. Safari < 14)
      else if (typeof mediaQueryList.addListener === 'function') {
        mediaQueryList.addListener(handleChange as any);
      }

      // Cleanup function
      return () => {
        if (typeof mediaQueryList.removeEventListener === 'function') {
          mediaQueryList.removeEventListener('change', handleChange);
        } else if (typeof mediaQueryList.removeListener === 'function') {
          mediaQueryList.removeListener(handleChange as any);
        }
      };
    } catch (error) {
      console.warn(`Error setting up media query listener for: ${query}`, error);
      return undefined;
    }
  }, [query, handleChange]); // Only re-run if query or handler changes

  return matches;
};

export default useMediaQuery;