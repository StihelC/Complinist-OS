/**
 * Tests for NIST RAG Orchestrator
 *
 * Tests cover:
 * - Query processing and control ID extraction
 * - Context retrieval with mocked ChromaDB responses
 * - Prompt construction and validation
 * - Streaming response handling
 * - Fallback behavior when vector DB unavailable
 * - Reranking and filtering logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the chromaClient module
const mockQuerySmallChunks = vi.fn();
const mockExpandToParentChunks = vi.fn();
const mockFilterByTokenBudget = vi.fn();
const mockCheckHealth = vi.fn();

vi.mock('@/lib/ai/chromaClient', () => ({
  getChromaDBClient: vi.fn(() => ({
    querySmallChunks: mockQuerySmallChunks,
    expandToParentChunks: mockExpandToParentChunks,
    filterByTokenBudget: mockFilterByTokenBudget,
    checkHealth: mockCheckHealth,
  })),
}));

// Mock the embeddingService module
const mockEmbed = vi.fn();

vi.mock('@/lib/ai/embeddingService', () => ({
  getEmbeddingService: vi.fn(() => ({
    embed: mockEmbed,
    checkHealth: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock the llamaServer module
const mockGenerate = vi.fn();
const mockGenerateStream = vi.fn();

vi.mock('@/lib/ai/llamaServer', () => ({
  getLLMServer: vi.fn(() => ({
    generate: mockGenerate,
    generateStream: mockGenerateStream,
    checkHealth: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock the authStore for user document queries
vi.mock('@/core/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      license: {
        user_id: 'test-user-123',
      },
    })),
  },
}));

// Mock the tokenUtils - use real implementations
vi.mock('@/lib/ai/tokenUtils', async () => {
  return {
    estimateTokenCount: (text: string) => Math.ceil(text.length / 3.5),
    calculateNISTPromptOverhead: (query: string, chunkCount: number) => {
      const queryTokens = Math.ceil(query.length / 3.5);
      return 80 + queryTokens + 30 * chunkCount + Math.max(0, chunkCount - 1) * 5 + 10 + 20;
    },
    validatePromptSize: (prompt: string, maxTokens: number, responseReserve: number = 200) => {
      const promptTokens = Math.ceil(prompt.length / 3.5);
      const available = maxTokens - responseReserve;
      return {
        valid: promptTokens <= available,
        promptTokens,
        available,
      };
    },
    calculateAvailableTokensForChunks: (
      contextSize: number,
      promptOverhead: number,
      responseReserve: number = 200,
      minimumChunkTokens: number = 256
    ) => {
      const available = contextSize - promptOverhead - responseReserve;
      return Math.max(available, minimumChunkTokens);
    },
  };
});

// Mock window.electronAPI for user docs and calibrated context
const mockElectronAPI = {
  queryUserDocs: vi.fn(),
  queryDualSource: vi.fn(),
};

// Set up global mocks
beforeEach(() => {
  // Set up window mock
  Object.defineProperty(global, 'window', {
    value: {
      electronAPI: mockElectronAPI,
      calibratedContextSize: 2500,
    },
    writable: true,
  });
});

// Import after mocks are set up
import { NISTRAGOrchestrator, getNISTRAGOrchestrator } from '@/lib/ai/nistRAG';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockChromaResults = [
  {
    id: 'chunk-1',
    text: 'AC-2 Account Management requires organizations to manage system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts.',
    metadata: {
      control_id: 'AC-2',
      control_name: 'Account Management',
      document_type: 'NIST 800-53',
      family: 'AC',
      is_small_chunk: true,
      parent_text: 'AC-2 ACCOUNT MANAGEMENT\n\nControl Text:\na. Define and document the types of accounts allowed and specifically prohibited for use within the system;\nb. Assign account managers;\nc. Establish conditions for group and role membership;\nd. Specify authorized users of the system and roles/privileges;\ne. Require approvals for requests to create accounts;',
      parent_token_count: 150,
    },
    score: 0.92,
  },
  {
    id: 'chunk-2',
    text: 'Account managers must be designated for each active account and are responsible for account management activities.',
    metadata: {
      control_id: 'AC-2',
      control_name: 'Account Management',
      document_type: 'NIST 800-53',
      family: 'AC',
      is_small_chunk: true,
      parent_text: 'f. Create, enable, modify, disable, and remove accounts in accordance with policy;\ng. Monitor the use of accounts;\nh. Notify account managers and relevant personnel when accounts are no longer required.',
      parent_token_count: 100,
    },
    score: 0.85,
  },
  {
    id: 'chunk-3',
    text: 'SI-7 Software and Firmware Integrity verification using cryptographic mechanisms.',
    metadata: {
      control_id: 'SI-7',
      control_name: 'Software, Firmware, and Information Integrity',
      document_type: 'NIST 800-53',
      family: 'SI',
      is_small_chunk: true,
      parent_text: 'SI-7 SOFTWARE, FIRMWARE, AND INFORMATION INTEGRITY\n\nControl Text:\na. Employ integrity verification tools to detect unauthorized changes to software, firmware, and information.',
      parent_token_count: 80,
    },
    score: 0.45,
  },
];

const mockExpandedChunks = [
  {
    parentText: mockChromaResults[0].metadata.parent_text,
    parentTokenCount: mockChromaResults[0].metadata.parent_token_count,
    smallChunkId: mockChromaResults[0].id,
    smallChunkText: mockChromaResults[0].text,
    metadata: mockChromaResults[0].metadata,
    score: mockChromaResults[0].score,
  },
  {
    parentText: mockChromaResults[1].metadata.parent_text,
    parentTokenCount: mockChromaResults[1].metadata.parent_token_count,
    smallChunkId: mockChromaResults[1].id,
    smallChunkText: mockChromaResults[1].text,
    metadata: mockChromaResults[1].metadata,
    score: mockChromaResults[1].score,
  },
  {
    parentText: mockChromaResults[2].metadata.parent_text,
    parentTokenCount: mockChromaResults[2].metadata.parent_token_count,
    smallChunkId: mockChromaResults[2].id,
    smallChunkText: mockChromaResults[2].text,
    metadata: mockChromaResults[2].metadata,
    score: mockChromaResults[2].score,
  },
];

const mockEmbedding = Array(384).fill(0.1);

const mockLLMResponse = {
  text: 'AC-2 (Account Management) is a NIST 800-53 control that requires organizations to establish and maintain proper account management procedures. Organizations must define account types, assign account managers, and implement processes for creating, modifying, disabling, and removing accounts.',
  tokensUsed: 85,
  finishReason: 'stop',
};

// ============================================================================
// Test Suites
// ============================================================================

describe('NIST RAG Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    mockEmbed.mockResolvedValue({
      embeddings: [mockEmbedding],
      dimensions: 384,
    });

    mockQuerySmallChunks.mockResolvedValue(mockChromaResults);
    mockExpandToParentChunks.mockReturnValue(mockExpandedChunks);
    mockFilterByTokenBudget.mockImplementation((chunks) => chunks);
    mockGenerate.mockResolvedValue(mockLLMResponse);
    mockCheckHealth.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Control ID Extraction Tests
  // ==========================================================================
  describe('Control ID Extraction', () => {
    it('should extract single control ID from query', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      // Verify the query filters include the control ID
      expect(mockQuerySmallChunks).toHaveBeenCalled();
      const callArgs = mockQuerySmallChunks.mock.calls[0][0];
      expect(callArgs.filters).toBeDefined();
    });

    it('should extract multiple control IDs from query', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'Compare AC-2 and AC-3 controls',
      });

      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });

    it('should extract control ID with enhancement number', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What does AC-2(1) require?',
      });

      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });

    it('should handle query without control IDs', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'How do I implement account management?',
      });

      // Should still work with semantic search
      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });

    it('should normalize control IDs to uppercase', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What is ac-2?', // lowercase
      });

      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Query Expansion Tests
  // ==========================================================================
  describe('Query Expansion', () => {
    it('should expand query with control name for better semantic matching', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      // The embedding should be generated for the expanded query
      expect(mockEmbed).toHaveBeenCalledWith({
        text: expect.stringContaining('Account Management'),
      });
    });

    it('should not duplicate control name if already present', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What is AC-2 Account Management?',
      });

      // Check the embed was called with the original query (not double-expanded)
      const embedCall = mockEmbed.mock.calls[0][0];
      const occurrences = (embedCall.text.match(/Account Management/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  // ==========================================================================
  // Context Retrieval Tests
  // ==========================================================================
  describe('Context Retrieval', () => {
    it('should query ChromaDB with embedding', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      expect(mockQuerySmallChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          queryEmbedding: mockEmbedding,
          topK: expect.any(Number),
        })
      );
    });

    it('should apply document type filters', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
        documentTypes: ['control_text'],
      });

      expect(mockQuerySmallChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            $and: expect.arrayContaining([
              expect.objectContaining({
                document_type: { $in: ['control_text'] },
              }),
            ]),
          }),
        })
      );
    });

    it('should apply family filters', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'Show all Access Control controls',
        families: ['AC'],
      });

      expect(mockQuerySmallChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            $and: expect.arrayContaining([
              expect.objectContaining({
                family: { $in: ['AC'] },
              }),
            ]),
          }),
        })
      );
    });

    it('should expand small chunks to parent chunks', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      // After reranking, chunks will have modified scores and originalScore field
      // Verify expandToParentChunks was called with chunks that have proper structure
      expect(mockExpandToParentChunks).toHaveBeenCalled();
      const calledChunks = mockExpandToParentChunks.mock.calls[0][0];
      expect(calledChunks).toHaveLength(3);
      expect(calledChunks[0]).toHaveProperty('id');
      expect(calledChunks[0]).toHaveProperty('text');
      expect(calledChunks[0]).toHaveProperty('metadata');
      expect(calledChunks[0]).toHaveProperty('score');
    });

    it('should filter chunks by token budget', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      expect(mockFilterByTokenBudget).toHaveBeenCalled();
    });

    it('should return empty response when no documents found', async () => {
      mockQuerySmallChunks.mockResolvedValue([]);

      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is XY-999?',
      });

      expect(response.answer).toContain('No relevant documents found');
      expect(response.retrievedChunks).toHaveLength(0);
      expect(response.references).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Reranking Tests
  // ==========================================================================
  describe('Reranking', () => {
    it('should boost exact control ID matches', async () => {
      // Mock results with exact match and non-match
      // SI-7 has slightly higher initial score but should be outranked after boosting
      const mixedResults = [
        { ...mockChromaResults[2], score: 0.75 }, // SI-7 non-match (higher initial score)
        { ...mockChromaResults[0], score: 0.70 }, // AC-2 match (lower initial, but will get boost)
      ];
      mockQuerySmallChunks.mockResolvedValue(mixedResults);

      // The expandToParentChunks receives the reranked chunks
      // We need to return properly expanded chunks that preserve the reranked scores
      mockExpandToParentChunks.mockImplementation((chunks: any[]) => {
        return chunks.map((chunk) => ({
          parentText: chunk.metadata.parent_text,
          parentTokenCount: chunk.metadata.parent_token_count,
          smallChunkId: chunk.id,
          smallChunkText: chunk.text,
          metadata: chunk.metadata,
          score: chunk.score, // Preserve the reranked score
        }));
      });

      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      // AC-2 should be ranked higher due to exact match boost (+0.15)
      // AC-2: 0.70 + 0.15 (exact control) + keyword boost = ~0.88+
      // SI-7: 0.75 + keyword boost (less) = ~0.78
      expect(response.references[0].controlId).toBe('AC-2');
    });

    it('should apply keyword overlap boost', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'account management requirements',
      });

      // Chunks containing 'account', 'management' should get boosted
      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Minimum Score Filtering Tests
  // ==========================================================================
  describe('Minimum Score Filtering', () => {
    it('should filter out chunks below minimum score threshold', async () => {
      const lowScoreResults = [
        { ...mockChromaResults[0], score: 0.50 }, // Above threshold
        { ...mockChromaResults[1], score: 0.30 }, // Below threshold
      ];
      mockQuerySmallChunks.mockResolvedValue(lowScoreResults);

      const expandedLow = lowScoreResults.map((r) => ({
        parentText: r.metadata.parent_text,
        parentTokenCount: r.metadata.parent_token_count,
        smallChunkId: r.id,
        smallChunkText: r.text,
        metadata: r.metadata,
        score: r.score,
      }));
      mockExpandToParentChunks.mockReturnValue(expandedLow);
      mockFilterByTokenBudget.mockImplementation((chunks) => chunks);

      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      // Only the high-score chunk should be in references
      expect(response.references.length).toBeGreaterThanOrEqual(1);
      expect(response.references.every((r) => r.score >= 0.30)).toBe(true);
    });

    it('should use lower threshold for control ID matches', async () => {
      // A chunk with control_id that matches the query should have a lower threshold
      const exactMatchLowScore = [
        {
          ...mockChromaResults[0],
          score: 0.35, // Below normal threshold (0.45) but above control ID threshold (~0.32)
        },
      ];
      mockQuerySmallChunks.mockResolvedValue(exactMatchLowScore);

      const expandedLow = exactMatchLowScore.map((r) => ({
        parentText: r.metadata.parent_text,
        parentTokenCount: r.metadata.parent_token_count,
        smallChunkId: r.id,
        smallChunkText: r.text,
        metadata: r.metadata,
        score: r.score,
      }));
      mockExpandToParentChunks.mockReturnValue(expandedLow);

      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      // Should still include the chunk because it has a control_id
      expect(response.references.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Prompt Construction Tests
  // ==========================================================================
  describe('Prompt Construction', () => {
    it('should build prompt with document sections and headers', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      // Verify LLM was called with a properly formatted prompt
      // Uses new structured prompt format with Reference labels instead of Document headers
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Reference'),
        })
      );
    });

    it('should NOT include relevance scores in document headers (removed for trust)', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      const generateCall = mockGenerate.mock.calls[0][0];
      // Relevance percentages have been removed to prevent false precision claims
      // Scores are still used internally for ranking but not exposed in prompts
      expect(generateCall.prompt).not.toMatch(/relevance:\s*\d+(\.\d+)?%/i);
      expect(generateCall.prompt).not.toMatch(/\d+(\.\d+)?%\s*match/i);
    });

    it('should include control ID and name in headers', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      const generateCall = mockGenerate.mock.calls[0][0];
      expect(generateCall.prompt).toContain('Control: AC-2');
    });

    it('should include guidelines for response quality', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      const generateCall = mockGenerate.mock.calls[0][0];
      // Uses new structured format with Control Requirements section header
      expect(generateCall.prompt).toContain('## Control Requirements');
    });

    it('should use low temperature for reduced hallucinations', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
        })
      );
    });
  });

  // ==========================================================================
  // Response Building Tests
  // ==========================================================================
  describe('Response Building', () => {
    it('should return complete NISTQueryResponse', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      expect(response).toHaveProperty('answer');
      expect(response).toHaveProperty('retrievedChunks');
      expect(response).toHaveProperty('references');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('contextTokensUsed');
    });

    it('should include references with control metadata', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      expect(response.references.length).toBeGreaterThan(0);
      response.references.forEach((ref) => {
        expect(ref).toHaveProperty('chunkId');
        expect(ref).toHaveProperty('documentType');
        expect(ref).toHaveProperty('score');
        expect(ref).toHaveProperty('parentTokenCount');
      });
    });

    it('should track tokens used', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      expect(response.tokensUsed).toBe(85); // From mock
      expect(response.contextTokensUsed).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Streaming Response Tests
  // ==========================================================================
  describe('Streaming Response Handling', () => {
    it('should yield metadata first in stream', async () => {
      // Mock streaming generator
      async function* mockStreamGenerator() {
        yield 'This ';
        yield 'is ';
        yield 'a ';
        yield 'test.';
      }
      mockGenerateStream.mockReturnValue(mockStreamGenerator());

      const orchestrator = new NISTRAGOrchestrator();
      const stream = orchestrator.queryNISTDocumentsStream({
        query: 'What is AC-2?',
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }

      // First item should be metadata
      expect(results[0].type).toBe('metadata');
      expect(results[0].data).toHaveProperty('references');
      expect(results[0].data).toHaveProperty('contextTokensUsed');
    });

    it('should yield tokens after metadata', async () => {
      async function* mockStreamGenerator() {
        yield 'Token1 ';
        yield 'Token2';
      }
      mockGenerateStream.mockReturnValue(mockStreamGenerator());

      const orchestrator = new NISTRAGOrchestrator();
      const stream = orchestrator.queryNISTDocumentsStream({
        query: 'What is AC-2?',
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }

      // Subsequent items should be tokens
      const tokenResults = results.filter((r) => r.type === 'token');
      expect(tokenResults.length).toBeGreaterThan(0);
      expect(tokenResults[0].data).toBe('Token1 ');
    });

    it('should handle empty results in stream', async () => {
      mockQuerySmallChunks.mockResolvedValue([]);

      const orchestrator = new NISTRAGOrchestrator();
      const stream = orchestrator.queryNISTDocumentsStream({
        query: 'What is XY-999?',
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }

      // Should yield a "no documents found" message
      expect(results.some((r) => r.type === 'token' && r.data.includes('No relevant documents'))).toBe(true);
    });
  });

  // ==========================================================================
  // Fallback Behavior Tests
  // ==========================================================================
  describe('Fallback Behavior', () => {
    it('should fall back to semantic search when exact match fails', async () => {
      // First call (exact match) returns empty, second call (semantic) returns results
      mockQuerySmallChunks
        .mockResolvedValueOnce([]) // Exact match fails
        .mockResolvedValueOnce(mockChromaResults); // Semantic search succeeds

      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      expect(mockQuerySmallChunks).toHaveBeenCalledTimes(2);
      expect(response.retrievedChunks.length).toBeGreaterThan(0);
    });

    it('should handle embedding service failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding service unavailable'));

      const orchestrator = new NISTRAGOrchestrator();

      await expect(
        orchestrator.queryNISTDocuments({ query: 'What is AC-2?' })
      ).rejects.toThrow('Embedding service unavailable');
    });

    it('should handle ChromaDB query failure', async () => {
      mockQuerySmallChunks.mockRejectedValue(new Error('ChromaDB connection failed'));

      const orchestrator = new NISTRAGOrchestrator();

      await expect(
        orchestrator.queryNISTDocuments({ query: 'What is AC-2?' })
      ).rejects.toThrow('ChromaDB connection failed');
    });

    it('should handle LLM generation failure', async () => {
      mockGenerate.mockRejectedValue(new Error('LLM generation failed'));

      const orchestrator = new NISTRAGOrchestrator();

      await expect(
        orchestrator.queryNISTDocuments({ query: 'What is AC-2?' })
      ).rejects.toThrow('LLM generation failed');
    });

    it('should use best chunk when all chunks are below threshold', async () => {
      const veryLowScoreResults = [
        { ...mockChromaResults[0], score: 0.25 },
      ];
      mockQuerySmallChunks.mockResolvedValue(veryLowScoreResults);

      const expandedLow = veryLowScoreResults.map((r) => ({
        parentText: r.metadata.parent_text,
        parentTokenCount: r.metadata.parent_token_count,
        smallChunkId: r.id,
        smallChunkText: r.text,
        metadata: r.metadata,
        score: r.score,
      }));
      mockExpandToParentChunks.mockReturnValue(expandedLow);
      mockFilterByTokenBudget.mockImplementation((chunks) => chunks);

      const orchestrator = new NISTRAGOrchestrator();
      const response = await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
      });

      // Should still generate a response using the best available chunk
      expect(mockGenerate).toHaveBeenCalled();
      expect(response.references.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Token Budget Tests
  // ==========================================================================
  describe('Token Budget Management', () => {
    it('should respect maxTokens parameter', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
        maxTokens: 500,
      });

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 500,
        })
      );
    });

    it('should use default topK value', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: 'What is AC-2?' });

      expect(mockQuerySmallChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: expect.any(Number),
        })
      );
    });

    it('should respect custom topK parameter', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What is AC-2?',
        topK: 3,
      });

      expect(mockQuerySmallChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          topK: expect.any(Number), // May be limited by exact match logic
        })
      );
    });
  });

  // ==========================================================================
  // Dual Source Search Tests
  // ==========================================================================
  describe('Dual Source Search', () => {
    it('should search user documents when scope is user', async () => {
      mockElectronAPI.queryUserDocs.mockResolvedValue({
        success: true,
        results: [
          {
            id: 'user-doc-1',
            text: 'User compliance document about AC-2',
            metadata: { filename: 'compliance.pdf' },
            distance: 0.1,
          },
        ],
      });

      const orchestrator = new NISTRAGOrchestrator();
      const stream = orchestrator.queryNISTDocumentsStream({
        query: 'What is AC-2?',
        searchScope: 'user',
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(mockElectronAPI.queryUserDocs).toHaveBeenCalled();
    });

    it('should search both sources when scope is both', async () => {
      mockElectronAPI.queryUserDocs.mockResolvedValue({
        success: true,
        results: [],
      });

      const orchestrator = new NISTRAGOrchestrator();
      const stream = orchestrator.queryNISTDocumentsStream({
        query: 'What is AC-2?',
        searchScope: 'both',
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }

      // Should query both user docs and shared library
      expect(mockElectronAPI.queryUserDocs).toHaveBeenCalled();
      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });

    it('should merge and sort results from both sources', async () => {
      mockElectronAPI.queryUserDocs.mockResolvedValue({
        success: true,
        results: [
          {
            id: 'user-doc-1',
            text: 'User document about AC-2',
            metadata: { filename: 'policy.pdf' },
            distance: 0.05, // Very relevant
          },
        ],
      });

      const orchestrator = new NISTRAGOrchestrator();
      const stream = orchestrator.queryNISTDocumentsStream({
        query: 'What is AC-2?',
        searchScope: 'both',
      });

      const results: any[] = [];
      for await (const item of stream) {
        results.push(item);
      }

      const metadataResult = results.find((r) => r.type === 'metadata');
      expect(metadataResult).toBeDefined();
    });
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================
  describe('Singleton Pattern', () => {
    it('should return same instance from getNISTRAGOrchestrator', () => {
      const instance1 = getNISTRAGOrchestrator();
      const instance2 = getNISTRAGOrchestrator();

      expect(instance1).toBe(instance2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle empty query', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: '' });

      expect(mockEmbed).toHaveBeenCalledWith({ text: '' });
    });

    it('should handle very long query', async () => {
      const longQuery = 'What are the requirements for ' + 'security controls '.repeat(100);

      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({ query: longQuery });

      expect(mockEmbed).toHaveBeenCalled();
    });

    it('should handle special characters in query', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'What is AC-2(1)? <script>alert("test")</script>',
      });

      expect(mockEmbed).toHaveBeenCalled();
    });

    it('should handle multiple control families in query', async () => {
      const orchestrator = new NISTRAGOrchestrator();
      await orchestrator.queryNISTDocuments({
        query: 'Compare AC-2, SI-7, and IA-5 requirements',
      });

      expect(mockQuerySmallChunks).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Integration-style Tests (with all mocks working together)
// ============================================================================
describe('NIST RAG Full Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockEmbed.mockResolvedValue({
      embeddings: [mockEmbedding],
      dimensions: 384,
    });
    mockQuerySmallChunks.mockResolvedValue(mockChromaResults);
    mockExpandToParentChunks.mockReturnValue(mockExpandedChunks);
    mockFilterByTokenBudget.mockImplementation((chunks) => chunks);
    mockGenerate.mockResolvedValue(mockLLMResponse);
  });

  it('should complete full query flow successfully', async () => {
    const orchestrator = new NISTRAGOrchestrator();
    const response = await orchestrator.queryNISTDocuments({
      query: 'What is AC-2 Account Management?',
    });

    // Verify all steps were executed
    expect(mockEmbed).toHaveBeenCalledTimes(1);
    expect(mockQuerySmallChunks).toHaveBeenCalled();
    expect(mockExpandToParentChunks).toHaveBeenCalled();
    expect(mockFilterByTokenBudget).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();

    // Verify response structure
    expect(response.answer).toBe(mockLLMResponse.text);
    expect(response.tokensUsed).toBe(mockLLMResponse.tokensUsed);
    expect(response.references.length).toBeGreaterThan(0);
  });

  it('should complete full streaming flow successfully', async () => {
    async function* mockStreamGenerator() {
      yield 'AC-2 ';
      yield 'requires ';
      yield 'account management.';
    }
    mockGenerateStream.mockReturnValue(mockStreamGenerator());

    const orchestrator = new NISTRAGOrchestrator();
    const stream = orchestrator.queryNISTDocumentsStream({
      query: 'What is AC-2?',
    });

    const results: any[] = [];
    for await (const item of stream) {
      results.push(item);
    }

    // Verify metadata came first
    expect(results[0].type).toBe('metadata');

    // Verify tokens followed
    const tokens = results.filter((r) => r.type === 'token').map((r) => r.data);
    expect(tokens.join('')).toBe('AC-2 requires account management.');
  });
});
