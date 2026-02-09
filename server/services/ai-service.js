/**
 * AI Service
 * LLM and embedding operations using node-llama-cpp and ChromaDB
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '.data');
const MODELS_DIR = process.env.MODELS_DIR || path.join(DATA_DIR, 'models');
const CHROMA_DIR = process.env.CHROMA_DIR || path.join(DATA_DIR, 'shared', 'chroma_db');

let llama = null;
let model = null;
let embeddingModel = null;
let context = null;
let chromaClient = null;
let isInitialized = false;

// Model filenames
const LLM_MODEL = 'mistral-7b-instruct-v0.1.Q4_K_M.gguf';
const EMBEDDING_MODEL = 'bge-m3-FP16.gguf';

export async function initAIServices() {
  if (isInitialized) return;

  console.log('[AI] Initializing AI services...');
  console.log('[AI] Models directory:', MODELS_DIR);
  console.log('[AI] ChromaDB directory:', CHROMA_DIR);

  // Check if models exist
  const llmPath = path.join(MODELS_DIR, LLM_MODEL);
  const embeddingPath = path.join(MODELS_DIR, EMBEDDING_MODEL);

  if (!fs.existsSync(llmPath)) {
    throw new Error(`LLM model not found: ${llmPath}`);
  }
  if (!fs.existsSync(embeddingPath)) {
    throw new Error(`Embedding model not found: ${embeddingPath}`);
  }

  try {
    // Initialize node-llama-cpp
    const { getLlama } = await import('node-llama-cpp');
    llama = await getLlama();

    // Load LLM model
    console.log('[AI] Loading LLM model...');
    model = await llama.loadModel({ modelPath: llmPath });
    context = await model.createContext({ contextSize: 4096 });
    console.log('[AI] LLM model loaded');

    // Load embedding model
    console.log('[AI] Loading embedding model...');
    embeddingModel = await llama.loadModel({ modelPath: embeddingPath });
    console.log('[AI] Embedding model loaded');

    // Initialize ChromaDB
    console.log('[AI] Connecting to ChromaDB...');
    const { ChromaClient } = await import('chromadb');
    chromaClient = new ChromaClient({ path: CHROMA_DIR });
    console.log('[AI] ChromaDB connected');

    isInitialized = true;
    console.log('[AI] All AI services initialized');
  } catch (err) {
    console.error('[AI] Failed to initialize:', err);
    throw err;
  }
}

export function checkHealth() {
  return {
    initialized: isInitialized,
    llm: !!model,
    embedding: !!embeddingModel,
    chromadb: !!chromaClient,
    modelsDir: MODELS_DIR,
    chromaDir: CHROMA_DIR
  };
}

export function getContextSize() {
  return context ? 4096 : 0;
}

export async function generate(prompt, options = {}) {
  if (!model || !context) {
    throw new Error('LLM not initialized');
  }

  const { maxTokens = 512, temperature = 0.7, stopSequences = [] } = options;

  const session = new (await import('node-llama-cpp')).LlamaChatSession({
    contextSequence: context.getSequence()
  });

  const response = await session.prompt(prompt, {
    maxTokens,
    temperature,
    stopOnAbortSignal: false
  });

  return { text: response, usage: { promptTokens: 0, completionTokens: 0 } };
}

export async function embed(texts) {
  if (!embeddingModel) {
    throw new Error('Embedding model not initialized');
  }

  const context = await embeddingModel.createEmbeddingContext();
  const embeddings = [];

  for (const text of Array.isArray(texts) ? texts : [texts]) {
    const embedding = await context.getEmbeddingFor(text);
    embeddings.push(Array.from(embedding.vector));
  }

  return embeddings;
}

export async function chromaQuery(collectionName, queryEmbedding, nResults = 5) {
  if (!chromaClient) {
    throw new Error('ChromaDB not initialized');
  }

  try {
    const collection = await chromaClient.getCollection({ name: collectionName });
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults
    });
    return results;
  } catch (err) {
    console.error('[AI] ChromaDB query error:', err);
    throw err;
  }
}

export async function chromaAdd(collectionName, ids, embeddings, documents, metadatas) {
  if (!chromaClient) {
    throw new Error('ChromaDB not initialized');
  }

  try {
    const collection = await chromaClient.getOrCreateCollection({ name: collectionName });
    await collection.add({
      ids,
      embeddings,
      documents,
      metadatas
    });
    return { success: true };
  } catch (err) {
    console.error('[AI] ChromaDB add error:', err);
    throw err;
  }
}

export async function queryDualSource(query, options = {}) {
  // Query both user docs and shared compliance library
  const { nResults = 5 } = options;

  const queryEmbedding = (await embed(query))[0];
  const results = { userDocs: [], sharedDocs: [] };

  try {
    // Query shared compliance library
    const sharedResults = await chromaQuery('nist_controls', queryEmbedding, nResults);
    results.sharedDocs = sharedResults.documents?.[0] || [];
  } catch (err) {
    console.warn('[AI] Shared docs query failed:', err.message);
  }

  try {
    // Query user documents
    const userResults = await chromaQuery('user_documents', queryEmbedding, nResults);
    results.userDocs = userResults.documents?.[0] || [];
  } catch (err) {
    console.warn('[AI] User docs query failed:', err.message);
  }

  return results;
}
