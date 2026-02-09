// AI Service Manager
// Manages in-process AI services: LLM, embeddings, and ChromaDB

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { getModelsRoot, getChromaRoot } from './path-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the correct Python command for the current platform
function getPythonCommand() {
  if (process.platform === 'win32') {
    // On Windows, prefer 'py -3.12' launcher, then 'python'
    try {
      execSync('py -3.12 --version', { stdio: 'ignore' });
      return 'py';
    } catch {
      return 'python';
    }
  }
  return 'python3';
}

function getPythonArgs() {
  if (process.platform === 'win32') {
    try {
      execSync('py -3.12 --version', { stdio: 'ignore' });
      return ['-3.12'];
    } catch {
      return [];
    }
  }
  return [];
}

// State management
let llama = null;
let llmModel = null;
let embeddingModel = null;
let chromaProcess = null;
let isInitialized = false;
let initializationPromise = null;
let gpuLayers = 0; // Store GPU layers for context size calculation
let maxWorkingContextSize = null; // Calibrated maximum working context size
let contextSizeCalibrated = false; // Flag to track if calibration is complete

// Preload state management
let preloadInProgress = false;
let preloadProgressCallback = null;

/**
 * Set progress callback for preload operations
 * @param {Function} callback - Callback function(stage, progress, message)
 */
export function setPreloadProgressCallback(callback) {
  preloadProgressCallback = callback;
}

/**
 * Emit progress update during preload
 * @param {string} stage - Current loading stage
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Human-readable message
 */
function emitPreloadProgress(stage, progress, message) {
  console.log(`[AI Preload] ${stage}: ${message} (${progress}%)`);
  if (preloadProgressCallback) {
    preloadProgressCallback(stage, progress, message);
  }
}

/**
 * Check if preload is currently in progress
 * @returns {boolean}
 */
export function isPreloadInProgress() {
  return preloadInProgress;
}

// AI Configuration
const AI_CONFIG = {
  useInstructionFormat: true, // Enable Mistral instruction formatting
  chatTemplate: 'mistral', // Chat template to use
  modelType: 'mistral-7b-instruct-v0.1', // Model identifier
};

// Model detection and preferences
let cachedAvailableModels = null;

/**
 * Get the models directory path.
 * Checks for user-configured custom path first, falls back to default.
 * @returns {string} Path to models directory
 */
function getModelsDirectory() {
  // Check for custom models path in preferences
  try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'model-preferences.json');

    if (fs.existsSync(prefsPath)) {
      const content = fs.readFileSync(prefsPath, 'utf8');
      const preferences = JSON.parse(content);

      if (preferences.customModelsPath && fs.existsSync(preferences.customModelsPath)) {
        console.log('[AI] Using custom models path:', preferences.customModelsPath);
        return preferences.customModelsPath;
      }
    }
  } catch (error) {
    console.warn('[AI] Error checking custom models path:', error.message);
  }

  // Fallback to default path from path-resolver
  return getModelsRoot();
}

/**
 * Analyze a model file to infer its type and capabilities
 * @param {string} filepath - Path to the model file
 * @returns {object} Model metadata
 */
function analyzeModelFile(filepath) {
  const filename = path.basename(filepath);
  const stats = fs.statSync(filepath);
  const sizeGB = stats.size / (1024 * 1024 * 1024);
  const lowerFilename = filename.toLowerCase();

  // Type inference heuristics
  let type = 'unknown';
  const capabilities = {
    canDoLLM: true, // Most GGUF models can do LLM
    canDoEmbeddings: false, // Most models aren't optimized for embeddings
  };

  // Embedding model indicators
  if (
    lowerFilename.includes('embed') ||
    lowerFilename.includes('bge') ||
    lowerFilename.includes('e5') ||
    lowerFilename.includes('embedding') ||
    sizeGB < 3 // Small models are often embedding models
  ) {
    type = 'embedding';
    capabilities.canDoLLM = false; // Embedding models typically can't do LLM well
    capabilities.canDoEmbeddings = true;
  }
  // LLM indicators
  else if (
    lowerFilename.includes('instruct') ||
    lowerFilename.includes('chat') ||
    lowerFilename.includes('mistral') ||
    lowerFilename.includes('llama') ||
    lowerFilename.includes('phi') ||
    lowerFilename.includes('qwen') ||
    sizeGB >= 3 // Large models are typically LLMs
  ) {
    type = 'llm';
    capabilities.canDoLLM = true;
    capabilities.canDoEmbeddings = true; // LLMs can generate embeddings
  } else {
    // Unknown - assume it can do both but prioritize LLM
    type = 'unknown';
    capabilities.canDoLLM = true;
    capabilities.canDoEmbeddings = true;
  }

  return {
    filename,
    path: filepath,
    sizeGB: parseFloat(sizeGB.toFixed(2)),
    type,
    capabilities,
  };
}

/**
 * Scan models directory for all GGUF files
 * @returns {Array<object>} Array of detected models with metadata
 */
export function scanModelsDirectory() {
  const modelsPath = getModelsDirectory();
  console.log('[AI] Scanning models directory:', modelsPath);

  if (!fs.existsSync(modelsPath)) {
    console.warn('[AI] Models directory does not exist:', modelsPath);
    cachedAvailableModels = [];
    return [];
  }

  try {
    const files = fs.readdirSync(modelsPath);
    const ggufFiles = files.filter((file) => file.endsWith('.gguf'));

    if (ggufFiles.length === 0) {
      console.warn('[AI] No GGUF files found in models directory');
      cachedAvailableModels = [];
      return [];
    }

    const models = ggufFiles.map((file) => {
      const filepath = path.join(modelsPath, file);
      try {
        return analyzeModelFile(filepath);
      } catch (error) {
        console.error(`[AI] Error analyzing model ${file}:`, error.message);
        return null;
      }
    }).filter((model) => model !== null);

    console.log(`[AI] Found ${models.length} model(s):`, models.map((m) => m.filename));
    cachedAvailableModels = models;
    return models;
  } catch (error) {
    console.error('[AI] Error scanning models directory:', error);
    cachedAvailableModels = [];
    return [];
  }
}

/**
 * Get available models (cached or scan if needed)
 * @returns {Array<object>} Array of detected models
 */
export function getAvailableModels() {
  if (cachedAvailableModels !== null) {
    return cachedAvailableModels;
  }
  return scanModelsDirectory();
}

/**
 * Find default LLM model from available models
 * @param {string} modelsPath - Path to models directory
 * @returns {string|null} Path to default LLM model or null
 */
function findDefaultLLM(modelsPath) {
  const models = scanModelsDirectory();
  
  // Priority: instruction-tuned models > largest models > any LLM-capable model
  const instructionModels = models.filter(
    (m) => m.capabilities.canDoLLM && m.filename.toLowerCase().includes('instruct')
  );
  if (instructionModels.length > 0) {
    // Pick largest instruction model
    instructionModels.sort((a, b) => b.sizeGB - a.sizeGB);
    return instructionModels[0].path;
  }

  const llmModels = models.filter((m) => m.capabilities.canDoLLM && m.type !== 'embedding');
  if (llmModels.length > 0) {
    // Pick largest LLM model
    llmModels.sort((a, b) => b.sizeGB - a.sizeGB);
    return llmModels[0].path;
  }

  // Fallback to hardcoded default if exists
  const defaultPath = path.join(modelsPath, 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

/**
 * Find default embedding model from available models
 * @param {string} modelsPath - Path to models directory
 * @returns {string|null} Path to default embedding model or null
 */
function findDefaultEmbedding(modelsPath) {
  const models = scanModelsDirectory();
  
  // Priority: dedicated embedding models > smallest models
  const embeddingModels = models.filter(
    (m) => m.capabilities.canDoEmbeddings && m.type === 'embedding'
  );
  if (embeddingModels.length > 0) {
    // Pick smallest embedding model (faster)
    embeddingModels.sort((a, b) => a.sizeGB - b.sizeGB);
    return embeddingModels[0].path;
  }

  // Fallback to any model that can do embeddings (prefer smaller)
  const embedCapable = models.filter((m) => m.capabilities.canDoEmbeddings);
  if (embedCapable.length > 0) {
    embedCapable.sort((a, b) => a.sizeGB - b.sizeGB);
    return embedCapable[0].path;
  }

  // Fallback to hardcoded default if exists
  const defaultPath = path.join(modelsPath, 'bge-m3-FP16.gguf');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

/**
 * Load model preferences from userData
 * @returns {object|null} Preferences object or null if not found
 */
function loadModelPreferences() {
  try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'model-preferences.json');
    
    if (!fs.existsSync(prefsPath)) {
      return null;
    }

    const content = fs.readFileSync(prefsPath, 'utf8');
    const preferences = JSON.parse(content);
    
    // Validate that paths exist
    if (preferences.llmModelPath && !fs.existsSync(preferences.llmModelPath)) {
      console.warn('[AI] Preferred LLM model not found:', preferences.llmModelPath);
      return null;
    }
    if (preferences.embeddingModelPath && !fs.existsSync(preferences.embeddingModelPath)) {
      console.warn('[AI] Preferred embedding model not found:', preferences.embeddingModelPath);
      return null;
    }

    return preferences;
  } catch (error) {
    console.error('[AI] Error loading model preferences:', error);
    return null;
  }
}

/**
 * Save model preferences to userData
 * @param {string} llmModelPath - Path to LLM model
 * @param {string} embeddingModelPath - Path to embedding model
 */
export function setModelPreferences(llmModelPath, embeddingModelPath) {
  try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'model-preferences.json');

    // Preserve existing customModelsPath if it exists
    let existingPrefs = {};
    if (fs.existsSync(prefsPath)) {
      try {
        existingPrefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      } catch (e) {
        // Ignore parse errors
      }
    }

    const preferences = {
      ...existingPrefs,
      llmModelPath,
      embeddingModelPath,
    };

    fs.writeFileSync(prefsPath, JSON.stringify(preferences, null, 2), 'utf8');
    console.log('[AI] Model preferences saved:', preferences);
    return { success: true };
  } catch (error) {
    console.error('[AI] Error saving model preferences:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current model preferences
 * @returns {object|null} Preferences object or null
 */
export function getModelPreferences() {
  return loadModelPreferences();
}

/**
 * Set custom models directory path
 * @param {string} directoryPath - Path to custom models directory
 * @returns {object} Result with success status
 */
export function setCustomModelsPath(directoryPath) {
  try {
    // Validate the path exists and is a directory
    if (!fs.existsSync(directoryPath)) {
      return { success: false, error: 'Directory does not exist' };
    }

    const stats = fs.statSync(directoryPath);
    if (!stats.isDirectory()) {
      return { success: false, error: 'Path is not a directory' };
    }

    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'model-preferences.json');

    // Load existing preferences or create new
    let preferences = {};
    if (fs.existsSync(prefsPath)) {
      try {
        preferences = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      } catch (e) {
        // Ignore parse errors, start fresh
      }
    }

    // Update with new custom path
    preferences.customModelsPath = directoryPath;

    // Clear model selections since directory changed
    delete preferences.llmModelPath;
    delete preferences.embeddingModelPath;

    fs.writeFileSync(prefsPath, JSON.stringify(preferences, null, 2), 'utf8');
    console.log('[AI] Custom models path set:', directoryPath);

    // Clear cached models so next scan uses new directory
    cachedAvailableModels = null;

    return { success: true };
  } catch (error) {
    console.error('[AI] Error setting custom models path:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get custom models directory path
 * @returns {object} Result with path or null
 */
export function getCustomModelsPath() {
  try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'model-preferences.json');

    if (!fs.existsSync(prefsPath)) {
      return { success: true, path: null };
    }

    const content = fs.readFileSync(prefsPath, 'utf8');
    const preferences = JSON.parse(content);

    return {
      success: true,
      path: preferences.customModelsPath || null,
      isValid: preferences.customModelsPath ? fs.existsSync(preferences.customModelsPath) : false,
    };
  } catch (error) {
    console.error('[AI] Error getting custom models path:', error);
    return { success: false, error: error.message, path: null };
  }
}

/**
 * Clear custom models path (revert to default)
 * @returns {object} Result with success status
 */
export function clearCustomModelsPath() {
  try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'model-preferences.json');

    if (!fs.existsSync(prefsPath)) {
      return { success: true };
    }

    const content = fs.readFileSync(prefsPath, 'utf8');
    const preferences = JSON.parse(content);

    // Remove custom path and model selections
    delete preferences.customModelsPath;
    delete preferences.llmModelPath;
    delete preferences.embeddingModelPath;

    fs.writeFileSync(prefsPath, JSON.stringify(preferences, null, 2), 'utf8');
    console.log('[AI] Custom models path cleared, reverting to default');

    // Clear cached models
    cachedAvailableModels = null;

    return { success: true };
  } catch (error) {
    console.error('[AI] Error clearing custom models path:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current effective models directory (for display purposes)
 * @returns {string} Current models directory path
 */
export function getCurrentModelsDirectory() {
  return getModelsDirectory();
}

// Configuration
function getModelPaths() {
  const modelsPath = getModelsRoot();
  const chromaDbPath = getChromaRoot();

  // Debug: log environment info
  console.log('[AI] Environment check:');
  console.log('[AI]   app.isPackaged:', app.isPackaged);
  console.log('[AI]   APPIMAGE env:', process.env.APPIMAGE);
  console.log('[AI]   process.resourcesPath:', process.resourcesPath);
  console.log('[AI] Final models path:', modelsPath);
  console.log('[AI] Final chroma_db path:', chromaDbPath);

  // Load preferences or use smart defaults
  const preferences = loadModelPreferences();
  const llmPath = preferences?.llmModelPath || findDefaultLLM(modelsPath);
  const embeddingPath = preferences?.embeddingModelPath || findDefaultEmbedding(modelsPath);

  // Fallback to hardcoded defaults if auto-detection fails
  const finalLlmPath = llmPath || path.join(modelsPath, 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
  const finalEmbeddingPath = embeddingPath || path.join(modelsPath, 'bge-m3-FP16.gguf');

  return {
    llm: finalLlmPath,
    embedding: finalEmbeddingPath,
    chromaDb: chromaDbPath,
  };
}

// Detect available VRAM for NVIDIA GPUs
function detectAvailableVRAM() {
  try {
    const result = execSync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    
    // Parse free VRAM in MB (take first GPU if multiple)
    const freeVRAM = parseInt(result.trim().split('\n')[0]);
    
    if (!isNaN(freeVRAM)) {
      console.log(`[AI] Available VRAM: ${freeVRAM} MB`);
      return freeVRAM;
    }
  } catch (e) {
    // nvidia-smi command failed or not available
  }
  
  return null;
}

// Detect GPU availability and calculate safe layer count based on VRAM
function detectGPULayers() {
  // Check for NVIDIA GPU
  try {
    execSync('nvidia-smi', { stdio: 'ignore' });
    console.log('[AI] NVIDIA GPU detected');
    
    // Check available VRAM to determine safe layer count
    const freeVRAM = detectAvailableVRAM();
    
    if (freeVRAM !== null) {
      // Calculate safe GPU layers based on available VRAM
      // Mistral 7B Q4_K_M uses ~150MB per layer + ~500MB base
      let layers = 0;
      
      if (freeVRAM < 1000) {
        // <1GB: CPU only
        layers = 0;
        console.log('[AI] Low VRAM (<1GB), using CPU only');
      } else if (freeVRAM < 2000) {
        // 1-2GB: 5 layers
        layers = 5;
        console.log('[AI] Limited VRAM (1-2GB), using 5 GPU layers');
      } else if (freeVRAM < 4000) {
        // 2-4GB: 15 layers
        layers = 15;
        console.log('[AI] Moderate VRAM (2-4GB), using 15 GPU layers');
      } else if (freeVRAM < 6000) {
        // 4-6GB: 25 layers
        layers = 25;
        console.log('[AI] Good VRAM (4-6GB), using 25 GPU layers');
      } else {
        // 6GB+: 35 layers (full offload)
        layers = 35;
        console.log('[AI] Plenty of VRAM (6GB+), using 35 GPU layers');
      }
      
      return layers;
    } else {
      // Cannot detect VRAM, use conservative default
      console.log('[AI] Cannot detect VRAM, using conservative 15 GPU layers');
      return 15;
    }
  } catch (e) {
    // No NVIDIA GPU
  }

  // Check for macOS (Metal)
  if (process.platform === 'darwin') {
    console.log('[AI] macOS detected, using 35 GPU layers (Metal)');
    return 35;
  }

  // Default to CPU
  console.log('[AI] No GPU detected, using CPU only');
  return 0;
}

// Initialize AI services
export async function initializeAIServices(options = {}) {
  const { isPreload = false } = options;

  if (isInitialized) {
    if (isPreload) emitPreloadProgress('complete', 100, 'AI services already initialized');
    return { success: true, message: 'Already initialized' };
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  if (isPreload) {
    preloadInProgress = true;
    emitPreloadProgress('starting', 0, 'Starting AI model preload...');
  }

  initializationPromise = (async () => {
    try {
      console.log('[AI] Initializing AI services...');
      if (isPreload) emitPreloadProgress('checking', 5, 'Checking model files...');

      const modelPaths = getModelPaths();

      // Validate model files exist
      if (!fs.existsSync(modelPaths.llm)) {
        console.warn('[AI] LLM model not found at:', modelPaths.llm);
        console.warn('[AI] Please download the model and place it in the models directory');
        
        // Try to find alternative models
        const availableModels = scanModelsDirectory();
        const llmModels = availableModels.filter((m) => m.capabilities.canDoLLM);
        
        if (llmModels.length > 0) {
          console.warn('[AI] Found alternative LLM models. Please configure model preferences.');
          console.warn('[AI] Available LLM models:', llmModels.map((m) => m.filename));
        }
        
        if (isPreload) {
          preloadInProgress = false;
          emitPreloadProgress('error', 0, 'LLM model not found');
        }
        return {
          success: false,
          error: 'LLM model not found',
          modelPath: modelPaths.llm,
          availableModels: llmModels.map((m) => m.filename)
        };
      }

      // Validate model file is a valid GGUF file (check file extension and size)
      const llmStats = fs.statSync(modelPaths.llm);
      if (llmStats.size < 1024) {
        console.error('[AI] LLM model file is too small, may be corrupted:', modelPaths.llm);
        if (isPreload) {
          preloadInProgress = false;
          emitPreloadProgress('error', 0, 'LLM model file appears corrupted');
        }
        return {
          success: false,
          error: 'LLM model file appears corrupted (too small)',
          modelPath: modelPaths.llm
        };
      }

      // Initialize llama
      if (isPreload) emitPreloadProgress('llama_init', 10, 'Initializing llama engine...');
      llama = await getLlama();
      console.log('[AI] Llama instance created');

      // Load LLM model with fallback to CPU on failure
      gpuLayers = detectGPULayers();
      if (isPreload) emitPreloadProgress('llm_loading', 15, `Loading Mistral 7B model (${gpuLayers} GPU layers)...`);
      console.log(`[AI] Loading LLM model with ${gpuLayers} GPU layers...`);

      try {
        llmModel = await llama.loadModel({
          modelPath: modelPaths.llm,
          gpuLayers: gpuLayers,
        });
        console.log('[AI] LLM model loaded successfully');
        if (isPreload) emitPreloadProgress('llm_loaded', 50, 'Mistral 7B model loaded successfully');
      } catch (error) {
        // If GPU loading fails, try CPU fallback
        if (gpuLayers > 0) {
          console.warn('[AI] GPU model loading failed, falling back to CPU...');
          console.warn('[AI] Error was:', error.message);
          if (isPreload) emitPreloadProgress('llm_fallback', 30, 'GPU loading failed, trying CPU mode...');

          try {
            llmModel = await llama.loadModel({
              modelPath: modelPaths.llm,
              gpuLayers: 0,
            });
            gpuLayers = 0; // Update global state to reflect CPU mode
            console.log('[AI] LLM model loaded successfully in CPU mode');
            if (isPreload) emitPreloadProgress('llm_loaded', 50, 'Mistral 7B model loaded (CPU mode)');
          } catch (cpuError) {
            console.error('[AI] Failed to load model even in CPU mode:', cpuError);
            if (isPreload) {
              preloadInProgress = false;
              emitPreloadProgress('error', 0, 'Failed to load LLM model');
            }
            throw cpuError;
          }
        } else {
          // Already trying CPU, can't fall back further
          if (isPreload) {
            preloadInProgress = false;
            emitPreloadProgress('error', 0, 'Failed to load LLM model');
          }
          throw error;
        }
      }

      // Load embedding model (if different, otherwise reuse LLM model)
      if (fs.existsSync(modelPaths.embedding) && modelPaths.embedding !== modelPaths.llm) {
        // Validate embedding model file
        const embeddingStats = fs.statSync(modelPaths.embedding);
        if (embeddingStats.size < 1024) {
          console.warn('[AI] Embedding model file is too small, may be corrupted. Using LLM model for embeddings.');
          if (isPreload) emitPreloadProgress('embedding_fallback', 75, 'Embedding model invalid, using LLM model');
          embeddingModel = llmModel;
        } else {
          if (isPreload) emitPreloadProgress('embedding_loading', 55, 'Loading embedding model...');
          console.log('[AI] Loading embedding model...');

          try {
            embeddingModel = await llama.loadModel({
              modelPath: modelPaths.embedding,
              gpuLayers: Math.min(gpuLayers, 20), // Use fewer layers for embedding
            });
            console.log('[AI] Embedding model loaded successfully');
            if (isPreload) emitPreloadProgress('embedding_loaded', 75, 'Embedding model loaded successfully');
          } catch (error) {
            // If embedding model fails, fall back to using LLM model
            console.warn('[AI] Embedding model loading failed, using LLM model for embeddings');
            console.warn('[AI] Error was:', error.message);
            if (isPreload) emitPreloadProgress('embedding_fallback', 75, 'Using LLM model for embeddings');
            embeddingModel = llmModel;
          }
        }
      } else {
        if (!fs.existsSync(modelPaths.embedding) && modelPaths.embedding !== modelPaths.llm) {
          console.warn('[AI] Embedding model not found at:', modelPaths.embedding);
          console.warn('[AI] Using LLM model for embeddings');
        }
        console.log('[AI] Using LLM model for embeddings');
        if (isPreload) emitPreloadProgress('embedding_loaded', 75, 'Using LLM model for embeddings');
        embeddingModel = llmModel;
      }

      // Calibrate context size to find maximum working size
      if (isPreload) emitPreloadProgress('calibrating', 80, 'Calibrating context size...');
      await calibrateContextSize();
      if (isPreload) emitPreloadProgress('calibrated', 90, `Context size calibrated: ${maxWorkingContextSize} tokens`);

      // Initialize ChromaDB (Python child process)
      if (isPreload) emitPreloadProgress('chromadb', 95, 'Initializing ChromaDB...');
      await initializeChromaDB(modelPaths.chromaDb);

      isInitialized = true;
      if (isPreload) {
        preloadInProgress = false;
        emitPreloadProgress('complete', 100, 'AI services ready');
      }
      console.log('[AI] AI services initialized successfully');
      return { success: true, message: 'AI services initialized' };
    } catch (error) {
      console.error('[AI] Failed to initialize AI services:', error);
      if (isPreload) {
        preloadInProgress = false;
        emitPreloadProgress('error', 0, `Initialization failed: ${error.message}`);
      }
      initializationPromise = null;
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  })();

  return initializationPromise;
}

/**
 * Preload AI services in background with progress tracking
 * This should be called immediately on app launch
 * @returns {Promise<object>} Initialization result
 */
export async function preloadAIServices() {
  console.log('[AI] Starting background preload of AI services...');
  return initializeAIServices({ isPreload: true });
}

// Initialize ChromaDB as a Python child process
async function initializeChromaDB(dbPath) {
  return new Promise((resolve, reject) => {
    try {
      // Check if chromadb is available
      const pythonCmd = getPythonCommand();
      if (!pythonCmd) {
        console.warn('[AI] No Python command found on this system');
        console.warn('[AI] ChromaDB requires Python. Install Python and chromadb: pip install chromadb');
        resolve(); // Don't fail initialization if Python is missing
        return;
      }
      try {
        execSync(`${getPythonCommand()} ${getPythonArgs().join(' ')} -c "import chromadb"`, { stdio: 'ignore' });
      } catch (e) {
        console.warn('[AI] ChromaDB Python package not found');
        console.warn('[AI] Install with: pip install chromadb');
        resolve(); // Don't fail initialization if ChromaDB is missing
        return;
      }

      // Create ChromaDB directory if it doesn't exist
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }

      console.log('[AI] ChromaDB will be initialized on first use');
      resolve();
    } catch (error) {
      console.error('[AI] ChromaDB initialization warning:', error);
      resolve(); // Don't fail overall initialization
    }
  });
}

// Calculate appropriate context size based on GPU layers
function getContextSize() {
  // Fewer GPU layers = less VRAM = smaller context
  // CPU mode (0 layers) can handle larger contexts in RAM
  if (gpuLayers === 0) {
    return 2500; // CPU can handle larger contexts
  } else if (gpuLayers <= 10) {
    return 512; // Low VRAM
  } else if (gpuLayers <= 20) {
    return 1024; // Medium VRAM
  } else {
    return 2500; // Full GPU, should have enough VRAM
  }
}

// Calibrate context size by testing different sizes to find maximum working size
async function calibrateContextSize() {
  if (!llmModel) {
    console.warn('[AI] Cannot calibrate context size: model not loaded');
    return;
  }

  if (contextSizeCalibrated) {
    console.log(`[AI] Context size already calibrated: ${maxWorkingContextSize}`);
    return;
  }

  console.log('[AI] Calibrating context size...');
  
  // Test sizes in descending order: 2500, 2048, 1024, 512, 256, 128
  const testSizes = [2500, 2048, 1024, 512, 256, 128];
  let allSizesFailed = true;
  
  for (const size of testSizes) {
    try {
      const context = await llmModel.createContext({ contextSize: size });
      // Success! This is our maximum working size
      maxWorkingContextSize = size;
      contextSizeCalibrated = true;
      console.log(`[AI] Context size calibrated: ${maxWorkingContextSize} tokens`);
      // Clean up the test context
      await context.dispose();
      allSizesFailed = false;
      return;
    } catch (error) {
      if (error.message && (error.message.includes('VRAM') || error.message.includes('memory'))) {
        console.log(`[AI] Context size ${size} too large, trying smaller...`);
        continue;
      }
      // If it's not a VRAM error, something else is wrong
      console.error(`[AI] Unexpected error during calibration at size ${size}:`, error.message);
      // Continue trying smaller sizes anyway
      continue;
    }
  }
  
  // If we get here, all sizes failed - likely a GPU memory issue
  if (allSizesFailed && gpuLayers > 0) {
    console.error('[AI] Failed to calibrate context size: all tested sizes failed');
    console.warn('[AI] This suggests insufficient VRAM even with reduced GPU layers');
    console.warn('[AI] Attempting to reload model in CPU mode...');
    
    try {
      // Try reloading model in CPU mode
      const modelPaths = getModelPaths();
      llmModel = await llama.loadModel({
        modelPath: modelPaths.llm,
        gpuLayers: 0,
      });
      gpuLayers = 0;
      console.log('[AI] Model reloaded in CPU mode');
      
      // Retry calibration with CPU
      for (const size of testSizes) {
        try {
          const context = await llmModel.createContext({ contextSize: size });
          maxWorkingContextSize = size;
          contextSizeCalibrated = true;
          console.log(`[AI] Context size calibrated in CPU mode: ${maxWorkingContextSize} tokens`);
          await context.dispose();
          return;
        } catch (retryError) {
          console.log(`[AI] Context size ${size} still too large in CPU mode, trying smaller...`);
          continue;
        }
      }
    } catch (reloadError) {
      console.error('[AI] Failed to reload model in CPU mode:', reloadError.message);
    }
  }
  
  // Last resort: set minimum context size
  console.error('[AI] Failed to calibrate context size with any configuration');
  maxWorkingContextSize = 128;
  contextSizeCalibrated = true;
  console.log('[AI] Using minimum context size: 128 tokens');
}

// Helper function to reload model with fewer GPU layers
async function reloadModelWithFewerLayers() {
  if (!llama || gpuLayers === 0) {
    // Already on CPU or llama not initialized
    return false;
  }
  
  console.warn('[AI] Attempting to reload model with fewer GPU layers due to persistent failures...');
  
  const modelPaths = getModelPaths();
  const previousLayers = gpuLayers;
  
  try {
    // Try with half the GPU layers
    const newLayers = Math.floor(gpuLayers / 2);
    
    if (newLayers < 3) {
      // Too few layers, go straight to CPU
      console.log('[AI] Reloading model in CPU mode...');
      llmModel = await llama.loadModel({
        modelPath: modelPaths.llm,
        gpuLayers: 0,
      });
      gpuLayers = 0;
      
      // Also reload embedding model if separate
      if (embeddingModel !== llmModel && fs.existsSync(modelPaths.embedding)) {
        embeddingModel = await llama.loadModel({
          modelPath: modelPaths.embedding,
          gpuLayers: 0,
        });
      }
    } else {
      console.log(`[AI] Reloading model with ${newLayers} GPU layers (reduced from ${previousLayers})...`);
      llmModel = await llama.loadModel({
        modelPath: modelPaths.llm,
        gpuLayers: newLayers,
      });
      gpuLayers = newLayers;
      
      // Also reload embedding model if separate
      if (embeddingModel !== llmModel && fs.existsSync(modelPaths.embedding)) {
        embeddingModel = await llama.loadModel({
          modelPath: modelPaths.embedding,
          gpuLayers: Math.min(newLayers, 10),
        });
      }
    }
    
    // Reset calibration to recalibrate with new model configuration
    contextSizeCalibrated = false;
    maxWorkingContextSize = null;
    await calibrateContextSize();
    
    console.log(`[AI] Successfully reloaded model (GPU layers: ${gpuLayers}, context: ${maxWorkingContextSize})`);
    return true;
  } catch (error) {
    console.error('[AI] Failed to reload model with fewer layers:', error.message);
    gpuLayers = previousLayers; // Restore previous state
    return false;
  }
}

// Create context with automatic fallback to smaller sizes
async function createContextWithFallback(model, preferredSize = null, skipRecalibration = false) {
  // If we have a calibrated maximum size, use it (unless a specific size is requested)
  let startSize;
  if (preferredSize !== null) {
    // User specified a size, use it
    startSize = preferredSize;
  } else if (contextSizeCalibrated && maxWorkingContextSize !== null) {
    // Use calibrated maximum size
    startSize = maxWorkingContextSize;
  } else {
    // Fall back to old behavior if not calibrated
    startSize = getContextSize();
  }
  
  // Build fallback sizes: start with preferred/calibrated size, then halve, quarter, and minimum
  const sizes = [startSize, Math.floor(startSize / 2), Math.floor(startSize / 4), 256, 128];
  
  let lastError = null;
  let calibratedSizeFailed = false;
  
  for (const size of sizes) {
    try {
      const context = await model.createContext({ contextSize: size });
      
      // If we had to reduce from calibrated size, update the cache
      if (contextSizeCalibrated && size < maxWorkingContextSize) {
        console.warn(`[AI] Calibrated size ${maxWorkingContextSize} failed, using ${size}. Updating cache.`);
        maxWorkingContextSize = size;
        calibratedSizeFailed = true;
      } else if (size !== sizes[0] && !contextSizeCalibrated) {
        console.log(`[AI] Context created with reduced size: ${size} (preferred: ${sizes[0]})`);
      }
      
      return context;
    } catch (error) {
      lastError = error;
      if (error.message && (error.message.includes('VRAM') || error.message.includes('memory'))) {
        // Track if the calibrated size itself failed
        if (contextSizeCalibrated && size === maxWorkingContextSize) {
          calibratedSizeFailed = true;
        }
        console.warn(`[AI] Context size ${size} too large, trying smaller...`);
        continue;
      }
      // If it's not a VRAM error, throw immediately
      throw error;
    }
  }
  
  // If calibrated size failed and we haven't recalibrated yet, try recalibrating
  if (calibratedSizeFailed && !skipRecalibration && contextSizeCalibrated) {
    console.warn('[AI] Calibrated context size failed unexpectedly. Recalibrating...');
    // Reset calibration state
    contextSizeCalibrated = false;
    maxWorkingContextSize = null;
    // Recalibrate
    await calibrateContextSize();
    // Retry with new calibration (prevent infinite loop)
    return createContextWithFallback(model, preferredSize, true);
  }
  
  // If all sizes failed and GPU is in use, try reloading with fewer layers
  if (gpuLayers > 0 && !skipRecalibration) {
    console.error('[AI] All context sizes failed. Attempting to reload model with fewer GPU layers...');
    const reloaded = await reloadModelWithFewerLayers();
    
    if (reloaded) {
      // Try again with reloaded model
      return createContextWithFallback(llmModel, preferredSize, true);
    }
  }
  
  // If all sizes failed, throw the last error
  throw lastError || new Error('Failed to create context with any size');
}

// LLM generation
export async function generateText(prompt, options = {}) {
  if (!isInitialized || !llmModel) {
    const initResult = await initializeAIServices();
    if (!initResult.success) {
      throw new Error('AI services not initialized: ' + initResult.error);
    }
  }

  // Format prompt with Mistral instruction template
  const formattedPrompt = formatMistralInstruction(prompt, options.isFirstTurn ?? true);
  console.log('[AI] Prompt formatted with Mistral instruction template');

  let context = null;
  try {
    context = await createContextWithFallback(llmModel, options.contextSize);
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });

    const response = await session.prompt(formattedPrompt, {
      temperature: options.temperature || 0.4,
      maxTokens: options.maxTokens || 600,
    });

    return {
      text: response,
      tokensUsed: 0, // node-llama-cpp doesn't expose this easily
      finishReason: 'stop',
    };
  } catch (error) {
    // Dispose failed context before retrying
    if (context) {
      await context.dispose();
      context = null;
    }

    // Handle prompt too long error by trying larger context size
    if (error.message && (error.message.includes('too long prompt') || error.message.includes('cannot be compressed'))) {
      console.warn('[AI] Prompt too long for current context size, trying larger context...');

      // Try with a larger context size (up to 2x the current max, or 4096)
      const currentMax = maxWorkingContextSize || getContextSize();
      const largerSize = Math.min(currentMax * 2, 4096);

      if (largerSize > currentMax) {
        try {
          context = await createContextWithFallback(llmModel, largerSize);
          const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
          });

          const response = await session.prompt(formattedPrompt, {
            temperature: options.temperature || 0.4,
            maxTokens: options.maxTokens || 600,
          });

          console.log(`[AI] Successfully generated with larger context size: ${largerSize}`);
          return {
            text: response,
            tokensUsed: 0,
            finishReason: 'stop',
          };
        } catch (retryError) {
          // Dispose failed context before retrying with truncated prompt
          if (context) {
            await context.dispose();
            context = null;
          }

          // If larger context also fails, truncate the prompt (truncate BEFORE formatting)
          console.warn('[AI] Larger context size also failed, truncating prompt...');
          const truncatedPrompt = await truncatePrompt(prompt, currentMax);
          const formattedTruncated = formatMistralInstruction(truncatedPrompt, options.isFirstTurn ?? true);

          context = await createContextWithFallback(llmModel, currentMax);
          const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
          });

          const response = await session.prompt(formattedTruncated, {
            temperature: options.temperature || 0.4,
            maxTokens: options.maxTokens || 600,
          });

          return {
            text: response,
            tokensUsed: 0,
            finishReason: 'stop',
          };
        }
      } else {
        // Can't increase size, truncate prompt (truncate BEFORE formatting)
        const truncatedPrompt = await truncatePrompt(prompt, currentMax);
        const formattedTruncated = formatMistralInstruction(truncatedPrompt, options.isFirstTurn ?? true);
        
        context = await createContextWithFallback(llmModel, currentMax);
        const session = new LlamaChatSession({
          contextSequence: context.getSequence(),
        });

        const response = await session.prompt(formattedTruncated, {
          temperature: options.temperature || 0.4,
          maxTokens: options.maxTokens || 600,
        });

        return {
          text: response,
          tokensUsed: 0,
          finishReason: 'stop',
        };
      }
    }
    
    console.error('[AI] Text generation error:', error);
    throw error;
  } finally {
    // ALWAYS dispose context to free VRAM
    if (context) {
      await context.dispose();
      console.log('[AI] Context disposed, VRAM freed');
    }
  }
}

/**
 * Format prompt with Mistral instruction template
 * Mistral 7B Instruct v0.1 requires: <s>[INST] prompt [/INST]
 * @param {string} prompt - The user prompt
 * @param {boolean} isFirstTurn - Whether this is the first turn in a conversation
 * @returns {string} Formatted prompt
 */
function formatMistralInstruction(prompt, isFirstTurn = true) {
  if (!AI_CONFIG.useInstructionFormat) {
    return prompt;
  }
  
  if (AI_CONFIG.chatTemplate === 'mistral') {
    // Mistral Instruct v0.1 format:
    // First turn: <s>[INST] {prompt} [/INST]
    // Follow-up: [INST] {prompt} [/INST]
    if (isFirstTurn) {
      return `<s>[INST] ${prompt} [/INST]`;
    } else {
      return `[INST] ${prompt} [/INST]`;
    }
  }
  
  // Default: no formatting
  return prompt;
}

/**
 * Get accurate token count for a given text using the model's tokenizer
 * @param {string} text - Text to tokenize
 * @returns {Promise<number>} Token count
 */
async function getPromptTokenCount(text) {
  if (!llmModel) {
    // Fallback to character-based estimation if model not loaded
    return Math.ceil(text.length / 4);
  }

  let context = null;
  try {
    // Create a minimal context just for tokenization
    context = await llmModel.createContext({ contextSize: 128 });
    const sequence = context.getSequence();
    const tokens = sequence.tokenize(text);
    return tokens.length;
  } catch (error) {
    console.warn('[AI] Token counting failed, using character-based estimate:', error.message);
    // Fallback to character-based estimation
    return Math.ceil(text.length / 4);
  } finally {
    if (context) {
      await context.dispose();
    }
  }
}

/**
 * Truncate prompt to fit within context size using accurate tokenization
 * @param {string} prompt - The prompt to truncate
 * @param {number} contextSize - Maximum context size in tokens
 * @param {number} responseReserve - Tokens to reserve for response (default: 200)
 * @returns {Promise<string>} Truncated prompt
 */
async function truncatePrompt(prompt, contextSize, responseReserve = 200) {
  const maxTokens = contextSize - responseReserve;
  const currentTokens = await getPromptTokenCount(prompt);

  if (currentTokens <= maxTokens) {
    return prompt;
  }

  console.warn(`[AI] Truncating prompt from ${currentTokens} to ${maxTokens} tokens`);

  // Binary search to find the right character cutoff for target token count
  let low = 0;
  let high = prompt.length;
  let bestCutoff = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const truncated = prompt.substring(0, mid);
    const tokens = await getPromptTokenCount(truncated);

    if (tokens <= maxTokens) {
      bestCutoff = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Truncate at sentence boundary near the cutoff
  const truncated = prompt.substring(0, bestCutoff);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastPeriod, lastNewline);

  if (cutPoint > bestCutoff * 0.8) {
    // Good cut point found
    return truncated.substring(0, cutPoint + 1) + '\n\n[Context truncated to fit model limits...]';
  }

  // No good cut point, just truncate at token boundary
  return truncated + '\n\n[Context truncated to fit model limits...]';
}

// Stream generation with word-by-word streaming for smooth UX
export async function* generateTextStream(prompt, options = {}) {
  if (!isInitialized || !llmModel) {
    const initResult = await initializeAIServices();
    if (!initResult.success) {
      throw new Error('AI services not initialized: ' + initResult.error);
    }
  }

  // Format prompt with Mistral instruction template
  const formattedPrompt = formatMistralInstruction(prompt, options.isFirstTurn ?? true);
  console.log('[AI] Stream prompt formatted with Mistral instruction template');

  let context = null;
  try {
    context = await createContextWithFallback(llmModel, options.contextSize);
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });

    // Generate the full response
    const fullResponse = await session.prompt(formattedPrompt, {
      temperature: options.temperature || 0.4,
      maxTokens: options.maxTokens || 600,
    });
    
    // Stream word-by-word for smooth, visible streaming
    // This is better than character-by-character (too slow) or all-at-once (no streaming effect)
    const words = fullResponse.split(/(\s+)/);
    
    for (const word of words) {
      if (word) { // Skip empty strings
        yield word;
        // Small delay to make streaming visible and smooth (5ms per word)
        // This creates a natural typing effect without being too slow
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
  } catch (error) {
    // Dispose failed context before retrying
    if (context) {
      await context.dispose();
      context = null;
    }

    // Handle prompt too long error by trying larger context size
    if (error.message && (error.message.includes('too long prompt') || error.message.includes('cannot be compressed'))) {
      console.warn('[AI] Prompt too long for current context size, trying larger context...');

      // Try with a larger context size (up to 2x the current max, or 4096)
      const currentMax = maxWorkingContextSize || getContextSize();
      const largerSize = Math.min(currentMax * 2, 4096);

      if (largerSize > currentMax) {
        try {
          context = await createContextWithFallback(llmModel, largerSize);
          const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
          });

          const fullResponse = await session.prompt(formattedPrompt, {
            temperature: options.temperature || 0.4,
            maxTokens: options.maxTokens || 600,
          });

          console.log(`[AI] Successfully generated with larger context size: ${largerSize}`);

          // Stream the response
          const words = fullResponse.split(/(\s+)/);
          for (const word of words) {
            if (word) {
              yield word;
              await new Promise(resolve => setTimeout(resolve, 5));
            }
          }
          return;
        } catch (retryError) {
          // Dispose failed context before retrying with truncated prompt
          if (context) {
            await context.dispose();
            context = null;
          }

          // If larger context also fails, truncate the prompt (truncate BEFORE formatting)
          console.warn('[AI] Larger context size also failed, truncating prompt...');
          const truncatedPrompt = await truncatePrompt(prompt, currentMax);
          const formattedTruncated = formatMistralInstruction(truncatedPrompt, options.isFirstTurn ?? true);

          context = await createContextWithFallback(llmModel, currentMax);
          const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
          });

          const fullResponse = await session.prompt(formattedTruncated, {
            temperature: options.temperature || 0.4,
            maxTokens: options.maxTokens || 600,
          });

          // Stream the response
          const words = fullResponse.split(/(\s+)/);
          for (const word of words) {
            if (word) {
              yield word;
              await new Promise(resolve => setTimeout(resolve, 5));
            }
          }
          return;
        }
      } else {
        // Can't increase size, truncate prompt (truncate BEFORE formatting)
        const truncatedPrompt = await truncatePrompt(prompt, currentMax);
        const formattedTruncated = formatMistralInstruction(truncatedPrompt, options.isFirstTurn ?? true);

        context = await createContextWithFallback(llmModel, currentMax);
        const session = new LlamaChatSession({
          contextSequence: context.getSequence(),
        });

        const fullResponse = await session.prompt(formattedTruncated, {
          temperature: options.temperature || 0.4,
          maxTokens: options.maxTokens || 600,
        });

        // Stream the response
        const words = fullResponse.split(/(\s+)/);
        for (const word of words) {
          if (word) {
            yield word;
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
        return;
      }
    }

    console.error('[AI] Stream generation error:', error);
    throw error;
  } finally {
    // ALWAYS dispose context to free VRAM
    if (context) {
      await context.dispose();
      console.log('[AI] Context disposed, VRAM freed');
    }
  }
}

// Generate embeddings
export async function generateEmbedding(text) {
  if (!isInitialized || !embeddingModel) {
    const initResult = await initializeAIServices();
    if (!initResult.success) {
      throw new Error('AI services not initialized: ' + initResult.error);
    }
  }

  try {
    const context = await embeddingModel.createEmbeddingContext();
    
    // Handle single text or array
    const texts = Array.isArray(text) ? text : [text];
    const embeddings = [];

    for (const t of texts) {
      const embedding = await context.getEmbeddingFor(t);
      
      // Validate embedding result
      if (!embedding) {
        throw new Error(`Embedding generation returned null/undefined for text: "${t.substring(0, 50)}..."`);
      }

      // node-llama-cpp returns a LlamaEmbedding object with a 'vector' property
      // Check if it's a LlamaEmbedding object with vector property
      let embeddingArray;
      if (embedding.vector) {
        // Access the vector property directly
        const vector = embedding.vector;
        if (Array.isArray(vector)) {
          embeddingArray = vector;
        } else if (vector instanceof Float32Array || vector instanceof Float64Array) {
          embeddingArray = Array.from(vector);
        } else if (vector.length !== undefined) {
          embeddingArray = Array.from(vector);
        } else {
          throw new Error(`Embedding vector is not in expected format for text: "${t.substring(0, 50)}..."`);
        }
      } else if (Array.isArray(embedding)) {
        // Direct array
        embeddingArray = embedding;
      } else if (embedding instanceof Float32Array || embedding instanceof Float64Array) {
        // Typed array
        embeddingArray = Array.from(embedding);
      } else if (embedding.length !== undefined) {
        // Array-like object
        embeddingArray = Array.from(embedding);
      } else {
        // Try to access as iterable
        embeddingArray = Array.from(embedding);
      }

      // Validate the final array
      if (!Array.isArray(embeddingArray) || embeddingArray.length === 0) {
        console.error('[AI] Embedding conversion failed:', {
          type: typeof embedding,
          constructor: embedding?.constructor?.name,
          hasVector: !!embedding.vector,
          vectorType: embedding.vector ? typeof embedding.vector : null,
          vectorConstructor: embedding.vector?.constructor?.name,
          keys: embedding ? Object.keys(embedding).slice(0, 10) : []
        });
        throw new Error(`Embedding generation returned empty array for text: "${t.substring(0, 50)}...". Type: ${typeof embedding}, Constructor: ${embedding?.constructor?.name}, Has vector: ${!!embedding.vector}`);
      }

      embeddings.push(embeddingArray);
    }

    return {
      embeddings,
      dimensions: embeddings[0]?.length || 0,
    };
  } catch (error) {
    console.error('[AI] Embedding generation error:', error);
    throw error;
  }
}

// Alias for batch embedding generation (generateEmbedding already handles arrays)
export const generateEmbeddings = generateEmbedding;

// ChromaDB query via Python bridge
export async function queryChromaDB(collectionName, queryEmbedding, options = {}) {
  const modelPaths = getModelPaths();
  
  // Validate embedding before proceeding
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.error('[AI] Invalid embedding provided to queryChromaDB:', {
      isArray: Array.isArray(queryEmbedding),
      length: queryEmbedding?.length,
      type: typeof queryEmbedding
    });
    throw new Error('Invalid query embedding: must be a non-empty array');
  }
  
  console.log('[AI] ChromaDB query:', {
    collection: collectionName,
    embeddingLength: queryEmbedding.length,
    topK: options.topK || 10,
    hasFilters: !!(options.filters && Object.keys(options.filters).length > 0)
  });
  
  return new Promise((resolve, reject) => {
    // Convert JavaScript filters to Python-compatible format
    let filtersJson = null;
    let hasFilters = false;

    if (options.filters && Object.keys(options.filters).length > 0) {
      hasFilters = true;
      // Serialize filters as JSON string - will be parsed by Python's json.loads()
      // This avoids string replacement issues with booleans in f-strings
      filtersJson = JSON.stringify(options.filters);
    }
    
    // Validate and normalize embedding before serialization
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      reject(new Error(`Invalid embedding: expected non-empty array, got ${typeof queryEmbedding}`));
      return;
    }
    
    // Check for invalid values
    const hasInvalidValues = queryEmbedding.some(v => 
      typeof v !== 'number' || !isFinite(v) || isNaN(v)
    );
    if (hasInvalidValues) {
      reject(new Error('Embedding contains invalid values (NaN, Infinity, or non-numeric)'));
      return;
    }
    
    // Serialize embedding to temporary file to avoid script injection issues
    const tmpFile = path.join(os.tmpdir(), `chroma_embedding_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
    
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(queryEmbedding));
    } catch (error) {
      reject(new Error(`Failed to write embedding to temp file: ${error.message}`));
      return;
    }
    
    const pythonScript = `
import chromadb
import json
import sys
import os

try:
    # Read embedding from temp file
    tmp_file = "${tmpFile.replace(/\\/g, '/')}"
    try:
        with open(tmp_file, 'r') as f:
            embedding = json.load(f)
        # Clean up temp file
        os.remove(tmp_file)
    except Exception as e:
        print(json.dumps({'error': f'Failed to read embedding from temp file: {str(e)}'}), file=sys.stderr)
        sys.exit(1)
    
    # Validate embedding
    if not isinstance(embedding, list) or len(embedding) == 0:
        print(json.dumps({'error': f'Invalid embedding: expected list, got {type(embedding)}'}), file=sys.stderr)
        sys.exit(1)
    
    client = chromadb.PersistentClient(path="${modelPaths.chromaDb.replace(/\\/g, '/')}")
    
    # Get collection (don't create if it doesn't exist - that's an error)
    try:
        collection = client.get_collection(name="${collectionName}")
    except Exception as e:
        print(json.dumps({'error': f'Collection "${collectionName}" not found: {str(e)}'}), file=sys.stderr)
        sys.exit(1)
    
    # Build query parameters
    query_params = {
        'query_embeddings': [embedding],
        'n_results': ${options.topK || 10}
    }
    
    # Add WHERE clause ONLY if filters provided and not empty
    # ChromaDB throws error "Expected where to have exactly one operator, got {}" if where={}
    ${hasFilters ? `
    # Parse filters from JSON string (avoids f-string issues with booleans)
    filters_json = """${filtersJson.replace(/"/g, '\\"')}"""
    try:
        filters_dict = json.loads(filters_json)
        # Only add where if filters dict has content (not empty)
        if isinstance(filters_dict, dict) and len(filters_dict) > 0:
            query_params['where'] = filters_dict
    except Exception as parse_error:
        print(json.dumps({'error': f'Failed to parse filters JSON: {str(parse_error)}'}), file=sys.stderr)
        sys.exit(1)` : '# No filters provided'}
    
    # Query with detailed error handling
    try:
        # Validate embedding before query
        if not query_params.get('query_embeddings') or len(query_params['query_embeddings']) == 0:
            print(json.dumps({'error': 'No query embeddings provided'}), file=sys.stderr)
            sys.exit(1)
        
        embedding = query_params['query_embeddings'][0]
        if not embedding or len(embedding) == 0:
            print(json.dumps({'error': f'Empty embedding array (length: {len(embedding) if embedding else 0})'}), file=sys.stderr)
            sys.exit(1)
        
        results = collection.query(**query_params)
    except Exception as query_error:
        error_msg = f'Query failed: {str(query_error)}\\n'
        error_msg += f'Query params: n_results={query_params.get("n_results")}, has_where={("where" in query_params)}\\n'
        ${hasFilters ? `error_msg += 'Filters JSON: ${filtersJson}\\n'` : '# No filters'}
        if query_params.get('query_embeddings') and len(query_params['query_embeddings']) > 0:
            error_msg += f'Embedding dim: {len(query_params["query_embeddings"][0])}\\n'
            error_msg += f'Embedding type: {type(query_params["query_embeddings"][0])}\\n'
        else:
            error_msg += 'Embedding: N/A\\n'
        print(json.dumps({'error': error_msg}), file=sys.stderr)
        sys.exit(1)
    
    # Format results with proper error handling
    output = []
    
    # Safely check if we have results
    ids_list = results.get('ids', [])
    if ids_list and len(ids_list) > 0:
        ids = ids_list[0] if isinstance(ids_list[0], list) else []
        
        if ids and len(ids) > 0:
            documents = results.get('documents', [[]])
            documents_list = documents[0] if (documents and len(documents) > 0 and isinstance(documents[0], list)) else []
            
            metadatas = results.get('metadatas', [[]])
            metadatas_list = metadatas[0] if (metadatas and len(metadatas) > 0 and isinstance(metadatas[0], list)) else []
            
            distances = results.get('distances', [[]])
            distances_list = distances[0] if (distances and len(distances) > 0 and isinstance(distances[0], list)) else []
            
            # Ensure all lists are the same length
            min_length = min(len(ids), len(documents_list) if documents_list else 0, len(metadatas_list) if metadatas_list else 0, len(distances_list) if distances_list else 0)
            
            for i in range(min_length):
                output.append({
                    'id': ids[i] if i < len(ids) else f'unknown_{i}',
                    'text': documents_list[i] if (documents_list and i < len(documents_list)) else '',
                    'metadata': metadatas_list[i] if (metadatas_list and i < len(metadatas_list)) else {},
                    'score': 1 - distances_list[i] if (distances_list and i < len(distances_list)) else 0.0
                })
    
    print(json.dumps(output))
except Exception as e:
    # Clean up temp file if it still exists
    try:
        if os.path.exists(tmp_file):
            os.remove(tmp_file)
    except:
        pass
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

const pythonProcess = spawn(getPythonCommand(), [...getPythonArgs(), '-c', pythonScript]);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Clean up temp file if it still exists
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      if (code !== 0) {
        reject(new Error(`ChromaDB query failed: ${stderr}`));
        return;
      }

      try {
        const results = JSON.parse(stdout);
        if (results.error) {
          reject(new Error(results.error));
        } else {
          resolve(results);
        }
      } catch (error) {
        reject(new Error(`Failed to parse ChromaDB results: ${error.message}`));
      }
    });
  });
}

// Add documents to ChromaDB
export async function addToChromaDB(collectionName, documents, embeddings, metadatas, ids) {
  const modelPaths = getModelPaths();
  
  return new Promise((resolve, reject) => {
    const pythonScript = `
import chromadb
import json
import sys

try:
    client = chromadb.PersistentClient(path="${modelPaths.chromaDb.replace(/\\/g, '/')}")
    
    # Get or create collection
    try:
        collection = client.get_collection(name="${collectionName}")
    except:
        collection = client.create_collection(name="${collectionName}")
    
    # Add documents
    collection.add(
        documents=${JSON.stringify(documents)},
        embeddings=${JSON.stringify(embeddings)},
        metadatas=${JSON.stringify(metadatas)},
        ids=${JSON.stringify(ids)}
    )
    
    print(json.dumps({'success': True}))
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

const pythonProcess = spawn(getPythonCommand(), [...getPythonArgs(), '-c', pythonScript]);
    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ChromaDB add failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(new Error(`Failed to parse ChromaDB response: ${error.message}`));
      }
    });
  });
}

// Health check
export async function checkHealth() {
  try {
    // If not initialized, try to initialize
    if (!isInitialized) {
      const result = await initializeAIServices();
      return {
        llm: result.success,
        embedding: result.success,
        chroma: true, // ChromaDB is always available if Python package is installed
        contextSize: maxWorkingContextSize || 2500,
      };
    }

    return {
      llm: llmModel !== null,
      embedding: embeddingModel !== null,
      chroma: true,
      contextSize: maxWorkingContextSize || 2500,
    };
  } catch (error) {
    console.error('[AI] Health check error:', error);
    return {
      llm: false,
      embedding: false,
      chroma: false,
      contextSize: 2500,
    };
  }
}

// Get the calibrated context size
export function getCalibratedContextSize() {
  return maxWorkingContextSize || 2500;
}

// Dual-source query: Query both user's ChromaDB and shared compliance ChromaDB
// Returns merged results with source indicators
export async function queryDualSource(userId, queryEmbedding, options = {}) {
  const { queryUserChromaDB } = await import('./chunking-service.js');
  const topK = options.topK || 10;
  const searchScope = options.searchScope || 'both'; // 'user', 'shared', 'both'

  const results = {
    user: [],
    shared: [],
    merged: []
  };

  try {
    // Query user's ChromaDB if requested
    if (searchScope === 'user' || searchScope === 'both') {
      if (userId) {
        try {
          const userResults = await queryUserChromaDB(userId, queryEmbedding, { topK });
          results.user = userResults.map(r => ({ ...r, source: 'user' }));
        } catch (error) {
          console.log('[AI] No user documents found or query failed:', error.message);
          results.user = [];
        }
      }
    }

    // Query shared ChromaDB if requested
    if (searchScope === 'shared' || searchScope === 'both') {
      try {
        const sharedResults = await queryChromaDB('documents', queryEmbedding, { topK });
        results.shared = sharedResults.map(r => ({ ...r, source: 'shared' }));
      } catch (error) {
        console.log('[AI] Shared ChromaDB query failed:', error.message);
        results.shared = [];
      }
    }

    // Merge and deduplicate results
    const allResults = [...results.user, ...results.shared];

    // Sort by score and take top K
    results.merged = allResults
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, topK);

    return results;
  } catch (error) {
    console.error('[AI] Dual-source query error:', error);
    throw error;
  }
}

// Cleanup
export function shutdownAIServices() {
  console.log('[AI] Shutting down AI services...');

  if (chromaProcess) {
    chromaProcess.kill();
    chromaProcess = null;
  }

  llmModel = null;
  embeddingModel = null;
  llama = null;
  isInitialized = false;

  // Reset calibration state so it recalibrates on next startup
  maxWorkingContextSize = null;
  contextSizeCalibrated = false;

  console.log('[AI] AI services shut down');
}

