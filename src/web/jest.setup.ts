/**
 * Jest Setup Configuration
 * Version: 1.0.0
 * 
 * This file configures the Jest testing environment with:
 * - Enhanced HIPAA compliance measures
 * - Security-focused testing utilities
 * - Custom DOM matchers and assertions
 * - Global mocks for browser APIs
 * - Comprehensive test coverage requirements
 * 
 * External Dependencies:
 * @testing-library/jest-dom ^5.16.5
 * @testing-library/react ^13.4.0
 * jest-environment-jsdom ^29.0.0
 * jest-mock-console ^2.0.0
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import mockConsole from 'jest-mock-console';
import setupGlobalMocks from './tests/setup';

// Initialize test environment with enhanced security measures
const initializeTestEnvironment = (): void => {
  // Configure React Testing Library
  configure({
    testIdAttribute: 'data-testid',
    asyncUtilTimeout: 5000,
    computedStyleSupportsPseudoElements: true,
    defaultHidden: true,
  });

  // Set up console mocking for security logging validation
  mockConsole();

  // Initialize global mocks with HIPAA compliance
  setupGlobalMocks();
};

// Configure global mocks for browser APIs with security validation
window.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  matches: window.innerWidth > parseInt(query)
}));

// Secure ResizeObserver mock with tracking
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  callback: jest.fn()
}));

// Enhanced fetch mock with auth validation
global.fetch = jest.fn().mockImplementation(async (url, options) => {
  if (!options?.headers?.Authorization) {
    throw new Error('Missing Authorization Header');
  }
  return {
    ok: true,
    json: async () => ({})
  };
});

// Secure localStorage mock with error handling
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn((key) => {
      if (!key) throw new Error('Invalid key access');
      return null;
    }),
    setItem: jest.fn((key, value) => {
      if (!key || !value) throw new Error('Invalid storage operation');
    }),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  },
  writable: true
});

// Secure sessionStorage mock with validation
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn((key) => {
      if (!key) throw new Error('Invalid key access');
      return null;
    }),
    setItem: jest.fn((key, value) => {
      if (!key || !value) throw new Error('Invalid storage operation');
    }),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  },
  writable: true
});

// Secure crypto API mock
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: jest.fn((buffer) => buffer),
    subtle: {
      digest: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    }
  },
  writable: true
});

// Configure Jest with enhanced settings
const jestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transformIgnorePatterns: ['/node_modules/(?!@mui|@emotion)'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.ts'
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },
  testTimeout: 10000,
  maxWorkers: '50%',
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__mocks__/'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
    '!src/tests/**/*'
  ]
};

// Initialize the test environment
initializeTestEnvironment();

// Export configuration for external use
export { jestConfig };