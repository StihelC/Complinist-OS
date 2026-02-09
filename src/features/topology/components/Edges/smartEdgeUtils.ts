/**
 * Smart Edge Utilities
 *
 * Shared utilities for smart edge routing, obstacle detection, and path generation.
 * Used by SmartCustomEdge and SmartSmoothStepEdge.
 */

import { Position } from '@xyflow/react';

// ============================================================================
// Types
// ============================================================================

export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HierarchicalNodeRect extends NodeRect {
  parentId?: string;
  type?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface EdgeEndpoints {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}

// ============================================================================
// Geometry Utilities
// ============================================================================

/**
 * Calculate where a line from node center to target intersects the node boundary
 */
export function getIntersection(
  nodeX: number,
  nodeY: number,
  nodeW: number,
  nodeH: number,
  targetX: number,
  targetY: number
): { x: number; y: number; position: Position } {
  const cx = nodeX + nodeW / 2;
  const cy = nodeY + nodeH / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy, position: Position.Bottom };
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const hw = nodeW / 2;
  const hh = nodeH / 2;

  let x: number, y: number, position: Position;

  if (absDx * hh > absDy * hw) {
    if (dx > 0) {
      x = nodeX + nodeW;
      y = cy + (hw / dx) * dy;
      position = Position.Right;
    } else {
      x = nodeX;
      y = cy - (hw / dx) * dy;
      position = Position.Left;
    }
  } else {
    if (dy > 0) {
      x = cx + (hh / dy) * dx;
      y = nodeY + nodeH;
      position = Position.Bottom;
    } else {
      x = cx - (hh / dy) * dx;
      y = nodeY;
      position = Position.Top;
    }
  }

  return { x, y, position };
}

/**
 * Check if a point is inside a rectangle (with padding)
 */
export function pointInRect(
  px: number,
  py: number,
  rect: NodeRect,
  padding: number = 0
): boolean {
  return (
    px >= rect.x - padding &&
    px <= rect.x + rect.width + padding &&
    py >= rect.y - padding &&
    py <= rect.y + rect.height + padding
  );
}

/**
 * Check if two line segments intersect
 */
export function lineSegmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 0.0001) return false;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Check if a line segment intersects a rectangle
 */
export function lineIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rect: NodeRect,
  padding: number = 10
): boolean {
  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;

  if (pointInRect(x1, y1, rect, padding) || pointInRect(x2, y2, rect, padding)) {
    return true;
  }

  return (
    lineSegmentsIntersect(x1, y1, x2, y2, left, top, left, bottom) ||
    lineSegmentsIntersect(x1, y1, x2, y2, right, top, right, bottom) ||
    lineSegmentsIntersect(x1, y1, x2, y2, left, top, right, top) ||
    lineSegmentsIntersect(x1, y1, x2, y2, left, bottom, right, bottom)
  );
}

// ============================================================================
// Obstacle Detection
// ============================================================================

/**
 * Find blocking nodes between source and target
 */
export function findBlockingNodes(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  nodes: NodeRect[],
  sourceId: string,
  targetId: string
): NodeRect[] {
  return nodes.filter(node => {
    if (node.id === sourceId || node.id === targetId) return false;
    return lineIntersectsRect(sourceX, sourceY, targetX, targetY, node, 15);
  });
}

/**
 * Find sibling boundaries that could block the path
 */
export function findSiblingBoundaryObstacles(
  source: string,
  target: string,
  allNodes: HierarchicalNodeRect[],
  boundaryNodesAbsolute: NodeRect[]
): NodeRect[] {
  const sourceNode = allNodes.find(n => n.id === source);
  const targetNode = allNodes.find(n => n.id === target);
  const sourceParent = sourceNode?.parentId;
  const targetParent = targetNode?.parentId;

  // Build ancestor chains
  const sourceAncestors = new Set<string>();
  const targetAncestors = new Set<string>();

  let current = sourceNode;
  while (current?.parentId) {
    sourceAncestors.add(current.parentId);
    current = allNodes.find(n => n.id === current!.parentId);
  }

  current = targetNode;
  while (current?.parentId) {
    targetAncestors.add(current.parentId);
    current = allNodes.find(n => n.id === current!.parentId);
  }

  return boundaryNodesAbsolute.filter(boundary => {
    if (boundary.id === source || boundary.id === target) return false;
    if (sourceAncestors.has(boundary.id) || targetAncestors.has(boundary.id)) return false;

    const boundaryNode = allNodes.find(n => n.id === boundary.id);
    if (!boundaryNode) return false;

    // Include if sibling (same parent)
    if (boundaryNode.parentId === sourceParent || boundaryNode.parentId === targetParent) {
      return true;
    }

    return false;
  });
}

// ============================================================================
// Waypoint Calculation
// ============================================================================

/**
 * Calculate waypoints to route around blocking nodes
 */
export function calculateWaypoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  blockingNodes: NodeRect[],
  baseOffset: number = 0
): Point[] {
  if (blockingNodes.length === 0) {
    return [];
  }

  const padding = 25;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const node of blockingNodes) {
    minX = Math.min(minX, node.x - padding + baseOffset);
    maxX = Math.max(maxX, node.x + node.width + padding + baseOffset);
    minY = Math.min(minY, node.y - padding + baseOffset);
    maxY = Math.max(maxY, node.y + node.height + padding + baseOffset);
  }

  const waypoints: Point[] = [];
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const isMainlyHorizontal = Math.abs(dx) > Math.abs(dy);
  const sourceMidX = (sourceX + targetX) / 2;
  const sourceMidY = (sourceY + targetY) / 2;

  const distToTop = sourceMidY - minY;
  const distToBottom = maxY - sourceMidY;
  const distToLeft = sourceMidX - minX;
  const distToRight = maxX - sourceMidX;

  if (isMainlyHorizontal) {
    const goingRight = dx > 0;
    const routeAbove = distToTop < distToBottom;
    const routeY = routeAbove ? minY : maxY;
    const sourceInObstacleX = sourceX > minX && sourceX < maxX;
    const targetInObstacleX = targetX > minX && targetX < maxX;

    if (sourceInObstacleX && targetInObstacleX) {
      const exitX = goingRight ? maxX : minX;
      waypoints.push({ x: sourceX, y: routeY });
      waypoints.push({ x: exitX, y: routeY });
      waypoints.push({ x: exitX, y: targetY });
    } else {
      waypoints.push({ x: sourceX, y: routeY });
      waypoints.push({ x: targetX, y: routeY });
    }
  } else {
    const goingDown = dy > 0;
    const routeLeft = distToLeft < distToRight;
    const routeX = routeLeft ? minX : maxX;
    const sourceInObstacleY = sourceY > minY && sourceY < maxY;
    const targetInObstacleY = targetY > minY && targetY < maxY;

    if (sourceInObstacleY && targetInObstacleY) {
      const exitY = goingDown ? maxY : minY;
      waypoints.push({ x: routeX, y: sourceY });
      waypoints.push({ x: routeX, y: exitY });
      waypoints.push({ x: targetX, y: exitY });
    } else {
      waypoints.push({ x: routeX, y: sourceY });
      waypoints.push({ x: routeX, y: targetY });
    }
  }

  return cleanWaypoints(waypoints, sourceX, sourceY, targetX, targetY);
}

/**
 * Remove redundant waypoints that are too close together
 */
function cleanWaypoints(
  waypoints: Point[],
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  minDistance: number = 10
): Point[] {
  const cleaned: Point[] = [];

  for (const wp of waypoints) {
    const lastPoint = cleaned.length > 0
      ? cleaned[cleaned.length - 1]
      : { x: sourceX, y: sourceY };

    const dist = Math.hypot(wp.x - lastPoint.x, wp.y - lastPoint.y);
    if (dist > minDistance) {
      cleaned.push(wp);
    }
  }

  // Remove waypoints too close to target
  while (cleaned.length > 0) {
    const lastWp = cleaned[cleaned.length - 1];
    if (Math.hypot(lastWp.x - targetX, lastWp.y - targetY) < minDistance) {
      cleaned.pop();
    } else {
      break;
    }
  }

  return cleaned;
}

// ============================================================================
// Path Generation
// ============================================================================

/**
 * Generate SVG path string with waypoints and rounded corners
 */
export function generatePathWithWaypoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  waypoints: Point[],
  borderRadius: number = 8
): string {
  if (waypoints.length === 0) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  const points = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ];

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const distToPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const distToNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const maxRadius = Math.min(borderRadius, distToPrev / 2, distToNext / 2);

    if (maxRadius < 2) {
      path += ` L ${curr.x} ${curr.y}`;
    } else {
      const beforeX = curr.x - ((curr.x - prev.x) / distToPrev) * maxRadius;
      const beforeY = curr.y - ((curr.y - prev.y) / distToPrev) * maxRadius;
      const afterX = curr.x + ((next.x - curr.x) / distToNext) * maxRadius;
      const afterY = curr.y + ((next.y - curr.y) / distToNext) * maxRadius;
      path += ` L ${beforeX} ${beforeY} Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
    }
  }

  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return path;
}

/**
 * Calculate label position along the path
 */
export function calculateLabelPosition(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  waypoints: Point[]
): Point {
  if (waypoints.length === 0) {
    return { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
  }

  const allPoints = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ];

  const midIndex = Math.floor(allPoints.length / 2);

  if (allPoints.length % 2 === 0) {
    const p1 = allPoints[midIndex - 1];
    const p2 = allPoints[midIndex];
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  return allPoints[midIndex];
}

// ============================================================================
// Edge Styling
// ============================================================================

export type ConnectionState = 'active' | 'standby' | 'failed';

/**
 * Get edge style based on connection state, selection, and hover
 */
export function getEdgeStyle(
  connectionState: ConnectionState,
  selected: boolean,
  hasOverlap: boolean,
  hovered: boolean = false,
  baseStyle: React.CSSProperties = {}
): React.CSSProperties {
  const style: React.CSSProperties = { ...baseStyle };

  // Hover takes precedence for visual feedback
  if (hovered && !selected) {
    style.stroke = '#60a5fa'; // blue-400
    style.strokeWidth = 2.5;
    style.cursor = 'pointer';
    return style;
  }

  switch (connectionState) {
    case 'active':
      style.stroke = selected ? '#3b82f6' : '#6b7280';
      style.strokeWidth = selected ? 3 : 2;
      if (hasOverlap) {
        style.stroke = selected ? '#4b5563' : '#6b7280';
        style.strokeWidth = selected ? 2.5 : 2;
      }
      break;
    case 'standby':
      style.stroke = '#eab308';
      style.strokeWidth = selected ? 3 : 2;
      style.strokeDasharray = '5,5';
      break;
    case 'failed':
      style.stroke = '#ef4444';
      style.strokeWidth = selected ? 3 : 2;
      style.strokeDasharray = '3,3';
      break;
  }

  return style;
}

/**
 * Generate a consistent offset based on edge ID to help prevent overlap
 */
export function getEdgeOffset(edgeId: string): number {
  let hash = 0;
  for (let i = 0; i < edgeId.length; i++) {
    const char = edgeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return (hash % 21) - 10; // -10 to 10
}
