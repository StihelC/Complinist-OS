import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create the main application window
 */
export function createWindow() {
  // Set icon path - use ICO for Windows, PNG for Linux/macOS
  // Use absolute path to ensure it's found
  const buildIconPath = path.resolve(__dirname, '../build');
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
    console.warn(`[WARNING] Icon not found at ${iconPath}`);
    console.warn(`[WARNING] Absolute path: ${path.resolve(iconPath)}`);
    console.warn(`[WARNING] Window will use default icon`);
    // Don't set icon property if file doesn't exist
    iconPath = undefined;
  } else {
    console.log(`[INFO] Using icon: ${iconPath}`);
  }
  
  const windowOptions = {
    width: 1400,
    height: 900,
    show: false, // Don't show until ready
    title: 'CompliNist', // Set window title
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for ESM preload scripts (.mjs)
    },
  };
  
  // Only set icon if it exists
  if (iconPath) {
    windowOptions.icon = iconPath;
  }
  
  const mainWindow = new BrowserWindow(windowOptions);
  
  // Set WMClass and app name for Linux desktop environments (especially KDE)
  if (process.platform === 'linux') {
    mainWindow.setTitle('CompliNist');
    
    // Set app name - important for KDE Plasma
    app.setName('CompliNist');
    
    // For KDE, we can also try setting the window icon after creation
    // KDE sometimes needs the icon set explicitly on the window
    if (iconPath && fs.existsSync(iconPath)) {
      // Set icon on the window object (KDE sometimes needs this)
      mainWindow.setIcon(iconPath);
    }
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Set Content Security Policy
  // In development, allow 'unsafe-eval' for Vite HMR; in production, use stricter CSP
  const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const scriptSrcPolicy = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
    : "script-src 'self' 'unsafe-inline'; ";
  
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
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
  });

  // Handle navigation errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
    if (errorCode === -106) {
      console.error('ERR_CONNECTION_REFUSED - Is Vite dev server running on port 5173?');
    }
  });

  // Load the app
  // In development with HMR, load from Vite dev server
  // Otherwise, load from dist (file system)
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    // Load from Vite dev server (HMR enabled)
    console.log('[INFO] Loading from Vite dev server:', devServerUrl);
    mainWindow.loadURL(devServerUrl);
  } else {
    // Load from file system (production or non-HMR dev)
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // Open dev tools in development mode
  // Also enable in production for debugging (can be disabled later)
  if (process.env.NODE_ENV === 'development' || !app.isPackaged || process.env.ENABLE_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }
  
  // Allow opening dev tools with Ctrl+Shift+I even in production for debugging
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.openDevTools();
    }
  });

  createMenu(mainWindow);
  
  return mainWindow;
}

/**
 * Create and set the application menu
 */
export function createMenu(mainWindow) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          },
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-project');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save');
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as SVG',
              click: () => {
                mainWindow.webContents.send('menu-export-svg');
              },
            },
            {
              label: 'Export as JSON',
              click: () => {
                mainWindow.webContents.send('menu-export-json');
              },
            },
            {
              label: 'Export as PNG',
              click: () => {
                mainWindow.webContents.send('menu-export-png');
              },
            },
          ],
        },
        {
          label: 'Import from JSON',
          click: () => {
            mainWindow.webContents.send('menu-import-json');
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Topology',
      submenu: [
        {
          label: 'Open Topology',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('menu-view-topology');
          },
        },
        { type: 'separator' },
        {
          label: 'Add Device',
          click: () => {
            mainWindow.webContents.send('menu-topology-add-device');
          },
        },
        {
          label: 'Add Boundary',
          click: () => {
            mainWindow.webContents.send('menu-topology-add-boundary');
          },
        },
        { type: 'separator' },
        {
          label: 'Show Device Palette',
          click: () => {
            mainWindow.webContents.send('menu-topology-show-palette');
          },
        },
        {
          label: 'Show Alignment Panel',
          click: () => {
            mainWindow.webContents.send('menu-topology-show-alignment');
          },
        },
      ],
    },
    {
      label: 'HW/SW Inventory',
      accelerator: 'CmdOrCtrl+I',
      click: () => {
        mainWindow.webContents.send('menu-view-inventory');
      },
    },
    {
      label: 'Generate SSP',
      accelerator: 'CmdOrCtrl+G',
      click: () => {
        mainWindow.webContents.send('menu-view-ssp');
      },
    },
    {
      label: 'Control Narratives',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        mainWindow.webContents.send('menu-view-narratives');
      },
    },
    {
      label: 'AI Assistant',
      accelerator: 'CmdOrCtrl+A',
      click: () => {
        mainWindow.webContents.send('menu-view-ai');
      },
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Projects...',
          click: () => {
            mainWindow.webContents.send('menu-projects');
          },
        },
        {
          label: 'AI Status',
          click: () => {
            mainWindow.webContents.send('menu-ai-status');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
            } else {
              mainWindow.webContents.openDevTools();
            }
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'License',
      submenu: [
        {
          label: 'Enter License Key',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send('menu-enter-license');
          },
        },
        {
          label: 'Check License Status',
          click: () => {
            mainWindow.webContents.send('menu-license-status');
          },
        },
        {
          label: 'License Information...',
          click: () => {
            mainWindow.webContents.send('menu-license-info');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

