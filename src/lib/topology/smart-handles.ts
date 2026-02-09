/**
 * Smart Handle Placement System
 *
 * Automatically determines the best side of each node to place connection handles
 * based on the actual positions of connected nodes. This makes diagrams look
 * much more professional by routing edges to the nearest side of each node.
 *
 * Instead of all edges connecting to the center or left side, edges connect
 * to top/right/bottom/left based on geometric proximity.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import { Position } from '@xyflow/react';
import { layoutLogger } from './layoutLogger';

/**
 * Handle configuration for a node
 */
export interface NodeHandleConfig {
  nodeId: string;
  handles: {
    [edgeId: string]: {
      sourcePosition?: Position;
      targetPosition?: Position;
    };
  };
}

/**
 * Calculate the center point of a node
 */
function getNodeCenter(node: AppNode): { x: number; y: number } {
  const width = node.measured?.width || node.width || 140;
  const height = node.measured?.height || node.height || 140;

  return {
    x: node.position.x + (typeof width === 'number' ? width : 140) / 2,
    y: node.position.y + (typeof height === 'number' ? height : 140) / 2,
  };
}

/**
 * Determine the best handle position based on relative angle
 *
 * @param sourceCenter - Center point of source node
 * @param targetCenter - Center point of target node
 * @returns Best handle positions for source and target
 */
function calculateOptimalHandlePositions(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number }
): { sourcePosition: Position; targetPosition: Position } {
  // Calculate angle from source to target (in radians)
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const angle = Math.atan2(dy, dx);

  // Convert to degrees (0° = right, 90° = down, 180° = left, 270° = up)
  const degrees = ((angle * 180) / Math.PI + 360) % 360;

  // Determine source position (where edge exits source node)
  let sourcePosition: Position;
  if (degrees >= 315 || degrees < 45) {
    sourcePosition = Position.Right;
  } else if (degrees >= 45 && degrees < 135) {
    sourcePosition = Position.Bottom;
  } else if (degrees >= 135 && degrees < 225) {
    sourcePosition = Position.Left;
  } else {
    sourcePosition = Position.Top;
  }

  // Target position is opposite of source (where edge enters target node)
  let targetPosition: Position;
  if (sourcePosition === Position.Right) {
    targetPosition = Position.Left;
  } else if (sourcePosition === Position.Bottom) {
    targetPosition = Position.Top;
  } else if (sourcePosition === Position.Left) {
    targetPosition = Position.Right;
  } else {
    targetPosition = Position.Bottom;
  }

  return { sourcePosition, targetPosition };
}

/**
 * Spacing between edges when offsetting multiple edges to the same target handle
 */
const HANDLE_OFFSET_SPACING = 20; // pixels

/**
 * Determine if a handle position is vertical (left/right) or horizontal (top/bottom)
 */
function isVerticalHandle(position: Position): boolean {
  return position === Position.Left || position === Position.Right;
}

/**
 * Calculate optimal handle positions for all edges in the diagram.
 *
 * @deprecated Use `routeEdges()` from `port-router.ts` instead.
 * This function uses angle-based calculation which ignores layout direction.
 * It is kept for backward compatibility when layout direction is unknown.
 *
 * @param nodes - All nodes in the diagram
 * @param edges - All edges in the diagram
 * @returns Updated edges with sourceHandle and targetHandle properties
 */
export function calculateSmartHandles(
  nodes: AppNode[],
  edges: AppEdge[]
): AppEdge[] {
  layoutLogger.debug('[Smart Handles] Calculating optimal handle positions for', edges.length, 'edges...');

  // Create a set of valid node IDs for quick lookup
  const validNodeIds = new Set(nodes.map(n => n.id));

  // Separate valid and invalid edges upfront
  const validEdges: AppEdge[] = [];
  const invalidEdges: AppEdge[] = [];

  edges.forEach(edge => {
    if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
      validEdges.push(edge);
    } else {
      invalidEdges.push(edge);
      const missingSource = !validNodeIds.has(edge.source);
      const missingTarget = !validNodeIds.has(edge.target);
      if (missingSource || missingTarget) {
        layoutLogger.warn(
          `[Smart Handles] Edge ${edge.id} has missing nodes (source: ${edge.source}${missingSource ? ' [MISSING]' : ''}, target: ${edge.target}${missingTarget ? ' [MISSING]' : ''})`
        );
      }
    }
  });

  // First pass: calculate base handle positions for valid edges only
  interface EdgeWithHandles {
    edge: AppEdge;
    sourcePosition: Position | null;
    targetPosition: Position | null;
    sourceHandleId: string | null;
    targetHandleId: string | null;
  }

  const edgesWithHandles: EdgeWithHandles[] = validEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    // This should never happen since we filtered above, but keep as safety check
    if (!sourceNode || !targetNode) {
      layoutLogger.warn(`[Smart Handles] Edge ${edge.id} has missing nodes (should have been filtered)`);
      return {
        edge,
        sourcePosition: null,
        targetPosition: null,
        sourceHandleId: null,
        targetHandleId: null,
      };
    }

    // Get node centers
    const sourceCenter = getNodeCenter(sourceNode);
    const targetCenter = getNodeCenter(targetNode);

    // Calculate optimal positions
    const { sourcePosition, targetPosition } = calculateOptimalHandlePositions(
      sourceCenter,
      targetCenter
    );

    // Convert Position enum values to handle IDs
    // DeviceNode handles use IDs like "bottom-source", "top-target", etc.
    const sourceHandleId = `${sourcePosition.toLowerCase()}-source`;
    const targetHandleId = `${targetPosition.toLowerCase()}-target`;

    return {
      edge,
      sourcePosition,
      targetPosition,
      sourceHandleId,
      targetHandleId,
    };
  });

  // Second pass: group edges by target node + target handle to detect overlaps
  const targetHandleGroups = new Map<string, EdgeWithHandles[]>();
  
  for (const edgeWithHandles of edgesWithHandles) {
    if (!edgeWithHandles.targetHandleId || !edgeWithHandles.edge.target) continue;
    
    const groupKey = `${edgeWithHandles.edge.target}-${edgeWithHandles.targetHandleId}`;
    
    if (!targetHandleGroups.has(groupKey)) {
      targetHandleGroups.set(groupKey, []);
    }
    targetHandleGroups.get(groupKey)!.push(edgeWithHandles);
  }

  // Third pass: calculate offsets for edges sharing the same target handle
  const handleOffsets = new Map<string, number>();
  
  for (const [, groupEdges] of targetHandleGroups.entries()) {
    if (groupEdges.length <= 1) continue; // No offset needed for single edge
    
    const firstEdge = groupEdges[0];
    if (!firstEdge.targetPosition) continue;
    
    // Determine if this is a vertical or horizontal handle
    const isVertical = isVerticalHandle(firstEdge.targetPosition);
    
    // Sort edges by source position to ensure consistent ordering
    const sortedEdges = [...groupEdges].sort((a, b) => {
      const nodeA = nodes.find(n => n.id === a.edge.source);
      const nodeB = nodes.find(n => n.id === b.edge.source);
      if (!nodeA || !nodeB) return 0;
      
      const centerA = getNodeCenter(nodeA);
      const centerB = getNodeCenter(nodeB);
      
      // Sort by Y for vertical handles (Left/Right), by X for horizontal handles (Top/Bottom)
      return isVertical 
        ? centerA.y - centerB.y 
        : centerA.x - centerB.x;
    });
    
    // Calculate offsets centered around 0
    // For 2 edges: -10, +10 (spacing 20px)
    // For 3 edges: -20, 0, +20
    // For 4 edges: -30, -10, +10, +30
    sortedEdges.forEach((edgeWithHandles, index) => {
      const offsetCount = sortedEdges.length - 1;
      const centerIndex = offsetCount / 2;
      const offset = (index - centerIndex) * HANDLE_OFFSET_SPACING;
      handleOffsets.set(edgeWithHandles.edge.id, offset);
    });
  }

  // Final pass: apply handles and offsets to valid edges
  const processedValidEdges = edgesWithHandles.map(({ edge, sourcePosition, targetPosition, sourceHandleId, targetHandleId }) => {
    if (!sourcePosition || !targetPosition || !sourceHandleId || !targetHandleId) {
      return edge;
    }

    const handleOffset = handleOffsets.get(edge.id) || 0;

    return {
      ...edge,
      sourceHandle: sourceHandleId,
      targetHandle: targetHandleId,
      data: {
        ...edge.data,
        // Store positions in data for reference
        smartHandles: {
          sourcePosition,
          targetPosition,
          calculated: true,
        },
        // Store handle offset for orthogonal edge routing
        handleOffset: handleOffset !== 0 ? handleOffset : undefined,
      },
    };
  });

  // Return all edges: processed valid edges + unchanged invalid edges
  const allEdges = [...processedValidEdges, ...invalidEdges];

  const offsetCount = handleOffsets.size;
  if (offsetCount > 0) {
    layoutLogger.debug(`[Smart Handles] ✅ Updated ${processedValidEdges.length} edges, applied offsets to ${offsetCount} edges${invalidEdges.length > 0 ? `, skipped ${invalidEdges.length} invalid edges` : ''}`);
  } else {
    layoutLogger.debug(`[Smart Handles] ✅ Updated ${processedValidEdges.length} edges with smart handles${invalidEdges.length > 0 ? `, skipped ${invalidEdges.length} invalid edges` : ''}`);
  }

  return allEdges;
}

/**
 * Apply smart handles to edges after layout
 * This should be called after any layout operation (tidy, drag, etc.)
 */
export function applySmartHandlesToEdges(
  nodes: AppNode[],
  edges: AppEdge[]
): { nodes: AppNode[]; edges: AppEdge[] } {
  const updatedEdges = calculateSmartHandles(nodes, edges);

  return {
    nodes,
    edges: updatedEdges,
  };
}

/**
 * Get handle positions summary for debugging
 */
export function getHandlesSummary(edges: AppEdge[]): string {
  const summary: Record<string, number> = {
    'Right → Left': 0,
    'Left → Right': 0,
    'Bottom → Top': 0,
    'Top → Bottom': 0,
    'Mixed': 0,
  };

  edges.forEach(edge => {
    const source = edge.sourceHandle || 'unknown';
    const target = edge.targetHandle || 'unknown';
    const key = `${source} → ${target}`;

    if (key in summary) {
      summary[key]++;
    } else {
      summary['Mixed']++;
    }
  });

  return Object.entries(summary)
    .filter(([_, count]) => count > 0)
    .map(([direction, count]) => `${direction}: ${count}`)
    .join(', ');
}
