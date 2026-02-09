import { contextBridge, ipcRenderer } from 'electron';// Expose electron-trpc IPC handler for type-safe RPC
// This enables the renderer to use tRPC for type-safe communication with main process
// Use dynamic import to avoid import-time errors if electron-trpc has issues
(async () => {
  try {
    const { exposeElectronTRPC } = await import('electron-trpc/main');
    exposeElectronTRPC();
    console.log('[PRELOAD] electron-trpc exposed successfully');
  } catch (e) {
    console.warn('[PRELOAD] electron-trpc exposure failed, falling back to legacy IPC:', e);
  }
})();

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  createProject: (data) => ipcRenderer.invoke('db:create-project', data),
  listProjects: () => ipcRenderer.invoke('db:list-projects'),
  saveDiagram: (data) => ipcRenderer.invoke('db:save-diagram', data),
  saveDiagramDelta: (data) => ipcRenderer.invoke('db:save-diagram-delta', data),
  loadDiagram: (projectId) => ipcRenderer.invoke('db:load-diagram', projectId),
  deleteProject: (projectId) => ipcRenderer.invoke('db:delete-project', projectId),
  loadControlNarratives: (projectId) => ipcRenderer.invoke('db:load-control-narratives', projectId),
  saveControlNarratives: (data) => ipcRenderer.invoke('db:save-control-narratives', data),
  resetControlNarrative: (data) => ipcRenderer.invoke('db:reset-control-narrative', data),
  saveSingleControlNarrative: (data) => ipcRenderer.invoke('db:save-single-control-narrative', data),
  updateProjectBaseline: (data) => ipcRenderer.invoke('db:update-project-baseline', data),
  getSSPMetadata: (projectId) => ipcRenderer.invoke('db:get-ssp-metadata', projectId),
  saveSSPMetadata: (data) => ipcRenderer.invoke('db:save-ssp-metadata', data),
  
  // Device query operations
  queryDevices: (data) => ipcRenderer.invoke('db:query-devices', data),
  getDevice: (data) => ipcRenderer.invoke('db:get-device', data),
  searchDevices: (data) => ipcRenderer.invoke('db:search-devices', data),
  
  // Export/Import operations
  exportJSON: (data) => ipcRenderer.invoke('export-json', data),
  importJSON: () => ipcRenderer.invoke('import-json'),
  captureViewport: (bounds) => ipcRenderer.invoke('capture-viewport', bounds),
  exportPNG: (data) => ipcRenderer.invoke('export-png', data),
  exportSVG: (data) => ipcRenderer.invoke('export-svg', data),
  exportPNGFromSVG: (data) => ipcRenderer.invoke('export-png-from-svg', data),
  exportCSV: (data) => ipcRenderer.invoke('export-csv', data),
  exportPDF: (data) => ipcRenderer.invoke('export-pdf', data),
  
  // Menu events
  onMenuNewProject: (callback) => ipcRenderer.on('menu-new-project', callback),
  onMenuOpenProject: (callback) => ipcRenderer.on('menu-open-project', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', callback),
  onMenuUndo: (callback) => ipcRenderer.on('menu-undo', callback),
  onMenuRedo: (callback) => ipcRenderer.on('menu-redo', callback),
  onMenuExportSVG: (callback) => ipcRenderer.on('menu-export-svg', callback),
  onMenuExportJSON: (callback) => ipcRenderer.on('menu-export-json', callback),
  onMenuExportPNG: (callback) => ipcRenderer.on('menu-export-png', callback),
  onMenuImportJSON: (callback) => ipcRenderer.on('menu-import-json', callback),
  onMenuViewTopology: (callback) => ipcRenderer.on('menu-view-topology', callback),
  onMenuViewInventory: (callback) => ipcRenderer.on('menu-view-inventory', callback),
  onMenuViewSSP: (callback) => ipcRenderer.on('menu-view-ssp', callback),
  onMenuViewNarratives: (callback) => ipcRenderer.on('menu-view-narratives', callback),
  onMenuViewAI: (callback) => ipcRenderer.on('menu-view-ai', callback),
  onMenuTopologyAddDevice: (callback) => ipcRenderer.on('menu-topology-add-device', callback),
  onMenuTopologyAddBoundary: (callback) => ipcRenderer.on('menu-topology-add-boundary', callback),
  onMenuTopologyShowPalette: (callback) => ipcRenderer.on('menu-topology-show-palette', callback),
  onMenuTopologyShowAlignment: (callback) => ipcRenderer.on('menu-topology-show-alignment', callback),
  onMenuInventoryAddDevice: (callback) => ipcRenderer.on('menu-inventory-add-device', callback),
  onMenuInventoryImport: (callback) => ipcRenderer.on('menu-inventory-import', callback),
  onMenuInventoryExport: (callback) => ipcRenderer.on('menu-inventory-export', callback),
  onMenuInventorySearch: (callback) => ipcRenderer.on('menu-inventory-search', callback),
  onMenuSSPGeneratePDF: (callback) => ipcRenderer.on('menu-ssp-generate-pdf', callback),
  onMenuSSPPreview: (callback) => ipcRenderer.on('menu-ssp-preview', callback),
  onMenuSSPSettings: (callback) => ipcRenderer.on('menu-ssp-settings', callback),
  onMenuNarrativesNew: (callback) => ipcRenderer.on('menu-narratives-new', callback),
  onMenuNarrativesExport: (callback) => ipcRenderer.on('menu-narratives-export', callback),
  onMenuNarrativesImport: (callback) => ipcRenderer.on('menu-narratives-import', callback),
  onMenuNarrativesReset: (callback) => ipcRenderer.on('menu-narratives-reset', callback),
  onMenuAIClearChat: (callback) => ipcRenderer.on('menu-ai-clear-chat', callback),
  onMenuAIExportChat: (callback) => ipcRenderer.on('menu-ai-export-chat', callback),
  onMenuAISettings: (callback) => ipcRenderer.on('menu-ai-settings', callback),
  onMenuProjects: (callback) => ipcRenderer.on('menu-projects', callback),
  onMenuAIStatus: (callback) => ipcRenderer.on('menu-ai-status', callback),
  onMenuEnterLicense: (callback) => ipcRenderer.on('menu-enter-license', callback),
  onMenuLicenseStatus: (callback) => ipcRenderer.on('menu-license-status', callback),
  onMenuLicenseInfo: (callback) => ipcRenderer.on('menu-license-info', callback),
  
  // AI service operations
  llmGenerate: (data) => ipcRenderer.invoke('ai:llm-generate', data),
  llmGenerateStream: (data) => ipcRenderer.invoke('ai:llm-generate-stream', data),
  onStreamToken: (callback) => ipcRenderer.on('ai:stream-token', (event, token) => callback(token)),
  embed: (data) => ipcRenderer.invoke('ai:embed', data),
  chromaDbQuery: (data) => ipcRenderer.invoke('ai:chromadb-query', data),
  chromaDbAdd: (data) => ipcRenderer.invoke('ai:chromadb-add', data),
  checkAIHealth: () => ipcRenderer.invoke('ai:check-health'),
  getContextSize: () => ipcRenderer.invoke('ai:get-context-size'),

  // AI preload operations
  getAIPreloadStatus: () => ipcRenderer.invoke('ai:get-preload-status'),
  onAIPreloadProgress: (callback) => ipcRenderer.on('ai:preload-progress', (event, data) => callback(data)),
  removeAIPreloadProgressListener: () => ipcRenderer.removeAllListeners('ai:preload-progress'),

  // AI model management operations
  scanModels: () => ipcRenderer.invoke('ai:scan-models'),
  getAvailableModels: () => ipcRenderer.invoke('ai:get-available-models'),
  setModelPreferences: (data) => ipcRenderer.invoke('ai:set-model-preferences', data),
  getModelPreferences: () => ipcRenderer.invoke('ai:get-model-preferences'),

  // Custom models path operations
  setCustomModelsPath: (path) => ipcRenderer.invoke('ai:set-custom-models-path', { path }),
  getCustomModelsPath: () => ipcRenderer.invoke('ai:get-custom-models-path'),
  clearCustomModelsPath: () => ipcRenderer.invoke('ai:clear-custom-models-path'),
  getCurrentModelsDirectory: () => ipcRenderer.invoke('ai:get-current-models-directory'),
  browseModelsFolder: () => ipcRenderer.invoke('ai:browse-models-folder'),

  // Model download operations
  checkModelStatus: () => ipcRenderer.invoke('models:check-status'),
  getModelsDirectory: () => ipcRenderer.invoke('models:get-directory'),
  getModelDownloadUrl: () => ipcRenderer.invoke('models:get-download-url'),
  startModelDownload: (data) => ipcRenderer.invoke('models:start-download', data),
  pauseModelDownload: () => ipcRenderer.invoke('models:pause-download'),
  resumeModelDownload: (data) => ipcRenderer.invoke('models:resume-download', data),
  cancelModelDownload: () => ipcRenderer.invoke('models:cancel-download'),
  isModelDownloading: () => ipcRenderer.invoke('models:is-downloading'),
  getPartialDownloadInfo: () => ipcRenderer.invoke('models:get-partial-info'),
  onModelDownloadProgress: (callback) => ipcRenderer.on('models:download-progress', (event, data) => callback(data)),
  removeModelDownloadProgressListener: () => ipcRenderer.removeAllListeners('models:download-progress'),

  // File operations
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  
  // SSP PDF generation
  generateSSPPDF: (data) => ipcRenderer.invoke('generate-ssp-pdf', data),
  
  // License file operations
  openLicenseFile: () => ipcRenderer.invoke('license:open-file'),
  saveLicense: (data) => ipcRenderer.invoke('license:save', data),
  getLicense: () => ipcRenderer.invoke('license:get'),
  clearLicense: () => ipcRenderer.invoke('license:clear'),
  
  // Device types operations
  getDeviceTypes: () => ipcRenderer.invoke('device-types:get-all'),
  getDeviceTypeByIcon: (iconPath) => ipcRenderer.invoke('device-types:get-by-icon', iconPath),
  migrateDeviceTypes: () => ipcRenderer.invoke('device-types:migrate'),
  findDeviceTypeMatch: (matchRequest) => ipcRenderer.invoke('device-types:find-match', matchRequest),
  batchFindDeviceTypeMatch: (matchRequests) => ipcRenderer.invoke('device-types:batch-find-match', matchRequests),

  // Document chunking operations
  uploadDocument: (data) => ipcRenderer.invoke('chunking:upload-file', data),
  processDocument: (data) => ipcRenderer.invoke('chunking:process-document', data),
  getDocuments: (data) => ipcRenderer.invoke('chunking:get-documents', data),
  deleteDocument: (data) => ipcRenderer.invoke('chunking:delete-document', data),
  getChunkingStatus: () => ipcRenderer.invoke('chunking:get-status'),
  cancelChunking: () => ipcRenderer.invoke('chunking:cancel'),
  queryUserDocs: (data) => ipcRenderer.invoke('chunking:query-user-docs', data),

  // Chunking progress events
  onChunkingProgress: (callback) => ipcRenderer.on('chunking:progress', (event, data) => callback(data)),
  removeChunkingProgressListener: () => ipcRenderer.removeAllListeners('chunking:progress'),

  // Batch upload operations
  uploadBatch: (data) => ipcRenderer.invoke('chunking:upload-batch', data),

  // Queue operations
  queueDocuments: (data) => ipcRenderer.invoke('chunking:queue-documents', data),
  getQueueStatus: () => ipcRenderer.invoke('chunking:queue-status'),
  pauseQueue: () => ipcRenderer.invoke('chunking:queue-pause'),
  resumeQueue: () => ipcRenderer.invoke('chunking:queue-resume'),
  removeFromQueue: (data) => ipcRenderer.invoke('chunking:queue-remove', data),
  clearQueue: () => ipcRenderer.invoke('chunking:queue-clear'),
  onQueueUpdate: (callback) => ipcRenderer.on('chunking:queue-update', (event, data) => callback(data)),
  removeQueueUpdateListener: () => ipcRenderer.removeAllListeners('chunking:queue-update'),

  // Dual-source query (user docs + shared compliance)
  queryDualSource: (data) => ipcRenderer.invoke('ai:query-dual-source', data),
  
  // Terraform operations
  selectTerraformDirectory: () => ipcRenderer.invoke('terraform:select-directory'),
  selectTerraformJsonFile: () => ipcRenderer.invoke('terraform:select-json-file'),
  runTerraformPlan: (data) => ipcRenderer.invoke('terraform:run-plan', data),
  onTerraformPlanProgress: (callback) => ipcRenderer.on('terraform:plan-progress', (event, data) => callback(data)),
  removeTerraformProgressListener: () => ipcRenderer.removeAllListeners('terraform:plan-progress'),

  // HMR (Hot Module Replacement) operations
  getHMRStatus: () => ipcRenderer.invoke('hmr:status'),
  getHMRDetailedStatus: () => ipcRenderer.invoke('hmr:get-status'),
  triggerHMRReload: () => ipcRenderer.invoke('hmr:trigger-reload'),
  saveHMRState: (state) => ipcRenderer.invoke('hmr:state-saved', state),
  onMainProcessReloading: (callback) => ipcRenderer.on('main-process-reloading', callback),
  removeMainProcessReloadingListener: () => ipcRenderer.removeAllListeners('main-process-reloading'),
  onHMRSaveState: (callback) => ipcRenderer.on('hmr:save-state', callback),
  removeHMRSaveStateListener: () => ipcRenderer.removeAllListeners('hmr:save-state'),
  onHMRBeforeReload: (callback) => ipcRenderer.on('hmr:before-reload', (event, data) => callback(data)),
  removeHMRBeforeReloadListener: () => ipcRenderer.removeAllListeners('hmr:before-reload'),
  onHMRRestored: (callback) => ipcRenderer.on('hmr:restored', (event, data) => callback(data)),
  removeHMRRestoredListener: () => ipcRenderer.removeAllListeners('hmr:restored'),

  // Error handling operations
  getErrorStats: () => ipcRenderer.invoke('error:get-stats'),
  clearErrorLog: () => ipcRenderer.invoke('error:clear-log'),
  onMainProcessError: (callback) => ipcRenderer.on('main-process-error', (event, data) => callback(data)),
  removeMainProcessErrorListener: () => ipcRenderer.removeAllListeners('main-process-error'),

  // Generic invoke for extensibility (used by error dashboard and other dynamic handlers)
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Debug operations
  captureDebugSnapshot: (stateData) => ipcRenderer.invoke('debug:capture-snapshot', stateData),
  getDebugWindowInfo: () => ipcRenderer.invoke('debug:get-window-info'),
  listDebugSnapshots: () => ipcRenderer.invoke('debug:list-snapshots'),
  openDebugSnapshotsDir: () => ipcRenderer.invoke('debug:open-snapshots-dir'),
});} catch (error) {  console.error('[PRELOAD] Failed to expose electronAPI:', error);
}

