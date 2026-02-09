// ChromaDB Client
// Handles vector store queries for RAG retrieval via IPC

import type { ChromaDBQuery, ChromaDBResult, ChromaDBSmall2BigQuery } from './types';

export class ChromaDBClient {
  private collectionName: string;
  private timeout: number;

  constructor(_chromaUrl?: string, collectionName: string = 'documents', timeout: number = 10000) {
    this.collectionName = collectionName;
    this.timeout = timeout;
  }

  async checkHealth(): Promise<boolean> {
    // Check via Electron IPC
    if (typeof window !== 'undefined' && (window as any).electronAPI?.checkAIHealth) {
      try {
        const health = await (window as any).electronAPI.checkAIHealth();
        return health?.chroma ?? false;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async query(query: ChromaDBQuery): Promise<ChromaDBResult[]> {
    const { queryEmbedding, topK, filters } = query;

    // Use Electron IPC for query
    if (typeof window !== 'undefined' && (window as any).electronAPI?.chromaDbQuery) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('ChromaDB query timed out')), this.timeout);
        });

        const queryPromise = (window as any).electronAPI.chromaDbQuery({
          collection: this.collectionName,
          queryEmbedding,
          topK,
          filters,
        });

        const result = await Promise.race([queryPromise, timeoutPromise]);

        if (!result.success) {
          throw new Error(result.error || 'ChromaDB query failed');
        }

        return result.data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new Error('ChromaDB query timed out');
        }
        throw error;
      }
    }

    throw new Error('ChromaDB not available - Electron IPC not found');
  }

  /**
   * Query small chunks for Small2Big retrieval (Wang et al. 2024, Section 3.2.2)
   * Retrieves small chunks (is_small_chunk: true) for precise retrieval
   * Falls back to unfiltered query if Small2Big filter returns no results
   */
  async querySmallChunks(query: ChromaDBSmall2BigQuery): Promise<ChromaDBResult[]> {
    const { queryEmbedding, topK, filters } = query;

    const queryFilters = filters || {};

    // Use Electron IPC for query
    if (typeof window !== 'undefined' && (window as any).electronAPI?.chromaDbQuery) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('ChromaDB query timed out')), this.timeout);
        });

        // Only send filters if they have content (ChromaDB errors on empty where={})
        const filtersToSend = Object.keys(queryFilters).length > 0 ? queryFilters : undefined;
        
        console.log('[ChromaDB] Querying with filters:', JSON.stringify(filtersToSend || {}));
        
        const queryPromise = (window as any).electronAPI.chromaDbQuery({
          collection: this.collectionName,
          queryEmbedding,
          topK,
          filters: filtersToSend,
        });

        const result = await Promise.race([queryPromise, timeoutPromise]);

        if (!result.success) {
          // If filter caused error, try without is_small_chunk filter
          if (result.error?.includes('is_small_chunk') || result.error?.includes('filter')) {
            console.warn('[ChromaDB] Filter query failed, retrying without is_small_chunk filter');
            const fallbackFilters = { ...queryFilters };
            delete fallbackFilters.is_small_chunk;
            
            const fallbackResult = await (window as any).electronAPI.chromaDbQuery({
              collection: this.collectionName,
              queryEmbedding,
              topK,
              filters: Object.keys(fallbackFilters).length > 0 ? fallbackFilters : undefined,
            });
            
            if (fallbackResult.success) {
              console.log(`[ChromaDB] Fallback query returned ${fallbackResult.data?.length || 0} results`);
              return fallbackResult.data;
            }
          }
          throw new Error(result.error || 'ChromaDB query failed');
        }

        console.log(`[ChromaDB] Query returned ${result.data?.length || 0} results`);
        
        // If query with is_small_chunk returned 0 results, try without it
        if (result.data?.length === 0 && queryFilters.is_small_chunk) {
          console.warn('[ChromaDB] is_small_chunk filter returned 0 results, retrying without it');
          const fallbackFilters = { ...queryFilters };
          delete fallbackFilters.is_small_chunk;
          
          const fallbackResult = await (window as any).electronAPI.chromaDbQuery({
            collection: this.collectionName,
            queryEmbedding,
            topK,
            filters: Object.keys(fallbackFilters).length > 0 ? fallbackFilters : undefined,
          });
          
          if (fallbackResult.success && fallbackResult.data?.length > 0) {
            console.log(`[ChromaDB] Fallback query returned ${fallbackResult.data.length} results`);
            return fallbackResult.data;
          }
        }

        return result.data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new Error('ChromaDB query timed out');
        }
        throw error;
      }
    }

    throw new Error('ChromaDB not available - Electron IPC not found');
  }

  /**
   * Expand small chunks to parent chunks for LLM context (Wang et al. 2024, Section 3.2.2)
   * Extracts parent_text from metadata for larger context window
   * Falls back to original text if parent_text is not available
   * @returns Array of expanded contexts with parent text and metadata
   */
  expandToParentChunks(results: ChromaDBResult[]): Array<{
    parentText: string;
    parentTokenCount: number;
    smallChunkId: string;
    smallChunkText: string;
    metadata: Record<string, any>;
    score: number;
  }> {
    let hasParentText = 0;
    let usedFallback = 0;
    let shortChunks = 0;
    
    const expanded = results.map((result) => {
      // Use parent_text if available (Small2Big), otherwise use the chunk text itself
      const parentText = result.metadata.parent_text || result.text;
      const parentTokenCount = result.metadata.parent_token_count || result.metadata.token_count || 0;
      
      // Track expansion quality
      if (result.metadata.parent_text) {
        hasParentText++;
      } else {
        usedFallback++;
      }
      
      // Warn about very short chunks
      if (parentText.length < 100) {
        shortChunks++;
      }

      return {
        parentText,
        parentTokenCount: parentTokenCount > 0 ? parentTokenCount : Math.ceil(parentText.length / 4), // Estimate if missing
        smallChunkId: result.id,
        smallChunkText: result.text,
        metadata: result.metadata,
        score: result.score,
      };
    });
    
    console.log(`[ChromaDB] Chunk expansion: ${hasParentText}/${results.length} have parent_text, ${usedFallback} used fallback, ${shortChunks} are short (<100 chars)`);
    
    return expanded;
  }

  /**
   * Filter expanded chunks to fit within token budget
   * Prioritizes higher-scoring chunks
   */
  filterByTokenBudget(
    expandedChunks: Array<{
      parentText: string;
      parentTokenCount: number;
      smallChunkId: string;
      smallChunkText: string;
      metadata: Record<string, any>;
      score: number;
    }>,
    maxTokens: number
  ): Array<{
    parentText: string;
    parentTokenCount: number;
    smallChunkId: string;
    smallChunkText: string;
    metadata: Record<string, any>;
    score: number;
  }> {
    const filtered: typeof expandedChunks = [];
    let currentTokens = 0;

    // Sort by score (descending) to prioritize most relevant chunks
    const sorted = [...expandedChunks].sort((a, b) => b.score - a.score);

    for (const chunk of sorted) {
      if (currentTokens + chunk.parentTokenCount <= maxTokens) {
        filtered.push(chunk);
        currentTokens += chunk.parentTokenCount;
      } else {
        console.log(`[ChromaDB] Skipping chunk (${chunk.parentTokenCount} tokens) - would exceed budget (${currentTokens + chunk.parentTokenCount}/${maxTokens})`);
      }
    }

    console.log(`[ChromaDB] Token budget filtering: ${filtered.length}/${expandedChunks.length} chunks, ${currentTokens}/${maxTokens} tokens used`);

    return filtered;
  }

  async add(documents: string[], embeddings: number[][], metadatas: any[], ids: string[]): Promise<void> {
    // Use Electron IPC for adding documents
    if (typeof window !== 'undefined' && (window as any).electronAPI?.chromaDbAdd) {
      try {
        const result = await (window as any).electronAPI.chromaDbAdd({
          collection: this.collectionName,
          documents,
          embeddings,
          metadatas,
          ids,
        });

        if (!result.success) {
          throw new Error(result.error || 'ChromaDB add failed');
        }
      } catch (error) {
        throw error;
      }
    } else {
      throw new Error('ChromaDB not available - Electron IPC not found');
    }
  }

  setCollectionName(name: string): void {
    this.collectionName = name;
  }

  getCollectionName(): string {
    return this.collectionName;
  }

  setChromaUrl(_url: string): void {
    // No-op for IPC-based implementation
  }

  getChromaUrl(): string {
    return 'ipc://ai-service';
  }
}

// Singleton instance
let chromaClientInstance: ChromaDBClient | null = null;

export function getChromaDBClient(_chromaUrl?: string, collectionName?: string): ChromaDBClient {
  if (!chromaClientInstance) {
    chromaClientInstance = new ChromaDBClient(undefined, collectionName);
  }
  return chromaClientInstance;
}
