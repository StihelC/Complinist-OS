/**
 * DI Container Setup for Renderer Process
 *
 * This module configures the DI container with all renderer process services.
 * It wraps IPC calls in service interfaces for clean dependency injection.
 *
 * @module src/core/di/setup
 */

import { getRendererContainer, RendererServiceTokens, resetRendererContainer } from './container';
import type { DIContainer } from './container';

/**
 * Database client interface wrapping IPC calls
 */
export interface IDatabaseClient {
  createProject(name: string, baseline: string): Promise<{ id: number; name: string; baseline: string }>;
  listProjects(): Promise<Array<{ id: number; name: string; baseline: string }>>;
  saveDiagram(projectId: number, nodes: unknown[], edges: unknown[], viewport: unknown): Promise<{ success: boolean }>;
  loadDiagram(projectId: number): Promise<{ nodes: unknown[]; edges: unknown[]; viewport: unknown }>;
  deleteProject(projectId: number): Promise<{ success: boolean }>;
  loadControlNarratives(projectId: number): Promise<unknown[]>;
  saveControlNarratives(projectId: number, narratives: unknown[]): Promise<{ success: boolean }>;
  updateProjectBaseline(projectId: number, baseline: string): Promise<{ success: boolean }>;
  resetControlNarrative(projectId: number, controlId: string): Promise<{ success: boolean }>;
  queryDevices(projectId: number, filters?: Record<string, unknown>): Promise<unknown[]>;
  getDevice(projectId: number, deviceId: string): Promise<unknown | null>;
  searchDevices(projectId: number, searchTerm: string): Promise<unknown[]>;
}

/**
 * AI client interface wrapping IPC calls
 */
export interface IAIClient {
  generateText(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<{ success: boolean; data?: { text: string } }>;
  generateEmbedding(text: string | string[]): Promise<{ success: boolean; data?: { embeddings: number[][]; dimensions: number } }>;
  queryChromaDB(collection: string, queryEmbedding: number[], options?: { topK?: number; filters?: Record<string, unknown> }): Promise<{ success: boolean; data?: unknown[] }>;
  checkHealth(): Promise<{ llm: boolean; embedding: boolean; chroma: boolean; contextSize?: number }>;
}

/**
 * Export client interface wrapping IPC calls
 */
export interface IExportClient {
  exportJson(data: unknown, filePath: string): Promise<{ success: boolean; path?: string }>;
  exportCsv(csvContent: string, filename?: string): Promise<{ success: boolean; path?: string }>;
  exportPng(projectName: string, imageData?: string, svgContent?: string): Promise<{ success: boolean; path?: string }>;
  exportSvg(svgContent: string, projectName: string): Promise<{ success: boolean; path?: string }>;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Setup options for the renderer container
 */
interface SetupOptions {
  overrides?: Record<string, unknown>;
}

/**
 * Setup the renderer process DI container with all services
 * Call this during app initialization
 */
export function setupRendererContainer(options: SetupOptions = {}): DIContainer {
  const container = getRendererContainer();
  const { overrides = {} } = options;

  console.log('[DI] Setting up renderer process container...');

  // Register Logger
  if (overrides[RendererServiceTokens.LOGGER]) {
    container.registerInstance(RendererServiceTokens.LOGGER, overrides[RendererServiceTokens.LOGGER] as ILogger);
  } else {
    container.registerSingleton<ILogger>(RendererServiceTokens.LOGGER, () => ({
      debug: (...args: unknown[]) => console.debug('[App]', ...args),
      info: (...args: unknown[]) => console.info('[App]', ...args),
      warn: (...args: unknown[]) => console.warn('[App]', ...args),
      error: (...args: unknown[]) => console.error('[App]', ...args),
    }));
  }

  // Register Database Client
  if (overrides[RendererServiceTokens.DATABASE_CLIENT]) {
    container.registerInstance(RendererServiceTokens.DATABASE_CLIENT, overrides[RendererServiceTokens.DATABASE_CLIENT] as IDatabaseClient);
  } else {
    container.registerSingleton<IDatabaseClient>(RendererServiceTokens.DATABASE_CLIENT, () => {
      // Helper to check if electronAPI is available
      const getApi = () => {
        if (!window.electronAPI) {
          throw new Error('Electron API not available. Please run in Electron.');
        }
        return window.electronAPI;
      };

      return {
        createProject: async (name, baseline) => getApi().createProject({ name, baseline }),
        listProjects: async () => getApi().listProjects(),
        saveDiagram: async (projectId, nodes, edges, viewport) =>
          getApi().saveDiagram({ projectId, nodes, edges, viewport }),
        loadDiagram: async (projectId) => getApi().loadDiagram(projectId),
        deleteProject: async (projectId) => getApi().deleteProject(projectId),
        loadControlNarratives: async (projectId) => getApi().loadControlNarratives(projectId),
        saveControlNarratives: async (projectId, narratives) =>
          getApi().saveControlNarratives({ projectId, narratives }),
        updateProjectBaseline: async (projectId, baseline) =>
          getApi().updateProjectBaseline({ projectId, baseline }),
        resetControlNarrative: async (projectId, controlId) =>
          getApi().resetControlNarrative({ projectId, controlId }),
        queryDevices: async (projectId, filters) =>
          getApi().queryDevices({ projectId, filters: filters || {} }),
        getDevice: async (projectId, deviceId) =>
          getApi().getDevice({ projectId, deviceId }),
        searchDevices: async (projectId, searchTerm) =>
          getApi().searchDevices({ projectId, searchTerm }),
      };
    });
  }

  // Register AI Client
  if (overrides[RendererServiceTokens.AI_CLIENT]) {
    container.registerInstance(RendererServiceTokens.AI_CLIENT, overrides[RendererServiceTokens.AI_CLIENT] as IAIClient);
  } else {
    container.registerSingleton<IAIClient>(RendererServiceTokens.AI_CLIENT, () => {
      const getApi = () => {
        if (!window.electronAPI) {
          throw new Error('Electron API not available. Please run in Electron.');
        }
        return window.electronAPI;
      };

      return {
        generateText: async (prompt, options = {}) =>
          getApi().llmGenerate({ prompt, ...options }),
        generateEmbedding: async (text) =>
          getApi().embed({ text }),
        queryChromaDB: async (collection, queryEmbedding, options = {}) =>
          getApi().chromaDbQuery({ collection, queryEmbedding, ...options }),
        checkHealth: async () =>
          getApi().checkAIHealth(),
      };
    });
  }

  // Register Export Client
  if (overrides[RendererServiceTokens.EXPORT_CLIENT]) {
    container.registerInstance(RendererServiceTokens.EXPORT_CLIENT, overrides[RendererServiceTokens.EXPORT_CLIENT] as IExportClient);
  } else {
    container.registerSingleton<IExportClient>(RendererServiceTokens.EXPORT_CLIENT, () => {
      const getApi = () => {
        if (!window.electronAPI) {
          throw new Error('Electron API not available. Please run in Electron.');
        }
        return window.electronAPI;
      };

      return {
        exportJson: async (data, filePath) =>
          getApi().exportJSON({ data, filePath }),
        exportCsv: async (csvContent, filename) =>
          getApi().exportCSV({ csvContent, filename }),
        exportPng: async (projectName, imageData, svgContent) =>
          getApi().exportPNG({ projectName, imageData, svgContent }),
        exportSvg: async (svgContent, projectName) =>
          getApi().exportSVG({ svgContent, projectName }),
      };
    });
  }

  // Register Notification Service
  if (overrides[RendererServiceTokens.NOTIFICATION_SERVICE]) {
    container.registerInstance(RendererServiceTokens.NOTIFICATION_SERVICE, overrides[RendererServiceTokens.NOTIFICATION_SERVICE]);
  } else {
    container.registerSingleton(RendererServiceTokens.NOTIFICATION_SERVICE, (...deps: unknown[]) => {
      const logger = deps[0] as ILogger;
      return {
        success: (message: string) => {
          logger.info('Notification:', message);
          // In a real app, this would show a toast notification
        },
        error: (message: string) => {
          logger.error('Notification:', message);
        },
        warning: (message: string) => {
          logger.warn('Notification:', message);
        },
        info: (message: string) => {
          logger.info('Notification:', message);
        },
      };
    }, [RendererServiceTokens.LOGGER]);
  }

  console.log('[DI] Renderer process container setup complete');
  console.log('[DI] Registered services:', container.getRegisteredTokens().join(', '));

  return container;
}

/**
 * Create a test container with mock services for testing
 */
export function createTestContainer(mocks: Record<string, unknown> = {}): DIContainer {
  const container = resetRendererContainer();

  // Register all mocks
  for (const [token, implementation] of Object.entries(mocks)) {
    container.registerInstance(token, implementation);
  }

  return container;
}

/**
 * Hook to use container services in React components
 * Note: This is a simple implementation. For production,
 * consider using React Context or a more sophisticated approach.
 */
export function useService<T>(token: string): T {
  const container = getRendererContainer();
  return container.resolveSync<T>(token);
}

export default setupRendererContainer;
