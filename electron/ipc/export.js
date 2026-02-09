import { app, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { validateDialogPath, validateWritePath, PathSecurityError } from '../utils/path-security.js';

/**
 * Register export IPC handlers
 */
export function registerExportHandlers(ipcMain, mainWindow) {
  ipcMain.handle('export-json', async (event, data) => {
    console.log('[ELECTRON] ========================================');
    console.log('[ELECTRON] export-json handler called - VERSION 2.0');
    console.log('[ELECTRON] Platform:', process.platform);
    console.log('[ELECTRON] Received data:', {
      hasData: !!data,
      hasReportData: !!(data && data.reportData),
      projectName: data?.projectName,
      reportDataType: data?.reportData ? typeof data.reportData : 'undefined',
    });

    try {
      if (!data || !data.reportData) {
        console.error('[ELECTRON] Invalid export data:', {
          hasData: !!data,
          hasReportData: !!(data && data.reportData),
          dataKeys: data ? Object.keys(data) : [],
        });
        return { success: false, error: 'Invalid export data: missing reportData' };
      }

      // Show save dialog on all platforms
      console.log('[ELECTRON] Opening save dialog...');
      const dialogResult = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagram as JSON',
        defaultPath: `${data.projectName || 'diagram'}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      console.log('[ELECTRON] Dialog result:', dialogResult);
      
      const canceled = dialogResult.canceled;
      const filePath = dialogResult.filePath;

      console.log('[ELECTRON] Final file path decision:', {
        canceled,
        hasFilePath: !!filePath,
        filePath,
      });

      if (canceled || !filePath) {
        console.log('[ELECTRON] Export canceled by user or no file path');
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path
      let validatedFilePath;
      try {
        validatedFilePath = validateDialogPath(filePath);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[ELECTRON] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      // Test serialization before writing
      console.log('[ELECTRON] Testing JSON serialization...');
      let jsonString;
      try {
        jsonString = JSON.stringify(data.reportData, null, 2);
        console.log('[ELECTRON] Serialization successful, size:', jsonString.length, 'bytes');
      } catch (serializationError) {
        console.error('[ELECTRON] JSON serialization error:', serializationError);
        console.error('[ELECTRON] Serialization error details:', {
          message: serializationError.message,
          stack: serializationError.stack,
        });
        return { 
          success: false, 
          error: `Failed to serialize data: ${serializationError.message}` 
        };
      }

      // Write file
      console.log('[ELECTRON] Writing file to:', validatedFilePath);
      try {
        fs.writeFileSync(validatedFilePath, jsonString, 'utf-8');
        const stats = fs.statSync(validatedFilePath);
        console.log('[ELECTRON] File written successfully:', {
          path: validatedFilePath,
          size: stats.size,
          bytes: stats.size,
        });
        return { success: true, filePath: validatedFilePath };
      } catch (writeError) {
        console.error('[ELECTRON] File write error:', writeError);
        console.error('[ELECTRON] Write error details:', {
          message: writeError.message,
          code: writeError.code,
          stack: writeError.stack,
        });
        return { 
          success: false, 
          error: `Failed to write file: ${writeError.message}` 
        };
      }
    } catch (error) {
      console.error('[ELECTRON] Unexpected error in export-json handler:', error);
      console.error('[ELECTRON] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return { 
        success: false, 
        error: error.message || 'Unknown error during export' 
      };
    }
  });

  ipcMain.handle('export-png', async (event, data) => {
    try {
      console.log('Export PNG called with project name:', data.projectName);
      console.log('Image data length:', data.imageData ? data.imageData.length : 'undefined');

      // Linux dialog workaround: Save directly to Downloads folder with timestamp
      // to avoid dialog issues on certain desktop environments
      const downloadsPath = app.getPath('downloads');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      // Sanitize project name to prevent path traversal via filename
      const safeProjectName = (data.projectName || 'diagram').replace(/[\/\\\.]+/g, '_');
      const fileName = `${safeProjectName}-${timestamp}.png`;
      const filePath = path.join(downloadsPath, fileName);

      // Validate the constructed path
      let validatedFilePath;
      try {
        validatedFilePath = validateWritePath(filePath);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[export-png] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      console.log('Saving directly to:', validatedFilePath);

      // Data URL comes from the renderer process (format: data:image/png;base64,...)
      const base64Data = data.imageData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      console.log('Buffer size:', buffer.length, 'bytes');

      fs.writeFileSync(validatedFilePath, buffer);
      console.log('File written successfully');

      return { success: true, filePath: validatedFilePath };
    } catch (error) {
      console.error('Error exporting PNG:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-svg', async (event, data) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagram as SVG',
        defaultPath: `${data.projectName || 'diagram'}.svg`,
        filters: [
          { name: 'SVG Images', extensions: ['svg'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path
      let validatedFilePath;
      try {
        validatedFilePath = validateDialogPath(filePath);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[export-svg] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      // Accept either svgContent (string) or imageData (base64)
      let svgData;
      if (data.svgContent) {
        // Direct SVG content string
        svgData = data.svgContent;
      } else if (data.imageData) {
        // Legacy: base64-encoded SVG
        const base64Data = data.imageData.replace(/^data:image\/svg\+xml;base64,/, '');
        svgData = Buffer.from(base64Data, 'base64').toString('utf8');
      } else {
        throw new Error('No SVG data provided');
      }

      fs.writeFileSync(validatedFilePath, svgData, 'utf8');
      return { success: true, filePath: validatedFilePath };
    } catch (error) {
      console.error('Error exporting SVG:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-png-from-svg', async (event, data) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagram as PNG',
        defaultPath: `${data.projectName || 'diagram'}.png`,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path
      let validatedFilePath;
      try {
        validatedFilePath = validateDialogPath(filePath);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[export-png-from-svg] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      const { svgContent, width, height } = data;
      
      // Create a hidden window to render the SVG
      const hiddenWindow = new BrowserWindow({
        width: width || 2400,
        height: height || 1800,
        show: false,
        webPreferences: {
          offscreen: true,
        }
      });

      // Create an HTML page with the SVG and white background
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              * { margin: 0; padding: 0; }
              body { 
                background: white;
                width: ${width || 2400}px;
                height: ${height || 1800}px;
                overflow: hidden;
              }
              svg {
                display: block;
                width: 100%;
                height: 100%;
              }
            </style>
          </head>
          <body>
            ${svgContent}
          </body>
        </html>
      `;

      // Load the HTML content
      await hiddenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture as PNG
      const image = await hiddenWindow.webContents.capturePage();
      const pngBuffer = image.toPNG();
      
      // Clean up
      hiddenWindow.close();

      // Write to file
      fs.writeFileSync(validatedFilePath, pngBuffer);

      return { success: true, filePath: validatedFilePath };
    } catch (error) {
      console.error('Error exporting PNG from SVG:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-csv', async (event, data) => {
    try {
      console.log('[ELECTRON] export-csv handler called');

      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Inventory as CSV',
        defaultPath: data.filename || `device_metadata_${new Date().toISOString().split('T')[0]}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path
      let validatedFilePath;
      try {
        validatedFilePath = validateDialogPath(filePath);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[export-csv] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      // Write CSV content to file
      fs.writeFileSync(validatedFilePath, data.csvContent, 'utf8');
      console.log('[ELECTRON] CSV file written successfully:', validatedFilePath);

      return { success: true, filePath: validatedFilePath };
    } catch (error) {
      console.error('[ELECTRON] Error exporting CSV:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-pdf', async (event, data) => {
    try {
      console.log('[ELECTRON] export-pdf handler called');

      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export PDF',
        defaultPath: data.filename || `export_${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Validate the dialog-provided path
      let validatedFilePath;
      try {
        validatedFilePath = validateDialogPath(filePath);
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[export-pdf] Path security violation:', securityError.message);
          return { success: false, error: `Security error: ${securityError.message}` };
        }
        throw securityError;
      }

      // Convert buffer data if needed
      const buffer = Buffer.isBuffer(data.pdfBuffer) ? data.pdfBuffer : Buffer.from(data.pdfBuffer);

      // Write PDF buffer to file
      fs.writeFileSync(validatedFilePath, buffer);
      console.log('[ELECTRON] PDF file written successfully:', validatedFilePath);

      return { success: true, filePath: validatedFilePath };
    } catch (error) {
      console.error('[ELECTRON] Error exporting PDF:', error);
      return { success: false, error: error.message };
    }
  });
}

