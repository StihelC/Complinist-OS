#!/usr/bin/env node
/**
 * CompliNist AI/RAG CLI Testing Tool
 *
 * Usage:
 *   node cli/ai-test.js                    # Interactive mode
 *   node cli/ai-test.js query "your question"
 *   node cli/ai-test.js embed "text to embed"
 *   node cli/ai-test.js chroma "query" [collection]
 *   node cli/ai-test.js health
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI colors for CLI output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// State
let llama = null;
let llmModel = null;
let isInitialized = false;
let maxWorkingContextSize = 4096; // Larger context for RAG

// Configuration
const AI_CONFIG = {
  useInstructionFormat: true,
  chatTemplate: 'mistral',
};

function getModelPaths() {
  const modelsPath = path.join(__dirname, '..', '..', '.data', 'models');
  const chromaDbPath = path.join(__dirname, '..', '..', '.data', 'shared', 'chroma_db');

  return {
    llm: path.join(modelsPath, 'mistral-7b-instruct-v0.1.Q4_K_M.gguf'),
    embedding: path.join(modelsPath, 'bge-m3-FP16.gguf'),
    chromaDb: chromaDbPath,
  };
}

function detectGPULayers() {
  try {
    execSync('nvidia-smi', { stdio: 'ignore' });
    log(colors.green, '[GPU] NVIDIA GPU detected');

    try {
      const result = execSync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const freeVRAM = parseInt(result.trim().split('\n')[0]);

      if (!isNaN(freeVRAM)) {
        log(colors.cyan, `[GPU] Available VRAM: ${freeVRAM} MB`);
        if (freeVRAM < 1000) return 0;
        if (freeVRAM < 2000) return 5;
        if (freeVRAM < 4000) return 15;
        if (freeVRAM < 6000) return 25;
        return 35;
      }
    } catch (e) {
      return 15;
    }
  } catch (e) {
    // No NVIDIA GPU
  }

  if (process.platform === 'darwin') {
    log(colors.green, '[GPU] macOS detected, using Metal');
    return 35;
  }

  log(colors.yellow, '[GPU] No GPU detected, using CPU');
  return 0;
}

async function initializeAI() {
  if (isInitialized) return true;

  const modelPaths = getModelPaths();

  log(colors.cyan, '[AI] Initializing LLM...');
  log(colors.dim, `[AI] Model: ${modelPaths.llm}`);

  // Check model files exist
  if (!fs.existsSync(modelPaths.llm)) {
    log(colors.red, `[ERROR] LLM model not found: ${modelPaths.llm}`);
    return false;
  }

  const gpuLayers = detectGPULayers();

  try {
    llama = await getLlama();

    // Load LLM
    llmModel = await llama.loadModel({
      modelPath: modelPaths.llm,
      gpuLayers: gpuLayers,
    });
    log(colors.green, `[AI] LLM ready (${gpuLayers} GPU layers)`);

    isInitialized = true;
    return true;
  } catch (error) {
    log(colors.red, `[ERROR] Initialization failed: ${error.message}`);
    return false;
  }
}

function formatMistralInstruction(prompt, isFirstTurn = true) {
  if (!AI_CONFIG.useInstructionFormat) return prompt;

  if (AI_CONFIG.chatTemplate === 'mistral') {
    return isFirstTurn
      ? `<s>[INST] ${prompt} [/INST]`
      : `[INST] ${prompt} [/INST]`;
  }
  return prompt;
}

async function generateText(prompt, options = {}) {
  if (!isInitialized) {
    const ok = await initializeAI();
    if (!ok) throw new Error('AI not initialized');
  }

  const formattedPrompt = formatMistralInstruction(prompt, options.isFirstTurn ?? true);

  let context = null;
  try {
    context = await llmModel.createContext({ contextSize: maxWorkingContextSize });

    log(colors.dim, `[LLM] Generating (temp=${options.temperature || 0.4}, max_tokens=${options.maxTokens || 600})...`);

    const startTime = Date.now();

    if (options.stream) {
      // Streaming mode using LlamaChatSession
      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
      });

      let response = '';
      await session.prompt(formattedPrompt, {
        temperature: options.temperature || 0.4,
        maxTokens: options.maxTokens || 600,
        onTextChunk: (text) => {
          response += text;
          process.stdout.write(text);
        }
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      log(colors.dim, `\n[LLM] Generated in ${elapsed}s`);
      return response;
    } else {
      // Non-streaming mode
      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
      });

      const response = await session.prompt(formattedPrompt, {
        temperature: options.temperature || 0.4,
        maxTokens: options.maxTokens || 600,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      log(colors.dim, `[LLM] Generated in ${elapsed}s`);
      return response;
    }
  } finally {
    if (context) context.dispose();
  }
}

async function generateEmbedding(text) {
  // Use Python sentence-transformers for 384-dim embeddings (matches ChromaDB)
  const pythonScript = `
import sys
import json
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('all-MiniLM-L6-v2')
    text = json.loads(sys.argv[1])
    embedding = model.encode(text).tolist()
    print(json.dumps(embedding))
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['-c', pythonScript, JSON.stringify(text)]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.stderr.on('data', (data) => { stderr += data.toString(); });

    python.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`Failed to parse embedding: ${stdout}`));
        }
      } else {
        reject(new Error(stderr || `Python exited with code ${code}`));
      }
    });
  });
}

async function queryChromaDB(queryText, collectionName = 'documents', topK = 5) {
  const modelPaths = getModelPaths();

  if (!fs.existsSync(modelPaths.chromaDb)) {
    log(colors.red, `[ERROR] ChromaDB not found: ${modelPaths.chromaDb}`);
    return null;
  }

  log(colors.dim, `[ChromaDB] Generating embedding for query...`);
  const queryEmbedding = await generateEmbedding(queryText);
  log(colors.dim, `[ChromaDB] Embedding generated (${queryEmbedding.length} dimensions)`);

  // Write embedding to temp file
  const tmpFile = path.join(os.tmpdir(), `cli_embedding_${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(queryEmbedding));

  const pythonScript = `
import chromadb
import json
import sys
import os

try:
    with open("${tmpFile.replace(/\\/g, '/')}", 'r') as f:
        embedding = json.load(f)
    os.remove("${tmpFile.replace(/\\/g, '/')}")

    client = chromadb.PersistentClient(path="${modelPaths.chromaDb.replace(/\\/g, '/')}")

    try:
        collection = client.get_collection(name="${collectionName}")
    except Exception as e:
        # List available collections
        collections = [c.name for c in client.list_collections()]
        print(json.dumps({
            'error': f'Collection "${collectionName}" not found',
            'available_collections': collections
        }))
        sys.exit(0)

    results = collection.query(
        query_embeddings=[embedding],
        n_results=${topK}
    )

    # Format results
    docs = []
    for i in range(len(results['ids'][0])):
        doc = {
            'id': results['ids'][0][i],
            'document': results['documents'][0][i] if results['documents'] else None,
            'metadata': results['metadatas'][0][i] if results['metadatas'] else None,
            'distance': results['distances'][0][i] if results['distances'] else None
        }
        docs.append(doc)

    print(json.dumps({'results': docs, 'count': len(docs)}))

except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['-c', pythonScript]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.stderr.on('data', (data) => { stderr += data.toString(); });

    python.on('close', (code) => {
      try {
        if (stdout) {
          const result = JSON.parse(stdout);
          resolve(result);
        } else if (stderr) {
          reject(new Error(stderr));
        } else {
          reject(new Error(`Python exited with code ${code}`));
        }
      } catch (e) {
        reject(new Error(`Failed to parse output: ${stdout}`));
      }
    });
  });
}

async function runRAGQuery(query, options = {}) {
  log(colors.bright + colors.cyan, '\n=== RAG Query ===');
  log(colors.yellow, `Query: ${query}\n`);

  // Step 1: Query ChromaDB
  log(colors.cyan, '[RAG] Step 1: Retrieving relevant documents...');
  const chromaResults = await queryChromaDB(query, options.collection || 'documents', options.topK || 5);

  if (chromaResults.error) {
    log(colors.red, `[RAG] ChromaDB error: ${chromaResults.error}`);
    if (chromaResults.available_collections) {
      log(colors.yellow, `Available collections: ${chromaResults.available_collections.join(', ')}`);
    }
    return;
  }

  log(colors.green, `[RAG] Found ${chromaResults.count} relevant chunks`);

  // Show retrieved chunks
  log(colors.dim, '\n--- Retrieved Context ---');
  for (const doc of chromaResults.results) {
    const score = doc.distance ? (1 - doc.distance).toFixed(3) : 'N/A';
    const controlId = doc.metadata?.control_id || doc.metadata?.family || 'Unknown';
    log(colors.magenta, `\n[${controlId}] (relevance: ${score})`);
    const preview = doc.document?.substring(0, 200) || 'No content';
    log(colors.dim, preview + (doc.document?.length > 200 ? '...' : ''));
  }

  // Step 2: Build RAG prompt with token budget
  log(colors.cyan, '\n[RAG] Step 2: Building prompt with context...');

  // Limit context to ~2000 chars to fit in context window
  const MAX_CONTEXT_CHARS = 2000;
  let contextChunks = '';
  let totalChars = 0;

  for (const doc of chromaResults.results) {
    if (!doc.document) continue;
    const chunk = doc.document;
    if (totalChars + chunk.length > MAX_CONTEXT_CHARS) {
      // Add partial if there's room
      const remaining = MAX_CONTEXT_CHARS - totalChars;
      if (remaining > 200) {
        contextChunks += chunk.substring(0, remaining) + '...\n\n';
      }
      break;
    }
    contextChunks += chunk + '\n\n---\n\n';
    totalChars += chunk.length;
  }

  const ragPrompt = `You are a NIST security compliance expert. Answer based on the context.

Context:
${contextChunks}
Question: ${query}

Answer concisely based on the context above.`;

  // Step 3: Generate response
  log(colors.cyan, '[RAG] Step 3: Generating response...\n');
  log(colors.bright + colors.green, '--- Response ---\n');

  const response = await generateText(ragPrompt, {
    temperature: 0.2,
    maxTokens: 500,
    stream: true
  });

  log(colors.reset, '');
  return response;
}

async function listCollections() {
  const modelPaths = getModelPaths();

  const pythonScript = `
import chromadb
import json

client = chromadb.PersistentClient(path="${modelPaths.chromaDb.replace(/\\/g, '/')}")
collections = []
for c in client.list_collections():
    count = c.count()
    collections.append({'name': c.name, 'count': count})
print(json.dumps(collections))
`;

  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['-c', pythonScript]);
    let stdout = '';

    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.on('close', () => {
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function interactiveMode() {
  log(colors.bright + colors.cyan, '\n╔══════════════════════════════════════════╗');
  log(colors.bright + colors.cyan, '║   CompliNist AI/RAG CLI Testing Tool     ║');
  log(colors.bright + colors.cyan, '╚══════════════════════════════════════════╝\n');

  log(colors.yellow, 'Commands:');
  log(colors.dim, '  /query <text>     - Run full RAG query');
  log(colors.dim, '  /llm <text>       - Direct LLM query (no RAG)');
  log(colors.dim, '  /embed <text>     - Generate embedding');
  log(colors.dim, '  /chroma <text>    - Query ChromaDB only');
  log(colors.dim, '  /collections      - List ChromaDB collections');
  log(colors.dim, '  /health           - Check AI service health');
  log(colors.dim, '  /init             - Initialize AI (auto on first query)');
  log(colors.dim, '  /exit             - Exit CLI\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(colors.green + 'ai> ' + colors.reset, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      try {
        if (trimmed === '/exit' || trimmed === '/quit') {
          log(colors.cyan, 'Goodbye!');
          rl.close();
          process.exit(0);
        }

        if (trimmed === '/health') {
          log(colors.cyan, `\nAI Initialized: ${isInitialized ? 'Yes' : 'No'}`);
          log(colors.cyan, `LLM Model: ${llmModel ? 'Loaded' : 'Not loaded'}`);
          log(colors.cyan, `Embeddings: Python sentence-transformers (384-dim)`);
          log(colors.cyan, `Context Size: ${maxWorkingContextSize}\n`);
        }
        else if (trimmed === '/init') {
          await initializeAI();
        }
        else if (trimmed === '/collections') {
          log(colors.cyan, '\nQuerying ChromaDB collections...');
          const collections = await listCollections();
          log(colors.green, '\nAvailable Collections:');
          for (const c of collections) {
            log(colors.yellow, `  ${c.name}: ${c.count} documents`);
          }
          log('');
        }
        else if (trimmed.startsWith('/query ')) {
          const query = trimmed.substring(7);
          await runRAGQuery(query);
        }
        else if (trimmed.startsWith('/llm ')) {
          const query = trimmed.substring(5);
          log(colors.cyan, '\n[LLM] Generating response...\n');
          await generateText(query, { stream: true });
          log('');
        }
        else if (trimmed.startsWith('/embed ')) {
          const text = trimmed.substring(7);
          log(colors.cyan, '\nGenerating embedding...');
          const embedding = await generateEmbedding(text);
          log(colors.green, `Embedding generated: ${embedding.length} dimensions`);
          log(colors.dim, `First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
          log(colors.dim, `L2 norm: ${Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)).toFixed(4)}\n`);
        }
        else if (trimmed.startsWith('/chroma ')) {
          const query = trimmed.substring(8);
          log(colors.cyan, '\nQuerying ChromaDB...');
          const results = await queryChromaDB(query);

          if (results.error) {
            log(colors.red, `Error: ${results.error}`);
            if (results.available_collections) {
              log(colors.yellow, `Available: ${results.available_collections.join(', ')}`);
            }
          } else {
            log(colors.green, `\nFound ${results.count} results:\n`);
            for (const doc of results.results) {
              const score = doc.distance ? (1 - doc.distance).toFixed(3) : 'N/A';
              log(colors.magenta, `[Score: ${score}] ${doc.metadata?.control_id || 'Unknown'}`);
              log(colors.dim, (doc.document?.substring(0, 150) || 'No content') + '...\n');
            }
          }
        }
        else if (trimmed.startsWith('/')) {
          log(colors.red, `Unknown command: ${trimmed.split(' ')[0]}`);
        }
        else {
          // Default: run as RAG query
          await runRAGQuery(trimmed);
        }
      } catch (error) {
        log(colors.red, `Error: ${error.message}`);
      }

      prompt();
    });
  };

  prompt();
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await interactiveMode();
    return;
  }

  const command = args[0];
  const rest = args.slice(1).join(' ');

  try {
    switch (command) {
      case 'query':
      case 'rag':
        if (!rest) {
          log(colors.red, 'Usage: ai-test.js query "your question"');
          process.exit(1);
        }
        await runRAGQuery(rest);
        break;

      case 'llm':
        if (!rest) {
          log(colors.red, 'Usage: ai-test.js llm "your prompt"');
          process.exit(1);
        }
        await initializeAI();
        await generateText(rest, { stream: true });
        log('');
        break;

      case 'embed':
        if (!rest) {
          log(colors.red, 'Usage: ai-test.js embed "text to embed"');
          process.exit(1);
        }
        // No LLM init needed - uses Python for embeddings
        const embedding = await generateEmbedding(rest);
        console.log(JSON.stringify({ dimensions: embedding.length, embedding: embedding.slice(0, 10) }));
        break;

      case 'chroma':
        if (!rest) {
          log(colors.red, 'Usage: ai-test.js chroma "query" [collection]');
          process.exit(1);
        }
        // No LLM init needed - uses Python for embeddings
        const results = await queryChromaDB(rest, args[2] || 'documents');
        console.log(JSON.stringify(results, null, 2));
        break;

      case 'collections':
        const collections = await listCollections();
        console.log(JSON.stringify(collections, null, 2));
        break;

      case 'health':
        log(colors.cyan, 'Checking AI health...');
        await initializeAI();
        log(colors.green, 'All services healthy');
        break;

      default:
        log(colors.red, `Unknown command: ${command}`);
        log(colors.yellow, 'Commands: query, llm, embed, chroma, collections, health');
        process.exit(1);
    }
  } catch (error) {
    log(colors.red, `Error: ${error.message}`);
    process.exit(1);
  }

  process.exit(0);
}

main();
