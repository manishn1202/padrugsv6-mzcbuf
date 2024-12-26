/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables in the Prior Authorization Management System
 * @version 1.0.0
 * @package @pa-management/web
 * @hipaa-compliance Ensures type safety for sensitive configuration values
 */

/**
 * Environment variable interface for the Prior Authorization Management System
 * Extends Vite's ImportMetaEnv with strongly-typed custom environment variables
 */
interface ImportMetaEnv {
  /**
   * Base URL for the API endpoints
   * @hipaa-security Must be HTTPS in production
   */
  readonly VITE_API_URL: string;

  /**
   * Authentication domain for identity provider
   * @hipaa-security Must be configured with appropriate security policies
   */
  readonly VITE_AUTH_DOMAIN: string;

  /**
   * Current deployment environment
   * @hipaa-audit Required for audit logging and compliance tracking
   */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /**
   * API request timeout in milliseconds
   * @hipaa-security Prevents hanging connections that could expose PHI
   */
  readonly VITE_API_TIMEOUT: number;

  /**
   * Feature flag for mock API usage
   * @hipaa-security Must be disabled in production
   */
  readonly VITE_ENABLE_MOCK_API: boolean;

  /**
   * Application logging level
   * @hipaa-audit Controls verbosity of security and audit logging
   */
  readonly VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Augments the ImportMeta interface to include our custom environment variables
 * This ensures type safety when accessing import.meta.env
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type declarations for static asset imports
 * Ensures type safety when importing various asset types
 */
declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: { [key: string]: any };
  export default content;
}

declare module '*.pdf' {
  const content: string;
  export default content;
}

/**
 * Type declaration for Web Workers
 * Ensures type safety when importing web workers
 */
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

/**
 * Type declaration for WebAssembly modules
 * Ensures type safety when importing WASM modules
 */
declare module '*?wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}