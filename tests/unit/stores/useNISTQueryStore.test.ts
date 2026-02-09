import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNISTQueryStore } from '@/core/stores/useNISTQueryStore';
import type { SearchScope } from '@/lib/ai/types';

// Mock the RAG orchestrator
const mockQueryStream = vi.fn();
vi.mock('@/lib/ai/nistRAG', () => ({
  getNISTRAGOrchestrator: vi.fn(() => ({
    queryNISTDocumentsStream: mockQueryStream,
  })),
}));

describe('useNISTQueryStore', () => {
  const initialState = {
    queryHistory: [],
    currentQuery: '',
    currentResponse: '',
    isStreaming: false,
    isLoading: false,
    error: null,
    currentReferences: [],
    currentContextTokens: 0,
    selectedDocumentTypes: [],
    selectedFamilies: [],
    searchScope: 'both' as SearchScope,
  };

  beforeEach(() => {
    // Reset store state
    useNISTQueryStore.setState(initialState);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useNISTQueryStore.getState();
      expect(state.queryHistory).toEqual([]);
      expect(state.currentQuery).toBe('');
      expect(state.currentResponse).toBe('');
      expect(state.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentReferences).toEqual([]);
      expect(state.currentContextTokens).toBe(0);
      expect(state.selectedDocumentTypes).toEqual([]);
      expect(state.selectedFamilies).toEqual([]);
      expect(state.searchScope).toBe('both');
    });
  });

  describe('setCurrentQuery', () => {
    it('should set current query', () => {
      useNISTQueryStore.getState().setCurrentQuery('What is AC-2?');
      expect(useNISTQueryStore.getState().currentQuery).toBe('What is AC-2?');
    });

    it('should handle empty query', () => {
      useNISTQueryStore.setState({ ...initialState, currentQuery: 'test' });
      useNISTQueryStore.getState().setCurrentQuery('');
      expect(useNISTQueryStore.getState().currentQuery).toBe('');
    });
  });

  describe('setSelectedDocumentTypes', () => {
    it('should set selected document types', () => {
      useNISTQueryStore.getState().setSelectedDocumentTypes(['sp800-53', 'nist-csf']);
      expect(useNISTQueryStore.getState().selectedDocumentTypes).toEqual(['sp800-53', 'nist-csf']);
    });

    it('should replace existing document types', () => {
      useNISTQueryStore.setState({
        ...initialState,
        selectedDocumentTypes: ['sp800-53'],
      });
      useNISTQueryStore.getState().setSelectedDocumentTypes(['nist-csf']);
      expect(useNISTQueryStore.getState().selectedDocumentTypes).toEqual(['nist-csf']);
    });

    it('should handle empty array', () => {
      useNISTQueryStore.setState({
        ...initialState,
        selectedDocumentTypes: ['sp800-53'],
      });
      useNISTQueryStore.getState().setSelectedDocumentTypes([]);
      expect(useNISTQueryStore.getState().selectedDocumentTypes).toEqual([]);
    });
  });

  describe('setSelectedFamilies', () => {
    it('should set selected families', () => {
      useNISTQueryStore.getState().setSelectedFamilies(['AC', 'SC', 'AU']);
      expect(useNISTQueryStore.getState().selectedFamilies).toEqual(['AC', 'SC', 'AU']);
    });

    it('should replace existing families', () => {
      useNISTQueryStore.setState({
        ...initialState,
        selectedFamilies: ['AC'],
      });
      useNISTQueryStore.getState().setSelectedFamilies(['SC', 'AU']);
      expect(useNISTQueryStore.getState().selectedFamilies).toEqual(['SC', 'AU']);
    });
  });

  describe('setSearchScope', () => {
    it('should set search scope to nist', () => {
      useNISTQueryStore.getState().setSearchScope('nist');
      expect(useNISTQueryStore.getState().searchScope).toBe('nist');
    });

    it('should set search scope to user', () => {
      useNISTQueryStore.getState().setSearchScope('user');
      expect(useNISTQueryStore.getState().searchScope).toBe('user');
    });

    it('should set search scope to both', () => {
      useNISTQueryStore.setState({ ...initialState, searchScope: 'nist' });
      useNISTQueryStore.getState().setSearchScope('both');
      expect(useNISTQueryStore.getState().searchScope).toBe('both');
    });
  });

  describe('clearHistory', () => {
    it('should clear all query history and related state', () => {
      useNISTQueryStore.setState({
        queryHistory: [
          {
            id: 'query-1',
            query: 'test',
            response: { answer: 'response', references: [], tokensUsed: 0, contextTokensUsed: 0, retrievedChunks: [] },
            timestamp: Date.now(),
          },
        ],
        currentQuery: 'new query',
        currentResponse: 'partial response',
        currentReferences: [{ documentTitle: 'doc', chunkIndex: 0, relevance: 0.9 }],
        currentContextTokens: 100,
        error: 'Some error',
      });

      useNISTQueryStore.getState().clearHistory();

      const state = useNISTQueryStore.getState();
      expect(state.queryHistory).toEqual([]);
      expect(state.currentQuery).toBe('');
      expect(state.currentResponse).toBe('');
      expect(state.currentReferences).toEqual([]);
      expect(state.currentContextTokens).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      useNISTQueryStore.setState({ ...initialState, error: 'Some error' });
      useNISTQueryStore.getState().clearError();
      expect(useNISTQueryStore.getState().error).toBeNull();
    });

    it('should not affect other state', () => {
      useNISTQueryStore.setState({
        ...initialState,
        error: 'Error',
        currentQuery: 'test query',
      });

      useNISTQueryStore.getState().clearError();

      expect(useNISTQueryStore.getState().currentQuery).toBe('test query');
    });
  });

  describe('stopGeneration', () => {
    it('should stop streaming and loading', () => {
      useNISTQueryStore.setState({
        ...initialState,
        isStreaming: true,
        isLoading: true,
      });

      useNISTQueryStore.getState().stopGeneration();

      const state = useNISTQueryStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('askQuestion', () => {
    it('should reset state before asking question', async () => {
      // Setup a mock that returns an empty async iterator
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'metadata', data: { references: [], contextTokensUsed: 0 } };
        yield { type: 'token', data: 'Response' };
      });

      useNISTQueryStore.setState({
        ...initialState,
        error: 'Previous error',
        currentResponse: 'Old response',
      });

      const promise = useNISTQueryStore.getState().askQuestion('What is AC-2?');

      // Check intermediate state
      expect(useNISTQueryStore.getState().currentQuery).toBe('What is AC-2?');
      expect(useNISTQueryStore.getState().error).toBeNull();

      await promise;
    });

    it('should handle streaming response', async () => {
      const mockReferences = [{ documentTitle: 'NIST 800-53', chunkIndex: 1, relevance: 0.95 }];

      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'metadata', data: { references: mockReferences, contextTokensUsed: 500 } };
        yield { type: 'token', data: 'This ' };
        yield { type: 'token', data: 'is ' };
        yield { type: 'token', data: 'a response.' };
      });

      await useNISTQueryStore.getState().askQuestion('Test query');

      const state = useNISTQueryStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.queryHistory).toHaveLength(1);
      expect(state.queryHistory[0].response.answer).toBe('This is a response.');
    });

    it('should update references from metadata', async () => {
      const mockReferences = [
        { documentTitle: 'NIST 800-53', chunkIndex: 1, relevance: 0.95 },
        { documentTitle: 'NIST CSF', chunkIndex: 2, relevance: 0.87 },
      ];

      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'metadata', data: { references: mockReferences, contextTokensUsed: 1000 } };
        yield { type: 'token', data: 'Response' };
      });

      await useNISTQueryStore.getState().askQuestion('Test');

      expect(useNISTQueryStore.getState().queryHistory[0].response.references).toEqual(mockReferences);
    });

    it('should pass filters to request', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      useNISTQueryStore.setState({
        ...initialState,
        selectedDocumentTypes: ['sp800-53'],
        selectedFamilies: ['AC', 'SC'],
        searchScope: 'nist',
      });

      await useNISTQueryStore.getState().askQuestion('Query');

      expect(mockQueryStream).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Query',
          documentTypes: ['sp800-53'],
          families: ['AC', 'SC'],
          searchScope: 'nist',
        })
      );
    });

    it('should handle options override', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      useNISTQueryStore.setState({
        ...initialState,
        selectedDocumentTypes: ['sp800-53'],
      });

      await useNISTQueryStore.getState().askQuestion('Query', {
        documentTypes: ['custom-type'],
        maxTokens: 1000,
      });

      expect(mockQueryStream).toHaveBeenCalledWith(
        expect.objectContaining({
          documentTypes: ['custom-type'],
          maxTokens: 1000,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockQueryStream.mockImplementation(async function* () {
        throw new Error('API error');
      });

      await useNISTQueryStore.getState().askQuestion('Test');

      const state = useNISTQueryStore.getState();
      expect(state.error).toBe('API error');
      expect(state.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should add to query history on completion', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'metadata', data: { references: [], contextTokensUsed: 100 } };
        yield { type: 'token', data: 'Complete response' };
      });

      await useNISTQueryStore.getState().askQuestion('First query');
      await useNISTQueryStore.getState().askQuestion('Second query');

      const state = useNISTQueryStore.getState();
      expect(state.queryHistory).toHaveLength(2);
      expect(state.queryHistory[0].query).toBe('First query');
      expect(state.queryHistory[1].query).toBe('Second query');
    });

    it('should clear current response after moving to history', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      await useNISTQueryStore.getState().askQuestion('Test');

      expect(useNISTQueryStore.getState().currentResponse).toBe('');
      expect(useNISTQueryStore.getState().currentQuery).toBe('');
    });
  });

  describe('Filter State Persistence', () => {
    it('should maintain filters across multiple queries', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      useNISTQueryStore.getState().setSelectedDocumentTypes(['sp800-53']);
      useNISTQueryStore.getState().setSelectedFamilies(['AC']);
      useNISTQueryStore.getState().setSearchScope('nist');

      await useNISTQueryStore.getState().askQuestion('Query 1');
      await useNISTQueryStore.getState().askQuestion('Query 2');

      const state = useNISTQueryStore.getState();
      expect(state.selectedDocumentTypes).toEqual(['sp800-53']);
      expect(state.selectedFamilies).toEqual(['AC']);
      expect(state.searchScope).toBe('nist');
    });
  });

  describe('Query History', () => {
    it('should track query timestamps', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      const beforeTime = Date.now();
      await useNISTQueryStore.getState().askQuestion('Test');
      const afterTime = Date.now();

      const historyEntry = useNISTQueryStore.getState().queryHistory[0];
      expect(historyEntry.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(historyEntry.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should generate unique IDs for each query', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      await useNISTQueryStore.getState().askQuestion('Query 1');
      await useNISTQueryStore.getState().askQuestion('Query 2');

      const state = useNISTQueryStore.getState();
      expect(state.queryHistory[0].id).not.toBe(state.queryHistory[1].id);
    });

    it('should store filter context in history', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      useNISTQueryStore.setState({
        ...initialState,
        selectedDocumentTypes: ['sp800-53'],
        selectedFamilies: ['AC'],
      });

      await useNISTQueryStore.getState().askQuestion('Test');

      const historyEntry = useNISTQueryStore.getState().queryHistory[0];
      expect(historyEntry.filters?.documentTypes).toEqual(['sp800-53']);
      expect(historyEntry.filters?.families).toEqual(['AC']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response stream', async () => {
      mockQueryStream.mockImplementation(async function* () {
        // Empty stream
      });

      await useNISTQueryStore.getState().askQuestion('Test');

      const state = useNISTQueryStore.getState();
      expect(state.queryHistory).toHaveLength(1);
      expect(state.queryHistory[0].response.answer).toBe('');
    });

    it('should handle rapid consecutive queries', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      // Fire multiple queries without waiting
      await Promise.all([
        useNISTQueryStore.getState().askQuestion('Query 1'),
        useNISTQueryStore.getState().askQuestion('Query 2'),
        useNISTQueryStore.getState().askQuestion('Query 3'),
      ]);

      // All queries should complete without errors
      expect(useNISTQueryStore.getState().isStreaming).toBe(false);
      expect(useNISTQueryStore.getState().isLoading).toBe(false);
    });

    it('should handle special characters in query', async () => {
      mockQueryStream.mockImplementation(async function* () {
        yield { type: 'token', data: 'Response' };
      });

      await useNISTQueryStore.getState().askQuestion('What is AC-2(1)?');

      const state = useNISTQueryStore.getState();
      expect(state.queryHistory[0].query).toBe('What is AC-2(1)?');
    });
  });
});
