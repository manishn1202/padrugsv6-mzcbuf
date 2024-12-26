import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // @version ^1.9.0
import { ClinicalData, ClinicalEvidence, ClinicalValidationResult } from '../../types/clinical';
import { getClinicalData, getEvidenceMatches, validateClinicalData } from '../../lib/api/clinical';
import { ApiError, ErrorType } from '../../types/api';

// State interface with comprehensive tracking
interface ClinicalState {
  clinicalData: Record<string, ClinicalData | null>;
  evidenceMatches: Record<string, ClinicalEvidence[]>;
  loading: {
    clinicalData: Record<string, boolean>;
    evidenceMatches: Record<string, boolean>;
  };
  errors: {
    clinicalData: Record<string, ApiError | null>;
    evidenceMatches: Record<string, ApiError | null>;
  };
  validationResults: Record<string, ClinicalValidationResult | null>;
  lastUpdated: Record<string, string | null>;
  optimisticUpdates: Record<string, Partial<ClinicalData>[]>;
}

// Initial state with proper typing
const initialState: ClinicalState = {
  clinicalData: {},
  evidenceMatches: {},
  loading: {
    clinicalData: {},
    evidenceMatches: {}
  },
  errors: {
    clinicalData: {},
    evidenceMatches: {}
  },
  validationResults: {},
  lastUpdated: {},
  optimisticUpdates: {}
};

// Async thunk for fetching clinical data with retry logic
export const fetchClinicalData = createAsyncThunk<
  ClinicalData,
  string,
  { rejectValue: ApiError }
>(
  'clinical/fetchClinicalData',
  async (requestId: string, { rejectWithValue }) => {
    try {
      const response = await getClinicalData(requestId);
      // Validate response data
      const validationResult = await validateClinicalData(response);
      if (!validationResult.isValid) {
        throw new Error('Invalid clinical data received');
      }
      return response;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          status_code: 500,
          error_type: ErrorType.INTERNAL_SERVER_ERROR,
          message: error.message,
          details: {},
          request_id: requestId
        });
      }
      throw error;
    }
  }
);

// Async thunk for fetching evidence matches with validation
export const fetchEvidenceMatches = createAsyncThunk<
  ClinicalEvidence[],
  string,
  { rejectValue: ApiError }
>(
  'clinical/fetchEvidenceMatches',
  async (clinicalDataId: string, { rejectWithValue }) => {
    try {
      const matches = await getEvidenceMatches(clinicalDataId);
      // Filter out low confidence matches
      return matches.filter(match => match.confidence_score >= 0.7);
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue({
          status_code: 500,
          error_type: ErrorType.INTERNAL_SERVER_ERROR,
          message: error.message,
          details: {},
          request_id: clinicalDataId
        });
      }
      throw error;
    }
  }
);

// Clinical slice with comprehensive state management
const clinicalSlice = createSlice({
  name: 'clinical',
  initialState,
  reducers: {
    // Clear error state for specific request
    clearError: (state, action: PayloadAction<{ type: 'clinicalData' | 'evidenceMatches', id: string }>) => {
      state.errors[action.payload.type][action.payload.id] = null;
    },
    
    // Add optimistic update
    addOptimisticUpdate: (state, action: PayloadAction<{ requestId: string, update: Partial<ClinicalData> }>) => {
      const { requestId, update } = action.payload;
      if (!state.optimisticUpdates[requestId]) {
        state.optimisticUpdates[requestId] = [];
      }
      state.optimisticUpdates[requestId].push(update);
    },
    
    // Clear optimistic updates after confirmation
    clearOptimisticUpdates: (state, action: PayloadAction<string>) => {
      delete state.optimisticUpdates[action.payload];
    }
  },
  extraReducers: (builder) => {
    // Clinical data fetch handlers
    builder
      .addCase(fetchClinicalData.pending, (state, action) => {
        state.loading.clinicalData[action.meta.arg] = true;
        state.errors.clinicalData[action.meta.arg] = null;
      })
      .addCase(fetchClinicalData.fulfilled, (state, action) => {
        state.loading.clinicalData[action.meta.arg] = false;
        state.clinicalData[action.meta.arg] = action.payload;
        state.lastUpdated[action.meta.arg] = new Date().toISOString();
        // Apply any pending optimistic updates
        const updates = state.optimisticUpdates[action.meta.arg];
        if (updates?.length) {
          updates.forEach(update => {
            state.clinicalData[action.meta.arg] = {
              ...state.clinicalData[action.meta.arg]!,
              ...update
            };
          });
        }
      })
      .addCase(fetchClinicalData.rejected, (state, action) => {
        state.loading.clinicalData[action.meta.arg] = false;
        if (action.payload) {
          state.errors.clinicalData[action.meta.arg] = action.payload;
        }
      })

    // Evidence matches fetch handlers
    builder
      .addCase(fetchEvidenceMatches.pending, (state, action) => {
        state.loading.evidenceMatches[action.meta.arg] = true;
        state.errors.evidenceMatches[action.meta.arg] = null;
      })
      .addCase(fetchEvidenceMatches.fulfilled, (state, action) => {
        state.loading.evidenceMatches[action.meta.arg] = false;
        state.evidenceMatches[action.meta.arg] = action.payload;
        state.lastUpdated[action.meta.arg] = new Date().toISOString();
      })
      .addCase(fetchEvidenceMatches.rejected, (state, action) => {
        state.loading.evidenceMatches[action.meta.arg] = false;
        if (action.payload) {
          state.errors.evidenceMatches[action.meta.arg] = action.payload;
        }
      });
  }
});

// Export actions and reducer
export const { clearError, addOptimisticUpdate, clearOptimisticUpdates } = clinicalSlice.actions;
export default clinicalSlice.reducer;

// Selector functions
export const selectClinicalData = (state: { clinical: ClinicalState }, requestId: string) => 
  state.clinical.clinicalData[requestId];

export const selectEvidenceMatches = (state: { clinical: ClinicalState }, clinicalDataId: string) =>
  state.clinical.evidenceMatches[clinicalDataId];

export const selectClinicalLoading = (state: { clinical: ClinicalState }, requestId: string) =>
  state.clinical.loading.clinicalData[requestId];

export const selectEvidenceLoading = (state: { clinical: ClinicalState }, clinicalDataId: string) =>
  state.clinical.loading.evidenceMatches[clinicalDataId];

export const selectClinicalError = (state: { clinical: ClinicalState }, requestId: string) =>
  state.clinical.errors.clinicalData[requestId];

export const selectEvidenceError = (state: { clinical: ClinicalState }, clinicalDataId: string) =>
  state.clinical.errors.evidenceMatches[clinicalDataId];

export const selectLastUpdated = (state: { clinical: ClinicalState }, id: string) =>
  state.clinical.lastUpdated[id];