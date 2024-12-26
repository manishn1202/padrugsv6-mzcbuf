// @version @reduxjs/toolkit@1.9.0
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { PriorAuthRequest, PriorAuthResponse } from '../../types/priorAuth';
import { createPriorAuth } from '../../lib/api/priorAuth';

// Type definitions for state management
interface PriorAuthState {
  requests: Record<string, PriorAuthRequest>;
  requestsById: string[];
  loadingStates: Record<string, boolean>;
  errorStates: Record<string, string | null>;
  cache: {
    data: Record<string, PriorAuthResponse>;
    ttl: Record<string, number>;
    size: number;
  };
  list: {
    data: string[];
    total: number;
    pageSize: number;
    currentPage: number;
  };
  metadata: {
    lastUpdated: string | null;
    syncStatus: 'idle' | 'syncing' | 'error';
  };
}

// Cache configuration
const CACHE_MAX_SIZE = 1000; // Maximum number of cached requests
const CACHE_TTL = 300000; // 5 minutes in milliseconds

// Initial state with optimized data structure
const initialState: PriorAuthState = {
  requests: {},
  requestsById: [],
  loadingStates: {},
  errorStates: {},
  cache: {
    data: {},
    ttl: {},
    size: 0
  },
  list: {
    data: [],
    total: 0,
    pageSize: 20,
    currentPage: 1
  },
  metadata: {
    lastUpdated: null,
    syncStatus: 'idle'
  }
};

// Async thunk for creating prior authorization requests
export const createPriorAuthRequest = createAsyncThunk<
  PriorAuthResponse,
  PriorAuthRequest,
  { rejectValue: string }
>(
  'priorAuth/create',
  async (request: PriorAuthRequest, { rejectWithValue }) => {
    try {
      // Generate temporary ID for optimistic updates
      const tempId = `temp-${Date.now()}`;
      
      // Call API with retry logic
      const response = await createPriorAuth(request);

      // Update cache with response
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create prior authorization request'
      );
    }
  }
);

// Create the prior authorization slice
const priorAuthSlice = createSlice({
  name: 'priorAuth',
  initialState,
  reducers: {
    // Cache management
    clearCache: (state) => {
      state.cache = {
        data: {},
        ttl: {},
        size: 0
      };
    },
    
    // List management
    setPageSize: (state, action) => {
      state.list.pageSize = action.payload;
      state.list.currentPage = 1;
    },
    
    setCurrentPage: (state, action) => {
      state.list.currentPage = action.payload;
    },

    // Request management
    removeRequest: (state, action) => {
      const id = action.payload;
      delete state.requests[id];
      state.requestsById = state.requestsById.filter(reqId => reqId !== id);
      delete state.loadingStates[id];
      delete state.errorStates[id];
    },

    // Error management
    clearError: (state, action) => {
      state.errorStates[action.payload] = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Create request handling
      .addCase(createPriorAuthRequest.pending, (state, action) => {
        const tempId = `temp-${Date.now()}`;
        state.loadingStates[tempId] = true;
        state.errorStates[tempId] = null;
        state.metadata.syncStatus = 'syncing';
      })
      .addCase(createPriorAuthRequest.fulfilled, (state, action) => {
        const { request_id, request } = action.payload;
        
        // Update request data
        state.requests[request_id] = request;
        state.requestsById.unshift(request_id);
        
        // Update cache
        state.cache.data[request_id] = action.payload;
        state.cache.ttl[request_id] = Date.now() + CACHE_TTL;
        state.cache.size++;

        // Cleanup temporary state
        delete state.loadingStates[request_id];
        delete state.errorStates[request_id];
        
        // Update metadata
        state.metadata.lastUpdated = new Date().toISOString();
        state.metadata.syncStatus = 'idle';

        // Cache size management
        if (state.cache.size > CACHE_MAX_SIZE) {
          const oldestId = Object.keys(state.cache.ttl)
            .sort((a, b) => state.cache.ttl[a] - state.cache.ttl[b])[0];
          delete state.cache.data[oldestId];
          delete state.cache.ttl[oldestId];
          state.cache.size--;
        }
      })
      .addCase(createPriorAuthRequest.rejected, (state, action) => {
        const tempId = `temp-${Date.now()}`;
        state.errorStates[tempId] = action.payload || 'Unknown error occurred';
        delete state.loadingStates[tempId];
        state.metadata.syncStatus = 'error';
      });
  }
});

// Memoized selectors for optimized state access
export const selectAllRequests = createSelector(
  [(state: { priorAuth: PriorAuthState }) => state.priorAuth.requests],
  (requests) => Object.values(requests)
);

export const selectRequestById = createSelector(
  [
    (state: { priorAuth: PriorAuthState }) => state.priorAuth.requests,
    (_: any, id: string) => id
  ],
  (requests, id) => requests[id]
);

export const selectPaginatedRequests = createSelector(
  [
    (state: { priorAuth: PriorAuthState }) => state.priorAuth.requests,
    (state: { priorAuth: PriorAuthState }) => state.priorAuth.list
  ],
  (requests, list) => {
    const start = (list.currentPage - 1) * list.pageSize;
    const end = start + list.pageSize;
    return list.data.slice(start, end).map(id => requests[id]);
  }
);

// Export actions and reducer
export const { 
  clearCache, 
  setPageSize, 
  setCurrentPage, 
  removeRequest, 
  clearError 
} = priorAuthSlice.actions;

export default priorAuthSlice.reducer;