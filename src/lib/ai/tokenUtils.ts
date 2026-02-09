/**
 * Token Counting Utilities
 *
 * Re-exports token utilities from the shared core module.
 * This maintains backward compatibility while using the consolidated implementation.
 *
 * @deprecated Import directly from '@/shared/core' instead
 */

// Re-export all token utilities from the shared core module
export {
  // Token estimation
  estimateTokenCount,
  estimateTokenCountBatch,

  // Prompt overhead calculations
  calculateNISTPromptOverhead,
  calculateControlNarrativeOverhead,

  // Prompt size validation
  validatePromptSize,
  calculateAvailableTokensForChunks,
  getRecommendedChunkCount,

  // Token budget planning
  type TokenBudget,
  planTokenBudget,
  calculateMaxChunks,
  truncateToTokenLimit,
} from '@/shared/core';
