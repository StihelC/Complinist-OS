/**
 * AI Service Store Selectors
 *
 * Provides optimized selectors for useAIServiceStore using Zustand's shallow equality checking.
 * These selectors prevent unnecessary re-renders by only triggering updates when
 * the specific slice of state actually changes.
 *
 * Usage:
 * ```tsx
 * import { useAIServiceStore } from '@/core/stores/useAIServiceStore';
 * import { selectAIStatus, selectPreloadProgress } from '@/core/stores/selectors/aiServiceSelectors';
 * import { useShallow } from 'zustand/react/shallow';
 *
 * // In component:
 * const { status, preloadProgress } = useAIServiceStore(useShallow(selectAIStatusAndProgress));
 * ```
 */

import type { AIServiceStatus } from '@/lib/ai/types';

// Preload progress state type
interface PreloadProgress {
  isPreloading: boolean;
  stage: string;
  progress: number;
  message: string;
}

import type { DetectedModel, ModelPreferences } from '@/lib/ai/types';

// Type for the AI service state
interface AIServiceState {
  status: AIServiceStatus;
  preloadProgress: PreloadProgress;
  availableModels: DetectedModel[];
  modelPreferences: ModelPreferences | null;

  // Actions
  initialize: () => Promise<void>;
  checkHealth: () => Promise<void>;
  updateStatus: (updates: Partial<AIServiceStatus>) => void;
  setGPUBackend: (backend: 'auto' | 'cuda' | 'metal' | 'vulkan' | 'cpu') => void;
  updatePreloadProgress: (progress: Partial<PreloadProgress>) => void;
  startPreloadListener: () => Promise<void>;
  stopPreloadListener: () => void;
  scanModels: () => Promise<void>;
  getAvailableModels: () => Promise<void>;
  setModelPreferences: (llmModelPath: string, embeddingModelPath: string) => Promise<void>;
  getModelPreferences: () => Promise<void>;
}

// ==================== State Slice Selectors ====================

/**
 * Selects the full AI service status
 * Use for displaying comprehensive AI status information
 */
export const selectAIStatus = (state: AIServiceState) => state.status;

/**
 * Selects preload progress
 * Use for showing preload progress bar
 */
export const selectPreloadProgress = (state: AIServiceState) => state.preloadProgress;

/**
 * Selects both status and preload progress
 * Use when you need both pieces of information
 */
export const selectAIStatusAndProgress = (state: AIServiceState) => ({
  status: state.status,
  preloadProgress: state.preloadProgress,
});

/**
 * Selects just the overall status string
 * Use for simple status checks
 */
export const selectOverallStatus = (state: AIServiceState) => state.status.status;

/**
 * Selects LLM status
 * Use for LLM-specific UI
 */
export const selectLLMStatus = (state: AIServiceState) => state.status.llmStatus;

/**
 * Selects embedding status
 * Use for embedding-specific UI
 */
export const selectEmbeddingStatus = (state: AIServiceState) => state.status.embeddingStatus;

/**
 * Selects ChromaDB status
 * Use for ChromaDB-specific UI
 */
export const selectChromaDBStatus = (state: AIServiceState) => state.status.chromaDbStatus;

/**
 * Selects GPU backend setting
 * Use for GPU configuration UI
 */
export const selectGPUBackend = (state: AIServiceState) => state.status.gpuBackend;

/**
 * Selects model info
 * Use for displaying model details
 */
export const selectModelInfo = (state: AIServiceState) => state.status.modelInfo;

/**
 * Selects isPreloading flag
 * Use for quick preload state checks
 */
export const selectIsPreloading = (state: AIServiceState) => state.preloadProgress.isPreloading;

// ==================== Action Selectors ====================

/**
 * Selects initialization actions
 * Use for initializing AI services
 */
export const selectInitializeActions = (state: AIServiceState) => ({
  initialize: state.initialize,
  checkHealth: state.checkHealth,
});

/**
 * Selects status update actions
 * Use for modifying AI service status
 */
export const selectStatusActions = (state: AIServiceState) => ({
  updateStatus: state.updateStatus,
  setGPUBackend: state.setGPUBackend,
});

/**
 * Selects preload listener actions
 * Use for managing preload event listeners
 */
export const selectPreloadListenerActions = (state: AIServiceState) => ({
  startPreloadListener: state.startPreloadListener,
  stopPreloadListener: state.stopPreloadListener,
});

/**
 * Selects preload progress update action
 * Use for updating preload progress
 */
export const selectPreloadProgressAction = (state: AIServiceState) => ({
  updatePreloadProgress: state.updatePreloadProgress,
});

// ==================== Combined Selectors for Common Use Cases ====================

/**
 * Selector for AIStatusIndicator component
 * Combines status, progress, and common actions
 */
export const selectAIStatusIndicator = (state: AIServiceState) => ({
  status: state.status,
  preloadProgress: state.preloadProgress,
  modelPreferences: state.modelPreferences,
});

/**
 * Selector for AIStatusIndicator actions
 */
export const selectAIStatusIndicatorActions = (state: AIServiceState) => ({
  initialize: state.initialize,
  checkHealth: state.checkHealth,
  startPreloadListener: state.startPreloadListener,
  stopPreloadListener: state.stopPreloadListener,
});

/**
 * Selector for App.tsx AI status display
 * Just the status for AI dialogs
 */
export const selectAppAIStatus = (state: AIServiceState) => ({
  status: state.status,
});

/**
 * Selector for App.tsx AI actions
 */
export const selectAppAIActions = (state: AIServiceState) => ({
  checkHealth: state.checkHealth,
});

/**
 * Selector for checking if AI is ready
 * Simple boolean check for conditional rendering
 */
export const selectIsAIReady = (state: AIServiceState) =>
  state.status.status === 'ready' &&
  state.status.llmStatus === 'ready' &&
  state.status.embeddingStatus === 'ready' &&
  state.status.chromaDbStatus === 'connected';

/**
 * Selector for checking if AI has any errors
 */
export const selectHasAIError = (state: AIServiceState) =>
  state.status.status === 'error' ||
  state.status.llmStatus === 'error' ||
  state.status.embeddingStatus === 'error' ||
  state.status.chromaDbStatus === 'error';

/**
 * Selector for AI error message
 */
export const selectAIError = (state: AIServiceState) => state.status.error;
