// Embedding Service
// Handles embeddings via in-process AI service through IPC

import type { EmbeddingRequest, EmbeddingResponse } from './types';

const DEFAULT_TIMEOUT = 30000; // 30 seconds for embeddings

export class EmbeddingService {
  private timeout: number;
  private cache: Map<string, number[]> = new Map();

  constructor(_serverUrl?: string, timeout: number = DEFAULT_TIMEOUT) {
    this.timeout = timeout;
  }

  private getCacheKey(text: string): string {
    // Simple hash for caching
    return text;
  }

  async checkHealth(): Promise<boolean> {
    // Check via Electron IPC
    if (typeof window !== 'undefined' && (window as any).electronAPI?.checkAIHealth) {
      try {
        const health = await (window as any).electronAPI.checkAIHealth();
        return health?.embedding ?? false;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const { text } = request;
    const texts = Array.isArray(text) ? text : [text];

    // Check cache first
    const cachedEmbeddings: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    texts.forEach((t, index) => {
      const cacheKey = this.getCacheKey(t);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        cachedEmbeddings[index] = cached;
      } else {
        uncachedTexts.push(t);
        uncachedIndices.push(index);
      }
    });

    // If all cached, return immediately
    if (uncachedTexts.length === 0) {
      return {
        embeddings: cachedEmbeddings,
        dimensions: cachedEmbeddings[0]?.length || 0,
      };
    }

    // Fetch embeddings for uncached texts via IPC
    if (typeof window !== 'undefined' && (window as any).electronAPI?.embed) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Embedding generation timed out')), this.timeout);
        });

        // Send single string or array based on count (most efficient IPC usage)
        // For single text, send as string; for multiple, send as array
        const embedPromise = (window as any).electronAPI.embed({
          text: uncachedTexts.length === 1 ? uncachedTexts[0] : uncachedTexts,
        });

        const result = await Promise.race([embedPromise, timeoutPromise]);

        if (!result.success) {
          throw new Error(result.error || 'Embedding generation failed');
        }

        if (!result.data || !result.data.embeddings) {
          throw new Error('Invalid embedding response: missing embeddings data');
        }

        const newEmbeddings: number[][] = result.data.embeddings;
        
        if (!Array.isArray(newEmbeddings) || newEmbeddings.length === 0) {
          throw new Error(`Invalid embedding response: empty embeddings array (expected ${uncachedTexts.length} embeddings)`);
        }
        
        // Validate each embedding
        newEmbeddings.forEach((emb, idx) => {
          if (!Array.isArray(emb) || emb.length === 0) {
            throw new Error(`Invalid embedding at index ${idx}: empty or non-array`);
          }
        });

        // Cache the new embeddings
        uncachedTexts.forEach((t, i) => {
          const cacheKey = this.getCacheKey(t);
          this.cache.set(cacheKey, newEmbeddings[i]);
        });

        // Combine cached and new embeddings in correct order
        const allEmbeddings: number[][] = [];
        let uncachedIdx = 0;

        texts.forEach((_, index) => {
          if (cachedEmbeddings[index]) {
            allEmbeddings[index] = cachedEmbeddings[index];
          } else {
            allEmbeddings[index] = newEmbeddings[uncachedIdx++];
          }
        });

        return {
          embeddings: allEmbeddings,
          dimensions: allEmbeddings[0]?.length || 0,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new Error('Embedding generation timed out');
        }
        throw error;
      }
    }

    throw new Error('Embedding service not available - Electron IPC not found');
  }

  clearCache(): void {
    this.cache.clear();
  }

  setServerUrl(_url: string): void {
    // No-op for IPC-based implementation
  }

  getServerUrl(): string {
    return 'ipc://ai-service';
  }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(_serverUrl?: string): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

