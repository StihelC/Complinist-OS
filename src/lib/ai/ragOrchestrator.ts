// RAG Orchestrator
// Main RAG pipeline: retrieval + generation

import type { RAGRequest, RAGResponse } from './types';
import { getLLMServer } from './llamaServer';
import { getEmbeddingService } from './embeddingService';
import { getChromaDBClient } from './chromaClient';
import { buildControlNarrativePrompt } from './promptTemplates';
import { buildTopologyContext } from './contextBuilder';
import { processNarrativeResponse } from './responseProcessor';
import { getCatalogForBaseline } from '@/lib/controls/controlCatalog';
import {
  calculateControlNarrativeOverhead,
  calculateAvailableTokensForChunks,
  validatePromptSize,
} from './tokenUtils';
import {
  buildTopologyContext as buildTopologyContextEnhanced,
  formatTopologyContextForPrompt,
} from './topologyContextBuilder';
import { getFlowStoreState } from '@/core/stores/flowStoreAccessor';

// Get calibrated context size
function getCalibratedContextSize(): number {
  if (typeof window !== 'undefined' && (window as any).calibratedContextSize) {
    return (window as any).calibratedContextSize;
  }
  return 2500;
}

export class RAGOrchestrator {
  private llmServer = getLLMServer();
  private embeddingService = getEmbeddingService();
  private chromaClient = getChromaDBClient();

  async generateControlNarrative(request: RAGRequest): Promise<RAGResponse> {
    const {
      controlId,
      baseline,
      systemName,
      selectedDeviceIds,
      selectedBoundaryIds,
      additionalContext,
      topologyVersion,
    } = request;

    // 1. Get control catalog information
    const catalog = await getCatalogForBaseline(baseline);
    const control = catalog.items[controlId];
    if (!control) {
      throw new Error(`Control ${controlId} not found in catalog for baseline ${baseline}`);
    }

    // 2. Build topology context
    // Using the flowStoreAccessor to avoid circular dependencies
    const flowStore = getFlowStoreState();
    const { nodes, edges } = flowStore;
    const topologyContext = buildTopologyContext(nodes, edges, selectedDeviceIds, selectedBoundaryIds);

    // 3. Build query embedding
    const queryText = `Control ${controlId} ${control.title} narrative for ${systemName} baseline ${baseline}`;
    const embeddingResponse = await this.embeddingService.embed({ text: queryText });
    const queryEmbedding = embeddingResponse.embeddings[0];

    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding');
    }

    // 4. Retrieve relevant chunks from ChromaDB
    const retrievedChunks = await this.chromaClient.query({
      queryEmbedding,
      topK: 6,
      filters: {
        controlIdHints: { $contains: controlId },
        controlFamily: control.family,
        baseline,
        ...(topologyVersion ? { topologyVersion: { $gte: topologyVersion - 1 } } : {}),
      },
    });

    // 5. Calculate token budget
    const calibratedContextSize = getCalibratedContextSize();
    const responseReserve = 600; // Reserve for response
    const topologySummary = JSON.stringify(topologyContext).substring(0, 500); // Estimate
    const promptOverhead = calculateControlNarrativeOverhead(
      controlId,
      control.title,
      systemName,
      topologySummary,
      retrievedChunks.length
    );
    
    console.log(`[Control Narrative] Token budget: context=${calibratedContextSize}, overhead=${promptOverhead}, response=${responseReserve}`);

    // 6. Expand and filter chunks if they have parent_text
    const expandedChunks = this.chromaClient.expandToParentChunks(retrievedChunks);
    const availableForChunks = calculateAvailableTokensForChunks(
      calibratedContextSize,
      promptOverhead,
      responseReserve,
      256
    );
    const filteredChunks = this.chromaClient.filterByTokenBudget(expandedChunks, availableForChunks);

    // 7. Build prompt
    const prompt = buildControlNarrativePrompt({
      controlId,
      controlTitle: control.title,
      controlObjective: control.default_narrative || '',
      baseline,
      systemName,
      topologyContext,
      retrievedSnippets: filteredChunks.map((chunk) => chunk.parentText),
      additionalContext,
    });

    // Validate prompt size
    const validation = validatePromptSize(prompt, calibratedContextSize, responseReserve);
    console.log(`[Control Narrative] Prompt: ${validation.promptTokens} tokens (limit: ${validation.available}), ${filteredChunks.length} chunks`);

    if (!validation.valid) {
      console.warn(`[Control Narrative] Prompt exceeds budget, using fewer chunks`);
      // Truncate prompt or use fewer chunks as fallback
    }

    // 8. Generate narrative with LLM
    const llmResponse = await this.llmServer.generate({
      prompt,
      temperature: 0.4,
      maxTokens: 600,
    });

    // 9. Process and validate response
    const processed = processNarrativeResponse(llmResponse.text, nodes, controlId);

    // 10. Build references
    const references = retrievedChunks.map((chunk) => ({
      chunkId: chunk.id,
      reason: `Similarity ${chunk.score.toFixed(2)} - ${chunk.metadata.controlIdHints || 'control context'}`,
      score: chunk.score,
    }));

    return {
      controlId,
      narrative: processed.text,
      references,
      tokensUsed: llmResponse.tokensUsed,
      retrievedChunks,
    };
  }

  async *generateControlNarrativeStream(request: RAGRequest): AsyncGenerator<string, void, unknown> {
    const {
      controlId,
      baseline,
      systemName,
      selectedDeviceIds,
      selectedBoundaryIds,
      additionalContext,
      topologyVersion,
    } = request;

    // 1. Get control catalog information
    const catalog = await getCatalogForBaseline(baseline);
    const control = catalog.items[controlId];
    if (!control) {
      throw new Error(`Control ${controlId} not found in catalog for baseline ${baseline}`);
    }

    // 2. Build topology context
    // Using the flowStoreAccessor to avoid circular dependencies
    const flowStore = getFlowStoreState();
    const { nodes, edges } = flowStore;
    const topologyContext = buildTopologyContext(nodes, edges, selectedDeviceIds, selectedBoundaryIds);

    // 3. Build query embedding
    const queryText = `Control ${controlId} ${control.title} narrative for ${systemName} baseline ${baseline}`;
    const embeddingResponse = await this.embeddingService.embed({ text: queryText });
    const queryEmbedding = embeddingResponse.embeddings[0];

    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding');
    }

    // 4. Retrieve relevant chunks from ChromaDB
    const retrievedChunks = await this.chromaClient.query({
      queryEmbedding,
      topK: 6,
      filters: {
        controlIdHints: { $contains: controlId },
        controlFamily: control.family,
        baseline,
        ...(topologyVersion ? { topologyVersion: { $gte: topologyVersion - 1 } } : {}),
      },
    });

    // 5. Build prompt
    const prompt = buildControlNarrativePrompt({
      controlId,
      controlTitle: control.title,
      controlObjective: control.default_narrative || '',
      baseline,
      systemName,
      topologyContext,
      retrievedSnippets: retrievedChunks.map((chunk) => chunk.text),
      additionalContext,
    });

    // 6. Stream generation
    yield* this.llmServer.generateStream({
      prompt,
      temperature: 0.4,
      maxTokens: 600,
    });
  }

  /**
   * Generate response for topology queries
   * Queries both in-memory state and SQL database for comprehensive context
   */
  async generateTopologyResponse(query: string, projectId: number | null): Promise<string> {
    // Build comprehensive topology context
    const topologyContext = await buildTopologyContextEnhanced(projectId, query);
    
    // Format context for LLM
    const contextText = formatTopologyContextForPrompt(topologyContext);
    
    // Build prompt
    const prompt = `You are a network topology assistant. Answer the user's question based ONLY on the topology information provided below.

Topology Information:
${contextText}

User Question: ${query}

Answer (be specific and cite device names, IPs, and control IDs when relevant):`;

    // Get calibrated context size
    const calibratedContextSize = getCalibratedContextSize();
    const validation = validatePromptSize(prompt, calibratedContextSize, 600);
    
    if (!validation.valid) {
      console.warn('[Topology Query] Prompt exceeds context size, truncating context');
      // TODO: Implement intelligent truncation
    }

    // Generate response
    const llmResponse = await this.llmServer.generate({
      prompt,
      temperature: 0.4,
      maxTokens: 600,
    });

    return llmResponse.text.trim();
  }

  /**
   * Stream topology response
   */
  async *generateTopologyResponseStream(
    query: string,
    projectId: number | null
  ): AsyncGenerator<string, void, unknown> {
    // Build comprehensive topology context
    const topologyContext = await buildTopologyContextEnhanced(projectId, query);
    
    // Format context for LLM
    const contextText = formatTopologyContextForPrompt(topologyContext);
    
    // Build prompt
    const prompt = `You are a network topology assistant. Answer the user's question based ONLY on the topology information provided below.

Topology Information:
${contextText}

User Question: ${query}

Answer (be specific and cite device names, IPs, and control IDs when relevant):`;

    // Stream generation
    yield* this.llmServer.generateStream({
      prompt,
      temperature: 0.4,
      maxTokens: 600,
    });
  }
}

// Singleton instance
let ragOrchestratorInstance: RAGOrchestrator | null = null;

export function getRAGOrchestrator(): RAGOrchestrator {
  if (!ragOrchestratorInstance) {
    ragOrchestratorInstance = new RAGOrchestrator();
  }
  return ragOrchestratorInstance;
}

