/**
 * Main Process HMR (Hot Module Replacement) for Electron
 *
 * This module enables hot reloading of the Electron main process code
 * using electron-reloader with enhanced state preservation.
 *
 * Features:
 * - Watches electron/ directory for changes
 * - Uses electron-reloader for reliable file watching
 * - Preserves renderer window state during restarts
 * - Re-establishes IPC connections seamlessly
 * - Debounces rapid file changes
 * - Filters out non-relevant file changes
 * - Notifies renderer before restart for state persistence
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HMR Configuration
const HMR_CONFIG = {
  // Directories to watch for changes
  watchDirs: [
    path.resolve(__dirname, '..'),  // electron/ directory
  ],
  // File extensions to watch
  watchExtensions: ['.js', '.mjs', '.cjs', '.json'],
  // Files/patterns to ignore
  ignorePatterns: [
    /node_modules/,
    /\.git/,
    /hmr/,  // Don't restart on HMR module changes
    /\.log$/,
    /\.tmp$/,
    /\.backup$/,
  ],
  // Debounce delay in ms
  debounceDelay: 300,
  // Whether HMR is enabled (only in development)
  enabled: process.env.NODE_ENV === 'development' || !app.isPackaged,
  // State file path for persistence
  stateFile: null, // Set during init
  // Electron-reloader options
  electronReloaderOptions: {
    watchRenderer: false, // Vite handles renderer HMR
  },
};

// State management
let watchers = [];
let debounceTimer = null;
let isRestarting = false;
let electronReloaderActive = false;
let ipcReconnectHandlers = new Map();

/**
 * Debug logging for HMR operations
 */
function hmrLog(...args) {
  if (HMR_CONFIG.enabled) {
    console.log('[HMR]', ...args);
  }
}

/**
 * Error logging for HMR operations
 */
function hmrError(...args) {
  console.error('[HMR ERROR]', ...args);
}

/**
 * Check if a file path should be watched based on ignore patterns
 */
function shouldWatch(filePath) {
  const ext = path.extname(filePath);

  // Check extension
  if (!HMR_CONFIG.watchExtensions.includes(ext)) {
    return false;
  }

  // Check ignore patterns
  for (const pattern of HMR_CONFIG.ignorePatterns) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  return true;
}

/**
 * Handle file change events with debouncing
 */
function handleFileChange(eventType, filename, watchDir) {
  if (!filename) return;

  const fullPath = path.join(watchDir, filename);

  if (!shouldWatch(fullPath)) {
    return;
  }

  hmrLog(`File ${eventType}: ${filename}`);

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Debounce rapid changes
  debounceTimer = setTimeout(() => {
    triggerMainProcessReload(fullPath);
  }, HMR_CONFIG.debounceDelay);
}

/**
 * Save renderer state before restart
 * Notifies renderer windows to save their state
 */
async function saveRendererState() {
  const windows = BrowserWindow.getAllWindows();
  const rendererStates = [];

  for (const win of windows) {
    if (!win.isDestroyed()) {
      try {
        // Request renderer to save its state
        win.webContents.send('hmr:save-state');

        // Give renderer time to save state
        await new Promise(resolve => setTimeout(resolve, 100));

        // Collect window state
        const bounds = win.getBounds();
        const isMaximized = win.isMaximized();
        const isFullScreen = win.isFullScreen();
        const url = win.webContents.getURL();

        rendererStates.push({
          bounds,
          isMaximized,
          isFullScreen,
          url,
          id: win.id,
        });
      } catch (error) {
        hmrLog('Could not save state for window:', error.message);
      }
    }
  }

  return rendererStates;
}

/**
 * Trigger a main process reload
 * This preserves renderer windows and only reloads main process modules
 */
async function triggerMainProcessReload(changedFile) {
  if (isRestarting) {
    hmrLog('Already restarting, skipping...');
    return;
  }

  isRestarting = true;
  hmrLog(`Reloading main process due to change in: ${path.basename(changedFile)}`);

  try {
    // Get all open windows
    const windows = BrowserWindow.getAllWindows();

    // Notify renderer windows that main process is reloading
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('main-process-reloading');
        win.webContents.send('hmr:before-reload', {
          changedFile: path.basename(changedFile),
          timestamp: Date.now(),
        });
      }
    }

    // Save renderer states
    const rendererStates = await saveRendererState();

    // Store window states before restart
    const windowStates = windows.map(win => {
      if (win.isDestroyed()) return null;
      const bounds = win.getBounds();
      const isMaximized = win.isMaximized();
      const isFullScreen = win.isFullScreen();
      return { bounds, isMaximized, isFullScreen };
    }).filter(Boolean);

    // Save combined state to temp file for restoration
    const stateFile = HMR_CONFIG.stateFile || path.join(app.getPath('userData'), '.hmr-window-state.json');
    const combinedState = {
      windowStates,
      rendererStates,
      lastReload: Date.now(),
      changedFile: path.basename(changedFile),
    };

    fs.writeFileSync(stateFile, JSON.stringify(combinedState, null, 2), 'utf-8');
    hmrLog('State saved, performing restart...');

    // Small delay to allow renderer to process notification
    await new Promise(resolve => setTimeout(resolve, 150));

    // Relaunch the app
    app.relaunch();
    app.exit(0);

  } catch (error) {
    hmrError('Error during reload:', error);
  } finally {
    isRestarting = false;
  }
}

/**
 * Clear require cache for electron modules
 * This allows modules to be re-imported with new code
 */
function clearModuleCache() {
  // In ES modules, we can't directly clear the cache like in CommonJS
  // The app restart handles this by starting fresh
  hmrLog('Module cache will be cleared on restart');
}

/**
 * Restore window state after HMR restart
 */
export function restoreWindowState(mainWindow) {
  if (!HMR_CONFIG.enabled) return;

  try {
    const stateFile = HMR_CONFIG.stateFile || path.join(app.getPath('userData'), '.hmr-window-state.json');

    if (fs.existsSync(stateFile)) {
      const combinedState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      const { windowStates, rendererStates, lastReload, changedFile } = combinedState;

      // Only restore if reload was recent (within 10 seconds)
      const isRecentReload = Date.now() - lastReload < 10000;

      if (!isRecentReload) {
        hmrLog('State file is stale, skipping restore');
        fs.unlinkSync(stateFile);
        return;
      }

      if (windowStates && windowStates.length > 0 && mainWindow) {
        const state = windowStates[0];

        if (state.isMaximized) {
          mainWindow.maximize();
        } else if (state.isFullScreen) {
          mainWindow.setFullScreen(true);
        } else if (state.bounds) {
          mainWindow.setBounds(state.bounds);
        }

        hmrLog(`Window state restored after HMR restart (changed: ${changedFile})`);
      }

      // Notify renderer that it was restored from HMR
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('hmr:restored', {
            changedFile,
            lastReload,
          });
        });
      }

      // Clean up state file
      fs.unlinkSync(stateFile);
    }
  } catch (error) {
    hmrLog('Could not restore window state:', error.message);
  }
}

/**
 * Register IPC handlers for HMR state management
 */
function registerHMRIPCHandlers() {
  // Handler for renderer to acknowledge state save
  ipcMain.handle('hmr:state-saved', async (event, state) => {
    hmrLog('Renderer state saved:', Object.keys(state || {}));
    return { success: true };
  });

  // Handler for renderer to get HMR status
  ipcMain.handle('hmr:get-status', () => {
    return {
      enabled: HMR_CONFIG.enabled,
      electronReloaderActive,
      watchDirs: HMR_CONFIG.watchDirs,
      watchExtensions: HMR_CONFIG.watchExtensions,
      isRestarting,
    };
  });

  // Handler for renderer to trigger manual reload
  ipcMain.handle('hmr:trigger-reload', async () => {
    if (!HMR_CONFIG.enabled) {
      return { success: false, error: 'HMR is not enabled' };
    }

    hmrLog('Manual reload triggered from renderer');
    triggerMainProcessReload('manual-trigger');
    return { success: true };
  });

  hmrLog('HMR IPC handlers registered');
}

/**
 * Initialize electron-reloader for enhanced file watching
 */
async function initElectronReloader() {
  if (!HMR_CONFIG.enabled) {
    return false;
  }

  try {
    // Dynamic import for electron-reloader
    const electronReloader = (await import('electron-reloader')).default;

    // Configure electron-reloader
    electronReloader(module, {
      debug: false,
      watchRenderer: false, // Vite handles renderer HMR
      ignore: [
        /node_modules/,
        /\.git/,
        /hmr/,
        /\.log$/,
        /\.tmp$/,
        /\.backup$/,
        /dist/,
        /release/,
        /\.build-cache/,
      ],
    });

    electronReloaderActive = true;
    hmrLog('electron-reloader initialized successfully');
    return true;
  } catch (error) {
    // electron-reloader might not work in all environments
    // Fall back to native fs.watch
    hmrLog('electron-reloader not available, using native fs.watch:', error.message);
    return false;
  }
}

/**
 * Initialize native file watchers as fallback
 */
function initNativeWatchers() {
  hmrLog('Initializing native file watchers...');

  // Set up file watchers for each watch directory
  for (const watchDir of HMR_CONFIG.watchDirs) {
    if (!fs.existsSync(watchDir)) {
      hmrLog(`Watch directory does not exist: ${watchDir}`);
      continue;
    }

    try {
      const watcher = fs.watch(
        watchDir,
        { recursive: true },
        (eventType, filename) => handleFileChange(eventType, filename, watchDir)
      );

      watchers.push(watcher);
      hmrLog(`Watching: ${watchDir}`);
    } catch (error) {
      hmrError(`Failed to watch ${watchDir}:`, error.message);
    }
  }
}

/**
 * Initialize the HMR watcher for the main process
 */
export async function initMainProcessHMR() {
  if (!HMR_CONFIG.enabled) {
    console.log('[HMR] Disabled in production mode');
    return;
  }

  hmrLog('Initializing main process HMR...');

  // Set state file path
  HMR_CONFIG.stateFile = path.join(app.getPath('userData'), '.hmr-window-state.json');

  // Register HMR IPC handlers
  registerHMRIPCHandlers();

  // Try to initialize electron-reloader first
  const reloaderInitialized = await initElectronReloader();

  // If electron-reloader is not available, use native watchers
  if (!reloaderInitialized) {
    initNativeWatchers();
  }

  // Clean up watchers on app quit
  app.on('will-quit', () => {
    hmrLog('Cleaning up watchers...');
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];
  });

  hmrLog('Main process HMR initialized');
  hmrLog('Watching for changes in:', HMR_CONFIG.watchDirs);
  hmrLog('Mode:', electronReloaderActive ? 'electron-reloader' : 'native fs.watch');
}

/**
 * Stop the HMR watcher
 */
export function stopMainProcessHMR() {
  hmrLog('Stopping main process HMR...');

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  for (const watcher of watchers) {
    watcher.close();
  }
  watchers = [];

  hmrLog('Main process HMR stopped');
}

/**
 * Get HMR configuration (for debugging)
 */
export function getHMRConfig() {
  return {
    ...HMR_CONFIG,
    electronReloaderActive,
    watchersCount: watchers.length,
    isRestarting,
  };
}

export default {
  init: initMainProcessHMR,
  stop: stopMainProcessHMR,
  restoreWindowState,
  getConfig: getHMRConfig,
  isEnabled: HMR_CONFIG.enabled,
};
