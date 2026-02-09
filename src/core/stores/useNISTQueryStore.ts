// NIST Query Store
// Zustand store for NIST document queries with streaming and stop capability

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { NISTQueryRequest, NISTQueryResponse, NISTQueryHistory, SearchScope, ExplanationMode } from '@/lib/ai/types';
import { getNISTRAGOrchestrator } from '@/lib/ai/nistRAG';

interface NISTQueryState {
  // State
  queryHistory: NISTQueryHistory[];
  currentQuery: string;
  currentResponse: string;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  currentReferences: NISTQueryResponse['references'];
  currentContextTokens: number;
  
  // Filter state
  selectedDocumentTypes: string[];
  selectedFamilies: string[];
  searchScope: SearchScope;
  explanationMode: ExplanationMode;

  // Actions
  askQuestion: (query: string, options?: Partial<NISTQueryRequest>) => Promise<void>;
  stopGeneration: () => void;
  clearHistory: () => void;
  setCurrentQuery: (query: string) => void;
  setSelectedDocumentTypes: (types: string[]) => void;
  setSelectedFamilies: (families: string[]) => void;
  setSearchScope: (scope: SearchScope) => void;
  setExplanationMode: (mode: ExplanationMode) => void;
  clearError: () => void;
}

// AbortController for stopping generation
let currentAbortController: AbortController | null = null;

export const useNISTQueryStore = create<NISTQueryState>()(
  devtools(
    (set, get) => ({
      // Initial state
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
      explanationMode: 'standard' as ExplanationMode,

      // Ask a question with streaming response
      async askQuestion(query: string, options: Partial<NISTQueryRequest> = {}) {
        const ragOrchestrator = getNISTRAGOrchestrator();
        
        // Reset state
        set({
          currentQuery: query,
          currentResponse: '',
          isLoading: true,
          isStreaming: false,
          error: null,
          currentReferences: [],
          currentContextTokens: 0,
        });

        // Create new abort controller for this query
        currentAbortController = new AbortController();

        try {
          // Build request with filters from state
          const { selectedDocumentTypes, selectedFamilies, searchScope, explanationMode } = get();
          const request: NISTQueryRequest = {
            query,
            documentTypes: options.documentTypes || (selectedDocumentTypes.length > 0 ? selectedDocumentTypes : undefined),
            families: options.families || (selectedFamilies.length > 0 ? selectedFamilies : undefined),
            topK: options.topK || 6,
            maxTokens: options.maxTokens || 600,
            maxContextTokens: options.maxContextTokens || 2048,
            searchScope: options.searchScope || searchScope,
            explanationMode: options.explanationMode || explanationMode,
          };

          set({ isLoading: false, isStreaming: true });

          let fullResponse = '';
          let metadata: { references: any[]; contextTokensUsed: number } | null = null;

          // Stream the response
          for await (const chunk of ragOrchestrator.queryNISTDocumentsStream(request)) {
            // Check if aborted
            if (currentAbortController?.signal.aborted) {
              set({ isStreaming: false });
              return;
            }

            if (chunk.type === 'metadata') {
              metadata = chunk.data as { references: any[]; contextTokensUsed: number };
              set({
                currentReferences: metadata.references,
                currentContextTokens: metadata.contextTokensUsed,
              });
            } else if (chunk.type === 'token') {
              fullResponse += chunk.data;
              set({ currentResponse: fullResponse });
            }
          }

          // Check if aborted after completion
          if (currentAbortController?.signal.aborted) {
            set({ isStreaming: false });
            return;
          }

          // Save to history
          const historyEntry: NISTQueryHistory = {
            id: `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            query,
            response: {
              answer: fullResponse.trim(),
              retrievedChunks: [], // Not stored in history to save memory
              references: metadata?.references || [],
              tokensUsed: 0, // Approximate
              contextTokensUsed: metadata?.contextTokensUsed || 0,
            },
            timestamp: Date.now(),
            filters: {
              documentTypes: request.documentTypes,
              families: request.families,
            },
          };

          set((state) => ({
            queryHistory: [...state.queryHistory, historyEntry],
            isStreaming: false,
            currentQuery: '',
            currentResponse: '', // Clear current response after moving to history
          }));

          currentAbortController = null;
        } catch (error) {
          console.error('[NIST Query] Error:', error);
          set({
            error: error instanceof Error ? error.message : 'An unknown error occurred',
            isStreaming: false,
            isLoading: false,
          });
          currentAbortController = null;
        }
      },

      // Stop current generation
      stopGeneration() {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        set({
          isStreaming: false,
          isLoading: false,
        });
      },

      // Clear query history
      clearHistory() {
        set({
          queryHistory: [],
          currentQuery: '',
          currentResponse: '',
          currentReferences: [],
          currentContextTokens: 0,
          error: null,
        });
      },

      // Set current query text
      setCurrentQuery(query: string) {
        set({ currentQuery: query });
      },

      // Set selected document types filter
      setSelectedDocumentTypes(types: string[]) {
        set({ selectedDocumentTypes: types });
      },

      // Set selected families filter
      setSelectedFamilies(families: string[]) {
        set({ selectedFamilies: families });
      },

      // Set search scope
      setSearchScope(scope: SearchScope) {
        set({ searchScope: scope });
      },

      // Set explanation mode (standard or eli5)
      setExplanationMode(mode: ExplanationMode) {
        set({ explanationMode: mode });
      },

      // Clear error
      clearError() {
        set({ error: null });
      },
    }),
    { name: 'NIST Query Store' }
  )
);

