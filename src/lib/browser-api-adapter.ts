/**
 * Browser/Web API Adapter
 *
 * When running in browser (Docker/web deployment), use REST API client.
 * When running in Electron, use native electronAPI.
 * Falls back to mock for basic development without backend.
 */

import { apiClient } from './api-client';

// Check if we're in Electron
function isElectron(): boolean {
  return typeof window !== 'undefined' &&
         'electronAPI' in window &&
         (window as any).electronAPI !== undefined &&
         typeof (window as any).electronAPI.invoke === 'function';
}

// Check if backend API is available
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

// Initialize API - runs once on app load
async function initializeAPI() {
  if (isElectron()) {
    console.log('[API] Running in Electron mode');
    return; // Use native electronAPI
  }

  // Check if backend is available
  const backendAvailable = await isBackendAvailable();

  if (backendAvailable) {
    console.log('[API] Running in Web mode with backend API');
    (window as any).electronAPI = apiClient;
  } else {
    console.log('[API] Running in standalone browser mode (limited features)');
    (window as any).electronAPI = createMockAPI();
  }
}

// Mock API for standalone browser development (no backend)
function createMockAPI() {
  const MOCK_DEVICE_TYPES = [
    { icon_path: 'src/Icons/Azure/Compute/Virtual-Machine.svg', device_type: 'virtual-machine', display_name: 'Virtual Machine', it_category: 'Compute', network_layer: 'Application', device_subtype: null },
    { icon_path: 'src/Icons/Azure/Networking/Virtual-Network.svg', device_type: 'virtual-networks', display_name: 'Virtual Network', it_category: 'Networking', network_layer: 'Network', device_subtype: null },
    { icon_path: 'src/Icons/Azure/Storage/Storage-Account.svg', device_type: 'storage-accounts', display_name: 'Storage Account', it_category: 'Storage', network_layer: 'Application', device_subtype: null },
    { icon_path: 'src/Icons/Azure/Databases/Sql-Database.svg', device_type: 'sql-database', display_name: 'SQL Database', it_category: 'Databases', network_layer: 'Application', device_subtype: null },
    { icon_path: 'src/Icons/Azure/Security-Identity/Key-Vault.svg', device_type: 'key-vaults', display_name: 'Key Vault', it_category: 'Security', network_layer: 'Application', device_subtype: null },
    { icon_path: 'src/Icons/Infrastructure/Network-Devices/Router.svg', device_type: 'router', display_name: 'Router', it_category: 'Networking', network_layer: 'Network', device_subtype: null },
    { icon_path: 'src/Icons/Infrastructure/Security/Firewall.svg', device_type: 'firewall', display_name: 'Firewall', it_category: 'Security', network_layer: 'Network', device_subtype: null },
    { icon_path: 'src/Icons/Infrastructure/Servers-Compute/Server.svg', device_type: 'server', display_name: 'Server', it_category: 'Compute', network_layer: 'Application', device_subtype: null },
  ];

  let mockProjects: any[] = [];
  let mockDiagrams: Record<string, any> = {};
  let mockProjectId = 1;

  return {
    // Database
    createProject: async (data: any) => {
      const project = { id: `proj_${mockProjectId++}`, name: data.name, baseline: data.baseline || 'MODERATE', created_at: new Date().toISOString() };
      mockProjects.push(project);
      return project;
    },
    listProjects: async () => mockProjects,
    deleteProject: async (id: string) => { mockProjects = mockProjects.filter(p => p.id !== id); return { success: true }; },
    loadDiagram: async (projectId: string) => mockDiagrams[projectId] || { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    saveDiagram: async (data: any) => { mockDiagrams[data.projectId] = { nodes: data.nodes, edges: data.edges, viewport: data.viewport }; return { success: true }; },
    saveDiagramDelta: async (data: any) => { mockDiagrams[data.projectId] = { nodes: data.nodes, edges: data.edges, viewport: data.viewport }; return { success: true }; },
    updateProjectBaseline: async () => ({ success: true }),
    loadControlNarratives: async () => ({}),
    saveControlNarratives: async () => ({ success: true }),
    saveSingleControlNarrative: async () => ({ success: true }),
    resetControlNarrative: async () => ({ success: true }),
    getSSPMetadata: async () => ({}),
    saveSSPMetadata: async () => ({ success: true }),

    // Device types
    getDeviceTypes: async () => MOCK_DEVICE_TYPES,
    getDeviceTypeByIcon: async (iconPath: string) => MOCK_DEVICE_TYPES.find(dt => dt.icon_path === iconPath) || null,
    migrateDeviceTypes: async () => ({ success: true }),
    findDeviceTypeMatch: async (req: any) => {
      const match = MOCK_DEVICE_TYPES.find(dt => dt.icon_path === req.iconPath || dt.device_type === req.deviceType);
      return match ? { matched: true, ...match } : { matched: false, deviceType: 'virtual-machine', iconPath: MOCK_DEVICE_TYPES[0].icon_path };
    },
    batchFindDeviceTypeMatch: async (reqs: any[]) => reqs.map(() => ({ matched: true, ...MOCK_DEVICE_TYPES[0] })),

    // Export (browser-based downloads)
    exportJSON: async (data: any) => {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'export.json';
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    },
    importJSON: async () => {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) resolve(JSON.parse(await file.text()));
          else resolve(null);
        };
        input.click();
      });
    },
    exportSVG: async (data: any) => {
      const blob = new Blob([data.svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'export.svg';
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    },
    exportCSV: async (data: any) => {
      const blob = new Blob([data.content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'export.csv';
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    },
    exportPNG: async () => ({ success: false, error: 'Not available in browser mode' }),
    exportPNGFromSVG: async () => ({ success: false, error: 'Not available in browser mode' }),
    exportPDF: async () => ({ success: false, error: 'Not available in browser mode' }),
    captureViewport: async () => null,
    saveFile: async () => ({ success: false }),
    getDownloadsPath: async () => '/downloads',
    generateSSPPDF: async () => ({ success: false }),

    // AI (disabled in mock mode)
    llmGenerate: async () => ({ error: 'AI not available in browser mode' }),
    llmGenerateStream: async () => ({ error: 'AI not available in browser mode' }),
    embed: async () => ({ error: 'AI not available in browser mode' }),
    chromaDbQuery: async () => ({ error: 'AI not available in browser mode' }),
    chromaDbAdd: async () => ({ error: 'AI not available in browser mode' }),
    checkAIHealth: async () => ({ llm: false, embedding: false, chromadb: false }),
    getContextSize: async () => ({ contextSize: 0 }),
    getAIPreloadStatus: async () => ({ status: 'unavailable' }),
    queryDualSource: async () => ({ error: 'AI not available in browser mode' }),
    scanModels: async () => ({ models: [] }),
    getAvailableModels: async () => ({}),
    setModelPreferences: async () => ({ success: true }),
    getModelPreferences: async () => ({}),

    // Documents (disabled in mock mode)
    uploadDocument: async () => ({ error: 'Not available' }),
    processDocument: async () => ({ error: 'Not available' }),
    getDocuments: async () => ([]),
    deleteDocument: async () => ({ success: false }),
    getChunkingStatus: async () => ({}),
    cancelChunking: async () => ({ success: true }),
    queryUserDocs: async () => ({ results: [] }),

    // License (use localStorage in browser)
    openLicenseFile: async () => null,
    saveLicense: async (data: any) => { localStorage.setItem('license', JSON.stringify(data)); return { success: true }; },
    getLicense: async () => { const l = localStorage.getItem('license'); return l ? JSON.parse(l) : null; },
    clearLicense: async () => { localStorage.removeItem('license'); return { success: true }; },

    // Terraform
    selectTerraformDirectory: async () => null,
    selectTerraformJsonFile: async () => null,
    runTerraformPlan: async () => ({ success: false }),

    // All event listeners (no-op)
    onMenuNewProject: () => {},
    onMenuOpenProject: () => {},
    onMenuSave: () => {},
    onMenuUndo: () => {},
    onMenuRedo: () => {},
    onMenuExportSVG: () => {},
    onMenuExportJSON: () => {},
    onMenuExportPNG: () => {},
    onMenuImportJSON: () => {},
    onMenuViewTopology: () => {},
    onMenuViewInventory: () => {},
    onMenuViewSSP: () => {},
    onMenuViewNarratives: () => {},
    onMenuViewAI: () => {},
    onMenuTopologyAddDevice: () => {},
    onMenuTopologyAddBoundary: () => {},
    onMenuTopologyShowPalette: () => {},
    onMenuTopologyShowAlignment: () => {},
    onMenuInventoryAddDevice: () => {},
    onMenuInventoryImport: () => {},
    onMenuInventoryExport: () => {},
    onMenuInventorySearch: () => {},
    onMenuSSPGeneratePDF: () => {},
    onMenuSSPPreview: () => {},
    onMenuSSPSettings: () => {},
    onMenuNarrativesNew: () => {},
    onMenuNarrativesExport: () => {},
    onMenuNarrativesImport: () => {},
    onMenuNarrativesReset: () => {},
    onMenuAIClearChat: () => {},
    onMenuAIExportChat: () => {},
    onMenuAISettings: () => {},
    onMenuProjects: () => {},
    onMenuAIStatus: () => {},
    onMenuEnterLicense: () => {},
    onMenuLicenseStatus: () => {},
    onMenuLicenseInfo: () => {},
    onStreamToken: () => {},
    onAIPreloadProgress: () => {},
    removeAIPreloadProgressListener: () => {},
    onModelDownloadProgress: () => {},
    removeModelDownloadProgressListener: () => {},
    onChunkingProgress: () => {},
    removeChunkingProgressListener: () => {},
    onQueueUpdate: () => {},
    removeQueueUpdateListener: () => {},
    onTerraformPlanProgress: () => {},
    removeTerraformProgressListener: () => {},
    onMainProcessReloading: () => {},
    removeMainProcessReloadingListener: () => {},
    onHMRSaveState: () => {},
    removeHMRSaveStateListener: () => {},
    onHMRBeforeReload: () => {},
    removeHMRBeforeReloadListener: () => {},
    onHMRRestored: () => {},
    removeHMRRestoredListener: () => {},
    onMainProcessError: () => {},
    removeMainProcessErrorListener: () => {},

    // Misc
    queryDevices: async () => ([]),
    getDevice: async () => null,
    searchDevices: async () => ([]),
    checkModelStatus: async () => ({ available: false }),
    getModelsDirectory: async () => '',
    getModelDownloadUrl: async () => '',
    startModelDownload: async () => ({ success: false }),
    pauseModelDownload: async () => ({ success: false }),
    resumeModelDownload: async () => ({ success: false }),
    cancelModelDownload: async () => ({ success: false }),
    isModelDownloading: async () => false,
    getPartialDownloadInfo: async () => null,
    uploadBatch: async () => ({ success: false }),
    queueDocuments: async () => ({ success: false }),
    getQueueStatus: async () => ({ queue: [] }),
    pauseQueue: async () => ({ success: false }),
    resumeQueue: async () => ({ success: false }),
    removeFromQueue: async () => ({ success: false }),
    clearQueue: async () => ({ success: false }),
    getHMRStatus: async () => ({ enabled: false }),
    getHMRDetailedStatus: async () => ({ enabled: false }),
    triggerHMRReload: async () => ({ success: false }),
    saveHMRState: async () => ({ success: false }),
    getErrorStats: async () => ({ errors: 0 }),
    clearErrorLog: async () => ({ success: true }),
    invoke: async () => null,
    captureDebugSnapshot: async () => ({ success: false }),
    getDebugWindowInfo: async () => ({}),
    listDebugSnapshots: async () => ([]),
    openDebugSnapshotsDir: async () => ({ success: false }),
  };
}

// Auto-initialize when module loads
if (typeof window !== 'undefined' && !isElectron()) {
  initializeAPI();
}

export { initializeAPI, isElectron };
