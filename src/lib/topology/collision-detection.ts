/**
 * Collision Detection System
 *
 * Identifies overlapping or too-close nodes in topology diagrams
 * and quantifies overlap severity for layout quality assessment.
 */

import { AppNode } from '@/lib/utils/types';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import { SpatialHash, type SpatialHashOptions } from './spatial-hash';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a collision/overlap between two nodes
 */
export interface Overlap {
  /** ID of the first node in the collision */
  nodeA: string;
  /** ID of the second node in the collision */
  nodeB: string;
  /** Severity score from 0 (just touching) to 1 (completely overlapped) */
  severity: number;
  /** Absolute overlap area in pixels squared */
  overlapArea?: number;
}

/**
 * Bounding box representation for a node
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Original node ID */
  nodeId: string;
}

/**
 * Result of collision detection
 */
export interface CollisionDetectionResult {
  /** List of detected overlaps, sorted by severity (highest first) */
  overlaps: Overlap[];
  /** Total number of nodes analyzed */
  totalNodes: number;
  /** Number of collision pairs found */
  collisionCount: number;
  /** Average severity across all collisions (0 if none) */
  averageSeverity: number;
  /** Maximum severity found (0 if no collisions) */
  maxSeverity: number;
}

/**
 * Options for collision detection
 */
export interface CollisionDetectionOptions {
  /** Minimum clearance distance in pixels (default: 100) */
  minClearance?: number;
  /** Use spatial hashing for optimization (auto-enabled for >50 nodes) */
  useSpatialHash?: boolean;
  /** Spatial hash cell size (default: calculated from clearance) */
  cellSize?: number;
  /** Filter to only check device nodes (exclude boundaries) */
  devicesOnly?: boolean;
  /** Filter to only check boundary nodes */
  boundariesOnly?: boolean;
}

// =============================================================================
// Default Constants
// =============================================================================

/** Default minimum clearance between nodes in pixels */
export const DEFAULT_MIN_CLEARANCE = 100;

/** Threshold for automatic spatial hash optimization */
export const SPATIAL_HASH_THRESHOLD = 50;

// =============================================================================
// Bounding Box Functions
// =============================================================================

/**
 * Get the effective dimensions of a node, accounting for different node types.
 * Uses measured dimensions first, then explicit dimensions, then defaults.
 */
export function getNodeDimensions(node: AppNode): { width: number; height: number } {
  // Check for measured dimensions (from React Flow after rendering)
  if (node.measured?.width && node.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }

  // Check for explicit dimensions
  if (node.width && node.height) {
    return { width: node.width, height: node.height };
  }

  // Check style dimensions
  const styleWidth = node.style?.width as number | undefined;
  const styleHeight = node.style?.height as number | undefined;
  if (styleWidth && styleHeight) {
    return { width: styleWidth, height: styleHeight };
  }

  // Use defaults based on node type
  if (node.type === 'boundary') {
    return {
      width: LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH,
      height: LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT,
    };
  }

  return {
    width: LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
    height: LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
  };
}

/**
 * Extract bounding box from a node
 */
export function extractBoundingBox(node: AppNode): BoundingBox {
  const { width, height } = getNodeDimensions(node);

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
    nodeId: node.id,
  };
}

/**
 * Expand a bounding box by a clearance amount on all sides
 */
export function expandBoundingBox(box: BoundingBox, clearance: number): BoundingBox {
  const expansion = clearance / 2;
  return {
    x: box.x - expansion,
    y: box.y - expansion,
    width: box.width + clearance,
    height: box.height + clearance,
    nodeId: box.nodeId,
  };
}

/**
 * Check if two bounding boxes intersect
 */
export function boxesIntersect(boxA: BoundingBox, boxB: BoundingBox): boolean {
  return !(
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  );
}

/**
 * Calculate the intersection area between two bounding boxes
 * Returns 0 if boxes don't intersect
 */
export function calculateIntersectionArea(boxA: BoundingBox, boxB: BoundingBox): number {
  const xOverlap = Math.max(
    0,
    Math.min(boxA.x + boxA.width, boxB.x + boxB.width) - Math.max(boxA.x, boxB.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(boxA.y + boxA.height, boxB.y + boxB.height) - Math.max(boxA.y, boxB.y)
  );

  return xOverlap * yOverlap;
}

/**
 * Calculate overlap severity between two nodes.
 * Severity is: overlapArea / smallerNodeArea
 * Returns value from 0 (just touching) to 1 (completely overlapped)
 */
export function calculateOverlapSeverity(boxA: BoundingBox, boxB: BoundingBox): number {
  const overlapArea = calculateIntersectionArea(boxA, boxB);

  if (overlapArea === 0) {
    return 0;
  }

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const smallerArea = Math.min(areaA, areaB);

  // Clamp to [0, 1] range
  return Math.min(1, overlapArea / smallerArea);
}

// =============================================================================
// Main Detection Functions
// =============================================================================

/**
 * Detect overlapping nodes using naive O(n²) algorithm.
 * Best for small node counts (<50 nodes).
 */
export function detectOverlapsNaive(
  boxes: BoundingBox[],
  expandedBoxes: BoundingBox[]
): Overlap[] {
  const overlaps: Overlap[] = [];

  for (let i = 0; i < expandedBoxes.length; i++) {
    for (let j = i + 1; j < expandedBoxes.length; j++) {
      if (boxesIntersect(expandedBoxes[i], expandedBoxes[j])) {
        // Calculate severity using original (unexpanded) boxes
        const severity = calculateOverlapSeverity(boxes[i], boxes[j]);
        const overlapArea = calculateIntersectionArea(expandedBoxes[i], expandedBoxes[j]);

        overlaps.push({
          nodeA: boxes[i].nodeId,
          nodeB: boxes[j].nodeId,
          severity,
          overlapArea,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Detect overlapping nodes using spatial hashing for optimization.
 * Best for large node counts (>50 nodes).
 */
export function detectOverlapsSpatialHash(
  boxes: BoundingBox[],
  expandedBoxes: BoundingBox[],
  options: SpatialHashOptions
): Overlap[] {
  const spatialHash = new SpatialHash(options);
  const overlaps: Overlap[] = [];
  const checkedPairs = new Set<string>();

  // Insert all expanded boxes into spatial hash
  for (const box of expandedBoxes) {
    spatialHash.insert(box);
  }

  // Query for potential collisions
  for (let i = 0; i < expandedBoxes.length; i++) {
    const candidates = spatialHash.query(expandedBoxes[i]);

    for (const candidate of candidates) {
      // Skip self-collision
      if (candidate.nodeId === expandedBoxes[i].nodeId) continue;

      // Create unique pair key to avoid duplicates
      const pairKey =
        candidate.nodeId < expandedBoxes[i].nodeId
          ? `${candidate.nodeId}:${expandedBoxes[i].nodeId}`
          : `${expandedBoxes[i].nodeId}:${candidate.nodeId}`;

      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Check actual intersection
      if (boxesIntersect(expandedBoxes[i], candidate)) {
        // Find the original boxes for severity calculation
        const boxA = boxes.find((b) => b.nodeId === expandedBoxes[i].nodeId)!;
        const boxB = boxes.find((b) => b.nodeId === candidate.nodeId)!;

        const severity = calculateOverlapSeverity(boxA, boxB);
        const overlapArea = calculateIntersectionArea(expandedBoxes[i], candidate);

        overlaps.push({
          nodeA: boxA.nodeId,
          nodeB: boxB.nodeId,
          severity,
          overlapArea,
        });
      }
    }
  }

  return overlaps;
}

/**
 * Main collision detection function.
 * Detects node-to-node overlaps using bounding box intersection.
 *
 * @param nodes - Array of nodes to check for collisions
 * @param minClearance - Minimum required clearance between nodes in pixels (default: 100)
 * @returns Array of Overlap objects sorted by severity (highest first)
 *
 * @example
 * ```ts
 * const overlaps = detectNodeOverlaps(nodes, 100);
 * overlaps.forEach(o => {
 *   console.log(`${o.nodeA} overlaps ${o.nodeB} with severity ${o.severity}`);
 * });
 * ```
 */
export function detectNodeOverlaps(
  nodes: AppNode[],
  minClearance: number = DEFAULT_MIN_CLEARANCE
): Overlap[] {
  if (nodes.length < 2) {
    return [];
  }

  // Extract bounding boxes
  const boxes = nodes.map(extractBoundingBox);

  // Expand boxes by clearance
  const expandedBoxes = boxes.map((box) => expandBoundingBox(box, minClearance));

  // Use naive algorithm for small node counts
  const overlaps = detectOverlapsNaive(boxes, expandedBoxes);

  // Sort by severity (highest first)
  return overlaps.sort((a, b) => b.severity - a.severity);
}

/**
 * Advanced collision detection with full options support.
 * Provides comprehensive collision analysis including metrics.
 *
 * @param nodes - Array of nodes to check for collisions
 * @param options - Detection options
 * @returns CollisionDetectionResult with overlaps and metrics
 *
 * @example
 * ```ts
 * const result = detectCollisions(nodes, {
 *   minClearance: 50,
 *   devicesOnly: true,
 * });
 * console.log(`Found ${result.collisionCount} collisions`);
 * console.log(`Max severity: ${result.maxSeverity}`);
 * ```
 */
export function detectCollisions(
  nodes: AppNode[],
  options: CollisionDetectionOptions = {}
): CollisionDetectionResult {
  const {
    minClearance = DEFAULT_MIN_CLEARANCE,
    useSpatialHash,
    cellSize,
    devicesOnly = false,
    boundariesOnly = false,
  } = options;

  // Filter nodes based on options
  let filteredNodes = nodes;
  if (devicesOnly) {
    filteredNodes = nodes.filter((n) => n.type === 'device');
  } else if (boundariesOnly) {
    filteredNodes = nodes.filter((n) => n.type === 'boundary');
  }

  if (filteredNodes.length < 2) {
    return {
      overlaps: [],
      totalNodes: filteredNodes.length,
      collisionCount: 0,
      averageSeverity: 0,
      maxSeverity: 0,
    };
  }

  // Extract bounding boxes
  const boxes = filteredNodes.map(extractBoundingBox);
  const expandedBoxes = boxes.map((box) => expandBoundingBox(box, minClearance));

  // Determine algorithm based on node count or explicit option
  const shouldUseSpatialHash =
    useSpatialHash ?? filteredNodes.length > SPATIAL_HASH_THRESHOLD;

  let overlaps: Overlap[];

  if (shouldUseSpatialHash) {
    // Calculate cell size: should be larger than most bounding boxes + clearance
    const avgWidth = boxes.reduce((sum, b) => sum + b.width, 0) / boxes.length;
    const avgHeight = boxes.reduce((sum, b) => sum + b.height, 0) / boxes.length;
    const calculatedCellSize = cellSize ?? Math.max(avgWidth, avgHeight) + minClearance;

    overlaps = detectOverlapsSpatialHash(boxes, expandedBoxes, {
      cellSize: calculatedCellSize,
    });
  } else {
    overlaps = detectOverlapsNaive(boxes, expandedBoxes);
  }

  // Sort by severity (highest first)
  overlaps.sort((a, b) => b.severity - a.severity);

  // Calculate metrics
  const collisionCount = overlaps.length;
  const totalSeverity = overlaps.reduce((sum, o) => sum + o.severity, 0);
  const averageSeverity = collisionCount > 0 ? totalSeverity / collisionCount : 0;
  const maxSeverity = collisionCount > 0 ? overlaps[0].severity : 0;

  return {
    overlaps,
    totalNodes: filteredNodes.length,
    collisionCount,
    averageSeverity,
    maxSeverity,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all node IDs involved in collisions
 */
export function getCollidingNodeIds(overlaps: Overlap[]): Set<string> {
  const ids = new Set<string>();
  for (const overlap of overlaps) {
    ids.add(overlap.nodeA);
    ids.add(overlap.nodeB);
  }
  return ids;
}

/**
 * Filter overlaps to only include those with severity above threshold
 */
export function filterByMinSeverity(overlaps: Overlap[], minSeverity: number): Overlap[] {
  return overlaps.filter((o) => o.severity >= minSeverity);
}

/**
 * Get overlaps for a specific node
 */
export function getOverlapsForNode(overlaps: Overlap[], nodeId: string): Overlap[] {
  return overlaps.filter((o) => o.nodeA === nodeId || o.nodeB === nodeId);
}

/**
 * Check if layout is collision-free
 */
export function isLayoutCollisionFree(
  nodes: AppNode[],
  minClearance: number = DEFAULT_MIN_CLEARANCE
): boolean {
  const overlaps = detectNodeOverlaps(nodes, minClearance);
  return overlaps.length === 0;
}

/**
 * Calculate layout quality score based on collisions.
 * Returns 1.0 for collision-free layouts, lower scores for more/severe collisions.
 */
export function calculateLayoutQuality(
  nodes: AppNode[],
  minClearance: number = DEFAULT_MIN_CLEARANCE
): number {
  if (nodes.length < 2) {
    return 1.0;
  }

  const result = detectCollisions(nodes, { minClearance });

  if (result.collisionCount === 0) {
    return 1.0;
  }

  // Quality degrades based on:
  // 1. Number of collisions relative to possible pairs
  // 2. Average severity of collisions
  const maxPairs = (nodes.length * (nodes.length - 1)) / 2;
  const collisionRatio = result.collisionCount / maxPairs;

  // Combined penalty: collision ratio and severity
  const quality = 1 - collisionRatio * (0.5 + 0.5 * result.averageSeverity);

  return Math.max(0, quality);
}
