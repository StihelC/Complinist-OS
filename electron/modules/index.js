/**
 * Electron Modules - Index
 *
 * This module provides a single entry point to all feature-focused modules
 * in the Electron main process. Each module has a clear responsibility:
 *
 * - window-manager: Window creation and lifecycle
 * - menu: Application menu handling
 * - database-init: Database setup and migrations
 * - app-lifecycle: Application startup/shutdown orchestration
 * - ipc-registry: IPC handler registration
 */

// Window Management
export {
  createWindow,
  getMainWindow,
  focusOrCreateWindow,
} from './window-manager.js';

// Menu Handling
export { createMenu } from './menu.js';

// Database Initialization
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  syncDevicesToTable,
  enrichNodesWithDeviceMetadata,
  extractDeviceMetadata,
} from './database-init.js';

// Application Lifecycle
export {
  configureApp,
  initializeApp,
  initializeAI,
} from './app-lifecycle.js';

// IPC Handler Registry
export { registerAllIPCHandlers } from './ipc-registry.js';
