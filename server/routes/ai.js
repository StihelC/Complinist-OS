/**
 * AI Routes
 * REST API endpoints for AI operations
 */

import { Router } from 'express';
import * as ai from '../services/ai-service.js';

const router = Router();

// Health check
router.get('/check-health', (req, res) => {
  try {
    const health = ai.checkHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/get-context-size', (req, res) => {
  try {
    const size = ai.getContextSize();
    res.json({ contextSize: size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LLM generation
router.post('/llm-generate', async (req, res) => {
  try {
    const { prompt, options } = req.body;
    const result = await ai.generate(prompt, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Streaming generation (SSE)
router.post('/llm-generate-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { prompt, options } = req.body;
    // For now, fall back to non-streaming
    const result = await ai.generate(prompt, options);
    res.write(`data: ${JSON.stringify({ token: result.text, done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// Embedding
router.post('/embed', async (req, res) => {
  try {
    const { texts } = req.body;
    const embeddings = await ai.embed(texts);
    res.json({ embeddings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ChromaDB operations
router.post('/chromadb-query', async (req, res) => {
  try {
    const { collectionName, queryEmbedding, nResults } = req.body;
    const results = await ai.chromaQuery(collectionName, queryEmbedding, nResults);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chromadb-add', async (req, res) => {
  try {
    const { collectionName, ids, embeddings, documents, metadatas } = req.body;
    const result = await ai.chromaAdd(collectionName, ids, embeddings, documents, metadatas);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dual source query
router.post('/query-dual-source', async (req, res) => {
  try {
    const { query, options } = req.body;
    const results = await ai.queryDualSource(query, options);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preload status (simplified for web)
router.get('/get-preload-status', (req, res) => {
  const health = ai.checkHealth();
  res.json({
    status: health.initialized ? 'ready' : 'loading',
    llmReady: health.llm,
    embeddingReady: health.embedding,
    chromaReady: health.chromadb
  });
});

// Model management (simplified)
router.get('/scan-models', (req, res) => {
  res.json({ models: [] }); // Models are pre-bundled in Docker
});

router.get('/get-available-models', (req, res) => {
  res.json({
    llm: 'mistral-7b-instruct-v0.1.Q4_K_M.gguf',
    embedding: 'bge-m3-FP16.gguf'
  });
});

export default router;
