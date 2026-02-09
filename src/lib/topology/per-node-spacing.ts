/**
 * Per-Node Spacing Calculator
 *
 * Calculates spacing for each node based on its actual size.
 * Eliminates one-size-fits-all spacing issues.
 *
 * @module per-node-spacing
 */

import { AppNode } from '@/lib/utils/types';
import type { LayoutDimensions } from './layout-dimensions';
import type { SpacingTier } from './auto-tidy';

// =============================================================================
// Types
// =============================================================================

export interface NodeSpacing {
  /** Horizontal spacing (gap to right) */
  horizontal: number;
  /** Vertical spacing (gap below) */
  vertical: number;
}

// =============================================================================
// Constants
// =============================================================================

const SPACING_TIER_MULTIPLIERS: Record<SpacingTier, number> = {
  compact: 0.7,
  comfortable: 1.0,
  spacious: 1.4,
};

// Minimum spacing to prevent nodes from touching
const MIN_HORIZONTAL_SPACING = 40;
const MIN_VERTICAL_SPACING = 50;

// Base spacing ratio (percentage of node size)
const BASE_SPACING_RATIO = 0.5; // 50% of node size

// =============================================================================
// Spacing Calculation
// =============================================================================

/**
 * Calculate spacing for a single node based on its size
 *
 * @param node - The node to calculate spacing for
 * @param dimensions - The node's dimensions
 * @param tier - Spacing tier preference
 * @returns Horizontal and vertical spacing
 */
export function calculateNodeSpacing(
  node: AppNode,
  dimensions: LayoutDimensions,
  tier: SpacingTier
): NodeSpacing {
  const multiplier = SPACING_TIER_MULTIPLIERS[tier];

  // Boundaries get minimal spacing (they have internal padding)
  if (node.type === 'boundary') {
    return {
      horizontal: Math.round(20 * multiplier),
      vertical: Math.round(20 * multiplier),
    };
  }

  // Devices: spacing proportional to their size
  const horizontal = Math.round(
    dimensions.layout.width * BASE_SPACING_RATIO * multiplier
  );

  const vertical = Math.round(
    dimensions.layout.height * BASE_SPACING_RATIO * multiplier
  );

  return {
    horizontal: Math.max(MIN_HORIZONTAL_SPACING, horizontal),
    vertical: Math.max(MIN_VERTICAL_SPACING, vertical),
  };
}

/**
 * Calculate spacing for all nodes
 *
 * @param nodes - All nodes in the topology
 * @param dimensionsMap - Pre-calculated dimensions for all nodes
 * @param tier - Spacing tier preference
 * @returns Map of node ID to spacing
 */
export function calculatePerNodeSpacing(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>,
  tier: SpacingTier
): Map<string, NodeSpacing> {
  const spacingMap = new Map<string, NodeSpacing>();

  for (const node of nodes) {
    const dimensions = dimensionsMap.get(node.id);

    if (!dimensions) {
      console.warn(`[PerNodeSpacing] No dimensions for node ${node.id}, using defaults`);
      spacingMap.set(node.id, {
        horizontal: MIN_HORIZONTAL_SPACING,
        vertical: MIN_VERTICAL_SPACING,
      });
      continue;
    }

    const spacing = calculateNodeSpacing(node, dimensions, tier);
    spacingMap.set(node.id, spacing);
  }

  return spacingMap;
}

/**
 * Get average spacing across all nodes
 * Useful for calculating global spacing parameters
 */
export function getAverageSpacing(
  spacingMap: Map<string, NodeSpacing>
): { horizontal: number; vertical: number } {
  if (spacingMap.size === 0) {
    return {
      horizontal: MIN_HORIZONTAL_SPACING,
      vertical: MIN_VERTICAL_SPACING,
    };
  }

  let totalHorizontal = 0;
  let totalVertical = 0;

  spacingMap.forEach(spacing => {
    totalHorizontal += spacing.horizontal;
    totalVertical += spacing.vertical;
  });

  return {
    horizontal: Math.round(totalHorizontal / spacingMap.size),
    vertical: Math.round(totalVertical / spacingMap.size),
  };
}

/**
 * Get spacing statistics for debugging
 */
export function getSpacingStats(
  spacingMap: Map<string, NodeSpacing>
): {
  count: number;
  avgHorizontal: number;
  avgVertical: number;
  minHorizontal: number;
  maxHorizontal: number;
  minVertical: number;
  maxVertical: number;
} {
  if (spacingMap.size === 0) {
    return {
      count: 0,
      avgHorizontal: 0,
      avgVertical: 0,
      minHorizontal: 0,
      maxHorizontal: 0,
      minVertical: 0,
      maxVertical: 0,
    };
  }

  const horizontals: number[] = [];
  const verticals: number[] = [];

  spacingMap.forEach(spacing => {
    horizontals.push(spacing.horizontal);
    verticals.push(spacing.vertical);
  });

  return {
    count: spacingMap.size,
    avgHorizontal: Math.round(horizontals.reduce((a, b) => a + b, 0) / horizontals.length),
    avgVertical: Math.round(verticals.reduce((a, b) => a + b, 0) / verticals.length),
    minHorizontal: Math.min(...horizontals),
    maxHorizontal: Math.max(...horizontals),
    minVertical: Math.min(...verticals),
    maxVertical: Math.max(...verticals),
  };
}

/**
 * Export spacing map for debugging
 */
export function exportSpacingMap(
  spacingMap: Map<string, NodeSpacing>
): Record<string, NodeSpacing> {
  const result: Record<string, NodeSpacing> = {};

  spacingMap.forEach((spacing, nodeId) => {
    result[nodeId] = spacing;
  });

  return result;
}

export default {
  calculateNodeSpacing,
  calculatePerNodeSpacing,
  getAverageSpacing,
  getSpacingStats,
  exportSpacingMap,
};
