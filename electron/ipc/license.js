import { dialog } from 'electron';
import { getDatabase } from '../database/index.js';
import fs from 'fs';

/**
 * Register license IPC handlers
 */
export function registerLicenseHandlers(ipcMain, mainWindow) {
  const db = getDatabase();

  ipcMain.handle('license:open-file', async () => {
    console.log('[IPC] license:open-file called');
    try {
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

      // Read the file content
      const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
      console.log('[IPC] License file read successfully');
      
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

  ipcMain.handle('license:save', async (event, { license }) => {
    console.log('[IPC] license:save called');
    try {
      // Clear existing licenses first (single license per app)
      db.prepare('DELETE FROM licenses').run();
      
      // Insert new license
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
      
      console.log('[IPC] License saved successfully');
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to save license:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('license:get', async () => {
    console.log('[IPC] license:get called');
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
    console.log('[IPC] license:clear called');
    try {
      db.prepare('DELETE FROM licenses').run();
      console.log('[IPC] License cleared successfully');
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to clear license:', error);
      return { success: false, error: error.message };
    }
  });
}

