/**
 * CompliNist - Main Process Entry Point
 *
 * This file serves as the entry point for the Electron main process.
 * It uses a composition pattern to assemble feature-focused modules:
 *
 * - window-manager.js: Window creation and configuration
 * - menu.js: Application menu handling
 * - database-init.js: Database setup, schema, and migrations
 * - app-lifecycle.js: Application startup, shutdown, and lifecycle events
 * - ipc-registry.js: IPC handler registration (composition of all handlers)
 *
 * Each module has a single responsibility, making the codebase easier to:
 * - Understand: Clear separation of concerns
 * - Test: Isolated modules can be tested independently
 * - Maintain: Changes are localized to specific modules
 * - Extend: New features can be added without modifying core logic
 *
 * @module main
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// Early startup logging - write to file immediately for debugging packaged builds
function earlyLog(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(`[MAIN] ${message}`);

  try {
    // Try multiple locations for early logging
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

earlyLog('=== CompliNist Main Process Starting ===');
earlyLog(`Platform: ${process.platform}`);
earlyLog(`Arch: ${process.arch}`);
earlyLog(`Node: ${process.versions.node}`);
earlyLog(`Electron: ${process.versions.electron}`);
earlyLog(`Process PID: ${process.pid}`);
earlyLog(`CWD: ${process.cwd()}`);
earlyLog(`__dirname: ${import.meta.url}`);

// CRITICAL: Configure sandbox BEFORE any other Electron code runs
// This must be at the very top of the main process for Linux compatibility
// (Ubuntu 23.10+ and other distros with AppArmor user namespace restrictions)
earlyLog('Configuring sandbox switches...');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');
earlyLog('Sandbox switches configured');

earlyLog('Importing app-lifecycle module...');
import { initializeApp } from './modules/app-lifecycle.js';
earlyLog('app-lifecycle module imported successfully');

// Initialize the application
// This orchestrates all module initialization in the correct order:
// 1. Configure app settings (sandbox, security)
// 2. Initialize database (schema, migrations)
// 3. Register IPC handlers
// 4. Create main window with menu
// 5. Setup HMR for development
// 6. Register lifecycle event handlers
earlyLog('Calling initializeApp()...');
try {
  initializeApp();
  earlyLog('initializeApp() called successfully');
} catch (error) {
  earlyLog(`ERROR in initializeApp(): ${error.message}`);
  earlyLog(`Stack: ${error.stack}`);
}
