import { createContext, useContext, useState, useEffect, ReactNode } from 'react'; // react@18.2.0
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles'; // @mui/material@5.14.0
import theme from '../config/theme';
import useMediaQuery from '../hooks/useMediaQuery';

// Theme mode type definition
export type ThemeMode = 'light' | 'dark';

// Theme context value type definition
interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  systemPreference: ThemeMode | null;
  isLoading: boolean;
}

// Theme provider props type definition
interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

// Storage key for theme preference
const THEME_STORAGE_KEY = 'theme-mode';

// Custom event for theme changes
const THEME_CHANGE_EVENT = 'themeChange';

// Create theme context with null initial value
const ThemeContext = createContext<ThemeContextType | null>(null);

/**
 * Custom hook to access theme context
 * @returns {ThemeContextType} Theme context value
 * @throws {Error} If used outside ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Theme provider component that manages application-wide theme state
 * Handles system preferences, persistence, and theme switching
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultMode = 'light' 
}) => {
  // State for theme mode and loading status
  const [mode, setMode] = useState<ThemeMode>(defaultMode);
  const [isLoading, setIsLoading] = useState(true);

  // Detect system color scheme preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const systemPreference: ThemeMode = prefersDarkMode ? 'dark' : 'light';

  /**
   * Initialize theme based on stored preference or system setting
   */
  const initializeTheme = () => {
    setIsLoading(true);
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
        setMode(storedTheme);
      } else {
        setMode(systemPreference);
      }
    } catch (error) {
      console.warn('Failed to access localStorage:', error);
      setMode(systemPreference);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle between light and dark theme modes
   */
  const toggleTheme = () => {
    try {
      const newMode = mode === 'light' ? 'dark' : 'light';
      setMode(newMode);
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      
      // Dispatch theme change event
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { 
        detail: { mode: newMode } 
      }));
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  // Update theme when system preference changes
  useEffect(() => {
    const handleSystemThemeChange = () => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (!storedTheme) {
        setMode(systemPreference);
      }
    };

    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', handleSystemThemeChange);

    return () => {
      window.matchMedia('(prefers-color-scheme: dark)')
        .removeEventListener('change', handleSystemThemeChange);
    };
  }, [systemPreference]);

  // Create theme object based on current mode
  const currentTheme = createTheme({
    ...theme,
    palette: {
      ...theme.palette,
      mode,
      // Adjust background colors based on theme mode
      background: {
        default: mode === 'light' ? '#F8F9FA' : '#121212',
        paper: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
      },
      // Adjust text colors based on theme mode
      text: {
        primary: mode === 'light' ? '#212529' : '#FFFFFF',
        secondary: mode === 'light' ? '#6C757D' : '#A0AEC0',
      },
    },
  });

  // Context value
  const contextValue: ThemeContextType = {
    mode,
    toggleTheme,
    systemPreference,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={currentTheme}>
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;