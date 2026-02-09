/**
 * Application Lifecycle Module
 * Handles application startup, shutdown, and lifecycle events
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import * as aiService from '../ai-service-manager.js';
import { setMainWindow, startAIPreload } from '../ipc/ai.js';
import mainProcessHMR from '../hmr/main-process-hmr.js';
import errorReporter from '../error-reporter.js';
import { registerChunkingHandlers } from '../chunking-service.js';
import { registerTerraformHandlers } from '../ipc/terraform.js';
import { initDatabase, closeDatabase, getDatabase, syncDevicesToTable, enrichNodesWithDeviceMetadata } from './database-init.js';
import { createWindow, getMainWindow, focusOrCreateWindow } from './window-manager.js';
import { createMenu } from './menu.js';
import { registerAllIPCHandlers } from './ipc-registry.js';
import { appRouter, initializeDatabaseRouter } from '../trpc/routers/index.js';

// Debug logging
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG;
const debugLog = (...args) => { if (isDev) console.log(...args); };

// Early startup logging - always writes for debugging packaged builds
function lifecycleLog(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [LIFECYCLE] ${message}\n`;
  console.log(`[LIFECYCLE] ${message}`);

  try {
    const logPaths = [
      process.env.TEMP && path.join(process.env.TEMP, 'complinist-early.log'),
      process.env.TMP && path.join(process.env.TMP, 'complinist-early.log'),
      '/tmp/complinist-early.log',
    ].filter(Boolean);

    for (const logPath of logPaths) {
      try {
        fs.appendFileSync(logPath, logLine);
        break;
      } catch {
        // Try next path
      }
    }
  } catch {
    // Silently fail
  }
}

lifecycleLog('app-lifecycle.js module loaded');

/**
 * Configure application settings before ready
 */
export function configureApp() {
  // Configure sandbox for Linux compatibility
  app.commandLine.appendSwitch('--disable-setuid-sandbox');
  app.commandLine.appendSwitch('--no-sandbox');
  app.commandLine.appendSwitch('--site-isolation-trial-opt-out');

  // Set app name for Linux desktop integration
  // This helps with taskbar/dock icon display and desktop file integration
  app.setName('CompliNist');
  
  // Set AppUserModelId for Windows taskbar icon grouping
  // This ensures the icon appears correctly in the Windows taskbar
  // Must be called before app is ready
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.complinist.desktop');
  }

  debugLog('[LIFECYCLE] App configured');
}

/**
 * Initialize the application when ready
 * This is the main entry point that orchestrates all initialization
 */
export function initializeApp() {
  lifecycleLog('initializeApp() called');
  configureApp();
  lifecycleLog('configureApp() completed');

  lifecycleLog('Waiting for app.whenReady()...');
  app.whenReady().then(async () => {
    lifecycleLog('App ready event fired, starting initialization...');
    debugLog('[LIFECYCLE] App ready, initializing...');

    // Step 0: Ensure portable data dirs exist when in portable layout (before DB init)
    try {
      const { ensurePortableDirectories } = await import('../path-resolver.js');
      ensurePortableDirectories();
    } catch (e) {
      lifecycleLog(`ensurePortableDirectories: ${e.message}`);
    }

    // Step 1: Initialize database
    lifecycleLog('Step 1: Initializing database...');
    try {
      initDatabase();
      lifecycleLog('Database initialized successfully');
    } catch (dbError) {
      lifecycleLog(`DATABASE ERROR: ${dbError.message}`);
      lifecycleLog(`Stack: ${dbError.stack}`);
    }
    debugLog('[LIFECYCLE] Database initialized');

    // Step 1.1: Initialize tRPC database router with database functions
    initializeDatabaseRouter({
      getDatabase,
      syncDevicesToTable,
      enrichNodesWithDeviceMetadata,
    });
    debugLog('[LIFECYCLE] tRPC database router initialized');

    // Step 2: Register all IPC handlers
    lifecycleLog('Step 2: Registering IPC handlers...');
    try {
      registerAllIPCHandlers();
      lifecycleLog('IPC handlers registered successfully');
    } catch (ipcError) {
      lifecycleLog(`IPC ERROR: ${ipcError.message}`);
      lifecycleLog(`Stack: ${ipcError.stack}`);
    }
    debugLog('[LIFECYCLE] IPC handlers registered');

    // Step 3: Create main window with menu
    lifecycleLog('Step 3: Creating main window...');
    let mainWindow;
    try {
      mainWindow = createWindow({
        onMenuCreate: (win) => createMenu(win),
      });
      lifecycleLog('Main window created successfully');
    } catch (windowError) {
      lifecycleLog(`WINDOW ERROR: ${windowError.message}`);
      lifecycleLog(`Stack: ${windowError.stack}`);
    }
    debugLog('[LIFECYCLE] Main window created');

    // Step 3.1: Create tRPC IPC handler for type-safe RPC
    // Dynamic import to avoid loading electron-trpc at module parse time
    try {
      const { createIPCHandler } = await import('electron-trpc/main');
      createIPCHandler({
        router: appRouter,
        windows: [mainWindow],
      });
      debugLog('[LIFECYCLE] tRPC IPC handler created');
    } catch (trpcError) {
      console.warn('[LIFECYCLE] Failed to create tRPC IPC handler, falling back to legacy IPC:', trpcError);
    }

    // Step 4: Register handlers that need the window reference
    registerChunkingHandlers(mainWindow);
    debugLog('[LIFECYCLE] Chunking handlers registered');

    registerTerraformHandlers(ipcMain, mainWindow);
    debugLog('[LIFECYCLE] Terraform handlers registered');

    // Step 5: Restore HMR state if applicable
    mainProcessHMR.restoreWindowState(mainWindow);

    // Step 6: Initialize HMR for development
    mainProcessHMR.init();
    debugLog('[LIFECYCLE] HMR initialized');

    // Step 7: Initialize error reporter global handlers
    errorReporter.initializeGlobalHandlers(mainWindow);
    debugLog('[LIFECYCLE] Error reporter initialized');

    // Step 8: Start AI model preloading in background
    // This runs asynchronously to avoid blocking app startup
    setMainWindow(mainWindow);
    startAIPreload();
    debugLog('[LIFECYCLE] AI preload started in background');

    debugLog('[LIFECYCLE] Application initialization complete');
  });

  // Handle macOS activate event
  app.on('activate', () => {
    debugLog('[LIFECYCLE] App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({
        onMenuCreate: (win) => createMenu(win),
      });
    }
  });

  // Handle window-all-closed
  app.on('window-all-closed', () => {
    debugLog('[LIFECYCLE] All windows closed');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Handle before-quit for cleanup
  app.on('before-quit', () => {
    debugLog('[LIFECYCLE] App quitting, performing cleanup...');

    // Stop HMR watchers
    mainProcessHMR.stop();

    // Shutdown AI services
    aiService.shutdownAIServices();

    // Close database
    closeDatabase();

    debugLog('[LIFECYCLE] Cleanup complete');
  });
}

/**
 * Initialize AI services (lazy loading)
 * Called on first AI request
 */
export async function initializeAI() {
  try {
    const result = await aiService.initializeAIServices();
    if (result.success) {
      debugLog('[LIFECYCLE] AI services initialized successfully');
    } else {
      console.warn('[LIFECYCLE] AI services initialization failed:', result.error);
    }
    return result;
  } catch (error) {
    console.error('[LIFECYCLE] AI initialization error:', error);
    return { success: false, error: error.message };
  }
}
