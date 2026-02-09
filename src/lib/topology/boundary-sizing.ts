/**
 * Intelligent Boundary Node Sizing
 *
 * Calculates optimal dimensions for boundary nodes based on their contained children,
 * layout direction, and configurable padding.
 */

import { Node } from '@xyflow/react';
import { LAYOUT_CONSTANTS } from '../layout/layoutConfig';

// Layout direction types matching the codebase conventions
export type LayoutDirectionSizing = 'TB' | 'BT' | 'LR' | 'RL';

// Aspect ratio preferences based on layout direction
export const ASPECT_RATIO_PREFERENCES = {
  // Top-to-bottom/Bottom-to-top: prefer taller rectangles
  TB: { min: 0.6, max: 0.9 },
  BT: { min: 0.6, max: 0.9 },
  // Left-to-right/Right-to-left: prefer wider rectangles
  LR: { min: 1.2, max: 1.8 },
  RL: { min: 1.2, max: 1.8 },
} as const;

// Default sizing constants
export const BOUNDARY_SIZING_DEFAULTS = {
  DEFAULT_PADDING: 40,
  MIN_WIDTH: LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH, // 300
  MIN_HEIGHT: LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT, // 200
} as const;

/**
 * Result of calculating optimal boundary size
 */
export interface OptimalSizeResult {
  /** Calculated optimal width in pixels */
  width: number;
  /** Calculated optimal height in pixels */
  height: number;
  /** Width/height ratio for layout quality metrics */
  aspectRatio: number;
  /** Bounding box of children (before padding) */
  childrenBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    contentWidth: number;
    contentHeight: number;
  };
  /** Whether minimum dimensions were applied */
  usedMinimumDimensions: boolean;
}

/**
 * Options for calculating optimal boundary size
 */
export interface CalculateOptimalSizeOptions {
  /** Padding around children in pixels (default: 40) */
  padding?: number;
  /** Minimum width in pixels (default: 300) */
  minWidth?: number;
  /** Minimum height in pixels (default: 200) */
  minHeight?: number;
  /** Adjust aspect ratio to match layout direction preference */
  adjustAspectRatio?: boolean;
}

/**
 * Gets node dimensions, preferring measured dimensions over stored values
 */
function getNodeDimensions(node: Node): { width: number; height: number } {
  const width =
    node.measured?.width ||
    node.width ||
    (node.style?.width as number) ||
    LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
  const height =
    node.measured?.height ||
    node.height ||
    (node.style?.height as number) ||
    LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
  return { width, height };
}

/**
 * Calculates the bounding box of all child nodes
 */
export function calculateChildrenBounds(
  children: Node[]
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  contentWidth: number;
  contentHeight: number;
} | null {
  if (children.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const { width, height } = getNodeDimensions(child);
    const x = child.position.x;
    const y = child.position.y;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    contentWidth: maxX - minX,
    contentHeight: maxY - minY,
  };
}

/**
 * Adjusts dimensions to match preferred aspect ratio for the layout direction
 */
function adjustForAspectRatioPreference(
  width: number,
  height: number,
  layoutDirection: LayoutDirectionSizing,
  minWidth: number,
  minHeight: number
): { width: number; height: number } {
  const preference = ASPECT_RATIO_PREFERENCES[layoutDirection];
  const currentRatio = width / height;

  // If current ratio is outside preferred range, adjust
  if (currentRatio < preference.min) {
    // Too tall, increase width
    const targetRatio = (preference.min + preference.max) / 2;
    const newWidth = Math.max(minWidth, height * targetRatio);
    return { width: Math.round(newWidth), height };
  } else if (currentRatio > preference.max) {
    // Too wide, increase height
    const targetRatio = (preference.min + preference.max) / 2;
    const newHeight = Math.max(minHeight, width / targetRatio);
    return { width, height: Math.round(newHeight) };
  }

  return { width, height };
}

/**
 * Calculates optimal boundary dimensions to contain child nodes with appropriate padding.
 *
 * Algorithm:
 * 1. Find bounding box of all child nodes (minX, minY, maxX, maxY)
 * 2. Calculate content dimensions: contentWidth = maxX - minX, contentHeight = maxY - minY
 * 3. Add padding on all sides: width = contentWidth + 2 * padding, height = contentHeight + 2 * padding
 * 4. Apply minimum dimensions: min width 300px, min height 200px
 * 5. Optionally adjust aspect ratio based on layout direction:
 *    - TB/BT: prefer taller rectangles (width * 0.6 - 0.9)
 *    - LR/RL: prefer wider rectangles (width * 1.2 - 1.8)
 * 6. Calculate aspectRatio = width / height
 *
 * @param boundary - The boundary node (unused in calculation, but included for context)
 * @param children - Array of child nodes contained within the boundary
 * @param layoutDirection - Layout direction ('TB', 'BT', 'LR', 'RL')
 * @param options - Additional sizing options
 * @returns Object containing width, height, and aspectRatio
 *
 * @example
 * ```typescript
 * const result = calculateOptimalSize(
 *   boundaryNode,
 *   childNodes,
 *   'TB',
 *   { padding: 40 }
 * );
 * console.log(result.width, result.height, result.aspectRatio);
 * ```
 */
export function calculateOptimalSize(
  _boundary: Node,
  children: Node[],
  layoutDirection: LayoutDirectionSizing,
  options: CalculateOptimalSizeOptions = {}
): OptimalSizeResult {
  const {
    padding = BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING,
    minWidth = BOUNDARY_SIZING_DEFAULTS.MIN_WIDTH,
    minHeight = BOUNDARY_SIZING_DEFAULTS.MIN_HEIGHT,
    adjustAspectRatio = false,
  } = options;

  // Handle empty boundaries - use default minimum size
  if (children.length === 0) {
    return {
      width: minWidth,
      height: minHeight,
      aspectRatio: minWidth / minHeight,
      childrenBounds: {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        contentWidth: 0,
        contentHeight: 0,
      },
      usedMinimumDimensions: true,
    };
  }

  // Step 1 & 2: Calculate bounding box and content dimensions
  const bounds = calculateChildrenBounds(children);
  if (!bounds) {
    // This shouldn't happen if children.length > 0, but handle it gracefully
    return {
      width: minWidth,
      height: minHeight,
      aspectRatio: minWidth / minHeight,
      childrenBounds: {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        contentWidth: 0,
        contentHeight: 0,
      },
      usedMinimumDimensions: true,
    };
  }

  // Step 3: Add padding on all sides
  let width = bounds.contentWidth + 2 * padding;
  let height = bounds.contentHeight + 2 * padding;

  // Step 4: Apply minimum dimensions
  let usedMinimumDimensions = false;
  if (width < minWidth) {
    width = minWidth;
    usedMinimumDimensions = true;
  }
  if (height < minHeight) {
    height = minHeight;
    usedMinimumDimensions = true;
  }

  // Step 5: Optionally adjust aspect ratio based on layout direction
  if (adjustAspectRatio) {
    const adjusted = adjustForAspectRatioPreference(
      width,
      height,
      layoutDirection,
      minWidth,
      minHeight
    );
    width = adjusted.width;
    height = adjusted.height;
  }

  // Step 6: Calculate aspect ratio
  const aspectRatio = width / height;

  return {
    width: Math.round(width),
    height: Math.round(height),
    aspectRatio: Math.round(aspectRatio * 1000) / 1000, // Round to 3 decimal places
    childrenBounds: bounds,
    usedMinimumDimensions,
  };
}

/**
 * Convenience function with simplified signature matching the spec
 *
 * @param boundary - The boundary node
 * @param children - Array of child nodes
 * @param layoutDirection - Layout direction ('TB', 'BT', 'LR', 'RL')
 * @param padding - Padding around children (default: 40)
 * @returns Object containing width, height, and aspectRatio
 */
export function calculateOptimalBoundarySize(
  boundary: Node,
  children: Node[],
  layoutDirection: LayoutDirectionSizing,
  padding: number = BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING
): { width: number; height: number; aspectRatio: number } {
  const result = calculateOptimalSize(boundary, children, layoutDirection, { padding });
  return {
    width: result.width,
    height: result.height,
    aspectRatio: result.aspectRatio,
  };
}

/**
 * Converts DeviceAlignment to LayoutDirectionSizing
 */
export function deviceAlignmentToLayoutDirection(
  deviceAlignment: string
): LayoutDirectionSizing {
  switch (deviceAlignment) {
    case 'dagre-tb':
      return 'TB';
    case 'dagre-bt':
      return 'BT';
    case 'dagre-lr':
      return 'LR';
    case 'dagre-rl':
      return 'RL';
    default:
      return 'TB'; // Default to top-bottom
  }
}

/**
 * Converts LayoutDirection (from types) to LayoutDirectionSizing
 */
export function layoutDirectionToSizing(
  direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'
): LayoutDirectionSizing {
  switch (direction) {
    case 'DOWN':
      return 'TB';
    case 'UP':
      return 'BT';
    case 'RIGHT':
      return 'LR';
    case 'LEFT':
      return 'RL';
    default:
      return 'TB';
  }
}

/**
 * Calculates optimal position offset for children within a resized boundary
 * to maintain centering with the new padding
 */
export function calculateChildrenOffset(
  currentBounds: { minX: number; minY: number },
  padding: number
): { offsetX: number; offsetY: number } {
  // Children should be positioned with padding from the boundary edge
  // This calculates how much to offset existing children
  return {
    offsetX: padding - currentBounds.minX,
    offsetY: padding - currentBounds.minY,
  };
}

/**
 * Determines if a boundary should be auto-resized based on its configuration
 */
export function shouldAutoResize(boundaryData: { autoResize?: boolean }): boolean {
  return boundaryData.autoResize === true;
}

/**
 * Validates that the calculated size meets quality thresholds
 */
export function validateSizeQuality(
  result: OptimalSizeResult,
  layoutDirection: LayoutDirectionSizing
): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const preference = ASPECT_RATIO_PREFERENCES[layoutDirection];

  // Check if aspect ratio is within reasonable bounds (not too extreme)
  if (result.aspectRatio < 0.25) {
    issues.push('Boundary is extremely tall and narrow');
  } else if (result.aspectRatio > 4) {
    issues.push('Boundary is extremely wide and short');
  }

  // Check if aspect ratio matches direction preference
  if (result.aspectRatio < preference.min || result.aspectRatio > preference.max) {
    issues.push(
      `Aspect ratio ${result.aspectRatio.toFixed(2)} is outside preferred range [${preference.min}, ${preference.max}] for ${layoutDirection} layout`
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
