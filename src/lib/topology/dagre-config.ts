/**
 * Enhanced Dagre Configuration for Edge Routing Optimization
 *
 * Provides comprehensive Dagre layout configuration with focus on:
 * - Optimal edge routing using ranker algorithms
 * - Configurable edge separation for label space
 * - Integration points for edge label collision avoidance
 */

import { AppNode, AppEdge, DeviceAlignment } from '@/lib/utils/types';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';

// =============================================================================
// Types
// =============================================================================

/**
 * Ranker algorithm selection for Dagre layout
 * - network-simplex: Best for general DAGs, optimal shortest paths (default)
 * - tight-tree: Faster but may produce wider layouts
 * - longest-path: Good for strict hierarchies, maximizes level utilization
 */
export type DagreRanker = 'network-simplex' | 'tight-tree' | 'longest-path';

/**
 * Edge routing style preference
 * - straight: Direct connections (default, uses edge type from metadata)
 * - orthogonal: Right-angle connections (step/smoothstep edge types)
 * - curved: Bezier curves for organic appearance
 */
export type EdgeRoutingStyle = 'straight' | 'orthogonal' | 'curved';

/**
 * Enhanced Dagre configuration with edge optimization options
 */
export interface EnhancedDagreConfig {
  // Core Dagre settings
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep: number;
  ranksep: number;
  edgesep: number;
  ranker: DagreRanker;
  align?: 'UL' | 'UR' | 'DL' | 'DR';
  acyclicer?: 'greedy';
  marginx?: number;
  marginy?: number;

  // Edge optimization settings
  edgeLabelCollisionAvoidance: boolean;
  edgeRoutingStyle: EdgeRoutingStyle;
  labelRotation: boolean;
  minEdgeSeparationWithLabels: number;

  // Quality optimization
  optimizeEdgeCrossings: boolean;
  optimizeEdgeLength: boolean;
  edgeWeightByDataFlow: boolean;
}

/**
 * Edge label configuration for collision detection
 */
export interface EdgeLabelConfig {
  /** Whether collision avoidance is enabled */
  enabled: boolean;
  /** Default label position along edge (0-1, where 0.5 is center) */
  defaultPosition: number;
  /** Minimum distance between labels in pixels */
  minLabelDistance: number;
  /** Label padding for collision detection */
  labelPadding: number;
  /** Whether to rotate labels to match edge angle */
  rotateToMatchEdge: boolean;
  /** Background panel visibility for label readability */
  showBackground: boolean;
  /** Maximum offset perpendicular to edge for collision resolution */
  maxPerpendicularOffset: number;
}

/**
 * Edge routing quality configuration
 */
export interface EdgeQualityConfig {
  /** Weight for edge length in quality score (0-1) */
  lengthWeight: number;
  /** Weight for edge crossings in quality score (0-1) */
  crossingWeight: number;
  /** Weight for edge bends in quality score (0-1) */
  bendWeight: number;
  /** Weight for label collision in quality score (0-1) */
  labelCollisionWeight: number;
}

/**
 * Complete edge optimization configuration
 */
export interface EdgeOptimizationConfig {
  dagre: EnhancedDagreConfig;
  label: EdgeLabelConfig;
  quality: EdgeQualityConfig;
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default edge label configuration
 */
export const DEFAULT_EDGE_LABEL_CONFIG: EdgeLabelConfig = {
  enabled: true,
  defaultPosition: 0.5,
  minLabelDistance: 40,
  labelPadding: 8,
  rotateToMatchEdge: false,
  showBackground: true,
  maxPerpendicularOffset: 30,
};

/**
 * Default edge quality configuration
 */
export const DEFAULT_EDGE_QUALITY_CONFIG: EdgeQualityConfig = {
  lengthWeight: 0.3,
  crossingWeight: 0.4,
  bendWeight: 0.15,
  labelCollisionWeight: 0.15,
};

/**
 * Default enhanced Dagre configuration
 */
export const DEFAULT_ENHANCED_DAGRE_CONFIG: EnhancedDagreConfig = {
  rankdir: 'TB',
  nodesep: 180,
  ranksep: 240,
  edgesep: 50,
  ranker: 'network-simplex',
  acyclicer: 'greedy',
  marginx: 100,
  marginy: 100,

  // Edge optimization defaults
  edgeLabelCollisionAvoidance: true,
  edgeRoutingStyle: 'curved',
  labelRotation: false,
  minEdgeSeparationWithLabels: 20,

  // Quality optimization defaults
  optimizeEdgeCrossings: true,
  optimizeEdgeLength: true,
  edgeWeightByDataFlow: true,
};

/**
 * Enhanced Dagre presets by direction with edge optimization
 */
export const ENHANCED_DAGRE_PRESETS: Record<DeviceAlignment, EnhancedDagreConfig | null> = {
  'none': null,
  'dagre-tb': {
    ...DEFAULT_ENHANCED_DAGRE_CONFIG,
    rankdir: 'TB',
  },
  'dagre-lr': {
    ...DEFAULT_ENHANCED_DAGRE_CONFIG,
    rankdir: 'LR',
  },
  'dagre-bt': {
    ...DEFAULT_ENHANCED_DAGRE_CONFIG,
    rankdir: 'BT',
  },
  'dagre-rl': {
    ...DEFAULT_ENHANCED_DAGRE_CONFIG,
    rankdir: 'RL',
  },
};

// =============================================================================
// Configuration Builders
// =============================================================================

/**
 * Build enhanced Dagre configuration with custom options
 */
export function buildDagreConfig(
  baseDirection: DeviceAlignment,
  options: Partial<EnhancedDagreConfig> = {}
): EnhancedDagreConfig | null {
  const preset = ENHANCED_DAGRE_PRESETS[baseDirection];
  if (!preset) return null;

  return {
    ...preset,
    ...options,
  };
}

/**
 * Build complete edge optimization configuration
 */
export function buildEdgeOptimizationConfig(
  options: {
    dagre?: Partial<EnhancedDagreConfig>;
    label?: Partial<EdgeLabelConfig>;
    quality?: Partial<EdgeQualityConfig>;
    direction?: DeviceAlignment;
  } = {}
): EdgeOptimizationConfig {
  const direction = options.direction || 'dagre-tb';
  const baseConfig = buildDagreConfig(direction, options.dagre);

  return {
    dagre: baseConfig || DEFAULT_ENHANCED_DAGRE_CONFIG,
    label: {
      ...DEFAULT_EDGE_LABEL_CONFIG,
      ...options.label,
    },
    quality: {
      ...DEFAULT_EDGE_QUALITY_CONFIG,
      ...options.quality,
    },
  };
}

// =============================================================================
// Adaptive Configuration Functions
// =============================================================================

/**
 * Calculate dynamic edgesep based on edge label density
 *
 * @param edges - Array of edges to analyze
 * @param baseEdgesep - Base edge separation value
 * @returns Adjusted edgesep value
 */
export function calculateDynamicEdgesep(
  edges: AppEdge[],
  baseEdgesep: number = DEFAULT_ENHANCED_DAGRE_CONFIG.edgesep
): number {
  if (edges.length === 0) return baseEdgesep;

  // Count edges with labels
  const edgesWithLabels = edges.filter(edge => {
    const data = edge.data || {};
    return data.label || (data.labelFields && data.labelFields.length > 0);
  });

  const labelDensity = edgesWithLabels.length / edges.length;

  // Increase edgesep proportionally to label density
  // At 0% labels: baseEdgesep
  // At 100% labels: baseEdgesep * 2.5
  const multiplier = 1 + (labelDensity * 1.5);

  return Math.round(baseEdgesep * multiplier);
}

/**
 * Calculate optimal ranksep based on nodes and their average dimensions
 *
 * @param nodes - Array of nodes
 * @param baseRanksep - Base rank separation value
 * @param globalDeviceImageSize - Global device image size percentage
 * @returns Adjusted ranksep value
 */
export function calculateOptimalRanksep(
  nodes: AppNode[],
  baseRanksep: number = DEFAULT_ENHANCED_DAGRE_CONFIG.ranksep,
  globalDeviceImageSize: number = 55
): number {
  if (nodes.length === 0) return baseRanksep;

  // Calculate average node height considering device image size
  let totalHeight = 0;
  for (const node of nodes) {
    let height = node.measured?.height || node.height ||
      (node.type === 'boundary'
        ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
        : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

    // Apply scaling for devices based on image size
    if (node.type === 'device' || node.type !== 'boundary') {
      const scaleFactor = globalDeviceImageSize / 55;
      height = Math.round(height * scaleFactor);
    }

    totalHeight += height;
  }

  const avgHeight = totalHeight / nodes.length;

  // Ensure ranksep is at least 1.5x the average height for label space
  const minRanksep = Math.round(avgHeight * 1.5);

  return Math.max(baseRanksep, minRanksep);
}

/**
 * Select optimal ranker algorithm based on graph topology
 *
 * @param topology - Graph topology type ('hierarchical' | 'networked' | 'mixed')
 * @param nodeCount - Number of nodes in the graph
 * @returns Optimal ranker algorithm
 */
export function selectOptimalRanker(
  topology: 'hierarchical' | 'networked' | 'mixed',
  nodeCount: number
): DagreRanker {
  // For very large graphs, use tight-tree for performance
  if (nodeCount > 100) {
    return 'tight-tree';
  }

  // For hierarchical graphs, longest-path creates cleaner layers
  if (topology === 'hierarchical') {
    return 'longest-path';
  }

  // For networked/mixed, network-simplex gives best results
  return 'network-simplex';
}

// =============================================================================
// Edge Weight Calculation
// =============================================================================

/**
 * Calculate edge weight based on data flow and other metadata
 * Higher weights make edges "stronger" in the layout algorithm
 *
 * @param edge - Edge to calculate weight for
 * @returns Edge weight value
 */
export function calculateEdgeWeight(edge: AppEdge): number {
  const data = edge.data || {};
  let weight = 1;

  // Data flow direction affects weight
  const dataFlow = data.dataFlow;
  if (dataFlow === 'source-to-target') {
    weight += 1; // Strong directional flow
  } else if (dataFlow === 'bidirectional') {
    weight += 0.5; // Moderate weight for bidirectional
  }

  // Critical connections (encrypted, monitored) get higher weight
  if (data.encryptionProtocol) {
    weight += 0.5;
  }
  if (data.monitored) {
    weight += 0.25;
  }

  // Connection state affects weight
  if (data.connectionState === 'active') {
    weight += 0.25;
  } else if (data.connectionState === 'failed') {
    weight -= 0.5;
  }

  return Math.max(0.1, weight);
}

/**
 * Calculate minimum length for edge based on its metadata
 *
 * @param edge - Edge to calculate minlen for
 * @returns Minimum edge length (in ranks)
 */
export function calculateEdgeMinlen(edge: AppEdge): number {
  const data = edge.data || {};
  let minlen = 1;

  // Edges with labels need more space
  if (data.label || (data.labelFields && data.labelFields.length > 0)) {
    minlen += 1;
  }

  // Data flow edges benefit from more separation
  if (data.dataFlow && data.dataFlow !== 'bidirectional') {
    minlen += 1;
  }

  return minlen;
}

// =============================================================================
// Configuration Presets for Common Scenarios
// =============================================================================

/**
 * Configuration preset for compact layouts (many nodes, limited space)
 */
export const COMPACT_EDGE_CONFIG: Partial<EnhancedDagreConfig> = {
  nodesep: 120,
  ranksep: 160,
  edgesep: 30,
  minEdgeSeparationWithLabels: 15,
  optimizeEdgeCrossings: true,
  optimizeEdgeLength: false, // Sacrifice length for compactness
};

/**
 * Configuration preset for spacious layouts (fewer nodes, emphasis on clarity)
 */
export const SPACIOUS_EDGE_CONFIG: Partial<EnhancedDagreConfig> = {
  nodesep: 220,
  ranksep: 300,
  edgesep: 70,
  minEdgeSeparationWithLabels: 30,
  optimizeEdgeCrossings: true,
  optimizeEdgeLength: true,
};

/**
 * Configuration preset for label-heavy diagrams
 */
export const LABEL_OPTIMIZED_CONFIG: Partial<EnhancedDagreConfig> = {
  nodesep: 200,
  ranksep: 280,
  edgesep: 80,
  minEdgeSeparationWithLabels: 40,
  edgeLabelCollisionAvoidance: true,
  labelRotation: false,
};

/**
 * Configuration preset for performance (large graphs)
 */
export const PERFORMANCE_CONFIG: Partial<EnhancedDagreConfig> = {
  ranker: 'tight-tree', // Faster algorithm
  edgeLabelCollisionAvoidance: false, // Skip collision detection
  optimizeEdgeCrossings: false, // Skip crossing optimization
  optimizeEdgeLength: false, // Skip length optimization
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get recommended configuration based on graph characteristics
 *
 * @param nodeCount - Number of nodes
 * @param edgeCount - Number of edges
 * @param labelDensity - Proportion of edges with labels (0-1)
 * @returns Recommended configuration preset
 */
export function getRecommendedConfig(
  nodeCount: number,
  edgeCount: number,
  labelDensity: number
): Partial<EnhancedDagreConfig> {
  // Very large graphs need performance optimization
  if (nodeCount > 100 || edgeCount > 200) {
    return PERFORMANCE_CONFIG;
  }

  // High label density needs label optimization
  if (labelDensity > 0.5) {
    return LABEL_OPTIMIZED_CONFIG;
  }

  // Many nodes benefit from compact layout
  if (nodeCount > 30) {
    return COMPACT_EDGE_CONFIG;
  }

  // Small to medium graphs can use spacious layout
  return SPACIOUS_EDGE_CONFIG;
}

/**
 * Merge user configuration with recommendations
 *
 * @param userConfig - User-provided configuration
 * @param recommended - Recommended configuration
 * @returns Merged configuration with user preferences taking precedence
 */
export function mergeConfigurations(
  userConfig: Partial<EnhancedDagreConfig>,
  recommended: Partial<EnhancedDagreConfig>
): Partial<EnhancedDagreConfig> {
  return {
    ...recommended,
    ...userConfig,
  };
}
