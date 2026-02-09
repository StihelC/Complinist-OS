/**
 * Window Management Module
 * Handles creation and configuration of the main application window
 */
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug logging - only logs in development mode
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG;
const debugLog = (...args) => { if (isDev) console.log(...args); };

// Startup log file - always writes to help debug packaged builds
let startupLogPath = null;
function getStartupLogPath() {
  if (!startupLogPath) {
    try {
      const userDataPath = app.getPath('userData');
      startupLogPath = path.join(userDataPath, 'startup.log');
    } catch {
      // App not ready yet, use temp directory
      startupLogPath = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'complinist-startup.log');
    }
  }
  return startupLogPath;
}

// Always log to startup file (for debugging packaged builds)
function startupLog(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;

  // Always log to console
  console.log(...args);

  // Also write to file for packaged builds
  try {
    const logPath = getStartupLogPath();
    fs.appendFileSync(logPath, message);
  } catch (err) {
    // Silently fail if we can't write to log
  }
}

// Clear startup log on new launch
function clearStartupLog() {
  try {
    const logPath = getStartupLogPath();
    const header = `=== CompliNist Startup Log ===\nStarted: ${new Date().toISOString()}\nPlatform: ${process.platform}\nArch: ${process.arch}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nPackaged: ${app.isPackaged}\nUserData: ${app.getPath('userData')}\n${'='.repeat(40)}\n\n`;
    fs.writeFileSync(logPath, header);
  } catch (err) {
    console.error('[WINDOW] Failed to clear startup log:', err);
  }
}

// Reference to the main window (singleton)
let mainWindow = null;

/**
 * Get the current main window instance
 * @returns {BrowserWindow|null}
 */
export function getMainWindow() {
  return mainWindow;
}

/**
 * Create the main application window
 * @param {Object} options - Window creation options
 * @param {Function} options.onMenuCreate - Callback to create the application menu
 * @returns {BrowserWindow}
 */
export function createWindow(options = {}) {
  // Clear and initialize startup log for this launch
  clearStartupLog();
  startupLog('[WINDOW] Creating main window...');
  startupLog('[WINDOW] __dirname:', __dirname);
  startupLog('[WINDOW] process.cwd():', process.cwd());
  startupLog('[WINDOW] app.isPackaged:', app.isPackaged);
  startupLog('[WINDOW] app.getAppPath():', app.getAppPath());

  // Set icon path - use ICO for Windows, PNG for Linux/macOS
  // Calculate path relative to __dirname (electron/modules/)
  // Path should be: ../../build/icon.png (Linux) or ../../build/icon.ico (Windows)
  const buildIconPath = path.resolve(__dirname, '../../build');
  let iconPath;

  if (process.platform === 'win32') {
    iconPath = path.join(buildIconPath, 'icon.ico');
  } else {
    // Linux and macOS prefer PNG for window icons
    iconPath = path.join(buildIconPath, 'icon.png');
    // Fallback to ICO if PNG doesn't exist
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(buildIconPath, 'icon.ico');
    }
  }

  // Ensure icon exists, log if not found
  if (!fs.existsSync(iconPath)) {
    startupLog(`[WINDOW] Icon not found at ${iconPath}`);
    startupLog(`[WINDOW] Absolute path: ${path.resolve(iconPath)}`);
    startupLog(`[WINDOW] Window will use default icon`);
    // Don't set icon property if file doesn't exist
    iconPath = undefined;
  } else {
    startupLog(`[WINDOW] Using icon: ${iconPath}`);
  }

  const preloadPath = path.join(__dirname, '../preload.mjs');
  
  const windowOptions = {
    width: 1400,
    height: 900,
    show: false, // Don't show until ready
    title: 'CompliNist', // Set window title
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for ESM preload scripts (.mjs)
      // Disable webSecurity to allow ES modules to load from file:// protocol
      // ES modules require CORS, and file:// URLs are considered cross-origin
      // This is safe because we only load local files from the app bundle
      webSecurity: false,
    },
  };
  
  // Only set icon if it exists
  if (iconPath) {
    windowOptions.icon = iconPath;
  }
  
  mainWindow = new BrowserWindow(windowOptions);
  
  // For Linux, explicitly set the icon after window creation
  // Some desktop environments (especially KDE) need the icon set explicitly
  if (process.platform === 'linux' && iconPath && fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
    debugLog('[WINDOW] Set icon explicitly for Linux:', iconPath);
  }  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    startupLog('[WINDOW] ready-to-show event fired, showing window');
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle navigation errors with better error messages
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    startupLog('[WINDOW] Failed to load:', validatedURL, errorCode, errorDescription);
    if (errorCode === -106) {
      startupLog('[WINDOW] ERR_CONNECTION_REFUSED - Is Vite dev server running on port 5173?');
    } else if (errorCode === -6) {
      startupLog('[WINDOW] ERR_FILE_NOT_FOUND - File may be locked by build process');
      startupLog('[WINDOW] This usually happens when vite build --watch is rebuilding');
      startupLog('[WINDOW] The app will auto-retry...');
    }
  });

  // Track when DOM is ready
  mainWindow.webContents.once('dom-ready', () => {
    const url = mainWindow.webContents.getURL();
    startupLog('[WINDOW] DOM ready, URL:', url);
    
    // Inject error tracking into the page to catch JavaScript errors
    mainWindow.webContents.executeJavaScript(`
      (function() {
        window.errors = [];
        window.addEventListener('error', (e) => {
          const error = {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            error: e.error ? e.error.toString() : null,
            stack: e.error && e.error.stack ? e.error.stack : null
          };
          window.errors.push(error);
          console.error('[PAGE ERROR]', error);
        });
        window.addEventListener('unhandledrejection', (e) => {
          const error = {
            type: 'unhandledrejection',
            reason: e.reason ? e.reason.toString() : String(e.reason),
            stack: e.reason && e.reason.stack ? e.reason.stack : null
          };
          window.errors.push(error);
          console.error('[PAGE UNHANDLED REJECTION]', error);
        });
        console.log('[PAGE] Error tracking initialized');
      })();
    `).catch(err => {
      console.error('[WINDOW] Failed to inject error tracking:', err);
    });  });

  // Track console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const messageStr = String(message);
    const source = sourceId ? String(sourceId) : 'unknown';
    // Log errors and warnings for debugging
    if (level === 2) { // error
      console.error(`[RENDERER ERROR] ${source}:${line || '?'}`, messageStr);
    } else if (level === 1) { // warning
      console.warn(`[RENDERER WARN] ${source}:${line || '?'}`, messageStr);
    } else {
      // Log all console messages in dev mode
      debugLog(`[RENDERER LOG] ${source}:${line || '?'}`, messageStr);
    }  });

  // Track renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    startupLog('[WINDOW] Renderer process crashed:', details);
  });

  // Track when page finishes loading (or fails)
  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    startupLog('[WINDOW] ========== PAGE LOADED ==========');
    startupLog('[WINDOW] URL:', url);
    startupLog('[WINDOW] Protocol:', url.startsWith('file://') ? 'file://' : url.startsWith('http://') ? 'http://' : 'other');
    
    // Check if page actually has content - wait a bit for React to mount
    setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const root = document.getElementById('root');
          const body = document.body;
          const head = document.head;
          return {
            rootExists: !!root,
            rootInnerHTML: root ? root.innerHTML.length : 0,
            bodyExists: !!body,
            bodyInnerHTML: body ? body.innerHTML.length : 0,
            headScripts: head ? head.querySelectorAll('script').length : 0,
            bodyScripts: body ? body.querySelectorAll('script').length : 0,
            allErrors: window.errors || [],
            hasReact: typeof React !== 'undefined',
            hasReactDOM: typeof ReactDOM !== 'undefined',
            title: document.title
          };
        })()
      `).then((result) => {
        startupLog('[WINDOW] Page content check:', JSON.stringify(result, null, 2));
        if (!result.rootExists) {
          startupLog('[WINDOW] ERROR: Root element (#root) not found!');
        }
        if (result.rootInnerHTML === 0) {
          startupLog('[WINDOW] ERROR: Root element exists but is empty - React may not have mounted');
        }
        if (!result.bodyExists) {
          startupLog('[WINDOW] ERROR: Body element not found!');
        }
        if (result.allErrors && result.allErrors.length > 0) {
          startupLog('[WINDOW] JavaScript errors detected:', result.allErrors);
        }
        startupLog('[WINDOW] ========== STARTUP COMPLETE ==========');
      }).catch((err) => {
        startupLog('[WINDOW] Error checking page content:', err.message);
      });
    }, 2000); // Wait 2 seconds for React to mount
  });

  // Track when page starts loading
  mainWindow.webContents.on('did-start-loading', () => {
    const url = mainWindow.webContents.getURL();
    startupLog('[WINDOW] Page started loading:', url || 'about:blank');
  });

  // Set Content Security Policy
  // Note: CSP headers via webRequest.onHeadersReceived only apply to HTTP/HTTPS requests
  // For file:// protocol, webSecurity: false is used (already set above for non-packaged apps)
  // In development, allow 'unsafe-eval' for Vite HMR; in production, use stricter CSP
  const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const scriptSrcPolicy = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
    : "script-src 'self' 'unsafe-inline'; ";
  
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Only set CSP for HTTP/HTTPS requests (not file://)
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            scriptSrcPolicy +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:*"
          ]
        }
      });
    } else {
      // For file:// protocol, just pass through (webSecurity already disabled in dev)
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  // Load the app with retry logic
  loadAppWithRetry();

  // Create menu if callback provided
  if (options.onMenuCreate) {
    options.onMenuCreate(mainWindow);
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Detect if Vite dev server is running on localhost:5173
 * @returns {Promise<boolean>} True if dev server is accessible
 */
async function detectDevServer() {
  try {
    // Check if fetch is available (Node.js 18+ or Electron with fetch polyfill)
    if (typeof fetch === 'undefined') {
      debugLog('[WINDOW] fetch API not available, skipping dev server detection');
      return false;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch('http://localhost:5173', {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const isAvailable = response.ok;
    
    if (isAvailable) {
      debugLog('[WINDOW] Vite dev server detected on http://localhost:5173');
    }
    
    return isAvailable;
  } catch (error) {
    // Dev server not available - this is expected in many cases
    // Errors can occur if: server not running, fetch not available, network issues, etc.
    if (error.name !== 'AbortError') {
      debugLog('[WINDOW] Dev server detection error (expected if server not running):', error.message);
    }
    debugLog('[WINDOW] Vite dev server not detected, will use built files');
    return false;
  }
}

/**
 * Load the app with retry logic to handle race conditions
 * where vite build --watch is rebuilding the file
 */
async function loadAppWithRetry() {
  startupLog('[WINDOW] loadAppWithRetry() starting...');
  let loadRetries = 0;
  const maxRetries = 5;
  const retryDelay = 1000; // 1 second

  const loadApp = async () => {
    // First check if VITE_DEV_SERVER_URL is explicitly set
    let devServerUrl = process.env.VITE_DEV_SERVER_URL;

    // If not set, try to auto-detect if dev server is running
    if (!devServerUrl && !app.isPackaged) {
      const isDevServerRunning = await detectDevServer();
      if (isDevServerRunning) {
        devServerUrl = 'http://localhost:5173';
        startupLog('[WINDOW] Auto-detected Vite dev server, using:', devServerUrl);
      }
    }

    try {
      if (devServerUrl) {
        // Load from Vite dev server (HMR enabled)
        startupLog('[WINDOW] ========== LOADING FROM DEV SERVER ==========');
        startupLog('[WINDOW] Dev server URL:', devServerUrl);
        startupLog('[WINDOW] Auto-detected:', !process.env.VITE_DEV_SERVER_URL ? 'YES' : 'NO');
        await mainWindow.loadURL(devServerUrl);
        const loadedUrl = mainWindow.webContents.getURL();
        startupLog('[WINDOW] Actually loaded URL:', loadedUrl);
        startupLog('[WINDOW] Successfully loaded from Vite dev server');
        return;
      }

      // Load from file system (production or non-HMR dev)
      // Calculate path: __dirname is electron/modules/, go up to project root, then to dist
      // This matches the structure: project_root/electron/modules/window-manager.js
      // So: ../../dist/index.html from electron/modules/ = project_root/dist/index.html
      const htmlPath = path.join(__dirname, '../../dist/index.html');
      const absPath = path.resolve(htmlPath);
      const distDir = path.dirname(absPath);

      startupLog('[WINDOW] Attempting to load from file system');
      startupLog('[WINDOW] HTML path:', absPath);
      startupLog('[WINDOW] Dist directory:', distDir);
      startupLog('[WINDOW] Dist directory exists:', fs.existsSync(distDir));
      startupLog('[WINDOW] Current working directory:', process.cwd());

      // List contents of dist directory if it exists
      if (fs.existsSync(distDir)) {
        try {
          const distContents = fs.readdirSync(distDir);
          startupLog('[WINDOW] Dist directory contents:', distContents);
          const assetsDir = path.join(distDir, 'assets');
          if (fs.existsSync(assetsDir)) {
            const assetsContents = fs.readdirSync(assetsDir);
            startupLog('[WINDOW] Assets directory contents:', assetsContents.slice(0, 10), assetsContents.length > 10 ? `... and ${assetsContents.length - 10} more` : '');
          }
        } catch (listErr) {
          startupLog('[WINDOW] Could not list dist contents:', listErr.message);
        }
      }

      // Check if dist directory exists
      if (!fs.existsSync(distDir)) {
        const errorMsg = `Dist directory does not exist: ${distDir}. Please run 'npm run build' first.`;
        startupLog(`[WINDOW] ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Check if file exists before trying to load
      if (!fs.existsSync(absPath)) {
        const errorMsg = `File does not exist: ${absPath}. Please run 'npm run build' first.`;
        startupLog(`[WINDOW] ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Use absolute path - loadFile() accepts absolute paths
      startupLog('[WINDOW] ========== LOADING FROM FILE SYSTEM ==========');
      startupLog('[WINDOW] File path:', absPath);
      startupLog('[WINDOW] File exists:', fs.existsSync(absPath));

      // Check if main JS file exists
      const htmlContent = fs.readFileSync(absPath, 'utf-8');
      startupLog('[WINDOW] HTML content length:', htmlContent.length);
      const mainScriptMatch = htmlContent.match(/src="\.\/assets\/([^"]+)"/);
      if (mainScriptMatch) {
        const mainScriptFile = path.join(distDir, 'assets', mainScriptMatch[1]);
        startupLog('[WINDOW] Main script file:', mainScriptFile);
        startupLog('[WINDOW] Main script exists:', fs.existsSync(mainScriptFile));
        if (!fs.existsSync(mainScriptFile)) {
          throw new Error(`Main script file does not exist: ${mainScriptFile}. The build may be incomplete.`);
        }
      } else {
        startupLog('[WINDOW] WARNING: Could not find main script reference in HTML');
      }

      await mainWindow.loadFile(absPath);
      const loadedUrl = mainWindow.webContents.getURL();
      startupLog('[WINDOW] Actually loaded URL:', loadedUrl);
      startupLog('[WINDOW] Expected to be file:// protocol');
      startupLog('[WINDOW] Successfully loaded index.html from file system');
    } catch (error) {
      loadRetries++;
      startupLog(`[WINDOW] Failed to load app (attempt ${loadRetries}/${maxRetries}):`, error.message);
      if (error.stack) {
        startupLog('[WINDOW] Error stack:', error.stack.substring(0, 500));
      }

      if (loadRetries < maxRetries) {
        startupLog(`[WINDOW] Retrying in ${retryDelay}ms... (file may be locked by build process)`);
        setTimeout(loadApp, retryDelay);
      } else {
        const htmlPath = path.join(__dirname, '../../dist/index.html');
        const absPath = path.resolve(htmlPath);
        const fileExists = fs.existsSync(absPath);

        startupLog('[WINDOW] ========== LOAD ERROR SUMMARY ==========');
        startupLog('[WINDOW] Max retries reached. Unable to load app.');
        startupLog('[WINDOW] Attempted load type:', devServerUrl ? 'dev server' : 'file system');
        if (!devServerUrl) {
          startupLog('[WINDOW] File path:', absPath);
          startupLog('[WINDOW] File exists:', fileExists);
        } else {
          startupLog('[WINDOW] Dev server URL:', devServerUrl);
        }
        startupLog('[WINDOW] Error:', error.message);
        startupLog('[WINDOW] =========================================');
        startupLog('[WINDOW] Troubleshooting steps:');
        if (!devServerUrl) {
          startupLog('[WINDOW] 1. Ensure dist/index.html exists: npm run build');
        } else {
          startupLog('[WINDOW] 1. Check if Vite dev server is running on http://localhost:5173');
        }
        startupLog('[WINDOW] 2. Check startup.log in AppData for details');
        startupLog('[WINDOW] 3. Try using: npm run electron:dev:hmr');
      }
    }
  };

  // Start loading with retry logic
  await loadApp();
}

/**
 * Focus the main window or create a new one if it doesn't exist
 * @param {Object} options - Window creation options
 * @returns {BrowserWindow}
 */
export function focusOrCreateWindow(options = {}) {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return mainWindow;
  }
  return createWindow(options);
}
