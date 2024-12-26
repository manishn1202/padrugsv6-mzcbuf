/**
 * @fileoverview Redux Toolkit slice for HIPAA-compliant document management
 * Implements secure document operations with comprehensive audit logging
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  Document, 
  DocumentList, 
  DocumentType,
  EncryptionStatus,
  DocumentUploadRequest,
  ENCRYPTION_REQUIRED,
  MAX_FILE_SIZE_BYTES,
  isSupportedMimeType
} from '../../types/documents';

// State interface with enhanced security and audit features
interface DocumentsState {
  documents: Document[];
  total: number;
  loading: boolean;
  error: string | null;
  currentPage: number;
  itemsPerPage: number;
  filters: {
    documentType?: DocumentType;
    dateRange?: { start: string; end: string };
    requestId?: string;
    encryptionStatus?: EncryptionStatus;
  };
  sortBy: 'uploaded_at' | 'filename' | 'document_type';
  sortOrder: 'asc' | 'desc';
  selectedDocuments: string[];
  auditLog: {
    documentId: string;
    action: string;
    timestamp: string;
    userId: string;
  }[];
  encryptionStatus: Record<string, EncryptionStatus>;
}

// Initial state with security defaults
const initialState: DocumentsState = {
  documents: [],
  total: 0,
  loading: false,
  error: null,
  currentPage: 1,
  itemsPerPage: 10,
  filters: {},
  sortBy: 'uploaded_at',
  sortOrder: 'desc',
  selectedDocuments: [],
  auditLog: [],
  encryptionStatus: {}
};

// Enhanced async thunk for secure document upload
export const uploadDocumentAsync = createAsyncThunk(
  'documents/upload',
  async (request: DocumentUploadRequest, { rejectWithValue }) => {
    try {
      // Validate file size and type
      if (!isSupportedMimeType(request.file.type)) {
        throw new Error('Unsupported file type');
      }
      if (request.file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      }

      // Enforce encryption requirement
      if (ENCRYPTION_REQUIRED && !request.encryption_required) {
        throw new Error('Encryption is required for all document uploads');
      }

      // Implementation would call API here
      // const response = await uploadDocument(request);
      
      return {} as Document; // Placeholder for actual implementation
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Enhanced async thunk for secure document retrieval
export const fetchDocumentsAsync = createAsyncThunk(
  'documents/fetch',
  async (params: { 
    page: number; 
    pageSize: number;
    filters?: DocumentsState['filters'];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    // Implementation would call API here
    // const response = await fetchDocuments(params);
    return {} as DocumentList; // Placeholder for actual implementation
  }
);

// Enhanced slice with HIPAA-compliant features
const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    // Update encryption status
    setEncryptionStatus(state, action: PayloadAction<{ 
      documentId: string; 
      status: EncryptionStatus 
    }>) {
      state.encryptionStatus[action.payload.documentId] = action.payload.status;
    },

    // Add audit log entry
    addAuditLogEntry(state, action: PayloadAction<{
      documentId: string;
      action: string;
      userId: string;
    }>) {
      state.auditLog.push({
        ...action.payload,
        timestamp: new Date().toISOString()
      });
    },

    // Update filters with type safety
    setFilters(state, action: PayloadAction<Partial<DocumentsState['filters']>>) {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1; // Reset to first page when filters change
    },

    // Update sorting
    setSorting(state, action: PayloadAction<{
      sortBy: DocumentsState['sortBy'];
      sortOrder: DocumentsState['sortOrder'];
    }>) {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },

    // Update selected documents
    setSelectedDocuments(state, action: PayloadAction<string[]>) {
      state.selectedDocuments = action.payload;
    },

    // Clear error state
    clearError(state) {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Upload document reducers
    builder
      .addCase(uploadDocumentAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadDocumentAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.documents.unshift(action.payload);
        state.total += 1;
        // Add audit log entry for upload
        state.auditLog.push({
          documentId: action.payload.id,
          action: 'UPLOAD',
          userId: 'current-user', // Would be replaced with actual user ID
          timestamp: new Date().toISOString()
        });
      })
      .addCase(uploadDocumentAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch documents reducers
    builder
      .addCase(fetchDocumentsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocumentsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = action.payload.documents;
        state.total = action.payload.total;
        state.currentPage = action.payload.page;
        state.itemsPerPage = action.payload.page_size;
      })
      .addCase(fetchDocumentsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch documents';
      });
  }
});

// Export actions
export const { 
  setEncryptionStatus,
  addAuditLogEntry,
  setFilters,
  setSorting,
  setSelectedDocuments,
  clearError
} = documentsSlice.actions;

// Selectors with memoization potential
export const selectDocuments = (state: { documents: DocumentsState }) => state.documents.documents;
export const selectDocumentById = (state: { documents: DocumentsState }, id: string) => 
  state.documents.documents.find(doc => doc.id === id);
export const selectDocumentAuditLog = (state: { documents: DocumentsState }, id: string) =>
  state.documents.auditLog.filter(entry => entry.documentId === id);
export const selectDocumentEncryptionStatus = (state: { documents: DocumentsState }, id: string) =>
  state.documents.encryptionStatus[id];
export const selectLoading = (state: { documents: DocumentsState }) => state.documents.loading;
export const selectError = (state: { documents: DocumentsState }) => state.documents.error;
export const selectPagination = (state: { documents: DocumentsState }) => ({
  currentPage: state.documents.currentPage,
  itemsPerPage: state.documents.itemsPerPage,
  total: state.documents.total
});

// Export reducer
export default documentsSlice.reducer;