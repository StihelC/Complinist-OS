/**
 * ELKjs Layout Engine
 *
 * Uses ELKjs (Eclipse Layout Kernel for JavaScript) for hierarchical graph layout.
 * ELK natively supports compound/nested nodes via hierarchyHandling: INCLUDE_CHILDREN,
 * which eliminates the need for multi-pass layout orchestration.
 *
 * Key advantages over Dagre for CompliFlow:
 * - Native support for nested boundaries (compound nodes)
 * - Single-pass layout for entire hierarchy
 * - Better edge routing around nested structures
 */

import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { AppNode, AppEdge } from '@/lib/utils/types';
import { LayoutOptions, LayoutResult, LayoutStats, directionToElkDirection } from './layoutInterface';
import { LAYOUT_CONSTANTS } from './layoutConfig';
import { layoutLogger } from '@/lib/topology/layoutLogger';
import { layoutDebugger } from './layoutDebugger';

// Type for ELK instance
type ElkInstance = InstanceType<typeof ELK>;

// Singleton ELK instance
let elkInstance: ElkInstance | null = null;

/**
 * Get or create ELK instance (lazy initialization)
 */
function getElk(): ElkInstance {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

/**
 * Build parent-children relationships from flat node array
 */
function buildChildrenMap(nodes: AppNode[]): Map<string | undefined, AppNode[]> {
  const map = new Map<string | undefined, AppNode[]>();

  for (const node of nodes) {
    const parentId = node.parentId;
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId)!.push(node);
  }

  return map;
}

/**
 * Get node dimensions
 */
function getNodeDimensions(node: AppNode): { width: number; height: number } {
  if (node.type === 'boundary') {
    return {
      width: node.width || node.style?.width as number || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH,
      height: node.height || node.style?.height as number || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT,
    };
  }

  return {
    width: node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
    height: node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
  };
}

/**
 * Convert a React Flow node to an ELK node recursively
 * This builds the nested ELK hierarchy from flat React Flow nodes
 */
function convertToElkNode(
  node: AppNode,
  childrenMap: Map<string | undefined, AppNode[]>,
  options: LayoutOptions,
  depth: number = 0
): ElkNode {
  const { width, height } = getNodeDimensions(node);
  const children = childrenMap.get(node.id) || [];

  // Build ELK children recursively
  const elkChildren: ElkNode[] = children.map(child =>
    convertToElkNode(child, childrenMap, options, depth + 1)
  );

  // Base ELK node - only set dimensions for leaf nodes (devices)
  // Let ELK calculate dimensions for compound nodes (boundaries with children)
  const elkNode: ElkNode = {
    id: node.id,
  };

  // If this is a boundary with children, configure it as a compound node
  // Don't set explicit dimensions - let ELK calculate based on children
  if (node.type === 'boundary' && elkChildren.length > 0) {
    elkNode.children = elkChildren;

    const elkAlgorithm = options.elkAlgorithm || 'layered';

    // Use user-configured boundary padding
    const basePadding = options.boundaryPadding ?? LAYOUT_CONSTANTS.BOUNDARY_PADDING;

    // Check if this boundary contains nested boundaries
    const hasNestedBoundaries = children.some(child => child.type === 'boundary');

    // Add extra padding for nested boundaries (to account for their labels)
    // Use nestedBoundarySpacing setting or default to 30px
    const nestedExtra = hasNestedBoundaries ? (options.nestedBoundarySpacing ?? 30) : 0;

    const padding = basePadding + nestedExtra;

    // Debug logging (only when debug mode enabled)
    layoutDebugger.log(`Boundary "${node.id}": basePadding=${basePadding}, nestedExtra=${nestedExtra}, totalPadding=${padding}, hasNestedBoundaries=${hasNestedBoundaries}`);

    // Use nodeSpacing for space between children within this boundary
    const nodeSpacing = options.nodeSpacing ?? 40;

    // Layout options for this compound node
    // Don't set size constraints - let ELK freely compute size based on children + padding
    elkNode.layoutOptions = {
      'elk.algorithm': elkAlgorithm,
      'elk.direction': directionToElkDirection(options.direction),
      'elk.spacing.nodeNode': String(nodeSpacing),
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    };

    // Algorithm-specific options
    if (elkAlgorithm === 'layered') {
      elkNode.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = String(options.verticalSpacing);
    } else if (elkAlgorithm === 'mrtree') {
      elkNode.layoutOptions['elk.mrtree.spacing.nodeNode'] = String(nodeSpacing);
    }
  } else {
    // For leaf nodes (devices) or empty boundaries, set explicit dimensions
    elkNode.width = width;
    elkNode.height = height;
  }

  return elkNode;
}

/**
 * Convert React Flow nodes and edges to ELK graph format
 */
function convertToElkGraph(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions
): ElkNode {
  const childrenMap = buildChildrenMap(nodes);

  // Get root nodes (no parent)
  const rootNodes = childrenMap.get(undefined) || [];

  // Build ELK children for root level
  const elkChildren: ElkNode[] = rootNodes.map(node =>
    convertToElkNode(node, childrenMap, options)
  );

  // Convert edges - ELK needs edges at the lowest common ancestor level
  // For simplicity, we'll put all edges at root level and let ELK route them
  const elkEdges: ElkExtendedEdge[] = edges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkAlgorithm = options.elkAlgorithm || 'layered';

  // Base layout options
  const layoutOptions: Record<string, string> = {
    'elk.algorithm': elkAlgorithm,
    'elk.direction': directionToElkDirection(options.direction),
    'elk.spacing.nodeNode': String(options.horizontalSpacing),
    'elk.hierarchyHandling': options.elkHierarchyHandling || 'INCLUDE_CHILDREN',
    // Allow ELK to resize compound nodes (boundaries) to fit their children
    'elk.nodeSize.constraints': 'MINIMUM_SIZE',
  };

  // Graph-level options
  if (options.elkAlignment) {
    layoutOptions['elk.alignment'] = options.elkAlignment;
  }
  if (options.elkEdgeSpacing !== undefined) {
    layoutOptions['elk.spacing.edgeEdge'] = String(options.elkEdgeSpacing);
    layoutOptions['elk.spacing.edgeNode'] = String(options.elkEdgeSpacing);
  }
  if (options.elkRandomSeed !== undefined) {
    layoutOptions['elk.randomSeed'] = String(options.elkRandomSeed);
  }

  // Node-level options
  if (options.elkPortConstraints) {
    layoutOptions['elk.portConstraints'] = options.elkPortConstraints;
  }

  // Sub-graph options
  if (options.elkSeparateComponents) {
    layoutOptions['elk.separateConnectedComponents'] = 'true';
  }
  if (options.elkComponentSpacing !== undefined) {
    layoutOptions['elk.spacing.componentComponent'] = String(options.elkComponentSpacing);
  }

  // Algorithm-specific options
  if (elkAlgorithm === 'layered') {
    layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = String(options.verticalSpacing);
    layoutOptions['elk.layered.considerModelOrder.strategy'] = 'NODES_AND_EDGES';
    layoutOptions['elk.layered.crossingMinimization.strategy'] = 'LAYER_SWEEP';
    layoutOptions['elk.layered.nodePlacement.strategy'] = 'NETWORK_SIMPLEX';

    // Layered compaction
    if (options.elkCompaction) {
      layoutOptions['elk.layered.compaction.postCompaction.strategy'] = 'EDGE_LENGTH';
    }
  } else if (elkAlgorithm === 'mrtree') {
    layoutOptions['elk.mrtree.spacing.nodeNode'] = String(options.horizontalSpacing);

    // MrTree-specific options
    if (options.mrTreeEdgeRoutingMode) {
      layoutOptions['elk.mrtree.edgeRoutingMode'] = options.mrTreeEdgeRoutingMode;
    }
    if (options.mrTreeEdgeEndTextureLength !== undefined) {
      layoutOptions['elk.mrtree.edgeEndTextureLength'] = String(options.mrTreeEdgeEndTextureLength);
    }
    if (options.mrTreeSearchOrder) {
      layoutOptions['elk.mrtree.searchOrder'] = options.mrTreeSearchOrder;
    }

    // MrTree compaction
    if (options.elkCompaction) {
      layoutOptions['elk.mrtree.compaction'] = 'true';
    }
  }

  // Root graph
  return {
    id: 'root',
    layoutOptions,
    children: elkChildren,
    edges: elkEdges,
  };
}

/**
 * Extract positions from ELK result back to React Flow format
 * ELK positions are relative to parent, which matches React Flow's parentId system
 */
function extractPositions(
  elkNode: ElkNode,
  results: Map<string, { x: number; y: number; width?: number; height?: number }>
): void {
  // Skip root node
  if (elkNode.id !== 'root') {
    results.set(elkNode.id, {
      x: elkNode.x || 0,
      y: elkNode.y || 0,
      width: elkNode.width,
      height: elkNode.height,
    });
  }

  // Process children
  if (elkNode.children) {
    for (const child of elkNode.children) {
      extractPositions(child, results);
    }
  }
}

/**
 * Apply ELKjs layout to nodes and edges
 *
 * @param nodes - Array of React Flow nodes
 * @param edges - Array of React Flow edges
 * @param options - Layout options
 * @returns Promise<LayoutResult> - Updated nodes with new positions
 */
export async function applyElkLayout(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions
): Promise<LayoutResult> {
  const startTime = performance.now();

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: {
        totalNodes: 0,
        boundariesProcessed: 0,
        devicesRepositioned: 0,
        processingTimeMs: 0,
      },
    };
  }

  const elk = getElk();

  // Convert to ELK format
  const elkGraph = convertToElkGraph(nodes, edges, options);

  layoutLogger.debug('[ELK Layout] Input graph:', {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    direction: options.direction,
    spacing: { h: options.horizontalSpacing, v: options.verticalSpacing },
  });

  try {
    // Run ELK layout
    const layoutedGraph = await elk.layout(elkGraph);

    // Extract positions from result
    const positions = new Map<string, { x: number; y: number; width?: number; height?: number }>();
    extractPositions(layoutedGraph, positions);

    // Update nodes with new positions
    let devicesRepositioned = 0;
    let boundariesProcessed = 0;

    const updatedNodes = nodes.map(node => {
      const newPos = positions.get(node.id);
      if (!newPos) return node;

      if (node.type === 'boundary') {
        boundariesProcessed++;

        // Debug: log ELK computed size for boundaries
        layoutDebugger.log(`Boundary "${node.id}" computed size: ${newPos.width}x${newPos.height}, autoResize=${options.autoResize}`);

        // Update boundary size if auto-resize is enabled
        // Always resize boundaries to fit their ELK-computed dimensions
        if (options.autoResize !== false && newPos.width && newPos.height) {
          return {
            ...node,
            position: { x: newPos.x, y: newPos.y },
            width: newPos.width,
            height: newPos.height,
            style: {
              ...node.style,
              width: newPos.width,
              height: newPos.height,
            },
          };
        }
      } else {
        devicesRepositioned++;
      }

      return {
        ...node,
        position: { x: newPos.x, y: newPos.y },
      };
    });

    const endTime = performance.now();

    const stats: LayoutStats = {
      totalNodes: nodes.length,
      boundariesProcessed,
      devicesRepositioned,
      processingTimeMs: Math.round(endTime - startTime),
    };

    layoutLogger.info('[ELK Layout] Complete:', stats);

    return {
      nodes: updatedNodes,
      edges, // Edges unchanged for now
      stats,
    };
  } catch (error) {
    layoutLogger.error('[ELK Layout] Failed:', error);
    throw error;
  }
}

/**
 * Apply ELK layout to children within a specific boundary
 * This can be used for partial layout of a subtree
 */
export async function applyElkLayoutToBoundary(
  boundaryId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions
): Promise<LayoutResult> {
  // Get the boundary and its descendants
  const boundary = nodes.find(n => n.id === boundaryId);
  if (!boundary || boundary.type !== 'boundary') {
    return {
      nodes,
      edges,
      stats: {
        totalNodes: 0,
        boundariesProcessed: 0,
        devicesRepositioned: 0,
        processingTimeMs: 0,
      },
    };
  }

  // Find all descendants of this boundary
  const descendantIds = new Set<string>();
  const collectDescendants = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId === parentId) {
        descendantIds.add(node.id);
        collectDescendants(node.id);
      }
    }
  };
  collectDescendants(boundaryId);

  // Filter nodes to just this subtree (including boundary)
  const subtreeNodes = nodes.filter(n => n.id === boundaryId || descendantIds.has(n.id));

  // Filter edges to those within the subtree
  const subtreeEdges = edges.filter(e =>
    descendantIds.has(e.source) && descendantIds.has(e.target)
  );

  // Apply layout to subtree
  const result = await applyElkLayout(subtreeNodes, subtreeEdges, options);

  // Merge results back into full node array
  const resultNodeMap = new Map(result.nodes.map(n => [n.id, n]));
  const updatedNodes = nodes.map(n => resultNodeMap.get(n.id) || n);

  return {
    ...result,
    nodes: updatedNodes,
    edges,
  };
}
