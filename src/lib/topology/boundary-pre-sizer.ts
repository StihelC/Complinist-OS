/**
 * Boundary Pre-Sizer
 *
 * Calculates boundary sizes BEFORE layout runs.
 * This ensures the layout algorithm knows the correct boundary dimensions upfront.
 *
 * @module boundary-pre-sizer
 */

import { AppNode } from '@/lib/utils/types';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import type { LayoutDimensions } from './layout-dimensions';
import type { SpacingTier } from './auto-tidy';
import { layoutLogger } from './layoutLogger';

// =============================================================================
// Constants
// =============================================================================

const SPACING_TIER_MULTIPLIERS: Record<SpacingTier, number> = {
  compact: 0.7,
  comfortable: 1.0,
  spacious: 1.4,
};

const BASE_SPACING = 80; // Base spacing between nodes

// =============================================================================
// Size Estimation
// =============================================================================

/**
 * Estimate boundary size from child dimensions
 * Uses grid packing algorithm to calculate required space
 */
export function estimateBoundarySize(
  children: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>,
  tier: SpacingTier
): { width: number; height: number } {
  if (children.length === 0) {
    layoutLogger.debug('[BoundaryPreSizer] No children - using minimum size');
    return {
      width: LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
      height: LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
    };
  }

  layoutLogger.debug(`[BoundaryPreSizer] Estimating size for ${children.length} children...`);

  // Get child layout dimensions
  const childDims = children
    .map(c => {
      const dims = dimensionsMap.get(c.id)?.layout;
      const label = c.type === 'device' ? (c.data as any).label : (c.data as any).label;
      if (dims) {
        layoutLogger.debug(`[BoundaryPreSizer] Child "${label || c.id.slice(0, 8)}": ${dims.width}×${dims.height}`);
      } else {
        layoutLogger.warn(`[BoundaryPreSizer] Child "${label || c.id.slice(0, 8)}": NO DIMENSIONS!`);
      }
      return dims;
    })
    .filter(Boolean) as { width: number; height: number }[];

  if (childDims.length === 0) {
    layoutLogger.warn('[BoundaryPreSizer] No child dimensions found - using minimum size');
    return {
      width: LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
      height: LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
    };
  }

  // Calculate average child size
  const totalWidth = childDims.reduce((sum, d) => sum + d.width, 0);
  const totalHeight = childDims.reduce((sum, d) => sum + d.height, 0);
  const avgWidth = totalWidth / childDims.length;
  const avgHeight = totalHeight / childDims.length;

  layoutLogger.debug(`[BoundaryPreSizer] Average child size: ${Math.round(avgWidth)}×${Math.round(avgHeight)}`);

  // Calculate spacing
  const spacing = Math.round(BASE_SPACING * SPACING_TIER_MULTIPLIERS[tier]);

  // Estimate grid layout (square-ish grid)
  const columns = Math.ceil(Math.sqrt(children.length));
  const rows = Math.ceil(children.length / columns);

  layoutLogger.debug(`[BoundaryPreSizer] Grid layout: ${columns} cols × ${rows} rows, spacing: ${spacing}px`);

  // Calculate required size
  const padding = LAYOUT_CONSTANTS.BOUNDARY_PADDING;

  const width =
    columns * avgWidth +
    (columns - 1) * spacing +
    2 * padding;

  const height =
    rows * avgHeight +
    (rows - 1) * spacing +
    2 * padding;

  const result = {
    width: Math.max(
      LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
      Math.round(width)
    ),
    height: Math.max(
      LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
      Math.round(height)
    ),
  };

  layoutLogger.debug(`[BoundaryPreSizer] Calculated boundary size: ${result.width}×${result.height}`);
  layoutLogger.debug(`[BoundaryPreSizer] Breakdown: (${columns} × ${Math.round(avgWidth)}) + (${columns - 1} × ${spacing}) + (2 × ${padding}) = ${result.width}w`);
  layoutLogger.debug(`[BoundaryPreSizer] Breakdown: (${rows} × ${Math.round(avgHeight)}) + (${rows - 1} × ${spacing}) + (2 × ${padding}) = ${result.height}h`);

  return result;
}

// =============================================================================
// Depth Calculation
// =============================================================================

/**
 * Get nesting depth of a boundary
 */
function getBoundaryDepth(boundaryId: string, allNodes: AppNode[]): number {
  let depth = 0;
  let current = allNodes.find(n => n.id === boundaryId);

  while (current?.parentId) {
    const parent = allNodes.find(n => n.id === current!.parentId);
    if (parent?.type === 'boundary') {
      depth++;
    }
    current = parent;
  }

  return depth;
}

/**
 * Sort boundaries by depth (deepest first for bottom-up processing)
 */
function sortByDepth(
  boundaries: AppNode[],
  allNodes: AppNode[],
  order: 'asc' | 'desc' = 'desc'
): AppNode[] {
  const withDepth = boundaries.map(b => ({
    boundary: b,
    depth: getBoundaryDepth(b.id, allNodes),
  }));

  withDepth.sort((a, b) => {
    return order === 'desc'
      ? b.depth - a.depth
      : a.depth - b.depth;
  });

  return withDepth.map(item => item.boundary);
}

// =============================================================================
// Main Pre-Sizing Function
// =============================================================================

/**
 * Pre-calculate boundary sizes based on child count and dimensions
 * Runs BEFORE layout so the layout algorithm knows the correct boundary size
 *
 * @param nodes - All nodes in the topology
 * @param dimensionsMap - Pre-calculated dimensions for all nodes
 * @param tier - Spacing tier for size calculation
 * @returns Nodes with updated boundary sizes
 */
export async function precalculateBoundarySizes(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>,
  tier: SpacingTier
): Promise<AppNode[]> {
  layoutLogger.debug('[BoundaryPreSizer] Pre-calculating boundary sizes...');

  const boundaries = nodes.filter(n => n.type === 'boundary');

  if (boundaries.length === 0) {
    layoutLogger.debug('[BoundaryPreSizer] No boundaries to process');
    return nodes;
  }

  // Process boundaries from deepest to shallowest (bottom-up)
  const sorted = sortByDepth(boundaries, nodes, 'desc');

  layoutLogger.debug(
    `[BoundaryPreSizer] Processing ${sorted.length} boundaries (deepest first)...`
  );

  let result = [...nodes];

  for (const boundary of sorted) {
    const children = result.filter(n => n.parentId === boundary.id);

    if (children.length === 0) {
      // Empty boundary - use minimum size
      const boundaryIndex = result.findIndex(n => n.id === boundary.id);
      if (boundaryIndex !== -1) {
        result[boundaryIndex] = {
          ...result[boundaryIndex],
          width: LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
          height: LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
        };

        // Update dimensions map
        const dims = dimensionsMap.get(boundary.id);
        if (dims) {
          dims.visual.width = LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH;
          dims.visual.height = LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT;
          dims.layout.width = LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH;
          dims.layout.height = LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT;
        }
      }
      continue;
    }

    // Estimate required size
    const estimate = estimateBoundarySize(children, dimensionsMap, tier);

    layoutLogger.debug(
      `[BoundaryPreSizer] ${boundary.data.label || boundary.id}: ` +
      `${children.length} children → ${estimate.width}×${estimate.height}`
    );

    // Apply estimated size
    const boundaryIndex = result.findIndex(n => n.id === boundary.id);
    if (boundaryIndex !== -1) {
      const before = result[boundaryIndex].width ? `${result[boundaryIndex].width}×${result[boundaryIndex].height}` : 'undefined';

      result[boundaryIndex] = {
        ...result[boundaryIndex],
        width: estimate.width,
        height: estimate.height,
        // Don't set measured - ReactFlow owns this property
      };

      layoutLogger.debug(`[BoundaryPreSizer] Updated node.width/height: ${before} → ${estimate.width}×${estimate.height}`);

      // Update dimensions map
      const dims = dimensionsMap.get(boundary.id);
      if (dims) {
        const dimsBefore = `${dims.layout.width}×${dims.layout.height}`;

        dims.visual.width = estimate.width;
        dims.visual.height = estimate.height;
        dims.layout.width = estimate.width;
        dims.layout.height = estimate.height;
        dims.core.width = estimate.width;
        dims.core.height = estimate.height;

        layoutLogger.debug(`[BoundaryPreSizer] Updated dimensionsMap: ${dimsBefore} → ${dims.layout.width}×${dims.layout.height}`);
      } else {
        layoutLogger.warn(`[BoundaryPreSizer] No dimensions in map for boundary "${boundary.data.label || boundary.id}"!`);
      }
    }
  }

  layoutLogger.info('[BoundaryPreSizer] Pre-calculation complete', {
    boundariesProcessed: sorted.length
  });

  return result;
}

/**
 * Check if a boundary needs resizing based on children
 * Useful for validation
 */
export function checkBoundaryFit(
  boundary: AppNode,
  children: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>
): {
  fits: boolean;
  required: { width: number; height: number };
  current: { width: number; height: number };
} {
  const current = {
    width: boundary.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH,
    height: boundary.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT,
  };

  const required = estimateBoundarySize(children, dimensionsMap, 'comfortable');

  return {
    fits: current.width >= required.width && current.height >= required.height,
    required,
    current,
  };
}

export default {
  estimateBoundarySize,
  precalculateBoundarySizes,
  checkBoundaryFit,
};
