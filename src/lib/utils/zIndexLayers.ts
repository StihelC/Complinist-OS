/**
 * Z-Index Layer Constants
 *
 * Fixed z-index layering for topology elements.
 * Order (bottom to top): Edges < Devices < Boundaries
 *
 * Boundaries are on top so their labels are visible above edges.
 * Boundaries have transparent backgrounds so devices inside remain visible.
 */

// =============================================================================
// Fixed Z-Index Values
// =============================================================================

/**
 * Z-Index values for each element type
 * - Edges: 1-10
 * - Devices: 50
 * - Boundaries: 100+ (allows nesting depth, deeper = higher)
 */
export const Z_INDEX = {
  EDGES: 1,
  EDGES_SELECTED: 5,
  DEVICES: 50,
  DEVICES_SELECTED: 55,
  BOUNDARY_BASE: 100,
  BOUNDARY_MAX_DEPTH: 10,
} as const;

// =============================================================================
// Z-Index Functions
// =============================================================================

/**
 * Get z-index for a boundary based on nesting depth
 * Deeper nested boundaries get higher z-index (above edges and devices)
 */
export function getBoundaryZIndex(nestingDepth: number): number {
  return Z_INDEX.BOUNDARY_BASE + Math.min(nestingDepth, Z_INDEX.BOUNDARY_MAX_DEPTH);
}

/**
 * Get z-index for a device
 */
export function getDeviceZIndex(selected: boolean = false): number {
  return selected ? Z_INDEX.DEVICES_SELECTED : Z_INDEX.DEVICES;
}

/**
 * Get z-index for an edge
 */
export function getEdgeZIndex(selected: boolean = false): number {
  return selected ? Z_INDEX.EDGES_SELECTED : Z_INDEX.EDGES;
}

// =============================================================================
// Legacy Exports (for backwards compatibility during transition)
// =============================================================================

// These are kept temporarily for any code still referencing them
export interface ZIndexConfig {
  preset: string;
  baseZIndex: number;
  layerSpacing: number;
}

export const DEFAULT_ZINDEX_CONFIG: ZIndexConfig = {
  preset: 'default',
  baseZIndex: 1,
  layerSpacing: 100,
};
