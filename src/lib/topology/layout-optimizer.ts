/**
 * Intelligent Layout Optimizer
 *
 * Analyzes graph structure and automatically determines optimal layout settings
 * to minimize overlaps, improve spacing, and enhance readability.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import { TidyOptions, SpacingTier } from './auto-tidy';
import { layoutLogger } from './layoutLogger';

/**
 * Graph complexity metrics for layout optimization
 */
export interface GraphMetrics {
  /** Total number of nodes */
  totalNodes: number;
  /** Total number of edges */
  totalEdges: number;
  /** Number of boundaries */
  boundaryCount: number;
  /** Maximum nesting depth */
  maxDepth: number;
  /** Average children per boundary */
  avgChildrenPerBoundary: number;
  /** Number of cross-boundary edges */
  crossBoundaryEdges: number;
  /** Edge density (edges / possible edges) */
  edgeDensity: number;
  /** Nodes without parents (orphans) */
  orphanNodes: number;
  /** Complexity score (0-100) */
  complexityScore: number;
}

/**
 * Recommended layout configuration based on graph analysis
 */
export interface LayoutRecommendation {
  /** Recommended spacing tier */
  spacingTier: SpacingTier;
  /** Recommended number of passes */
  tidyPasses: number;
  /** Reasoning for recommendation */
  reasoning: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Calculate depth of a node in the hierarchy
 */
function getNodeDepth(nodeId: string, nodes: AppNode[], memo: Map<string, number> = new Map()): number {
  if (memo.has(nodeId)) return memo.get(nodeId)!;

  const node = nodes.find(n => n.id === nodeId);
  if (!node || !node.parentId) {
    memo.set(nodeId, 0);
    return 0;
  }

  const depth = 1 + getNodeDepth(node.parentId, nodes, memo);
  memo.set(nodeId, depth);
  return depth;
}

/**
 * Analyze graph structure and compute metrics
 */
export function analyzeGraph(nodes: AppNode[], edges: AppEdge[]): GraphMetrics {
  const boundaries = nodes.filter(n => n.type === 'boundary');
  const devices = nodes.filter(n => n.type !== 'boundary');

  // Calculate max depth
  const depthMemo = new Map<string, number>();
  let maxDepth = 0;
  for (const node of nodes) {
    const depth = getNodeDepth(node.id, nodes, depthMemo);
    maxDepth = Math.max(maxDepth, depth);
  }

  // Calculate children per boundary
  const childrenCounts = boundaries.map(b =>
    nodes.filter(n => n.parentId === b.id).length
  );
  const avgChildrenPerBoundary = childrenCounts.length > 0
    ? childrenCounts.reduce((sum, c) => sum + c, 0) / childrenCounts.length
    : 0;

  // Count cross-boundary edges (edges connecting nodes in different boundaries)
  let crossBoundaryEdges = 0;
  for (const edge of edges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (sourceNode && targetNode && sourceNode.parentId !== targetNode.parentId) {
      crossBoundaryEdges++;
    }
  }

  // Calculate edge density
  const possibleEdges = nodes.length * (nodes.length - 1) / 2;
  const edgeDensity = possibleEdges > 0 ? edges.length / possibleEdges : 0;

  // Count orphan nodes (nodes without parents that aren't boundaries)
  const orphanNodes = devices.filter(n => !n.parentId).length;

  // Calculate complexity score (0-100)
  // Higher scores mean more complex graphs needing better layout engines
  let complexityScore = 0;
  complexityScore += Math.min(maxDepth * 15, 30); // Depth contributes up to 30 points
  complexityScore += Math.min(crossBoundaryEdges * 5, 25); // Cross-boundary edges up to 25
  complexityScore += Math.min(edgeDensity * 50, 20); // Edge density up to 20
  complexityScore += Math.min(orphanNodes * 10, 15); // Orphans up to 15
  complexityScore += Math.min(boundaries.length * 2, 10); // Boundary count up to 10

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    boundaryCount: boundaries.length,
    maxDepth,
    avgChildrenPerBoundary,
    crossBoundaryEdges,
    edgeDensity,
    orphanNodes,
    complexityScore: Math.round(complexityScore),
  };
}

/**
 * Get recommended layout configuration based on graph metrics
 */
export function getLayoutRecommendation(metrics: GraphMetrics): LayoutRecommendation {
  const reasoning: string[] = [];

  // Determine spacing based on node count and complexity
  let spacingTier: SpacingTier = 'comfortable';

  if (metrics.totalNodes > 30 || metrics.complexityScore >= 60) {
    spacingTier = 'compact';
    reasoning.push(`Many nodes (${metrics.totalNodes}) or high complexity - using compact spacing`);
  } else if (metrics.totalNodes < 10 && metrics.complexityScore < 30) {
    spacingTier = 'spacious';
    reasoning.push(`Few nodes (${metrics.totalNodes}) and low complexity - using spacious spacing`);
  } else {
    reasoning.push(`Moderate complexity (${metrics.complexityScore}/100) - using comfortable spacing`);
  }

  // Calculate optimal number of passes based on hierarchy depth
  // Deep hierarchies need more passes to propagate layout changes
  let tidyPasses = 2;
  if (metrics.maxDepth >= 3) {
    tidyPasses = Math.min(metrics.maxDepth + 2, 6);
    reasoning.push(`Deep nesting (${metrics.maxDepth} levels) - using ${tidyPasses} passes`);
  } else if (metrics.maxDepth > 0) {
    tidyPasses = metrics.maxDepth + 1;
    reasoning.push(`Nested boundaries - using ${tidyPasses} passes`);
  }

  reasoning.push(`Using Dagre layout engine with optimized settings`);

  return {
    spacingTier,
    tidyPasses,
    reasoning,
    confidence: 0.9,
  };
}

/**
 * Optimize layout options automatically based on graph analysis
 */
export function optimizeLayoutOptions(
  nodes: AppNode[],
  edges: AppEdge[],
  userOptions: Partial<TidyOptions> = {}
): TidyOptions {
  const metrics = analyzeGraph(nodes, edges);
  const recommendation = getLayoutRecommendation(metrics);

  layoutLogger.debug('[Layout Optimizer] Graph Metrics:', metrics);
  layoutLogger.debug('[Layout Optimizer] Recommendation:', recommendation);
  layoutLogger.debug('[Layout Optimizer] Reasoning:');
  recommendation.reasoning.forEach(r => layoutLogger.debug(`  - ${r}`));

  // Merge user options with recommendations (user options take priority)
  const optimizedOptions: Partial<TidyOptions> = {
    spacingTier: userOptions.spacingTier || recommendation.spacingTier,
    tidyPasses: userOptions.tidyPasses || recommendation.tidyPasses,
    fixedPasses: userOptions.fixedPasses !== undefined ? userOptions.fixedPasses : false,
    ...userOptions,
  };

  return optimizedOptions as TidyOptions;
}

/**
 * Fix orphaned nodes by assigning them to appropriate boundaries
 */
export function fixOrphanNodes(nodes: AppNode[]): AppNode[] {
  const boundaries = nodes.filter(n => n.type === 'boundary');
  const orphans = nodes.filter(n => n.type !== 'boundary' && !n.parentId);

  if (orphans.length === 0) return nodes;

  layoutLogger.debug(`[Layout Optimizer] Found ${orphans.length} orphaned nodes, attempting to fix...`);

  const updatedNodes = [...nodes];

  for (const orphan of orphans) {
    // Find closest boundary that could contain this node
    // Strategy: Use the largest root-level boundary (usually the main container)
    const rootBoundaries = boundaries.filter(b => !b.parentId);

    if (rootBoundaries.length > 0) {
      // Pick the largest boundary (by area)
      const largestBoundary = rootBoundaries.reduce((largest, b) => {
        const bArea = (b.width || 400) * (b.height || 400);
        const largestArea = (largest.width || 400) * (largest.height || 400);
        return bArea > largestArea ? b : largest;
      });

      const nodeIndex = updatedNodes.findIndex(n => n.id === orphan.id);
      if (nodeIndex !== -1) {
        layoutLogger.debug(`  - Assigning "${orphan.data.name}" to boundary "${largestBoundary.data.label}"`);

        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          parentId: largestBoundary.id,
          extent: 'parent' as const,
          // Reset position to be laid out by algorithm
          position: { x: 45, y: 45 },
        };
      }
    }
  }

  return updatedNodes;
}

/**
 * Smart tidy: Analyze graph, fix issues, apply optimal layout
 */
export async function smartTidy(
  nodes: AppNode[],
  edges: AppEdge[],
  userOptions: Partial<TidyOptions> = {}
): Promise<{ nodes: AppNode[]; options: TidyOptions; metrics: GraphMetrics }> {
  layoutLogger.info('[Smart Tidy] Starting intelligent layout optimization...');

  // Step 1: Fix orphaned nodes
  const fixedNodes = fixOrphanNodes(nodes);

  // Step 2: Analyze graph
  const metrics = analyzeGraph(fixedNodes, edges);

  // Step 3: Get optimal layout options
  const optimizedOptions = optimizeLayoutOptions(fixedNodes, edges, userOptions);

  layoutLogger.debug('[Smart Tidy] Using optimized options:', {
    spacing: optimizedOptions.spacingTier,
    passes: optimizedOptions.tidyPasses,
  });

  return {
    nodes: fixedNodes,
    options: optimizedOptions,
    metrics,
  };
}
