/**
 * Layout Configuration Constants
 *
 * Centralized spacing constants and calculation functions for topology layouts.
 * Used by Dagre and import systems to ensure consistent, non-overlapping node placement.
 */

// =============================================================================
// Node Dimension Constants
// =============================================================================

export const LAYOUT_CONSTANTS = {
  // Device node dimensions (from DeviceNode.tsx)
  DEVICE_MIN_WIDTH: 120,
  DEVICE_MIN_HEIGHT: 80,
  DEVICE_DEFAULT_WIDTH: 140,
  DEVICE_DEFAULT_HEIGHT: 110,

  // Boundary dimensions (from GroupNode.tsx)
  BOUNDARY_MIN_WIDTH: 300,
  BOUNDARY_MIN_HEIGHT: 200,
  BOUNDARY_DEFAULT_WIDTH: 400,
  BOUNDARY_DEFAULT_HEIGHT: 300,

  // Internal padding for child layout within boundaries
  BOUNDARY_PADDING: 45,

  // Spacing multipliers (relative to node size)
  // These ensure nodes don't overlap even with labels and handles
  SPACING_MULTIPLIER_HORIZONTAL: 0.3, // 30% of node width added as gap
  SPACING_MULTIPLIER_VERTICAL: 0.4, // 40% of node height added as gap

  // Absolute minimum gaps (prevents tiny spacing with small nodes)
  SPACING_MINIMUM: 20,
  SPACING_MINIMUM_RANK: 30,

  // Edge routing space
  EDGE_SEPARATION: 15,

  // Terraform/Import grid defaults
  IMPORT_GRID_SPACING_FACTOR: 1.5, // 1.5x node size for grid layout
  IMPORT_GRID_MIN_SPACING: 100,
} as const;

// =============================================================================
// Spacing Calculation Functions
// =============================================================================

export interface AdaptiveSpacing {
  nodesep: number; // Horizontal spacing between nodes in same rank
  ranksep: number; // Vertical spacing between ranks/layers
  edgesep: number; // Spacing for edge routing
}

/**
 * Calculate adaptive spacing based on actual node dimensions.
 * Ensures nodes have adequate separation regardless of their size.
 *
 * @param avgWidth - Average width of nodes to be laid out
 * @param avgHeight - Average height of nodes to be laid out
 * @param direction - Layout direction for optimization
 * @returns Spacing values for layout algorithms
 */
export function calculateAdaptiveSpacing(
  avgWidth: number,
  avgHeight: number,
  _direction: 'horizontal' | 'vertical' | 'both' = 'both'
): AdaptiveSpacing {
  // Use effective dimensions (at least the defaults)
  const effectiveWidth = Math.max(avgWidth, LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
  const effectiveHeight = Math.max(avgHeight, LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

  // Calculate spacing with multipliers
  const horizontalSpacing = Math.max(
    LAYOUT_CONSTANTS.SPACING_MINIMUM,
    Math.round(effectiveWidth * LAYOUT_CONSTANTS.SPACING_MULTIPLIER_HORIZONTAL)
  );

  const verticalSpacing = Math.max(
    LAYOUT_CONSTANTS.SPACING_MINIMUM_RANK,
    Math.round(effectiveHeight * LAYOUT_CONSTANTS.SPACING_MULTIPLIER_VERTICAL)
  );

  // For rank separation, add a bit more to account for labels and handles
  const rankSeparation = Math.round(verticalSpacing * 1.3);

  return {
    nodesep: horizontalSpacing,
    ranksep: rankSeparation,
    edgesep: LAYOUT_CONSTANTS.EDGE_SEPARATION,
  };
}

/**
 * Calculate grid spacing for imports (Terraform, JSON, etc.)
 * Ensures imported nodes are placed in a readable grid pattern.
 *
 * @param nodeWidth - Typical width of nodes being imported
 * @param nodeHeight - Typical height of nodes being imported
 * @returns Grid cell spacing in pixels
 */
export function calculateImportGridSpacing(
  nodeWidth: number = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
  nodeHeight: number = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT
): number {
  const maxDimension = Math.max(nodeWidth, nodeHeight);
  return Math.max(
    LAYOUT_CONSTANTS.IMPORT_GRID_MIN_SPACING,
    Math.round(maxDimension * LAYOUT_CONSTANTS.IMPORT_GRID_SPACING_FACTOR)
  );
}

/**
 * Calculate required boundary size to fit children with proper spacing.
 *
 * @param childCount - Number of child nodes
 * @param nodeWidth - Width of child nodes
 * @param nodeHeight - Height of child nodes
 * @param columns - Number of columns (for grid layout)
 * @returns Required boundary dimensions
 */
export function calculateBoundarySize(
  childCount: number,
  nodeWidth: number = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
  nodeHeight: number = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
  columns: number = 1
): { width: number; height: number } {
  if (childCount === 0) {
    return {
      width: LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
      height: LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
    };
  }

  const spacing = calculateAdaptiveSpacing(nodeWidth, nodeHeight, 'both');
  const rows = Math.ceil(childCount / columns);

  // Width: columns * nodeWidth + (columns - 1) * spacing + 2 * padding
  const width = Math.max(
    LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
    columns * nodeWidth +
      (columns - 1) * spacing.nodesep +
      2 * LAYOUT_CONSTANTS.BOUNDARY_PADDING
  );

  // Height: rows * nodeHeight + (rows - 1) * spacing + 2 * padding
  const height = Math.max(
    LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
    rows * nodeHeight + (rows - 1) * spacing.ranksep + 2 * LAYOUT_CONSTANTS.BOUNDARY_PADDING
  );

  return { width, height };
}

/**
 * Get average dimensions from a collection of nodes, accounting for device image scaling.
 *
 * @param nodes - Array of nodes with optional measured/width/height properties and data
 * @param globalDeviceImageSize - Global device image size percentage (20-100), defaults to 55
 * @returns Average width and height accounting for visual scaling
 */
export function getAverageNodeDimensions(
  nodes: Array<{
    measured?: { width?: number; height?: number };
    width?: number;
    height?: number;
    type?: string;
    data?: any;
  }>,
  globalDeviceImageSize: number = 55
): { avgWidth: number; avgHeight: number } {
  if (nodes.length === 0) {
    return {
      avgWidth: LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
      avgHeight: LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
    };
  }

  let totalWidth = 0;
  let totalHeight = 0;

  for (const node of nodes) {
    // Use measured dimensions if available, then explicit, then defaults
    let baseWidth =
      node.measured?.width ||
      node.width ||
      (node.type === 'boundary'
        ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
        : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);

    let baseHeight =
      node.measured?.height ||
      node.height ||
      (node.type === 'boundary'
        ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
        : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

    // For device nodes, account for image scaling
    if (node.type === 'device' && node.data) {
      // Get the effective image size (per-device override or global)
      const deviceImageSize = node.data.deviceImageSize ?? globalDeviceImageSize;

      // Scale factor: image size percentage relative to default 55%
      // At 55% (default), scaleFactor = 1.0
      // At 100%, scaleFactor ≈ 1.82
      // At 20%, scaleFactor ≈ 0.36
      const scaleFactor = deviceImageSize / 55;

      // Apply scaling to dimensions
      // This reflects the visual impact of the scaled icon on perceived node size
      baseWidth = Math.round(baseWidth * scaleFactor);
      baseHeight = Math.round(baseHeight * scaleFactor);
    }

    totalWidth += baseWidth;
    totalHeight += baseHeight;
  }

  return {
    avgWidth: Math.round(totalWidth / nodes.length),
    avgHeight: Math.round(totalHeight / nodes.length),
  };
}
