// Dagre is dynamically imported to reduce initial bundle size
// It will only be loaded when a layout operation is triggered
import { AppNode, AppEdge, DeviceAlignment, BoundaryNodeData } from '@/lib/utils/types';
import { detectGraphTopology, calculateNodeRanks } from '@/lib/topology/flowAnalysis';
import {
  LAYOUT_CONSTANTS,
  calculateAdaptiveSpacing,
  getAverageNodeDimensions,
} from './layoutConfig';
import {
  calculateEdgeWeight,
  calculateEdgeMinlen,
  selectOptimalRanker,
} from '@/lib/topology/dagre-config';
import { layoutLogger } from '@/lib/topology/layoutLogger';

// Lazy-loaded dagre module reference
let dagreModule: typeof import('@dagrejs/dagre') | null = null;

/**
 * Dynamically load the dagre library
 * This defers loading ~50KB until layout is actually needed
 */
async function loadDagre(): Promise<typeof import('@dagrejs/dagre')> {
  if (!dagreModule) {
    dagreModule = await import('@dagrejs/dagre');
  }
  return dagreModule;
}

export type DagreDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface DagreLayoutConfig {
  rankdir: DagreDirection;
  nodesep: number;
  ranksep: number;
  edgesep: number;
  ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
  align?: 'UL' | 'UR' | 'DL' | 'DR';
}

/**
 * Predefined Dagre layout configurations
 * Note: These are base values - actual spacing is calculated adaptively based on node dimensions
 * Values are optimized for compact, frame-fitting layouts
 */
export const DAGRE_PRESETS: Record<DeviceAlignment, DagreLayoutConfig | null> = {
  'none': null,
  'dagre-tb': {
    rankdir: 'TB',
    nodesep: 120, // Reduced for more compact layouts
    ranksep: 160, // Reduced for more compact layouts
    edgesep: 40, // Balanced for edge routing
    ranker: 'network-simplex',
  },
  'dagre-lr': {
    rankdir: 'LR',
    nodesep: 120,
    ranksep: 160,
    edgesep: 40,
    ranker: 'network-simplex',
  },
  'dagre-bt': {
    rankdir: 'BT',
    nodesep: 120,
    ranksep: 160,
    edgesep: 40,
    ranker: 'network-simplex',
  },
  'dagre-rl': {
    rankdir: 'RL',
    nodesep: 120,
    ranksep: 160,
    edgesep: 40,
    ranker: 'network-simplex',
  },
};

/**
 * Apply Dagre layout algorithm to devices within a boundary
 * Dagre is optimized for directed acyclic graphs (DAGs)
 */
/**
 * Calculate boundary label dimensions for layout spacing
 * Returns the additional width/height needed to account for labels placed outside boundaries
 */
export function calculateBoundaryLabelSpace(
  boundaryData: BoundaryNodeData,
  globalBoundaryLabelSize: number
): { width: number; height: number } {
  const labelPlacement = boundaryData.labelPlacement || 'outside';
  
  // Only account for labels placed outside the boundary
  if (labelPlacement !== 'outside') {
    return { width: 0, height: 0 };
  }

  const fontSize = globalBoundaryLabelSize;
  const padding = Math.max(4, fontSize * 0.4);
  const labelSpacing = boundaryData.labelSpacing ?? 8;
  const labelPosition = boundaryData.labelPosition || 'bottom-center';
  
  // Calculate label dimensions (matching GroupNode.tsx logic)
  const labelText = boundaryData.label || '';
  const charWidth = fontSize * 0.6;
  const textWidth = labelText.length * charWidth;
  const labelPaddingX = padding * 1.5;
  const labelWidth = textWidth + labelPaddingX * 2;
  const labelHeight = fontSize + padding * 2;
  
  // Calculate additional space needed based on label position
  let additionalWidth = 0;
  let additionalHeight = 0;
  
  // Add height for top or bottom positions (labels are above or below the boundary)
  if (labelPosition.includes('top')) {
    additionalHeight += labelHeight + labelSpacing;
  } else if (labelPosition.includes('bottom')) {
    additionalHeight += labelHeight + labelSpacing;
  }
  
  // Add width only for left/right positions (center positions don't extend beyond boundary width)
  // Note: For center positions, the label is centered so it doesn't add extra width
  if (labelPosition.includes('left')) {
    additionalWidth += labelWidth + labelSpacing;
  } else if (labelPosition.includes('right')) {
    additionalWidth += labelWidth + labelSpacing;
  }
  // For center positions (top-center, bottom-center), width is 0 since label is centered
  
  return { width: additionalWidth, height: additionalHeight };
}

/**
 * Calculate optimal layout direction based on boundary aspect ratio and node count
 */
function getOptimalRankdir(
  boundaryWidth: number,
  boundaryHeight: number,
  nodeCount: number,
  requestedDirection: DagreDirection
): DagreDirection {
  // For small node counts, respect the requested direction
  if (nodeCount <= 3) {
    return requestedDirection;
  }

  const aspectRatio = boundaryWidth / boundaryHeight;

  // If boundary is very wide (landscape), prefer LR layout
  // If boundary is very tall (portrait), prefer TB layout
  // This helps dagre use the available space more efficiently

  if (aspectRatio > 1.5 && (requestedDirection === 'TB' || requestedDirection === 'BT')) {
    // Wide boundary with vertical layout requested - suggest horizontal
    return 'LR';
  } else if (aspectRatio < 0.67 && (requestedDirection === 'LR' || requestedDirection === 'RL')) {
    // Tall boundary with horizontal layout requested - suggest vertical
    return 'TB';
  }

  return requestedDirection;
}

/**
 * Calculate layout quality score - lower is better
 * Measures edge crossings, edge lengths, and space utilization
 */
function calculateLayoutQuality(
  g: any,
  childNodes: AppNode[],
  relevantEdges: AppEdge[],
  boundaryWidth: number,
  boundaryHeight: number
): number {
  const graphAttrs = g.graph();
  const graphWidth = graphAttrs.width || boundaryWidth;
  const graphHeight = graphAttrs.height || boundaryHeight;
  
  // Get node positions
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  childNodes.forEach((node) => {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      nodePositions.set(node.id, {
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      });
    }
  });

  // Calculate edge crossings (simplified - count overlapping edges)
  let crossingScore = 0;
  for (let i = 0; i < relevantEdges.length; i++) {
    for (let j = i + 1; j < relevantEdges.length; j++) {
      const e1 = relevantEdges[i];
      const e2 = relevantEdges[j];
      
      const pos1 = nodePositions.get(e1.source);
      const pos2 = nodePositions.get(e1.target);
      const pos3 = nodePositions.get(e2.source);
      const pos4 = nodePositions.get(e2.target);
      
      if (pos1 && pos2 && pos3 && pos4) {
        // Simple line intersection check
        const x1 = pos1.x;
        const y1 = pos1.y;
        const x2 = pos2.x;
        const y2 = pos2.y;
        const x3 = pos3.x;
        const y3 = pos3.y;
        const x4 = pos4.x;
        const y4 = pos4.y;
        
        // Check if edges share endpoints (not a crossing)
        if (
          (e1.source === e2.source || e1.source === e2.target ||
           e1.target === e2.source || e1.target === e2.target)
        ) {
          continue;
        }
        
        // Calculate if lines intersect (simplified)
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) > 0.001) {
          const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
          const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
          
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            crossingScore += 10; // Heavy penalty for crossings
          }
        }
      }
    }
  }

  // Calculate average edge length (shorter is better)
  let totalEdgeLength = 0;
  relevantEdges.forEach((edge) => {
    const pos1 = nodePositions.get(edge.source);
    const pos2 = nodePositions.get(edge.target);
    if (pos1 && pos2) {
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      totalEdgeLength += Math.sqrt(dx * dx + dy * dy);
    }
  });
  const avgEdgeLength = relevantEdges.length > 0 ? totalEdgeLength / relevantEdges.length : 0;

  // Space utilization (closer to boundary size is better)
  const spaceUtilization = (graphWidth * graphHeight) / (boundaryWidth * boundaryHeight);
  const spacePenalty = spaceUtilization > 1.1 ? (spaceUtilization - 1.1) * 100 : 0; // Penalty for exceeding boundary
  const underutilizationPenalty = spaceUtilization < 0.5 ? (0.5 - spaceUtilization) * 50 : 0; // Penalty for too much empty space

  // Total quality score (lower is better)
  return crossingScore + avgEdgeLength * 0.1 + spacePenalty + underutilizationPenalty;
}

/**
 * Fallback grid layout when dagre fails
 * Arranges nodes in a grid pattern within the boundary
 */
function applyGridFallbackLayout(
  _boundaryId: string,
  nodes: AppNode[],
  childNodes: AppNode[],
  boundaryWidth: number,
  boundaryHeight: number,
  marginSize: number,
  globalDeviceImageSize: number
): AppNode[] {
  layoutLogger.warn('[Dagre Layout] Using grid fallback layout');

  const updatedNodes = [...nodes];
  const { avgWidth, avgHeight } = getAverageNodeDimensions(childNodes, globalDeviceImageSize);

  // Calculate grid dimensions
  const availableWidth = boundaryWidth - marginSize * 2;
  const availableHeight = boundaryHeight - marginSize * 2;

  // Calculate optimal columns based on aspect ratio
  const nodeSpacing = Math.max(20, avgWidth * 0.3);
  const cellWidth = avgWidth + nodeSpacing;
  const cellHeight = avgHeight + nodeSpacing;

  const cols = Math.max(1, Math.floor(availableWidth / cellWidth));
  const rows = Math.ceil(childNodes.length / cols);

  // Calculate actual grid size and center offset
  const gridWidth = cols * cellWidth - nodeSpacing;
  const gridHeight = rows * cellHeight - nodeSpacing;
  const offsetX = marginSize + Math.max(0, (availableWidth - gridWidth) / 2);
  const offsetY = marginSize + Math.max(0, (availableHeight - gridHeight) / 2);

  childNodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    const nodeIndex = updatedNodes.findIndex((n) => n.id === node.id);
    if (nodeIndex !== -1) {
      updatedNodes[nodeIndex] = {
        ...updatedNodes[nodeIndex],
        position: {
          x: offsetX + col * cellWidth,
          y: offsetY + row * cellHeight,
        },
      };
    }
  });

  layoutLogger.info('[Dagre Layout] Grid fallback applied:', {
    childCount: childNodes.length,
    cols,
    rows,
    cellWidth,
    cellHeight,
  });

  return updatedNodes;
}

export async function applyDagreLayout(
  boundaryId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  boundaryWidth: number,
  boundaryHeight: number,
  layoutType: DeviceAlignment,
  customSpacing?: number,
  globalDeviceImageSize: number = 55,
  _globalBoundaryLabelSize: number = 14,
  customMargin?: number,
  minimizeOverlaps: boolean = false
): Promise<AppNode[]> {
  const childNodes = nodes.filter((n) => n.parentId === boundaryId);

  if (childNodes.length === 0) {
    return nodes;
  }

  // Filter edges to only those connecting nodes (devices or boundaries) within this boundary
  // For nested boundaries, only include edges between direct children, not edges inside nested boundaries
  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const relevantEdges = edges.filter(
    (edge) => childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
  );

  // Get layout configuration
  const config = DAGRE_PRESETS[layoutType];
  if (!config) {
    return nodes; // No layout for 'none'
  }

  // Calculate adaptive spacing based on actual child node dimensions
  // Pass globalDeviceImageSize to account for visual scaling
  const { avgWidth, avgHeight } = getAverageNodeDimensions(childNodes, globalDeviceImageSize);
  const adaptiveSpacing = calculateAdaptiveSpacing(avgWidth, avgHeight, 'both');

  // Apply custom spacing if provided, otherwise use the larger of preset or adaptive
  // REDUCED spacing to make layouts more compact
  const baseNodesep = customSpacing || Math.max(config.nodesep, adaptiveSpacing.nodesep);
  const baseRanksep = customSpacing ? customSpacing * 1.6 : Math.max(config.ranksep, adaptiveSpacing.ranksep);

  // Scale down spacing based on node count to fit more in the frame
  const nodeCountFactor = Math.max(0.6, 1 - (childNodes.length / 50));
  let nodesep = Math.round(baseNodesep * nodeCountFactor);
  let ranksep = Math.round(baseRanksep * nodeCountFactor);
  
  // Apply overlap minimization multiplier if enabled
  if (minimizeOverlaps) {
    nodesep = Math.round(nodesep * 1.4);
    ranksep = Math.round(ranksep * 1.4);
  }
  
  const edgesep = customSpacing ? Math.max(15, customSpacing * 0.4) : Math.max(config.edgesep, adaptiveSpacing.edgesep);

  // Detect graph topology for optimal ranker selection
  const topology = detectGraphTopology(childNodes, relevantEdges);

  // Calculate node ranks for better initial positioning
  const nodeRanks = calculateNodeRanks(childNodes, relevantEdges);

  // Optimize rankdir based on boundary aspect ratio
  const optimizedRankdir = getOptimalRankdir(
    boundaryWidth,
    boundaryHeight,
    childNodes.length,
    config.rankdir
  );

  // Dynamically load dagre library
  const dagre = await loadDagre();

  // Determine which rankers and align options to try
  const rankersToTry: Array<'network-simplex' | 'tight-tree' | 'longest-path'> = [];
  const optimalRanker = selectOptimalRanker(topology, childNodes.length);
  
  // Try optimal ranker first, then try others if we have time
  rankersToTry.push(optimalRanker);
  if (optimalRanker !== 'network-simplex') rankersToTry.push('network-simplex');
  if (optimalRanker !== 'longest-path') rankersToTry.push('longest-path');
  if (optimalRanker !== 'tight-tree' && childNodes.length < 50) rankersToTry.push('tight-tree');

  // Try different align options for better node positioning
  const alignOptions: Array<'UL' | 'UR' | 'DL' | 'DR' | undefined> = [
    undefined, // Let Dagre choose
    'UL', // Upper Left
    'UR', // Upper Right
  ];

  // Use custom margin if provided
  const marginSize = customMargin ?? LAYOUT_CONSTANTS.BOUNDARY_PADDING;

  let bestGraph: any = null;
  let bestQuality = Infinity;
  let bestConfig: { ranker: string; align?: string } | null = null;

  // Try multiple configurations and pick the best
  for (const ranker of rankersToTry) {
    for (const align of alignOptions) {
      try {
        // Create a new dagre graph for this configuration
        const g = new dagre.graphlib.Graph();

        // Set graph properties
        g.setGraph({
          rankdir: optimizedRankdir,
          nodesep: nodesep,
          ranksep: ranksep,
          edgesep: edgesep,
          ranker: ranker,
          align: align,
          acyclicer: 'greedy',
          marginx: marginSize,
          marginy: marginSize,
        });

        // Default to treating graph as directed
        g.setDefaultEdgeLabel(() => ({}));

        // Add nodes to the graph with their actual dimensions
        childNodes.forEach((node) => {
          let nodeWidth: number;
          let nodeHeight: number;

          if (node.type === 'boundary') {
            nodeWidth = node.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
            nodeHeight = node.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;
          } else {
            nodeWidth = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
            nodeHeight = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
          }
          
          g.setNode(node.id, {
            width: nodeWidth,
            height: nodeHeight,
            id: node.id,
            rank: nodeRanks.get(node.id),
          });
        });

        // Add edges using enhanced weight and minlen calculations
        relevantEdges.forEach((edge) => {
          const dataFlow = edge.data?.dataFlow;
          
          if (dataFlow === 'target-to-source') {
            // Reverse edge - swap source and target for layout
            const weight = calculateEdgeWeight(edge);
            const minlen = calculateEdgeMinlen(edge);
            g.setEdge(edge.target, edge.source, {
              id: edge.id,
              minlen: minlen,
              weight: weight,
            });
          } else {
            // Use enhanced edge weight and minlen calculations
            const weight = calculateEdgeWeight(edge);
            const minlen = calculateEdgeMinlen(edge);
            g.setEdge(edge.source, edge.target, {
              id: edge.id,
              minlen: minlen,
              weight: weight,
            });
          }
        });

        // Run the layout algorithm
        dagre.layout(g);

        // Calculate quality score for this layout
        const quality = calculateLayoutQuality(
          g,
          childNodes,
          relevantEdges,
          boundaryWidth,
          boundaryHeight
        );

        // Keep track of the best layout
        if (quality < bestQuality) {
          bestQuality = quality;
          bestGraph = g;
          bestConfig = { ranker, align };
        }
      } catch (error) {
        // Continue to next configuration if this one fails
        layoutLogger.warn(`[Dagre Layout] Failed for ranker=${ranker}, align=${align}:`, error);
      }
    }
  }

  // Use the best layout found, or fall back to single attempt if all failed
  if (!bestGraph) {
    // Fallback: try with default configuration
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: optimizedRankdir,
      nodesep: nodesep,
      ranksep: ranksep,
      edgesep: edgesep,
      ranker: optimalRanker,
      align: config.align,
      acyclicer: 'greedy',
      marginx: marginSize,
      marginy: marginSize,
    });
    g.setDefaultEdgeLabel(() => ({}));
    
    childNodes.forEach((node) => {
      let nodeWidth: number;
      let nodeHeight: number;
      if (node.type === 'boundary') {
        nodeWidth = node.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
        nodeHeight = node.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;
      } else {
        nodeWidth = node.measured?.width || node.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
        nodeHeight = node.measured?.height || node.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
      }
      g.setNode(node.id, {
        width: nodeWidth,
        height: nodeHeight,
        id: node.id,
        rank: nodeRanks.get(node.id),
      });
    });
    
    relevantEdges.forEach((edge) => {
      const weight = calculateEdgeWeight(edge);
      const minlen = calculateEdgeMinlen(edge);
      const dataFlow = edge.data?.dataFlow;
      if (dataFlow === 'target-to-source') {
        g.setEdge(edge.target, edge.source, { id: edge.id, minlen, weight });
      } else {
        g.setEdge(edge.source, edge.target, { id: edge.id, minlen, weight });
      }
    });
    
    try {
      dagre.layout(g);
      bestGraph = g;
    } catch (error) {
      layoutLogger.error('[Dagre Layout] Failed completely:', error);
      // Fallback to grid layout when dagre fails entirely
      return applyGridFallbackLayout(
        boundaryId,
        nodes,
        childNodes,
        boundaryWidth,
        boundaryHeight,
        marginSize,
        globalDeviceImageSize
      );
    }
  }

  try {
    // Get the graph dimensions from best layout
    const graphAttrs = bestGraph.graph();
    const graphWidth = graphAttrs.width || boundaryWidth;
    const graphHeight = graphAttrs.height || boundaryHeight;

    // Center the layout within the boundary if the graph is smaller than the boundary
    const offsetX = Math.max(0, (boundaryWidth - graphWidth) / 2);
    const offsetY = Math.max(0, (boundaryHeight - graphHeight) / 2);

    layoutLogger.info('[Dagre Layout] Best configuration:', {
      ranker: bestConfig?.ranker,
      align: bestConfig?.align,
      quality: bestQuality,
      boundaryWidth,
      boundaryHeight,
      graphWidth,
      graphHeight,
      optimizedRankdir,
      requestedRankdir: config.rankdir,
      nodesep,
      ranksep,
      childCount: childNodes.length,
      offsetX,
      offsetY,
    });

    // Update node positions from best layout
    const updatedNodes = [...nodes];
    
    childNodes.forEach((node) => {
      const dagreNode = bestGraph.node(node.id);
      if (dagreNode) {
        const nodeIndex = updatedNodes.findIndex((n) => n.id === node.id);
        if (nodeIndex !== -1) {
          const nodeWidth = dagreNode.width;
          const nodeHeight = dagreNode.height;
          
          updatedNodes[nodeIndex] = {
            ...updatedNodes[nodeIndex],
            position: {
              x: dagreNode.x - nodeWidth / 2 + offsetX,
              y: dagreNode.y - nodeHeight / 2 + offsetY,
            },
          };
        }
      }
    });

    return updatedNodes;
  } catch (error) {
    layoutLogger.error('[Dagre Layout] Failed:', error);
    return nodes; // Return original nodes if layout fails
  }
}

/**
 * Get a description for each Dagre layout type
 */
export function getDagreLayoutDescription(layoutType: DeviceAlignment): string {
  switch (layoutType) {
    case 'dagre-tb':
      return 'Hierarchical Flow (Top→Bottom) - Best for workflows and process diagrams';
    case 'dagre-lr':
      return 'Horizontal Flow (Left→Right) - Best for timelines and sequential processes';
    case 'dagre-bt':
      return 'Reverse Hierarchy (Bottom→Top) - Reverse hierarchy, bottom-up view';
    case 'dagre-rl':
      return 'Reverse Horizontal (Right→Left) - Right-to-left reading order';
    default:
      return 'No layout';
  }
}

