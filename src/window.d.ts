/**
 * Window Type Definitions
 * Extends the Window interface with Electron API types
 */

export interface DeviceQueryFilters {
  deviceType?: string;
  manufacturer?: string;
  location?: string;
  status?: string;
  missionCritical?: boolean;
  encryptionAtRest?: boolean;
}

export interface ModelInfo {
  filename: string;
  path: string;
  sizeGB: number;
  type: 'llm' | 'embedding' | 'unknown';
  capabilities: {
    canDoLLM: boolean;
    canDoEmbeddings: boolean;
  };
}

export interface DeviceRecord {
  id: string;
  project_id: number;
  name: string;
  device_type: string;
  device_subtype?: string | null;
  icon_path?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  subnet_mask?: string | null;
  default_gateway?: string | null;
  hostname?: string | null;
  dns_servers?: string | null;
  vlan_id?: string | null;
  ports?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  firmware_version?: string | null;
  operating_system?: string | null;
  os_version?: string | null;
  software?: string | null;
  cpu_model?: string | null;
  memory_size?: string | null;
  storage_size?: string | null;
  security_zone?: string | null;
  asset_value?: string | null;
  mission_critical: boolean;
  data_classification?: string | null;
  multifactor_auth: boolean;
  encryption_at_rest: boolean;
  encryption_in_transit: boolean;
  encryption_status?: string | null;
  backups_configured: boolean;
  monitoring_enabled: boolean;
  vulnerability_management?: string | null;
  risk_level?: string | null;
  criticality?: string | null;
  firewall_enabled: boolean;
  antivirus_enabled: boolean;
  patch_level?: string | null;
  last_patch_date?: string | null;
  applicable_controls?: string[] | null;
  last_vuln_scan?: string | null;
  compliance_status?: string | null;
  assigned_controls?: string[] | null;
  system_owner?: string | null;
  owner?: string | null;
  department?: string | null;
  contact_email?: string | null;
  location?: string | null;
  cost_center?: string | null;
  purchase_date?: string | null;
  warranty_expiration?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  status?: string | null;
  control_notes?: Record<string, string> | null;
  label?: string | null;
  label_fields?: string[] | null;
  device_image_size?: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * License file structure from web portal
 */
export interface LicenseFile {
  license_code: string;
  user_id: string;
  email: string;
  expires_at: number; // Unix timestamp in seconds
  subscription_status: string;
  subscription_plan?: string;
  subscription_id?: string;
  created_at?: number;
}

/**
 * User document structure for chunking service
 */
export interface UserDocument {
  id: string;
  filename: string;
  originalPath: string;
  uploadedAt: string;
  processedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileType: string;
  sizeBytes: number;
  chunkCount?: number;
  error?: string;
}

/**
 * Delta save data for efficient diagram updates
 */
export interface DiagramDeltaData {
  projectId: number;
  nodeChanges: Array<{
    type: 'add' | 'update' | 'remove';
    nodeId: string;
    node?: any;
  }>;
  edgeChanges: Array<{
    type: 'add' | 'update' | 'remove';
    edgeId: string;
    edge?: any;
  }>;
  sequence: number;
}

/**
 * Result from delta save operation
 */
export interface DeltaSaveResponse {
  success: boolean;
  isDelta?: boolean;
  requiresFullSave?: boolean;
  appliedChanges?: {
    nodes: number;
    edges: number;
  };
  serverSequence?: number;
  error?: string;
}

export interface ElectronAPI {
  // Database operations
  createProject: (data: { name: string; baseline: string }) => Promise<any>;
  listProjects: () => Promise<any[]>;
  saveDiagram: (data: any) => Promise<any>;
  saveDiagramDelta: (data: DiagramDeltaData) => Promise<DeltaSaveResponse>;
  loadDiagram: (projectId: number) => Promise<any>;
  deleteProject: (projectId: number) => Promise<any>;
  loadControlNarratives: (projectId: number) => Promise<any[]>;
  saveControlNarratives: (data: any) => Promise<any>;
  resetControlNarrative: (data: any) => Promise<any>;
  saveSingleControlNarrative: (data: any) => Promise<any>;
  updateProjectBaseline: (data: any) => Promise<any>;
  getSSPMetadata: (projectId: number) => Promise<any>;
  saveSSPMetadata: (data: any) => Promise<any>;

  // Device query operations
  queryDevices: (data: {
    projectId: number;
    filters?: {
      deviceType?: string;
      manufacturer?: string;
      location?: string;
      status?: string;
      missionCritical?: boolean;
      encryptionAtRest?: boolean;
    };
  }) => Promise<DeviceRecord[]>;
  getDevice: (data: { projectId: number; deviceId: string }) => Promise<DeviceRecord | null>;
  searchDevices: (data: { projectId: number; searchTerm: string }) => Promise<DeviceRecord[]>;

  // Export/Import operations
  exportJSON: (data: any) => Promise<any>;
  importJSON: () => Promise<any>;
  captureViewport: (bounds: any) => Promise<any>;
  exportPNG: (data: any) => Promise<any>;
  exportSVG: (data: { projectName: string; svgContent?: string; imageData?: string }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  exportPNGFromSVG: (data: { projectName: string; svgContent: string; width?: number; height?: number }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  exportCSV: (data: { csvContent: string; filename?: string }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  exportPDF: (data: { pdfBuffer: Buffer | ArrayBuffer; filename?: string }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;

  // Menu events
  onMenuNewProject: (callback: () => void) => void;
  onMenuOpenProject: (callback: () => void) => void;
  onMenuSave: (callback: () => void) => void;
  onMenuUndo: (callback: () => void) => void;
  onMenuRedo: (callback: () => void) => void;
  onMenuExportSVG: (callback: () => void) => void;
  onMenuExportJSON: (callback: () => void) => void;
  onMenuExportPNG: (callback: () => void) => void;
  onMenuImportJSON: (callback: () => void) => void;
  onMenuViewTopology: (callback: () => void) => void;
  onMenuViewInventory: (callback: () => void) => void;
  onMenuViewSSP: (callback: () => void) => void;
  onMenuViewNarratives: (callback: () => void) => void;
  onMenuViewAI: (callback: () => void) => void;
  onMenuTopologyAddDevice: (callback: () => void) => void;
  onMenuTopologyAddBoundary: (callback: () => void) => void;
  onMenuTopologyShowPalette: (callback: () => void) => void;
  onMenuTopologyShowAlignment: (callback: () => void) => void;
  onMenuInventoryAddDevice: (callback: () => void) => void;
  onMenuInventoryImport: (callback: () => void) => void;
  onMenuInventoryExport: (callback: () => void) => void;
  onMenuInventorySearch: (callback: () => void) => void;
  onMenuSSPGeneratePDF: (callback: () => void) => void;
  onMenuSSPPreview: (callback: () => void) => void;
  onMenuSSPSettings: (callback: () => void) => void;
  onMenuNarrativesNew: (callback: () => void) => void;
  onMenuNarrativesExport: (callback: () => void) => void;
  onMenuNarrativesImport: (callback: () => void) => void;
  onMenuNarrativesReset: (callback: () => void) => void;
  onMenuAIClearChat: (callback: () => void) => void;
  onMenuAIExportChat: (callback: () => void) => void;
  onMenuAISettings: (callback: () => void) => void;
  onMenuProjects: (callback: () => void) => void;
  onMenuAIStatus: (callback: () => void) => void;
  onMenuEnterLicense: (callback: () => void) => void;
  onMenuLicenseStatus: (callback: () => void) => void;
  onMenuLicenseInfo: (callback: () => void) => void;

  // AI service operations
  llmGenerate: (data: { prompt: string; temperature?: number; maxTokens?: number }) => Promise<any>;
  llmGenerateStream: (data: { prompt: string; temperature?: number; maxTokens?: number }) => Promise<any>;
  onStreamToken: (callback: (token: string) => void) => void;
  embed: (data: { text: string | string[] }) => Promise<any>;
  chromaDbQuery: (data: { collection: string; queryEmbedding: number[]; topK?: number; filters?: any }) => Promise<any>;
  chromaDbAdd: (data: { collection: string; documents: string[]; embeddings: number[][]; metadatas: any[]; ids: string[] }) => Promise<any>;
  checkAIHealth: () => Promise<{ llm: boolean; embedding: boolean; chroma: boolean; contextSize?: number }>;
  getContextSize: () => Promise<number>;

  // AI preload operations
  getAIPreloadStatus: () => Promise<{ isPreloading: boolean }>;
  onAIPreloadProgress: (callback: (data: { stage: string; progress: number; message: string }) => void) => void;
  removeAIPreloadProgressListener: () => void;

  // AI model management operations
  scanModels: () => Promise<{ success: boolean; data?: ModelInfo[]; error?: string }>;
  getAvailableModels: () => Promise<{ success: boolean; data?: ModelInfo[]; error?: string }>;
  setModelPreferences: (data: { llmModelPath: string; embeddingModelPath: string }) => Promise<{ success: boolean; error?: string }>;
  getModelPreferences: () => Promise<{ success: boolean; data?: { llmModelPath?: string; embeddingModelPath?: string; customModelsPath?: string } | null; error?: string }>;

  // Custom models path operations
  setCustomModelsPath: (path: string) => Promise<{ success: boolean; error?: string }>;
  getCustomModelsPath: () => Promise<{ success: boolean; path: string | null; isValid?: boolean; error?: string }>;
  clearCustomModelsPath: () => Promise<{ success: boolean; error?: string }>;
  getCurrentModelsDirectory: () => Promise<{ success: boolean; directory?: string; error?: string }>;
  browseModelsFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;

  // Model download operations
  checkModelStatus: () => Promise<{
    success: boolean;
    data?: {
      modelsDirectory: string;
      directoryExists: boolean;
      models: Record<string, {
        exists: boolean;
        path: string;
        size: number;
        sizeHuman: string;
        type: 'llm' | 'embedding';
        valid: boolean;
      }>;
      allModelsPresent: boolean;
      missingModels: string[];
    };
    error?: string;
  }>;
  getModelsDirectory: () => Promise<{ success: boolean; data?: { directory: string }; error?: string }>;
  getModelDownloadUrl: () => Promise<{ success: boolean; data?: { url: string }; error?: string }>;
  startModelDownload: (data?: { url?: string }) => Promise<{ success: boolean; modelsDirectory?: string; error?: string }>;
  pauseModelDownload: () => Promise<{ success: boolean; error?: string }>;
  resumeModelDownload: (data?: { url?: string }) => Promise<{ success: boolean; modelsDirectory?: string; error?: string }>;
  cancelModelDownload: () => Promise<{ success: boolean; error?: string }>;
  isModelDownloading: () => Promise<{ success: boolean; data?: { inProgress: boolean }; error?: string }>;
  getPartialDownloadInfo: () => Promise<{
    success: boolean;
    data?: {
      exists: boolean;
      path: string;
      size: number;
      sizeHuman: string;
    } | null;
    error?: string;
  }>;
  onModelDownloadProgress: (callback: (data: {
    stage: string;
    progress: number;
    message: string;
    bytesDownloaded?: number;
    totalBytes?: number;
    speed?: number;
    speedHuman?: string;
    eta?: number;
    etaHuman?: string;
    error?: string;
  }) => void) => void;
  removeModelDownloadProgressListener: () => void;

  // File operations
  getDownloadsPath: () => Promise<string>;
  saveFile: (data: { path: string; data: any }) => Promise<any>;

  // SSP PDF generation
  generateSSPPDF: (data: { html: string; options?: any }) => Promise<{
    success: boolean;
    pdfBuffer?: Buffer;
    error?: string;
  }>;

  // License file operations
  openLicenseFile: () => Promise<{ success: boolean; content?: string; filePath?: string; canceled?: boolean; error?: string }>;
  saveLicense: (data: { license: LicenseFile }) => Promise<{ success: boolean; error?: string }>;
  getLicense: () => Promise<{ success: boolean; license?: LicenseFile | null; error?: string }>;
  clearLicense: () => Promise<{ success: boolean; error?: string }>;

  // Device types operations
  getDeviceTypes: () => Promise<any[]>;
  getDeviceTypeByIcon: (iconPath: string) => Promise<any>;
  migrateDeviceTypes: () => Promise<{ success: boolean; count?: number; error?: string }>;
  findDeviceTypeMatch: (matchRequest: {
    deviceType?: string;
    deviceSubtype?: string;
    category?: string;
    resourceType?: string;
    provider?: string;
    iconPath?: string;
  }) => Promise<{
    matched: boolean;
    deviceType: string;
    deviceSubtype?: string;
    iconPath: string;
    displayName: string;
    matchScore: number;
    matchReason: string;
  }>;
  batchFindDeviceTypeMatch: (matchRequests: Array<{
    deviceType?: string;
    deviceSubtype?: string;
    category?: string;
    resourceType?: string;
    provider?: string;
    iconPath?: string;
  }>) => Promise<Array<{
    matched: boolean;
    deviceType: string;
    deviceSubtype?: string;
    iconPath: string;
    displayName: string;
    matchScore: number;
    matchReason: string;
  }>>;

  // Document chunking operations
  uploadDocument: (data: { userId: string; filePath: string }) => Promise<{
    success: boolean;
    documentId?: string;
    filename?: string;
    filePath?: string;
    error?: string;
  }>;
  processDocument: (data: { userId: string; documentId: string; filePath: string }) => Promise<{
    success: boolean;
    chunkCount?: number;
    error?: string;
  }>;
  getDocuments: (data: { userId: string }) => Promise<{
    success: boolean;
    documents?: UserDocument[];
    error?: string;
  }>;
  deleteDocument: (data: { userId: string; documentId: string }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  getChunkingStatus: () => Promise<{
    currentlyProcessing: string | null;
    queueLength: number;
  }>;
  cancelChunking: () => Promise<{ success: boolean }>;
  queryUserDocs: (data: { userId: string; queryEmbedding: number[]; topK?: number }) => Promise<{
    success: boolean;
    results?: any[];
    error?: string;
  }>;

  // Chunking progress events
  onChunkingProgress: (callback: (data: {
    documentId?: string;
    status: string;
    progress: number;
    message: string;
  }) => void) => void;
  removeChunkingProgressListener: () => void;

  // Batch upload operations
  uploadBatch: (data: { userId: string; filePaths: string[] }) => Promise<{
    success: boolean;
    results?: Array<{
      success: boolean;
      documentId?: string;
      filename?: string;
      filePath?: string;
      error?: string;
    }>;
    error?: string;
  }>;

  // Queue operations
  queueDocuments: (data: {
    userId: string;
    documents: Array<{
      documentId: string;
      filePath: string;
      priority?: 'high' | 'normal' | 'low';
    }>;
  }) => Promise<{
    success: boolean;
    queueIds?: string[];
    queueLength?: number;
    error?: string;
  }>;
  getQueueStatus: () => Promise<{
    queueLength: number;
    isProcessing: boolean;
    isPaused: boolean;
    currentItem: {
      documentId: string;
      startedAt: number;
    } | null;
    queue: Array<{
      documentId: string;
      priority: string;
      status: string;
      addedAt: number;
    }>;
  }>;
  pauseQueue: () => Promise<{ success: boolean }>;
  resumeQueue: () => Promise<{ success: boolean }>;
  removeFromQueue: (data: { documentId: string }) => Promise<{ success: boolean }>;
  clearQueue: () => Promise<{ success: boolean }>;
  onQueueUpdate: (callback: (data: {
    type: 'started' | 'completed' | 'failed' | 'queue-empty';
    documentId?: string;
    queueLength?: number;
    error?: string;
    duration?: number;
  }) => void) => void;
  removeQueueUpdateListener: () => void;

  // Dual-source query (user docs + shared compliance)
  queryDualSource: (data: {
    userId: string;
    queryEmbedding: number[];
    topK?: number;
    searchScope?: 'user' | 'shared' | 'both';
  }) => Promise<{
    success: boolean;
    results?: {
      user: any[];
      shared: any[];
      merged: any[];
    };
    error?: string;
  }>;

  // Terraform operations
  selectTerraformDirectory: () => Promise<{
    success: boolean;
    directory?: string;
    hasTerraformInit?: boolean;
    hasTerraformFiles?: boolean;
    canceled?: boolean;
    error?: string;
  }>;
  selectTerraformJsonFile: () => Promise<{
    success: boolean;
    content?: string;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }>;
  runTerraformPlan: (data: {
    directory: string;
    options?: {
      refresh?: boolean;
    };
  }) => Promise<{
    success: boolean;
    planJson?: string;
    planData?: any;
    stdout?: string;
    stderr?: string;
    error?: string;
  }>;
  onTerraformPlanProgress: (callback: (data: { type: string; data: string }) => void) => void;
  removeTerraformProgressListener: () => void;

  // Error handling operations
  getErrorStats: () => Promise<{
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: Array<{ timestamp: number; message: string; code: number }>;
  }>;
  clearErrorLog: () => Promise<{ success: boolean }>;
  onMainProcessError: (callback: (data: { message: string; severity: string }) => void) => void;
  removeMainProcessErrorListener: () => void;

  // HMR (Hot Module Replacement) operations
  getHMRStatus: () => Promise<{
    enabled: boolean;
    environment: string;
    devServerUrl: string | null;
  }>;
  getHMRDetailedStatus: () => Promise<{
    enabled: boolean;
    electronReloaderActive: boolean;
    watchDirs: string[];
    watchExtensions: string[];
    isRestarting: boolean;
  }>;
  triggerHMRReload: () => Promise<{ success: boolean; error?: string }>;
  saveHMRState: (state: Record<string, unknown>) => Promise<{ success: boolean }>;
  onMainProcessReloading: (callback: () => void) => void;
  removeMainProcessReloadingListener: () => void;
  onHMRSaveState: (callback: () => void) => void;
  removeHMRSaveStateListener: () => void;
  onHMRBeforeReload: (callback: (data: { changedFile: string; timestamp: number }) => void) => void;
  removeHMRBeforeReloadListener: () => void;
  onHMRRestored: (callback: (data: { changedFile: string; lastReload: number }) => void) => void;
  removeHMRRestoredListener: () => void;

  // Application control (for error recovery)
  restartApp?: () => void;

  // Generic invoke for extensibility (used by error dashboard)
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;

  // Debug operations
  captureDebugSnapshot: (stateData: any) => Promise<{
    success: boolean;
    snapshotDir?: string;
    screenshotPath?: string;
    statePath?: string;
    summaryPath?: string;
    timestamp?: string;
    error?: string;
  }>;
  getDebugWindowInfo: () => Promise<{
    success: boolean;
    windowInfo?: {
      bounds: { x: number; y: number; width: number; height: number };
      isVisible: boolean;
      isMinimized: boolean;
      isMaximized: boolean;
      isFocused: boolean;
      url: string;
      title: string;
      zoomLevel: number;
      zoomFactor: number;
    };
    error?: string;
  }>;
  listDebugSnapshots: () => Promise<{
    success: boolean;
    snapshots?: Array<{
      name: string;
      path: string;
      createdAt: string;
      summary: string | null;
    }>;
    debugDir?: string;
    error?: string;
  }>;
  openDebugSnapshotsDir: () => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    /**
     * Calibrated context size from AI service calibration
     * Set by Electron main process after model loading
     */
    calibratedContextSize?: number;
    // Note: The __FLOW_STORE__ global has been removed.
    // Cross-module store access is now handled by flowStoreAccessor.ts
    // which uses Zustand's built-in store composition pattern.
  }
}

export {};
