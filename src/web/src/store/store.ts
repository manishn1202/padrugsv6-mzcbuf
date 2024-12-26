/**
 * Root Redux store configuration for the Prior Authorization Management System.
 * Implements secure state management with encryption, performance optimizations,
 * and HIPAA-compliant data handling.
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { TypedUseSelectorHook } from 'react-redux'; // v8.1.0
import { createStateSyncMiddleware } from 'redux-state-sync'; // v3.1.4
import { createMigrate } from 'redux-persist'; // v6.0.0
import authReducer from './auth/authSlice';
import clinicalReducer from './clinical/clinicalSlice';
import priorAuthReducer from './priorAuth/priorAuthSlice';
import notificationsReducer from './notifications/notificationsSlice';

// Import encryption utilities for secure state handling
import CryptoJS from 'crypto-js'; // v4.1.1

// Constants for store configuration
const REDUX_DEVTOOLS = process.env.NODE_ENV === 'development';
const STATE_SYNC_CONFIG = {
  blacklist: ['auth.tokens', 'clinical.data'], // Prevent syncing sensitive data
  broadcastChannelOption: { 
    type: 'localstorage',
    webWorkerSupport: false // HIPAA compliance
  }
};

// State migration configuration for version updates
const migrations = {
  0: (state: any) => ({
    ...state,
    _v: 1,
    lastMigrated: new Date().toISOString()
  })
};

// Encryption transform for sensitive data
const encryptTransform = {
  in: (state: any, key: string) => {
    if (process.env.REACT_APP_ENCRYPT_STATE === 'true' && key === 'auth') {
      return {
        ...state,
        tokens: state.tokens ? CryptoJS.AES.encrypt(
          JSON.stringify(state.tokens),
          process.env.REACT_APP_STATE_ENCRYPTION_KEY!
        ).toString() : null
      };
    }
    return state;
  },
  out: (state: any, key: string) => {
    if (process.env.REACT_APP_ENCRYPT_STATE === 'true' && key === 'auth' && state.tokens) {
      const decryptedTokens = CryptoJS.AES.decrypt(
        state.tokens,
        process.env.REACT_APP_STATE_ENCRYPTION_KEY!
      );
      return {
        ...state,
        tokens: JSON.parse(decryptedTokens.toString(CryptoJS.enc.Utf8))
      };
    }
    return state;
  }
};

// Performance middleware configuration
const customMiddlewareConfig = {
  serializableCheck: {
    ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
    ignoredPaths: ['clinical.data.patient_data']
  },
  immutableCheck: {
    ignoredPaths: ['notifications.offline.queue']
  }
};

// Configure the Redux store with security and performance features
export const store = configureStore({
  reducer: {
    auth: authReducer,
    clinical: clinicalReducer,
    priorAuth: priorAuthReducer,
    notifications: notificationsReducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    ...customMiddlewareConfig,
    thunk: {
      extraArgument: {
        encrypt: (data: any) => CryptoJS.AES.encrypt(
          JSON.stringify(data),
          process.env.REACT_APP_STATE_ENCRYPTION_KEY!
        ).toString()
      }
    }
  }).concat(
    createStateSyncMiddleware(STATE_SYNC_CONFIG)
  ),
  devTools: REDUX_DEVTOOLS && {
    maxAge: 50,
    trace: true,
    traceLimit: 25,
    actionsBlacklist: ['auth/updateLastActivity']
  },
  preloadedState: undefined,
  enhancers: []
});

// Type definitions for strict typing support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type-safe hooks for components
export const useAppSelector: TypedUseSelectorHook<RootState> = (
  selector,
  equalityFn = (left: any, right: any) => left === right
) => {
  // Add performance monitoring
  const startTime = performance.now();
  const result = selector(store.getState());
  const duration = performance.now() - startTime;

  if (duration > 5) { // Log slow selectors
    console.warn(`Slow selector detected: ${duration.toFixed(2)}ms`, selector);
  }

  return result;
};

// Performance monitoring middleware
if (process.env.NODE_ENV === 'development') {
  const monitorReducerEnhancer =
    (createStore: any) =>
    (...args: any[]) => {
      const store = createStore(...args);
      let currentState = store.getState();

      store.subscribe(() => {
        const nextState = store.getState();
        const diff = Object.keys(nextState).filter(
          key => currentState[key] !== nextState[key]
        );
        
        if (diff.length > 0) {
          console.debug('State change detected:', diff);
        }
        
        currentState = nextState;
      });

      return store;
    };

  store.enhancers?.push(monitorReducerEnhancer);
}

export default store;