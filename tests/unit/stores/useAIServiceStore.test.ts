import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAIServiceStore } from '@/core/stores/useAIServiceStore';

// Mock the AI modules
vi.mock('@/lib/ai/llamaServer', () => ({
  getLLMServer: vi.fn(() => ({
    checkHealth: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@/lib/ai/embeddingService', () => ({
  getEmbeddingService: vi.fn(() => ({
    checkHealth: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@/lib/ai/chromaClient', () => ({
  getChromaDBClient: vi.fn(() => ({
    checkHealth: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@/lib/ai/config', () => ({
  loadAIConfig: vi.fn(() => ({
    gpuBackend: 'auto',
    llmPort: 8080,
    embeddingPort: 8081,
    chromaPort: 8000,
  })),
}));

describe('useAIServiceStore', () => {
  const initialStatus = {
    status: 'not_initialized' as const,
    llmStatus: 'not_loaded' as const,
    embeddingStatus: 'not_loaded' as const,
    chromaDbStatus: 'not_connected' as const,
    gpuBackend: 'auto' as const,
  };

  const initialPreloadProgress = {
    isPreloading: false,
    stage: '',
    progress: 0,
    message: '',
  };

  beforeEach(() => {
    // Reset store to initial state
    useAIServiceStore.setState({
      status: { ...initialStatus },
      preloadProgress: { ...initialPreloadProgress },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial status', () => {
      const state = useAIServiceStore.getState();
      expect(state.status.status).toBe('not_initialized');
      expect(state.status.llmStatus).toBe('not_loaded');
      expect(state.status.embeddingStatus).toBe('not_loaded');
      expect(state.status.chromaDbStatus).toBe('not_connected');
      expect(state.status.gpuBackend).toBe('auto');
    });

    it('should have correct initial preload progress', () => {
      const state = useAIServiceStore.getState();
      expect(state.preloadProgress.isPreloading).toBe(false);
      expect(state.preloadProgress.stage).toBe('');
      expect(state.preloadProgress.progress).toBe(0);
      expect(state.preloadProgress.message).toBe('');
    });
  });

  describe('updateStatus', () => {
    it('should update partial status', () => {
      useAIServiceStore.getState().updateStatus({ llmStatus: 'ready' });

      const state = useAIServiceStore.getState();
      expect(state.status.llmStatus).toBe('ready');
      expect(state.status.embeddingStatus).toBe('not_loaded'); // Unchanged
    });

    it('should update multiple status fields', () => {
      useAIServiceStore.getState().updateStatus({
        llmStatus: 'ready',
        embeddingStatus: 'ready',
        status: 'ready',
      });

      const state = useAIServiceStore.getState();
      expect(state.status.llmStatus).toBe('ready');
      expect(state.status.embeddingStatus).toBe('ready');
      expect(state.status.status).toBe('ready');
    });

    it('should preserve other status fields', () => {
      useAIServiceStore.setState({
        status: {
          ...initialStatus,
          gpuBackend: 'cuda',
        },
        preloadProgress: initialPreloadProgress,
      });

      useAIServiceStore.getState().updateStatus({ llmStatus: 'ready' });

      expect(useAIServiceStore.getState().status.gpuBackend).toBe('cuda');
    });
  });

  describe('setGPUBackend', () => {
    it('should set GPU backend to cuda', () => {
      useAIServiceStore.getState().setGPUBackend('cuda');
      expect(useAIServiceStore.getState().status.gpuBackend).toBe('cuda');
    });

    it('should set GPU backend to metal', () => {
      useAIServiceStore.getState().setGPUBackend('metal');
      expect(useAIServiceStore.getState().status.gpuBackend).toBe('metal');
    });

    it('should set GPU backend to vulkan', () => {
      useAIServiceStore.getState().setGPUBackend('vulkan');
      expect(useAIServiceStore.getState().status.gpuBackend).toBe('vulkan');
    });

    it('should set GPU backend to cpu', () => {
      useAIServiceStore.getState().setGPUBackend('cpu');
      expect(useAIServiceStore.getState().status.gpuBackend).toBe('cpu');
    });

    it('should set GPU backend to auto', () => {
      useAIServiceStore.getState().setGPUBackend('cuda');
      useAIServiceStore.getState().setGPUBackend('auto');
      expect(useAIServiceStore.getState().status.gpuBackend).toBe('auto');
    });

    it('should preserve other status fields', () => {
      useAIServiceStore.setState({
        status: {
          ...initialStatus,
          llmStatus: 'ready',
        },
        preloadProgress: initialPreloadProgress,
      });

      useAIServiceStore.getState().setGPUBackend('metal');

      expect(useAIServiceStore.getState().status.llmStatus).toBe('ready');
    });
  });

  describe('updatePreloadProgress', () => {
    it('should update preload progress partially', () => {
      useAIServiceStore.getState().updatePreloadProgress({ progress: 50 });

      const state = useAIServiceStore.getState();
      expect(state.preloadProgress.progress).toBe(50);
      expect(state.preloadProgress.isPreloading).toBe(false); // Unchanged
    });

    it('should update multiple preload fields', () => {
      useAIServiceStore.getState().updatePreloadProgress({
        isPreloading: true,
        stage: 'loading_llm',
        progress: 25,
        message: 'Loading LLM model...',
      });

      const state = useAIServiceStore.getState();
      expect(state.preloadProgress.isPreloading).toBe(true);
      expect(state.preloadProgress.stage).toBe('loading_llm');
      expect(state.preloadProgress.progress).toBe(25);
      expect(state.preloadProgress.message).toBe('Loading LLM model...');
    });

    it('should reset preload progress', () => {
      useAIServiceStore.setState({
        status: initialStatus,
        preloadProgress: {
          isPreloading: true,
          stage: 'loading',
          progress: 50,
          message: 'Loading...',
        },
      });

      useAIServiceStore.getState().updatePreloadProgress({
        isPreloading: false,
        stage: 'complete',
        progress: 100,
        message: 'Complete',
      });

      const state = useAIServiceStore.getState();
      expect(state.preloadProgress.isPreloading).toBe(false);
      expect(state.preloadProgress.progress).toBe(100);
    });
  });

  describe('checkHealth', () => {
    it('should update status based on health check results', async () => {
      await useAIServiceStore.getState().checkHealth();

      const state = useAIServiceStore.getState();
      // Since mocks return true, all should be ready
      expect(state.status.llmStatus).toBe('ready');
      expect(state.status.embeddingStatus).toBe('ready');
      expect(state.status.chromaDbStatus).toBe('connected');
      expect(state.status.status).toBe('ready');
    });
  });

  describe('State Transitions', () => {
    it('should transition through preload stages', () => {
      const stages = [
        { stage: 'initializing', progress: 0, message: 'Starting...' },
        { stage: 'loading_llm', progress: 25, message: 'Loading LLM...' },
        { stage: 'loading_embedding', progress: 50, message: 'Loading embeddings...' },
        { stage: 'connecting_chroma', progress: 75, message: 'Connecting to ChromaDB...' },
        { stage: 'complete', progress: 100, message: 'Ready' },
      ];

      stages.forEach((stageData) => {
        useAIServiceStore.getState().updatePreloadProgress({
          isPreloading: stageData.stage !== 'complete',
          ...stageData,
        });

        const state = useAIServiceStore.getState();
        expect(state.preloadProgress.stage).toBe(stageData.stage);
        expect(state.preloadProgress.progress).toBe(stageData.progress);
      });
    });

    it('should handle error stage', () => {
      useAIServiceStore.getState().updatePreloadProgress({
        isPreloading: true,
        stage: 'loading_llm',
        progress: 25,
        message: 'Loading LLM...',
      });

      useAIServiceStore.getState().updatePreloadProgress({
        isPreloading: false,
        stage: 'error',
        progress: 25,
        message: 'Failed to load LLM model',
      });

      const state = useAIServiceStore.getState();
      expect(state.preloadProgress.isPreloading).toBe(false);
      expect(state.preloadProgress.stage).toBe('error');
    });
  });

  describe('Model Info', () => {
    it('should update model info in status', () => {
      useAIServiceStore.getState().updateStatus({
        modelInfo: {
          llmModel: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
          embeddingModel: 'bge-m3-FP16.gguf',
          contextWindow: 2500,
        },
      });

      const state = useAIServiceStore.getState();
      expect(state.status.modelInfo?.llmModel).toBe('mistral-7b-instruct-v0.1.Q4_K_M.gguf');
      expect(state.status.modelInfo?.embeddingModel).toBe('bge-m3-FP16.gguf');
      expect(state.status.modelInfo?.contextWindow).toBe(2500);
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle rapid status updates', () => {
      const { updateStatus } = useAIServiceStore.getState();

      updateStatus({ llmStatus: 'not_loaded' });
      updateStatus({ llmStatus: 'ready' });
      updateStatus({ embeddingStatus: 'ready' });
      updateStatus({ chromaDbStatus: 'connected' });

      const state = useAIServiceStore.getState();
      expect(state.status.llmStatus).toBe('ready');
      expect(state.status.embeddingStatus).toBe('ready');
      expect(state.status.chromaDbStatus).toBe('connected');
    });

    it('should handle interleaved preload and status updates', () => {
      const { updateStatus, updatePreloadProgress } = useAIServiceStore.getState();

      updatePreloadProgress({ isPreloading: true, stage: 'loading' });
      updateStatus({ llmStatus: 'ready' });
      updatePreloadProgress({ progress: 50 });
      updateStatus({ embeddingStatus: 'ready' });
      updatePreloadProgress({ stage: 'complete', isPreloading: false });

      const state = useAIServiceStore.getState();
      expect(state.status.llmStatus).toBe('ready');
      expect(state.status.embeddingStatus).toBe('ready');
      expect(state.preloadProgress.isPreloading).toBe(false);
      expect(state.preloadProgress.stage).toBe('complete');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty status update', () => {
      const before = useAIServiceStore.getState().status;
      useAIServiceStore.getState().updateStatus({});
      const after = useAIServiceStore.getState().status;

      expect(after).toEqual(before);
    });

    it('should handle empty preload progress update', () => {
      const before = useAIServiceStore.getState().preloadProgress;
      useAIServiceStore.getState().updatePreloadProgress({});
      const after = useAIServiceStore.getState().preloadProgress;

      expect(after).toEqual(before);
    });

    it('should maintain type safety for gpuBackend', () => {
      const validBackends: Array<'auto' | 'cuda' | 'metal' | 'vulkan' | 'cpu'> = [
        'auto',
        'cuda',
        'metal',
        'vulkan',
        'cpu',
      ];

      validBackends.forEach((backend) => {
        useAIServiceStore.getState().setGPUBackend(backend);
        expect(useAIServiceStore.getState().status.gpuBackend).toBe(backend);
      });
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      // Set initial values
      useAIServiceStore.getState().setGPUBackend('cuda');
      useAIServiceStore.getState().updateStatus({ llmStatus: 'ready' });
      useAIServiceStore.getState().updatePreloadProgress({ progress: 100 });

      // Verify all values persist
      const state = useAIServiceStore.getState();
      expect(state.status.gpuBackend).toBe('cuda');
      expect(state.status.llmStatus).toBe('ready');
      expect(state.preloadProgress.progress).toBe(100);
    });
  });
});
