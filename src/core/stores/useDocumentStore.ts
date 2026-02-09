// Document Store - Zustand store for user document management
// Manages uploaded documents, processing status, and chunking operations
// Enhanced with batch upload and queue management

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useAuthStore } from './useAuthStore';

export interface UserDocument {
  id: string;
  filename: string;
  originalPath: string;
  uploadedAt: string;
  processedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileType: string;
  sizeBytes: number;
  chunkCount?: number;
  error?: string;
}

export interface ProcessingProgress {
  documentId?: string;
  status: string;
  progress: number;
  message: string;
}

export interface QueueStatus {
  queueLength: number;
  isProcessing: boolean;
  isPaused: boolean;
  currentItem: {
    documentId: string;
    startedAt: number;
  } | null;
  queue: Array<{
    documentId: string;
    priority: string;
    status: string;
    addedAt: number;
  }>;
}

export interface BatchUploadResult {
  success: boolean;
  results?: Array<{
    success: boolean;
    documentId?: string;
    filename?: string;
    filePath?: string;
    error?: string;
  }>;
  error?: string;
}

interface DocumentState {
  documents: UserDocument[];
  isLoading: boolean;
  processingProgress: ProcessingProgress | null;
  queueStatus: QueueStatus | null;
  error: string | null;

  // Actions
  loadDocuments: () => Promise<void>;
  uploadDocument: (filePath: string) => Promise<{ success: boolean; documentId?: string; error?: string }>;
  uploadBatch: (filePaths: string[]) => Promise<BatchUploadResult>;
  processDocument: (documentId: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  queueDocuments: (documents: Array<{ documentId: string; filePath: string; priority?: 'high' | 'normal' | 'low' }>) => Promise<{ success: boolean; error?: string }>;
  pauseQueue: () => Promise<void>;
  resumeQueue: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
  deleteDocument: (documentId: string) => Promise<{ success: boolean; error?: string }>;
  setProcessingProgress: (progress: ProcessingProgress | null) => void;
  setQueueStatus: (status: QueueStatus | null) => void;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>()(
  devtools(
    (set, get) => ({
      documents: [],
      isLoading: false,
      processingProgress: null,
      queueStatus: null,
      error: null,

  loadDocuments: async () => {
    const license = useAuthStore.getState().license;
    if (!license?.user_id) {
      set({ documents: [], error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.getDocuments({ userId: license.user_id });

      if (result.success) {
        set({
          documents: result.documents || [],
          isLoading: false,
        });
      } else {
        set({
          documents: [],
          isLoading: false,
          error: result.error || 'Failed to load documents',
        });
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      set({
        documents: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load documents',
      });
    }
  },

  uploadDocument: async (filePath: string) => {
    const license = useAuthStore.getState().license;
    if (!license?.user_id) {
      return { success: false, error: 'Not authenticated' };
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.uploadDocument({
        userId: license.user_id,
        filePath,
      });

      if (result.success) {
        // Reload documents list
        await get().loadDocuments();
        return { success: true, documentId: result.documentId };
      } else {
        set({ isLoading: false, error: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  uploadBatch: async (filePaths: string[]) => {
    const license = useAuthStore.getState().license;
    if (!license?.user_id) {
      return { success: false, error: 'Not authenticated' };
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.uploadBatch({
        userId: license.user_id,
        filePaths,
      });

      if (result.success) {
        // Reload documents list
        await get().loadDocuments();
        set({ isLoading: false });
        return { success: true, results: result.results };
      } else {
        set({ isLoading: false, error: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Batch upload failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  processDocument: async (documentId: string, filePath: string) => {
    const license = useAuthStore.getState().license;
    if (!license?.user_id) {
      return { success: false, error: 'Not authenticated' };
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.processDocument({
        userId: license.user_id,
        documentId,
        filePath,
      });

      // Reload documents to get updated status
      await get().loadDocuments();

      if (result.success) {
        set({ isLoading: false, processingProgress: null });
        return { success: true };
      } else {
        set({ isLoading: false, error: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Processing failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  deleteDocument: async (documentId: string) => {
    const license = useAuthStore.getState().license;
    if (!license?.user_id) {
      return { success: false, error: 'Not authenticated' };
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.deleteDocument({
        userId: license.user_id,
        documentId,
      });

      if (result.success) {
        // Update local state
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== documentId),
          isLoading: false,
        }));
        return { success: true };
      } else {
        set({ isLoading: false, error: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Delete failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  queueDocuments: async (documents: Array<{ documentId: string; filePath: string; priority?: 'high' | 'normal' | 'low' }>) => {
    const license = useAuthStore.getState().license;
    if (!license?.user_id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await window.electronAPI.queueDocuments({
        userId: license.user_id,
        documents,
      });

      if (result.success) {
        // Refresh queue status
        await get().refreshQueueStatus();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Queue operation failed';
      return { success: false, error: errorMsg };
    }
  },

  pauseQueue: async () => {
    try {
      await window.electronAPI.pauseQueue();
      await get().refreshQueueStatus();
    } catch (error) {
      console.error('Failed to pause queue:', error);
    }
  },

  resumeQueue: async () => {
    try {
      await window.electronAPI.resumeQueue();
      await get().refreshQueueStatus();
    } catch (error) {
      console.error('Failed to resume queue:', error);
    }
  },

  refreshQueueStatus: async () => {
    try {
      const status = await window.electronAPI.getQueueStatus();
      set({ queueStatus: status });
    } catch (error) {
      console.error('Failed to refresh queue status:', error);
    }
  },

  setProcessingProgress: (progress: ProcessingProgress | null) => {
    set({ processingProgress: progress });

    // Update the document status in the list
    if (progress) {
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === progress.documentId
            ? { ...doc, status: progress.status as UserDocument['status'] }
            : doc
        ),
      }));
    }
  },

  setQueueStatus: (status: QueueStatus | null) => {
    set({ queueStatus: status });
  },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'Document Store' }
  )
);

// Helper hook for setting up progress listener
export function useDocumentProgressListener() {
  const setProcessingProgress = useDocumentStore((state) => state.setProcessingProgress);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);

  const setupListener = () => {
    window.electronAPI.onChunkingProgress((data: ProcessingProgress) => {
      setProcessingProgress(data);

      // Reload documents when processing is complete
      if (data.status === 'completed' || data.status === 'failed') {
        loadDocuments();
      }
    });
  };

  const removeListener = () => {
    window.electronAPI.removeChunkingProgressListener();
  };

  return { setupListener, removeListener };
}

// Helper hook for setting up queue listener
export function useQueueListener() {
  const refreshQueueStatus = useDocumentStore((state) => state.refreshQueueStatus);
  const loadDocuments = useDocumentStore((state) => state.loadDocuments);

  const setupListener = () => {
    window.electronAPI.onQueueUpdate((data) => {
      // Refresh queue status on any update
      refreshQueueStatus();

      // Reload documents when a document completes or fails
      if (data.type === 'completed' || data.type === 'failed') {
        loadDocuments();
      }
    });

    // Initial queue status fetch
    refreshQueueStatus();
  };

  const removeListener = () => {
    window.electronAPI.removeQueueUpdateListener();
  };

  return { setupListener, removeListener };
}
