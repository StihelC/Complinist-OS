/**
 * Hierarchical Channel Routing System
 *
 * Routes edges through boundary "handler" points rather than crossing directly.
 * Edges between devices in different boundaries must route through the handler chain.
 *
 * Routing Rules:
 * 1. Same-boundary: Devices in same boundary connect directly (no channeling)
 * 2. Cross-boundary: Edge routes through handler chain
 * 3. Sibling boundaries: Route through common parent handler
 */

import {
  AppNode,
  AppEdge,
  BoundaryNodeData,
  DeviceNodeData,
} from '@/lib/utils/types';
import { getAbsolutePosition } from '@/lib/utils/utils';

// =============================================================================
// Types
// =============================================================================

export type HandlerSide = 'top' | 'right' | 'bottom' | 'left';

export interface BoundaryHandlerConfig {
  side: HandlerSide;
  position: number;
  visible: boolean;
}

export interface ChannelRoutingInfo {
  isChannelRouted: boolean;
  handlerChain: string[];
  channelNumbers: Map<string, number>;
  commonAncestor: string | null;
  handlerWaypoints: Array<{ x: number; y: number; boundaryId: string }>;
}

export interface ChannelLegendEntry {
  channelNumber: number;
  edgeId: string;
  sourceName: string;
  targetName: string;
}

export interface HandlerLegendData {
  boundaryId: string;
  boundaryName: string;
  channels: ChannelLegendEntry[];
}

export interface HandlerPosition {
  x: number;
  y: number;
  boundaryId: string;
  side: HandlerSide;
}

export interface ChannelRoutingResult {
  routing: ChannelRoutingInfo;
  waypoints: Array<{ x: number; y: number; boundaryId: string }>;
}

// =============================================================================
// Default Handler Configuration
// =============================================================================

export const DEFAULT_HANDLER_CONFIG: BoundaryHandlerConfig = {
  side: 'right',
  position: 50, // 50% along the edge (center)
  visible: true,
};

// =============================================================================
// Boundary Chain Functions
// =============================================================================

/**
 * Get the chain of ancestor boundary IDs for a node (from node up to root)
 * Returns array ordered from immediate parent to root-level boundary
 */
export function getAncestorChain(nodeId: string, nodes: AppNode[]): string[] {
  const chain: string[] = [];
  let current = nodes.find((n) => n.id === nodeId);

  while (current?.parentId) {
    const parent = nodes.find((n) => n.id === current!.parentId);
    if (parent?.type === 'boundary') {
      chain.push(parent.id);
    }
    current = parent;
  }

  return chain;
}

/**
 * Get the boundary that directly contains a node (immediate parent boundary)
 */
export function getContainingBoundary(nodeId: string, nodes: AppNode[]): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  // If the node itself is a boundary, check its parent
  if (node.type === 'boundary') {
    return node.parentId || null;
  }

  // For devices, find their parent boundary
  if (node.parentId) {
    const parent = nodes.find((n) => n.id === node.parentId);
    if (parent?.type === 'boundary') {
      return parent.id;
    }
  }

  return null;
}

/**
 * Find the lowest common ancestor (LCA) boundary of two nodes
 * Returns null if both nodes are at root level (no common boundary)
 */
export function findCommonAncestor(
  sourceId: string,
  targetId: string,
  nodes: AppNode[]
): string | null {
  const sourceChain = getAncestorChain(sourceId, nodes);
  const targetChain = getAncestorChain(targetId, nodes);

  // Include the immediate containing boundary if the nodes are devices
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const targetNode = nodes.find((n) => n.id === targetId);

  // If source is a device inside a boundary, add that boundary to the chain
  if (sourceNode?.type === 'device' && sourceNode.parentId) {
    const parent = nodes.find((n) => n.id === sourceNode.parentId);
    if (parent?.type === 'boundary' && !sourceChain.includes(parent.id)) {
      sourceChain.unshift(parent.id);
    }
  }

  // Same for target
  if (targetNode?.type === 'device' && targetNode.parentId) {
    const parent = nodes.find((n) => n.id === targetNode.parentId);
    if (parent?.type === 'boundary' && !targetChain.includes(parent.id)) {
      targetChain.unshift(parent.id);
    }
  }

  // Find the first common ancestor (LCA)
  for (const ancestorId of sourceChain) {
    if (targetChain.includes(ancestorId)) {
      return ancestorId;
    }
  }

  return null;
}

/**
 * Check if two nodes are in the same boundary (direct siblings)
 */
export function areInSameBoundary(
  sourceId: string,
  targetId: string,
  nodes: AppNode[]
): boolean {
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const targetNode = nodes.find((n) => n.id === targetId);

  if (!sourceNode || !targetNode) return false;

  // Both at root level
  if (!sourceNode.parentId && !targetNode.parentId) {
    return true;
  }

  // Same parent boundary
  return sourceNode.parentId === targetNode.parentId;
}

// =============================================================================
// Handler Chain Building
// =============================================================================

/**
 * Build the handler chain for routing between two nodes
 * Returns ordered list of boundary IDs that the edge must route through
 *
 * Example:
 *   Device A (in Boundary X, inside Boundary Y) → Device B (outside all)
 *   Route: A → X handler → Y handler → B
 *
 * @returns Object with handler chain and common ancestor
 */
export function buildHandlerChain(
  sourceId: string,
  targetId: string,
  nodes: AppNode[]
): {
  chain: string[];
  commonAncestor: string | null;
} {
  // If same boundary, no channel routing needed
  if (areInSameBoundary(sourceId, targetId, nodes)) {
    return { chain: [], commonAncestor: null };
  }

  const sourceChain = getAncestorChain(sourceId, nodes);
  const targetChain = getAncestorChain(targetId, nodes);

  // Include immediate containing boundary for devices
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const targetNode = nodes.find((n) => n.id === targetId);

  if (sourceNode?.type === 'device' && sourceNode.parentId) {
    const parent = nodes.find((n) => n.id === sourceNode.parentId);
    if (parent?.type === 'boundary' && !sourceChain.includes(parent.id)) {
      sourceChain.unshift(parent.id);
    }
  }

  if (targetNode?.type === 'device' && targetNode.parentId) {
    const parent = nodes.find((n) => n.id === targetNode.parentId);
    if (parent?.type === 'boundary' && !targetChain.includes(parent.id)) {
      targetChain.unshift(parent.id);
    }
  }

  // Find common ancestor
  const commonAncestor = findCommonAncestor(sourceId, targetId, nodes);

  // Build the handler chain
  // From source: traverse up to common ancestor (or root)
  // From target: traverse up to common ancestor (or root), then reverse
  const chain: string[] = [];

  // Add source boundaries up to (but not including) common ancestor
  for (const boundaryId of sourceChain) {
    if (boundaryId === commonAncestor) break;
    chain.push(boundaryId);
  }

  // Add common ancestor if it exists and isn't the direct parent of both
  if (commonAncestor) {
    chain.push(commonAncestor);
  }

  // Add target boundaries from common ancestor down (reversed)
  const targetPathDown: string[] = [];
  for (const boundaryId of targetChain) {
    if (boundaryId === commonAncestor) break;
    targetPathDown.unshift(boundaryId); // Reverse order
  }
  chain.push(...targetPathDown);

  return { chain, commonAncestor };
}

// =============================================================================
// Handler Position Calculation
// =============================================================================

/**
 * Get the handler configuration for a boundary, using defaults if not set
 */
export function getHandlerConfig(
  boundaryId: string,
  nodes: AppNode[]
): BoundaryHandlerConfig {
  const boundary = nodes.find((n) => n.id === boundaryId);
  if (!boundary || boundary.type !== 'boundary') {
    return DEFAULT_HANDLER_CONFIG;
  }

  const data = boundary.data as BoundaryNodeData;
  return data.handlerConfig || DEFAULT_HANDLER_CONFIG;
}

/**
 * Calculate the absolute position of a boundary's handler point
 */
export function getHandlerPosition(
  boundaryId: string,
  nodes: AppNode[],
  positionCache?: Map<string, { x: number; y: number }>
): HandlerPosition | null {
  const boundary = nodes.find((n) => n.id === boundaryId);
  if (!boundary || boundary.type !== 'boundary') {
    return null;
  }

  const config = getHandlerConfig(boundaryId, nodes);
  const absPos = getAbsolutePosition(boundaryId, nodes, positionCache);

  // Get boundary dimensions
  const width =
    boundary.measured?.width ||
    boundary.width ||
    (typeof boundary.style?.width === 'number' ? boundary.style.width : 300);
  const height =
    boundary.measured?.height ||
    boundary.height ||
    (typeof boundary.style?.height === 'number' ? boundary.style.height : 200);

  // Calculate handler position based on side and percentage
  let x: number;
  let y: number;

  switch (config.side) {
    case 'top':
      x = absPos.x + (width * config.position) / 100;
      y = absPos.y;
      break;
    case 'bottom':
      x = absPos.x + (width * config.position) / 100;
      y = absPos.y + height;
      break;
    case 'left':
      x = absPos.x;
      y = absPos.y + (height * config.position) / 100;
      break;
    case 'right':
    default:
      x = absPos.x + width;
      y = absPos.y + (height * config.position) / 100;
      break;
  }

  return {
    x,
    y,
    boundaryId,
    side: config.side,
  };
}

// =============================================================================
// Channel Routing Computation
// =============================================================================

/**
 * Compute channel routing for a single edge
 */
export function computeChannelRouting(
  edge: AppEdge,
  nodes: AppNode[],
  positionCache?: Map<string, { x: number; y: number }>
): ChannelRoutingResult | null {
  const { chain, commonAncestor } = buildHandlerChain(edge.source, edge.target, nodes);

  // If no handler chain, this is a direct connection (same boundary)
  if (chain.length === 0) {
    return {
      routing: {
        isChannelRouted: false,
        handlerChain: [],
        channelNumbers: new Map(),
        commonAncestor: null,
        handlerWaypoints: [],
      },
      waypoints: [],
    };
  }

  // Calculate handler waypoints for each boundary in the chain
  const handlerWaypoints: Array<{ x: number; y: number; boundaryId: string }> = [];

  for (const boundaryId of chain) {
    const handlerPos = getHandlerPosition(boundaryId, nodes, positionCache);
    if (handlerPos) {
      handlerWaypoints.push({
        x: handlerPos.x,
        y: handlerPos.y,
        boundaryId: handlerPos.boundaryId,
      });
    }
  }

  return {
    routing: {
      isChannelRouted: true,
      handlerChain: chain,
      channelNumbers: new Map(), // Will be assigned later in batch
      commonAncestor,
      handlerWaypoints,
    },
    waypoints: handlerWaypoints,
  };
}

/**
 * Compute channel routing for all edges (batch operation)
 */
export function computeChannelRoutingForAllEdges(
  nodes: AppNode[],
  edges: AppEdge[]
): Map<string, ChannelRoutingResult> {
  const routingMap = new Map<string, ChannelRoutingResult>();

  if (edges.length === 0 || nodes.length === 0) {
    return routingMap;
  }

  // Pre-compute position cache for efficiency
  const positionCache = new Map<string, { x: number; y: number }>();

  for (const edge of edges) {
    const result = computeChannelRouting(edge, nodes, positionCache);
    if (result) {
      routingMap.set(edge.id, result);
    }
  }

  return routingMap;
}

// =============================================================================
// Channel Number Assignment
// =============================================================================

/**
 * Assign sequential channel numbers to edges at each handler
 * Groups edges by handler and assigns numbers 1, 2, 3, etc.
 *
 * @returns Map from handlerId to Map of edgeId to channel number
 */
export function assignChannelNumbers(
  edges: AppEdge[],
  nodes: AppNode[]
): Map<string, Map<string, number>> {
  const channelMap = new Map<string, Map<string, number>>();

  // First, compute routing for all edges
  const routingMap = computeChannelRoutingForAllEdges(nodes, edges);

  // Group edges by handler
  const edgesByHandler = new Map<string, string[]>();

  for (const edge of edges) {
    const routing = routingMap.get(edge.id);
    if (!routing || !routing.routing.isChannelRouted) continue;

    for (const boundaryId of routing.routing.handlerChain) {
      if (!edgesByHandler.has(boundaryId)) {
        edgesByHandler.set(boundaryId, []);
      }
      edgesByHandler.get(boundaryId)!.push(edge.id);
    }
  }

  // Assign channel numbers for each handler
  for (const [handlerId, edgeIds] of edgesByHandler) {
    const handlerChannels = new Map<string, number>();
    edgeIds.forEach((edgeId, index) => {
      handlerChannels.set(edgeId, index + 1); // 1-indexed
    });
    channelMap.set(handlerId, handlerChannels);
  }

  return channelMap;
}

/**
 * Get channel number for a specific edge at a specific handler
 */
export function getChannelNumber(
  edgeId: string,
  handlerId: string,
  channelMap: Map<string, Map<string, number>>
): number | null {
  const handlerChannels = channelMap.get(handlerId);
  if (!handlerChannels) return null;
  return handlerChannels.get(edgeId) || null;
}

// =============================================================================
// Legend Building
// =============================================================================

/**
 * Build legend data for all handlers showing channel → edge mappings
 */
export function buildHandlerLegends(
  edges: AppEdge[],
  nodes: AppNode[]
): HandlerLegendData[] {
  const legends: HandlerLegendData[] = [];

  // Compute channel assignments
  const channelMap = assignChannelNumbers(edges, nodes);

  // Build legend for each handler
  for (const [handlerId, edgeChannels] of channelMap) {
    const boundary = nodes.find((n) => n.id === handlerId);
    if (!boundary) continue;

    const boundaryData = boundary.data as BoundaryNodeData;
    const channels: ChannelLegendEntry[] = [];

    for (const [edgeId, channelNumber] of edgeChannels) {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) continue;

      // Get source and target names
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      let sourceName = 'Unknown';
      if (sourceNode) {
        const sourceData = sourceNode.data as DeviceNodeData | BoundaryNodeData;
        sourceName = (sourceData as DeviceNodeData).name || (sourceData as BoundaryNodeData).label || 'Unknown';
      }

      let targetName = 'Unknown';
      if (targetNode) {
        const targetData = targetNode.data as DeviceNodeData | BoundaryNodeData;
        targetName = (targetData as DeviceNodeData).name || (targetData as BoundaryNodeData).label || 'Unknown';
      }

      channels.push({
        channelNumber,
        edgeId,
        sourceName,
        targetName,
      });
    }

    // Sort channels by number
    channels.sort((a, b) => a.channelNumber - b.channelNumber);

    legends.push({
      boundaryId: handlerId,
      boundaryName: boundaryData.label,
      channels,
    });
  }

  return legends;
}

// =============================================================================
// Route Path Generation
// =============================================================================

/**
 * Generate waypoints for an edge's channel route, including source and target
 */
export function generateChannelRoutePath(
  edge: AppEdge,
  nodes: AppNode[],
  routingResult: ChannelRoutingResult,
  positionCache?: Map<string, { x: number; y: number }>
): Array<{ x: number; y: number; type: 'source' | 'target' | 'handler' }> {
  const waypoints: Array<{ x: number; y: number; type: 'source' | 'target' | 'handler' }> = [];

  // Get source position
  const sourceNode = nodes.find((n) => n.id === edge.source);
  if (sourceNode) {
    const sourcePos = getAbsolutePosition(edge.source, nodes, positionCache);
    const sourceWidth =
      sourceNode.measured?.width || sourceNode.width || 100;
    const sourceHeight =
      sourceNode.measured?.height || sourceNode.height || 100;
    waypoints.push({
      x: sourcePos.x + sourceWidth / 2,
      y: sourcePos.y + sourceHeight / 2,
      type: 'source',
    });
  }

  // Add handler waypoints
  for (const wp of routingResult.waypoints) {
    waypoints.push({
      x: wp.x,
      y: wp.y,
      type: 'handler',
    });
  }

  // Get target position
  const targetNode = nodes.find((n) => n.id === edge.target);
  if (targetNode) {
    const targetPos = getAbsolutePosition(edge.target, nodes, positionCache);
    const targetWidth =
      targetNode.measured?.width || targetNode.width || 100;
    const targetHeight =
      targetNode.measured?.height || targetNode.height || 100;
    waypoints.push({
      x: targetPos.x + targetWidth / 2,
      y: targetPos.y + targetHeight / 2,
      type: 'target',
    });
  }

  return waypoints;
}

/**
 * Check if channel routing should be used for this edge
 */
export function shouldUseChannelRouting(
  edge: AppEdge,
  nodes: AppNode[],
  edgeRoutingMode: 'channel' | 'direct'
): boolean {
  // If mode is direct, never use channel routing
  if (edgeRoutingMode === 'direct') {
    return false;
  }

  // If same boundary, no channel routing needed
  return !areInSameBoundary(edge.source, edge.target, nodes);
}

// =============================================================================
// Channel Route SVG Path Generation
// =============================================================================

/**
 * Generate a clean orthogonal SVG path for channel routing
 * Creates proper right-angle routing through handler waypoints
 *
 * @param waypoints - Array of waypoints including source, handlers, and target
 * @param edgeIndex - Index of this edge among edges through same handlers (for offset)
 * @param totalEdges - Total edges through same handler (for offset calculation)
 * @returns [pathString, labelX, labelY]
 */
export function generateChannelRouteSVGPath(
  waypoints: Array<{ x: number; y: number; type: 'source' | 'target' | 'handler' }>,
  edgeIndex: number = 0,
  totalEdges: number = 1
): [string, number, number] {
  if (waypoints.length < 2) {
    return ['', 0, 0];
  }

  // Calculate offset for edge bundling at handlers
  const bundleSpacing = 8; // pixels between bundled edges
  const bundleOffset = (edgeIndex - (totalEdges - 1) / 2) * bundleSpacing;

  const pathParts: string[] = [];
  const first = waypoints[0];
  pathParts.push(`M ${first.x} ${first.y}`);

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    // Apply offset at handler points for bundling
    let targetX = curr.x;
    let targetY = curr.y;

    if (curr.type === 'handler') {
      // Determine offset direction based on path direction
      const isVerticalApproach = Math.abs(curr.x - prev.x) < Math.abs(curr.y - prev.y);
      if (isVerticalApproach) {
        targetX += bundleOffset;
      } else {
        targetY += bundleOffset;
      }
    }

    // Create orthogonal path segment
    const dx = targetX - prev.x;
    const dy = targetY - prev.y;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      // Points are the same, skip
      continue;
    }

    if (Math.abs(dx) < 1) {
      // Nearly vertical - just draw vertical line
      pathParts.push(`L ${targetX} ${targetY}`);
    } else if (Math.abs(dy) < 1) {
      // Nearly horizontal - just draw horizontal line
      pathParts.push(`L ${targetX} ${targetY}`);
    } else {
      // Need orthogonal corner - choose direction based on context
      // For handler points, approach from the direction that makes sense
      if (curr.type === 'handler') {
        // At handlers, prefer horizontal approach then vertical exit
        // This creates cleaner convergence at handler points
        if (next && next.type === 'target') {
          // Going to target - go vertical first to align, then horizontal
          pathParts.push(`L ${prev.x} ${targetY}`);
          pathParts.push(`L ${targetX} ${targetY}`);
        } else {
          // Coming from source or another handler - go horizontal first
          pathParts.push(`L ${targetX} ${prev.y}`);
          pathParts.push(`L ${targetX} ${targetY}`);
        }
      } else if (curr.type === 'target') {
        // Approaching target - create clean entry
        // Go horizontal to align X, then vertical to target
        const midY = prev.y;
        pathParts.push(`L ${targetX} ${midY}`);
        pathParts.push(`L ${targetX} ${targetY}`);
      } else {
        // From source - go horizontal first
        pathParts.push(`L ${targetX} ${prev.y}`);
        pathParts.push(`L ${targetX} ${targetY}`);
      }
    }
  }

  const path = pathParts.join(' ');

  // Calculate label position at midpoint
  const midIndex = Math.floor(waypoints.length / 2);
  const midWp = waypoints[midIndex];
  const prevWp = waypoints[Math.max(0, midIndex - 1)];
  const labelX = (midWp.x + prevWp.x) / 2;
  const labelY = (midWp.y + prevWp.y) / 2;

  return [path, labelX, labelY];
}
