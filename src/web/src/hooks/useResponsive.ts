import useMediaQuery from './useMediaQuery';

/**
 * Breakpoint constants for responsive design based on technical specifications
 * @version 1.0.0
 */
const BREAKPOINTS = {
  MOBILE: '576px',    // Mobile breakpoint (<576px)
  TABLET: '992px',    // Tablet breakpoint (576px-992px)
  DESKTOP: '1200px'   // Large desktop breakpoint (>1200px)
} as const;

/**
 * Interface defining the return type of useResponsive hook
 */
interface ResponsiveBreakpoints {
  isMobile: boolean;      // True for screens <576px
  isTablet: boolean;      // True for screens 576px-992px
  isDesktop: boolean;     // True for screens >992px
  isLargeScreen: boolean; // True for screens >1200px
}

/**
 * Custom hook that provides semantic breakpoint checks for responsive design
 * using a mobile-first approach. Ensures SSR compatibility and optimal performance
 * through proper media query handling.
 * 
 * Based on technical specifications section 6.4 Responsive Design Breakpoints
 * and 3.1.2 Interface Layouts requirements.
 * 
 * @returns {ResponsiveBreakpoints} Object containing boolean flags for each breakpoint
 * 
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop, isLargeScreen } = useResponsive();
 * 
 * return (
 *   <div>
 *     {isMobile && <MobileLayout />}
 *     {isTablet && <TabletLayout />}
 *     {isDesktop && <DesktopLayout />}
 *     {isLargeScreen && <EnhancedDesktopLayout />}
 *   </div>
 * );
 * ```
 */
const useResponsive = (): ResponsiveBreakpoints => {
  // Define media queries using mobile-first approach
  const isMobileQuery = useMediaQuery(`(max-width: ${BREAKPOINTS.MOBILE})`);
  const isTabletQuery = useMediaQuery(
    `(min-width: ${BREAKPOINTS.MOBILE}) and (max-width: ${BREAKPOINTS.TABLET})`
  );
  const isDesktopQuery = useMediaQuery(`(min-width: ${BREAKPOINTS.TABLET})`);
  const isLargeScreenQuery = useMediaQuery(`(min-width: ${BREAKPOINTS.DESKTOP})`);

  return {
    // Mobile: Screens smaller than MOBILE breakpoint
    isMobile: isMobileQuery,
    
    // Tablet: Screens between MOBILE and TABLET breakpoints
    isTablet: isTabletQuery,
    
    // Desktop: Screens larger than TABLET breakpoint
    isDesktop: isDesktopQuery,
    
    // Large Screen: Screens larger than DESKTOP breakpoint
    isLargeScreen: isLargeScreenQuery
  };
};

export default useResponsive;