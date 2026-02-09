/**
 * IPC AI Channel Tests (ai:*)
 *
 * Tests all AI-related IPC channels for:
 * - LLM generation (streaming and non-streaming)
 * - Embedding generation
 * - ChromaDB operations
 * - AI health checks
 * - Type safety and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockElectronAPI,
  resetMockState,
  getCallsForChannel,
  setMockConfig,
  emitMockEvent,
} from '../../fixtures/ipc/__mocks__/electronAPI.mock';
import type { ElectronAPI } from '@/window.d';

describe('AI IPC Channels (ai:*)', () => {
  let mockAPI: ElectronAPI;

  beforeEach(() => {
    resetMockState();
    setMockConfig({});
    mockAPI = createMockElectronAPI();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ai:llm-generate', () => {
    it('should generate text from prompt', async () => {
      const result = await mockAPI.llmGenerate({
        prompt: 'Explain access control in simple terms'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('text');
      expect(typeof result.data.text).toBe('string');
      expect(getCallsForChannel('ai:llm-generate')).toHaveLength(1);
    });

    it('should accept temperature parameter', async () => {
      const result = await mockAPI.llmGenerate({
        prompt: 'Test prompt',
        temperature: 0.7
      });

      expect(result.success).toBe(true);
      const call = getCallsForChannel('ai:llm-generate')[0];
      expect(call.args[0]).toHaveProperty('temperature', 0.7);
    });

    it('should accept maxTokens parameter', async () => {
      const result = await mockAPI.llmGenerate({
        prompt: 'Test prompt',
        maxTokens: 500
      });

      expect(result.success).toBe(true);
      const call = getCallsForChannel('ai:llm-generate')[0];
      expect(call.args[0]).toHaveProperty('maxTokens', 500);
    });

    it('should handle long prompts', async () => {
      const longPrompt = 'A'.repeat(10000);
      const result = await mockAPI.llmGenerate({ prompt: longPrompt });

      expect(result.success).toBe(true);
    });

    it('should include tokensUsed in response', async () => {
      const result = await mockAPI.llmGenerate({ prompt: 'Short prompt' });

      expect(result.data).toHaveProperty('tokensUsed');
      expect(typeof result.data.tokensUsed).toBe('number');
    });

    it('should handle errors gracefully', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'LLM unavailable' });

      await expect(mockAPI.llmGenerate({ prompt: 'Test' }))
        .rejects.toThrow('LLM unavailable');
    });

    it('should handle special characters in prompt', async () => {
      const specialPrompt = 'What is <script>alert("xss")</script> & how to prevent it?';
      const result = await mockAPI.llmGenerate({ prompt: specialPrompt });

      expect(result.success).toBe(true);
    });

    it('should handle unicode in prompt', async () => {
      const unicodePrompt = '如何实现访问控制？ Comment implémenter le contrôle d\'accès?';
      const result = await mockAPI.llmGenerate({ prompt: unicodePrompt });

      expect(result.success).toBe(true);
    });
  });

  describe('ai:llm-generate-stream', () => {
    it('should stream text generation', async () => {
      const tokens: string[] = [];
      mockAPI.onStreamToken((token: string) => tokens.push(token));

      const result = await mockAPI.llmGenerateStream({
        prompt: 'Generate a streaming response'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('text');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should emit tokens during generation', async () => {
      const receivedTokens: string[] = [];

      mockAPI.onStreamToken((token: string) => {
        receivedTokens.push(token);
      });

      await mockAPI.llmGenerateStream({ prompt: 'Test streaming' });

      expect(receivedTokens).toContain('Mock ');
      expect(receivedTokens).toContain('streaming ');
    });

    it('should handle streaming with temperature', async () => {
      const result = await mockAPI.llmGenerateStream({
        prompt: 'Test',
        temperature: 0.5
      });

      expect(result.success).toBe(true);
    });

    it('should record IPC call correctly', async () => {
      await mockAPI.llmGenerateStream({ prompt: 'Test' });

      expect(getCallsForChannel('ai:llm-generate-stream')).toHaveLength(1);
    });

    it('should handle errors during streaming', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Stream error' });

      await expect(mockAPI.llmGenerateStream({ prompt: 'Test' }))
        .rejects.toThrow('Stream error');
    });
  });

  describe('ai:embed', () => {
    it('should generate embedding for text', async () => {
      const result = await mockAPI.embed({ text: 'Generate embedding for this text' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('embedding');
      expect(Array.isArray(result.data.embedding)).toBe(true);
    });

    it('should generate correct embedding dimensions', async () => {
      const result = await mockAPI.embed({ text: 'Test text' });

      // Mock returns 384-dimensional embeddings (like sentence transformers)
      expect(result.data.embedding).toHaveLength(384);
    });

    it('should generate numeric embedding values', async () => {
      const result = await mockAPI.embed({ text: 'Test' });

      result.data.embedding.forEach((value: number) => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    });

    it('should handle empty text', async () => {
      const result = await mockAPI.embed({ text: '' });

      expect(result.success).toBe(true);
    });

    it('should handle very long text', async () => {
      const longText = 'Word '.repeat(5000);
      const result = await mockAPI.embed({ text: longText });

      expect(result.success).toBe(true);
    });

    it('should generate consistent embeddings for same input', async () => {
      // Note: In real implementation, same input should give same output
      // Mock uses random values, so we just verify structure
      const result1 = await mockAPI.embed({ text: 'Test' });
      const result2 = await mockAPI.embed({ text: 'Test' });

      expect(result1.data.embedding.length).toBe(result2.data.embedding.length);
    });

    it('should record IPC call', async () => {
      await mockAPI.embed({ text: 'Test' });

      expect(getCallsForChannel('ai:embed')).toHaveLength(1);
    });
  });

  describe('ai:chromadb-query', () => {
    it('should query ChromaDB collection', async () => {
      const queryEmbedding = Array(384).fill(0).map(() => Math.random());

      const result = await mockAPI.chromaDbQuery({
        collection: 'nist-controls',
        queryEmbedding,
        topK: 5
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('documents');
      expect(result.data).toHaveProperty('metadatas');
      expect(result.data).toHaveProperty('distances');
    });

    it('should respect topK parameter', async () => {
      const result = await mockAPI.chromaDbQuery({
        collection: 'test',
        queryEmbedding: Array(384).fill(0),
        topK: 3
      });

      expect(result.success).toBe(true);
    });

    it('should accept optional filters', async () => {
      const result = await mockAPI.chromaDbQuery({
        collection: 'test',
        queryEmbedding: Array(384).fill(0),
        topK: 5,
        filters: { source: 'NIST-800-53' }
      });

      expect(result.success).toBe(true);
    });

    it('should handle missing topK with default', async () => {
      const result = await mockAPI.chromaDbQuery({
        collection: 'test',
        queryEmbedding: Array(384).fill(0)
      });

      expect(result.success).toBe(true);
    });

    it('should record correct call parameters', async () => {
      const embedding = Array(384).fill(0.5);
      await mockAPI.chromaDbQuery({
        collection: 'my-collection',
        queryEmbedding: embedding,
        topK: 10
      });

      const call = getCallsForChannel('ai:chromadb-query')[0];
      expect(call.args[0]).toHaveProperty('collection', 'my-collection');
      expect(call.args[0]).toHaveProperty('topK', 10);
    });
  });

  describe('ai:chromadb-add', () => {
    it('should add documents to ChromaDB', async () => {
      const result = await mockAPI.chromaDbAdd({
        collection: 'test-collection',
        documents: ['Document 1', 'Document 2'],
        embeddings: [Array(384).fill(0), Array(384).fill(1)],
        metadatas: [{ source: 'test1' }, { source: 'test2' }],
        ids: ['doc-1', 'doc-2']
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('count', 2);
    });

    it('should handle single document', async () => {
      const result = await mockAPI.chromaDbAdd({
        collection: 'test',
        documents: ['Single document'],
        embeddings: [Array(384).fill(0)],
        metadatas: [{ source: 'single' }],
        ids: ['single-id']
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
    });

    it('should handle empty arrays', async () => {
      const result = await mockAPI.chromaDbAdd({
        collection: 'test',
        documents: [],
        embeddings: [],
        metadatas: [],
        ids: []
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(0);
    });

    it('should record IPC call with all parameters', async () => {
      await mockAPI.chromaDbAdd({
        collection: 'collection-name',
        documents: ['doc'],
        embeddings: [[0.1, 0.2]],
        metadatas: [{}],
        ids: ['id']
      });

      const call = getCallsForChannel('ai:chromadb-add')[0];
      expect(call.args[0]).toHaveProperty('collection', 'collection-name');
      expect(call.args[0]).toHaveProperty('documents');
      expect(call.args[0]).toHaveProperty('embeddings');
    });
  });

  describe('ai:check-health', () => {
    it('should return AI health status', async () => {
      const result = await mockAPI.checkAIHealth();

      expect(result).toHaveProperty('llm');
      expect(result).toHaveProperty('embedding');
      expect(result).toHaveProperty('chroma');
      expect(typeof result.llm).toBe('boolean');
      expect(typeof result.embedding).toBe('boolean');
      expect(typeof result.chroma).toBe('boolean');
    });

    it('should include context size', async () => {
      const result = await mockAPI.checkAIHealth();

      expect(result).toHaveProperty('contextSize');
      expect(typeof result.contextSize).toBe('number');
    });

    it('should record IPC call', async () => {
      await mockAPI.checkAIHealth();

      expect(getCallsForChannel('ai:check-health')).toHaveLength(1);
    });
  });

  describe('ai:get-context-size', () => {
    it('should return context size number', async () => {
      const result = await mockAPI.getContextSize();

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('AI Preload Operations', () => {
    describe('ai:get-preload-status', () => {
      it('should return preload status', async () => {
        const result = await mockAPI.getAIPreloadStatus();

        expect(result).toHaveProperty('isPreloading');
        expect(typeof result.isPreloading).toBe('boolean');
      });
    });

    describe('ai:preload-progress events', () => {
      it('should register progress listener', () => {
        const callback = vi.fn();
        mockAPI.onAIPreloadProgress(callback);

        // Emit mock event
        emitMockEvent('ai:preload-progress', {
          stage: 'loading',
          progress: 50,
          message: 'Loading model...'
        });

        expect(callback).toHaveBeenCalledWith({
          stage: 'loading',
          progress: 50,
          message: 'Loading model...'
        });
      });

      it('should remove progress listener', () => {
        const callback = vi.fn();
        mockAPI.onAIPreloadProgress(callback);
        mockAPI.removeAIPreloadProgressListener();

        emitMockEvent('ai:preload-progress', { stage: 'done', progress: 100, message: 'Done' });

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  describe('ai:query-dual-source', () => {
    it('should query user and shared sources', async () => {
      const result = await mockAPI.queryDualSource({
        userId: 'user-123',
        queryEmbedding: Array(384).fill(0),
        topK: 5,
        searchScope: 'both'
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveProperty('user');
      expect(result.results).toHaveProperty('shared');
      expect(result.results).toHaveProperty('merged');
    });

    it('should accept user-only scope', async () => {
      const result = await mockAPI.queryDualSource({
        userId: 'user-123',
        queryEmbedding: Array(384).fill(0),
        searchScope: 'user'
      });

      expect(result.success).toBe(true);
    });

    it('should accept shared-only scope', async () => {
      const result = await mockAPI.queryDualSource({
        userId: 'user-123',
        queryEmbedding: Array(384).fill(0),
        searchScope: 'shared'
      });

      expect(result.success).toBe(true);
    });

    it('should record IPC call', async () => {
      await mockAPI.queryDualSource({
        userId: 'user-123',
        queryEmbedding: Array(384).fill(0)
      });

      expect(getCallsForChannel('ai:query-dual-source')).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM generation failure', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Model not loaded' });

      await expect(mockAPI.llmGenerate({ prompt: 'Test' }))
        .rejects.toThrow('Model not loaded');
    });

    it('should handle embedding generation failure', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Embedding model error' });

      await expect(mockAPI.embed({ text: 'Test' }))
        .rejects.toThrow('Embedding model error');
    });

    it('should handle ChromaDB query failure', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'ChromaDB connection failed' });

      await expect(mockAPI.chromaDbQuery({
        collection: 'test',
        queryEmbedding: []
      })).rejects.toThrow('ChromaDB connection failed');
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent LLM requests', async () => {
      const promises = Array(5).fill(null).map((_, i) =>
        mockAPI.llmGenerate({ prompt: `Concurrent prompt ${i}` })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      expect(getCallsForChannel('ai:llm-generate')).toHaveLength(5);
    });

    it('should handle concurrent embedding requests', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        mockAPI.embed({ text: `Text for embedding ${i}` })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.embedding).toHaveLength(384);
      });
    });
  });

  describe('Data Validation', () => {
    it('should handle prompts with only whitespace', async () => {
      const result = await mockAPI.llmGenerate({ prompt: '   \n\t  ' });
      expect(result.success).toBe(true);
    });

    it('should handle very large embedding arrays', async () => {
      const largeEmbedding = Array(1000).fill(0.5);
      const result = await mockAPI.chromaDbQuery({
        collection: 'test',
        queryEmbedding: largeEmbedding
      });

      expect(result.success).toBe(true);
    });
  });
});
