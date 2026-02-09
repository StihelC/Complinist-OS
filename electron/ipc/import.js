import { dialog } from 'electron';
import fs from 'fs';

/**
 * Register import IPC handlers
 */
export function registerImportHandlers(ipcMain, mainWindow) {
  ipcMain.handle('import-json', async () => {
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
}

