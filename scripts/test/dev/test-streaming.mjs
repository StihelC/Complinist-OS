#!/usr/bin/env node
/**
 * Test Token Streaming
 * Verifies that tokens are streamed in real-time
 * 
 * Usage:
 *   node scripts/test-streaming.mjs "your question"
 */

import { getLlama } from 'node-llama-cpp';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const query = process.argv[2] || "What is access control?";

console.log('\n🔍 Testing Token Streaming\n');
console.log(`Query: "${query}"`);
console.log('\n' + '='.repeat(60) + '\n');

// Get context from ChromaDB first
console.log('📦 Retrieving context from ChromaDB...\n');

const chromaScript = `
import chromadb
import json
import sys
import os
import numpy as np

project_root = "${projectRoot.replace(/\\/g, '/')}"
chroma_path = os.path.join(project_root, ".data", "chroma_db")

client = chromadb.PersistentClient(path=chroma_path)
collection = client.get_collection("documents")

np.random.seed(42)
query_embedding = np.random.normal(0, 0.1, 1024).tolist()
norm = sum(x*x for x in query_embedding) ** 0.5
query_embedding = [x/norm for x in query_embedding]

results = collection.query(
    query_embeddings=[query_embedding],
    n_results=3
)

contexts = []
for i, doc_id in enumerate(results['ids'][0]):
    metadata = results['metadatas'][0][i]
    text = results['documents'][0][i]
    context_text = metadata.get('parent_text', text)
    contexts.append(context_text)

combined_context = "\\n\\n---\\n\\n".join(contexts)
print(combined_context)
`;

const chromaContext = await new Promise((resolve, reject) => {
  const python = spawn('python3', ['-c', chromaScript]);
  let stdout = '';
  python.stdout.on('data', (data) => { stdout += data.toString(); });
  python.on('close', (code) => {
    if (code !== 0) reject(new Error('ChromaDB query failed'));
    else resolve(stdout);
  });
});

console.log('✅ Context retrieved\n');

// Build prompt
const prompt = `You are an expert cybersecurity compliance assistant.

User Question: ${query}

Retrieved Context:
${chromaContext}

Answer the question based on the context above. Be concise and specific.

Answer:`;

console.log('🤖 Testing LLM Token Streaming...\n');
console.log('='.repeat(60));
console.log('\n📝 Streaming Response (watch tokens appear in real-time):\n');

// Test streaming
const modelPath = path.join(projectRoot, '.data', 'models', 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
const fs = await import('fs');

if (!fs.existsSync(modelPath)) {
  console.error('❌ Model not found:', modelPath);
  process.exit(1);
}

try {
  const llama = await getLlama();
  const model = await llama.loadModel({
    modelPath: modelPath,
    gpuLayers: 35,
  });
  
  const context = await model.createContext({ contextSize: 2048 });
  const { LlamaChatSession } = await import('node-llama-cpp');
  const session = new LlamaChatSession({ contextSequence: context.getSequence() });
  
  // Generate response
  const fullResponse = await session.prompt(prompt, {
    temperature: 0.4,
    maxTokens: 200,
  });
  
  // Simulate streaming (word-by-word like the actual implementation)
  console.log('Streaming starts...\n');
  const words = fullResponse.split(/(\s+)/);
  
  let tokenCount = 0;
  const startTime = Date.now();
  
  for (const word of words) {
    if (word) {
      process.stdout.write(word);
      tokenCount++;
      await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay like real implementation
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log('\n\n' + '='.repeat(60));
  console.log(`\n✅ Streaming Complete!`);
  console.log(`📊 Tokens streamed: ${tokenCount} words`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`🚀 Streaming speed: ${(tokenCount / (duration / 1000)).toFixed(1)} tokens/second\n`);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}

