/**
 * Debug IPC Handlers
 * Provides debug snapshot capabilities for AI-assisted development
 */
import { ipcMain } from 'electron';
import { getMainWindow } from '../modules/window-manager.js';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

/**
 * Register debug-related IPC handlers
 */
export function registerDebugHandlers() {
  /**
   * Capture a debug snapshot including screenshot and application state
   * Returns paths to saved snapshot files
   */
  ipcMain.handle('debug:capture-snapshot', async (_event, stateData) => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not available');
      }

      // Create debug output directory
      const debugDir = path.join(app.getPath('temp'), 'complinist-debug');
      await fs.mkdir(debugDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapshotDir = path.join(debugDir, `snapshot-${timestamp}`);
      await fs.mkdir(snapshotDir, { recursive: true });

      // Capture screenshot
      console.log('[DEBUG] Capturing screenshot...');
      const screenshot = await mainWindow.capturePage();
      const screenshotPath = path.join(snapshotDir, 'screenshot.png');
      await fs.writeFile(screenshotPath, screenshot.toPNG());
      console.log('[DEBUG] Screenshot saved:', screenshotPath);

      // Save application state as JSON
      console.log('[DEBUG] Saving application state...');
      const statePath = path.join(snapshotDir, 'state.json');
      await fs.writeFile(
        statePath,
        JSON.stringify(stateData, null, 2),
        'utf-8'
      );
      console.log('[DEBUG] State saved:', statePath);

      // Create a summary file
      const summaryPath = path.join(snapshotDir, 'summary.txt');
      const summary = [
        'CompliNist Debug Snapshot',
        '=========================',
        `Timestamp: ${new Date().toISOString()}`,
        `Screenshot: screenshot.png`,
        `State Data: state.json`,
        '',
        'State Overview:',
        `- Current Project: ${stateData.currentProject?.name || 'None'}`,
        `- Current View: ${stateData.currentView || 'Unknown'}`,
        `- Total Projects: ${stateData.projects?.length || 0}`,
        `- Nodes Count: ${stateData.topology?.nodes?.length || 0}`,
        `- Edges Count: ${stateData.topology?.edges?.length || 0}`,
        `- AI Service Status: ${stateData.aiService?.isHealthy ? 'Healthy' : 'Unhealthy'}`,
        `- License Status: ${stateData.auth?.isLicensed ? 'Licensed' : 'Unlicensed'}`,
        '',
        'Files in this snapshot:',
        '- screenshot.png: Visual state of the application',
        '- state.json: Complete application state dump',
        '- summary.txt: This file',
      ].join('\n');
      await fs.writeFile(summaryPath, summary, 'utf-8');

      console.log('[DEBUG] Debug snapshot complete:', snapshotDir);

      return {
        success: true,
        snapshotDir,
        screenshotPath,
        statePath,
        summaryPath,
        timestamp,
      };
    } catch (error) {
      console.error('[DEBUG] Failed to capture snapshot:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Get current window information for debugging
   */
  ipcMain.handle('debug:get-window-info', async () => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not available');
      }

      const bounds = mainWindow.getBounds();
      const webContents = mainWindow.webContents;

      return {
        success: true,
        windowInfo: {
          bounds,
          isVisible: mainWindow.isVisible(),
          isMinimized: mainWindow.isMinimized(),
          isMaximized: mainWindow.isMaximized(),
          isFocused: mainWindow.isFocused(),
          url: webContents.getURL(),
          title: mainWindow.getTitle(),
          zoomLevel: webContents.getZoomLevel(),
          zoomFactor: webContents.getZoomFactor(),
        },
      };
    } catch (error) {
      console.error('[DEBUG] Failed to get window info:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * List available debug snapshots
   */
  ipcMain.handle('debug:list-snapshots', async () => {
    try {
      const debugDir = path.join(app.getPath('temp'), 'complinist-debug');

      try {
        const entries = await fs.readdir(debugDir, { withFileTypes: true });
        const snapshots = [];

        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('snapshot-')) {
            const snapshotPath = path.join(debugDir, entry.name);
            const summaryPath = path.join(snapshotPath, 'summary.txt');

            let summary = null;
            try {
              summary = await fs.readFile(summaryPath, 'utf-8');
            } catch {
              // Summary file not found, skip
            }

            const stats = await fs.stat(snapshotPath);
            snapshots.push({
              name: entry.name,
              path: snapshotPath,
              createdAt: stats.birthtime.toISOString(),
              summary,
            });
          }
        }

        // Sort by creation time, newest first
        snapshots.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return {
          success: true,
          snapshots,
          debugDir,
        };
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Debug directory doesn't exist yet
          return {
            success: true,
            snapshots: [],
            debugDir,
          };
        }
        throw error;
      }
    } catch (error) {
      console.error('[DEBUG] Failed to list snapshots:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Open the debug snapshots directory in file explorer
   */
  ipcMain.handle('debug:open-snapshots-dir', async () => {
    try {
      const { shell } = await import('electron');
      const debugDir = path.join(app.getPath('temp'), 'complinist-debug');

      // Create directory if it doesn't exist
      await fs.mkdir(debugDir, { recursive: true });

      await shell.openPath(debugDir);

      return {
        success: true,
        path: debugDir,
      };
    } catch (error) {
      console.error('[DEBUG] Failed to open snapshots directory:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  console.log('[IPC] Debug handlers registered');
}
