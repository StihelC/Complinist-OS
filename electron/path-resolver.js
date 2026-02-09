/**
 * Path Resolver - Central app data root and portable detection
 *
 * Single source of truth for models, DB, and chroma paths.
 * When "portable layout" is detected (exe + models/ or marker next to exe),
 * use exe directory for all data; otherwise use userData (and resourcesPath for bundled models).
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORTABLE_MARKER = 'complinist-portable';
const DB_FILENAME = 'complinist.db';

let _portableMode = null;

/**
 * Get the directory where the exe resides.
 * For electron-builder portable mode, this is PORTABLE_EXECUTABLE_DIR (the original location),
 * not the temp extraction folder that process.execPath would point to.
 * @returns {string}
 */
function getExeDir() {
  // electron-builder portable sets this to the original exe location
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  return path.dirname(process.execPath);
}

/**
 * Detect if we are in "portable layout": exe runs next to a models folder or marker file.
 * Used when user extracts the zip (exe + models/) or when win-unpacked runs in place.
 * @returns {boolean}
 */
function detectPortableLayout() {
  if (!app.isPackaged) return false;
  const exeDir = getExeDir();
  const modelsDir = path.join(exeDir, 'models');
  const markerPath = path.join(exeDir, PORTABLE_MARKER);
  const hasModels = fs.existsSync(modelsDir) && fs.statSync(modelsDir).isDirectory();
  const hasMarker = fs.existsSync(markerPath) && fs.statSync(markerPath).isFile();
  return hasModels || hasMarker;
}

/**
 * Whether the app is running in portable mode (data next to exe).
 * Cached after first call.
 * @returns {boolean}
 */
export function isPortableMode() {
  if (_portableMode === null) {
    _portableMode = detectPortableLayout();
    if (_portableMode) {
      console.log('[PathResolver] Portable layout detected: using exe directory for data');
    }
  }
  return _portableMode;
}

/**
 * Get the app data root: directory for DB, chroma, and (when portable) models.
 * - Dev: project .data directory
 * - Packaged + portable: exe directory
 * - Packaged + not portable: app.getPath('userData')
 * @returns {string}
 */
export function getAppDataRoot() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '.data');
  }
  if (isPortableMode()) {
    return getExeDir();
  }
  return app.getPath('userData');
}

/**
 * Get the models directory (for AI LLM/embedding .gguf files).
 * - Dev: .data/models
 * - Packaged + portable: exeDir/models
 * - Packaged + not portable: resourcesPath/models if it exists, else userData/models
 * @returns {string}
 */
export function getModelsRoot() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '.data', 'models');
  }
  if (isPortableMode()) {
    return path.join(getAppDataRoot(), 'models');
  }
  const resourcesModels = path.join(process.resourcesPath, 'models');
  if (fs.existsSync(resourcesModels)) {
    return resourcesModels;
  }
  return path.join(app.getPath('userData'), 'models');
}

/**
 * Get the ChromaDB directory (writable).
 * - Portable: exeDir/chroma_db
 * - Not portable: userData/chroma_db
 * @returns {string}
 */
export function getChromaRoot() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '.data', 'shared', 'chroma_db');
  }
  if (isPortableMode()) {
    return path.join(getAppDataRoot(), 'chroma_db');
  }
  return path.join(app.getPath('userData'), 'chroma_db');
}

/**
 * Get the SQLite database file path.
 * - Portable: exeDir/complinist.db (created on first run if missing)
 * - Not portable: userData/complinist.db
 * @returns {string}
 */
export function getDbPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '.data', DB_FILENAME);
  }
  if (isPortableMode()) {
    return path.join(getAppDataRoot(), DB_FILENAME);
  }
  return path.join(app.getPath('userData'), DB_FILENAME);
}

/**
 * Ensure portable chroma_db and models dir exist when in portable mode (no-op when not portable).
 * Call early so first launch creates dirs.
 */
export function ensurePortableDirectories() {
  if (!isPortableMode()) return;
  const root = getAppDataRoot();
  const chroma = getChromaRoot();
  const models = getModelsRoot();
  try {
    fs.mkdirSync(chroma, { recursive: true });
    if (!fs.existsSync(models)) {
      fs.mkdirSync(models, { recursive: true });
    }
  } catch (err) {
    console.warn('[PathResolver] Could not create portable dirs:', err.message);
  }
}
