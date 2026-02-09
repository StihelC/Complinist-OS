/**
 * Shared Token Utilities
 *
 * Pure functions for token counting and prompt budgeting.
 * Used by both main and renderer processes to ensure consistent calculations.
 */

import { TOKEN_ESTIMATION_RATIO } from './constants';

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for text
 * Uses 1 token ≈ 3.5 characters for English text (empirically tested)
 *
 * This is the single source of truth for token estimation across the application.
 * Both main and renderer processes should use this function.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / TOKEN_ESTIMATION_RATIO);
}

/**
 * Estimate token count for an array of texts
 */
export function estimateTokenCountBatch(texts: string[]): number {
  return texts.reduce((total, text) => total + estimateTokenCount(text), 0);
}

// ============================================================================
// Prompt Overhead Calculations
// ============================================================================

/**
 * Calculate prompt overhead for NIST RAG queries
 * Includes system message, query, headers, separators, and closing
 */
export function calculateNISTPromptOverhead(
  query: string,
  chunkCount: number
): number {
  // System message: "You are a NIST compliance expert. Answer based ONLY on the context below."
  const systemMessage = 80;

  // User query tokens
  const queryTokens = estimateTokenCount(query);

  // Headers per chunk: "[Document N | Type: X | Control: Y | Family: Z | Relevance: XX%]"
  const headerPerChunk = 30;

  // Separators between chunks: "\n\n---\n\n"
  const separators = Math.max(0, chunkCount - 1) * 5;

  // Closing: "Answer (cite control IDs when relevant):"
  const closing = 10;

  // Static text: "Question: ", "Context:", newlines
  const staticText = 20;

  return (
    systemMessage +
    queryTokens +
    headerPerChunk * chunkCount +
    separators +
    closing +
    staticText
  );
}

/**
 * Calculate prompt overhead for Control Narrative generation
 * Includes control info, topology summary, retrieved context
 */
export function calculateControlNarrativeOverhead(
  controlId: string,
  controlTitle: string,
  systemName: string,
  topologySummary: string,
  retrievedSnippetsCount: number
): number {
  // System message + control header
  const systemAndHeader = 150;

  // Control ID and title
  const controlInfo = estimateTokenCount(`${controlId} - ${controlTitle}`);

  // System name
  const systemInfo = estimateTokenCount(systemName);

  // Topology summary
  const topologyTokens = estimateTokenCount(topologySummary);

  // Retrieved snippets headers (numbered list)
  const snippetHeaders = retrievedSnippetsCount * 5;

  // Instructions section
  const instructions = 100;

  return (
    systemAndHeader +
    controlInfo +
    systemInfo +
    topologyTokens +
    snippetHeaders +
    instructions
  );
}

// ============================================================================
// Prompt Size Validation
// ============================================================================

/**
 * Validate that a prompt fits within the token budget
 * Returns true if prompt is within limits, false otherwise
 */
export function validatePromptSize(
  prompt: string,
  maxTokens: number,
  responseReserve: number = 200
): { valid: boolean; promptTokens: number; available: number } {
  const promptTokens = estimateTokenCount(prompt);
  const available = maxTokens - responseReserve;

  return {
    valid: promptTokens <= available,
    promptTokens,
    available,
  };
}

/**
 * Calculate available tokens for chunks given context size and overhead
 */
export function calculateAvailableTokensForChunks(
  contextSize: number,
  promptOverhead: number,
  responseReserve: number = 200,
  minimumChunkTokens: number = 256
): number {
  const available = contextSize - promptOverhead - responseReserve;
  return Math.max(available, minimumChunkTokens);
}

/**
 * Get recommended chunk count based on available tokens
 * Assumes average chunk size to determine how many chunks can fit
 */
export function getRecommendedChunkCount(
  availableTokens: number,
  averageChunkSize: number = 400
): number {
  return Math.max(1, Math.floor(availableTokens / averageChunkSize));
}

// ============================================================================
// Token Budget Planning
// ============================================================================

/**
 * Token budget breakdown for a prompt
 */
export interface TokenBudget {
  total: number;
  systemMessage: number;
  userQuery: number;
  context: number;
  responseReserve: number;
  available: number;
}

/**
 * Plan token budget for a RAG query
 */
export function planTokenBudget(
  contextSize: number,
  query: string,
  systemMessageTokens: number = 100,
  responseReserve: number = 200
): TokenBudget {
  const userQuery = estimateTokenCount(query);
  const overhead = systemMessageTokens + userQuery + responseReserve;
  const available = Math.max(0, contextSize - overhead);

  return {
    total: contextSize,
    systemMessage: systemMessageTokens,
    userQuery,
    context: available,
    responseReserve,
    available,
  };
}

/**
 * Calculate how many chunks can fit in the available context space
 */
export function calculateMaxChunks(
  availableTokens: number,
  averageChunkTokens: number,
  headerTokensPerChunk: number = 30
): number {
  if (averageChunkTokens <= 0) return 0;
  const effectiveChunkSize = averageChunkTokens + headerTokensPerChunk;
  return Math.max(1, Math.floor(availableTokens / effectiveChunkSize));
}

/**
 * Truncate text to fit within a token limit
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number
): { text: string; truncated: boolean; originalTokens: number } {
  const originalTokens = estimateTokenCount(text);

  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens };
  }

  // Estimate characters needed (tokens * ratio)
  const targetChars = Math.floor(maxTokens * TOKEN_ESTIMATION_RATIO);
  const truncatedText = text.slice(0, targetChars);

  return {
    text: truncatedText + '...',
    truncated: true,
    originalTokens,
  };
}
