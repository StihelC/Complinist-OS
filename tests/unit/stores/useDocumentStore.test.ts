import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useDocumentStore, UserDocument, ProcessingProgress } from '@/core/stores/useDocumentStore';
import { useAuthStore } from '@/core/stores/useAuthStore';

// Mock the auth store
vi.mock('@/core/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

// Setup window.electronAPI mock
const mockElectronAPI = {
  getDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  processDocument: vi.fn(),
  deleteDocument: vi.fn(),
  onChunkingProgress: vi.fn(),
  removeChunkingProgressListener: vi.fn(),
};

beforeAll(() => {
  (global as any).window = { electronAPI: mockElectronAPI };
});

afterAll(() => {
  delete (global as any).window;
});

describe('useDocumentStore', () => {
  const mockLicense = {
    user_id: 'test-user-123',
    license_id: 'license-123',
    organization: 'Test Org',
    email: 'test@example.com',
  };

  const mockDocuments: UserDocument[] = [
    {
      id: 'doc-1',
      filename: 'policy.pdf',
      originalPath: '/path/to/policy.pdf',
      uploadedAt: '2024-01-01T00:00:00Z',
      status: 'completed',
      fileType: 'pdf',
      sizeBytes: 1024000,
      chunkCount: 10,
    },
    {
      id: 'doc-2',
      filename: 'procedures.docx',
      originalPath: '/path/to/procedures.docx',
      uploadedAt: '2024-01-02T00:00:00Z',
      status: 'pending',
      fileType: 'docx',
      sizeBytes: 512000,
    },
  ];

  beforeEach(() => {
    // Reset store state
    useDocumentStore.setState({
      documents: [],
      isLoading: false,
      processingProgress: null,
      error: null,
    });

    // Setup auth store mock
    vi.mocked(useAuthStore.getState).mockReturnValue({
      license: mockLicense,
    } as any);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useDocumentStore.getState();
      expect(state.documents).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.processingProgress).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('loadDocuments', () => {
    it('should load documents successfully', async () => {
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: mockDocuments,
      });

      await useDocumentStore.getState().loadDocuments();

      const state = useDocumentStore.getState();
      expect(state.documents).toEqual(mockDocuments);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error when not authenticated', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValueOnce({
        license: null,
      } as any);

      await useDocumentStore.getState().loadDocuments();

      const state = useDocumentStore.getState();
      expect(state.documents).toEqual([]);
      expect(state.error).toBe('Not authenticated');
    });

    it('should handle API error', async () => {
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: false,
        error: 'Database error',
      });

      await useDocumentStore.getState().loadDocuments();

      const state = useDocumentStore.getState();
      expect(state.documents).toEqual([]);
      expect(state.error).toBe('Database error');
    });

    it('should handle exception', async () => {
      mockElectronAPI.getDocuments.mockRejectedValueOnce(new Error('Network error'));

      await useDocumentStore.getState().loadDocuments();

      const state = useDocumentStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockElectronAPI.getDocuments.mockReturnValueOnce(pendingPromise);

      const loadPromise = useDocumentStore.getState().loadDocuments();

      expect(useDocumentStore.getState().isLoading).toBe(true);

      resolvePromise!({ success: true, documents: [] });
      await loadPromise;

      expect(useDocumentStore.getState().isLoading).toBe(false);
    });
  });

  describe('uploadDocument', () => {
    it('should upload document successfully', async () => {
      mockElectronAPI.uploadDocument.mockResolvedValueOnce({
        success: true,
        documentId: 'new-doc-123',
      });
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: [...mockDocuments, { id: 'new-doc-123', filename: 'new.pdf' }],
      });

      const result = await useDocumentStore.getState().uploadDocument('/path/to/file.pdf');

      expect(result.success).toBe(true);
      expect(result.documentId).toBe('new-doc-123');
      expect(mockElectronAPI.uploadDocument).toHaveBeenCalledWith({
        userId: 'test-user-123',
        filePath: '/path/to/file.pdf',
      });
    });

    it('should return error when not authenticated', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValueOnce({
        license: null,
      } as any);

      const result = await useDocumentStore.getState().uploadDocument('/path/to/file.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should handle upload failure', async () => {
      mockElectronAPI.uploadDocument.mockResolvedValueOnce({
        success: false,
        error: 'File too large',
      });

      const result = await useDocumentStore.getState().uploadDocument('/path/to/large-file.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File too large');
      expect(useDocumentStore.getState().error).toBe('File too large');
    });

    it('should handle upload exception', async () => {
      mockElectronAPI.uploadDocument.mockRejectedValueOnce(new Error('Upload failed'));

      const result = await useDocumentStore.getState().uploadDocument('/path/to/file.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });
  });

  describe('processDocument', () => {
    it('should process document successfully', async () => {
      mockElectronAPI.processDocument.mockResolvedValueOnce({ success: true });
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: mockDocuments,
      });

      const result = await useDocumentStore.getState().processDocument('doc-1', '/path/to/doc.pdf');

      expect(result.success).toBe(true);
      expect(mockElectronAPI.processDocument).toHaveBeenCalledWith({
        userId: 'test-user-123',
        documentId: 'doc-1',
        filePath: '/path/to/doc.pdf',
      });
    });

    it('should return error when not authenticated', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValueOnce({
        license: null,
      } as any);

      const result = await useDocumentStore.getState().processDocument('doc-1', '/path/to/doc.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should handle processing failure', async () => {
      mockElectronAPI.processDocument.mockResolvedValueOnce({
        success: false,
        error: 'Unsupported format',
      });
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: mockDocuments,
      });

      const result = await useDocumentStore.getState().processDocument('doc-1', '/path/to/doc.xyz');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported format');
    });

    it('should clear processing progress on success', async () => {
      useDocumentStore.setState({
        ...useDocumentStore.getState(),
        processingProgress: {
          documentId: 'doc-1',
          status: 'processing',
          progress: 50,
          message: 'Processing...',
        },
      });

      mockElectronAPI.processDocument.mockResolvedValueOnce({ success: true });
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: mockDocuments,
      });

      await useDocumentStore.getState().processDocument('doc-1', '/path/to/doc.pdf');

      expect(useDocumentStore.getState().processingProgress).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      useDocumentStore.setState({
        ...useDocumentStore.getState(),
        documents: mockDocuments,
      });

      mockElectronAPI.deleteDocument.mockResolvedValueOnce({ success: true });

      const result = await useDocumentStore.getState().deleteDocument('doc-1');

      expect(result.success).toBe(true);
      expect(useDocumentStore.getState().documents).not.toContainEqual(
        expect.objectContaining({ id: 'doc-1' })
      );
    });

    it('should return error when not authenticated', async () => {
      vi.mocked(useAuthStore.getState).mockReturnValueOnce({
        license: null,
      } as any);

      const result = await useDocumentStore.getState().deleteDocument('doc-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should handle deletion failure', async () => {
      useDocumentStore.setState({
        ...useDocumentStore.getState(),
        documents: mockDocuments,
      });

      mockElectronAPI.deleteDocument.mockResolvedValueOnce({
        success: false,
        error: 'Permission denied',
      });

      const result = await useDocumentStore.getState().deleteDocument('doc-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      // Document should still be in list
      expect(useDocumentStore.getState().documents).toContainEqual(
        expect.objectContaining({ id: 'doc-1' })
      );
    });
  });

  describe('setProcessingProgress', () => {
    it('should set processing progress', () => {
      const progress: ProcessingProgress = {
        documentId: 'doc-1',
        status: 'processing',
        progress: 50,
        message: 'Extracting text...',
      };

      useDocumentStore.getState().setProcessingProgress(progress);

      expect(useDocumentStore.getState().processingProgress).toEqual(progress);
    });

    it('should clear processing progress with null', () => {
      useDocumentStore.setState({
        ...useDocumentStore.getState(),
        processingProgress: {
          documentId: 'doc-1',
          status: 'processing',
          progress: 50,
          message: 'Processing...',
        },
      });

      useDocumentStore.getState().setProcessingProgress(null);

      expect(useDocumentStore.getState().processingProgress).toBeNull();
    });

    it('should update document status in list', () => {
      useDocumentStore.setState({
        ...useDocumentStore.getState(),
        documents: mockDocuments,
      });

      useDocumentStore.getState().setProcessingProgress({
        documentId: 'doc-2',
        status: 'processing',
        progress: 25,
        message: 'Processing...',
      });

      const doc = useDocumentStore.getState().documents.find((d) => d.id === 'doc-2');
      expect(doc?.status).toBe('processing');
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      useDocumentStore.setState({
        ...useDocumentStore.getState(),
        error: 'Some error',
      });

      useDocumentStore.getState().clearError();

      expect(useDocumentStore.getState().error).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should handle complete document lifecycle', async () => {
      // Upload
      mockElectronAPI.uploadDocument.mockResolvedValueOnce({
        success: true,
        documentId: 'new-doc',
      });
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: [{ id: 'new-doc', filename: 'new.pdf', status: 'pending' }],
      });

      await useDocumentStore.getState().uploadDocument('/path/to/new.pdf');
      expect(useDocumentStore.getState().documents).toHaveLength(1);

      // Process
      useDocumentStore.getState().setProcessingProgress({
        documentId: 'new-doc',
        status: 'processing',
        progress: 50,
        message: 'Processing...',
      });
      expect(useDocumentStore.getState().processingProgress?.progress).toBe(50);

      // Complete processing
      mockElectronAPI.processDocument.mockResolvedValueOnce({ success: true });
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: [{ id: 'new-doc', filename: 'new.pdf', status: 'completed' }],
      });

      await useDocumentStore.getState().processDocument('new-doc', '/path/to/new.pdf');

      const doc = useDocumentStore.getState().documents.find((d) => d.id === 'new-doc');
      expect(doc?.status).toBe('completed');

      // Delete
      mockElectronAPI.deleteDocument.mockResolvedValueOnce({ success: true });
      await useDocumentStore.getState().deleteDocument('new-doc');

      expect(useDocumentStore.getState().documents).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty document list', async () => {
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: [],
      });

      await useDocumentStore.getState().loadDocuments();

      expect(useDocumentStore.getState().documents).toEqual([]);
      expect(useDocumentStore.getState().error).toBeNull();
    });

    it('should handle missing documents array in response', async () => {
      mockElectronAPI.getDocuments.mockResolvedValueOnce({
        success: true,
        documents: undefined,
      });

      await useDocumentStore.getState().loadDocuments();

      expect(useDocumentStore.getState().documents).toEqual([]);
    });

    it('should handle concurrent operations', async () => {
      mockElectronAPI.getDocuments.mockResolvedValue({
        success: true,
        documents: mockDocuments,
      });

      // Fire multiple loads concurrently
      await Promise.all([
        useDocumentStore.getState().loadDocuments(),
        useDocumentStore.getState().loadDocuments(),
        useDocumentStore.getState().loadDocuments(),
      ]);

      expect(useDocumentStore.getState().isLoading).toBe(false);
      expect(useDocumentStore.getState().documents).toEqual(mockDocuments);
    });
  });
});
