/**
 * Layout Dimensions System
 *
 * Single source of truth for all node dimension data.
 * Ensures synchronization across measurement, layout, and rendering.
 *
 * @module layout-dimensions
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Source of dimension data
 */
export type DimensionSource = 'reactflow-measured' | 'dom-measured' | 'calculated' | 'default';

/**
 * Modifiers applied to dimensions
 */
export interface DimensionModifiers {
  /** Device image size percentage (20-100%) */
  deviceImageSize?: number;
  /** Reserved space for labels (in pixels) */
  labelHeight?: number;
  /** Extra spacing buffer for layout (in pixels) */
  paddingAdjustment?: number;
  /** Scale factor applied (calculated from deviceImageSize) */
  scaleFactor?: number;
}

/**
 * Complete dimension data for layout algorithms
 * Single source of truth for all sizing
 */
export interface LayoutDimensions {
  /** Core node dimensions (the main box, no labels) */
  core: {
    width: number;
    height: number;
  };

  /** Visual dimensions (including all visual elements like labels) */
  visual: {
    width: number;
    height: number;
  };

  /** Layout dimensions (what the layout algorithm should use for spacing calculations) */
  layout: {
    width: number;
    height: number;
  };

  /** Source of this dimension data */
  source: DimensionSource;

  /** When this dimension was calculated */
  timestamp: number;

  /** Modifiers applied to calculate these dimensions */
  modifiers: DimensionModifiers;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create layout dimensions with defaults
 */
export function createLayoutDimensions(
  partial: {
    core: { width: number; height: number };
    visual?: { width: number; height: number };
    layout?: { width: number; height: number };
    modifiers?: DimensionModifiers;
  },
  source: DimensionSource = 'calculated'
): LayoutDimensions {
  const core = partial.core;
  const visual = partial.visual || { ...core };
  const layout = partial.layout || { ...visual };

  return {
    core,
    visual,
    layout,
    source,
    timestamp: Date.now(),
    modifiers: partial.modifiers || {},
  };
}

/**
 * Create default dimensions for a node type
 */
export function createDefaultDimensions(
  nodeType: 'device' | 'boundary',
  constants: {
    DEVICE_DEFAULT_WIDTH: number;
    DEVICE_DEFAULT_HEIGHT: number;
    BOUNDARY_DEFAULT_WIDTH: number;
    BOUNDARY_DEFAULT_HEIGHT: number;
  }
): LayoutDimensions {
  const core = nodeType === 'device'
    ? { width: constants.DEVICE_DEFAULT_WIDTH, height: constants.DEVICE_DEFAULT_HEIGHT }
    : { width: constants.BOUNDARY_DEFAULT_WIDTH, height: constants.BOUNDARY_DEFAULT_HEIGHT };

  return createLayoutDimensions({ core }, 'default');
}

// =============================================================================
// Validation & Utilities
// =============================================================================

/**
 * Check if dimensions are stale (older than max age)
 */
export function isDimensionsStale(
  dimensions: LayoutDimensions,
  maxAgeMs: number = 5000
): boolean {
  const age = Date.now() - dimensions.timestamp;
  return age > maxAgeMs;
}

/**
 * Validate dimensions are positive and reasonable
 */
export function validateDimensions(dimensions: LayoutDimensions): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check core dimensions
  if (dimensions.core.width <= 0) {
    errors.push('Core width must be positive');
  }
  if (dimensions.core.height <= 0) {
    errors.push('Core height must be positive');
  }

  // Check visual dimensions
  if (dimensions.visual.width < dimensions.core.width) {
    errors.push('Visual width cannot be less than core width');
  }
  if (dimensions.visual.height < dimensions.core.height) {
    errors.push('Visual height cannot be less than core height');
  }

  // Check layout dimensions
  if (dimensions.layout.width < dimensions.visual.width) {
    errors.push('Layout width cannot be less than visual width');
  }
  if (dimensions.layout.height < dimensions.visual.height) {
    errors.push('Layout height cannot be less than visual height');
  }

  // Check reasonable bounds (prevent huge dimensions)
  const MAX_DIMENSION = 10000;
  if (dimensions.layout.width > MAX_DIMENSION || dimensions.layout.height > MAX_DIMENSION) {
    errors.push(`Dimensions exceed maximum (${MAX_DIMENSION}px)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge dimension updates (useful for partial updates)
 */
export function mergeDimensions(
  base: LayoutDimensions,
  updates: Partial<LayoutDimensions>
): LayoutDimensions {
  return {
    core: updates.core || base.core,
    visual: updates.visual || base.visual,
    layout: updates.layout || base.layout,
    source: updates.source || base.source,
    timestamp: updates.timestamp || Date.now(),
    modifiers: { ...base.modifiers, ...updates.modifiers },
  };
}

/**
 * Clone dimensions (deep copy)
 */
export function cloneDimensions(dimensions: LayoutDimensions): LayoutDimensions {
  return {
    core: { ...dimensions.core },
    visual: { ...dimensions.visual },
    layout: { ...dimensions.layout },
    source: dimensions.source,
    timestamp: dimensions.timestamp,
    modifiers: { ...dimensions.modifiers },
  };
}

// =============================================================================
// Comparison Utilities
// =============================================================================

/**
 * Compare two dimensions for equality
 */
export function dimensionsEqual(
  a: LayoutDimensions,
  b: LayoutDimensions,
  tolerance: number = 0.1
): boolean {
  const withinTolerance = (x: number, y: number) => Math.abs(x - y) <= tolerance;

  return (
    withinTolerance(a.core.width, b.core.width) &&
    withinTolerance(a.core.height, b.core.height) &&
    withinTolerance(a.visual.width, b.visual.width) &&
    withinTolerance(a.visual.height, b.visual.height) &&
    withinTolerance(a.layout.width, b.layout.width) &&
    withinTolerance(a.layout.height, b.layout.height)
  );
}

/**
 * Calculate difference between dimensions
 */
export function dimensionsDiff(
  a: LayoutDimensions,
  b: LayoutDimensions
): {
  core: { width: number; height: number };
  visual: { width: number; height: number };
  layout: { width: number; height: number };
} {
  return {
    core: {
      width: b.core.width - a.core.width,
      height: b.core.height - a.core.height,
    },
    visual: {
      width: b.visual.width - a.visual.width,
      height: b.visual.height - a.visual.height,
    },
    layout: {
      width: b.layout.width - a.layout.width,
      height: b.layout.height - a.layout.height,
    },
  };
}

// =============================================================================
// Debug Utilities
// =============================================================================

/**
 * Format dimensions for logging
 */
export function formatDimensions(dimensions: LayoutDimensions): string {
  return [
    `Core: ${dimensions.core.width}×${dimensions.core.height}`,
    `Visual: ${dimensions.visual.width}×${dimensions.visual.height}`,
    `Layout: ${dimensions.layout.width}×${dimensions.layout.height}`,
    `Source: ${dimensions.source}`,
    `Age: ${Date.now() - dimensions.timestamp}ms`,
    dimensions.modifiers.deviceImageSize ? `ImageSize: ${dimensions.modifiers.deviceImageSize}%` : '',
    dimensions.modifiers.labelHeight ? `LabelHeight: ${dimensions.modifiers.labelHeight}px` : '',
  ].filter(Boolean).join(', ');
}

/**
 * Export for debugging
 */
export function exportDimensionsMap(
  dimensionsMap: Map<string, LayoutDimensions>
): Record<string, any> {
  const result: Record<string, any> = {};

  dimensionsMap.forEach((dims, nodeId) => {
    result[nodeId] = {
      core: dims.core,
      visual: dims.visual,
      layout: dims.layout,
      source: dims.source,
      age: Date.now() - dims.timestamp,
      modifiers: dims.modifiers,
    };
  });

  return result;
}

export default {
  createLayoutDimensions,
  createDefaultDimensions,
  isDimensionsStale,
  validateDimensions,
  mergeDimensions,
  cloneDimensions,
  dimensionsEqual,
  dimensionsDiff,
  formatDimensions,
  exportDimensionsMap,
};
