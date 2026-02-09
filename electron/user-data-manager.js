// User Data Manager
// Manages per-user data directories for isolated document storage

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the base data path for the application
 * @returns {string} Base data directory path
 */
export function getBaseDataPath() {
  if (!app.isPackaged) {
    // Development mode: use .data directory in project root
    return path.join(__dirname, '..', '.data');
  } else if (process.env.APPIMAGE) {
    // AppImage: use directory next to the AppImage file
    return path.dirname(process.env.APPIMAGE);
  } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    // electron-builder portable: use original exe location (not temp extraction folder)
    return process.env.PORTABLE_EXECUTABLE_DIR;
  } else {
    // Packaged: use directory next to executable
    return path.dirname(process.execPath);
  }
}

/**
 * Get the path to a user's data directory
 * @param {string} userId - The user's unique ID from their license
 * @returns {string} User's data directory path
 */
export function getUserDataPath(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }
  // Sanitize userId to prevent directory traversal
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getBaseDataPath(), 'users', sanitizedUserId);
}

/**
 * Get the path to a user's ChromaDB directory
 * @param {string} userId - The user's unique ID from their license
 * @returns {string} User's ChromaDB directory path
 */
export function getUserChromaPath(userId) {
  return path.join(getUserDataPath(userId), 'chroma_db');
}

/**
 * Get the path to a user's uploads directory
 * @param {string} userId - The user's unique ID from their license
 * @returns {string} User's uploads directory path
 */
export function getUserUploadsPath(userId) {
  return path.join(getUserDataPath(userId), 'uploads');
}

/**
 * Get the path to a user's documents metadata file
 * @param {string} userId - The user's unique ID from their license
 * @returns {string} User's documents.json path
 */
export function getUserDocumentsMetadataPath(userId) {
  return path.join(getUserDataPath(userId), 'documents.json');
}

/**
 * Get the path to the shared ChromaDB (compliance library)
 * @returns {string} Shared ChromaDB directory path
 */
export function getSharedChromaPath() {
  return path.join(getBaseDataPath(), 'shared', 'chroma_db');
}

/**
 * Ensure all required user directories exist
 * @param {string} userId - The user's unique ID from their license
 * @returns {Promise<{success: boolean, paths: object, error?: string}>}
 */
export async function ensureUserDirectories(userId) {
  try {
    const userDataPath = getUserDataPath(userId);
    const chromaPath = getUserChromaPath(userId);
    const uploadsPath = getUserUploadsPath(userId);
    const documentsMetadataPath = getUserDocumentsMetadataPath(userId);

    // Create directories
    await fs.promises.mkdir(userDataPath, { recursive: true });
    await fs.promises.mkdir(chromaPath, { recursive: true });
    await fs.promises.mkdir(uploadsPath, { recursive: true });

    // Initialize documents.json if it doesn't exist
    if (!fs.existsSync(documentsMetadataPath)) {
      await fs.promises.writeFile(
        documentsMetadataPath,
        JSON.stringify({ documents: [] }, null, 2),
        'utf8'
      );
    }

    console.log(`[UserData] Ensured directories for user: ${userId}`);
    console.log(`[UserData]   Data path: ${userDataPath}`);
    console.log(`[UserData]   ChromaDB: ${chromaPath}`);
    console.log(`[UserData]   Uploads: ${uploadsPath}`);

    return {
      success: true,
      paths: {
        userData: userDataPath,
        chromaDb: chromaPath,
        uploads: uploadsPath,
        documentsMetadata: documentsMetadataPath,
      },
    };
  } catch (error) {
    console.error(`[UserData] Failed to ensure directories for user ${userId}:`, error);
    return {
      success: false,
      paths: {},
      error: error.message,
    };
  }
}

/**
 * Get the documents metadata for a user
 * @param {string} userId - The user's unique ID
 * @returns {Promise<{documents: Array}>}
 */
export async function getDocumentsMetadata(userId) {
  const metadataPath = getUserDocumentsMetadataPath(userId);

  try {
    if (!fs.existsSync(metadataPath)) {
      return { documents: [] };
    }

    const content = await fs.promises.readFile(metadataPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[UserData] Failed to read documents metadata:`, error);
    return { documents: [] };
  }
}

/**
 * Save the documents metadata for a user
 * @param {string} userId - The user's unique ID
 * @param {object} metadata - The metadata object to save
 * @returns {Promise<boolean>}
 */
export async function saveDocumentsMetadata(userId, metadata) {
  const metadataPath = getUserDocumentsMetadataPath(userId);

  try {
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    return true;
  } catch (error) {
    console.error(`[UserData] Failed to save documents metadata:`, error);
    return false;
  }
}

/**
 * Add a document to the user's metadata
 * @param {string} userId - The user's unique ID
 * @param {object} document - The document metadata to add
 * @returns {Promise<boolean>}
 */
export async function addDocumentMetadata(userId, document) {
  const metadata = await getDocumentsMetadata(userId);
  metadata.documents.push(document);
  return saveDocumentsMetadata(userId, metadata);
}

/**
 * Update a document in the user's metadata
 * @param {string} userId - The user's unique ID
 * @param {string} documentId - The document ID to update
 * @param {object} updates - The fields to update
 * @returns {Promise<boolean>}
 */
export async function updateDocumentMetadata(userId, documentId, updates) {
  const metadata = await getDocumentsMetadata(userId);
  const docIndex = metadata.documents.findIndex(d => d.id === documentId);

  if (docIndex === -1) {
    return false;
  }

  metadata.documents[docIndex] = { ...metadata.documents[docIndex], ...updates };
  return saveDocumentsMetadata(userId, metadata);
}

/**
 * Remove a document from the user's metadata
 * @param {string} userId - The user's unique ID
 * @param {string} documentId - The document ID to remove
 * @returns {Promise<boolean>}
 */
export async function removeDocumentMetadata(userId, documentId) {
  const metadata = await getDocumentsMetadata(userId);
  metadata.documents = metadata.documents.filter(d => d.id !== documentId);
  return saveDocumentsMetadata(userId, metadata);
}

/**
 * Delete a user's uploaded file
 * @param {string} userId - The user's unique ID
 * @param {string} filename - The filename to delete
 * @returns {Promise<boolean>}
 */
export async function deleteUserFile(userId, filename) {
  const filePath = path.join(getUserUploadsPath(userId), filename);

  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return true;
  } catch (error) {
    console.error(`[UserData] Failed to delete file ${filename}:`, error);
    return false;
  }
}

/**
 * Check if the shared ChromaDB exists and has data
 * @returns {boolean}
 */
export function sharedChromaExists() {
  const sharedPath = getSharedChromaPath();
  return fs.existsSync(sharedPath) && fs.existsSync(path.join(sharedPath, 'chroma.sqlite3'));
}

/**
 * Ensure the shared data directory structure exists
 * @returns {Promise<void>}
 */
export async function ensureSharedDirectories() {
  const sharedChromaPath = getSharedChromaPath();
  await fs.promises.mkdir(sharedChromaPath, { recursive: true });
  console.log(`[UserData] Ensured shared directories at: ${sharedChromaPath}`);
}
