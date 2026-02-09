#!/usr/bin/env node
/**
 * NIST RAG CLI Tester
 * Test the NIST query system without launching the full Electron app
 * 
 * Usage:
 *   node scripts/test-nist-rag.js "your question here"
 *   node scripts/test-nist-rag.js "What is access control?" --doc-type=800-37_rmf
 *   node scripts/test-nist-rag.js "Explain RMF" --family=AC --topk=10
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
NIST RAG CLI Tester
Test NIST document queries without launching the full app

Usage:
  node scripts/test-nist-rag.js "your question" [options]

Options:
  --doc-type=TYPE    Filter by document type (e.g., 800-37_rmf, security_pattern)
  --family=FAMILY    Filter by control family (e.g., AC, SC, AU)
  --topk=N           Number of results to retrieve (default: 6)
  --verbose          Show detailed information

Examples:
  node scripts/test-nist-rag.js "What is the Risk Management Framework?"
  node scripts/test-nist-rag.js "Explain access control" --doc-type=800-37_rmf
  node scripts/test-nist-rag.js "Security controls" --family=AC --topk=10 --verbose
  `);
  process.exit(0);
}

const query = args[0];
const options = {
  documentTypes: [],
  families: [],
  topK: 6,
  verbose: false,
};

// Parse options
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--doc-type=')) {
    options.documentTypes.push(arg.split('=')[1]);
  } else if (arg.startsWith('--family=')) {
    options.families.push(arg.split('=')[1]);
  } else if (arg.startsWith('--topk=')) {
    options.topK = parseInt(arg.split('=')[1]);
  } else if (arg === '--verbose') {
    options.verbose = true;
  }
}

console.log('\n🔍 NIST RAG Query Test\n');
console.log(`Query: "${query}"`);
if (options.documentTypes.length > 0) {
  console.log(`Document Types: ${options.documentTypes.join(', ')}`);
}
if (options.families.length > 0) {
  console.log(`Families: ${options.families.join(', ')}`);
}
console.log(`Top-K: ${options.topK}`);
console.log('\n' + '='.repeat(60) + '\n');

// Test script
const testScript = `
import chromadb
import json
import sys
import os

# Paths
project_root = "${path.resolve(__dirname, '..').replace(/\\/g, '/')}"
chroma_path = os.path.join(project_root, ".data", "chroma_db")

print("📦 Connecting to ChromaDB...", file=sys.stderr)
print(f"   Path: {chroma_path}", file=sys.stderr)

try:
    client = chromadb.PersistentClient(path=chroma_path)
    collection = client.get_collection("documents")
    print(f"✅ Connected! Collection has {collection.count()} documents\\n", file=sys.stderr)
except Exception as e:
    print(f"❌ Failed to connect: {e}", file=sys.stderr)
    sys.exit(1)

# Generate a simple embedding (just for testing, using zeros)
# In production, this would use the actual embedding model
print("🧮 Generating test embedding...", file=sys.stderr)
embedding = [0.0] * 1024  # Placeholder embedding

# Build filters
filters = {}
${options.documentTypes.length > 0 ? `filters["document_type"] = {"$in": ${JSON.stringify(options.documentTypes)}}` : ''}
${options.families.length > 0 ? `filters["family"] = {"$in": ${JSON.stringify(options.families)}}` : ''}

print("🔎 Querying ChromaDB...", file=sys.stderr)
if filters:
    print(f"   Filters: {filters}", file=sys.stderr)

try:
    results = collection.query(
        query_embeddings=[embedding],
        n_results=${options.topK},
        where=filters if filters else None
    )
    
    print(f"✅ Found {len(results['ids'][0])} results\\n", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    
    # Format results
    if results['ids'][0]:
        for i, doc_id in enumerate(results['ids'][0]):
            metadata = results['metadatas'][0][i]
            text = results['documents'][0][i]
            distance = results['distances'][0][i]
            score = 1 - distance
            
            print(f"\\n📄 Result {i+1}:", file=sys.stderr)
            print(f"   Score: {score:.3f}", file=sys.stderr)
            print(f"   Document Type: {metadata.get('document_type', 'N/A')}", file=sys.stderr)
            print(f"   Source: {metadata.get('source', 'N/A')}", file=sys.stderr)
            
            if metadata.get('control_id'):
                print(f"   Control: {metadata['control_id']}", file=sys.stderr)
            if metadata.get('family'):
                print(f"   Family: {metadata['family']}", file=sys.stderr)
                
            print(f"   Tokens: {metadata.get('token_count', 'N/A')}", file=sys.stderr)
            
            if metadata.get('hypothetical_questions'):
                print(f"   Questions: {metadata['hypothetical_questions']}", file=sys.stderr)
            
            ${options.verbose ? `
            print(f"\\n   Text Preview:", file=sys.stderr)
            preview = text[:200] + "..." if len(text) > 200 else text
            print(f"   {preview}", file=sys.stderr)
            ` : ''}
    else:
        print("❌ No results found", file=sys.stderr)
    
    # Output JSON for programmatic use
    output = {
        "success": True,
        "count": len(results['ids'][0]),
        "results": []
    }
    
    for i, doc_id in enumerate(results['ids'][0]):
        output["results"].append({
            "id": doc_id,
            "score": 1 - results['distances'][0][i],
            "metadata": results['metadatas'][0][i],
            "text": results['documents'][0][i]
        })
    
    print(json.dumps(output, indent=2))
    
except Exception as e:
    print(f"❌ Query failed: {e}", file=sys.stderr)
    print(json.dumps({"success": False, "error": str(e)}))
    sys.exit(1)
`;

// Run Python script
const python = spawn('python3', ['-c', testScript]);

let stdout = '';
let stderr = '';

python.stdout.on('data', (data) => {
  stdout += data.toString();
});

python.stderr.on('data', (data) => {
  process.stderr.write(data); // Show progress messages
});

python.on('close', (code) => {
  if (code !== 0) {
    console.error('\n❌ Test failed with code:', code);
    process.exit(1);
  }
  
  // Parse and display JSON results
  try {
    const result = JSON.parse(stdout);
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Query Results Summary:\n');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Results: ${result.count} documents\n`);
    
    if (options.verbose && result.results) {
      console.log('Full JSON Output:');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error('\n❌ Failed to parse results:', e.message);
    console.log('Raw output:', stdout);
  }
});

