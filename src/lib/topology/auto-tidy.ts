/**
 * Auto-Tidy Algorithm for One-Click Diagram Organization
 *
 * This module provides functionality to automatically organize topology diagrams
 * using intelligent spacing, optimal layout algorithms, and smooth animations.
 *
 * Enhanced with edge optimization features:
 * - Edge label collision detection and avoidance
 * - Dynamic edge separation based on label density
 * - Edge routing quality metrics and feedback
 */

import { AppNode, AppEdge, DeviceAlignment, BoundaryNodeData } from '@/lib/utils/types';
import { applyDagreLayout } from '@/lib/layout/dagreLayout';
import { applyElkLayout } from '@/lib/layout/elkLayout';
import {
  LayoutAlgorithm,
  LayoutDirection,
  LayoutOptions as UnifiedLayoutOptions,
  ElkAlgorithmVariant,
} from '@/lib/layout/layoutInterface';
import {
  LAYOUT_CONSTANTS,
  calculateAdaptiveSpacing,
  getAverageNodeDimensions,
} from '@/lib/layout/layoutConfig';
import { detectGraphTopology, analyzeFlowDirection } from '@/lib/topology/flowAnalysis';
import {
  selectOptimalRanker,
  DEFAULT_EDGE_LABEL_CONFIG,
  DagreRanker,
} from './dagre-config';
import {
  resolveEdgeLabelCollisions,
  LabelCollisionResult,
  EdgeLabelPosition,
} from './edge-label-collision';
import {
  calculateEdgeRoutingQuality,
  EdgeRoutingQualityResult,
  meetsQualityThreshold,
} from './edge-routing-quality';
import {
  getBoundaryZIndex,
  getDeviceZIndex,
  getEdgeZIndex,
  ZIndexConfig,
} from '@/lib/utils/zIndexLayers';
import { layoutLogger } from './layoutLogger';
import potpack from 'potpack';

// =============================================================================
// Types
// =============================================================================

/**
 * Spacing tier options for auto-tidy
 */
export type SpacingTier = 'compact' | 'comfortable' | 'spacious';

/**
 * Edge routing type for visual appearance
 * - smart: Pathfinding-based routing that avoids nodes (recommended)
 * - smoothstep: Orthogonal routing with rounded corners
 * - step: Sharp 90° angle connections
 * - straight: Direct straight lines
 * - default: Bezier curves
 */
export type EdgeRoutingType = 'smart' | 'smartSmoothStep' | 'default' | 'straight' | 'smoothstep' | 'step';

/**
 * Dagre ranker algorithm type (re-exported from dagre-config)
 */
export type { DagreRanker } from './dagre-config';

/**
 * Edge optimization options for tidy operation
 */
export interface EdgeOptimizationOptions {
  /** Enable edge label collision avoidance */
  edgeLabelCollisionAvoidance: boolean;
  /** Ranker algorithm selection */
  rankerAlgorithm: DagreRanker | 'auto';
  /** Minimum edge separation with labels (px) */
  minEdgeSeparationWithLabels: number;
  /** Label rotation to match edge angle */
  labelRotation: boolean;
  /** Calculate and report quality metrics */
  calculateQualityMetrics: boolean;
  /** Edge routing type to apply during tidy */
  edgeRoutingType?: EdgeRoutingType;
  /** Minimize connection overlaps by using increased spacing */
  minimizeOverlaps: boolean;
}

/**
 * Re-export layout types for convenience
 */
export type { LayoutAlgorithm, LayoutDirection } from '@/lib/layout/layoutInterface';

/**
 * Configuration options for the tidy operation
 */
export interface TidyOptions {
  /** Layout algorithm to use (default: 'elkjs') */
  layoutAlgorithm?: LayoutAlgorithm;
  /** ELK algorithm variant: 'layered' (default) or 'mrtree' */
  elkAlgorithm?: ElkAlgorithmVariant;
  /** Layout direction (used with elkjs, overrides spacingTier direction) */
  layoutDirection?: LayoutDirection;
  /** Horizontal spacing (used with elkjs) */
  horizontalSpacing?: number;
  /** Vertical spacing (used with elkjs) */
  verticalSpacing?: number;
  /** Space between sibling nodes at the same level */
  nodeSpacing?: number;
  /** Space between hierarchy levels (ranks) */
  rankSpacing?: number;
  /** Padding inside boundaries */
  boundaryPadding?: number;
  /** Extra spacing for nested boundaries */
  nestedBoundarySpacing?: number;
  /** Spacing density preference (used with dagre) */
  spacingTier: SpacingTier;
  /** Whether to automatically resize boundaries to fit their children */
  autoResize: boolean;
  /** Whether to animate the transition */
  animate: boolean;
  /** Animation duration in milliseconds (default: 300) */
  animationDuration?: number;
  /** Global device image size percentage for spacing calculations */
  globalDeviceImageSize?: number;
  /** Global boundary label size for layout calculations */
  globalBoundaryLabelSize?: number;
  /** IDs of nodes to exclude from layout (e.g., locked nodes) */
  lockedNodeIds?: string[];
  /** Edge optimization settings */
  edgeOptimization?: Partial<EdgeOptimizationOptions>;
  /** Viewport dimensions for fitting layout to visible area */
  viewportDimensions?: { width: number; height: number; zoom: number };
  /** Whether to optimize device appearance during tidy (expand icons) */
  optimizeDeviceSize?: boolean;
  /** Target device icon size percentage when optimizing (default: 90) */
  targetDeviceIconSize?: number;
  /** Number of tidy passes for nested boundaries (default: auto-calculated based on depth) */
  tidyPasses?: number;
  /** Override automatic pass calculation with fixed number */
  fixedPasses?: boolean;
  /** Z-Index layering configuration (uses fixed layering: devices > edges > boundaries) */
  layeringConfig?: ZIndexConfig;
}

/**
 * Result of a tidy operation, including animation data if applicable
 */
export interface TidyResult {
  /** The updated nodes with new positions */
  nodes: AppNode[];
  /** The updated edges with optimized routing (if edge routing type was applied) */
  edges?: AppEdge[];
  /** Original positions for animation (if animate is true) */
  originalPositions?: Map<string, { x: number; y: number }>;
  /** Target positions for animation (if animate is true) */
  targetPositions?: Map<string, { x: number; y: number }>;
  /** Statistics about the operation */
  stats: TidyStats;
}

/**
 * Statistics from a tidy operation
 */
export interface TidyStats {
  /** Total nodes processed */
  totalNodes: number;
  /** Number of boundaries processed */
  boundariesProcessed: number;
  /** Number of devices repositioned */
  devicesRepositioned: number;
  /** Time taken in milliseconds */
  processingTimeMs: number;
  /** Edge quality metrics (if edge optimization enabled) */
  edgeQuality?: EdgeRoutingQualityResult;
  /** Label collision resolution result */
  labelCollisions?: LabelCollisionResult;
  /** Resolved label positions for rendering */
  resolvedLabelPositions?: EdgeLabelPosition[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Spacing multipliers for each tier
 */
const SPACING_MULTIPLIERS: Record<SpacingTier, number> = {
  compact: 0.7,
  comfortable: 1.0,
  spacious: 1.5,
};

/**
 * Default edge optimization options
 */
export const DEFAULT_EDGE_OPTIMIZATION_OPTIONS: EdgeOptimizationOptions = {
  edgeLabelCollisionAvoidance: true,
  rankerAlgorithm: 'auto',
  minEdgeSeparationWithLabels: 10,
  labelRotation: false,
  calculateQualityMetrics: true,
  edgeRoutingType: 'smart',
  minimizeOverlaps: false,
};

/**
 * Default tidy options
 */
export const DEFAULT_TIDY_OPTIONS: TidyOptions = {
  layoutAlgorithm: 'elkjs', // Default to ELK for better nested boundary handling
  elkAlgorithm: 'mrtree', // Default to Mr. Tree for compact tree layouts
  layoutDirection: 'RIGHT',
  horizontalSpacing: 50,
  verticalSpacing: 50,
  nodeSpacing: 40,
  rankSpacing: 60,
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  spacingTier: 'comfortable',
  autoResize: true,
  animate: true,
  animationDuration: 300,
  globalDeviceImageSize: 55,
  globalBoundaryLabelSize: 14,
  lockedNodeIds: [],
  edgeOptimization: DEFAULT_EDGE_OPTIMIZATION_OPTIONS,
  optimizeDeviceSize: true,
  targetDeviceIconSize: 90,
  tidyPasses: undefined, // Auto-calculate based on depth (dagre only)
  fixedPasses: false,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the depth of a node in the boundary hierarchy
 * Root nodes (no parent) have depth 0, their children have depth 1, etc.
 */
function getNodeDepth(nodeId: string, nodes: AppNode[]): number {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || !node.parentId) return 0;
  return 1 + getNodeDepth(node.parentId, nodes);
}

/**
 * Calculate the maximum depth of the boundary hierarchy
 * This is used to determine the optimal number of tidy passes needed
 */
function getMaxBoundaryDepth(nodes: AppNode[]): number {
  const boundaries = nodes.filter(n => n.type === 'boundary');
  if (boundaries.length === 0) return 0;

  let maxDepth = 0;
  for (const boundary of boundaries) {
    const depth = getNodeDepth(boundary.id, nodes);
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

/**
 * Sort boundaries by depth (innermost first) for processing order
 * This ensures child boundaries are laid out before their parents
 */
function sortBoundariesByDepth(boundaries: AppNode[], allNodes: AppNode[]): AppNode[] {
  return [...boundaries].sort((a, b) => {
    const depthA = getNodeDepth(a.id, allNodes);
    const depthB = getNodeDepth(b.id, allNodes);
    return depthB - depthA; // Higher depth (more nested) first
  });
}

/**
 * Calculate adjusted spacing based on tier
 */
function getAdjustedSpacing(
  baseSpacing: { nodesep: number; ranksep: number; edgesep: number },
  tier: SpacingTier
): { nodesep: number; ranksep: number; edgesep: number } {
  const multiplier = SPACING_MULTIPLIERS[tier];
  return {
    nodesep: Math.round(baseSpacing.nodesep * multiplier),
    ranksep: Math.round(baseSpacing.ranksep * multiplier),
    edgesep: Math.round(baseSpacing.edgesep * multiplier),
  };
}

/**
 * Determine the optimal layout direction for a boundary based on its children
 */
function getOptimalLayoutDirection(
  boundary: AppNode,
  childNodes: AppNode[],
  edges: AppEdge[]
): DeviceAlignment {
  if (childNodes.length === 0) return 'dagre-tb';

  const flowDirection = analyzeFlowDirection(childNodes, edges);
  const topology = detectGraphTopology(childNodes, edges);

  // For hierarchical graphs, use top-to-bottom
  if (topology === 'hierarchical') {
    return flowDirection === 'RIGHT' ? 'dagre-lr' : 'dagre-tb';
  }

  // For networked/mesh graphs, prefer the current alignment or default to TB
  const currentAlignment = (boundary.data as BoundaryNodeData)?.deviceAlignment;
  if (currentAlignment && currentAlignment !== 'none') {
    return currentAlignment;
  }

  return flowDirection === 'RIGHT' ? 'dagre-lr' : 'dagre-tb';
}

/**
 * Normalize child node positions to start at (padding, padding) relative to the boundary.
 * This ensures children are positioned consistently after Dagre layout, which may position
 * them with arbitrary offsets due to margins and centering.
 * 
 * @param childNodes - Array of child nodes to normalize
 * @param padding - Padding value to use as the starting position (typically BOUNDARY_PADDING * multiplier)
 * @returns Array of nodes with normalized positions
 */
function normalizeChildPositions(
  childNodes: AppNode[],
  padding: number
): AppNode[] {
  if (childNodes.length === 0) return childNodes;
  
  // Find the minimum x and y positions
  let minX = Infinity;
  let minY = Infinity;
  
  for (const child of childNodes) {
    minX = Math.min(minX, child.position.x);
    minY = Math.min(minY, child.position.y);
  }
  
  // Calculate offset to move all children so the top-left starts at (padding, padding)
  const offsetX = padding - minX;
  const offsetY = padding - minY;
  
  // Apply offset to all children
  return childNodes.map(child => ({
    ...child,
    position: {
      x: child.position.x + offsetX,
      y: child.position.y + offsetY,
    },
  }));
}

/**
 * Calculate the bounding box of child nodes within a boundary
 */
function calculateChildBounds(
  childNodes: AppNode[]
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (childNodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of childNodes) {
    const x = node.position.x;
    const y = node.position.y;

    // Get dimensions - check all possible sources (measured, direct, style, defaults)
    // This is critical for nested boundaries that have been resized
    const styleWidth = typeof node.style?.width === 'number' ? node.style.width : undefined;
    const styleHeight = typeof node.style?.height === 'number' ? node.style.height : undefined;

    const width = node.measured?.width || node.width || styleWidth ||
      (node.type === 'boundary' ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
    const height = node.measured?.height || node.height || styleHeight ||
      (node.type === 'boundary' ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

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
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Resize a boundary to fit its children with padding
 * Uses actual content bounds (minX, minY, maxX, maxY) to ensure boundaries
 * are resized to fit all content, including the very bottom-most position.
 * Also accounts for the boundary's own label box (if label is placed at bottom outside)
 */
function resizeBoundaryToFit(
  boundary: AppNode,
  childNodes: AppNode[],
  tier: SpacingTier,
  _globalBoundaryLabelSize?: number,
  _allNodes?: AppNode[],
  baseBoundaryPadding?: number,
  nestedBoundarySpacing?: number
): AppNode {
  if (childNodes.length === 0) return boundary;

  const bounds = calculateChildBounds(childNodes);
  const paddingMultiplier = SPACING_MULTIPLIERS[tier];

  // Check if this boundary contains nested boundaries
  const hasNestedBoundaries = childNodes.some(n => n.type === 'boundary');

  // Use user-configured boundary padding
  const basePadding = (baseBoundaryPadding ?? LAYOUT_CONSTANTS.BOUNDARY_PADDING) * paddingMultiplier;

  // Add extra spacing for nested boundaries (accounts for child boundary labels)
  const nestedExtra = hasNestedBoundaries ? (nestedBoundarySpacing ?? 30) : 0;

  const padding = basePadding + nestedExtra;

  // Calculate required size to contain all children
  // Add padding to the right and bottom edges
  let newWidth = Math.max(
    LAYOUT_CONSTANTS.BOUNDARY_MIN_WIDTH,
    bounds.maxX + padding
  );
  let newHeight = Math.max(
    LAYOUT_CONSTANTS.BOUNDARY_MIN_HEIGHT,
    bounds.maxY + padding
  );

  return {
    ...boundary,
    style: {
      ...boundary.style,
      width: newWidth,
      height: newHeight,
    },
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Get node dimensions using the same pattern as collision detection
 */
function getNodeSize(node: AppNode): { width: number; height: number } {
  // Check for measured dimensions (from React Flow after rendering)
  if (node.measured?.width && node.measured?.height) {
    return { width: node.measured.width, height: node.measured.height };
  }

  // Check for explicit dimensions
  if (node.width && node.height) {
    return { width: node.width, height: node.height };
  }

  // Check style dimensions
  const styleWidth = typeof node.style?.width === 'number' ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === 'number' ? node.style.height : undefined;
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

// =============================================================================
// Potpack Integration for Bin Packing
// =============================================================================

/**
 * Box type for potpack - includes node reference and dimensions
 */
interface PackBox {
  w: number;
  h: number;
  x?: number;
  y?: number;
  node?: AppNode;
  nodes?: AppNode[];  // For component groups
}

/**
 * Build connection map from edges for a set of nodes
 */
function buildConnectionMap(
  nodes: AppNode[],
  edges: AppEdge[]
): Map<string, Set<string>> {
  const nodeIds = new Set(nodes.map(n => n.id));
  const connections = new Map<string, Set<string>>();

  for (const node of nodes) {
    connections.set(node.id, new Set());
  }

  for (const edge of edges) {
    const sourceInSet = nodeIds.has(edge.source);
    const targetInSet = nodeIds.has(edge.target);

    if (sourceInSet && targetInSet) {
      connections.get(edge.source)?.add(edge.target);
      connections.get(edge.target)?.add(edge.source);
    }
  }

  return connections;
}

/**
 * Find connected components using Union-Find algorithm
 */
function findConnectedComponents(
  nodes: AppNode[],
  connections: Map<string, Set<string>>
): AppNode[][] {
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const node of nodes) {
    parent.set(node.id, node.id);
    rank.set(node.id, 0);
  }

  function find(x: string): string {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(x: string, y: string): void {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX === rootY) return;

    const rankX = rank.get(rootX)!;
    const rankY = rank.get(rootY)!;

    if (rankX < rankY) {
      parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      parent.set(rootY, rootX);
    } else {
      parent.set(rootY, rootX);
      rank.set(rootX, rankX + 1);
    }
  }

  for (const node of nodes) {
    const nodeConnections = connections.get(node.id) || new Set();
    for (const connectedId of nodeConnections) {
      if (parent.has(connectedId)) {
        union(node.id, connectedId);
      }
    }
  }

  const groups = new Map<string, AppNode[]>();
  for (const node of nodes) {
    const root = find(node.id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(node);
  }

  return Array.from(groups.values());
}

/**
 * Layout a connected group using potpack for internal arrangement
 * Places nodes in a compact arrangement while keeping connected nodes together
 */
function layoutConnectedGroup(
  nodes: AppNode[],
  connections: Map<string, Set<string>>,
  gap: number
): { nodes: AppNode[]; width: number; height: number } {
  if (nodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }

  if (nodes.length === 1) {
    const size = getNodeSize(nodes[0]);
    return {
      nodes: [{ ...nodes[0], position: { x: 0, y: 0 } }],
      width: size.width,
      height: size.height
    };
  }

  // Sort by connection count (most connected first for better layout)
  const sortedNodes = [...nodes].sort((a, b) => {
    const connA = connections.get(a.id)?.size || 0;
    const connB = connections.get(b.id)?.size || 0;
    return connB - connA;
  });

  // Create boxes for potpack (add gap to dimensions for spacing)
  const boxes: PackBox[] = sortedNodes.map(node => {
    const size = getNodeSize(node);
    return {
      w: size.width + gap,
      h: size.height + gap,
      node
    };
  });

  // Run potpack
  const { w: totalWidth, h: totalHeight } = potpack(boxes);

  // Extract positioned nodes (subtract gap from position to account for spacing)
  const positionedNodes = boxes.map(box => ({
    ...box.node!,
    position: {
      x: box.x || 0,
      y: box.y || 0
    }
  }));

  return {
    nodes: positionedNodes,
    width: totalWidth,
    height: totalHeight
  };
}

/**
 * Edge-aware bin packing using potpack
 * 1. Groups connected nodes together
 * 2. Lays out each group compactly
 * 3. Packs groups together using potpack
 */
function arrangeWithEdgeAwarePacking(
  nodes: AppNode[],
  edges: AppEdge[],
  startX: number,
  startY: number,
  gap: number
): AppNode[] {
  if (nodes.length === 0) return nodes;

  layoutLogger.debug(`[Potpack] Arranging ${nodes.length} nodes with edge awareness`);

  // Build connection map and find components
  const connections = buildConnectionMap(nodes, edges);
  const components = findConnectedComponents(nodes, connections);

  layoutLogger.debug(`[Potpack] Found ${components.length} connected components`);

  // Layout each component
  const componentLayouts = components.map(component =>
    layoutConnectedGroup(component, connections, gap)
  );

  // Create boxes for potpack from component bounding boxes
  const componentBoxes: PackBox[] = componentLayouts.map(layout => ({
    w: layout.width + gap,
    h: layout.height + gap,
    nodes: layout.nodes
  }));

  // Pack components together
  potpack(componentBoxes);

  // Collect all nodes with final positions
  const result: AppNode[] = [];
  for (const box of componentBoxes) {
    const offsetX = (box.x || 0) + startX;
    const offsetY = (box.y || 0) + startY;

    for (const node of box.nodes || []) {
      result.push({
        ...node,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        }
      });
    }
  }

  layoutLogger.debug(`[Potpack] Positioned ${result.length} nodes in ${components.length} groups`);

  return result;
}

/**
 * Simple bin packing for nodes without edge awareness
 * Uses potpack for efficient Tetris-like arrangement
 */
function arrangeWithBinPacking(
  nodes: AppNode[],
  startX: number,
  startY: number,
  gap: number
): AppNode[] {
  if (nodes.length === 0) return nodes;

  // Create boxes for potpack
  const boxes: PackBox[] = nodes.map(node => {
    const size = getNodeSize(node);
    return {
      w: size.width + gap,
      h: size.height + gap,
      node
    };
  });

  // Sort by height (tallest first) for better packing
  boxes.sort((a, b) => b.h - a.h);

  // Run potpack
  potpack(boxes);

  // Extract positioned nodes
  return boxes.map(box => ({
    ...box.node!,
    position: {
      x: (box.x || 0) + startX,
      y: (box.y || 0) + startY
    }
  }));
}

/**
 * Position boundaries to avoid overlaps at the root level
 */
function positionRootBoundaries(
  boundaries: AppNode[],
  tier: SpacingTier
): AppNode[] {
  if (boundaries.length === 0) return boundaries;

  const spacingMultiplier = SPACING_MULTIPLIERS[tier];
  const gap = 30 * spacingMultiplier;

  // Get root boundaries (no parent)
  const rootBoundaries = boundaries.filter(b => !b.parentId);
  if (rootBoundaries.length <= 1) return boundaries;

  // Use bin packing layout for root boundaries
  // Root boundaries don't have direct edges, so use regular bin packing
  const updatedBoundaries = [...boundaries];
  const gridPositioned = arrangeWithBinPacking(rootBoundaries, 50, 50, gap);

  // Update positions in the main array
  for (const positionedBoundary of gridPositioned) {
    const index = updatedBoundaries.findIndex(b => b.id === positionedBoundary.id);
    if (index !== -1) {
      updatedBoundaries[index] = positionedBoundary;
    }
  }

  return updatedBoundaries;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Tidy the entire diagram by organizing nodes using intelligent layout algorithms.
 *
 * Supports two layout algorithms:
 * - ELKjs (default): Single-pass hierarchical layout with native compound node support
 * - Dagre: Multi-pass layout for backwards compatibility
 *
 * @param nodes - Current node array
 * @param edges - Current edge array
 * @param options - Tidy configuration options
 * @returns Promise resolving to TidyResult with updated nodes and stats
 */
export async function tidyDiagram(
  nodes: AppNode[],
  edges: AppEdge[],
  options: Partial<TidyOptions> = {}
): Promise<TidyResult> {
  const startTime = performance.now();
  const opts: TidyOptions = { ...DEFAULT_TIDY_OPTIONS, ...options };

  const algorithm = opts.layoutAlgorithm || 'elkjs';
  layoutLogger.debug(`[AutoTidy] Layout engine: ${algorithm.toUpperCase()}`);

  let finalResult: TidyResult | null = null;

  // Choose layout strategy based on algorithm
  if (algorithm === 'elkjs') {
    // ELKjs: Single-pass hierarchical layout
    // ELK natively handles compound nodes via hierarchyHandling: INCLUDE_CHILDREN
    finalResult = await tidyDiagramWithElk(nodes, edges, opts);
  } else {
    // Dagre: Multi-pass layout (existing behavior)
    // Auto-calculate optimal number of passes based on boundary hierarchy depth
    let numPasses: number;
    if (opts.fixedPasses && opts.tidyPasses !== undefined) {
      numPasses = opts.tidyPasses;
    } else {
      const maxDepth = getMaxBoundaryDepth(nodes);
      numPasses = Math.max(2, Math.min(10, maxDepth + 1));
      if (opts.tidyPasses !== undefined && opts.tidyPasses > numPasses) {
        numPasses = opts.tidyPasses;
      }
    }

    layoutLogger.debug(`[AutoTidy] Detected max boundary depth: ${getMaxBoundaryDepth(nodes)}, using ${numPasses} passes`);

    let currentNodes = nodes;
    let currentEdges = edges;

    for (let pass = 0; pass < numPasses; pass++) {
      layoutLogger.debug(`[AutoTidy] Running pass ${pass + 1} of ${numPasses}`);
      const result = await tidyDiagramSinglePass(currentNodes, currentEdges, opts);
      currentNodes = result.nodes;
      if (result.edges) {
        currentEdges = result.edges;
      }
      finalResult = result;
    }
  }
  
  // Optimize device icon sizes if requested (after all passes)
  if (opts.optimizeDeviceSize && finalResult) {
    finalResult.nodes = finalResult.nodes.map(node => {
      if (node.type === 'device') {
        // Get current device dimensions
        const nodeWidth = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
        const nodeHeight = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
        
        // Make devices square by using the larger dimension
        // This ensures icons have equal space in both directions
        const squareSize = Math.max(nodeWidth, nodeHeight);
        
        // Set icon size to 90% to fill the icon area nicely
        // Since devices are now square, icons will be properly sized
        const optimalIconSize = 90;
        
        layoutLogger.debug(`[AutoTidy] Device ${node.id}: ${nodeWidth}x${nodeHeight} → ${squareSize}x${squareSize} (square), icon ${optimalIconSize}%`);
        
        return {
          ...node,
          width: squareSize,
          height: squareSize,
          data: {
            ...node.data,
            deviceImageSize: optimalIconSize,
          },
        };
      }
      return node;
    });
  }
  
  // Apply edge routing type if specified (merge with existing edge z-index)
  const edgeRoutingType = opts.edgeOptimization?.edgeRoutingType;

  if (edgeRoutingType && finalResult && finalResult.edges) {
    layoutLogger.debug(`[AutoTidy] Applying edge routing type: ${edgeRoutingType}`);
    finalResult.edges = finalResult.edges.map(edge => ({
      ...edge,
      // Set edge.type for React Flow component selection
      // 'smart' -> SmartCustomEdge, all others -> FloatingCustomEdge
      type: edgeRoutingType,
      data: {
        ...edge.data,
        edgeType: edgeRoutingType,
      },
    }));
  }

  // Update final processing time
  if (finalResult) {
    finalResult.stats.processingTimeMs = performance.now() - startTime;
    // Log summary in browser, full details in terminal
    layoutLogger.info('[AutoTidy] Complete:', {
      algorithm,
      nodeCount: finalResult.nodes.length,
      boundaryCount: finalResult.nodes.filter(n => n.type === 'boundary').length,
      processingTimeMs: finalResult.stats.processingTimeMs,
      stats: finalResult.stats
    });
  }

  return finalResult!;
}

/**
 * Tidy diagram using ELKjs layout engine.
 * ELK handles nested boundaries in a single pass via INCLUDE_CHILDREN.
 */
async function tidyDiagramWithElk(
  nodes: AppNode[],
  edges: AppEdge[],
  opts: TidyOptions
): Promise<TidyResult> {
  const startTime = performance.now();

  // Store original positions for animation
  const originalPositions = new Map<string, { x: number; y: number }>();
  if (opts.animate) {
    for (const node of nodes) {
      originalPositions.set(node.id, { ...node.position });
    }
  }

  // Build ELK layout options - pass through all relevant settings
  const elkOptions: UnifiedLayoutOptions = {
    algorithm: 'elkjs',
    elkAlgorithm: opts.elkAlgorithm || 'mrtree',
    direction: opts.layoutDirection || 'RIGHT',
    horizontalSpacing: opts.horizontalSpacing || 50,
    verticalSpacing: opts.verticalSpacing || 50,
    nodeSpacing: opts.nodeSpacing || 40,
    rankSpacing: opts.rankSpacing || 60,
    boundaryPadding: opts.boundaryPadding,
    nestedBoundarySpacing: opts.nestedBoundarySpacing,
    animate: opts.animate,
    animationDuration: opts.animationDuration,
    autoResize: opts.autoResize,
  };

  layoutLogger.debug('[ELK Layout Options]', {
    boundaryPadding: elkOptions.boundaryPadding,
    nestedBoundarySpacing: elkOptions.nestedBoundarySpacing,
    nodeSpacing: elkOptions.nodeSpacing,
  });

  // Run ELK layout
  const elkResult = await applyElkLayout(nodes, edges, elkOptions);

  let updatedNodes = elkResult.nodes;
  let updatedEdges = elkResult.edges || edges;

  // Optimize device icon sizes if requested
  if (opts.optimizeDeviceSize) {
    updatedNodes = updatedNodes.map(node => {
      if (node.type === 'device') {
        const nodeWidth = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
        const nodeHeight = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
        const squareSize = Math.max(nodeWidth, nodeHeight);
        const optimalIconSize = opts.targetDeviceIconSize || 90;

        return {
          ...node,
          width: squareSize,
          height: squareSize,
          data: {
            ...node.data,
            deviceImageSize: optimalIconSize,
          },
        };
      }
      return node;
    });
  }

  // Apply edge routing type if specified
  const edgeRoutingType = opts.edgeOptimization?.edgeRoutingType;
  if (edgeRoutingType) {
    updatedEdges = updatedEdges.map(edge => ({
      ...edge,
      // Set edge.type for React Flow component selection
      // 'smart' -> SmartCustomEdge, all others -> FloatingCustomEdge
      type: edgeRoutingType,
      data: {
        ...edge.data,
        edgeType: edgeRoutingType,
      },
    }));
  }

  // Apply z-index layering (fixed: devices > edges > boundaries)
  updatedNodes = updatedNodes.map(node => {
    let zIndex: number;
    if (node.type === 'boundary') {
      const nestingDepth = getNodeDepth(node.id, updatedNodes);
      zIndex = getBoundaryZIndex(nestingDepth);
    } else {
      zIndex = getDeviceZIndex(false);
    }
    return { ...node, zIndex };
  });

  updatedEdges = updatedEdges.map(edge => ({
    ...edge,
    zIndex: getEdgeZIndex(false),
  }));

  // Prepare target positions for animation
  const targetPositions = new Map<string, { x: number; y: number }>();
  if (opts.animate) {
    for (const node of updatedNodes) {
      targetPositions.set(node.id, { ...node.position });
    }
  }

  const endTime = performance.now();

  return {
    nodes: updatedNodes,
    edges: updatedEdges,
    originalPositions: opts.animate ? originalPositions : undefined,
    targetPositions: opts.animate ? targetPositions : undefined,
    stats: {
      totalNodes: nodes.length,
      boundariesProcessed: elkResult.stats.boundariesProcessed,
      devicesRepositioned: elkResult.stats.devicesRepositioned,
      processingTimeMs: Math.round(endTime - startTime),
    },
  };
}

/**
 * Single pass of the tidy algorithm.
 *
 * Algorithm flow:
 * 1. Identify all boundaries and group nodes by boundary membership
 * 2. Sort boundaries by depth (innermost first) for bottom-up processing
 * 3. For each boundary (deepest first):
 *    a. Apply Dagre layout to its direct children
 *    b. Immediately resize boundary to fit children (if autoResize enabled)
 *    This ensures parent boundaries see correct child sizes when processed
 * 4. Position root boundaries to avoid overlaps
 * 5. Apply edge optimization (collision detection, quality metrics)
 * 6. If animate is enabled, prepare animation data
 *
 * Note: Multiple passes are needed for deeply nested hierarchies because:
 * - Pass 1: Lays out innermost boundaries
 * - Pass 2: Lays out their parents (now with correct child sizes)
 * - Pass N: Propagates changes up to root level
 * The number of passes should equal max_depth + 1 for optimal results.
 *
 * @param nodes - Current node array
 * @param edges - Current edge array
 * @param opts - Tidy configuration options (already merged with defaults)
 * @returns Promise resolving to TidyResult with updated nodes and stats
 */
async function tidyDiagramSinglePass(
  nodes: AppNode[],
  edges: AppEdge[],
  opts: TidyOptions
): Promise<TidyResult> {
  const startTime = performance.now();
  const edgeOpts: EdgeOptimizationOptions = {
    ...DEFAULT_EDGE_OPTIMIZATION_OPTIONS,
    ...opts.edgeOptimization,
  };

  // Filter out locked nodes from layout processing
  const lockedIds = new Set(opts.lockedNodeIds || []);

  // Store original positions for animation
  const originalPositions = new Map<string, { x: number; y: number }>();
  if (opts.animate) {
    for (const node of nodes) {
      originalPositions.set(node.id, { ...node.position });
    }
  }

  // Statistics tracking
  let boundariesProcessed = 0;
  let devicesRepositioned = 0;

  // Start with a copy of nodes
  let updatedNodes = [...nodes];

  // Identify boundaries
  const boundaries = updatedNodes.filter(n => n.type === 'boundary');

  // Sort boundaries by depth (innermost first)
  const sortedBoundaries = sortBoundariesByDepth(boundaries, updatedNodes);

  // Log boundary hierarchy for debugging
  if (sortedBoundaries.length > 0) {
    const boundaryDepths = sortedBoundaries.map(b => ({
      id: b.id,
      label: (b.data as BoundaryNodeData)?.label || b.id,
      depth: getNodeDepth(b.id, updatedNodes),
    }));
    layoutLogger.debug('[AutoTidy] Processing boundaries:', boundaryDepths);
  }

  // Process each boundary
  for (const boundary of sortedBoundaries) {
    const depth = getNodeDepth(boundary.id, updatedNodes);
    const label = (boundary.data as BoundaryNodeData)?.label || boundary.id;
    // Get direct children of this boundary
    const directChildren = updatedNodes.filter(
      n => n.parentId === boundary.id && !lockedIds.has(n.id)
    );

    if (directChildren.length === 0) {
      layoutLogger.debug(`[AutoTidy]   Skipping empty boundary "${label}" at depth ${depth}`);
      continue;
    }

    layoutLogger.info(`[AutoTidy]   Processing boundary "${label}" at depth ${depth} with ${directChildren.length} children`, {
      label,
      childCount: directChildren.length,
      depth
    });


    // Determine optimal layout direction
    const layoutDirection = getOptimalLayoutDirection(boundary, directChildren, edges);

    // Get boundary dimensions
    // If this is a root boundary (no parent) and we have viewport info, use viewport dimensions
    const isRootBoundary = !boundary.parentId;
    let boundaryWidth: number;
    let boundaryHeight: number;

    if (isRootBoundary && opts.viewportDimensions) {
      // Use viewport dimensions for root boundaries to fit in visible area
      // Apply some padding to prevent edges from being cut off
      const padding = 100;
      boundaryWidth = opts.viewportDimensions.width - padding;
      boundaryHeight = opts.viewportDimensions.height - padding;

      layoutLogger.debug(`[AutoTidy] Using viewport dimensions for root boundary ${boundary.id}:`, {
        viewportWidth: opts.viewportDimensions.width,
        viewportHeight: opts.viewportDimensions.height,
        boundaryWidth,
        boundaryHeight,
      });
    } else {
      // Use actual boundary dimensions for nested boundaries
      boundaryWidth = typeof boundary.style?.width === 'number'
        ? boundary.style.width
        : (boundary.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH);
      boundaryHeight = typeof boundary.style?.height === 'number'
        ? boundary.style.height
        : (boundary.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT);
    }

    // Calculate custom spacing based on tier and edge optimization
    const { avgWidth, avgHeight } = getAverageNodeDimensions(
      directChildren,
      opts.globalDeviceImageSize
    );
    const baseSpacing = calculateAdaptiveSpacing(avgWidth, avgHeight, 'both');
    const adjustedSpacing = getAdjustedSpacing(baseSpacing, opts.spacingTier);

    // Determine optimal ranker algorithm
    const childNodeIds = new Set(directChildren.map(n => n.id));
    const relevantEdges = edges.filter(
      e => childNodeIds.has(e.source) && childNodeIds.has(e.target)
    );
    const topology = detectGraphTopology(directChildren, relevantEdges);

    // Select ranker based on configuration or auto-detect
    let ranker: DagreRanker;
    if (edgeOpts.rankerAlgorithm === 'auto') {
      ranker = selectOptimalRanker(topology, directChildren.length);
    } else {
      ranker = edgeOpts.rankerAlgorithm;
    }

    // Apply Dagre layout algorithm
    try {
      // Calculate padding that matches the spacing tier for consistent margins
      const paddingMultiplier = SPACING_MULTIPLIERS[opts.spacingTier];
      const customMargin = (opts.boundaryPadding ?? LAYOUT_CONSTANTS.BOUNDARY_PADDING) * paddingMultiplier;

      layoutLogger.debug(`[AutoTidy]   Using Dagre layout engine (ranker: ${ranker})`);

      updatedNodes = await applyDagreLayout(
        boundary.id,
        updatedNodes,
        edges,
        boundaryWidth,
        boundaryHeight,
        layoutDirection,
        adjustedSpacing.nodesep,
        opts.globalDeviceImageSize || 55,
        opts.globalBoundaryLabelSize || 14,
        customMargin,
        edgeOpts.minimizeOverlaps
      );

      boundariesProcessed++;
      devicesRepositioned += directChildren.filter(n => n.type !== 'boundary').length;

      // Immediately resize this boundary to fit its children (if autoResize is enabled)
      // This ensures parent boundaries see the correct size when they are processed
      if (opts.autoResize && !lockedIds.has(boundary.id)) {
        const childNodesAfterLayout = updatedNodes.filter(n => n.parentId === boundary.id);
        const boundaryIndex = updatedNodes.findIndex(n => n.id === boundary.id);

        if (boundaryIndex !== -1 && childNodesAfterLayout.length > 0) {
          // Normalize child positions to start at (padding, padding) relative to boundary
          // This fixes coordinate system mismatches from Dagre layout
          const paddingMultiplier = SPACING_MULTIPLIERS[opts.spacingTier];
          const padding = (opts.boundaryPadding ?? LAYOUT_CONSTANTS.BOUNDARY_PADDING) * paddingMultiplier;
          const normalizedChildren = normalizeChildPositions(childNodesAfterLayout, padding);
          
          // Update nodes array with normalized positions
          for (const normalizedChild of normalizedChildren) {
            const childIndex = updatedNodes.findIndex(n => n.id === normalizedChild.id);
            if (childIndex !== -1) {
              updatedNodes[childIndex] = normalizedChild;
            }
          }
          
          // Now resize boundary using normalized child positions
          const normalizedChildrenForResize = updatedNodes.filter(n => n.parentId === boundary.id);
          updatedNodes[boundaryIndex] = resizeBoundaryToFit(
            updatedNodes[boundaryIndex],
            normalizedChildrenForResize,
            opts.spacingTier,
            opts.globalBoundaryLabelSize || 14,
            updatedNodes, // Pass all nodes for depth calculation
            opts.boundaryPadding, // Pass user-configurable boundary padding
            opts.nestedBoundarySpacing // Pass nested boundary spacing
          );
        }
      }
    } catch (error) {
      layoutLogger.error(`[AutoTidy] Failed to layout boundary ${boundary.id}:`, error);
    }
  }

  // === Process orphan devices (devices not inside any boundary) ===
  const orphanDevices = updatedNodes.filter(
    n => n.type === 'device' && !n.parentId && !lockedIds.has(n.id)
  );

  if (orphanDevices.length > 0) {
    layoutLogger.info(`[AutoTidy] Processing ${orphanDevices.length} orphan devices (outside boundaries)`);

    // Calculate spacing for orphan devices
    const { avgWidth, avgHeight } = getAverageNodeDimensions(
      orphanDevices,
      opts.globalDeviceImageSize
    );
    const baseSpacing = calculateAdaptiveSpacing(avgWidth, avgHeight, 'both');
    const adjustedSpacing = getAdjustedSpacing(baseSpacing, opts.spacingTier);
    
    // Use larger of nodesep or ranksep for grid gap
    const gap = Math.max(adjustedSpacing.nodesep, adjustedSpacing.ranksep);

    // Calculate offset to position orphan devices after root boundaries
    const rootBoundaries = updatedNodes.filter(n => n.type === 'boundary' && !n.parentId);
    let offsetX = 50;

    if (rootBoundaries.length > 0) {
      // Find the rightmost edge of all root boundaries
      for (const boundary of rootBoundaries) {
        const boundaryWidth = typeof boundary.style?.width === 'number'
          ? boundary.style.width
          : (boundary.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH);
        const boundaryRight = boundary.position.x + boundaryWidth;
        offsetX = Math.max(offsetX, boundaryRight + 50);
      }
    }

    // Use edge-aware bin packing for orphan devices
    // This places connected devices near each other while packing efficiently
    const gridPositioned = arrangeWithEdgeAwarePacking(orphanDevices, edges, offsetX, 50, gap);

    // Update orphan device positions
    for (const positionedDevice of gridPositioned) {
      const index = updatedNodes.findIndex(n => n.id === positionedDevice.id);
      if (index !== -1) {
        updatedNodes[index] = positionedDevice;
        devicesRepositioned++;
      }
    }

    layoutLogger.debug(`[AutoTidy] Positioned ${orphanDevices.length} orphan devices in grid at x=${offsetX}`);
  }

  // Position root boundaries to avoid overlaps
  const rootBoundaryIds = new Set(
    boundaries.filter(b => !b.parentId && !lockedIds.has(b.id)).map(b => b.id)
  );
  if (rootBoundaryIds.size > 1) {
    const rootBoundaries = updatedNodes.filter(n => rootBoundaryIds.has(n.id));
    const repositionedRoots = positionRootBoundaries(
      rootBoundaries,
      opts.spacingTier
    );

    // Update positions in the main array
    for (const repoRoot of repositionedRoots) {
      const index = updatedNodes.findIndex(n => n.id === repoRoot.id);
      if (index !== -1) {
        updatedNodes[index] = repoRoot;
      }
    }
  }

  // === Edge Optimization Phase ===
  let edgeQuality: EdgeRoutingQualityResult | undefined;
  let labelCollisions: LabelCollisionResult | undefined;
  let resolvedLabelPositions: EdgeLabelPosition[] | undefined;

  // Run edge label collision detection and resolution
  if (edgeOpts.edgeLabelCollisionAvoidance) {
    const labelConfig = {
      ...DEFAULT_EDGE_LABEL_CONFIG,
      enabled: true,
      rotateToMatchEdge: edgeOpts.labelRotation,
    };

    labelCollisions = resolveEdgeLabelCollisions(edges, updatedNodes, labelConfig);
    resolvedLabelPositions = labelCollisions.resolvedPositions;

    if (!labelCollisions.allResolved && labelCollisions.totalCollisions > 0) {
      layoutLogger.warn(
        `[AutoTidy] ${labelCollisions.totalCollisions} label collision(s) could not be fully resolved`
      );
    }
  }

  // Calculate edge routing quality metrics
  if (edgeOpts.calculateQualityMetrics) {
    edgeQuality = calculateEdgeRoutingQuality(updatedNodes, edges, {
      checkLabelCollisions: edgeOpts.edgeLabelCollisionAvoidance,
    });

    // Log quality feedback
    layoutLogger.debug(`[AutoTidy] Edge routing quality: ${(edgeQuality.overallScore * 100).toFixed(1)}%`);
    layoutLogger.debug(`[AutoTidy] - Crossings: ${edgeQuality.metrics.totalCrossings}`);
    layoutLogger.debug(`[AutoTidy] - Label collisions: ${edgeQuality.metrics.labelCollisionCount}`);

    // Warn if quality is below threshold
    if (!meetsQualityThreshold(edgeQuality, 0.6, 0)) {
      layoutLogger.warn(`[AutoTidy] Edge routing quality: ${(edgeQuality.overallScore * 100).toFixed(1)}% (below optimal)`);
      for (const suggestion of edgeQuality.suggestions) {
        layoutLogger.debug(`[AutoTidy] Suggestion: ${suggestion}`);
      }
    }
  }

  // === Smart Handle Placement Phase ===
  // Calculate optimal handle positions based on layout direction
  // This makes edges flow with the Dagre layout direction
  const { routeEdges, getLayoutDirectionFromContext } = await import('./port-router');

  // Get primary layout direction from first root-level boundary
  const primaryBoundary = sortedBoundaries.find(b => !b.parentId) || sortedBoundaries[0];
  const primaryDirection = primaryBoundary
    ? getLayoutDirectionFromContext(primaryBoundary.id, updatedNodes)
    : null;

  const edgesWithSmartHandles = routeEdges(updatedNodes, edges, primaryDirection);

  // === Z-Index Application Phase ===
  // Apply z-index to nodes based on type and nesting depth (fixed: devices > edges > boundaries)
  updatedNodes = updatedNodes.map(node => {
    let zIndex: number;

    if (node.type === 'boundary') {
      const nestingDepth = getNodeDepth(node.id, updatedNodes);
      zIndex = getBoundaryZIndex(nestingDepth);
    } else {
      // Device node - selection state handled by ReactFlow's elevateNodesOnSelect
      zIndex = getDeviceZIndex(false);
    }

    return {
      ...node,
      zIndex,
    };
  });

  // Apply z-index to edges (with smart handles already applied)
  const updatedEdges = edgesWithSmartHandles.map(edge => ({
    ...edge,
    zIndex: getEdgeZIndex(false),
  }));

  layoutLogger.info(`[AutoTidy] Applied smart handles and z-index layering`);

  // Prepare target positions for animation
  const targetPositions = new Map<string, { x: number; y: number }>();
  if (opts.animate) {
    for (const node of updatedNodes) {
      targetPositions.set(node.id, { ...node.position });
    }
  }

  const endTime = performance.now();

  return {
    nodes: updatedNodes,
    edges: updatedEdges, // Return updated edges with z-index
    originalPositions: opts.animate ? originalPositions : undefined,
    targetPositions: opts.animate ? targetPositions : undefined,
    stats: {
      totalNodes: nodes.length,
      boundariesProcessed,
      devicesRepositioned,
      processingTimeMs: Math.round(endTime - startTime),
      edgeQuality,
      labelCollisions,
      resolvedLabelPositions,
    },
  };
}

/**
 * Calculate a preview of the tidy operation without applying changes.
 * Useful for showing before/after comparison.
 */
export async function previewTidy(
  nodes: AppNode[],
  edges: AppEdge[],
  options: Partial<TidyOptions> = {}
): Promise<TidyResult> {
  return tidyDiagram(nodes, edges, { ...options, animate: true });
}

/**
 * Apply animated transition between two sets of node positions.
 * Returns a function that can be called with progress (0-1) to get intermediate positions.
 */
export function createTidyAnimation(
  originalPositions: Map<string, { x: number; y: number }>,
  targetPositions: Map<string, { x: number; y: number }>
): (progress: number) => Map<string, { x: number; y: number }> {
  return (progress: number) => {
    const interpolatedPositions = new Map<string, { x: number; y: number }>();

    // Clamp progress to [0, 1]
    const t = Math.max(0, Math.min(1, progress));

    // Apply easing (ease-out-cubic)
    const easedT = 1 - Math.pow(1 - t, 3);

    for (const [nodeId, original] of originalPositions) {
      const target = targetPositions.get(nodeId);
      if (target) {
        interpolatedPositions.set(nodeId, {
          x: original.x + (target.x - original.x) * easedT,
          y: original.y + (target.y - original.y) * easedT,
        });
      }
    }

    return interpolatedPositions;
  };
}

/**
 * Animate nodes from their current positions to target positions.
 * Uses requestAnimationFrame for smooth animation.
 */
export function animateTidy(
  nodes: AppNode[],
  targetPositions: Map<string, { x: number; y: number }>,
  duration: number,
  onUpdate: (nodes: AppNode[]) => void,
  onComplete?: () => void
): () => void {
  const originalPositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    originalPositions.set(node.id, { ...node.position });
  }

  const getInterpolated = createTidyAnimation(originalPositions, targetPositions);
  const startTime = performance.now();
  let animationFrameId: number;
  let cancelled = false;

  const animate = (currentTime: number) => {
    if (cancelled) return;

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const interpolatedPositions = getInterpolated(progress);

    // Update node positions
    const animatedNodes = nodes.map(node => {
      const newPos = interpolatedPositions.get(node.id);
      if (newPos) {
        return { ...node, position: newPos };
      }
      return node;
    });

    onUpdate(animatedNodes);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  // Return cancel function
  return () => {
    cancelled = true;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

/**
 * Get the recommended spacing tier based on the number of nodes
 */
export function getRecommendedSpacingTier(nodeCount: number): SpacingTier {
  if (nodeCount > 50) return 'compact';
  if (nodeCount > 20) return 'comfortable';
  return 'spacious';
}
