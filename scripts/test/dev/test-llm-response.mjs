#!/usr/bin/env node
/**
 * Test Real LLM Response for NIST RAG
 * Tests the actual LLM with a real query and retrieved context
 * 
 * Usage:
 *   node scripts/test-llm-response.mjs "What is AC-1?"
 */

import { getLlama } from 'node-llama-cpp';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const query = process.argv[2] || "What is AC-1?";
const topK = 6;

console.log('\n🔍 Testing Real LLM Response\n');
console.log(`Query: "${query}"`);
console.log(`Top-K: ${topK}`);
console.log('\n' + '='.repeat(60) + '\n');

// Step 1: Query ChromaDB to get context
console.log('📦 Step 1: Querying ChromaDB for context...\n');

const chromaQueryScript = `
import chromadb
import json
import sys
import os
import numpy as np

project_root = "${projectRoot.replace(/\\/g, '/')}"
chroma_path = os.path.join(project_root, ".data", "chroma_db")

client = chromadb.PersistentClient(path=chroma_path)
collection = client.get_collection("documents")

# Generate embedding (simplified - in production use BGE-M3)
np.random.seed(42)
query_embedding = np.random.normal(0, 0.1, 1024).tolist()
norm = sum(x*x for x in query_embedding) ** 0.5
query_embedding = [x/norm for x in query_embedding]

results = collection.query(
    query_embeddings=[query_embedding],
    n_results=${topK}
)

contexts = []
for i, doc_id in enumerate(results['ids'][0]):
    metadata = results['metadatas'][0][i]
    text = results['documents'][0][i]
    distance = results['distances'][0][i]
    score = 1 - distance
    
    context_text = metadata.get('parent_text', text)
    contexts.append({
        "text": context_text,
        "score": score,
        "metadata": metadata
    })

contexts.sort(key=lambda x: x['score'], reverse=True)

# Build context string
context_texts = [ctx['text'] for ctx in contexts]
combined_context = "\\n\\n---\\n\\n".join(context_texts)

output = {
    "contexts": contexts,
    "combined_context": combined_context,
    "count": len(contexts)
}

print(json.dumps(output))
`;

const chromaResult = await new Promise((resolve, reject) => {
  const python = spawn('python3', ['-c', chromaQueryScript]);
  let stdout = '';
  let stderr = '';

  python.stdout.on('data', (data) => { stdout += data.toString(); });
  python.stderr.on('data', (data) => { process.stderr.write(data); });

  python.on('close', (code) => {
    if (code !== 0) reject(new Error(`ChromaDB query failed: ${code}`));
    else resolve(JSON.parse(stdout));
  });
});

console.log(`✅ Retrieved ${chromaResult.count} context chunks\n`);

// Step 2: Build prompt
const prompt = `You are an expert cybersecurity compliance assistant specializing in NIST frameworks and security controls.

User Question: ${query}

Retrieved Context:
${chromaResult.combined_context}

Instructions:
1. Answer the user's question based ONLY on the information provided in the retrieved context above
2. Be specific and cite relevant control IDs, document types, or frameworks when applicable
3. If the context doesn't contain enough information to fully answer the question, acknowledge this
4. Provide practical, actionable guidance when appropriate
5. Keep your answer clear, concise, and well-structured

Answer:`;

console.log('🤖 Step 2: Loading LLM model...\n');

// Check if model exists
const modelPath = path.join(projectRoot, '.data', 'models', 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
const fs = await import('fs');
const modelExists = fs.existsSync(modelPath);

if (!modelExists) {
  console.log('⚠️  LLM model not found at:', modelPath);
  console.log('   Please download the model first.');
  console.log('   See docs/AI_MODELS_SETUP.md for instructions.\n');
  process.exit(1);
}

try {
  const llama = await getLlama();
  console.log('✅ Llama instance created');
  
  const model = await llama.loadModel({
    modelPath: modelPath,
    gpuLayers: 35, // Use GPU if available
  });
  console.log('✅ Model loaded\n');
  
  console.log('🤖 Step 3: Generating response...\n');
  
  const context = await model.createContext({
    contextSize: 2048,
  });
  
  const { LlamaChatSession } = await import('node-llama-cpp');
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
  });
  
  const startTime = Date.now();
  const response = await session.prompt(prompt, {
    temperature: 0.4,
    maxTokens: 300,
  });
  const duration = Date.now() - startTime;
  
  console.log('='.repeat(60));
  console.log('\n📝 LLM Response:\n');
  console.log(response.trim());
  console.log('\n' + '='.repeat(60));
  console.log(`\n⏱️  Generated in ${duration}ms`);
  console.log(`📊 Context: ${chromaResult.count} chunks`);
  console.log(`📏 Prompt length: ${prompt.length} characters\n`);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.message.includes('VRAM') || error.message.includes('memory')) {
    console.error('\n💡 Try reducing GPU layers or using CPU mode.');
    console.error('   Edit the script and change gpuLayers: 35 to gpuLayers: 0\n');
  }
  process.exit(1);
}

