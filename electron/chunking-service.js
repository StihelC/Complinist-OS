// Chunking Service
// Handles document processing via Python child process for IPC
// Enhanced with batch processing and queue management

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { app, ipcMain, BrowserWindow } from 'electron';
import { getPythonCommand } from './utils/python-command.js';
import {
  ensureUserDirectories,
  getUserUploadsPath,
  getUserChromaPath,
  getDocumentsMetadata,
  addDocumentMetadata,
  updateDocumentMetadata,
  removeDocumentMetadata,
  deleteUserFile,
} from './user-data-manager.js';
import { generateEmbeddings, addToChromaDB } from './ai-service-manager.js';
import { getQueueManager } from './queue-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Processing state
let processingQueue = [];
let currentlyProcessing = null;
let processingAborted = false;

// Queue manager instance
let queueManagerInstance = null;
let mainWindowRef = null;

/**
 * Get the path to the Python chunking script
 */
function getChunkingScriptPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'python', 'chunking', 'process_documents.py');
  } else {
    // In packaged app, Python scripts are bundled
    return path.join(process.resourcesPath, 'python', 'chunking', 'process_documents.py');
  }
}

/**
 * Copy uploaded file to user's uploads directory
 * @param {string} userId - User ID from license
 * @param {string} sourcePath - Path to the uploaded file
 * @returns {Promise<{success: boolean, destPath?: string, error?: string}>}
 */
export async function copyFileToUserUploads(userId, sourcePath) {
  try {
    // Ensure user directories exist
    await ensureUserDirectories(userId);

    const uploadsPath = getUserUploadsPath(userId);
    const filename = path.basename(sourcePath);
    const destPath = path.join(uploadsPath, filename);

    // Check if file already exists
    if (fs.existsSync(destPath)) {
      // Generate unique filename
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const timestamp = Date.now();
      const newFilename = `${base}_${timestamp}${ext}`;
      const newDestPath = path.join(uploadsPath, newFilename);
      await fs.promises.copyFile(sourcePath, newDestPath);
      return { success: true, destPath: newDestPath, filename: newFilename };
    }

    await fs.promises.copyFile(sourcePath, destPath);
    return { success: true, destPath, filename };
  } catch (error) {
    console.error('[Chunking] Error copying file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process a document using Python chunking
 * @param {string} filePath - Path to the document
 * @param {BrowserWindow} mainWindow - Main window for progress events
 * @returns {Promise<{success: boolean, chunks?: Array, error?: string}>}
 */
export function processDocument(filePath, mainWindow = null) {
  return new Promise((resolve, reject) => {
    const scriptPath = getChunkingScriptPath();

    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Chunking script not found: ${scriptPath}`));
      return;
    }

    console.log(`[Chunking] Processing document: ${filePath}`);
    console.log(`[Chunking] Using script: ${scriptPath}`);

    const pythonCmd = getPythonCommand();
    if (!pythonCmd) {
      reject(new Error('Python not found - required for document processing'));
      return;
    }
    const pythonProcess = spawn(pythonCmd, [
      scriptPath,
      '--file', filePath,
      '--output', 'json'
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // Send progress updates if available
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chunking:progress', {
          status: 'processing',
          message: data.toString()
        });
      }
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Chunking] Python process exited with code ${code}`);
        console.error(`[Chunking] stderr: ${stderr}`);
        reject(new Error(`Chunking failed: ${stderr || 'Unknown error'}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Processing failed'));
        }
      } catch (parseError) {
        console.error('[Chunking] Failed to parse output:', stdout);
        reject(new Error(`Failed to parse chunking output: ${parseError.message}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('[Chunking] Failed to start Python process:', error);
      reject(new Error(`Failed to start chunking process: ${error.message}`));
    });
  });
}

/**
 * Generate embeddings and store chunks in user's ChromaDB
 * @param {string} userId - User ID
 * @param {string} documentId - Document ID
 * @param {Array} chunks - Chunked document data
 * @param {BrowserWindow} mainWindow - Main window for progress
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function storeChunksInUserChroma(userId, documentId, chunks, mainWindow = null) {
  try {
    const userChromaPath = getUserChromaPath(userId);
    const collectionName = 'user_documents';

    console.log(`[Chunking] Storing ${chunks.length} chunks for user ${userId}`);

    // Process in batches to avoid memory issues
    const batchSize = 10;
    let processedCount = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      if (processingAborted) {
        throw new Error('Processing aborted by user');
      }

      const batch = chunks.slice(i, i + batchSize);

      // Extract texts for embedding
      const texts = batch.map(chunk => chunk.text);

      // Generate embeddings using existing ai-service-manager
      const embeddingResult = await generateEmbeddings(texts);
      const embeddings = embeddingResult.embeddings;

      // Prepare data for ChromaDB
      const ids = batch.map(chunk => `${documentId}_${chunk.id}`);
      const documents = batch.map(chunk => chunk.text);
      const metadatas = batch.map(chunk => ({
        ...chunk.metadata,
        document_id: documentId,
        user_id: userId
      }));

      // Add to user's ChromaDB
      await addToUserChromaDB(userId, collectionName, documents, embeddings, metadatas, ids);

      processedCount += batch.length;

      // Send progress update
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chunking:progress', {
          status: 'embedding',
          progress: Math.round((processedCount / chunks.length) * 100),
          message: `Embedded ${processedCount} of ${chunks.length} chunks`
        });
      }
    }

    console.log(`[Chunking] Successfully stored ${processedCount} chunks`);
    return { success: true, storedCount: processedCount };
  } catch (error) {
    console.error('[Chunking] Error storing chunks:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add chunks to user's ChromaDB via Python
 */
async function addToUserChromaDB(userId, collectionName, documents, embeddings, metadatas, ids) {
  const userChromaPath = getUserChromaPath(userId);

  return new Promise((resolve, reject) => {
    const pythonScript = `
import chromadb
import json
import sys

try:
    client = chromadb.PersistentClient(path="${userChromaPath.replace(/\\/g, '/')}")

    # Get or create collection with cosine distance
    try:
        collection = client.get_collection(name="${collectionName}")
    except:
        collection = client.create_collection(
            name="${collectionName}",
            metadata={"hnsw:space": "cosine"}
        )

    # Add documents
    collection.add(
        documents=${JSON.stringify(documents)},
        embeddings=${JSON.stringify(embeddings)},
        metadatas=${JSON.stringify(metadatas)},
        ids=${JSON.stringify(ids)}
    )

    print(json.dumps({'success': True, 'count': len(ids)}))
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    const addPythonCmd = getPythonCommand();
    if (!addPythonCmd) {
      reject(new Error('Python not found - required for ChromaDB operations'));
      return;
    }
    const pythonProcess = spawn(addPythonCmd, ['-c', pythonScript]);
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

/**
 * Query user's ChromaDB collection
 */
export async function queryUserChromaDB(userId, queryEmbedding, options = {}) {
  const userChromaPath = getUserChromaPath(userId);
  const collectionName = options.collection || 'user_documents';
  const topK = options.topK || 10;

  // Check if user has any documents
  if (!fs.existsSync(path.join(userChromaPath, 'chroma.sqlite3'))) {
    return []; // No user documents yet
  }

  return new Promise((resolve, reject) => {
    const pythonScript = `
import chromadb
import json
import sys

try:
    client = chromadb.PersistentClient(path="${userChromaPath.replace(/\\/g, '/')}")

    try:
        collection = client.get_collection(name="${collectionName}")
    except:
        # Collection doesn't exist, return empty results
        print(json.dumps([]))
        sys.exit(0)

    results = collection.query(
        query_embeddings=[${JSON.stringify(queryEmbedding)}],
        n_results=${topK}
    )

    output = []
    if results.get('ids') and len(results['ids']) > 0:
        ids = results['ids'][0] if isinstance(results['ids'][0], list) else results['ids']
        documents = results.get('documents', [[]])[0] if results.get('documents') else []
        metadatas = results.get('metadatas', [[]])[0] if results.get('metadatas') else []
        distances = results.get('distances', [[]])[0] if results.get('distances') else []

        for i in range(len(ids)):
            output.append({
                'id': ids[i] if i < len(ids) else f'unknown_{i}',
                'text': documents[i] if i < len(documents) else '',
                'metadata': metadatas[i] if i < len(metadatas) else {},
                'score': 1 - distances[i] if i < len(distances) else 0.0,
                'source': 'user'
            })

    print(json.dumps(output))
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    const queryPythonCmd = getPythonCommand();
    if (!queryPythonCmd) {
      reject(new Error('Python not found - required for ChromaDB queries'));
      return;
    }
    const pythonProcess = spawn(queryPythonCmd, ['-c', pythonScript]);
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

/**
 * Delete user's document chunks from ChromaDB
 */
export async function deleteUserDocumentChunks(userId, documentId) {
  const userChromaPath = getUserChromaPath(userId);
  const collectionName = 'user_documents';

  return new Promise((resolve, reject) => {
    const pythonScript = `
import chromadb
import json
import sys

try:
    client = chromadb.PersistentClient(path="${userChromaPath.replace(/\\/g, '/')}")

    try:
        collection = client.get_collection(name="${collectionName}")
    except:
        print(json.dumps({'success': True, 'deleted': 0}))
        sys.exit(0)

    # Get all IDs that start with the document ID
    all_results = collection.get(where={"document_id": "${documentId}"})

    if all_results.get('ids') and len(all_results['ids']) > 0:
        collection.delete(ids=all_results['ids'])
        print(json.dumps({'success': True, 'deleted': len(all_results['ids'])}))
    else:
        print(json.dumps({'success': True, 'deleted': 0}))

except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    const deletePythonCmd = getPythonCommand();
    if (!deletePythonCmd) {
      reject(new Error('Python not found - required for ChromaDB operations'));
      return;
    }
    const pythonProcess = spawn(deletePythonCmd, ['-c', pythonScript]);
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
        reject(new Error(`ChromaDB delete failed: ${stderr}`));
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

/**
 * Register IPC handlers for chunking service
 */
export function registerChunkingHandlers(mainWindow) {
  // Upload and process a document
  ipcMain.handle('chunking:upload-file', async (event, { userId, filePath }) => {
    try {
      // Copy file to user's uploads folder
      const copyResult = await copyFileToUserUploads(userId, filePath);
      if (!copyResult.success) {
        return { success: false, error: copyResult.error };
      }

      // Generate document ID
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add initial document metadata
      const docMetadata = {
        id: documentId,
        filename: copyResult.filename,
        originalPath: copyResult.destPath,
        uploadedAt: new Date().toISOString(),
        status: 'pending',
        fileType: path.extname(copyResult.filename).substring(1),
        sizeBytes: fs.statSync(copyResult.destPath).size
      };

      await addDocumentMetadata(userId, docMetadata);

      return {
        success: true,
        documentId,
        filename: copyResult.filename,
        filePath: copyResult.destPath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Process an uploaded document
  ipcMain.handle('chunking:process-document', async (event, { userId, documentId, filePath }) => {
    try {
      processingAborted = false;
      currentlyProcessing = documentId;

      // Update status to processing
      await updateDocumentMetadata(userId, documentId, { status: 'processing' });

      // Send initial progress
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chunking:progress', {
          documentId,
          status: 'processing',
          progress: 0,
          message: 'Starting document processing...'
        });
      }

      // Process document (extract text and chunk)
      const chunkResult = await processDocument(filePath, mainWindow);

      if (!chunkResult.success) {
        await updateDocumentMetadata(userId, documentId, {
          status: 'failed',
          error: chunkResult.error
        });
        return { success: false, error: chunkResult.error };
      }

      // Send progress
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chunking:progress', {
          documentId,
          status: 'embedding',
          progress: 50,
          message: `Generated ${chunkResult.chunk_count} chunks, creating embeddings...`
        });
      }

      // Store chunks in user's ChromaDB
      const storeResult = await storeChunksInUserChroma(
        userId,
        documentId,
        chunkResult.chunks,
        mainWindow
      );

      if (!storeResult.success) {
        await updateDocumentMetadata(userId, documentId, {
          status: 'failed',
          error: storeResult.error
        });
        return { success: false, error: storeResult.error };
      }

      // Update document metadata with success
      await updateDocumentMetadata(userId, documentId, {
        status: 'completed',
        processedAt: new Date().toISOString(),
        chunkCount: chunkResult.chunk_count
      });

      currentlyProcessing = null;

      // Send completion
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chunking:progress', {
          documentId,
          status: 'completed',
          progress: 100,
          message: 'Document processed successfully'
        });
      }

      return {
        success: true,
        documentId,
        chunkCount: chunkResult.chunk_count
      };
    } catch (error) {
      currentlyProcessing = null;
      await updateDocumentMetadata(userId, documentId, {
        status: 'failed',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Get list of user's documents
  ipcMain.handle('chunking:get-documents', async (event, { userId }) => {
    try {
      const metadata = await getDocumentsMetadata(userId);
      return { success: true, documents: metadata.documents || [] };
    } catch (error) {
      return { success: false, error: error.message, documents: [] };
    }
  });

  // Delete a document
  ipcMain.handle('chunking:delete-document', async (event, { userId, documentId }) => {
    try {
      const metadata = await getDocumentsMetadata(userId);
      const doc = metadata.documents.find(d => d.id === documentId);

      if (!doc) {
        return { success: false, error: 'Document not found' };
      }

      // Delete chunks from ChromaDB
      await deleteUserDocumentChunks(userId, documentId);

      // Delete the uploaded file
      if (doc.originalPath) {
        await deleteUserFile(userId, path.basename(doc.originalPath));
      }

      // Remove from metadata
      await removeDocumentMetadata(userId, documentId);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get processing status
  ipcMain.handle('chunking:get-status', async (event) => {
    return {
      currentlyProcessing,
      queueLength: processingQueue.length
    };
  });

  // Cancel processing
  ipcMain.handle('chunking:cancel', async (event) => {
    processingAborted = true;
    return { success: true };
  });

  // Query user documents
  ipcMain.handle('chunking:query-user-docs', async (event, { userId, queryEmbedding, topK }) => {
    try {
      const results = await queryUserChromaDB(userId, queryEmbedding, { topK });
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message, results: [] };
    }
  });

  // === BATCH PROCESSING HANDLERS ===

  // Upload multiple files at once
  ipcMain.handle('chunking:upload-batch', async (event, { userId, filePaths }) => {
    try {
      const results = [];

      for (const filePath of filePaths) {
        // Copy file to user's uploads folder
        const copyResult = await copyFileToUserUploads(userId, filePath);
        if (!copyResult.success) {
          results.push({
            success: false,
            filePath,
            error: copyResult.error
          });
          continue;
        }

        // Generate document ID
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Add initial document metadata
        const docMetadata = {
          id: documentId,
          filename: copyResult.filename,
          originalPath: copyResult.destPath,
          uploadedAt: new Date().toISOString(),
          status: 'pending',
          fileType: path.extname(copyResult.filename).substring(1),
          sizeBytes: fs.statSync(copyResult.destPath).size
        };

        await addDocumentMetadata(userId, docMetadata);

        results.push({
          success: true,
          documentId,
          filename: copyResult.filename,
          filePath: copyResult.destPath
        });
      }

      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message, results: [] };
    }
  });

  // Add documents to processing queue
  ipcMain.handle('chunking:queue-documents', async (event, { userId, documents }) => {
    try {
      const queueManager = getQueueManager();

      // Set up the processor if not already set
      if (!queueManagerInstance) {
        queueManagerInstance = queueManager;
        queueManager.setProcessor(async (item) => {
          return processQueuedDocument(item, mainWindow);
        });

        // Set up event listeners for queue updates
        queueManager.on('processing-started', (data) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chunking:queue-update', {
              type: 'started',
              ...data
            });
          }
        });

        queueManager.on('processing-completed', (data) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chunking:queue-update', {
              type: 'completed',
              ...data
            });
          }
        });

        queueManager.on('processing-failed', (data) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chunking:queue-update', {
              type: 'failed',
              ...data
            });
          }
        });

        queueManager.on('queue-empty', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chunking:queue-update', {
              type: 'queue-empty'
            });
          }
        });
      }

      // Add documents to queue
      const queueIds = queueManager.enqueueBatch(
        documents.map(doc => ({
          documentId: doc.documentId,
          userId: userId,
          filePath: doc.filePath,
          priority: doc.priority || 'normal'
        }))
      );

      return {
        success: true,
        queueIds,
        queueLength: queueManager.getStatus().queueLength
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get queue status
  ipcMain.handle('chunking:queue-status', async (event) => {
    const queueManager = getQueueManager();
    return queueManager.getStatus();
  });

  // Pause queue processing
  ipcMain.handle('chunking:queue-pause', async (event) => {
    const queueManager = getQueueManager();
    queueManager.pause();
    return { success: true };
  });

  // Resume queue processing
  ipcMain.handle('chunking:queue-resume', async (event) => {
    const queueManager = getQueueManager();
    queueManager.resume();
    return { success: true };
  });

  // Remove document from queue
  ipcMain.handle('chunking:queue-remove', async (event, { documentId }) => {
    const queueManager = getQueueManager();
    const removed = queueManager.dequeue(documentId);
    return { success: removed };
  });

  // Clear queue
  ipcMain.handle('chunking:queue-clear', async (event) => {
    const queueManager = getQueueManager();
    queueManager.clear();
    return { success: true };
  });

  // Store main window reference for queue events
  mainWindowRef = mainWindow;

  console.log('[Chunking] IPC handlers registered');
}

/**
 * Process a queued document (called by queue manager)
 * @param {Object} item - Queue item { documentId, userId, filePath }
 * @param {BrowserWindow} mainWindow - Main window for progress events
 */
async function processQueuedDocument(item, mainWindow) {
  const { documentId, userId, filePath } = item;

  try {
    processingAborted = false;
    currentlyProcessing = documentId;

    // Update status to processing
    await updateDocumentMetadata(userId, documentId, { status: 'processing' });

    // Send initial progress
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chunking:progress', {
        documentId,
        status: 'processing',
        progress: 0,
        message: 'Starting document processing...'
      });
    }

    // Process document (extract text and chunk)
    const chunkResult = await processDocument(filePath, mainWindow);

    if (!chunkResult.success) {
      await updateDocumentMetadata(userId, documentId, {
        status: 'failed',
        error: chunkResult.error
      });
      throw new Error(chunkResult.error);
    }

    // Send progress
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chunking:progress', {
        documentId,
        status: 'embedding',
        progress: 50,
        message: `Generated ${chunkResult.chunk_count} chunks, creating embeddings...`
      });
    }

    // Store chunks in user's ChromaDB
    const storeResult = await storeChunksInUserChroma(
      userId,
      documentId,
      chunkResult.chunks,
      mainWindow
    );

    if (!storeResult.success) {
      await updateDocumentMetadata(userId, documentId, {
        status: 'failed',
        error: storeResult.error
      });
      throw new Error(storeResult.error);
    }

    // Update document metadata with success
    await updateDocumentMetadata(userId, documentId, {
      status: 'completed',
      processedAt: new Date().toISOString(),
      chunkCount: chunkResult.chunk_count
    });

    currentlyProcessing = null;

    // Send completion
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chunking:progress', {
        documentId,
        status: 'completed',
        progress: 100,
        message: 'Document processed successfully'
      });
    }

    return {
      success: true,
      documentId,
      chunkCount: chunkResult.chunk_count
    };
  } catch (error) {
    currentlyProcessing = null;
    throw error;
  }
}
