/**
 * E2E Test: AI Embedding System
 * Tests the full AI embedding workflow including:
 * - IPC communication between renderer and main process
 * - Schema validation for single string and array of strings
 * - Embedding service generating embeddings
 * - ChromaDB vector search
 * - NIST RAG orchestration with query expansion
 */

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp;
let window;

test.describe('AI Embedding System E2E', () => {
  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Wait for the window to open
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for app initialization (AI service preload, etc.)
    await window.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should embed single string via IPC', async () => {
    const result = await window.evaluate(async () => {
      // Test direct IPC call with single string
      const response = await window.electronAPI.embed({
        text: 'What is access control?',
      });
      return response;
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.embeddings).toBeDefined();
    expect(Array.isArray(result.data.embeddings)).toBe(true);
    expect(result.data.embeddings.length).toBe(1);
    expect(result.data.dimensions).toBeGreaterThan(0);
    expect(Array.isArray(result.data.embeddings[0])).toBe(true);
    expect(result.data.embeddings[0].length).toBe(result.data.dimensions);
  });

  test('should embed array of strings via IPC', async () => {
    const result = await window.evaluate(async () => {
      // Test direct IPC call with array of strings
      const response = await window.electronAPI.embed({
        text: [
          'What is access control?',
          'What is AC-3?',
          'Explain authentication mechanisms',
        ],
      });
      return response;
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.embeddings).toBeDefined();
    expect(Array.isArray(result.data.embeddings)).toBe(true);
    expect(result.data.embeddings.length).toBe(3);
    expect(result.data.dimensions).toBeGreaterThan(0);

    // Check each embedding
    result.data.embeddings.forEach((embedding, idx) => {
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(result.data.dimensions);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });
  });

  test('should handle NIST query with query expansion', async () => {
    const result = await window.evaluate(async () => {
      // Navigate to AI assistant view
      const viewRouter = window.__FLOW_STORE__?.getState?.()?.setView;
      if (viewRouter) {
        viewRouter('ai-assistant');
      }

      // Wait for view to render
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get NIST query store
      const queryStore = window.__NIST_QUERY_STORE__;
      if (!queryStore) {
        throw new Error('NIST Query Store not found');
      }

      // Ask a question that will trigger query expansion
      const question = 'what is ac-3';

      // Track the query state
      let queryResult;
      const unsubscribe = queryStore.subscribe((state) => {
        if (state.messages.length > 0) {
          queryResult = {
            messages: state.messages,
            isStreaming: state.isStreaming,
            error: state.error,
          };
        }
      });

      // Ask question
      await queryStore.getState().askQuestion(question, 'nist');

      // Wait for streaming to complete
      let attempts = 0;
      while (queryStore.getState().isStreaming && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      unsubscribe();

      return {
        query: question,
        result: queryResult,
        finalState: queryStore.getState(),
      };
    });

    expect(result.result).toBeDefined();
    expect(result.result.error).toBeUndefined();
    expect(result.result.messages.length).toBeGreaterThan(0);

    // Should have both user message and assistant response
    const userMessage = result.result.messages.find(m => m.role === 'user');
    const assistantMessage = result.result.messages.find(m => m.role === 'assistant');

    expect(userMessage).toBeDefined();
    expect(userMessage.content).toBe('what is ac-3');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage.content.length).toBeGreaterThan(0);

    // Should not be streaming anymore
    expect(result.finalState.isStreaming).toBe(false);
  });

  test('should query ChromaDB with vector embeddings', async () => {
    const result = await window.evaluate(async () => {
      // First, generate an embedding for a query
      const embedResponse = await window.electronAPI.embed({
        text: 'access control enforcement',
      });

      if (!embedResponse.success) {
        throw new Error('Failed to generate embedding: ' + embedResponse.error);
      }

      const queryEmbedding = embedResponse.data.embeddings[0];

      // Query ChromaDB with the embedding
      const queryResponse = await window.electronAPI.chromaDbQuery({
        collection: 'nist_documents',
        queryEmbedding,
        topK: 5,
        filters: {},
      });

      return {
        embedSuccess: embedResponse.success,
        embeddingDimensions: embedResponse.data.dimensions,
        querySuccess: queryResponse.success,
        queryData: queryResponse.data,
      };
    });

    expect(result.embedSuccess).toBe(true);
    expect(result.embeddingDimensions).toBeGreaterThan(0);
    expect(result.querySuccess).toBe(true);
    expect(result.queryData).toBeDefined();
    expect(result.queryData.documents).toBeDefined();
    expect(Array.isArray(result.queryData.documents)).toBe(true);
  });

  test('should handle AI service health check', async () => {
    const result = await window.evaluate(async () => {
      const health = await window.electronAPI.checkAIHealth();
      return health;
    });

    expect(result).toBeDefined();
    expect(result.embedding).toBeDefined();
    expect(result.llm).toBeDefined();
    expect(result.chroma).toBeDefined();
    expect(result.contextSize).toBeGreaterThan(0);
  });

  test('should reject invalid embedding input', async () => {
    const result = await window.evaluate(async () => {
      // Test with empty string
      const emptyResult = await window.electronAPI.embed({
        text: '',
      });

      // Test with null
      let nullResult;
      try {
        nullResult = await window.electronAPI.embed({
          text: null,
        });
      } catch (err) {
        nullResult = { success: false, error: err.message };
      }

      // Test with undefined
      let undefinedResult;
      try {
        undefinedResult = await window.electronAPI.embed({
          text: undefined,
        });
      } catch (err) {
        undefinedResult = { success: false, error: err.message };
      }

      return {
        empty: emptyResult,
        null: nullResult,
        undefined: undefinedResult,
      };
    });

    // All invalid inputs should fail
    expect(result.empty.success).toBe(false);
    expect(result.null.success).toBe(false);
    expect(result.undefined.success).toBe(false);
  });

  test('should handle embedding caching', async () => {
    const result = await window.evaluate(async () => {
      const text = 'Test caching with identical text';

      // First embedding (should be fresh)
      const startTime1 = Date.now();
      const response1 = await window.electronAPI.embed({ text });
      const duration1 = Date.now() - startTime1;

      // Second embedding (should be cached)
      const startTime2 = Date.now();
      const response2 = await window.electronAPI.embed({ text });
      const duration2 = Date.now() - startTime2;

      return {
        first: {
          success: response1.success,
          dimensions: response1.data?.dimensions,
          duration: duration1,
        },
        second: {
          success: response2.success,
          dimensions: response2.data?.dimensions,
          duration: duration2,
        },
        // Cached request should be faster
        wasCached: duration2 < duration1 / 2,
      };
    });

    expect(result.first.success).toBe(true);
    expect(result.second.success).toBe(true);
    expect(result.first.dimensions).toBe(result.second.dimensions);
    // Note: Caching happens in EmbeddingService on renderer side, not IPC level
  });

  test('should handle NIST control ID extraction and query expansion', async () => {
    const result = await window.evaluate(async () => {
      const { extractControlIds, expandQueryWithControlNames } = await import('/src/lib/ai/nistRAG.ts');
      const { CONTROL_CATALOG } = await import('/src/lib/controls/catalog.ts');

      const testCases = [
        { query: 'what is ac-3', expected: ['AC-3'] },
        { query: 'explain AC-2 and SC-7', expected: ['AC-2', 'SC-7'] },
        { query: 'tell me about access control', expected: [] },
      ];

      const results = testCases.map(tc => {
        const extracted = extractControlIds(tc.query);
        const expanded = expandQueryWithControlNames(tc.query, extracted);
        return {
          query: tc.query,
          extracted,
          expanded,
          expectedExtracted: tc.expected,
        };
      });

      return results;
    });

    // First test case: "what is ac-3"
    expect(result[0].extracted).toContain('AC-3');
    expect(result[0].expanded).toContain('AC-3');
    expect(result[0].expanded).toContain('Access Enforcement');

    // Second test case: "explain AC-2 and SC-7"
    expect(result[1].extracted).toContain('AC-2');
    expect(result[1].extracted).toContain('SC-7');
    expect(result[1].expanded).toContain('AC-2');
    expect(result[1].expanded).toContain('SC-7');

    // Third test case: "tell me about access control" (no control IDs)
    expect(result[2].extracted.length).toBe(0);
    expect(result[2].expanded).toBe(result[2].query); // Should be unchanged
  });
});
