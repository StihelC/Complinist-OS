#!/usr/bin/env node
/**
 * Check Embedding Model Dimensions
 * Determines what dimension the current embedding model produces
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

console.log('🔍 Checking Embedding Model Dimensions\n');

// Check which model is configured
const modelsPath = path.join(projectRoot, '.data/models');
const embeddingModelPath = path.join(modelsPath, 'bge-m3-FP16.gguf');

if (!fs.existsSync(embeddingModelPath)) {
  console.error('❌ Embedding model not found at:', embeddingModelPath);
  process.exit(1);
}

console.log('✅ Embedding model found:', embeddingModelPath);
console.log('📏 Model file size:', (fs.statSync(embeddingModelPath).size / 1024 / 1024).toFixed(2), 'MB\n');

// Create a test Python script to check dimensions
const pythonScript = `
import sys
import os

# Add path to find node-llama-cpp if needed
sys.path.insert(0, '${projectRoot.replace(/\\/g, '/')}')

try:
    import chromadb
    from chromadb.config import Settings

    # Check ChromaDB collection
    chroma_path = "${path.join(projectRoot, '.data/chromadb').replace(/\\/g, '/')}"

    if not os.path.exists(chroma_path):
        print(f"ChromaDB path not found: {chroma_path}")
        sys.exit(1)

    client = chromadb.PersistentClient(path=chroma_path)

    # List collections
    collections = client.list_collections()

    print(f"Found {len(collections)} ChromaDB collections:")
    for coll in collections:
        print(f"  - {coll.name}")

        # Try to get a sample embedding dimension
        try:
            results = coll.get(limit=1, include=['embeddings'])
            if results and 'embeddings' in results and len(results['embeddings']) > 0:
                emb = results['embeddings'][0]
                if emb:
                    dim = len(emb)
                    print(f"    Dimension: {dim}")
                else:
                    print(f"    Dimension: No embeddings found")
            else:
                print(f"    Dimension: Collection empty or no embeddings")
        except Exception as e:
            print(f"    Error checking dimension: {str(e)}")

    print("\\nNote: bge-m3 model should produce 1024-dimensional embeddings")
    print("If ChromaDB shows 384 dimensions, the collection was created with a different model")

except ImportError as e:
    print(f"Error importing chromadb: {str(e)}")
    print("Install with: pip install chromadb")
    sys.exit(1)
except Exception as e:
    print(f"Error: {str(e)}")
    sys.exit(1)
`;

console.log('Running ChromaDB dimension check...\n');

const python = spawn('python3', ['-c', pythonScript]);

let stdout = '';
let stderr = '';

python.stdout.on('data', (data) => {
  const output = data.toString();
  stdout += output;
  console.log(output.trim());
});

python.stderr.on('data', (data) => {
  stderr += data.toString();
  console.error('[Error]', data.toString().trim());
});

python.on('close', (code) => {
  console.log('\n' + '='.repeat(70));

  if (code === 0) {
    console.log('\n✅ Check complete');

    if (stdout.includes('384')) {
      console.log('\n⚠️  DIMENSION MISMATCH DETECTED!');
      console.log('   ChromaDB collection has 384-dimensional embeddings');
      console.log('   Current model (bge-m3) produces 1024-dimensional embeddings');
      console.log('\n   Solution: Recreate the ChromaDB collection with:');
      console.log('   npm run ingest:800-53');
    } else if (stdout.includes('1024')) {
      console.log('\n✅ Dimensions match! (1024)');
    }
  } else {
    console.log(`\n❌ Python script exited with code ${code}`);
  }

  process.exit(code);
});

python.on('error', (err) => {
  console.error('❌ Failed to execute Python:', err);
  process.exit(1);
});
