import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAINarrativesStore } from '@/core/stores/useAINarrativesStore';
import type { RAGRequest, RAGResponse } from '@/lib/ai/types';

// Mock the AI dependencies
const mockGenerateControlNarrative = vi.fn();
vi.mock('@/lib/ai/ragOrchestrator', () => ({
  getRAGOrchestrator: vi.fn(() => ({
    generateControlNarrative: mockGenerateControlNarrative,
  })),
}));

const mockGenerateStream = vi.fn();
vi.mock('@/lib/ai/llamaServer', () => ({
  getLLMServer: vi.fn(() => ({
    generateStream: mockGenerateStream,
  })),
}));

vi.mock('@/lib/ai/embeddingService', () => ({
  getEmbeddingService: vi.fn(() => ({
    embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
  })),
}));

vi.mock('@/lib/ai/chromaClient', () => ({
  getChromaDBClient: vi.fn(() => ({
    query: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/ai/promptTemplates', () => ({
  buildChatPrompt: vi.fn(() => 'Test prompt'),
}));

vi.mock('@/lib/controls/controlCatalog', () => ({
  getAllControls: vi.fn().mockResolvedValue({ items: {} }),
}));

vi.mock('@/lib/controls/nistControls', () => ({
  NIST_CONTROLS: [],
  getControlsByFamily: vi.fn(() => []),
  CONTROL_FAMILIES: [],
}));

describe('useAINarrativesStore', () => {
  const mockRAGResponse: RAGResponse = {
    narrative: 'Generated narrative for AC-2',
    references: [
      { documentTitle: 'NIST 800-53', chunkIndex: 1, relevance: 0.95 },
    ],
    tokensUsed: 500,
    contextTokensUsed: 1000,
    retrievedChunks: [],
  };

  beforeEach(() => {
    // Reset store state
    useAINarrativesStore.setState({
      narratives: {},
      chatHistory: [],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAINarrativesStore.getState();
      expect(state.narratives).toEqual({});
      expect(state.chatHistory).toEqual([]);
    });
  });

  describe('requestNarrative', () => {
    const mockRequest: RAGRequest = {
      controlId: 'AC-2',
      controlTitle: 'Account Management',
      nistReference: 'Reference text',
    };

    it('should request narrative and update status through stages', async () => {
      mockGenerateControlNarrative.mockResolvedValueOnce(mockRAGResponse);

      const promise = useAINarrativesStore.getState().requestNarrative(mockRequest);

      // Status immediately transitions to 'generating' (synchronously)
      // because requestNarrative sets 'queued', then 'retrieving', then calls generateNarrative
      // which sets 'generating', all before the function returns
      let state = useAINarrativesStore.getState();
      expect(state.narratives['AC-2']?.status).toBe('generating');

      await promise;

      state = useAINarrativesStore.getState();
      expect(state.narratives['AC-2'].status).toBe('completed');
      expect(state.narratives['AC-2'].narrative).toBe('Generated narrative for AC-2');
      expect(state.narratives['AC-2'].references).toEqual(mockRAGResponse.references);
    });

    it('should handle errors', async () => {
      mockGenerateControlNarrative.mockRejectedValueOnce(new Error('AI service unavailable'));

      await useAINarrativesStore.getState().requestNarrative(mockRequest);

      const state = useAINarrativesStore.getState();
      expect(state.narratives['AC-2'].status).toBe('error');
      expect(state.narratives['AC-2'].error).toBe('AI service unavailable');
    });

    it('should track timestamps', async () => {
      mockGenerateControlNarrative.mockResolvedValueOnce(mockRAGResponse);

      const before = Date.now();
      await useAINarrativesStore.getState().requestNarrative(mockRequest);
      const after = Date.now();

      const narrative = useAINarrativesStore.getState().narratives['AC-2'];
      expect(narrative.requestedAt).toBeGreaterThanOrEqual(before);
      expect(narrative.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('generateNarrative', () => {
    it('should call RAG orchestrator and return response', async () => {
      mockGenerateControlNarrative.mockResolvedValueOnce(mockRAGResponse);

      const request: RAGRequest = {
        controlId: 'AC-2',
        controlTitle: 'Account Management',
        nistReference: 'Reference',
      };

      const result = await useAINarrativesStore.getState().generateNarrative(request);

      expect(mockGenerateControlNarrative).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockRAGResponse);
    });

    it('should update status to generating', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockGenerateControlNarrative.mockReturnValueOnce(pendingPromise);

      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'retrieving',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      const generatePromise = useAINarrativesStore.getState().generateNarrative({
        controlId: 'AC-2',
        controlTitle: 'Account Management',
        nistReference: 'Reference',
      });

      expect(useAINarrativesStore.getState().narratives['AC-2'].status).toBe('generating');

      resolvePromise!(mockRAGResponse);
      await generatePromise;
    });
  });

  describe('acceptNarrative', () => {
    it('should mark narrative as accepted', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'completed',
            narrative: 'Generated text',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      useAINarrativesStore.getState().acceptNarrative('AC-2');

      const narrative = useAINarrativesStore.getState().narratives['AC-2'];
      expect(narrative.status).toBe('completed');
    });

    it('should not accept if not completed', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'generating',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      const beforeUpdatedAt = useAINarrativesStore.getState().narratives['AC-2'].updatedAt;
      useAINarrativesStore.getState().acceptNarrative('AC-2');

      // Should not update
      expect(useAINarrativesStore.getState().narratives['AC-2'].updatedAt).toBe(beforeUpdatedAt);
    });
  });

  describe('rejectNarrative', () => {
    it('should remove narrative', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'completed',
            narrative: 'Generated text',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      useAINarrativesStore.getState().rejectNarrative('AC-2');

      expect(useAINarrativesStore.getState().narratives['AC-2']).toBeUndefined();
    });
  });

  describe('updateNarrative', () => {
    it('should update narrative text', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'completed',
            narrative: 'Original text',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      useAINarrativesStore.getState().updateNarrative('AC-2', 'Updated text');

      expect(useAINarrativesStore.getState().narratives['AC-2'].narrative).toBe('Updated text');
    });
  });

  describe('clearNarrative', () => {
    it('should remove narrative by control ID', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'completed',
            narrative: 'Text',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
          'SC-7': {
            controlId: 'SC-7',
            status: 'completed',
            narrative: 'Text',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      useAINarrativesStore.getState().clearNarrative('AC-2');

      const narratives = useAINarrativesStore.getState().narratives;
      expect(narratives['AC-2']).toBeUndefined();
      expect(narratives['SC-7']).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should add user message to history', async () => {
      mockGenerateStream.mockImplementation(async function* () {
        yield 'Response';
      });

      await useAINarrativesStore.getState().sendMessage('Hello');

      const history = useAINarrativesStore.getState().chatHistory;
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello');
    });

    it('should add assistant response to history', async () => {
      mockGenerateStream.mockImplementation(async function* () {
        yield 'Response text';
      });

      await useAINarrativesStore.getState().sendMessage('Hello');

      const history = useAINarrativesStore.getState().chatHistory;
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Response text');
    });

    it('should stream response', async () => {
      mockGenerateStream.mockImplementation(async function* () {
        yield 'Part 1 ';
        yield 'Part 2 ';
        yield 'Part 3';
      });

      await useAINarrativesStore.getState().sendMessage('Test');

      const history = useAINarrativesStore.getState().chatHistory;
      expect(history[1].content).toBe('Part 1 Part 2 Part 3');
    });

    it('should handle errors gracefully', async () => {
      mockGenerateStream.mockImplementation(async function* () {
        throw new Error('LLM error');
      });

      await useAINarrativesStore.getState().sendMessage('Test');

      const history = useAINarrativesStore.getState().chatHistory;
      expect(history[1].content).toContain('Error:');
      expect(history[1].content).toContain('LLM error');
    });

    it('should track message timestamps', async () => {
      mockGenerateStream.mockImplementation(async function* () {
        yield 'Response';
      });

      const before = Date.now();
      await useAINarrativesStore.getState().sendMessage('Test');
      const after = Date.now();

      const history = useAINarrativesStore.getState().chatHistory;
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('clearChatHistory', () => {
    it('should clear all chat history', () => {
      useAINarrativesStore.setState({
        narratives: {},
        chatHistory: [
          { role: 'user', content: 'Hello', timestamp: Date.now() },
          { role: 'assistant', content: 'Hi', timestamp: Date.now() },
        ],
      });

      useAINarrativesStore.getState().clearChatHistory();

      expect(useAINarrativesStore.getState().chatHistory).toEqual([]);
    });
  });

  describe('getNarrative', () => {
    it('should return narrative by control ID', () => {
      const narrative = {
        controlId: 'AC-2',
        status: 'completed' as const,
        narrative: 'Text',
        requestedAt: Date.now(),
        updatedAt: Date.now(),
      };

      useAINarrativesStore.setState({
        narratives: { 'AC-2': narrative },
        chatHistory: [],
      });

      expect(useAINarrativesStore.getState().getNarrative('AC-2')).toEqual(narrative);
    });

    it('should return undefined for non-existent control', () => {
      expect(useAINarrativesStore.getState().getNarrative('UNKNOWN')).toBeUndefined();
    });
  });

  describe('isGenerating', () => {
    it('should return true for generating status', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'generating',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      expect(useAINarrativesStore.getState().isGenerating('AC-2')).toBe(true);
    });

    it('should return true for retrieving status', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'retrieving',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      expect(useAINarrativesStore.getState().isGenerating('AC-2')).toBe(true);
    });

    it('should return true for queued status', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'queued',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      expect(useAINarrativesStore.getState().isGenerating('AC-2')).toBe(true);
    });

    it('should return false for completed status', () => {
      useAINarrativesStore.setState({
        narratives: {
          'AC-2': {
            controlId: 'AC-2',
            status: 'completed',
            narrative: 'Text',
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        chatHistory: [],
      });

      expect(useAINarrativesStore.getState().isGenerating('AC-2')).toBe(false);
    });

    it('should return false for non-existent control', () => {
      expect(useAINarrativesStore.getState().isGenerating('UNKNOWN')).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple narrative requests', async () => {
      mockGenerateControlNarrative.mockResolvedValue(mockRAGResponse);

      await Promise.all([
        useAINarrativesStore.getState().requestNarrative({
          controlId: 'AC-2',
          controlTitle: 'Account Management',
          nistReference: 'Reference',
        }),
        useAINarrativesStore.getState().requestNarrative({
          controlId: 'SC-7',
          controlTitle: 'Boundary Protection',
          nistReference: 'Reference',
        }),
      ]);

      const narratives = useAINarrativesStore.getState().narratives;
      expect(narratives['AC-2']).toBeDefined();
      expect(narratives['SC-7']).toBeDefined();
    });
  });
});
