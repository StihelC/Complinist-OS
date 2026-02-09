// Test script to verify ChromaDB data quality
// Run this to check what's actually stored in the chunks

import { getChromaDBClient } from './src/lib/ai/chromaClient.js';
import { getEmbeddingService } from './src/lib/ai/embeddingService.js';

async function testChromaDBContent() {
  console.log('=== Testing ChromaDB Content Quality ===\n');
  
  const chromaClient = getChromaDBClient(undefined, 'documents');
  const embeddingService = getEmbeddingService();
  
  const testQueries = [
    'AC-1',
    'AC-2',
    'AC-3'
  ];
  
  for (const query of testQueries) {
    console.log(`\n--- Testing: ${query} ---`);
    
    try {
      // Generate embedding for query
      const embeddingResponse = await embeddingService.embed({ text: query });
      const queryEmbedding = embeddingResponse.embeddings[0];
      
      if (!queryEmbedding) {
        console.error(`Failed to generate embedding for ${query}`);
        continue;
      }
      
      // Query ChromaDB
      const results = await chromaClient.query({
        queryEmbedding,
        topK: 3,
        filters: {
          control_id: query
        }
      });
      
      console.log(`Found ${results.length} results for ${query}`);
      
      results.forEach((result, idx) => {
        console.log(`\nResult ${idx + 1}:`);
        console.log(`  ID: ${result.id}`);
        console.log(`  Score: ${(result.score * 100).toFixed(1)}%`);
        console.log(`  Metadata:`, JSON.stringify(result.metadata, null, 2));
        console.log(`  Text length: ${result.text.length} chars`);
        console.log(`  Text preview: ${result.text.substring(0, 300)}...`);
        
        // Check for parent_text (Small2Big)
        if (result.metadata.parent_text) {
          console.log(`  Parent text length: ${result.metadata.parent_text.length} chars`);
          console.log(`  Parent text preview: ${result.metadata.parent_text.substring(0, 300)}...`);
        }
      });
      
    } catch (error) {
      console.error(`Error testing ${query}:`, error.message);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

// Run if called directly
if (typeof window === 'undefined') {
  testChromaDBContent().catch(console.error);
}















