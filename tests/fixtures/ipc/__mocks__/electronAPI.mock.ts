/**
 * Mock Electron API for IPC Testing
 *
 * This module provides a comprehensive mock of the Electron IPC layer
 * for testing renderer-side code without running in Electron.
 */

import { vi, type Mock } from 'vitest';
import type {
  ElectronAPI,
  DeviceRecord,
  LicenseFile,
  DiagramDeltaData,
  DeltaSaveResponse,
  UserDocument
} from '@/window.d';

// Types for mock configuration
interface MockCallRecord {
  channel: string;
  args: unknown[];
  timestamp: number;
}

interface MockConfig {
  delay?: number;  // Simulated network delay in ms
  shouldFail?: boolean;
  failureMessage?: string;
  timeoutMs?: number;
}

// Mock state management
const mockState = {
  calls: [] as MockCallRecord[],
  projects: new Map<number, { id: number; name: string; baseline: string }>(),
  diagrams: new Map<number, { nodes: any[]; edges: any[]; viewport: any }>(),
  devices: new Map<string, DeviceRecord>(),
  narratives: new Map<string, any>(),
  license: null as LicenseFile | null,
  sspMetadata: new Map<number, any>(),
  aiHealth: { llm: true, embedding: true, chroma: true, contextSize: 4096 },
  documents: new Map<string, UserDocument>(),
};

// Reset function for between tests
export function resetMockState(): void {
  mockState.calls = [];
  mockState.projects.clear();
  mockState.diagrams.clear();
  mockState.devices.clear();
  mockState.narratives.clear();
  mockState.license = null;
  mockState.sspMetadata.clear();
  mockState.documents.clear();
  // Also clear event listeners between tests
  eventListeners.clear();
}

// Get call history for assertions
export function getMockCalls(): MockCallRecord[] {
  return [...mockState.calls];
}

// Get calls for a specific channel
export function getCallsForChannel(channel: string): MockCallRecord[] {
  return mockState.calls.filter(c => c.channel === channel);
}

// Record a call
function recordCall(channel: string, args: unknown[]): void {
  mockState.calls.push({
    channel,
    args,
    timestamp: Date.now()
  });
}

// Simulate async delay
async function simulateDelay(config?: MockConfig): Promise<void> {
  if (config?.delay) {
    await new Promise(resolve => setTimeout(resolve, config.delay));
  }
}

// Check for simulated failure
function checkFailure(config?: MockConfig): void {
  if (config?.shouldFail) {
    throw new Error(config.failureMessage || 'Simulated failure');
  }
}

// Default mock configuration
let globalMockConfig: MockConfig = {};

export function setMockConfig(config: MockConfig): void {
  globalMockConfig = config;
}

// Create a sample device record
export function createMockDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: `device-${Date.now()}`,
    project_id: 1,
    name: 'Test Device',
    device_type: 'server',
    device_subtype: null,
    icon_path: '/icons/server.svg',
    ip_address: '192.168.1.1',
    mac_address: '00:11:22:33:44:55',
    subnet_mask: '255.255.255.0',
    default_gateway: '192.168.1.1',
    hostname: 'test-server',
    dns_servers: '8.8.8.8',
    vlan_id: '100',
    ports: '22,80,443',
    manufacturer: 'Dell',
    model: 'PowerEdge R740',
    serial_number: 'SN123456',
    firmware_version: '2.0',
    operating_system: 'Ubuntu',
    os_version: '22.04',
    software: null,
    cpu_model: 'Intel Xeon',
    memory_size: '64GB',
    storage_size: '1TB',
    security_zone: 'DMZ',
    asset_value: 'high',
    mission_critical: true,
    data_classification: 'Confidential',
    multifactor_auth: true,
    encryption_at_rest: true,
    encryption_in_transit: true,
    encryption_status: 'AES-256',
    backups_configured: true,
    monitoring_enabled: true,
    vulnerability_management: 'Qualys',
    risk_level: 'low',
    criticality: 'high',
    firewall_enabled: true,
    antivirus_enabled: true,
    patch_level: 'current',
    last_patch_date: '2024-01-15',
    applicable_controls: ['AC-1', 'AC-2'],
    last_vuln_scan: '2024-01-14',
    compliance_status: 'compliant',
    assigned_controls: ['AC-1'],
    system_owner: 'IT Admin',
    owner: 'IT Admin',
    department: 'IT',
    contact_email: 'admin@example.com',
    location: 'Data Center 1',
    cost_center: 'CC001',
    purchase_date: '2023-01-01',
    warranty_expiration: '2026-01-01',
    notes: 'Test device',
    tags: ['production', 'critical'],
    status: 'active',
    control_notes: null,
    label: 'Test Server',
    label_fields: ['name', 'ip_address'],
    device_image_size: 64,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

// Create a sample license
export function createMockLicense(overrides: Partial<LicenseFile> = {}): LicenseFile {
  return {
    license_code: 'TEST-LICENSE-CODE-123',
    user_id: 'user-123',
    email: 'test@example.com',
    expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year from now
    subscription_status: 'active',
    subscription_plan: 'professional',
    subscription_id: 'sub-123',
    created_at: Math.floor(Date.now() / 1000),
    ...overrides
  };
}

// Event listeners storage
const eventListeners = new Map<string, Set<Function>>();

function addListener(event: string, callback: Function): void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);
}

function removeListener(event: string, callback?: Function): void {
  if (callback) {
    eventListeners.get(event)?.delete(callback);
  } else {
    eventListeners.delete(event);
  }
}

// Clear all event listeners
export function clearAllListeners(): void {
  eventListeners.clear();
}

export function emitMockEvent(event: string, data: unknown): void {
  const listeners = eventListeners.get(event);
  if (!listeners) return;

  const errors: Error[] = [];
  listeners.forEach(cb => {
    try {
      cb(data);
    } catch (e) {
      errors.push(e as Error);
    }
  });

  // If any errors occurred, throw the first one
  if (errors.length > 0) {
    throw errors[0];
  }
}

// Create the mock Electron API
export function createMockElectronAPI(): ElectronAPI {
  const api: ElectronAPI = {
    // ============== Database Operations ==============
    createProject: vi.fn(async (data: { name: string; baseline: string }) => {
      recordCall('db:create-project', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const id = mockState.projects.size + 1;
      const project = { id, name: data.name, baseline: data.baseline, created_at: new Date().toISOString() };
      mockState.projects.set(id, project);
      return project;
    }),

    listProjects: vi.fn(async () => {
      recordCall('db:list-projects', []);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return Array.from(mockState.projects.values());
    }),

    saveDiagram: vi.fn(async (data: any) => {
      recordCall('db:save-diagram', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.diagrams.set(data.projectId, {
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport
      });
      return { success: true };
    }),

    saveDiagramDelta: vi.fn(async (data: DiagramDeltaData): Promise<DeltaSaveResponse> => {
      recordCall('db:save-diagram-delta', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const existing = mockState.diagrams.get(data.projectId);
      if (!existing) {
        return { success: false, requiresFullSave: true, error: 'No existing diagram' };
      }

      // Apply delta changes
      const nodeMap = new Map(existing.nodes.map((n: any) => [n.id, n]));
      const edgeMap = new Map(existing.edges.map((e: any) => [e.id, e]));

      for (const change of data.nodeChanges || []) {
        if (change.type === 'add' || change.type === 'update') {
          nodeMap.set(change.nodeId, change.node);
        } else if (change.type === 'remove') {
          nodeMap.delete(change.nodeId);
        }
      }

      for (const change of data.edgeChanges || []) {
        if (change.type === 'add' || change.type === 'update') {
          edgeMap.set(change.edgeId, change.edge);
        } else if (change.type === 'remove') {
          edgeMap.delete(change.edgeId);
        }
      }

      mockState.diagrams.set(data.projectId, {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()),
        viewport: existing.viewport
      });

      return {
        success: true,
        isDelta: true,
        appliedChanges: {
          nodes: data.nodeChanges?.length || 0,
          edges: data.edgeChanges?.length || 0
        },
        serverSequence: data.sequence
      };
    }),

    loadDiagram: vi.fn(async (projectId: number) => {
      recordCall('db:load-diagram', [projectId]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const diagram = mockState.diagrams.get(projectId);
      return diagram || { nodes: [], edges: [], viewport: null };
    }),

    deleteProject: vi.fn(async (projectId: number) => {
      recordCall('db:delete-project', [projectId]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.projects.delete(projectId);
      mockState.diagrams.delete(projectId);
      return { success: true };
    }),

    loadControlNarratives: vi.fn(async (projectId: number) => {
      recordCall('db:load-control-narratives', [projectId]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return Array.from(mockState.narratives.entries())
        .filter(([key]) => key.startsWith(`${projectId}:`))
        .map(([key, value]) => ({
          control_id: key.split(':')[1],
          ...value
        }));
    }),

    saveControlNarratives: vi.fn(async (data: any) => {
      recordCall('db:save-control-narratives', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      for (const narrative of data.narratives) {
        mockState.narratives.set(`${data.projectId}:${narrative.control_id}`, narrative);
      }
      return { success: true };
    }),

    resetControlNarrative: vi.fn(async (data: any) => {
      recordCall('db:reset-control-narrative', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.narratives.delete(`${data.projectId}:${data.controlId}`);
      return { success: true };
    }),

    saveSingleControlNarrative: vi.fn(async (data: any) => {
      recordCall('db:save-single-control-narrative', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.narratives.set(`${data.projectId}:${data.controlId}`, {
        narrative: data.systemImplementation,
        system_implementation: data.systemImplementation,
        implementation_status: data.implementationStatus
      });
      return { success: true };
    }),

    updateProjectBaseline: vi.fn(async (data: any) => {
      recordCall('db:update-project-baseline', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const project = mockState.projects.get(data.projectId);
      if (project) {
        project.baseline = data.baseline;
      }
      return { success: true, baseline: data.baseline };
    }),

    getSSPMetadata: vi.fn(async (projectId: number) => {
      recordCall('db:get-ssp-metadata', [projectId]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return mockState.sspMetadata.get(projectId) || null;
    }),

    saveSSPMetadata: vi.fn(async (data: any) => {
      recordCall('db:save-ssp-metadata', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.sspMetadata.set(data.projectId, data.metadata);
      return { success: true };
    }),

    // Device query operations
    queryDevices: vi.fn(async (data: any) => {
      recordCall('db:query-devices', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return Array.from(mockState.devices.values())
        .filter(d => d.project_id === data.projectId);
    }),

    getDevice: vi.fn(async (data: any) => {
      recordCall('db:get-device', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return mockState.devices.get(`${data.projectId}:${data.deviceId}`) || null;
    }),

    searchDevices: vi.fn(async (data: any) => {
      recordCall('db:search-devices', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const term = data.searchTerm.toLowerCase();
      return Array.from(mockState.devices.values())
        .filter(d =>
          d.project_id === data.projectId &&
          (d.name.toLowerCase().includes(term) ||
           d.device_type.toLowerCase().includes(term))
        );
    }),

    // ============== Export/Import Operations ==============
    exportJSON: vi.fn(async (data: any) => {
      recordCall('export-json', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, filePath: '/mock/path/diagram.json' };
    }),

    importJSON: vi.fn(async () => {
      recordCall('import-json', []);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, data: { nodes: [], edges: [] } };
    }),

    captureViewport: vi.fn(async (bounds: any) => {
      recordCall('capture-viewport', [bounds]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return {
        success: true,
        imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        dimensions: { width: bounds.width, height: bounds.height }
      };
    }),

    exportPNG: vi.fn(async (data: any) => {
      recordCall('export-png', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, filePath: '/mock/path/diagram.png' };
    }),

    exportSVG: vi.fn(async (data: any) => {
      recordCall('export-svg', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, filePath: '/mock/path/diagram.svg' };
    }),

    exportPNGFromSVG: vi.fn(async (data: any) => {
      recordCall('export-png-from-svg', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, filePath: '/mock/path/diagram.png' };
    }),

    exportCSV: vi.fn(async (data: any) => {
      recordCall('export-csv', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, filePath: '/mock/path/devices.csv' };
    }),

    exportPDF: vi.fn(async (data: any) => {
      recordCall('export-pdf', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, filePath: '/mock/path/document.pdf' };
    }),

    // ============== Menu Events ==============
    onMenuNewProject: vi.fn((callback) => addListener('menu-new-project', callback)),
    onMenuOpenProject: vi.fn((callback) => addListener('menu-open-project', callback)),
    onMenuSave: vi.fn((callback) => addListener('menu-save', callback)),
    onMenuUndo: vi.fn((callback) => addListener('menu-undo', callback)),
    onMenuRedo: vi.fn((callback) => addListener('menu-redo', callback)),
    onMenuExportSVG: vi.fn((callback) => addListener('menu-export-svg', callback)),
    onMenuExportJSON: vi.fn((callback) => addListener('menu-export-json', callback)),
    onMenuExportPNG: vi.fn((callback) => addListener('menu-export-png', callback)),
    onMenuImportJSON: vi.fn((callback) => addListener('menu-import-json', callback)),
    onMenuViewTopology: vi.fn((callback) => addListener('menu-view-topology', callback)),
    onMenuViewInventory: vi.fn((callback) => addListener('menu-view-inventory', callback)),
    onMenuViewSSP: vi.fn((callback) => addListener('menu-view-ssp', callback)),
    onMenuViewNarratives: vi.fn((callback) => addListener('menu-view-narratives', callback)),
    onMenuViewAI: vi.fn((callback) => addListener('menu-view-ai', callback)),
    onMenuTopologyAddDevice: vi.fn((callback) => addListener('menu-topology-add-device', callback)),
    onMenuTopologyAddBoundary: vi.fn((callback) => addListener('menu-topology-add-boundary', callback)),
    onMenuTopologyShowPalette: vi.fn((callback) => addListener('menu-topology-show-palette', callback)),
    onMenuTopologyShowAlignment: vi.fn((callback) => addListener('menu-topology-show-alignment', callback)),
    onMenuInventoryAddDevice: vi.fn((callback) => addListener('menu-inventory-add-device', callback)),
    onMenuInventoryImport: vi.fn((callback) => addListener('menu-inventory-import', callback)),
    onMenuInventoryExport: vi.fn((callback) => addListener('menu-inventory-export', callback)),
    onMenuInventorySearch: vi.fn((callback) => addListener('menu-inventory-search', callback)),
    onMenuSSPGeneratePDF: vi.fn((callback) => addListener('menu-ssp-generate-pdf', callback)),
    onMenuSSPPreview: vi.fn((callback) => addListener('menu-ssp-preview', callback)),
    onMenuSSPSettings: vi.fn((callback) => addListener('menu-ssp-settings', callback)),
    onMenuNarrativesNew: vi.fn((callback) => addListener('menu-narratives-new', callback)),
    onMenuNarrativesExport: vi.fn((callback) => addListener('menu-narratives-export', callback)),
    onMenuNarrativesImport: vi.fn((callback) => addListener('menu-narratives-import', callback)),
    onMenuNarrativesReset: vi.fn((callback) => addListener('menu-narratives-reset', callback)),
    onMenuAIClearChat: vi.fn((callback) => addListener('menu-ai-clear-chat', callback)),
    onMenuAIExportChat: vi.fn((callback) => addListener('menu-ai-export-chat', callback)),
    onMenuAISettings: vi.fn((callback) => addListener('menu-ai-settings', callback)),
    onMenuProjects: vi.fn((callback) => addListener('menu-projects', callback)),
    onMenuAIStatus: vi.fn((callback) => addListener('menu-ai-status', callback)),
    onMenuEnterLicense: vi.fn((callback) => addListener('menu-enter-license', callback)),
    onMenuLicenseStatus: vi.fn((callback) => addListener('menu-license-status', callback)),
    onMenuLicenseInfo: vi.fn((callback) => addListener('menu-license-info', callback)),

    // ============== AI Operations ==============
    llmGenerate: vi.fn(async (data: any) => {
      recordCall('ai:llm-generate', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return {
        success: true,
        data: {
          text: `Mock response for: ${data.prompt.substring(0, 50)}...`,
          tokensUsed: Math.floor(data.prompt.length / 4)
        }
      };
    }),

    llmGenerateStream: vi.fn(async (data: any) => {
      recordCall('ai:llm-generate-stream', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const tokens = ['Mock ', 'streaming ', 'response ', 'for ', 'testing'];
      for (const token of tokens) {
        emitMockEvent('ai:stream-token', token);
        await new Promise(r => setTimeout(r, 10));
      }

      return {
        success: true,
        data: { text: tokens.join(''), tokensUsed: tokens.length }
      };
    }),

    onStreamToken: vi.fn((callback) => addListener('ai:stream-token', callback)),

    embed: vi.fn(async (data: any) => {
      recordCall('ai:embed', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      // Generate mock embedding vector (384 dimensions like sentence transformers)
      const embedding = Array(384).fill(0).map(() => Math.random() * 2 - 1);
      return { success: true, data: { embedding } };
    }),

    chromaDbQuery: vi.fn(async (data: any) => {
      recordCall('ai:chromadb-query', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return {
        success: true,
        data: {
          documents: [['Mock document 1', 'Mock document 2']],
          metadatas: [[{ source: 'test' }, { source: 'test' }]],
          distances: [[0.1, 0.2]]
        }
      };
    }),

    chromaDbAdd: vi.fn(async (data: any) => {
      recordCall('ai:chromadb-add', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return { success: true, data: { count: data.documents.length } };
    }),

    checkAIHealth: vi.fn(async () => {
      recordCall('ai:check-health', []);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return mockState.aiHealth;
    }),

    getContextSize: vi.fn(async () => {
      recordCall('ai:get-context-size', []);
      await simulateDelay(globalMockConfig);
      return mockState.aiHealth.contextSize;
    }),

    // AI preload operations
    getAIPreloadStatus: vi.fn(async () => {
      recordCall('ai:get-preload-status', []);
      return { isPreloading: false };
    }),

    onAIPreloadProgress: vi.fn((callback) => addListener('ai:preload-progress', callback)),
    removeAIPreloadProgressListener: vi.fn(() => removeListener('ai:preload-progress')),

    // ============== File Operations ==============
    getDownloadsPath: vi.fn(async () => {
      recordCall('get-downloads-path', []);
      return '/mock/downloads';
    }),

    saveFile: vi.fn(async (data: any) => {
      recordCall('save-file', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);
      return { success: true, path: data.path };
    }),

    generateSSPPDF: vi.fn(async (data: any) => {
      recordCall('generate-ssp-pdf', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      // Return mock PDF buffer
      const mockPdfBuffer = Buffer.from('Mock PDF content');
      return { success: true, pdfBuffer: mockPdfBuffer };
    }),

    // ============== License Operations ==============
    openLicenseFile: vi.fn(async () => {
      recordCall('license:open-file', []);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      if (mockState.license) {
        return {
          success: true,
          content: JSON.stringify(mockState.license),
          filePath: '/mock/path/license.license'
        };
      }
      return { success: false, canceled: true };
    }),

    saveLicense: vi.fn(async (data: { license: LicenseFile }) => {
      recordCall('license:save', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.license = data.license;
      return { success: true };
    }),

    getLicense: vi.fn(async () => {
      recordCall('license:get', []);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return { success: true, license: mockState.license };
    }),

    clearLicense: vi.fn(async () => {
      recordCall('license:clear', []);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      mockState.license = null;
      return { success: true };
    }),

    // ============== Device Types Operations ==============
    getDeviceTypes: vi.fn(async () => {
      recordCall('device-types:get-all', []);
      return [
        { id: 1, icon_path: '/icons/server.svg', device_type: 'server', device_subtype: 'web' },
        { id: 2, icon_path: '/icons/router.svg', device_type: 'network', device_subtype: 'router' },
      ];
    }),

    getDeviceTypeByIcon: vi.fn(async (iconPath: string) => {
      recordCall('device-types:get-by-icon', [iconPath]);
      return { id: 1, icon_path: iconPath, device_type: 'server', device_subtype: 'web' };
    }),

    migrateDeviceTypes: vi.fn(async () => {
      recordCall('device-types:migrate', []);
      return { success: true, count: 10 };
    }),

    // ============== Document Chunking Operations ==============
    uploadDocument: vi.fn(async (data: any) => {
      recordCall('chunking:upload-file', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      const docId = `doc-${Date.now()}`;
      return { success: true, documentId: docId, filename: 'test.pdf', filePath: data.filePath };
    }),

    processDocument: vi.fn(async (data: any) => {
      recordCall('chunking:process-document', [data]);
      await simulateDelay(globalMockConfig);
      checkFailure(globalMockConfig);

      return { success: true, chunkCount: 10 };
    }),

    getDocuments: vi.fn(async (data: any) => {
      recordCall('chunking:get-documents', [data]);
      return { success: true, documents: Array.from(mockState.documents.values()) };
    }),

    deleteDocument: vi.fn(async (data: any) => {
      recordCall('chunking:delete-document', [data]);
      mockState.documents.delete(data.documentId);
      return { success: true };
    }),

    getChunkingStatus: vi.fn(async () => {
      recordCall('chunking:get-status', []);
      return { currentlyProcessing: null, queueLength: 0 };
    }),

    cancelChunking: vi.fn(async () => {
      recordCall('chunking:cancel', []);
      return { success: true };
    }),

    queryUserDocs: vi.fn(async (data: any) => {
      recordCall('chunking:query-user-docs', [data]);
      return { success: true, results: [] };
    }),

    onChunkingProgress: vi.fn((callback) => addListener('chunking:progress', callback)),
    removeChunkingProgressListener: vi.fn(() => removeListener('chunking:progress')),

    // Dual-source query
    queryDualSource: vi.fn(async (data: any) => {
      recordCall('ai:query-dual-source', [data]);
      await simulateDelay(globalMockConfig);
      return {
        success: true,
        results: { user: [], shared: [], merged: [] }
      };
    }),

    // ============== Terraform Operations ==============
    selectTerraformDirectory: vi.fn(async () => {
      recordCall('terraform:select-directory', []);
      return {
        success: true,
        directory: '/mock/terraform',
        hasTerraformInit: true,
        hasTerraformFiles: true
      };
    }),

    selectTerraformJsonFile: vi.fn(async () => {
      recordCall('terraform:select-json-file', []);
      return {
        success: true,
        content: '{}',
        filePath: '/mock/terraform/plan.json'
      };
    }),

    runTerraformPlan: vi.fn(async (data: any) => {
      recordCall('terraform:run-plan', [data]);
      return {
        success: true,
        planJson: '{}',
        planData: {}
      };
    }),

    onTerraformPlanProgress: vi.fn((callback) => addListener('terraform:progress', callback)),
    removeTerraformProgressListener: vi.fn(() => removeListener('terraform:progress')),

    // ============== Error Handling Operations ==============
    getErrorStats: vi.fn(async () => {
      recordCall('error:get-stats', []);
      return {
        total: 0,
        byCategory: {},
        bySeverity: {},
        recent: []
      };
    }),

    clearErrorLog: vi.fn(async () => {
      recordCall('error:clear-log', []);
      return { success: true };
    }),

    onMainProcessError: vi.fn((callback) => addListener('main-process-error', callback)),
    removeMainProcessErrorListener: vi.fn(() => removeListener('main-process-error')),

    // Optional restart
    restartApp: vi.fn(() => {
      recordCall('restart-app', []);
    })
  };

  return api;
}

// Install mock on window object
export function installMockElectronAPI(): ElectronAPI {
  const mockApi = createMockElectronAPI();
  (globalThis as any).window = {
    ...(globalThis as any).window,
    electronAPI: mockApi
  };
  return mockApi;
}

// Helper to set up mock devices for testing
export function seedMockDevices(projectId: number, count: number = 5): DeviceRecord[] {
  const devices: DeviceRecord[] = [];
  for (let i = 0; i < count; i++) {
    const device = createMockDevice({
      id: `device-${i}`,
      project_id: projectId,
      name: `Test Device ${i}`,
      device_type: i % 2 === 0 ? 'server' : 'network'
    });
    mockState.devices.set(`${projectId}:${device.id}`, device);
    devices.push(device);
  }
  return devices;
}

// Helper to set license for testing
export function setMockLicense(license: LicenseFile | null): void {
  mockState.license = license;
}

// Export mock state for advanced testing scenarios
export { mockState };
