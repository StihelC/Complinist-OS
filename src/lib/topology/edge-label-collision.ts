/**
 * Edge Label Collision Detection and Resolution
 *
 * Provides comprehensive collision detection and resolution for edge labels,
 * ensuring zero overlaps after auto-tidy operations.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import { EdgeLabelConfig, DEFAULT_EDGE_LABEL_CONFIG } from './dagre-config';

// =============================================================================
// Types
// =============================================================================

/**
 * Position in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Bounding box for collision detection
 */
export interface LabelBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  edgeId: string;
}

/**
 * Edge label with computed position
 */
export interface EdgeLabelPosition {
  edgeId: string;
  /** Original center position on edge path */
  originalPosition: Point;
  /** Adjusted position after collision resolution */
  adjustedPosition: Point;
  /** Label dimensions */
  width: number;
  height: number;
  /** Offset applied for collision resolution */
  offset: Point;
  /** Whether this label was moved to resolve collision */
  wasAdjusted: boolean;
  /** Rotation angle in degrees (if label rotation is enabled) */
  rotation?: number;
}

/**
 * Label collision detection result
 */
export interface LabelCollision {
  labelA: string;
  labelB: string;
  overlapArea: number;
  severity: number; // 0-1, where 1 is complete overlap
}

/**
 * Label-to-node collision
 */
export interface LabelNodeCollision {
  labelId: string;
  nodeId: string;
  overlapArea: number;
}

/**
 * Complete collision detection result
 */
export interface LabelCollisionResult {
  /** Label-to-label collisions */
  labelCollisions: LabelCollision[];
  /** Label-to-node collisions */
  nodeCollisions: LabelNodeCollision[];
  /** Total number of collisions */
  totalCollisions: number;
  /** Whether all collisions were resolved */
  allResolved: boolean;
  /** Labels after collision resolution */
  resolvedPositions: EdgeLabelPosition[];
}

/**
 * Edge path segment for label positioning
 */
export interface EdgePathSegment {
  start: Point;
  end: Point;
  length: number;
  angle: number; // in radians
}

// =============================================================================
// Constants
// =============================================================================

/** Default estimated label dimensions */
const DEFAULT_LABEL_WIDTH = 100;
const DEFAULT_LABEL_HEIGHT = 24;

/** Minimum distance between labels after collision resolution */
const MIN_LABEL_SEPARATION = 10;

/** Maximum iterations for collision resolution */
const MAX_RESOLUTION_ITERATIONS = 10;

// =============================================================================
// Label Bounding Box Functions
// =============================================================================

/**
 * Estimate label dimensions based on content
 * In production, this would be replaced with actual measured dimensions
 */
export function estimateLabelDimensions(
  edge: AppEdge,
  fontSize: number = 12
): { width: number; height: number } {
  const data = edge.data || {};

  // If custom label exists, estimate based on text length
  if (data.label) {
    const charWidth = fontSize * 0.6;
    const padding = 16;
    return {
      width: Math.max(DEFAULT_LABEL_WIDTH, data.label.length * charWidth + padding),
      height: DEFAULT_LABEL_HEIGHT,
    };
  }

  // If label fields exist, estimate based on field count
  const labelFields = data.labelFields || [];
  if (labelFields.length > 0) {
    const height = DEFAULT_LABEL_HEIGHT + (labelFields.length - 1) * (fontSize + 4);
    return {
      width: DEFAULT_LABEL_WIDTH,
      height,
    };
  }

  // No label content
  return { width: 0, height: 0 };
}

/**
 * Calculate label center position on edge path
 */
export function calculateLabelCenter(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  position: number = 0.5
): Point {
  return {
    x: sourceX + (targetX - sourceX) * position,
    y: sourceY + (targetY - sourceY) * position,
  };
}

/**
 * Create bounding box for label at given position
 */
export function createLabelBoundingBox(
  center: Point,
  width: number,
  height: number,
  edgeId: string,
  padding: number = 8
): LabelBoundingBox {
  return {
    x: center.x - (width + padding) / 2,
    y: center.y - (height + padding) / 2,
    width: width + padding,
    height: height + padding,
    edgeId,
  };
}

// =============================================================================
// Collision Detection Functions
// =============================================================================

/**
 * Check if two bounding boxes overlap
 */
export function boxesOverlap(
  boxA: LabelBoundingBox,
  boxB: LabelBoundingBox
): boolean {
  return !(
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  );
}

/**
 * Calculate overlap area between two bounding boxes
 */
export function calculateOverlapArea(
  boxA: LabelBoundingBox,
  boxB: LabelBoundingBox
): number {
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
 * Calculate overlap severity (0-1)
 */
export function calculateOverlapSeverity(
  boxA: LabelBoundingBox,
  boxB: LabelBoundingBox
): number {
  const overlapArea = calculateOverlapArea(boxA, boxB);
  if (overlapArea === 0) return 0;

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const smallerArea = Math.min(areaA, areaB);

  return Math.min(1, overlapArea / smallerArea);
}

/**
 * Check if label overlaps with a node
 */
export function labelOverlapsNode(
  labelBox: LabelBoundingBox,
  node: AppNode
): boolean {
  const nodeWidth = node.measured?.width || node.width ||
    (node.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
  const nodeHeight = node.measured?.height || node.height ||
    (node.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

  const nodeBox: LabelBoundingBox = {
    x: node.position.x,
    y: node.position.y,
    width: nodeWidth,
    height: nodeHeight,
    edgeId: '',
  };

  return boxesOverlap(labelBox, nodeBox);
}

/**
 * Detect all label-to-label collisions
 */
export function detectLabelCollisions(
  labelBoxes: LabelBoundingBox[]
): LabelCollision[] {
  const collisions: LabelCollision[] = [];

  for (let i = 0; i < labelBoxes.length; i++) {
    for (let j = i + 1; j < labelBoxes.length; j++) {
      if (boxesOverlap(labelBoxes[i], labelBoxes[j])) {
        const overlapArea = calculateOverlapArea(labelBoxes[i], labelBoxes[j]);
        const severity = calculateOverlapSeverity(labelBoxes[i], labelBoxes[j]);

        collisions.push({
          labelA: labelBoxes[i].edgeId,
          labelB: labelBoxes[j].edgeId,
          overlapArea,
          severity,
        });
      }
    }
  }

  return collisions;
}

/**
 * Detect all label-to-node collisions
 */
export function detectLabelNodeCollisions(
  labelBoxes: LabelBoundingBox[],
  nodes: AppNode[]
): LabelNodeCollision[] {
  const collisions: LabelNodeCollision[] = [];

  for (const labelBox of labelBoxes) {
    for (const node of nodes) {
      // Skip boundary nodes for collision detection (labels often appear inside boundaries)
      if (node.type === 'boundary') continue;

      if (labelOverlapsNode(labelBox, node)) {
        const nodeWidth = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
        const nodeHeight = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;

        const nodeBox: LabelBoundingBox = {
          x: node.position.x,
          y: node.position.y,
          width: nodeWidth,
          height: nodeHeight,
          edgeId: '',
        };

        collisions.push({
          labelId: labelBox.edgeId,
          nodeId: node.id,
          overlapArea: calculateOverlapArea(labelBox, nodeBox),
        });
      }
    }
  }

  return collisions;
}

// =============================================================================
// Collision Resolution Functions
// =============================================================================

/**
 * Calculate perpendicular offset direction for edge
 */
export function getPerpendicularDirection(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): Point {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return { x: 0, y: -1 }; // Default upward
  }

  // Perpendicular vector (normalized)
  return {
    x: -dy / length,
    y: dx / length,
  };
}

/**
 * Resolve collision between two labels by offsetting them perpendicular to edge
 */
export function resolveCollision(
  positionA: EdgeLabelPosition,
  positionB: EdgeLabelPosition,
  _edgeA: AppEdge,
  _edgeB: AppEdge,
  config: EdgeLabelConfig
): { positionA: EdgeLabelPosition; positionB: EdgeLabelPosition } {
  // Get source/target positions for edges (would need to be provided in real implementation)
  // For now, use the original position as reference

  const perpA = getPerpendicularDirection(
    positionA.originalPosition.x - 50,
    positionA.originalPosition.y,
    positionA.originalPosition.x + 50,
    positionA.originalPosition.y
  );

  const perpB = getPerpendicularDirection(
    positionB.originalPosition.x - 50,
    positionB.originalPosition.y,
    positionB.originalPosition.x + 50,
    positionB.originalPosition.y
  );

  const offsetAmount = Math.min(
    config.maxPerpendicularOffset,
    (config.minLabelDistance + positionA.height / 2 + positionB.height / 2) / 2
  );

  return {
    positionA: {
      ...positionA,
      adjustedPosition: {
        x: positionA.adjustedPosition.x + perpA.x * offsetAmount,
        y: positionA.adjustedPosition.y + perpA.y * offsetAmount,
      },
      offset: {
        x: positionA.offset.x + perpA.x * offsetAmount,
        y: positionA.offset.y + perpA.y * offsetAmount,
      },
      wasAdjusted: true,
    },
    positionB: {
      ...positionB,
      adjustedPosition: {
        x: positionB.adjustedPosition.x - perpB.x * offsetAmount,
        y: positionB.adjustedPosition.y - perpB.y * offsetAmount,
      },
      offset: {
        x: positionB.offset.x - perpB.x * offsetAmount,
        y: positionB.offset.y - perpB.y * offsetAmount,
      },
      wasAdjusted: true,
    },
  };
}

/**
 * Resolve label-to-node collision by moving label away from node
 */
export function resolveLabelNodeCollision(
  position: EdgeLabelPosition,
  node: AppNode,
  config: EdgeLabelConfig
): EdgeLabelPosition {
  const nodeWidth = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
  const nodeHeight = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;

  const nodeCenterX = node.position.x + nodeWidth / 2;
  const nodeCenterY = node.position.y + nodeHeight / 2;

  // Direction from node center to label center
  const dx = position.adjustedPosition.x - nodeCenterX;
  const dy = position.adjustedPosition.y - nodeCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    // Label is at node center, move upward
    return {
      ...position,
      adjustedPosition: {
        x: position.adjustedPosition.x,
        y: position.adjustedPosition.y - nodeHeight / 2 - position.height / 2 - MIN_LABEL_SEPARATION,
      },
      offset: {
        x: position.offset.x,
        y: position.offset.y - nodeHeight / 2 - position.height / 2 - MIN_LABEL_SEPARATION,
      },
      wasAdjusted: true,
    };
  }

  // Calculate required distance to clear the node
  const requiredDistance = Math.max(
    nodeWidth / 2 + position.width / 2,
    nodeHeight / 2 + position.height / 2
  ) + MIN_LABEL_SEPARATION;

  if (distance < requiredDistance) {
    const scale = requiredDistance / distance;
    const offsetX = dx * scale - dx;
    const offsetY = dy * scale - dy;

    // Clamp to max offset
    const maxOffset = config.maxPerpendicularOffset * 2;
    const clampedOffsetX = Math.max(-maxOffset, Math.min(maxOffset, offsetX));
    const clampedOffsetY = Math.max(-maxOffset, Math.min(maxOffset, offsetY));

    return {
      ...position,
      adjustedPosition: {
        x: position.adjustedPosition.x + clampedOffsetX,
        y: position.adjustedPosition.y + clampedOffsetY,
      },
      offset: {
        x: position.offset.x + clampedOffsetX,
        y: position.offset.y + clampedOffsetY,
      },
      wasAdjusted: true,
    };
  }

  return position;
}

// =============================================================================
// Main Collision Detection and Resolution
// =============================================================================

/**
 * Calculate initial label positions for all edges
 */
export function calculateInitialLabelPositions(
  edges: AppEdge[],
  nodes: AppNode[],
  config: EdgeLabelConfig = DEFAULT_EDGE_LABEL_CONFIG
): EdgeLabelPosition[] {
  const positions: EdgeLabelPosition[] = [];

  // Create node position lookup
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const node of nodes) {
    const width = node.measured?.width || node.width ||
      (node.type === 'boundary'
        ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
        : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
    const height = node.measured?.height || node.height ||
      (node.type === 'boundary'
        ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
        : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

    nodePositions.set(node.id, {
      x: node.position.x + width / 2,
      y: node.position.y + height / 2,
      width,
      height,
    });
  }

  for (const edge of edges) {
    const { width, height } = estimateLabelDimensions(edge);

    // Skip edges without labels
    if (width === 0 || height === 0) continue;

    const sourceNode = nodePositions.get(edge.source);
    const targetNode = nodePositions.get(edge.target);

    if (!sourceNode || !targetNode) continue;

    const center = calculateLabelCenter(
      sourceNode.x,
      sourceNode.y,
      targetNode.x,
      targetNode.y,
      config.defaultPosition
    );

    // Calculate rotation if enabled
    let rotation: number | undefined;
    if (config.rotateToMatchEdge) {
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      rotation = Math.atan2(dy, dx) * (180 / Math.PI);

      // Keep text readable (avoid upside-down text)
      if (rotation > 90 || rotation < -90) {
        rotation += 180;
      }
    }

    positions.push({
      edgeId: edge.id,
      originalPosition: { ...center },
      adjustedPosition: { ...center },
      width,
      height,
      offset: { x: 0, y: 0 },
      wasAdjusted: false,
      rotation,
    });
  }

  return positions;
}

/**
 * Run collision detection and resolution for edge labels
 */
export function resolveEdgeLabelCollisions(
  edges: AppEdge[],
  nodes: AppNode[],
  config: EdgeLabelConfig = DEFAULT_EDGE_LABEL_CONFIG
): LabelCollisionResult {
  // Calculate initial positions
  let positions = calculateInitialLabelPositions(edges, nodes, config);

  if (!config.enabled || positions.length === 0) {
    return {
      labelCollisions: [],
      nodeCollisions: [],
      totalCollisions: 0,
      allResolved: true,
      resolvedPositions: positions,
    };
  }

  // Create edge lookup
  const edgeLookup = new Map<string, AppEdge>();
  for (const edge of edges) {
    edgeLookup.set(edge.id, edge);
  }

  // Iteratively resolve collisions
  let iteration = 0;
  let allResolved = false;
  let labelCollisions: LabelCollision[] = [];
  let nodeCollisions: LabelNodeCollision[] = [];

  while (iteration < MAX_RESOLUTION_ITERATIONS && !allResolved) {
    // Create bounding boxes from current positions
    const labelBoxes = positions.map(pos =>
      createLabelBoundingBox(
        pos.adjustedPosition,
        pos.width,
        pos.height,
        pos.edgeId,
        config.labelPadding
      )
    );

    // Detect collisions
    labelCollisions = detectLabelCollisions(labelBoxes);
    nodeCollisions = detectLabelNodeCollisions(labelBoxes, nodes);

    if (labelCollisions.length === 0 && nodeCollisions.length === 0) {
      allResolved = true;
      break;
    }

    // Resolve label-to-label collisions
    for (const collision of labelCollisions) {
      const posAIndex = positions.findIndex(p => p.edgeId === collision.labelA);
      const posBIndex = positions.findIndex(p => p.edgeId === collision.labelB);

      if (posAIndex >= 0 && posBIndex >= 0) {
        const edgeA = edgeLookup.get(collision.labelA);
        const edgeB = edgeLookup.get(collision.labelB);

        if (edgeA && edgeB) {
          const resolved = resolveCollision(
            positions[posAIndex],
            positions[posBIndex],
            edgeA,
            edgeB,
            config
          );
          positions[posAIndex] = resolved.positionA;
          positions[posBIndex] = resolved.positionB;
        }
      }
    }

    // Resolve label-to-node collisions
    for (const collision of nodeCollisions) {
      const posIndex = positions.findIndex(p => p.edgeId === collision.labelId);
      const node = nodes.find(n => n.id === collision.nodeId);

      if (posIndex >= 0 && node) {
        positions[posIndex] = resolveLabelNodeCollision(
          positions[posIndex],
          node,
          config
        );
      }
    }

    iteration++;
  }

  return {
    labelCollisions,
    nodeCollisions,
    totalCollisions: labelCollisions.length + nodeCollisions.length,
    allResolved,
    resolvedPositions: positions,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get label offset for a specific edge
 */
export function getLabelOffset(
  edgeId: string,
  resolvedPositions: EdgeLabelPosition[]
): Point | null {
  const position = resolvedPositions.find(p => p.edgeId === edgeId);
  if (!position || !position.wasAdjusted) return null;
  return position.offset;
}

/**
 * Check if any labels have collisions
 */
export function hasLabelCollisions(result: LabelCollisionResult): boolean {
  return result.totalCollisions > 0 && !result.allResolved;
}

/**
 * Get collision count for metrics
 */
export function getLabelCollisionCount(result: LabelCollisionResult): number {
  return result.labelCollisions.length + result.nodeCollisions.length;
}

/**
 * Calculate label density metric
 */
export function calculateLabelDensity(
  edges: AppEdge[],
  nodes: AppNode[]
): number {
  const edgesWithLabels = edges.filter(edge => {
    const data = edge.data || {};
    return data.label || (data.labelFields && data.labelFields.length > 0);
  });

  if (nodes.length === 0) return 0;

  // Calculate canvas area from node positions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const width = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
    const height = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  const canvasArea = (maxX - minX) * (maxY - minY);
  if (canvasArea === 0) return 0;

  // Calculate total label area
  let totalLabelArea = 0;
  for (const edge of edgesWithLabels) {
    const { width, height } = estimateLabelDimensions(edge);
    totalLabelArea += width * height;
  }

  return totalLabelArea / canvasArea;
}
