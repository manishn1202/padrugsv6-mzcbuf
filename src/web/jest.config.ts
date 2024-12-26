// @jest/types v29.0.0

import type { Config } from '@jest/types';
import { setupGlobalMocks } from './tests/setup';

/**
 * Jest configuration with enhanced security and HIPAA compliance settings.
 * This configuration ensures comprehensive testing coverage, secure test data handling,
 * and proper isolation of test environments.
 */
const config: Config.InitialOptions = {
  // Use jsdom for secure DOM testing environment
  testEnvironment: 'jsdom',

  // Security-focused setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts',
    '<rootDir>/security.setup.ts'
  ],

  // Test matching patterns including security-specific tests
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/tests/security/**/*.test.{ts,tsx}'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Secure asset and module mapping
  moduleNameMapper: {
    // Handle style imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Secure handling of binary assets
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.ts',
    // Path aliases for secure module resolution
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Enhanced coverage collection with security focus
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
    // Include security-specific files
    'src/security/**/*.{ts,tsx}'
  ],

  // Strict coverage thresholds with higher requirements for security code
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher threshold for security-critical code
    'src/security/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Configure module resolution
  transformIgnorePatterns: [
    '/node_modules/(?!@mui|@emotion)'
  ],
  moduleDirectories: [
    'node_modules',
    'src'
  ],

  // Secure test environment options
  testEnvironmentOptions: {
    url: 'http://localhost',
    testIdAttribute: 'data-testid'
  },

  // TypeScript configuration for secure testing
  globals: {
    'ts-jest': {
      isolatedModules: true,
      diagnostics: {
        warnOnly: true
      }
    }
  },

  // Configure test reporting with security considerations
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage/junit',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › '
    }]
  ],

  // Reset mocks between tests for isolation
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};

// Initialize global mocks with security enhancements
setupGlobalMocks();

export default config;