// @testing-library/jest-dom v5.16.5
// @testing-library/react v13.4.0
// jest-environment-jsdom v29.0.0

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import type { Config } from '@jest/types';

/**
 * Global test setup configuration for React component testing with enhanced
 * HIPAA compliance and security considerations.
 * 
 * This setup file configures the test environment with:
 * - DOM testing utilities and custom matchers
 * - HIPAA-compliant mocks for browser APIs
 * - Security-focused test environment configurations
 * - Audit logging for test execution
 */

// Configure testing library options
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
  computedStyleSupportsPseudoElements: true,
  defaultHidden: true,
});

// Set up enhanced window.matchMedia mock
window.matchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Implement secure ResizeObserver mock
class MockResizeObserver {
  private observedElements: Set<Function>;

  constructor() {
    this.observedElements = new Set();
  }

  observe = jest.fn((element: Element) => {
    if (!element) {
      throw new Error('HIPAA-compliant error: Invalid element for observation');
    }
  });

  unobserve = jest.fn((element: Element) => {
    if (!element) {
      throw new Error('HIPAA-compliant error: Invalid element for unobservation');
    }
  });

  disconnect = jest.fn();
}

window.ResizeObserver = MockResizeObserver;

// Set up HIPAA-compliant fetch API mock
global.fetch = jest.fn().mockImplementation(async (url: string, options?: RequestInit) => {
  if (!url) {
    throw new Error('HIPAA-compliant error: Invalid request URL');
  }

  // Validate request headers for security
  if (options?.headers) {
    const headers = new Headers(options.headers);
    if (!headers.get('Authorization')) {
      throw new Error('HIPAA-compliant error: Missing authorization header');
    }
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    blob: async () => new Blob(),
    headers: new Headers(),
  };
});

// Configure secure localStorage mock with data sanitization
const secureLocalStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string): string | null => {
      if (!key) {
        throw new Error('HIPAA-compliant error: Invalid storage key');
      }
      return store[key] || null;
    }),
    setItem: jest.fn((key: string, value: string): void => {
      if (!key) {
        throw new Error('HIPAA-compliant error: Invalid storage key');
      }
      // Sanitize sensitive data before storage
      const sanitizedValue = value.replace(/\b\d{9}\b/g, '[REDACTED]'); // Redact SSN-like patterns
      store[key] = sanitizedValue;
    }),
    removeItem: jest.fn((key: string): void => {
      delete store[key];
    }),
    clear: jest.fn((): void => {
      store = {};
    }),
    length: 0,
    key: jest.fn((index: number): string | null => null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: secureLocalStorageMock });

// Implement sessionStorage mock for state management testing
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

/**
 * Sets up global mock implementations required for testing React components
 * with HIPAA compliance and security considerations.
 */
export function setupGlobalMocks(): void {
  // Set up test environment audit logging
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    // Add timestamp and test context to logs
    const timestamp = new Date().toISOString();
    originalConsoleLog(`[${timestamp}] [TEST]`, ...args);
  };

  // Configure cleanup handlers for sensitive test data
  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear storage
    secureLocalStorageMock.clear();
    sessionStorageMock.clear();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  // Set up global error boundary for tests
  window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
    console.error('HIPAA-compliant error handler:', {
      message: error?.message || message,
      source: source?.replace(/\/.*\//, '[REDACTED]/'), // Redact file paths
      line: lineno,
      column: colno,
    });
    return true;
  };
}

// Export configuration for Jest
export const jestConfig: Config.InitialOptions = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transformIgnorePatterns: ['/node_modules/(?!@mui|@emotion|@material-ui)'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.ts',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
};