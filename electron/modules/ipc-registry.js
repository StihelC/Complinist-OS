/**
 * IPC Handler Registry Module
 * Centralizes registration of all IPC handlers using a composition pattern
 *
 * All handlers use centralized validation middleware that:
 * 1. Sanitizes input data (removes null bytes, trims strings)
 * 2. Validates against Zod schemas
 * 3. Enforces size limits to prevent DoS attacks
 * 4. Provides consistent error handling
 */
import { ipcMain, app, dialog, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as aiService from '../ai-service-manager.js';
import mainProcessHMR from '../hmr/main-process-hmr.js';
import { registerErrorDashboardHandlers } from '../ipc/error-dashboard.js';
import { registerDeviceTypesHandlers as registerDeviceTypesHandlersFromModule } from '../ipc/device-types.js';
import { registerDebugHandlers } from '../ipc/debug.js';
import {
  validateIpcInput,
  validateProjectId,
  createProjectSchema,
  saveDiagramSchema,
  saveDiagramDeltaSchema,
  saveControlNarrativesSchema,
  resetControlNarrativeSchema,
  updateProjectBaselineSchema,
  saveSingleControlNarrativeSchema,
  queryDevicesSchema,
  getDeviceSchema,
  searchDevicesSchema,
  exportJsonSchema,
  exportPngSchema,
  exportSvgSchema,
  exportPngFromSvgSchema,
  exportCsvSchema,
  llmGenerateSchema,
  embedSchema,
  chromaDbQuerySchema,
  chromaDbAddSchema,
  saveFileSchema,
  generateSspPdfSchema,
  saveLicenseSchema,
  saveSSPMetadataSchema,
  captureViewportSchema,
  deviceTypeIconPathSchema,
  queryDualSourceSchema,
  consoleLogSchema,
  sanitizeObject,
  projectIdSchema,
} from '../ipc-validation.js';
import {
  getDatabase,
  getRepositories,
  syncDevicesToTable,
  enrichNodesWithDeviceMetadata,
} from './database-init.js';
import { getMainWindow } from './window-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logging
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG;
const debugLog = (...args) => { if (isDev) console.log(...args); };

/**
 * Register all IPC handlers
 * Uses a composition pattern to organize handlers by feature
 */
export function registerAllIPCHandlers() {
  registerDatabaseHandlers();
  registerDeviceTypesHandlersFromModule(ipcMain);
  registerExportImportHandlers();
  registerAIHandlers();
  registerFileHandlers();
  registerLicenseHandlers();
  registerMiscHandlers();
  registerErrorDashboardHandlers(ipcMain);
  registerDebugHandlers();

  // Note: Chunking and Terraform handlers are registered in app-lifecycle.js
  // after the main window is created, since they require a window reference

  debugLog('[IPC] All handlers registered successfully');
}

// ============== Database Handlers ==============

function registerDatabaseHandlers() {
  const db = getDatabase();
  const repos = getRepositories();

  // ===== Project Operations (Using Repository Pattern) =====

  ipcMain.handle('db:create-project', async (event, data) => {
    try {
      const { name, baseline } = validateIpcInput(createProjectSchema, data, 'db:create-project');
      const result = repos.projects.createProject({ name, baseline });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:list-projects', async () => {
    try {
      const result = repos.projects.listProjects();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error listing projects:', error);
      throw error;
    }
  });

  // ===== Diagram Operations (Using Repository Pattern) =====

  ipcMain.handle('db:save-diagram', async (event, data) => {
    try {
      const { projectId, nodes, edges, viewport } = validateIpcInput(saveDiagramSchema, data, 'db:save-diagram');

      // Touch project updated_at
      repos.projects.touchProject(projectId);

      // Save diagram using repository
      const result = repos.diagrams.saveDiagram(projectId, nodes, edges, viewport);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Sync devices to normalized table
      syncDevicesToTable(projectId, nodes);
      return { success: true };
    } catch (error) {
      console.error('Error saving diagram:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-diagram-delta', async (event, data) => {
    try {
      const { projectId, nodeChanges, edgeChanges, sequence } = validateIpcInput(saveDiagramDeltaSchema, data, 'db:save-diagram-delta');

      // Touch project updated_at
      repos.projects.touchProject(projectId);

      // Apply delta changes using repository
      const result = repos.diagrams.saveDiagramDelta(projectId, nodeChanges, edgeChanges, sequence);

      if (!result.success) {
        return result;
      }

      // Sync changed device nodes to normalized table
      if (result.updatedNodes && (nodeChanges || []).length > 0) {
        syncDevicesToTable(projectId, result.updatedNodes);
      }

      return {
        success: true,
        isDelta: true,
        appliedChanges: result.appliedChanges,
        serverSequence: result.serverSequence,
      };
    } catch (error) {
      console.error('Error saving diagram delta:', error);
      return {
        success: false,
        requiresFullSave: true,
        error: error.message,
      };
    }
  });

  ipcMain.handle('db:load-diagram', async (event, projectId) => {
    try {
      // Validate project ID
      const validProjectId = validateProjectId(projectId, 'db:load-diagram');

      const result = repos.diagrams.loadDiagram(validProjectId);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Enrich nodes with device metadata
      const enrichedNodes = enrichNodesWithDeviceMetadata(validProjectId, result.data.nodes);

      return {
        nodes: enrichedNodes,
        edges: result.data.edges,
        viewport: result.data.viewport,
      };
    } catch (error) {
      console.error('Error loading diagram:', error);
      throw error;
    }
  });

  // ===== Control Narrative Operations (Using Repository Pattern) =====

  ipcMain.handle('db:load-control-narratives', async (event, projectId) => {
    try {
      // Validate project ID
      const validProjectId = validateProjectId(projectId, 'db:load-control-narratives');

      const result = repos.controlNarratives.loadNarratives(validProjectId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error loading control narratives:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-control-narratives', async (event, data) => {
    try {
      const { projectId, narratives } = validateIpcInput(saveControlNarrativesSchema, data, 'db:save-control-narratives');

      const result = repos.controlNarratives.saveNarratives(projectId, narratives);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Touch project updated_at
      repos.projects.touchProject(projectId);

      return { success: true };
    } catch (error) {
      console.error('Error saving control narratives:', error);
      throw error;
    }
  });

  // ===== SSP Metadata Operations (Using Repository Pattern) =====

  ipcMain.handle('db:save-ssp-metadata', async (event, data) => {
    try {
      const { projectId, metadata } = validateIpcInput(saveSSPMetadataSchema, data, 'db:save-ssp-metadata');

      const result = repos.sspMetadata.saveMetadata(projectId, metadata);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Touch project updated_at
      repos.projects.touchProject(projectId);

      return { success: true };
    } catch (error) {
      console.error('Error saving SSP metadata:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-ssp-metadata', async (event, projectId) => {
    try {
      // Validate project ID
      const validProjectId = validateProjectId(projectId, 'db:get-ssp-metadata');

      const result = repos.sspMetadata.getMetadata(validProjectId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error fetching SSP metadata:', error);
      throw error;
    }
  });

  ipcMain.handle('db:reset-control-narrative', async (event, data) => {
    try {
      // Validate input
      const { projectId, controlId } = validateIpcInput(resetControlNarrativeSchema, data, 'db:reset-control-narrative');

      const result = repos.controlNarratives.resetNarrative(projectId, controlId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    } catch (error) {
      console.error('Error resetting control narrative:', error);
      throw error;
    }
  });

  // ===== Additional Project Operations (Using Repository Pattern) =====

  ipcMain.handle('db:update-project-baseline', async (event, data) => {
    try {
      // Validate input
      const { projectId, baseline } = validateIpcInput(updateProjectBaselineSchema, data, 'db:update-project-baseline');

      const result = repos.projects.updateProjectBaseline(projectId, baseline);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true, baseline };
    } catch (error) {
      console.error('Error updating project baseline:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-single-control-narrative', async (event, data) => {
    try {
      // Validate input
      const { projectId, controlId, systemImplementation, implementationStatus } = validateIpcInput(
        saveSingleControlNarrativeSchema,
        data,
        'db:save-single-control-narrative'
      );

      const result = repos.controlNarratives.saveSingleNarrative(projectId, controlId, systemImplementation, implementationStatus);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Touch project updated_at
      repos.projects.touchProject(projectId);

      return { success: true };
    } catch (error) {
      console.error('Error saving single control narrative:', error);
      throw error;
    }
  });

  ipcMain.handle('db:delete-project', async (event, projectId) => {
    try {
      // Validate project ID
      const validProjectId = validateProjectId(projectId, 'db:delete-project');

      const result = repos.projects.deleteProject(validProjectId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  });

  // ===== Device Query Operations (Using Repository Pattern) =====

  ipcMain.handle('db:query-devices', async (event, data) => {
    try {
      const { projectId, filters } = validateIpcInput(queryDevicesSchema, data, 'db:query-devices');
      const result = repos.devices.queryDevices(projectId, filters);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error querying devices:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-device', async (event, data) => {
    try {
      const { projectId, deviceId } = validateIpcInput(getDeviceSchema, data, 'db:get-device');
      const result = repos.devices.getDevice(projectId, deviceId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error getting device:', error);
      throw error;
    }
  });

  ipcMain.handle('db:search-devices', async (event, data) => {
    try {
      const { projectId, searchTerm } = validateIpcInput(searchDevicesSchema, data, 'db:search-devices');
      const result = repos.devices.searchDevices(projectId, searchTerm);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    } catch (error) {
      console.error('Error searching devices:', error);
      throw error;
    }
  });

  debugLog('[IPC] Database handlers registered');
}

// ============== Device Types Handlers ==============
// Note: Device types handlers are now imported from electron/ipc/device-types.js
// This includes all handlers: get-all, get-by-icon, migrate, find-match, and batch-find-match

// ============== Export/Import Handlers ==============

function registerExportImportHandlers() {
  // Note: We get mainWindow at runtime inside each handler because
  // the window is created after handler registration

  ipcMain.handle('export-json', async (event, data) => {
    const mainWindow = getMainWindow();
    debugLog('[ELECTRON] export-json handler called');
    console.log('[ELECTRON] export-json handler called - VERSION 2.0');
    console.log('[ELECTRON] Platform:', process.platform);

    try {
      if (!data || !data.reportData) {
        console.error('[ELECTRON] Invalid export data:', {
          hasData: !!data,
          hasReportData: !!(data && data.reportData),
          dataKeys: data ? Object.keys(data) : [],
        });
        return { success: false, error: 'Invalid export data: missing reportData' };
      }

      // Linux workaround: Save directly to Downloads folder to avoid dialog issues
      // on certain desktop environments
      let filePath;
      if (process.platform === 'linux') {
        const downloadsPath = app.getPath('downloads');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        // Sanitize project name to prevent path traversal via filename
        const safeProjectName = (data.projectName || 'diagram').replace(/[\/\\\.]+/g, '_');
        const fileName = `${safeProjectName}-${timestamp}.json`;
        filePath = path.join(downloadsPath, fileName);
        console.log('[ELECTRON] Linux: Saving directly to Downloads:', filePath);
      } else {
        // Show save dialog on other platforms
        console.log('[ELECTRON] Opening save dialog...');
        const dialogResult = await dialog.showSaveDialog(mainWindow, {
          title: 'Export Diagram as JSON',
          defaultPath: `${data.projectName || 'diagram'}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        console.log('[ELECTRON] Dialog result:', dialogResult);

        if (dialogResult.canceled || !dialogResult.filePath) {
          console.log('[ELECTRON] Export canceled by user or no file path');
          return { success: false, canceled: true };
        }

        filePath = dialogResult.filePath;
      }

      // Test serialization before writing
      console.log('[ELECTRON] Testing JSON serialization...');
      let jsonString;
      try {
        jsonString = JSON.stringify(data.reportData, null, 2);
        console.log('[ELECTRON] Serialization successful, size:', jsonString.length, 'bytes');
      } catch (serializationError) {
        console.error('[ELECTRON] JSON serialization error:', serializationError);
        console.error('[ELECTRON] Serialization error details:', {
          message: serializationError.message,
          stack: serializationError.stack,
        });
        return {
          success: false,
          error: `Failed to serialize data: ${serializationError.message}`
        };
      }

      // Write file
      console.log('[ELECTRON] Writing file to:', filePath);
      try {
        fs.writeFileSync(filePath, jsonString, 'utf-8');
        const stats = fs.statSync(filePath);
        console.log('[ELECTRON] File written successfully:', {
          path: filePath,
          size: stats.size,
          bytes: stats.size,
        });
        return { success: true, filePath };
      } catch (writeError) {
        console.error('[ELECTRON] File write error:', writeError);
        console.error('[ELECTRON] Write error details:', {
          message: writeError.message,
          code: writeError.code,
          stack: writeError.stack,
        });
        return {
          success: false,
          error: `Failed to write file: ${writeError.message}`
        };
      }
    } catch (error) {
      console.error('[ELECTRON] Unexpected error in export-json handler:', error);
      console.error('[ELECTRON] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return {
        success: false,
        error: error.message || 'Unknown error during export'
      };
    }
  });

  ipcMain.handle('import-json', async () => {
    const mainWindow = getMainWindow();
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Diagram from JSON',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(fileContent);
      return { success: true, data };
    } catch (error) {
      console.error('Error importing JSON:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('capture-viewport', async (event, bounds) => {
    const mainWindow = getMainWindow();
    try {
      debugLog('[CAPTURE] Capture viewport called with bounds:', bounds);

      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window not available');
      }

      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        throw new Error(`Invalid bounds: ${JSON.stringify(bounds)}`);
      }

      const zoomFactor = mainWindow.webContents.getZoomFactor();
      const display = screen.getPrimaryDisplay();
      const scaleFactor = display.scaleFactor;
      const qualityScaleFactor = Math.max(scaleFactor, 2.0);

      const captureRect = {
        x: Math.floor((bounds.x || 0) * zoomFactor),
        y: Math.floor((bounds.y || 0) * zoomFactor),
        width: Math.floor(bounds.width * zoomFactor),
        height: Math.floor(bounds.height * zoomFactor)
      };

      await new Promise(resolve => setTimeout(resolve, 100));

      const image = await mainWindow.webContents.capturePage(captureRect);
      const imageSize = image.getSize();

      if (imageSize.width === 0 || imageSize.height === 0) {
        throw new Error('Captured image has zero dimensions');
      }

      const pngBuffer = image.toPNG();

      if (pngBuffer.length === 0) {
        throw new Error('Captured image is empty');
      }

      const imageData = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      return {
        success: true,
        imageData: imageData,
        dimensions: imageSize,
        quality: {
          scaleFactor: qualityScaleFactor,
          originalBounds: bounds,
          capturedSize: imageSize
        }
      };
    } catch (error) {
      console.error('[CAPTURE] Error capturing viewport:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  });

  ipcMain.handle('export-png', async (event, data) => {
    try {
      const downloadsPath = app.getPath('downloads');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `${data.projectName || 'diagram'}-${timestamp}.png`;
      const filePath = path.join(downloadsPath, fileName);

      const base64Data = data.imageData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      fs.writeFileSync(filePath, buffer);
      return { success: true, filePath };
    } catch (error) {
      console.error('Error exporting PNG:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-svg', async (event, data) => {
    const mainWindow = getMainWindow();
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagram as SVG',
        defaultPath: `${data.projectName || 'diagram'}.svg`,
        filters: [
          { name: 'SVG Images', extensions: ['svg'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      let svgData;
      if (data.svgContent) {
        svgData = data.svgContent;
      } else if (data.imageData) {
        const base64Data = data.imageData.replace(/^data:image\/svg\+xml;base64,/, '');
        svgData = Buffer.from(base64Data, 'base64').toString('utf8');
      } else {
        throw new Error('No SVG data provided');
      }

      fs.writeFileSync(filePath, svgData, 'utf8');
      return { success: true, filePath };
    } catch (error) {
      console.error('Error exporting SVG:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-png-from-svg', async (event, data) => {
    const mainWindow = getMainWindow();
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagram as PNG',
        defaultPath: `${data.projectName || 'diagram'}.png`,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const { svgContent, width, height } = data;

      const hiddenWindow = new BrowserWindow({
        width: width || 2400,
        height: height || 1800,
        show: false,
        webPreferences: {
          offscreen: true,
        }
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              * { margin: 0; padding: 0; }
              body {
                background: white;
                width: ${width || 2400}px;
                height: ${height || 1800}px;
                overflow: hidden;
              }
              svg {
                display: block;
                width: 100%;
                height: 100%;
              }
            </style>
          </head>
          <body>
            ${svgContent}
          </body>
        </html>
      `;

      await hiddenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      await new Promise(resolve => setTimeout(resolve, 500));

      const image = await hiddenWindow.webContents.capturePage();
      const pngBuffer = image.toPNG();

      hiddenWindow.close();

      fs.writeFileSync(filePath, pngBuffer);

      return { success: true, filePath };
    } catch (error) {
      console.error('Error exporting PNG from SVG:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-csv', async (event, data) => {
    const mainWindow = getMainWindow();
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Inventory as CSV',
        defaultPath: data.filename || `device_metadata_${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      fs.writeFileSync(filePath, data.csvContent, 'utf8');
      return { success: true, filePath };
    } catch (error) {
      console.error('[ELECTRON] Error exporting CSV:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-pdf', async (event, data) => {
    const mainWindow = getMainWindow();
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export PDF',
        defaultPath: data.filename || `export_${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const buffer = Buffer.isBuffer(data.pdfBuffer) ? data.pdfBuffer : Buffer.from(data.pdfBuffer);
      fs.writeFileSync(filePath, buffer);
      return { success: true, filePath };
    } catch (error) {
      console.error('[ELECTRON] Error exporting PDF:', error);
      return { success: false, error: error.message };
    }
  });

  debugLog('[IPC] Export/Import handlers registered');
}

// ============== AI Handlers ==============

function registerAIHandlers() {
  ipcMain.handle('ai:llm-generate', async (event, data) => {
    try {
      const { prompt, temperature, maxTokens } = validateIpcInput(llmGenerateSchema, data, 'ai:llm-generate');
      const result = await aiService.generateText(prompt, { temperature, maxTokens });
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] LLM generate error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:llm-generate-stream', async (event, data) => {
    try {
      const { prompt, temperature, maxTokens } = validateIpcInput(llmGenerateSchema, data, 'ai:llm-generate-stream');
      const tokens = [];
      for await (const token of aiService.generateTextStream(prompt, { temperature, maxTokens })) {
        tokens.push(token);
        event.sender.send('ai:stream-token', token);
      }
      return { success: true, data: { text: tokens.join(''), tokensUsed: tokens.length } };
    } catch (error) {
      console.error('[AI IPC] LLM stream error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:embed', async (event, data) => {
    try {
      const { text } = validateIpcInput(embedSchema, data, 'ai:embed');
      const result = await aiService.generateEmbedding(text);
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] Embed error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:chromadb-query', async (event, data) => {
    try {
      const { collection, queryEmbedding, topK, filters } = validateIpcInput(chromaDbQuerySchema, data, 'ai:chromadb-query');
      const result = await aiService.queryChromaDB(collection, queryEmbedding, { topK, filters });
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] ChromaDB query error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:chromadb-add', async (event, data) => {
    try {
      const { collection, documents, embeddings, metadatas, ids } = validateIpcInput(chromaDbAddSchema, data, 'ai:chromadb-add');
      const result = await aiService.addToChromaDB(collection, documents, embeddings, metadatas, ids);
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] ChromaDB add error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:check-health', async () => {
    try {
      const health = await aiService.checkHealth();
      return health;
    } catch (error) {
      console.error('[AI IPC] Health check error:', error);
      return {
        llm: false,
        embedding: false,
        chroma: false,
        contextSize: 2500,
      };
    }
  });

  ipcMain.handle('ai:get-context-size', async () => {
    try {
      return aiService.getCalibratedContextSize();
    } catch (error) {
      console.error('[AI IPC] Get context size error:', error);
      return 2500;
    }
  });

  // Preload status handler
  ipcMain.handle('ai:get-preload-status', async () => {
    return {
      isPreloading: aiService.isPreloadInProgress(),
    };
  });

  ipcMain.handle('ai:query-dual-source', async (event, data) => {
    try {
      // Validate input
      const { userId, queryEmbedding, topK, searchScope } = validateIpcInput(
        queryDualSourceSchema,
        data,
        'ai:query-dual-source'
      );
      const results = await aiService.queryDualSource(userId, queryEmbedding, { topK, searchScope });
      return { success: true, results };
    } catch (error) {
      console.error('[AI IPC] Dual-source query error:', error);
      return { success: false, error: error.message, results: { user: [], shared: [], merged: [] } };
    }
  });

  debugLog('[IPC] AI handlers registered');
}

// ============== File Handlers ==============

function registerFileHandlers() {
  ipcMain.handle('get-downloads-path', async () => {
    try {
      const downloadsPath = app.getPath('downloads');
      return downloadsPath;
    } catch (error) {
      console.error('Failed to get downloads path:', error);
      throw error;
    }
  });

  ipcMain.handle('save-file', async (event, data) => {
    try {
      const { path: filePath, data: fileData } = validateIpcInput(saveFileSchema, data, 'save-file');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData);
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (error) {
      console.error('[IPC] Failed to save file:', error);
      throw error;
    }
  });

  ipcMain.handle('generate-ssp-pdf', async (event, { html, options }) => {
    debugLog('[IPC] generate-ssp-pdf called');
    try {
      if (!html) {
        throw new Error('HTML content is required');
      }

      const pdfWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true,
        },
      });

      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise(resolve => setTimeout(resolve, 500));

      const pdfOptions = {
        marginsType: 1,
        printBackground: true,
        pageSize: 'Letter',
        landscape: false,
        ...options,
      };

      const pdfBuffer = await pdfWindow.webContents.printToPDF(pdfOptions);
      pdfWindow.close();

      return {
        success: true,
        pdfBuffer: pdfBuffer,
      };
    } catch (error) {
      console.error('[IPC] Failed to generate PDF:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  debugLog('[IPC] File handlers registered');
}

// ============== License Handlers ==============

function registerLicenseHandlers() {
  const db = getDatabase();
  // Note: We get mainWindow at runtime inside handlers that need it

  ipcMain.handle('license:open-file', async () => {
    const mainWindow = getMainWindow();
    debugLog('[IPC] license:open-file called');
    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: 'Main window is not available' };
      }

      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import License File',
        filters: [
          { name: 'License Files', extensions: ['license'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const fileContent = fs.readFileSync(filePaths[0], 'utf-8');

      return {
        success: true,
        content: fileContent,
        filePath: filePaths[0]
      };
    } catch (error) {
      console.error('[IPC] Failed to open license file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('license:save', async (event, data) => {
    debugLog('[IPC] license:save called');
    try {
      // Validate license data
      const { license } = validateIpcInput(saveLicenseSchema, data, 'license:save');

      db.prepare('DELETE FROM licenses').run();

      const stmt = db.prepare(`
        INSERT INTO licenses (
          license_code, user_id, email, expires_at,
          subscription_status, subscription_plan, subscription_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        license.license_code,
        license.user_id,
        license.email,
        license.expires_at,
        license.subscription_status,
        license.subscription_plan || null,
        license.subscription_id || null,
        license.created_at || Math.floor(Date.now() / 1000)
      );

      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to save license:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('license:get', async () => {
    debugLog('[IPC] license:get called');
    try {
      const stmt = db.prepare('SELECT * FROM licenses ORDER BY id DESC LIMIT 1');
      const row = stmt.get();

      if (!row) {
        return { success: true, license: null };
      }

      return {
        success: true,
        license: {
          license_code: row.license_code,
          user_id: row.user_id,
          email: row.email,
          expires_at: row.expires_at,
          subscription_status: row.subscription_status,
          subscription_plan: row.subscription_plan,
          subscription_id: row.subscription_id,
          created_at: row.created_at,
        },
      };
    } catch (error) {
      console.error('[IPC] Failed to get license:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('license:clear', async () => {
    debugLog('[IPC] license:clear called');
    try {
      db.prepare('DELETE FROM licenses').run();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to clear license:', error);
      return { success: false, error: error.message };
    }
  });

  debugLog('[IPC] License handlers registered');
}

// ============== Misc Handlers ==============

function registerMiscHandlers() {
  ipcMain.handle('hmr:status', () => {
    return {
      enabled: mainProcessHMR.isEnabled,
      environment: process.env.NODE_ENV || 'production',
      devServerUrl: process.env.VITE_DEV_SERVER_URL || null,
    };
  });

  // Error handling IPC handlers
  ipcMain.handle('error:get-stats', () => {
    return errorReporter.getErrorStats();
  });

  ipcMain.handle('error:clear-log', () => {
    errorReporter.clearErrorLog();
    return { success: true };
  });

  ipcMain.on('console-log', (event, data) => {
    try {
      // Sanitize and validate console log data
      const sanitizedData = sanitizeObject(data);
      const result = consoleLogSchema.safeParse(sanitizedData);

      if (!result.success) {
        console.warn('[IPC] Invalid console-log data received');
        return;
      }

      const { level, args } = result.data;
      const message = args.map(arg =>
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');

      switch (level) {
        case 'log':
          debugLog('[RENDERER]', message);
          break;
        case 'warn':
          console.warn('[RENDERER]', message);
          break;
        case 'error':
          console.error('[RENDERER]', message);
          break;
        case 'info':
          console.info('[RENDERER]', message);
          break;
        case 'debug':
          debugLog('[RENDERER]', message);
          break;
        default:
          debugLog('[RENDERER]', message);
      }
    } catch (error) {
      console.error('[IPC] Error processing console-log:', error);
    }
  });

  debugLog('[IPC] Misc handlers registered');
}
