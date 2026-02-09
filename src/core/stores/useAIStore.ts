/**
 * Unified AI Store
 *
 * This store provides a unified interface to AI-related functionality
 * while maintaining backward compatibility with existing stores.
 *
 * The consolidation provides:
 * - Single import point for all AI functionality
 * - Unified selectors and actions
 * - Clear ownership of AI-related state
 * - Simplified mental model (3 stores → 1 facade)
 *
 * Original stores (for reference/migration):
 * - useAIServiceStore: Service health & status
 * - useNISTQueryStore: NIST document queries
 * - useAINarrativesStore: AI narrative generation
 */

import { useAIServiceStore } from './useAIServiceStore';
import { useNISTQueryStore } from './useNISTQueryStore';
import { useAINarrativesStore } from './useAINarrativesStore';

// Re-export individual stores for backward compatibility
export { useAIServiceStore } from './useAIServiceStore';
export { useNISTQueryStore } from './useNISTQueryStore';
export { useAINarrativesStore } from './useAINarrativesStore';

/**
 * Unified AI Store Hook
 *
 * Provides a single access point to all AI-related state and actions.
 * This is the recommended way to access AI functionality.
 *
 * @example
 * ```tsx
 * const {
 *   // Service status
 *   status, isReady, initializeService,
 *   // NIST queries
 *   askNISTQuestion, nistQueryHistory,
 *   // AI narratives
 *   generateNarrative, chatHistory
 * } = useAIStore();
 * ```
 */
export function useAIStore() {
  // Service status from useAIServiceStore
  const serviceState = useAIServiceStore();

  // NIST query state from useNISTQueryStore
  const nistState = useNISTQueryStore();

  // AI narratives state from useAINarrativesStore
  const narrativesState = useAINarrativesStore();

  return {
    // ===== Service Status (from useAIServiceStore) =====
    status: serviceState.status,
    preloadProgress: serviceState.preloadProgress,

    // Computed helpers
    isReady: serviceState.status.status === 'ready',
    isInitializing: serviceState.status.status === 'initializing',
    hasError: serviceState.status.status === 'error',

    // Service actions
    initializeService: serviceState.initialize,
    checkHealth: serviceState.checkHealth,
    updateStatus: serviceState.updateStatus,
    setGPUBackend: serviceState.setGPUBackend,
    updatePreloadProgress: serviceState.updatePreloadProgress,
    startPreloadListener: serviceState.startPreloadListener,
    stopPreloadListener: serviceState.stopPreloadListener,

    // ===== NIST Queries (from useNISTQueryStore) =====
    nistQueryHistory: nistState.queryHistory,
    nistCurrentQuery: nistState.currentQuery,
    nistCurrentResponse: nistState.currentResponse,
    nistIsStreaming: nistState.isStreaming,
    nistIsLoading: nistState.isLoading,
    nistError: nistState.error,
    nistCurrentReferences: nistState.currentReferences,
    nistCurrentContextTokens: nistState.currentContextTokens,
    nistSelectedDocumentTypes: nistState.selectedDocumentTypes,
    nistSelectedFamilies: nistState.selectedFamilies,
    nistSearchScope: nistState.searchScope,

    // NIST query actions
    askNISTQuestion: nistState.askQuestion,
    stopNISTGeneration: nistState.stopGeneration,
    clearNISTHistory: nistState.clearHistory,
    setNISTCurrentQuery: nistState.setCurrentQuery,
    setNISTSelectedDocumentTypes: nistState.setSelectedDocumentTypes,
    setNISTSelectedFamilies: nistState.setSelectedFamilies,
    setNISTSearchScope: nistState.setSearchScope,
    clearNISTError: nistState.clearError,

    // ===== AI Narratives (from useAINarrativesStore) =====
    narratives: narrativesState.narratives,
    chatHistory: narrativesState.chatHistory,

    // Narrative actions
    requestNarrative: narrativesState.requestNarrative,
    generateNarrative: narrativesState.generateNarrative,
    acceptNarrative: narrativesState.acceptNarrative,
    rejectNarrative: narrativesState.rejectNarrative,
    updateNarrative: narrativesState.updateNarrative,
    clearNarrative: narrativesState.clearNarrative,
    sendMessage: narrativesState.sendMessage,
    clearChatHistory: narrativesState.clearChatHistory,
    getNarrative: narrativesState.getNarrative,
    isGenerating: narrativesState.isGenerating,
  };
}

// ============================================================================
// Selectors for granular subscriptions
// ============================================================================

/**
 * Selector for service status only
 */
export const useAIServiceStatus = () => {
  const status = useAIServiceStore((state) => state.status);
  return {
    status,
    isReady: status.status === 'ready',
    isInitializing: status.status === 'initializing',
    hasError: status.status === 'error',
    llmReady: status.llmStatus === 'ready',
    embeddingReady: status.embeddingStatus === 'ready',
    chromaReady: status.chromaDbStatus === 'connected',
  };
};

/**
 * Selector for NIST query streaming state
 */
export const useNISTQueryStreaming = () => {
  return useNISTQueryStore((state) => ({
    isStreaming: state.isStreaming,
    isLoading: state.isLoading,
    currentResponse: state.currentResponse,
    error: state.error,
  }));
};

/**
 * Selector for narrative generation status
 */
export const useNarrativeStatus = (controlId: string) => {
  return useAINarrativesStore((state) => state.narratives[controlId]);
};

/**
 * Selector for chat history
 */
export const useChatHistory = () => {
  return useAINarrativesStore((state) => state.chatHistory);
};

// ============================================================================
// Static access for non-React contexts
// ============================================================================

/**
 * Get the current state of all AI stores (non-reactive)
 */
export const getAIState = () => ({
  service: useAIServiceStore.getState(),
  nist: useNISTQueryStore.getState(),
  narratives: useAINarrativesStore.getState(),
});

/**
 * Initialize AI services
 */
export const initializeAI = async () => {
  await useAIServiceStore.getState().initialize();
};

/**
 * Check AI service health
 */
export const checkAIHealth = async () => {
  await useAIServiceStore.getState().checkHealth();
};
