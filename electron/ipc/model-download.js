// Model Download IPC Handlers
// Handles IPC communication for model downloading

import { ipcMain } from 'electron';
import {
  modelDownloadService,
  setMainWindow,
  checkModelStatus,
  getDownloadUrl,
  startDownload,
  pauseDownload,
  cancelDownload,
  isDownloadInProgress,
  getPartialDownloadInfo,
  getModelsDirectory,
} from '../model-download-service.js';

let mainWindowRef = null;

/**
 * Set the main window reference for IPC events
 * @param {BrowserWindow} win - Main browser window
 */
export function setModelDownloadMainWindow(win) {
  mainWindowRef = win;
  setMainWindow(win);
}

/**
 * Register all model download IPC handlers
 */
export function registerModelDownloadHandlers() {
  console.log('[Model Download IPC] Registering handlers...');

  // Check model status (which models exist locally)
  ipcMain.handle('models:check-status', async () => {
    try {
      const status = checkModelStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error('[Model Download IPC] check-status error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get the models directory path
  ipcMain.handle('models:get-directory', async () => {
    try {
      const directory = getModelsDirectory();
      return { success: true, data: { directory } };
    } catch (error) {
      console.error('[Model Download IPC] get-directory error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get the download URL
  ipcMain.handle('models:get-download-url', async () => {
    try {
      const url = getDownloadUrl();
      return { success: true, data: { url } };
    } catch (error) {
      console.error('[Model Download IPC] get-download-url error:', error);
      return { success: false, error: error.message };
    }
  });

  // Start downloading models
  ipcMain.handle('models:start-download', async (event, data = {}) => {
    try {
      const result = await startDownload(data);
      return result;
    } catch (error) {
      console.error('[Model Download IPC] start-download error:', error);
      return { success: false, error: error.message };
    }
  });

  // Pause the current download
  ipcMain.handle('models:pause-download', async () => {
    try {
      const result = pauseDownload();
      return result;
    } catch (error) {
      console.error('[Model Download IPC] pause-download error:', error);
      return { success: false, error: error.message };
    }
  });

  // Resume a paused download
  ipcMain.handle('models:resume-download', async (event, data = {}) => {
    try {
      // Resume is just starting download again - it will detect the .part file
      const result = await startDownload(data);
      return result;
    } catch (error) {
      console.error('[Model Download IPC] resume-download error:', error);
      return { success: false, error: error.message };
    }
  });

  // Cancel the current download
  ipcMain.handle('models:cancel-download', async () => {
    try {
      const result = cancelDownload();
      return result;
    } catch (error) {
      console.error('[Model Download IPC] cancel-download error:', error);
      return { success: false, error: error.message };
    }
  });

  // Check if download is in progress
  ipcMain.handle('models:is-downloading', async () => {
    try {
      const inProgress = isDownloadInProgress();
      return { success: true, data: { inProgress } };
    } catch (error) {
      console.error('[Model Download IPC] is-downloading error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get partial download info (for resume)
  ipcMain.handle('models:get-partial-info', async () => {
    try {
      const info = getPartialDownloadInfo();
      return { success: true, data: info };
    } catch (error) {
      console.error('[Model Download IPC] get-partial-info error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[Model Download IPC] Handlers registered successfully');
}

export default {
  setModelDownloadMainWindow,
  registerModelDownloadHandlers,
};
