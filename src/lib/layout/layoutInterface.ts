/**
 * Layout Interface - Common types for layout algorithms
 *
 * This module defines the common interface for all layout algorithms (Dagre, ELKjs).
 * It provides a unified way to configure and execute layouts across different engines.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';

/**
 * Available layout algorithms
 */
export type LayoutAlgorithm = 'dagre' | 'elkjs';

/**
 * ELK-specific algorithm variants
 * - layered: Good for directed graphs with clear hierarchy (default)
 * - mrtree: Optimized for tree-like structures, more compact
 */
export type ElkAlgorithmVariant = 'layered' | 'mrtree';

/**
 * Layout direction - maps to both Dagre and ELK directions
 */
export type LayoutDirection = 'DOWN' | 'UP' | 'RIGHT' | 'LEFT';

/**
 * Node alignment options for ELK
 */
export type ElkAlignment = 'AUTOMATIC' | 'BEGIN' | 'CENTER' | 'END';

/**
 * Port constraints for ELK nodes
 */
export type ElkPortConstraints = 'UNDEFINED' | 'FREE' | 'FIXED_SIDE' | 'FIXED_ORDER' | 'FIXED_POS';

/**
 * Hierarchy handling mode for ELK
 */
export type ElkHierarchyHandling = 'INHERIT' | 'INCLUDE_CHILDREN' | 'SEPARATE_CHILDREN';

/**
 * MrTree edge routing mode
 */
export type MrTreeEdgeRoutingMode = 'AVOID_OVERLAP' | 'BEND_POINTS';

/**
 * MrTree search order
 */
export type MrTreeSearchOrder = 'DFS' | 'BFS';

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
 * Spacing tier for quick spacing adjustments
 */
export type SpacingTier = 'compact' | 'comfortable' | 'spacious';

/**
 * Unified layout options for all algorithms
 */
export interface LayoutOptions {
  /** Layout algorithm to use */
  algorithm: LayoutAlgorithm;
  /** Direction of the layout */
  direction: LayoutDirection;
  /** Horizontal spacing between nodes */
  horizontalSpacing: number;
  /** Vertical spacing between nodes */
  verticalSpacing: number;
  /** Space between sibling nodes at the same level */
  nodeSpacing?: number;
  /** Space between hierarchy levels (ranks) */
  rankSpacing?: number;
  /** Padding inside boundaries */
  boundaryPadding?: number;
  /** Extra spacing for nested boundaries */
  nestedBoundarySpacing?: number;
  /** Edge routing type */
  edgeRouting?: EdgeRoutingType;
  /** Spacing tier for quick adjustments */
  spacingTier?: SpacingTier;
  /** Whether to animate the transition */
  animate?: boolean;
  /** Animation duration in milliseconds */
  animationDuration?: number;
  /** Whether to auto-resize boundaries to fit children */
  autoResize?: boolean;
  /** ELK algorithm variant (only used when algorithm is 'elkjs') */
  elkAlgorithm?: ElkAlgorithmVariant;

  // === ELK-specific options (GRAPH section) ===
  /** Node alignment within their layer */
  elkAlignment?: ElkAlignment;
  /** Edge spacing for routing */
  elkEdgeSpacing?: number;
  /** Randomization seed for deterministic layouts */
  elkRandomSeed?: number;

  // === ELK Node options ===
  /** Port constraints mode */
  elkPortConstraints?: ElkPortConstraints;
  /** Hierarchy handling mode */
  elkHierarchyHandling?: ElkHierarchyHandling;

  // === ELK Sub-graph options ===
  /** Whether to separate disconnected components */
  elkSeparateComponents?: boolean;
  /** Whether to enable compaction */
  elkCompaction?: boolean;
  /** Component spacing */
  elkComponentSpacing?: number;

  // === MrTree specific options (when elkAlgorithm is 'mrtree') ===
  /** Edge routing mode for MrTree */
  mrTreeEdgeRoutingMode?: MrTreeEdgeRoutingMode;
  /** Edge end texture length */
  mrTreeEdgeEndTextureLength?: number;
  /** Search order for tree traversal */
  mrTreeSearchOrder?: MrTreeSearchOrder;
}

/**
 * Result of a layout operation
 */
export interface LayoutResult {
  /** Updated nodes with new positions */
  nodes: AppNode[];
  /** Updated edges (may have new routing info) */
  edges?: AppEdge[];
  /** Statistics about the layout operation */
  stats: LayoutStats;
}

/**
 * Statistics from a layout operation
 */
export interface LayoutStats {
  /** Total nodes processed */
  totalNodes: number;
  /** Number of boundaries processed */
  boundariesProcessed: number;
  /** Number of devices repositioned */
  devicesRepositioned: number;
  /** Time taken in milliseconds */
  processingTimeMs: number;
}

/**
 * Default layout options
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  algorithm: 'elkjs',
  elkAlgorithm: 'mrtree',
  direction: 'RIGHT',
  horizontalSpacing: 50,
  verticalSpacing: 50,
  nodeSpacing: 40,
  rankSpacing: 60,
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  edgeRouting: 'smart',
  spacingTier: 'comfortable',
  animate: true,
  animationDuration: 300,
  autoResize: true,
  // ELK Graph options
  elkAlignment: 'AUTOMATIC',
  elkEdgeSpacing: 10,
  elkRandomSeed: 1,
  // ELK Node options
  elkPortConstraints: 'UNDEFINED',
  elkHierarchyHandling: 'INCLUDE_CHILDREN',
  // ELK Sub-graph options
  elkSeparateComponents: false,
  elkCompaction: false,
  elkComponentSpacing: 20,
  // MrTree options
  mrTreeEdgeRoutingMode: 'AVOID_OVERLAP',
  mrTreeEdgeEndTextureLength: 7,
  mrTreeSearchOrder: 'DFS',
};

/**
 * Convert layout direction to Dagre rankdir
 */
export function directionToDagreRankdir(direction: LayoutDirection): 'TB' | 'BT' | 'LR' | 'RL' {
  switch (direction) {
    case 'DOWN': return 'TB';
    case 'UP': return 'BT';
    case 'RIGHT': return 'LR';
    case 'LEFT': return 'RL';
  }
}

/**
 * Convert layout direction to ELK direction
 */
export function directionToElkDirection(direction: LayoutDirection): string {
  return direction;
}

/**
 * Convert Dagre rankdir to layout direction
 */
export function dagreRankdirToDirection(rankdir: 'TB' | 'BT' | 'LR' | 'RL'): LayoutDirection {
  switch (rankdir) {
    case 'TB': return 'DOWN';
    case 'BT': return 'UP';
    case 'LR': return 'RIGHT';
    case 'RL': return 'LEFT';
  }
}
