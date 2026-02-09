import * as aiService from '../ai-service-manager.js';

// Store reference to mainWindow for sending preload progress events
let mainWindowRef = null;

/**
 * Set the main window reference for sending events
 * @param {BrowserWindow} win - The main browser window
 */
export function setMainWindow(win) {
  mainWindowRef = win;
}

/**
 * Register AI IPC handlers
 */
export function registerAIHandlers(ipcMain) {
  ipcMain.handle('ai:llm-generate', async (event, { prompt, temperature, maxTokens }) => {
    try {
      console.log('[AI IPC] LLM generate request');
      const result = await aiService.generateText(prompt, { temperature, maxTokens });
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] LLM generate error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:llm-generate-stream', async (event, { prompt, temperature, maxTokens }) => {
    try {
      console.log('[AI IPC] LLM generate stream request');
      // Note: Streaming over IPC requires a different approach
      // For now, we'll collect all tokens and return them
      const tokens = [];
      for await (const token of aiService.generateTextStream(prompt, { temperature, maxTokens })) {
        tokens.push(token);
        // Send progressive updates via event
        event.sender.send('ai:stream-token', token);
      }
      return { success: true, data: { text: tokens.join(''), tokensUsed: tokens.length } };
    } catch (error) {
      console.error('[AI IPC] LLM stream error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:embed', async (event, { text }) => {
    try {
      console.log('[AI IPC] Embed request', {
        textType: typeof text,
        isArray: Array.isArray(text),
        length: Array.isArray(text) ? text.length : (text ? text.length : 0),
        preview: Array.isArray(text) ? text[0]?.substring(0, 50) : text?.substring(0, 50)
      });
      const result = await aiService.generateEmbedding(text);
      console.log('[AI IPC] Embed success', {
        embeddingsCount: result.embeddings?.length || 0,
        dimensions: result.dimensions,
        firstEmbeddingLength: result.embeddings?.[0]?.length || 0
      });
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] Embed error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:chromadb-query', async (event, { collection, queryEmbedding, topK, filters }) => {
    try {
      console.log('[AI IPC] ChromaDB query request');
      const result = await aiService.queryChromaDB(collection, queryEmbedding, { topK, filters });
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] ChromaDB query error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:chromadb-add', async (event, { collection, documents, embeddings, metadatas, ids }) => {
    try {
      console.log('[AI IPC] ChromaDB add request');
      const result = await aiService.addToChromaDB(collection, documents, embeddings, metadatas, ids);
      return { success: true, data: result };
    } catch (error) {
      console.error('[AI IPC] ChromaDB add error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:check-health', async () => {
    try {
      const health = await aiService.checkHealth();
      return health;
    } catch (error) {
      console.error('[AI IPC] Health check error:', error);
      return {
        llm: false,
        embedding: false,
        chroma: false,
        contextSize: 2500,
      };
    }
  });

  ipcMain.handle('ai:get-context-size', async () => {
    try {
      return aiService.getCalibratedContextSize();
    } catch (error) {
      console.error('[AI IPC] Get context size error:', error);
      return 2500;
    }
  });

  // Preload status handler
  ipcMain.handle('ai:get-preload-status', async () => {
    return {
      isPreloading: aiService.isPreloadInProgress(),
    };
  });

  // Model scanning and preferences handlers
  ipcMain.handle('ai:scan-models', async () => {
    try {
      const models = aiService.scanModelsDirectory();
      return { success: true, data: models };
    } catch (error) {
      console.error('[AI IPC] Scan models error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:get-available-models', async () => {
    try {
      const models = aiService.getAvailableModels();
      return { success: true, data: models };
    } catch (error) {
      console.error('[AI IPC] Get available models error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:set-model-preferences', async (event, { llmModelPath, embeddingModelPath }) => {
    try {
      const result = aiService.setModelPreferences(llmModelPath, embeddingModelPath);
      return result;
    } catch (error) {
      console.error('[AI IPC] Set model preferences error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:get-model-preferences', async () => {
    try {
      const preferences = aiService.getModelPreferences();
      return { success: true, data: preferences };
    } catch (error) {
      console.error('[AI IPC] Get model preferences error:', error);
      return { success: false, error: error.message };
    }
  });

  // Custom models path handlers
  ipcMain.handle('ai:set-custom-models-path', async (event, { path }) => {
    try {
      const result = aiService.setCustomModelsPath(path);
      return result;
    } catch (error) {
      console.error('[AI IPC] Set custom models path error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:get-custom-models-path', async () => {
    try {
      const result = aiService.getCustomModelsPath();
      return result;
    } catch (error) {
      console.error('[AI IPC] Get custom models path error:', error);
      return { success: false, error: error.message, path: null };
    }
  });

  ipcMain.handle('ai:clear-custom-models-path', async () => {
    try {
      const result = aiService.clearCustomModelsPath();
      return result;
    } catch (error) {
      console.error('[AI IPC] Clear custom models path error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:get-current-models-directory', async () => {
    try {
      const directory = aiService.getCurrentModelsDirectory();
      return { success: true, directory };
    } catch (error) {
      console.error('[AI IPC] Get current models directory error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ai:browse-models-folder', async () => {
    try {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Models Directory',
        buttonLabel: 'Select Folder',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      console.error('[AI IPC] Browse models folder error:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Start AI preload with progress events sent to renderer
 * Should be called after window is created
 */
export async function startAIPreload() {
  if (!mainWindowRef) {
    console.warn('[AI IPC] Cannot start preload: main window not set');
    return;
  }

  // Set up progress callback to send events to renderer
  aiService.setPreloadProgressCallback((stage, progress, message) => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('ai:preload-progress', {
        stage,
        progress,
        message,
      });
    }
  });

  // Start preload in background (don't await - let it run async)
  aiService.preloadAIServices().then((result) => {
    console.log('[AI IPC] Preload completed:', result.success ? 'success' : 'failed');
  }).catch((error) => {
    console.error('[AI IPC] Preload error:', error);
  });
}

