// Vite configuration for Prior Authorization Management System
// Version: 4.3.0

import { defineConfig } from 'vite'; // ^4.3.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import path from 'path';

export default defineConfig({
  // React plugin configuration with Fast Refresh and Emotion support
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    })
  ],

  // Path resolution and aliases matching TypeScript configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    // API proxy configuration for backend integration
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    },
    // Hot Module Replacement settings
    hmr: {
      overlay: true
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'es2015',
    chunkSizeWarningLimit: 2000,
    // Terser optimization options
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Rollup specific options for chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk
          vendor: [
            'react',
            'react-dom',
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled'
          ],
          // State management chunk
          redux: [
            '@reduxjs/toolkit',
            'react-redux'
          ],
          // Form handling chunk
          forms: [
            'react-hook-form',
            'yup'
          ],
          // API and utilities chunk
          utils: [
            'axios',
            'date-fns',
            'lodash'
          ]
        }
      }
    }
  },

  // Preview server configuration
  preview: {
    port: 3000,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store'
    }
  },

  // Environment and global variable definitions
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    '__API_URL__': JSON.stringify(process.env.VITE_API_URL)
  },

  // Dependency optimization configuration
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      '@reduxjs/toolkit',
      'react-redux',
      'react-hook-form',
      'yup',
      'axios',
      'date-fns',
      'lodash'
    ],
    exclude: [
      // Exclude packages that cause optimization issues
      '@firebase/app'
    ]
  },

  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/variables.scss";'
      }
    }
  },

  // Esbuild configuration
  esbuild: {
    logOverride: {
      'this-is-undefined-in-esm': 'silent'
    }
  }
});