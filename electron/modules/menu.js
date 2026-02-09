/**
 * Menu Module
 * Handles creation and configuration of the application menu
 */
import { app, Menu } from 'electron';

// Debug logging - only logs in development mode
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG;
const debugLog = (...args) => { if (isDev) console.log(...args); };

/**
 * Create and set the application menu
 * @param {BrowserWindow} mainWindow - The main application window
 */
export function createMenu(mainWindow) {
  const template = [
    createFileMenu(mainWindow),
    createEditMenu(mainWindow),
    createViewMenu(),
    createLicenseMenu(mainWindow),
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  debugLog('[MENU] Application menu created');
}

/**
 * Create the File menu
 * @param {BrowserWindow} mainWindow
 * @returns {Object} Menu template
 */
function createFileMenu(mainWindow) {
  return {
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
      createExportSubmenu(mainWindow),
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
  };
}

/**
 * Create the Export submenu
 * @param {BrowserWindow} mainWindow
 * @returns {Object} Submenu template
 */
function createExportSubmenu(mainWindow) {
  return {
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
  };
}

/**
 * Create the Edit menu
 * @param {BrowserWindow} mainWindow
 * @returns {Object} Menu template
 */
function createEditMenu(mainWindow) {
  return {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('menu-undo');
          }
        },
      },
      {
        label: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('menu-redo');
          }
        },
      },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { type: 'separator' },
      { role: 'selectAll' },
    ],
  };
}

/**
 * Create the View menu
 * @returns {Object} Menu template
 */
function createViewMenu() {
  return {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };
}

/**
 * Create the License menu
 * @param {BrowserWindow} mainWindow
 * @returns {Object} Menu template
 */
function createLicenseMenu(mainWindow) {
  return {
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
  };
}
