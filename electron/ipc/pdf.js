import { BrowserWindow } from 'electron';

/**
 * Register PDF IPC handlers
 */
export function registerPDFHandlers(ipcMain) {
  ipcMain.handle('generate-ssp-pdf', async (event, { html, options }) => {
    console.log('[IPC] generate-ssp-pdf called');
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      },
    });

    try {
      if (!html) {
        throw new Error('HTML content is required. Please provide valid HTML content for PDF generation.');
      }

      // Set timeout for PDF generation (30 seconds max)
      const PDF_GENERATION_TIMEOUT = 30000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('PDF generation timed out after 30 seconds. The document may be too complex or there may be a system issue.'));
        }, PDF_GENERATION_TIMEOUT);
      });

      // Wait for content to load using did-finish-load event instead of fixed timeout
      const loadPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Content failed to load within 10 seconds. Please try again or reduce the document complexity.'));
        }, 10000);

        pdfWindow.webContents.once('did-finish-load', () => {
          clearTimeout(timeout);
          // Additional wait for images/styles to render
          setTimeout(resolve, 500);
        });

        pdfWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to load content: ${errorDescription || `Error code ${errorCode}`}. Please check the HTML content.`));
        });
      });

      // Load the HTML content
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Wait for content to fully load (with timeout)
      await Promise.race([loadPromise, timeoutPromise]);

      // Verify images are loaded (check for any pending image loads)
      const imagesLoaded = await pdfWindow.webContents.executeJavaScript(`
        Promise.all(
          Array.from(document.images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = resolve; // Continue even if image fails
              setTimeout(resolve, 2000); // Max 2s wait per image
            });
          })
        ).then(() => true).catch(() => true)
      `).catch(() => true); // Continue even if check fails

      // Generate PDF using Electron's printToPDF
      const pdfOptions = {
        marginsType: 1, // Standard margins
        printBackground: true,
        pageSize: 'Letter',
        landscape: false,
        ...options,
      };

      console.log('[IPC] Generating PDF with options:', pdfOptions);
      const pdfBuffer = await Promise.race([
        pdfWindow.webContents.printToPDF(pdfOptions),
        timeoutPromise,
      ]);

      console.log('[IPC] PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return {
        success: true,
        pdfBuffer: pdfBuffer,
      };
    } catch (error) {
      console.error('[IPC] Failed to generate PDF:', error);
      const errorMessage = error.message || 'Failed to generate PDF. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Always close the window, even on error
      try {
        pdfWindow.close();
      } catch (closeError) {
        console.warn('[IPC] Error closing PDF window:', closeError);
      }
    }
  });
}

