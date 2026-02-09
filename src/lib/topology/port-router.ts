/**
 * Port-Based Edge Routing System
 *
 * Routes edges based on layout direction rather than geometric angles.
 * This ensures edges flow with the Dagre layout direction (TB, LR, etc.)
 * instead of connecting to arbitrary sides based on node positions.
 *
 * Key concepts:
 * - Downstream edges: target is "after" source in flow direction
 * - Upstream edges: target is "before" source (feedback loops)
 * - Sibling edges: nodes at same rank (perpendicular routing)
 */

import { AppNode, AppEdge, BoundaryNodeData, DeviceAlignment } from '@/lib/utils/types';
import { Position } from '@xyflow/react';
import { DagreDirection } from '@/lib/layout/dagreLayout';
import { calculateNodeRanks } from './flowAnalysis';
import { layoutLogger } from './layoutLogger';
import { calculateSmartHandles } from './smart-handles';

// Re-export DagreDirection for convenience
export type { DagreDirection };

// Port side matching ReactFlow Handle positions
export type PortSide = 'top' | 'right' | 'bottom' | 'left';

// Relationship between source and target nodes based on rank
export type NodeRelationship = 'downstream' | 'upstream' | 'sibling';

// Port load tracking per node (how many edges use each side)
interface PortLoads {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Spacing between edges when multiple share the same port
const HANDLE_OFFSET_SPACING = 20; // pixels

/**
 * Default port sides for each layout direction.
 * Source port = where edges exit the source node
 * Target port = where edges enter the target node
 */
const DEFAULT_PORT_SIDES: Record<DagreDirection, { source: PortSide; target: PortSide }> = {
  TB: { source: 'bottom', target: 'top' },    // Top-to-Bottom: exit bottom, enter top
  BT: { source: 'top', target: 'bottom' },    // Bottom-to-Top: exit top, enter bottom
  LR: { source: 'right', target: 'left' },    // Left-to-Right: exit right, enter left
  RL: { source: 'left', target: 'right' },    // Right-to-Left: exit left, enter right
};

/**
 * Port sides for sibling nodes (same rank).
 * Uses perpendicular direction to main flow.
 */
const SIBLING_PORT_SIDES: Record<DagreDirection, { source: PortSide; target: PortSide }> = {
  TB: { source: 'right', target: 'left' },    // Horizontal for vertical layouts
  BT: { source: 'right', target: 'left' },
  LR: { source: 'bottom', target: 'top' },    // Vertical for horizontal layouts
  RL: { source: 'bottom', target: 'top' },
};

/**
 * Get the default port sides for a layout direction.
 */
export function getDefaultPortSides(direction: DagreDirection): { source: PortSide; target: PortSide } {
  return DEFAULT_PORT_SIDES[direction];
}

/**
 * Get the port sides for sibling nodes.
 */
export function getSiblingPortSides(direction: DagreDirection): { source: PortSide; target: PortSide } {
  return SIBLING_PORT_SIDES[direction];
}

/**
 * Determine the relationship between two nodes based on their ranks.
 *
 * @param sourceRank - Rank of the source node (from calculateNodeRanks)
 * @param targetRank - Rank of the target node
 * @param direction - Layout direction
 * @param threshold - Rank difference threshold to consider nodes as siblings (default: 0)
 */
export function getNodeRelationship(
  sourceRank: number,
  targetRank: number,
  direction: DagreDirection,
  threshold: number = 0
): NodeRelationship {
  const rankDiff = targetRank - sourceRank;

  // Same rank (within threshold) = sibling
  if (Math.abs(rankDiff) <= threshold) {
    return 'sibling';
  }

  // For TB/LR: positive diff = downstream (target is "after" source)
  // For BT/RL: negative diff = downstream (flow is reversed)
  const isReversedFlow = direction === 'BT' || direction === 'RL';
  const isDownstream = isReversedFlow ? rankDiff < 0 : rankDiff > 0;

  return isDownstream ? 'downstream' : 'upstream';
}

/**
 * Extract layout direction from a boundary's deviceAlignment property.
 *
 * @param alignment - DeviceAlignment value (e.g., 'dagre-tb', 'dagre-lr')
 * @returns DagreDirection or null if not determinable
 */
function alignmentToDirection(alignment: DeviceAlignment | undefined): DagreDirection | null {
  if (!alignment || alignment === 'none') {
    return null;
  }

  // Extract direction from 'dagre-XX' format
  const match = alignment.match(/dagre-(\w+)/i);
  if (match) {
    const dir = match[1].toUpperCase();
    if (dir === 'TB' || dir === 'LR' || dir === 'BT' || dir === 'RL') {
      return dir as DagreDirection;
    }
  }

  return null;
}

/**
 * Get the layout direction from context (boundary node data).
 *
 * @param boundaryId - ID of the boundary containing the nodes
 * @param nodes - All nodes in the diagram
 * @returns DagreDirection or null if not determinable
 */
export function getLayoutDirectionFromContext(
  boundaryId: string | null,
  nodes: AppNode[]
): DagreDirection | null {
  if (!boundaryId) {
    console.log('[Port Router] getLayoutDirectionFromContext: no boundaryId provided');
    return null;
  }

  const boundary = nodes.find(n => n.id === boundaryId);
  if (!boundary || boundary.type !== 'boundary') {
    console.log('[Port Router] getLayoutDirectionFromContext: boundary not found or not a boundary type', boundaryId);
    return null;
  }

  const data = boundary.data as BoundaryNodeData;
  const direction = alignmentToDirection(data.deviceAlignment);
  console.log('[Port Router] getLayoutDirectionFromContext:', {
    boundaryId,
    deviceAlignment: data.deviceAlignment,
    direction,
  });
  return direction;
}

/**
 * Convert PortSide to ReactFlow Position enum.
 */
function sideToPosition(side: PortSide): Position {
  const mapping: Record<PortSide, Position> = {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left,
  };
  return mapping[side];
}

/**
 * Create an empty port loads object.
 */
function createEmptyPortLoads(): PortLoads {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

/**
 * Calculate the offset for an edge at a given index on a port.
 * Offsets are centered around 0.
 *
 * Examples:
 * - 1 edge: 0
 * - 2 edges: -10, +10
 * - 3 edges: -20, 0, +20
 * - 4 edges: -30, -10, +10, +30
 */
function calculateHandleOffset(index: number, total: number): number {
  if (total <= 1) return 0;

  const centerIndex = (total - 1) / 2;
  return (index - centerIndex) * HANDLE_OFFSET_SPACING;
}

/**
 * Assign port sides and handle IDs for an edge.
 */
function assignPort(
  _edge: AppEdge,
  sourceNode: AppNode,
  targetNode: AppNode,
  nodeRanks: Map<string, number>,
  direction: DagreDirection,
  sourcePortLoads: Map<string, PortLoads>,
  targetPortLoads: Map<string, PortLoads>
): {
  sourceSide: PortSide;
  targetSide: PortSide;
  sourceHandleId: string;
  targetHandleId: string;
  handleOffset: number;
} {
  const sourceRank = nodeRanks.get(sourceNode.id) ?? 0;
  const targetRank = nodeRanks.get(targetNode.id) ?? 0;

  const relationship = getNodeRelationship(sourceRank, targetRank, direction);

  let sourceSide: PortSide;
  let targetSide: PortSide;

  switch (relationship) {
    case 'downstream': {
      // Normal flow direction
      const defaults = getDefaultPortSides(direction);
      sourceSide = defaults.source;
      targetSide = defaults.target;
      break;
    }

    case 'upstream': {
      // Reverse flow (feedback loop) - flip the default sides
      const upDefaults = getDefaultPortSides(direction);
      sourceSide = upDefaults.target;  // Use target side as source
      targetSide = upDefaults.source;  // Use source side as target
      break;
    }

    case 'sibling': {
      // Same rank - use perpendicular direction based on relative position
      const isHorizontalSiblings = direction === 'TB' || direction === 'BT';
      if (isHorizontalSiblings) {
        // For TB/BT layouts, siblings are arranged horizontally
        const isTargetToRight = (targetNode.position?.x ?? 0) > (sourceNode.position?.x ?? 0);
        sourceSide = isTargetToRight ? 'right' : 'left';
        targetSide = isTargetToRight ? 'left' : 'right';
      } else {
        // For LR/RL layouts, siblings are arranged vertically
        const isTargetBelow = (targetNode.position?.y ?? 0) > (sourceNode.position?.y ?? 0);
        sourceSide = isTargetBelow ? 'bottom' : 'top';
        targetSide = isTargetBelow ? 'top' : 'bottom';
      }
      break;
    }
  }

  // Get current load counts
  const sourceLoads = sourcePortLoads.get(sourceNode.id) ?? createEmptyPortLoads();
  const targetLoads = targetPortLoads.get(targetNode.id) ?? createEmptyPortLoads();

  const sourceIndex = sourceLoads[sourceSide];
  const targetIndex = targetLoads[targetSide];

  // Update load counts for next edge
  sourceLoads[sourceSide]++;
  targetLoads[targetSide]++;
  sourcePortLoads.set(sourceNode.id, sourceLoads);
  targetPortLoads.set(targetNode.id, targetLoads);

  // Generate handle IDs matching DeviceNode format
  // First handle: '{side}-source' or '{side}-target'
  // Additional handles: '{side}-source-{index}' or '{side}-target-{index}'
  const sourceHandleId = sourceIndex === 0
    ? `${sourceSide}-source`
    : `${sourceSide}-source-${sourceIndex}`;
  const targetHandleId = targetIndex === 0
    ? `${targetSide}-target`
    : `${targetSide}-target-${targetIndex}`;

  // Calculate offset for multiple edges on same port
  // We calculate based on target port since that's where visual overlap is most noticeable
  const handleOffset = calculateHandleOffset(targetIndex, targetLoads[targetSide]);

  return {
    sourceSide,
    targetSide,
    sourceHandleId,
    targetHandleId,
    handleOffset,
  };
}

/**
 * Sort edges by priority for port assignment.
 * Longer edges (greater rank difference) get first choice of ports.
 */
function sortEdgesByPriority(
  edges: AppEdge[],
  nodeRanks: Map<string, number>
): AppEdge[] {
  return [...edges].sort((a, b) => {
    const rankDiffA = Math.abs(
      (nodeRanks.get(a.target) ?? 0) - (nodeRanks.get(a.source) ?? 0)
    );
    const rankDiffB = Math.abs(
      (nodeRanks.get(b.target) ?? 0) - (nodeRanks.get(b.source) ?? 0)
    );
    // Sort descending (longer edges first)
    return rankDiffB - rankDiffA;
  });
}

/**
 * Main entry point: Route all edges based on layout direction.
 *
 * This function replaces calculateSmartHandles() from smart-handles.ts.
 * Instead of using geometric angles, it respects the Dagre layout direction
 * to determine which side of each node edges should connect to.
 *
 * @param nodes - All nodes in the diagram
 * @param edges - All edges to route
 * @param direction - Layout direction (TB, LR, BT, RL) or null for legacy fallback
 * @returns Edges with updated sourceHandle, targetHandle, and handleOffset
 */
export function routeEdges(
  nodes: AppNode[],
  edges: AppEdge[],
  direction: DagreDirection | null
): AppEdge[] {
  console.log('[Port Router] Routing', edges.length, 'edges with direction:', direction);

  // If no direction provided, fall back to legacy angle-based calculation
  if (!direction) {
    console.log('[Port Router] No direction provided, using legacy angle-based fallback');
    return calculateSmartHandles(nodes, edges);
  }

  // Validate inputs - separate valid and invalid edges
  const validNodeIds = new Set(nodes.map(n => n.id));
  const validEdges: AppEdge[] = [];
  const invalidEdges: AppEdge[] = [];

  edges.forEach(edge => {
    if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
      validEdges.push(edge);
    } else {
      invalidEdges.push(edge);
      layoutLogger.warn(
        `[Port Router] Edge ${edge.id} has missing nodes (source: ${edge.source}, target: ${edge.target})`
      );
    }
  });

  if (validEdges.length === 0) {
    return edges; // Nothing to route
  }

  // Build node map for quick lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Calculate node ranks for relationship detection
  const nodeRanks = calculateNodeRanks(nodes, validEdges);

  // Initialize port load tracking
  const sourcePortLoads = new Map<string, PortLoads>();
  const targetPortLoads = new Map<string, PortLoads>();

  // Sort edges by rank difference (longer edges first for better port distribution)
  const sortedEdges = sortEdgesByPriority(validEdges, nodeRanks);

  // Assign ports to each edge
  const routedEdges = sortedEdges.map(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      return edge; // Should not happen after validation
    }

    const assignment = assignPort(
      edge,
      sourceNode,
      targetNode,
      nodeRanks,
      direction,
      sourcePortLoads,
      targetPortLoads
    );

    return {
      ...edge,
      sourceHandle: assignment.sourceHandleId,
      targetHandle: assignment.targetHandleId,
      data: {
        ...edge.data,
        smartHandles: {
          sourcePosition: sideToPosition(assignment.sourceSide),
          targetPosition: sideToPosition(assignment.targetSide),
          calculated: true,
          routerVersion: 2, // Mark as using new port router
        },
        handleOffset: assignment.handleOffset !== 0 ? assignment.handleOffset : undefined,
      },
    };
  });

  // Log detailed routing info for debugging
  routedEdges.forEach(edge => {
    console.log(`[Port Router] Edge ${edge.id}: ${edge.source} → ${edge.target}`, {
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      handleOffset: edge.data?.handleOffset,
    });
  });

  console.log('[Port Router] Routed', routedEdges.length, 'edges successfully');

  // Return all edges: routed valid edges + unchanged invalid edges
  return [...routedEdges, ...invalidEdges];
}
