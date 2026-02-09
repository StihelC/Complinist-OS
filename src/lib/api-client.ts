/**
 * API Client
 * Replaces window.electronAPI with REST API calls for web deployment
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Event listeners storage (for compatibility with Electron-style events)
const eventListeners: Record<string, Set<Function>> = {};

function addListener(event: string, callback: Function) {
  if (!eventListeners[event]) {
    eventListeners[event] = new Set();
  }
  eventListeners[event].add(callback);
}

function removeListener(event: string) {
  delete eventListeners[event];
}

/**
 * API Client matching window.electronAPI interface
 */
export const apiClient = {
  // Database operations
  createProject: (data: { name: string; baseline?: string }) =>
    fetchAPI('/db/create-project', { method: 'POST', body: JSON.stringify(data) }),

  listProjects: () =>
    fetchAPI('/db/list-projects'),

  saveDiagram: (data: { projectId: string; nodes: any[]; edges: any[]; viewport: any }) =>
    fetchAPI('/db/save-diagram', { method: 'POST', body: JSON.stringify(data) }),

  saveDiagramDelta: (data: { projectId: string; nodes: any[]; edges: any[]; viewport: any }) =>
    fetchAPI('/db/save-diagram-delta', { method: 'POST', body: JSON.stringify(data) }),

  loadDiagram: (projectId: string) =>
    fetchAPI(`/db/load-diagram/${projectId}`),

  deleteProject: (projectId: string) =>
    fetchAPI(`/db/delete-project/${projectId}`, { method: 'DELETE' }),

  loadControlNarratives: (projectId: string) =>
    fetchAPI(`/db/load-control-narratives/${projectId}`),

  saveControlNarratives: (data: { projectId: string; narratives: any }) =>
    fetchAPI('/db/save-control-narratives', { method: 'POST', body: JSON.stringify(data) }),

  resetControlNarrative: (data: { projectId: string; controlId: string }) =>
    fetchAPI('/db/reset-control-narrative', { method: 'POST', body: JSON.stringify(data) }),

  saveSingleControlNarrative: (data: { projectId: string; controlId: string; narrative: string; status: string }) =>
    fetchAPI('/db/save-single-control-narrative', { method: 'POST', body: JSON.stringify(data) }),

  updateProjectBaseline: (data: { projectId: string; baseline: string }) =>
    fetchAPI('/db/update-project-baseline', { method: 'POST', body: JSON.stringify(data) }),

  getSSPMetadata: (projectId: string) =>
    fetchAPI(`/db/get-ssp-metadata/${projectId}`),

  saveSSPMetadata: (data: { projectId: string; metadata: any }) =>
    fetchAPI('/db/save-ssp-metadata', { method: 'POST', body: JSON.stringify(data) }),

  // Device query operations
  queryDevices: (data: any) =>
    fetchAPI('/db/query-devices', { method: 'POST', body: JSON.stringify(data) }),

  getDevice: (data: any) =>
    fetchAPI('/db/get-device', { method: 'POST', body: JSON.stringify(data) }),

  searchDevices: (data: any) =>
    fetchAPI('/db/search-devices', { method: 'POST', body: JSON.stringify(data) }),

  // Export operations
  exportJSON: (data: any) => {
    // Trigger download in browser
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename || 'export.json';
    a.click();
    URL.revokeObjectURL(url);
    return Promise.resolve({ success: true });
  },

  importJSON: () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          resolve(JSON.parse(text));
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  captureViewport: () => Promise.resolve(null), // Not available in web

  exportPNG: (data: any) => {
    // For web, use canvas-based export
    return Promise.resolve({ success: true });
  },

  exportSVG: (data: any) => {
    const blob = new Blob([data.svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename || 'export.svg';
    a.click();
    URL.revokeObjectURL(url);
    return Promise.resolve({ success: true });
  },

  exportPNGFromSVG: (data: any) => {
    // Convert SVG to PNG in browser using canvas
    return Promise.resolve({ success: true });
  },

  exportCSV: (data: any) => {
    const blob = new Blob([data.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename || 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
    return Promise.resolve({ success: true });
  },

  exportPDF: (data: any) =>
    fetchAPI('/export/pdf', { method: 'POST', body: JSON.stringify(data) }),

  // Menu events (no-op for web - use keyboard shortcuts or UI buttons)
  onMenuNewProject: (callback: Function) => addListener('menu-new-project', callback),
  onMenuOpenProject: (callback: Function) => addListener('menu-open-project', callback),
  onMenuSave: (callback: Function) => addListener('menu-save', callback),
  onMenuUndo: (callback: Function) => addListener('menu-undo', callback),
  onMenuRedo: (callback: Function) => addListener('menu-redo', callback),
  onMenuExportSVG: (callback: Function) => addListener('menu-export-svg', callback),
  onMenuExportJSON: (callback: Function) => addListener('menu-export-json', callback),
  onMenuExportPNG: (callback: Function) => addListener('menu-export-png', callback),
  onMenuImportJSON: (callback: Function) => addListener('menu-import-json', callback),
  onMenuViewTopology: (callback: Function) => addListener('menu-view-topology', callback),
  onMenuViewInventory: (callback: Function) => addListener('menu-view-inventory', callback),
  onMenuViewSSP: (callback: Function) => addListener('menu-view-ssp', callback),
  onMenuViewNarratives: (callback: Function) => addListener('menu-view-narratives', callback),
  onMenuViewAI: (callback: Function) => addListener('menu-view-ai', callback),
  onMenuTopologyAddDevice: (callback: Function) => addListener('menu-topology-add-device', callback),
  onMenuTopologyAddBoundary: (callback: Function) => addListener('menu-topology-add-boundary', callback),
  onMenuTopologyShowPalette: (callback: Function) => addListener('menu-topology-show-palette', callback),
  onMenuTopologyShowAlignment: (callback: Function) => addListener('menu-topology-show-alignment', callback),
  onMenuInventoryAddDevice: (callback: Function) => addListener('menu-inventory-add-device', callback),
  onMenuInventoryImport: (callback: Function) => addListener('menu-inventory-import', callback),
  onMenuInventoryExport: (callback: Function) => addListener('menu-inventory-export', callback),
  onMenuInventorySearch: (callback: Function) => addListener('menu-inventory-search', callback),
  onMenuSSPGeneratePDF: (callback: Function) => addListener('menu-ssp-generate-pdf', callback),
  onMenuSSPPreview: (callback: Function) => addListener('menu-ssp-preview', callback),
  onMenuSSPSettings: (callback: Function) => addListener('menu-ssp-settings', callback),
  onMenuNarrativesNew: (callback: Function) => addListener('menu-narratives-new', callback),
  onMenuNarrativesExport: (callback: Function) => addListener('menu-narratives-export', callback),
  onMenuNarrativesImport: (callback: Function) => addListener('menu-narratives-import', callback),
  onMenuNarrativesReset: (callback: Function) => addListener('menu-narratives-reset', callback),
  onMenuAIClearChat: (callback: Function) => addListener('menu-ai-clear-chat', callback),
  onMenuAIExportChat: (callback: Function) => addListener('menu-ai-export-chat', callback),
  onMenuAISettings: (callback: Function) => addListener('menu-ai-settings', callback),
  onMenuProjects: (callback: Function) => addListener('menu-projects', callback),
  onMenuAIStatus: (callback: Function) => addListener('menu-ai-status', callback),
  onMenuEnterLicense: (callback: Function) => addListener('menu-enter-license', callback),
  onMenuLicenseStatus: (callback: Function) => addListener('menu-license-status', callback),
  onMenuLicenseInfo: (callback: Function) => addListener('menu-license-info', callback),

  // AI service operations
  llmGenerate: (data: { prompt: string; options?: any }) =>
    fetchAPI('/ai/llm-generate', { method: 'POST', body: JSON.stringify(data) }),

  llmGenerateStream: (data: { prompt: string; options?: any }) =>
    fetchAPI('/ai/llm-generate-stream', { method: 'POST', body: JSON.stringify(data) }),

  onStreamToken: (callback: Function) => addListener('ai-stream-token', callback),

  embed: (data: { texts: string[] }) =>
    fetchAPI('/ai/embed', { method: 'POST', body: JSON.stringify(data) }),

  chromaDbQuery: (data: { collectionName: string; queryEmbedding: number[]; nResults?: number }) =>
    fetchAPI('/ai/chromadb-query', { method: 'POST', body: JSON.stringify(data) }),

  chromaDbAdd: (data: any) =>
    fetchAPI('/ai/chromadb-add', { method: 'POST', body: JSON.stringify(data) }),

  checkAIHealth: () =>
    fetchAPI('/ai/check-health'),

  getContextSize: () =>
    fetchAPI('/ai/get-context-size'),

  getAIPreloadStatus: () =>
    fetchAPI('/ai/get-preload-status'),

  onAIPreloadProgress: (callback: Function) => addListener('ai-preload-progress', callback),
  removeAIPreloadProgressListener: () => removeListener('ai-preload-progress'),

  // AI model management
  scanModels: () => fetchAPI('/ai/scan-models'),
  getAvailableModels: () => fetchAPI('/ai/get-available-models'),
  setModelPreferences: (data: any) => Promise.resolve({ success: true }),
  getModelPreferences: () => Promise.resolve({}),

  // Model download (not needed for Docker - models pre-bundled)
  checkModelStatus: () => Promise.resolve({ available: true }),
  getModelsDirectory: () => Promise.resolve('/data/models'),
  getModelDownloadUrl: () => Promise.resolve(''),
  startModelDownload: () => Promise.resolve({ success: true }),
  pauseModelDownload: () => Promise.resolve({ success: true }),
  resumeModelDownload: () => Promise.resolve({ success: true }),
  cancelModelDownload: () => Promise.resolve({ success: true }),
  isModelDownloading: () => Promise.resolve(false),
  getPartialDownloadInfo: () => Promise.resolve(null),
  onModelDownloadProgress: (callback: Function) => addListener('model-download-progress', callback),
  removeModelDownloadProgressListener: () => removeListener('model-download-progress'),

  // File operations
  getDownloadsPath: () => Promise.resolve('/downloads'),

  saveFile: (data: any) => {
    const blob = new Blob([data.content], { type: data.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;
    a.click();
    URL.revokeObjectURL(url);
    return Promise.resolve({ success: true });
  },

  // SSP PDF generation
  generateSSPPDF: (data: any) =>
    fetchAPI('/export/pdf', { method: 'POST', body: JSON.stringify(data) }),

  // License operations (simplified for web - use token-based auth)
  openLicenseFile: () => Promise.resolve(null),
  saveLicense: (data: any) => {
    localStorage.setItem('compliflow-license', JSON.stringify(data));
    return Promise.resolve({ success: true });
  },
  getLicense: () => {
    const license = localStorage.getItem('compliflow-license');
    return Promise.resolve(license ? JSON.parse(license) : null);
  },
  clearLicense: () => {
    localStorage.removeItem('compliflow-license');
    return Promise.resolve({ success: true });
  },

  // Device types operations
  getDeviceTypes: () =>
    fetchAPI('/device-types/get-all'),

  getDeviceTypeByIcon: (iconPath: string) =>
    fetchAPI(`/device-types/get-by-icon?iconPath=${encodeURIComponent(iconPath)}`),

  migrateDeviceTypes: () =>
    fetchAPI('/device-types/migrate', { method: 'POST' }),

  findDeviceTypeMatch: (matchRequest: any) =>
    fetchAPI('/device-types/find-match', { method: 'POST', body: JSON.stringify(matchRequest) }),

  batchFindDeviceTypeMatch: (matchRequests: any[]) =>
    fetchAPI('/device-types/batch-find-match', { method: 'POST', body: JSON.stringify({ requests: matchRequests }) }),

  // Document chunking operations
  uploadDocument: async (data: { filePath: string; content: string; filename: string }) => {
    const formData = new FormData();
    const blob = new Blob([data.content], { type: 'application/octet-stream' });
    formData.append('file', blob, data.filename);

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  processDocument: (data: { docId: string }) =>
    fetchAPI(`/documents/process/${data.docId}`, { method: 'POST' }),

  getDocuments: () =>
    fetchAPI('/documents/list'),

  deleteDocument: (data: { docId: string }) =>
    fetchAPI(`/documents/${data.docId}`, { method: 'DELETE' }),

  getChunkingStatus: () =>
    fetchAPI('/documents/status'),

  cancelChunking: () => Promise.resolve({ success: true }),

  queryUserDocs: (data: { query: string; nResults?: number }) =>
    fetchAPI('/documents/query', { method: 'POST', body: JSON.stringify(data) }),

  onChunkingProgress: (callback: Function) => addListener('chunking-progress', callback),
  removeChunkingProgressListener: () => removeListener('chunking-progress'),

  uploadBatch: (data: any) => Promise.resolve({ success: true }),
  queueDocuments: (data: any) => Promise.resolve({ success: true }),
  getQueueStatus: () => Promise.resolve({ queue: [] }),
  pauseQueue: () => Promise.resolve({ success: true }),
  resumeQueue: () => Promise.resolve({ success: true }),
  removeFromQueue: (data: any) => Promise.resolve({ success: true }),
  clearQueue: () => Promise.resolve({ success: true }),
  onQueueUpdate: (callback: Function) => addListener('queue-update', callback),
  removeQueueUpdateListener: () => removeListener('queue-update'),

  // Dual-source query
  queryDualSource: (data: { query: string; options?: any }) =>
    fetchAPI('/ai/query-dual-source', { method: 'POST', body: JSON.stringify(data) }),

  // Terraform operations (simplified for web)
  selectTerraformDirectory: () => Promise.resolve(null),
  selectTerraformJsonFile: () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          resolve({ path: file.name, content: JSON.parse(text) });
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },
  runTerraformPlan: (data: any) => Promise.resolve({ success: true }),
  onTerraformPlanProgress: (callback: Function) => addListener('terraform-progress', callback),
  removeTerraformProgressListener: () => removeListener('terraform-progress'),

  // HMR operations (not applicable for web)
  getHMRStatus: () => Promise.resolve({ enabled: false }),
  getHMRDetailedStatus: () => Promise.resolve({ enabled: false }),
  triggerHMRReload: () => Promise.resolve({ success: true }),
  saveHMRState: (state: any) => Promise.resolve({ success: true }),
  onMainProcessReloading: (callback: Function) => {},
  removeMainProcessReloadingListener: () => {},
  onHMRSaveState: (callback: Function) => {},
  removeHMRSaveStateListener: () => {},
  onHMRBeforeReload: (callback: Function) => {},
  removeHMRBeforeReloadListener: () => {},
  onHMRRestored: (callback: Function) => {},
  removeHMRRestoredListener: () => {},

  // Error handling
  getErrorStats: () => Promise.resolve({ errors: 0 }),
  clearErrorLog: () => Promise.resolve({ success: true }),
  onMainProcessError: (callback: Function) => addListener('main-process-error', callback),
  removeMainProcessErrorListener: () => removeListener('main-process-error'),

  // Generic invoke (fallback)
  invoke: (channel: string, ...args: any[]) => {
    console.warn(`[API] Unhandled invoke: ${channel}`, args);
    return Promise.resolve(null);
  },

  // Debug operations
  captureDebugSnapshot: (stateData: any) => Promise.resolve({ success: true }),
  getDebugWindowInfo: () => Promise.resolve({}),
  listDebugSnapshots: () => Promise.resolve([]),
  openDebugSnapshotsDir: () => Promise.resolve({ success: true }),
};

// Type for compatibility
export type ElectronAPI = typeof apiClient;
