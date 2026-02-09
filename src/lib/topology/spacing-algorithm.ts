/**
 * Dynamic Spacing Calculation System
 *
 * Determines optimal node spacing, rank separation, and edge separation
 * based on diagram density and user preferences.
 *
 * Integration Points:
 * - Called by auto-tidy system before layout application
 * - Used by Dagre layout engine for configuration
 * - Exposed in topology settings for manual override
 */

import type { Node, Edge } from '@xyflow/react';

// =============================================================================
// Types
// =============================================================================

/**
 * Spacing tier determines the overall spacing density of the layout.
 * - compact: Tight spacing for dense diagrams or limited space
 * - comfortable: Balanced spacing for typical use cases (default)
 * - spacious: Generous spacing for presentation or clarity
 */
export type SpacingTier = 'compact' | 'comfortable' | 'spacious';

/**
 * Result of the spacing calculation containing all layout spacing parameters.
 */
export interface OptimalSpacing {
  /** Horizontal spacing between nodes in the same rank */
  nodesep: number;
  /** Vertical spacing between ranks/layers */
  ranksep: number;
  /** Spacing for edge routing between parallel edges */
  edgesep: number;
}

/**
 * Configuration options for spacing calculation.
 */
export interface SpacingCalculationConfig {
  /** The spacing tier to use */
  tier: SpacingTier;
  /** Base spacing value in pixels (default: 75) */
  baseSpacing: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Spacing multipliers for each tier.
 * These multipliers are applied to the base spacing value.
 */
export const SPACING_TIER_MULTIPLIERS: Record<
  SpacingTier,
  { nodesep: number; ranksep: number; edgesep: number }
> = {
  compact: {
    nodesep: 2.0, // 2x base for horizontal node separation
    ranksep: 2.5, // 2.5x base for rank separation
    edgesep: 0.4, // 0.4x base for edge separation
  },
  comfortable: {
    nodesep: 2.6, // 2.6x base for horizontal node separation
    ranksep: 3.5, // 3.5x base for rank separation
    edgesep: 0.6, // 0.6x base for edge separation
  },
  spacious: {
    nodesep: 3.5, // 3.5x base for horizontal node separation
    ranksep: 5.0, // 5x base for rank separation
    edgesep: 0.8, // 0.8x base for edge separation
  },
};

/**
 * Density thresholds for spacing adjustments.
 */
export const DENSITY_THRESHOLDS = {
  /** High density threshold - reduce spacing when exceeded */
  HIGH: 0.5,
  /** Low density threshold - increase spacing when below */
  LOW: 0.2,
} as const;

/**
 * Adjustment factors for density-based modifications.
 */
export const DENSITY_ADJUSTMENTS = {
  /** Multiplier for high-density graphs (reduces spacing by 20%) */
  HIGH_DENSITY_FACTOR: 0.8,
  /** Multiplier for low-density graphs (increases spacing by 15%) */
  LOW_DENSITY_FACTOR: 1.15,
} as const;

/**
 * Default base spacing value in pixels.
 * Adjusted to 38 (approximately 50% of original 75) to match 6pt default font size.
 */
export const DEFAULT_BASE_SPACING = 38;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculates the edge density of a graph.
 *
 * Edge density is the ratio of actual edges to the maximum possible edges
 * in a complete undirected graph.
 *
 * Formula: edgeDensity = edges.length / (n * (n - 1) / 2)
 * where n is the number of nodes.
 *
 * @param nodeCount - Number of nodes in the graph
 * @param edgeCount - Number of edges in the graph
 * @returns Edge density value between 0 and 1 (or higher for multigraphs)
 */
export function calculateEdgeDensity(nodeCount: number, edgeCount: number): number {
  // Handle edge cases
  if (nodeCount <= 1) {
    return 0;
  }

  // Maximum possible edges in a complete undirected graph
  const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;

  // Avoid division by zero (shouldn't happen with nodeCount > 1, but be safe)
  if (maxPossibleEdges === 0) {
    return 0;
  }

  return edgeCount / maxPossibleEdges;
}

/**
 * Determines the density adjustment factor based on edge density.
 *
 * - High density (>0.5): Returns 0.8 to reduce spacing by 20%
 * - Low density (<0.2): Returns 1.15 to increase spacing by 15%
 * - Normal density: Returns 1.0 (no adjustment)
 *
 * @param edgeDensity - The calculated edge density (0 to 1+)
 * @returns Adjustment multiplier to apply to spacing values
 */
export function getDensityAdjustmentFactor(edgeDensity: number): number {
  if (edgeDensity > DENSITY_THRESHOLDS.HIGH) {
    return DENSITY_ADJUSTMENTS.HIGH_DENSITY_FACTOR;
  }

  if (edgeDensity < DENSITY_THRESHOLDS.LOW) {
    return DENSITY_ADJUSTMENTS.LOW_DENSITY_FACTOR;
  }

  return 1.0;
}

/**
 * Calculates optimal spacing parameters for a graph layout.
 *
 * This function determines the best nodesep, ranksep, and edgesep values
 * based on:
 * 1. The spacing tier (compact, comfortable, spacious)
 * 2. The diagram's edge density
 * 3. The base spacing value
 *
 * @param childNodes - Array of nodes to be laid out
 * @param edges - Array of edges connecting the nodes
 * @param spacingTier - The desired spacing tier (default: 'comfortable')
 * @param baseSpacing - Base spacing value in pixels (default: 75)
 * @returns Optimal spacing parameters for layout engines
 *
 * @example
 * ```typescript
 * const nodes = [...]; // Your ReactFlow nodes
 * const edges = [...]; // Your ReactFlow edges
 *
 * // Default comfortable spacing
 * const spacing = calculateOptimalSpacing(nodes, edges);
 *
 * // Compact spacing for dense diagrams
 * const compactSpacing = calculateOptimalSpacing(nodes, edges, 'compact');
 *
 * // Custom base spacing
 * const customSpacing = calculateOptimalSpacing(nodes, edges, 'spacious', 100);
 * ```
 */
export function calculateOptimalSpacing<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(
  childNodes: NodeType[],
  edges: EdgeType[],
  spacingTier: SpacingTier = 'comfortable',
  baseSpacing: number = DEFAULT_BASE_SPACING
): OptimalSpacing {
  // Get tier multipliers
  const tierMultipliers = SPACING_TIER_MULTIPLIERS[spacingTier];

  // Calculate base spacing values from tier multipliers
  let nodesep = Math.round(baseSpacing * tierMultipliers.nodesep);
  let ranksep = Math.round(baseSpacing * tierMultipliers.ranksep);
  let edgesep = Math.round(baseSpacing * tierMultipliers.edgesep);

  // Calculate edge density for the graph
  const nodeCount = childNodes.length;
  const edgeCount = edges.length;
  const edgeDensity = calculateEdgeDensity(nodeCount, edgeCount);

  // Apply density-based adjustment
  const densityAdjustment = getDensityAdjustmentFactor(edgeDensity);

  // Apply adjustment to all spacing values
  nodesep = Math.round(nodesep * densityAdjustment);
  ranksep = Math.round(ranksep * densityAdjustment);
  edgesep = Math.round(edgesep * densityAdjustment);

  return {
    nodesep,
    ranksep,
    edgesep,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a spacing configuration object with defaults.
 *
 * @param tier - Spacing tier (default: 'comfortable')
 * @param baseSpacing - Base spacing value (default: 75)
 * @returns Configuration object for spacing calculation
 */
export function createSpacingConfig(
  tier: SpacingTier = 'comfortable',
  baseSpacing: number = DEFAULT_BASE_SPACING
): SpacingCalculationConfig {
  return {
    tier,
    baseSpacing,
  };
}

/**
 * Validates a spacing tier value.
 *
 * @param tier - Value to validate
 * @returns True if the tier is valid
 */
export function isValidSpacingTier(tier: unknown): tier is SpacingTier {
  return tier === 'compact' || tier === 'comfortable' || tier === 'spacious';
}

/**
 * Gets the spacing tier from a string, with fallback to 'comfortable'.
 *
 * @param tier - String value to convert
 * @returns Valid spacing tier
 */
export function getSpacingTier(tier: string | undefined | null): SpacingTier {
  if (isValidSpacingTier(tier)) {
    return tier;
  }
  return 'comfortable';
}

/**
 * Calculates spacing with a configuration object.
 * Alternative API for calculateOptimalSpacing using a config object.
 *
 * @param childNodes - Array of nodes to be laid out
 * @param edges - Array of edges connecting the nodes
 * @param config - Spacing configuration
 * @returns Optimal spacing parameters
 */
export function calculateOptimalSpacingWithConfig<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
>(
  childNodes: NodeType[],
  edges: EdgeType[],
  config: Partial<SpacingCalculationConfig> = {}
): OptimalSpacing {
  const { tier = 'comfortable', baseSpacing = DEFAULT_BASE_SPACING } = config;
  return calculateOptimalSpacing(childNodes, edges, tier, baseSpacing);
}
