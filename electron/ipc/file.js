import { app, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { validateWritePath, PathSecurityError } from '../utils/path-security.js';

/**
 * Register file-related IPC handlers
 */
export function registerFileHandlers(ipcMain, mainWindow) {
  ipcMain.handle('get-downloads-path', async () => {
    try {
      const downloadsPath = app.getPath('downloads');
      console.log('[IPC] get-downloads-path returning:', downloadsPath);
      return downloadsPath;
    } catch (error) {
      console.error('Failed to get downloads path:', error);
      throw error;
    }
  });

  ipcMain.handle('save-file', async (event, { path: filePath, data }) => {
    console.log('[IPC] save-file called with path:', filePath);
    try {
      // Validate path to prevent directory traversal attacks
      let validatedPath;
      try {
        validatedPath = validateWritePath(filePath, { createParentDir: true });
      } catch (securityError) {
        if (securityError instanceof PathSecurityError) {
          console.error('[IPC] Path security violation:', securityError.message);
          return {
            success: false,
            error: `Security error: ${securityError.message}`,
            code: securityError.code
          };
        }
        throw securityError;
      }

      console.log('[IPC] Validated path:', validatedPath);

      // Convert buffer data if needed
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Write the file
      fs.writeFileSync(validatedPath, buffer);

      console.log('[IPC] File saved successfully to:', validatedPath);
      return { success: true, path: validatedPath };
    } catch (error) {
      console.error('[IPC] Failed to save file:', error);
      throw error;
    }
  });

  ipcMain.handle('capture-viewport', async (event, bounds) => {
    try {
      console.log('[CAPTURE] Capture viewport called with bounds:', bounds);
      
      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window not available');
      }
      
      // Validate bounds
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        throw new Error(`Invalid bounds: ${JSON.stringify(bounds)}`);
      }
      
      // Get the zoom factor and device scale factor for high-DPI displays
      const zoomFactor = mainWindow.webContents.getZoomFactor();
      
      // Get the display's scale factor (devicePixelRatio equivalent)
      const display = screen.getPrimaryDisplay();
      const scaleFactor = display.scaleFactor;
      
      // Enhanced quality: use minimum 2x scale for better output
      const qualityScaleFactor = Math.max(scaleFactor, 2.0);
      
      console.log('[CAPTURE] Display info:', {
        zoomFactor,
        scaleFactor,
        qualityScaleFactor,
        displaySize: display.size,
        workArea: display.workArea
      });
      
      // For high-quality capture on high-DPI displays, we need to account for both
      // the zoom factor and the device pixel ratio
      // However, capturePage already captures at device resolution, so we should NOT
      // multiply by scaleFactor again (that would cause over-scaling)
      // We only need to apply the zoom factor for coordinate transformation
      const captureRect = {
        x: Math.floor((bounds.x || 0) * zoomFactor),
        y: Math.floor((bounds.y || 0) * zoomFactor),
        width: Math.floor(bounds.width * zoomFactor),
        height: Math.floor(bounds.height * zoomFactor)
      };
      
      console.log('[CAPTURE] Capturing with rect (zoom adjusted):', captureRect);
      console.log('[CAPTURE] Expected output resolution:', {
        width: Math.floor(captureRect.width * qualityScaleFactor),
        height: Math.floor(captureRect.height * qualityScaleFactor)
      });
      
      // Wait a small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture the page - Electron's capturePage automatically captures at device resolution
      // This means on a 2x display, it will capture at 2x the pixel dimensions for sharp text
      const image = await mainWindow.webContents.capturePage(captureRect);
      const imageSize = image.getSize();
      console.log('[CAPTURE] Image captured successfully at native resolution:', imageSize);
      console.log('[CAPTURE] Scale ratio achieved:', {
        widthRatio: imageSize.width / bounds.width,
        heightRatio: imageSize.height / bounds.height
      });
      
      // Validate captured image
      if (imageSize.width === 0 || imageSize.height === 0) {
        throw new Error('Captured image has zero dimensions');
      }
      
      // Convert to PNG buffer with best quality
      const pngBuffer = image.toPNG();
      console.log('[CAPTURE] PNG buffer size:', pngBuffer.length, 'bytes');
      console.log('[CAPTURE] PNG size in KB:', Math.round(pngBuffer.length / 1024), 'KB');
      
      if (pngBuffer.length === 0) {
        throw new Error('Captured image is empty');
      }
      
      // Return the PNG buffer as base64
      const imageData = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      console.log('[CAPTURE] Image data created successfully, base64 length:', imageData.length);
      
      return {
        success: true,
        imageData: imageData,
        dimensions: imageSize,
        quality: {
          scaleFactor: qualityScaleFactor,
          originalBounds: bounds,
          capturedSize: imageSize
        }
      };
    } catch (error) {
      console.error('[CAPTURE] Error capturing viewport:', error);
      console.error('[CAPTURE] Stack trace:', error.stack);
      return { 
        success: false, 
        error: error.message,
        details: error.stack
      };
    }
  });
}

