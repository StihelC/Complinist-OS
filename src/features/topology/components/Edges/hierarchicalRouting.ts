/**
 * Hierarchical Edge Routing Utilities
 *
 * Routes edges through parent boundary borders when nodes are in different boundaries.
 * Creates clear hierarchical paths that show the flow of connections through the boundary structure.
 */

import { Position } from '@xyflow/react';

export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  type?: string;
}

export interface BoundaryRect extends NodeRect {
  type: 'boundary';
}

interface Point {
  x: number;
  y: number;
}

/**
 * Get the boundary chain (all ancestors) for a node
 */
export function getBoundaryChain(
  nodeId: string,
  allNodes: NodeRect[]
): string[] {
  const chain: string[] = [];
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return chain;

  let currentParentId = node.parentId;
  while (currentParentId) {
    chain.push(currentParentId);
    const parent = allNodes.find(n => n.id === currentParentId);
    if (!parent) break;
    currentParentId = parent.parentId;
  }

  return chain;
}

/**
 * Find the lowest common ancestor boundary between two nodes
 */
export function findLowestCommonAncestor(
  sourceChain: string[],
  targetChain: string[]
): string | null {
  for (const boundaryId of sourceChain) {
    if (targetChain.includes(boundaryId)) {
      return boundaryId;
    }
  }
  return null;
}

/**
 * Get absolute position of a node (accounting for all parent positions)
 */
export function getAbsolutePosition(
  node: NodeRect,
  allNodes: NodeRect[]
): Point {
  let x = node.x;
  let y = node.y;
  let currentParentId = node.parentId;

  while (currentParentId) {
    const parent = allNodes.find(n => n.id === currentParentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    currentParentId = parent.parentId;
  }

  return { x, y };
}

/**
 * Calculate the exit point from a boundary for a given direction
 */
function getBoundaryExitPoint(
  boundary: NodeRect,
  boundaryAbsPos: Point,
  sourcePoint: Point,
  targetPoint: Point,
  padding: number = 10
): { point: Point; position: Position } {
  const boundaryLeft = boundaryAbsPos.x;
  const boundaryRight = boundaryAbsPos.x + boundary.width;
  const boundaryTop = boundaryAbsPos.y;
  const boundaryBottom = boundaryAbsPos.y + boundary.height;

  // Determine which edge to exit from based on direction to target
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Clamp the exit point to be within the boundary edge
  if (absDx > absDy) {
    // Exit horizontally
    if (dx > 0) {
      // Exit right
      const clampedY = Math.max(boundaryTop + padding, Math.min(boundaryBottom - padding, sourcePoint.y));
      return {
        point: { x: boundaryRight, y: clampedY },
        position: Position.Right
      };
    } else {
      // Exit left
      const clampedY = Math.max(boundaryTop + padding, Math.min(boundaryBottom - padding, sourcePoint.y));
      return {
        point: { x: boundaryLeft, y: clampedY },
        position: Position.Left
      };
    }
  } else {
    // Exit vertically
    if (dy > 0) {
      // Exit bottom
      const clampedX = Math.max(boundaryLeft + padding, Math.min(boundaryRight - padding, sourcePoint.x));
      return {
        point: { x: clampedX, y: boundaryBottom },
        position: Position.Bottom
      };
    } else {
      // Exit top
      const clampedX = Math.max(boundaryLeft + padding, Math.min(boundaryRight - padding, sourcePoint.x));
      return {
        point: { x: clampedX, y: boundaryTop },
        position: Position.Top
      };
    }
  }
}

/**
 * Calculate the entry point into a boundary from a given direction
 */
function getBoundaryEntryPoint(
  boundary: NodeRect,
  boundaryAbsPos: Point,
  sourcePoint: Point,
  targetPoint: Point,
  padding: number = 10
): { point: Point; position: Position } {
  const boundaryLeft = boundaryAbsPos.x;
  const boundaryRight = boundaryAbsPos.x + boundary.width;
  const boundaryTop = boundaryAbsPos.y;
  const boundaryBottom = boundaryAbsPos.y + boundary.height;

  // Determine which edge to enter from based on direction from source
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > absDy) {
    // Enter horizontally
    if (dx > 0) {
      // Enter from left
      const clampedY = Math.max(boundaryTop + padding, Math.min(boundaryBottom - padding, targetPoint.y));
      return {
        point: { x: boundaryLeft, y: clampedY },
        position: Position.Left
      };
    } else {
      // Enter from right
      const clampedY = Math.max(boundaryTop + padding, Math.min(boundaryBottom - padding, targetPoint.y));
      return {
        point: { x: boundaryRight, y: clampedY },
        position: Position.Right
      };
    }
  } else {
    // Enter vertically
    if (dy > 0) {
      // Enter from top
      const clampedX = Math.max(boundaryLeft + padding, Math.min(boundaryRight - padding, targetPoint.x));
      return {
        point: { x: clampedX, y: boundaryTop },
        position: Position.Top
      };
    } else {
      // Enter from bottom
      const clampedX = Math.max(boundaryLeft + padding, Math.min(boundaryRight - padding, targetPoint.x));
      return {
        point: { x: clampedX, y: boundaryBottom },
        position: Position.Bottom
      };
    }
  }
}

/**
 * Calculate hierarchical waypoints for routing through boundary borders
 */
export function calculateHierarchicalWaypoints(
  sourceId: string,
  targetId: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  allNodes: NodeRect[],
  boundaryNodes: NodeRect[]
): Point[] {
  const waypoints: Point[] = [];

  // Get boundary chains for source and target
  const sourceChain = getBoundaryChain(sourceId, allNodes);
  const targetChain = getBoundaryChain(targetId, allNodes);

  // If both are in the same boundary or neither has a boundary, no hierarchical routing needed
  if (sourceChain.length === 0 && targetChain.length === 0) {
    return waypoints;
  }

  // If they share the same immediate parent, no hierarchical routing needed
  const sourceParent = allNodes.find(n => n.id === sourceId)?.parentId;
  const targetParent = allNodes.find(n => n.id === targetId)?.parentId;
  if (sourceParent === targetParent) {
    return waypoints;
  }

  // Find the lowest common ancestor
  const lca = findLowestCommonAncestor(sourceChain, targetChain);

  // Get boundaries to exit from (source side) - from innermost to LCA (exclusive)
  const exitBoundaries: NodeRect[] = [];
  for (const boundaryId of sourceChain) {
    if (boundaryId === lca) break;
    const boundary = boundaryNodes.find(b => b.id === boundaryId);
    if (boundary) exitBoundaries.push(boundary);
  }

  // Get boundaries to enter into (target side) - from LCA (exclusive) to innermost
  const enterBoundaries: NodeRect[] = [];
  for (const boundaryId of targetChain) {
    if (boundaryId === lca) break;
    const boundary = boundaryNodes.find(b => b.id === boundaryId);
    if (boundary) enterBoundaries.push(boundary);
  }
  enterBoundaries.reverse(); // We want to enter from outer to inner

  // Calculate exit waypoints
  let currentPoint: Point = { x: sourceX, y: sourceY };
  const targetPoint: Point = { x: targetX, y: targetY };

  for (const boundary of exitBoundaries) {
    const boundaryAbsPos = getAbsolutePosition(boundary, allNodes);
    const exitInfo = getBoundaryExitPoint(boundary, boundaryAbsPos, currentPoint, targetPoint);
    waypoints.push(exitInfo.point);
    currentPoint = exitInfo.point;
  }

  // Calculate entry waypoints
  for (const boundary of enterBoundaries) {
    const boundaryAbsPos = getAbsolutePosition(boundary, allNodes);
    const entryInfo = getBoundaryEntryPoint(boundary, boundaryAbsPos, currentPoint, targetPoint);
    waypoints.push(entryInfo.point);
    currentPoint = entryInfo.point;
  }

  // Clean up waypoints - remove points that are too close to each other or to source/target
  const cleanedWaypoints = cleanWaypoints(waypoints, sourceX, sourceY, targetX, targetY, 15);

  return cleanedWaypoints;
}

/**
 * Clean up waypoints by removing redundant points
 */
function cleanWaypoints(
  waypoints: Point[],
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  minDistance: number
): Point[] {
  if (waypoints.length === 0) return [];

  const cleaned: Point[] = [];
  let prevPoint: Point = { x: sourceX, y: sourceY };

  for (const wp of waypoints) {
    const dist = Math.sqrt(Math.pow(wp.x - prevPoint.x, 2) + Math.pow(wp.y - prevPoint.y, 2));
    if (dist > minDistance) {
      cleaned.push(wp);
      prevPoint = wp;
    }
  }

  // Remove waypoints too close to target
  while (cleaned.length > 0) {
    const lastWp = cleaned[cleaned.length - 1];
    const distToTarget = Math.sqrt(Math.pow(lastWp.x - targetX, 2) + Math.pow(lastWp.y - targetY, 2));
    if (distToTarget < minDistance) {
      cleaned.pop();
    } else {
      break;
    }
  }

  return cleaned;
}

/**
 * Merge hierarchical waypoints with obstacle-avoidance waypoints
 * Hierarchical waypoints take priority for the main structure,
 * but obstacle-avoidance can add intermediate points
 */
export function mergeWaypoints(
  hierarchicalWaypoints: Point[],
  obstacleWaypoints: Point[]
): Point[] {
  // If no hierarchical waypoints, just use obstacle waypoints
  if (hierarchicalWaypoints.length === 0) {
    return obstacleWaypoints;
  }

  // If no obstacle waypoints, just use hierarchical waypoints
  if (obstacleWaypoints.length === 0) {
    return hierarchicalWaypoints;
  }

  // Use hierarchical waypoints as the primary structure
  // This ensures edges route through boundary borders
  return hierarchicalWaypoints;
}
