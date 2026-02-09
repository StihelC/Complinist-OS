// AI Service Store
// Tracks AI service status and configuration

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AIServiceStatus, DetectedModel, ModelPreferences } from '@/lib/ai/types';
import { getLLMServer } from '@/lib/ai/llamaServer';
import { getEmbeddingService } from '@/lib/ai/embeddingService';
import { getChromaDBClient } from '@/lib/ai/chromaClient';
import { loadAIConfig } from '@/lib/ai/config';

// Preload progress state
interface PreloadProgress {
  isPreloading: boolean;
  stage: string;
  progress: number;
  message: string;
}

interface AIServiceState {
  status: AIServiceStatus;
  preloadProgress: PreloadProgress;
  availableModels: DetectedModel[];
  modelPreferences: ModelPreferences | null;
  customModelsPath: string | null;
  currentModelsDirectory: string | null;

  // Actions
  initialize: () => Promise<void>;
  checkHealth: () => Promise<void>;
  updateStatus: (updates: Partial<AIServiceStatus>) => void;
  setGPUBackend: (backend: 'auto' | 'cuda' | 'metal' | 'vulkan' | 'cpu') => void;

  // Preload actions
  updatePreloadProgress: (progress: Partial<PreloadProgress>) => void;
  startPreloadListener: () => Promise<void>;
  stopPreloadListener: () => void;

  // Model management actions
  scanModels: () => Promise<void>;
  getAvailableModels: () => Promise<void>;
  setModelPreferences: (llmModelPath: string, embeddingModelPath: string) => Promise<void>;
  getModelPreferences: () => Promise<void>;

  // Custom models path actions
  setCustomModelsPath: (path: string) => Promise<boolean>;
  getCustomModelsPath: () => Promise<string | null>;
  clearCustomModelsPath: () => Promise<boolean>;
  browseModelsFolder: () => Promise<string | null>;
  refreshCurrentModelsDirectory: () => Promise<void>;
}

export const useAIServiceStore = create<AIServiceState>()(
  devtools(
    (set, get) => ({
      status: {
        status: 'not_initialized',
        llmStatus: 'not_loaded',
        embeddingStatus: 'not_loaded',
        chromaDbStatus: 'not_connected',
        gpuBackend: 'auto',
      },

      preloadProgress: {
        isPreloading: false,
        stage: '',
        progress: 0,
        message: '',
      },

      availableModels: [],
      modelPreferences: null,
      customModelsPath: null,
      currentModelsDirectory: null,

      async initialize() {
        const config = loadAIConfig();
        
        set({
          status: {
            ...get().status,
            status: 'initializing',
            gpuBackend: config.gpuBackend,
          },
        });

        // Check health via IPC - services initialize on first use
        await get().checkHealth();
      },

      async checkHealth() {
        const llmServer = getLLMServer();
        const embeddingService = getEmbeddingService();
        const chromaClient = getChromaDBClient();

        // Get health status and context size from a single checkAIHealth call
        let contextSize = 2500;
        let llmHealthy = false;
        let embeddingHealthy = false;
        let chromaHealthy = false;

        // Try to get context size from health check response
        if (typeof window !== 'undefined' && (window as any).electronAPI?.checkAIHealth) {
          try {
            const health = await (window as any).electronAPI.checkAIHealth();
            llmHealthy = health?.llm ?? false;
            embeddingHealthy = health?.embedding ?? false;
            chromaHealthy = health?.chroma ?? false;
            if (health?.contextSize) {
              contextSize = health.contextSize;
              // Set on window for other modules to access synchronously
              (window as any).calibratedContextSize = contextSize;
              console.log('[AI Service] Calibrated context size:', contextSize);
            }
          } catch (error) {
            console.warn('[AI Service] Health check failed:', error);
            // Fall back to individual checks
            [llmHealthy, embeddingHealthy, chromaHealthy] = await Promise.all([
              llmServer.checkHealth().catch(() => false),
              embeddingService.checkHealth().catch(() => false),
              chromaClient.checkHealth().catch(() => false),
            ]);
          }
        } else {
          // No Electron API, use individual checks
          [llmHealthy, embeddingHealthy, chromaHealthy] = await Promise.all([
            llmServer.checkHealth().catch(() => false),
            embeddingService.checkHealth().catch(() => false),
            chromaClient.checkHealth().catch(() => false),
          ]);
        }

        set((state) => ({
          status: {
            ...state.status,
            llmStatus: llmHealthy ? 'ready' : 'not_loaded',
            embeddingStatus: embeddingHealthy ? 'ready' : 'not_loaded',
            chromaDbStatus: chromaHealthy ? 'connected' : 'not_connected',
            status:
              llmHealthy && embeddingHealthy && chromaHealthy ? 'ready' : 'error',
            modelInfo: {
              llmModel: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
              embeddingModel: 'bge-m3-FP16.gguf',
              contextWindow: contextSize,
            },
          },
        }));
      },

      updateStatus(updates) {
        set((state) => ({
          status: {
            ...state.status,
            ...updates,
          },
        }));
      },

      setGPUBackend(backend) {
        set((state) => ({
          status: {
            ...state.status,
            gpuBackend: backend,
          },
        }));
      },

      updatePreloadProgress(progress) {
        set((state) => ({
          preloadProgress: {
            ...state.preloadProgress,
            ...progress,
          },
        }));
      },

      async startPreloadListener() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.onAIPreloadProgress) {
          // Check current preload status from backend first to avoid race condition
          // where preload completed before listener was registered
          let isCurrentlyPreloading = false;
          if ((window as any).electronAPI?.getAIPreloadStatus) {
            try {
              const status = await (window as any).electronAPI.getAIPreloadStatus();
              isCurrentlyPreloading = status?.isPreloading ?? false;
            } catch (error) {
              console.warn('[AI Store] Failed to get preload status:', error);
            }
          }

          // Only set preloading state if actually preloading
          if (isCurrentlyPreloading) {
            set((state) => ({
              preloadProgress: {
                ...state.preloadProgress,
                isPreloading: true,
              },
            }));
          } else {
            // Preload already complete, ensure state reflects this and check health
            set((state) => ({
              preloadProgress: {
                ...state.preloadProgress,
                isPreloading: false,
                stage: 'complete',
                progress: 100,
                message: 'AI services ready',
              },
            }));
            get().checkHealth();
          }

          // Listen for preload progress events
          (window as any).electronAPI.onAIPreloadProgress(
            (data: { stage: string; progress: number; message: string }) => {
              const isComplete = data.stage === 'complete';
              const isError = data.stage === 'error';

              set({
                preloadProgress: {
                  isPreloading: !isComplete && !isError,
                  stage: data.stage,
                  progress: data.progress,
                  message: data.message,
                },
              });

              // When preload completes successfully, update AI service status
              if (isComplete) {
                get().checkHealth();
              }
            }
          );
        }
      },

      stopPreloadListener() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.removeAIPreloadProgressListener) {
          (window as any).electronAPI.removeAIPreloadProgressListener();
        }
      },

      async scanModels() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.scanModels) {
          try {
            const result = await (window as any).electronAPI.scanModels();
            if (result.success) {
              set({ availableModels: result.data || [] });
            } else {
              console.error('[AI Store] Scan models failed:', result.error);
            }
          } catch (error) {
            console.error('[AI Store] Scan models error:', error);
          }
        }
      },

      async getAvailableModels() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.getAvailableModels) {
          try {
            const result = await (window as any).electronAPI.getAvailableModels();
            if (result.success) {
              set({ availableModels: result.data || [] });
            } else {
              console.error('[AI Store] Get available models failed:', result.error);
            }
          } catch (error) {
            console.error('[AI Store] Get available models error:', error);
          }
        }
      },

      async setModelPreferences(llmModelPath: string, embeddingModelPath: string) {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.setModelPreferences) {
          try {
            const result = await (window as any).electronAPI.setModelPreferences({
              llmModelPath,
              embeddingModelPath,
            });
            if (result.success) {
              set({
                modelPreferences: {
                  llmModelPath,
                  embeddingModelPath,
                },
              });
            } else {
              console.error('[AI Store] Set model preferences failed:', result.error);
              throw new Error(result.error || 'Failed to set model preferences');
            }
          } catch (error) {
            console.error('[AI Store] Set model preferences error:', error);
            throw error;
          }
        }
      },

      async getModelPreferences() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.getModelPreferences) {
          try {
            const result = await (window as any).electronAPI.getModelPreferences();
            if (result.success) {
              set({ modelPreferences: result.data || null });
            } else {
              console.error('[AI Store] Get model preferences failed:', result.error);
            }
          } catch (error) {
            console.error('[AI Store] Get model preferences error:', error);
          }
        }
      },

      async setCustomModelsPath(path: string) {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.setCustomModelsPath) {
          try {
            const result = await (window as any).electronAPI.setCustomModelsPath(path);
            if (result.success) {
              set({ customModelsPath: path });
              // Refresh the current directory and rescan models
              await get().refreshCurrentModelsDirectory();
              await get().scanModels();
              return true;
            } else {
              console.error('[AI Store] Set custom models path failed:', result.error);
              return false;
            }
          } catch (error) {
            console.error('[AI Store] Set custom models path error:', error);
            return false;
          }
        }
        return false;
      },

      async getCustomModelsPath() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.getCustomModelsPath) {
          try {
            const result = await (window as any).electronAPI.getCustomModelsPath();
            if (result.success) {
              set({ customModelsPath: result.path });
              return result.path;
            } else {
              console.error('[AI Store] Get custom models path failed:', result.error);
            }
          } catch (error) {
            console.error('[AI Store] Get custom models path error:', error);
          }
        }
        return null;
      },

      async clearCustomModelsPath() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.clearCustomModelsPath) {
          try {
            const result = await (window as any).electronAPI.clearCustomModelsPath();
            if (result.success) {
              set({ customModelsPath: null });
              // Refresh the current directory and rescan models
              await get().refreshCurrentModelsDirectory();
              await get().scanModels();
              return true;
            } else {
              console.error('[AI Store] Clear custom models path failed:', result.error);
              return false;
            }
          } catch (error) {
            console.error('[AI Store] Clear custom models path error:', error);
            return false;
          }
        }
        return false;
      },

      async browseModelsFolder() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.browseModelsFolder) {
          try {
            const result = await (window as any).electronAPI.browseModelsFolder();
            if (result.success && !result.canceled && result.path) {
              return result.path;
            }
          } catch (error) {
            console.error('[AI Store] Browse models folder error:', error);
          }
        }
        return null;
      },

      async refreshCurrentModelsDirectory() {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.getCurrentModelsDirectory) {
          try {
            const result = await (window as any).electronAPI.getCurrentModelsDirectory();
            if (result.success) {
              set({ currentModelsDirectory: result.directory || null });
            }
          } catch (error) {
            console.error('[AI Store] Get current models directory error:', error);
          }
        }
      },
    }),
    { name: 'AI Service Store' }
  )
);

