// Model Download Service
// Handles downloading AI models from S3, with progress tracking and extraction

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getModelsRoot } from './path-resolver.js';
import https from 'https';
import http from 'http';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { extract } from 'tar';

// Default model download URL (can be overridden by environment variable)
const DEFAULT_MODEL_URL = process.env.COMPLIFLOW_MODEL_URL ||
  'https://compliflow-data.s3.amazonaws.com/models.tar.gz';

// Expected models after extraction
const EXPECTED_MODELS = [
  { filename: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf', type: 'llm', sizeHuman: '~4.3 GB' },
  { filename: 'bge-m3-FP16.gguf', type: 'embedding', sizeHuman: '~1.1 GB' },
];

// State
let activeDownload = null;
let progressCallback = null;
let mainWindowRef = null;

/**
 * Set the main window reference for sending IPC events
 * @param {BrowserWindow} win - Main browser window
 */
export function setMainWindow(win) {
  mainWindowRef = win;
}

/**
 * Set progress callback for download operations
 * @param {Function} callback - Callback function(status)
 */
export function setProgressCallback(callback) {
  progressCallback = callback;
}

/**
 * Emit progress update
 * @param {object} status - Download status object
 */
function emitProgress(status) {
  console.log(`[Model Download] ${status.stage}: ${status.message} (${status.progress}%)`);

  if (progressCallback) {
    progressCallback(status);
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('models:download-progress', status);
  }
}

/**
 * Get the models directory path (uses central path-resolver).
 * @returns {string} Path to models directory
 */
export function getModelsDirectory() {
  return getModelsRoot();
}

/**
 * Ensure models directory exists
 * @returns {string} Path to models directory
 */
function ensureModelsDirectory() {
  const modelsDir = getModelsDirectory();
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  return modelsDir;
}

/**
 * Check which models exist locally
 * @returns {object} Status of each expected model
 */
export function checkModelStatus() {
  const modelsDir = getModelsDirectory();
  const status = {
    modelsDirectory: modelsDir,
    directoryExists: fs.existsSync(modelsDir),
    models: {},
    allModelsPresent: true,
    missingModels: [],
  };

  for (const model of EXPECTED_MODELS) {
    const modelPath = path.join(modelsDir, model.filename);
    const exists = fs.existsSync(modelPath);
    let size = 0;

    if (exists) {
      try {
        const stats = fs.statSync(modelPath);
        size = stats.size;
      } catch (error) {
        console.warn(`[Model Download] Could not stat ${model.filename}:`, error.message);
      }
    }

    status.models[model.filename] = {
      exists,
      path: modelPath,
      size,
      sizeHuman: model.sizeHuman,
      type: model.type,
      // Consider file valid if it exists and is larger than 1KB (not corrupted/empty)
      valid: exists && size > 1024,
    };

    if (!exists || size <= 1024) {
      status.allModelsPresent = false;
      status.missingModels.push(model.filename);
    }
  }

  return status;
}

/**
 * Get the download URL (from env or default)
 * @returns {string} Download URL
 */
export function getDownloadUrl() {
  return process.env.COMPLIFLOW_MODEL_URL || DEFAULT_MODEL_URL;
}

/**
 * Download models archive from S3
 * @param {object} options - Download options
 * @param {string} options.url - Override download URL
 * @returns {Promise<object>} Download result
 */
export async function startDownload(options = {}) {
  const url = options.url || getDownloadUrl();
  const modelsDir = ensureModelsDirectory();
  const archivePath = path.join(modelsDir, 'models.tar.gz');
  const partPath = archivePath + '.part';

  // Check if download already in progress
  if (activeDownload) {
    return { success: false, error: 'Download already in progress' };
  }

  try {
    emitProgress({
      stage: 'starting',
      progress: 0,
      message: 'Starting download...',
      bytesDownloaded: 0,
      totalBytes: 0,
    });

    // Check for partial download to resume
    let startByte = 0;
    if (fs.existsSync(partPath)) {
      const stats = fs.statSync(partPath);
      startByte = stats.size;
      emitProgress({
        stage: 'resuming',
        progress: 0,
        message: `Resuming from ${formatBytes(startByte)}...`,
        bytesDownloaded: startByte,
        totalBytes: 0,
      });
    }

    // Start download
    const result = await downloadFile(url, partPath, startByte);

    if (!result.success) {
      return result;
    }

    // Rename .part to final file
    fs.renameSync(partPath, archivePath);

    emitProgress({
      stage: 'extracting',
      progress: 90,
      message: 'Extracting models...',
      bytesDownloaded: result.totalBytes,
      totalBytes: result.totalBytes,
    });

    // Extract the archive
    await extractArchive(archivePath, modelsDir);

    // Delete archive after extraction
    fs.unlinkSync(archivePath);

    // Verify extraction
    const status = checkModelStatus();
    if (!status.allModelsPresent) {
      return {
        success: false,
        error: `Extraction incomplete. Missing: ${status.missingModels.join(', ')}`,
      };
    }

    emitProgress({
      stage: 'complete',
      progress: 100,
      message: 'Models downloaded successfully',
      bytesDownloaded: result.totalBytes,
      totalBytes: result.totalBytes,
    });

    return { success: true, modelsDirectory: modelsDir };
  } catch (error) {
    console.error('[Model Download] Error:', error);
    emitProgress({
      stage: 'error',
      progress: 0,
      message: error.message,
      error: error.message,
    });
    return { success: false, error: error.message };
  } finally {
    activeDownload = null;
  }
}

/**
 * Download a file with progress tracking and resume support
 * @param {string} url - Download URL
 * @param {string} destPath - Destination path
 * @param {number} startByte - Start byte for resume
 * @returns {Promise<object>} Download result
 */
function downloadFile(url, destPath, startByte = 0) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const headers = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const request = protocol.get(url, { headers }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath, startByte)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200 && response.statusCode !== 206) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      // Get total size
      let totalBytes;
      if (response.statusCode === 206) {
        // Partial content - parse Content-Range header
        const range = response.headers['content-range'];
        if (range) {
          const match = range.match(/\/(\d+)$/);
          if (match) {
            totalBytes = parseInt(match[1], 10);
          }
        }
      } else {
        totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      }

      let bytesDownloaded = startByte;
      let lastProgressUpdate = Date.now();
      let lastBytes = startByte;

      // Open file for append (resume) or write (new)
      const fileStream = fs.createWriteStream(destPath, {
        flags: startByte > 0 ? 'a' : 'w',
      });

      activeDownload = { request, fileStream };

      response.on('data', (chunk) => {
        bytesDownloaded += chunk.length;

        // Throttle progress updates to every 500ms
        const now = Date.now();
        if (now - lastProgressUpdate >= 500) {
          const elapsed = (now - lastProgressUpdate) / 1000;
          const bytesSinceLast = bytesDownloaded - lastBytes;
          const speed = bytesSinceLast / elapsed;
          const remaining = totalBytes - bytesDownloaded;
          const eta = speed > 0 ? remaining / speed : 0;

          const progress = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 85) : 0;

          emitProgress({
            stage: 'downloading',
            progress,
            message: `Downloading: ${formatBytes(bytesDownloaded)} / ${formatBytes(totalBytes)}`,
            bytesDownloaded,
            totalBytes,
            speed,
            speedHuman: formatBytes(speed) + '/s',
            eta,
            etaHuman: formatTime(eta),
          });

          lastProgressUpdate = now;
          lastBytes = bytesDownloaded;
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({ success: true, totalBytes: bytesDownloaded });
      });

      fileStream.on('error', (error) => {
        reject(error);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });

    // Set timeout (30 minutes for large files)
    request.setTimeout(30 * 60 * 1000);
  });
}

/**
 * Extract tar.gz archive
 * @param {string} archivePath - Path to archive
 * @param {string} destDir - Destination directory
 */
async function extractArchive(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(archivePath);
    const gunzip = createGunzip();
    const extractor = extract({ cwd: destDir });

    readStream
      .pipe(gunzip)
      .pipe(extractor)
      .on('finish', resolve)
      .on('error', reject);
  });
}

/**
 * Pause the current download
 * @returns {object} Result
 */
export function pauseDownload() {
  if (!activeDownload) {
    return { success: false, error: 'No download in progress' };
  }

  try {
    activeDownload.request.destroy();
    activeDownload.fileStream.close();
    activeDownload = null;

    emitProgress({
      stage: 'paused',
      progress: 0,
      message: 'Download paused',
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Cancel the current download and cleanup
 * @returns {object} Result
 */
export function cancelDownload() {
  const modelsDir = getModelsDirectory();
  const partPath = path.join(modelsDir, 'models.tar.gz.part');

  // Stop active download
  if (activeDownload) {
    try {
      activeDownload.request.destroy();
      activeDownload.fileStream.close();
    } catch (error) {
      console.warn('[Model Download] Error stopping download:', error.message);
    }
    activeDownload = null;
  }

  // Delete partial file
  if (fs.existsSync(partPath)) {
    try {
      fs.unlinkSync(partPath);
    } catch (error) {
      console.warn('[Model Download] Error deleting partial file:', error.message);
    }
  }

  emitProgress({
    stage: 'cancelled',
    progress: 0,
    message: 'Download cancelled',
  });

  return { success: true };
}

/**
 * Check if download is in progress
 * @returns {boolean}
 */
export function isDownloadInProgress() {
  return activeDownload !== null;
}

/**
 * Get partial download info if exists
 * @returns {object|null}
 */
export function getPartialDownloadInfo() {
  const modelsDir = getModelsDirectory();
  const partPath = path.join(modelsDir, 'models.tar.gz.part');

  if (fs.existsSync(partPath)) {
    const stats = fs.statSync(partPath);
    return {
      exists: true,
      path: partPath,
      size: stats.size,
      sizeHuman: formatBytes(stats.size),
    };
  }

  return null;
}

/**
 * Format bytes to human readable
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format seconds to human readable time
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Export service object for convenience
export const modelDownloadService = {
  setMainWindow,
  setProgressCallback,
  getModelsDirectory,
  checkModelStatus,
  getDownloadUrl,
  startDownload,
  pauseDownload,
  cancelDownload,
  isDownloadInProgress,
  getPartialDownloadInfo,
};
