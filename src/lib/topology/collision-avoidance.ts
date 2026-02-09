/**
 * Collision Avoidance System
 *
 * Prevents nodes from overlapping by automatically nudging them apart
 * when they get too close during manual dragging operations.
 *
 * This provides a smooth UX where nodes "push" each other away rather
 * than stacking on top of one another.
 */

import { AppNode } from '@/lib/utils/types';
import { getNodeDimensions } from './collision-detection';

// =============================================================================
// Types
// =============================================================================

export interface NudgeResult {
  /** Map of node IDs to their new positions */
  nudgedPositions: Map<string, { x: number; y: number }>;
  /** Number of nodes that were nudged */
  nudgedCount: number;
  /** Whether any nudging occurred */
  hadCollisions: boolean;
}

export interface CollisionAvoidanceOptions {
  /** Minimum clearance distance in pixels (default: 20) */
  minClearance?: number;
  /** Maximum nudge distance per iteration in pixels (default: 50) */
  maxNudgeDistance?: number;
  /** Maximum iterations to resolve collisions (default: 3) */
  maxIterations?: number;
  /** Only avoid collisions for device nodes (exclude boundaries) */
  devicesOnly?: boolean;
  /** IDs of nodes being actively dragged (don't nudge these) */
  draggedNodeIds?: Set<string>;
}

interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Default minimum clearance between nodes during dragging */
const DEFAULT_MIN_CLEARANCE = 20;

/** Default maximum distance to nudge a node in one iteration */
const DEFAULT_MAX_NUDGE = 50;

/** Default maximum iterations to resolve collisions */
const DEFAULT_MAX_ITERATIONS = 3;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert node to rect for collision calculations
 */
function nodeToRect(node: AppNode): NodeRect {
  const { width, height } = getNodeDimensions(node);
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
    parentId: node.parentId,
  };
}

/**
 * Check if two rects intersect (with clearance buffer)
 */
function rectsIntersectWithClearance(
  a: NodeRect,
  b: NodeRect,
  clearance: number
): boolean {
  // Expand boxes by clearance
  const aExpanded = {
    x: a.x - clearance / 2,
    y: a.y - clearance / 2,
    width: a.width + clearance,
    height: a.height + clearance,
  };
  const bExpanded = {
    x: b.x - clearance / 2,
    y: b.y - clearance / 2,
    width: b.width + clearance,
    height: b.height + clearance,
  };

  return !(
    aExpanded.x + aExpanded.width <= bExpanded.x ||
    bExpanded.x + bExpanded.width <= aExpanded.x ||
    aExpanded.y + aExpanded.height <= bExpanded.y ||
    bExpanded.y + bExpanded.height <= aExpanded.y
  );
}

/**
 * Calculate the direction and magnitude to nudge node B away from node A
 */
function calculateNudgeVector(
  a: NodeRect,
  b: NodeRect,
  minClearance: number
): { dx: number; dy: number; magnitude: number } {
  // Calculate centers
  const aCenterX = a.x + a.width / 2;
  const aCenterY = a.y + a.height / 2;
  const bCenterX = b.x + b.width / 2;
  const bCenterY = b.y + b.height / 2;

  // Calculate direction from A to B
  const dx = bCenterX - aCenterX;
  const dy = bCenterY - aCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // If nodes are exactly on top of each other, nudge in a default direction
  if (distance < 0.1) {
    return { dx: minClearance, dy: 0, magnitude: minClearance };
  }

  // Calculate overlap amount
  const xOverlap = a.width / 2 + b.width / 2 + minClearance - Math.abs(dx);
  const yOverlap = a.height / 2 + b.height / 2 + minClearance - Math.abs(dy);

  // Nudge in the direction of least resistance
  const magnitude = Math.max(xOverlap, yOverlap);

  // Normalize and scale
  const normalizedDx = (dx / distance) * magnitude;
  const normalizedDy = (dy / distance) * magnitude;

  return { dx: normalizedDx, dy: normalizedDy, magnitude };
}

// =============================================================================
// Main Collision Avoidance Function
// =============================================================================

/**
 * Apply collision avoidance by nudging overlapping nodes apart.
 *
 * This function detects collisions and calculates new positions that
 * maintain minimum clearance between nodes. It iteratively resolves
 * collisions until no overlaps remain or max iterations is reached.
 *
 * @param nodes - All nodes in the diagram
 * @param options - Configuration options
 * @returns NudgeResult with new positions for colliding nodes
 *
 * @example
 * ```ts
 * const result = applyCollisionAvoidance(nodes, {
 *   minClearance: 20,
 *   draggedNodeIds: new Set(['node-1']),
 * });
 *
 * if (result.hadCollisions) {
 *   // Apply nudged positions to nodes
 *   result.nudgedPositions.forEach((pos, nodeId) => {
 *     // Update node position
 *   });
 * }
 * ```
 */
export function applyCollisionAvoidance(
  nodes: AppNode[],
  options: CollisionAvoidanceOptions = {}
): NudgeResult {
  const {
    minClearance = DEFAULT_MIN_CLEARANCE,
    maxNudgeDistance = DEFAULT_MAX_NUDGE,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    devicesOnly = true, // Default to only avoiding device collisions
    draggedNodeIds = new Set<string>(),
  } = options;

  const nudgedPositions = new Map<string, { x: number; y: number }>();

  // Filter nodes to check for collisions
  let checkNodes = devicesOnly
    ? nodes.filter(n => n.type === 'device')
    : nodes;

  if (checkNodes.length < 2) {
    return {
      nudgedPositions,
      nudgedCount: 0,
      hadCollisions: false,
    };
  }

  // Separate dragged and static nodes
  // We check collisions with all nodes, but only nudge static ones
  const staticNodes = checkNodes.filter(n => !draggedNodeIds.has(n.id));

  // Create working copy of node positions
  const workingPositions = new Map<string, { x: number; y: number }>();
  checkNodes.forEach(node => {
    workingPositions.set(node.id, { ...node.position });
  });

  let hadCollisions = false;
  let iteration = 0;

  // Iteratively resolve collisions
  while (iteration < maxIterations) {
    let collisionsThisIteration = false;
    const nudges = new Map<string, { dx: number; dy: number; count: number }>();

    // Convert ALL nodes to rects with current positions (including dragged ones for collision detection)
    const allRects = checkNodes.map(node => {
      const pos = workingPositions.get(node.id) || node.position;
      const { width, height } = getNodeDimensions(node);
      return {
        id: node.id,
        x: pos.x,
        y: pos.y,
        width,
        height,
        parentId: node.parentId,
        isDragged: draggedNodeIds.has(node.id),
      };
    });

    // Check all pairs for collisions (including dragged nodes)
    for (let i = 0; i < allRects.length; i++) {
      for (let j = i + 1; j < allRects.length; j++) {
        const a = allRects[i];
        const b = allRects[j];

        // Skip if they have different parents (different hierarchies)
        if (a.parentId !== b.parentId) {
          continue;
        }

        // Check for collision
        if (rectsIntersectWithClearance(a, b, minClearance)) {
          collisionsThisIteration = true;
          hadCollisions = true;

          // Calculate nudge vector
          const nudgeVector = calculateNudgeVector(a, b, minClearance);

          // Split the nudge between both nodes, but only apply to non-dragged nodes
          const halfDx = nudgeVector.dx / 2;
          const halfDy = nudgeVector.dy / 2;

          // Only accumulate nudge for node A if it's not being dragged
          if (!a.isDragged) {
            const nudgeA = nudges.get(a.id) || { dx: 0, dy: 0, count: 0 };
            nudgeA.dx -= halfDx;
            nudgeA.dy -= halfDy;
            nudgeA.count++;
            nudges.set(a.id, nudgeA);
          }

          // Only accumulate nudge for node B if it's not being dragged
          if (!b.isDragged) {
            const nudgeB = nudges.get(b.id) || { dx: 0, dy: 0, count: 0 };
            nudgeB.dx += halfDx;
            nudgeB.dy += halfDy;
            nudgeB.count++;
            nudges.set(b.id, nudgeB);
          }
        }
      }
    }

    // Apply nudges to working positions
    if (collisionsThisIteration) {
      nudges.forEach((nudge, nodeId) => {
        const currentPos = workingPositions.get(nodeId);
        if (!currentPos) return;

        // Average out the nudge if multiple collisions
        const avgDx = nudge.dx / nudge.count;
        const avgDy = nudge.dy / nudge.count;

        // Limit nudge distance to prevent wild movements
        const magnitude = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
        let finalDx = avgDx;
        let finalDy = avgDy;

        if (magnitude > maxNudgeDistance) {
          const scale = maxNudgeDistance / magnitude;
          finalDx = avgDx * scale;
          finalDy = avgDy * scale;
        }

        workingPositions.set(nodeId, {
          x: currentPos.x + finalDx,
          y: currentPos.y + finalDy,
        });
      });
    }

    if (!collisionsThisIteration) {
      // No more collisions, we're done
      break;
    }

    iteration++;
  }

  // Build result with only changed positions
  let nudgedCount = 0;
  workingPositions.forEach((pos, nodeId) => {
    const node = staticNodes.find(n => n.id === nodeId);
    if (!node) return;

    const originalPos = node.position;
    const dx = pos.x - originalPos.x;
    const dy = pos.y - originalPos.y;
    const moved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;

    if (moved) {
      nudgedPositions.set(nodeId, pos);
      nudgedCount++;
    }
  });

  return {
    nudgedPositions,
    nudgedCount,
    hadCollisions,
  };
}

/**
 * Apply collision avoidance to a specific node being dragged.
 * This is optimized for real-time dragging - only checks the dragged
 * node against other nodes, not all pairs.
 *
 * @param draggedNode - The node being dragged
 * @param allNodes - All nodes in the diagram
 * @param options - Configuration options
 * @returns New position for the dragged node if collision detected
 */
export function avoidCollisionForDraggedNode(
  draggedNode: AppNode,
  allNodes: AppNode[],
  options: CollisionAvoidanceOptions = {}
): { x: number; y: number } | null {
  const {
    minClearance = DEFAULT_MIN_CLEARANCE,
    devicesOnly = true,
  } = options;

  // Only avoid device-to-device collisions by default
  if (devicesOnly && draggedNode.type !== 'device') {
    return null;
  }

  // Get other nodes to check against (same parent only)
  const checkNodes = allNodes.filter(n => {
    if (n.id === draggedNode.id) return false;
    if (devicesOnly && n.type !== 'device') return false;
    if (n.parentId !== draggedNode.parentId) return false;
    return true;
  });

  if (checkNodes.length === 0) {
    return null;
  }

  const draggedRect = nodeToRect(draggedNode);
  let totalNudgeDx = 0;
  let totalNudgeDy = 0;
  let collisionCount = 0;

  // Check for collisions with other nodes
  for (const otherNode of checkNodes) {
    const otherRect = nodeToRect(otherNode);

    if (rectsIntersectWithClearance(draggedRect, otherRect, minClearance)) {
      const nudge = calculateNudgeVector(otherRect, draggedRect, minClearance);
      totalNudgeDx += nudge.dx;
      totalNudgeDy += nudge.dy;
      collisionCount++;
    }
  }

  if (collisionCount === 0) {
    return null;
  }

  // Average the nudges
  const avgDx = totalNudgeDx / collisionCount;
  const avgDy = totalNudgeDy / collisionCount;

  return {
    x: draggedNode.position.x + avgDx,
    y: draggedNode.position.y + avgDy,
  };
}
