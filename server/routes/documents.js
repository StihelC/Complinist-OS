/**
 * Documents Routes
 * REST API endpoints for document upload and processing
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as ai from '../services/ai-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.md', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`));
    }
  }
});

const router = Router();

// Document metadata storage (in-memory for simplicity, use DB in production)
let documents = [];

// Upload document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const doc = {
      id: `doc_${Date.now()}`,
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      chunks: 0
    };

    documents.push(doc);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process document (chunk and embed)
router.post('/process/:docId', async (req, res) => {
  try {
    const doc = documents.find(d => d.id === req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    doc.status = 'processing';

    // Read file content
    const content = fs.readFileSync(doc.path, 'utf-8');

    // Simple chunking (split by paragraphs, ~500 chars each)
    const chunks = [];
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > 500) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += '\n\n' + para;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    // Embed and store in ChromaDB
    try {
      const embeddings = await ai.embed(chunks);
      const ids = chunks.map((_, i) => `${doc.id}_chunk_${i}`);
      const metadatas = chunks.map((_, i) => ({
        docId: doc.id,
        filename: doc.filename,
        chunkIndex: i
      }));

      await ai.chromaAdd('user_documents', ids, embeddings, chunks, metadatas);

      doc.status = 'processed';
      doc.chunks = chunks.length;
    } catch (aiErr) {
      console.error('[Documents] AI processing failed:', aiErr);
      doc.status = 'error';
      doc.error = aiErr.message;
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all documents
router.get('/list', (req, res) => {
  res.json(documents);
});

// Get document by ID
router.get('/:docId', (req, res) => {
  const doc = documents.find(d => d.id === req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json(doc);
});

// Delete document
router.delete('/:docId', (req, res) => {
  try {
    const index = documents.findIndex(d => d.id === req.params.docId);
    if (index === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = documents[index];

    // Delete file
    if (fs.existsSync(doc.path)) {
      fs.unlinkSync(doc.path);
    }

    // Remove from array
    documents.splice(index, 1);

    // TODO: Remove from ChromaDB

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query user documents
router.post('/query', async (req, res) => {
  try {
    const { query, nResults = 5 } = req.body;
    const embedding = (await ai.embed(query))[0];
    const results = await ai.chromaQuery('user_documents', embedding, nResults);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get processing status
router.get('/status/:docId', (req, res) => {
  const doc = documents.find(d => d.id === req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ status: doc.status, chunks: doc.chunks, error: doc.error });
});

export default router;
