/**
 * Edge Routing Metrics Utility
 *
 * Provides comprehensive metrics calculation and visualization data
 * for edge debugging and quality assessment tools.
 *
 * This module extends edge-routing-quality.ts with additional
 * visualization-specific metrics and formatting utilities.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import {
  calculateEdgeRoutingQuality,
  EdgeRoutingQualityResult,
  EdgeMetrics,
  getQualityGrade,
  Point,
} from './edge-routing-quality';
import {
  resolveEdgeLabelCollisions,
  LabelCollisionResult,
  LabelBoundingBox,
  createLabelBoundingBox,
  calculateLabelCenter,
  estimateLabelDimensions,
} from './edge-label-collision';
import { DEFAULT_EDGE_LABEL_CONFIG } from './dagre-config';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';

// =============================================================================
// Types
// =============================================================================

/**
 * Extended edge metrics with visualization data
 */
export interface EdgeVisualizationMetrics extends EdgeMetrics {
  /** Source node position (center) */
  sourcePosition: Point;
  /** Target node position (center) */
  targetPosition: Point;
  /** Label position (center) */
  labelPosition: Point | null;
  /** Label bounding box for visualization */
  labelBoundingBox: LabelBoundingBox | null;
  /** Whether this edge has a label */
  hasLabel: boolean;
  /** Quality rating for this specific edge */
  qualityRating: 'good' | 'fair' | 'poor';
  /** Color to use for heatmap visualization */
  heatmapColor: string;
  /** List of crossing edge IDs */
  crossingEdgeIds: string[];
  /** Label collision info if any */
  labelCollisions: {
    withLabels: string[];
    withNodes: string[];
  };
}

/**
 * Comprehensive debug metrics for edge visualization
 */
export interface EdgeDebugMetrics {
  /** Overall quality result */
  quality: EdgeRoutingQualityResult;
  /** Per-edge visualization data */
  edgeVisualizations: EdgeVisualizationMetrics[];
  /** Summary statistics */
  summary: {
    totalEdges: number;
    edgesWithLabels: number;
    edgesWithCrossings: number;
    edgesWithLabelCollisions: number;
    goodQualityEdges: number;
    fairQualityEdges: number;
    poorQualityEdges: number;
    averageLength: number;
    longestEdge: { id: string; length: number } | null;
    shortestEdge: { id: string; length: number } | null;
  };
  /** Label collision result for overlay rendering */
  labelCollisionResult: LabelCollisionResult;
  /** Crossing pairs for drawing crossing indicators */
  crossingPairs: Array<{
    edgeA: string;
    edgeB: string;
    intersectionPoint: Point;
  }>;
}

/**
 * Quality thresholds for edge rating
 */
export interface QualityThresholds {
  /** Max length for 'good' rating (pixels) */
  maxGoodLength: number;
  /** Max length for 'fair' rating (pixels) */
  maxFairLength: number;
  /** Max crossings for 'good' rating */
  maxGoodCrossings: number;
  /** Max crossings for 'fair' rating */
  maxFairCrossings: number;
  /** Max bends for 'good' rating */
  maxGoodBends: number;
  /** Max bends for 'fair' rating */
  maxFairBends: number;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  maxGoodLength: 200,
  maxFairLength: 400,
  maxGoodCrossings: 0,
  maxFairCrossings: 2,
  maxGoodBends: 1,
  maxFairBends: 2,
};

/** Heatmap colors from good (green) to poor (red) */
export const HEATMAP_COLORS = {
  good: '#22c55e',    // green-500
  fair: '#eab308',    // yellow-500
  poor: '#ef4444',    // red-500
  neutral: '#6b7280', // gray-500
};

/** Collision visualization colors */
export const COLLISION_COLORS = {
  labelToLabel: '#f97316',  // orange-500
  labelToNode: '#dc2626',   // red-600
  crossing: '#8b5cf6',      // violet-500
  boundingBox: 'rgba(59, 130, 246, 0.3)', // blue-500 with opacity
};

// =============================================================================
// Quality Rating Functions
// =============================================================================

/**
 * Rate individual edge quality based on metrics
 */
export function rateEdgeQuality(
  metrics: EdgeMetrics,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): 'good' | 'fair' | 'poor' {
  const { length, bendCount, crossingCount } = metrics;

  // Poor if any critical issue
  if (
    length > thresholds.maxFairLength ||
    crossingCount > thresholds.maxFairCrossings ||
    bendCount > thresholds.maxFairBends
  ) {
    return 'poor';
  }

  // Fair if moderate issues
  if (
    length > thresholds.maxGoodLength ||
    crossingCount > thresholds.maxGoodCrossings ||
    bendCount > thresholds.maxGoodBends
  ) {
    return 'fair';
  }

  return 'good';
}

/**
 * Get heatmap color for quality rating
 */
export function getHeatmapColor(rating: 'good' | 'fair' | 'poor'): string {
  return HEATMAP_COLORS[rating];
}

/**
 * Calculate quality score percentage (0-100) from 0-1 score
 */
export function qualityScoreToPercent(score: number): number {
  return Math.round(score * 100);
}

// =============================================================================
// Edge Position Calculations
// =============================================================================

/**
 * Get node center position
 */
function getNodeCenter(node: AppNode): Point {
  const width = node.measured?.width || node.width ||
    (node.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
  const height = node.measured?.height || node.height ||
    (node.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

/**
 * Calculate intersection point of two line segments
 */
function calculateIntersectionPoint(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return null;

  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;
  const t = (dx * d2y - dy * d2x) / cross;

  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y,
  };
}

/**
 * Find all crossing pairs with intersection points
 */
export function findCrossingPairs(
  edges: AppEdge[],
  nodes: AppNode[]
): Array<{ edgeA: string; edgeB: string; intersectionPoint: Point }> {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const crossings: Array<{ edgeA: string; edgeB: string; intersectionPoint: Point }> = [];
  const nodeMap = new Map(safeNodes.map(n => [n.id, n]));

  for (let i = 0; i < safeEdges.length; i++) {
    for (let j = i + 1; j < safeEdges.length; j++) {
      const edgeA = safeEdges[i];
      const edgeB = safeEdges[j];

      // Skip edges that share a node
      if (
        edgeA.source === edgeB.source ||
        edgeA.source === edgeB.target ||
        edgeA.target === edgeB.source ||
        edgeA.target === edgeB.target
      ) {
        continue;
      }

      const sourceA = nodeMap.get(edgeA.source);
      const targetA = nodeMap.get(edgeA.target);
      const sourceB = nodeMap.get(edgeB.source);
      const targetB = nodeMap.get(edgeB.target);

      if (!sourceA || !targetA || !sourceB || !targetB) continue;

      const pA1 = getNodeCenter(sourceA);
      const pA2 = getNodeCenter(targetA);
      const pB1 = getNodeCenter(sourceB);
      const pB2 = getNodeCenter(targetB);

      const intersection = calculateIntersectionPoint(pA1, pA2, pB1, pB2);
      if (intersection) {
        // Check if intersection is within both segments
        const withinA =
          intersection.x >= Math.min(pA1.x, pA2.x) - 1 &&
          intersection.x <= Math.max(pA1.x, pA2.x) + 1 &&
          intersection.y >= Math.min(pA1.y, pA2.y) - 1 &&
          intersection.y <= Math.max(pA1.y, pA2.y) + 1;

        const withinB =
          intersection.x >= Math.min(pB1.x, pB2.x) - 1 &&
          intersection.x <= Math.max(pB1.x, pB2.x) + 1 &&
          intersection.y >= Math.min(pB1.y, pB2.y) - 1 &&
          intersection.y <= Math.max(pB1.y, pB2.y) + 1;

        if (withinA && withinB) {
          crossings.push({
            edgeA: edgeA.id,
            edgeB: edgeB.id,
            intersectionPoint: intersection,
          });
        }
      }
    }
  }

  return crossings;
}

// =============================================================================
// Main Metrics Calculation
// =============================================================================

/**
 * Calculate comprehensive edge debug metrics
 */
export function calculateEdgeDebugMetrics(
  nodes: AppNode[],
  edges: AppEdge[],
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): EdgeDebugMetrics {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  // Get base quality metrics
  const quality = calculateEdgeRoutingQuality(safeNodes, safeEdges);

  // Get label collision result
  const labelCollisionResult = resolveEdgeLabelCollisions(safeEdges, safeNodes, DEFAULT_EDGE_LABEL_CONFIG);

  // Create lookup maps
  const nodeMap = new Map(safeNodes.map(n => [n.id, n]));

  // Build label collision lookup
  const labelCollisionsByEdge = new Map<string, { withLabels: string[]; withNodes: string[] }>();
  for (const edge of safeEdges) {
    labelCollisionsByEdge.set(edge.id, { withLabels: [], withNodes: [] });
  }

  for (const collision of labelCollisionResult.labelCollisions) {
    labelCollisionsByEdge.get(collision.labelA)?.withLabels.push(collision.labelB);
    labelCollisionsByEdge.get(collision.labelB)?.withLabels.push(collision.labelA);
  }

  for (const collision of labelCollisionResult.nodeCollisions) {
    labelCollisionsByEdge.get(collision.labelId)?.withNodes.push(collision.nodeId);
  }

  // Find crossing pairs
  const crossingPairs = findCrossingPairs(safeEdges, safeNodes);

  // Build crossing lookup by edge
  const crossingsByEdge = new Map<string, string[]>();
  for (const edge of safeEdges) {
    crossingsByEdge.set(edge.id, []);
  }
  for (const crossing of crossingPairs) {
    crossingsByEdge.get(crossing.edgeA)?.push(crossing.edgeB);
    crossingsByEdge.get(crossing.edgeB)?.push(crossing.edgeA);
  }

  // Calculate per-edge visualization metrics
  const edgeVisualizations: EdgeVisualizationMetrics[] = [];

  let longestEdge: { id: string; length: number } | null = null;
  let shortestEdge: { id: string; length: number } | null = null;
  let goodCount = 0;
  let fairCount = 0;
  let poorCount = 0;
  let edgesWithLabels = 0;
  let edgesWithCrossings = 0;
  let edgesWithLabelCollisions = 0;

  for (const edge of safeEdges) {
    const baseMetrics = quality.edgeMetrics.find(m => m.edgeId === edge.id);
    if (!baseMetrics) continue;

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourcePosition = getNodeCenter(sourceNode);
    const targetPosition = getNodeCenter(targetNode);

    // Determine if edge has a label
    const { width: labelWidth, height: labelHeight } = estimateLabelDimensions(edge);
    const hasLabel = labelWidth > 0 && labelHeight > 0;

    if (hasLabel) edgesWithLabels++;

    // Calculate label position and bounding box
    let labelPosition: Point | null = null;
    let labelBoundingBox: LabelBoundingBox | null = null;

    if (hasLabel) {
      labelPosition = calculateLabelCenter(
        sourcePosition.x, sourcePosition.y,
        targetPosition.x, targetPosition.y,
        0.5
      );
      labelBoundingBox = createLabelBoundingBox(
        labelPosition,
        labelWidth,
        labelHeight,
        edge.id
      );
    }

    // Rate quality
    const qualityRating = rateEdgeQuality(baseMetrics, thresholds);
    const heatmapColor = getHeatmapColor(qualityRating);

    // Track counts
    if (qualityRating === 'good') goodCount++;
    else if (qualityRating === 'fair') fairCount++;
    else poorCount++;

    const crossingEdgeIds = crossingsByEdge.get(edge.id) || [];
    if (crossingEdgeIds.length > 0) edgesWithCrossings++;

    const labelCollisions = labelCollisionsByEdge.get(edge.id) || { withLabels: [], withNodes: [] };
    if (labelCollisions.withLabels.length > 0 || labelCollisions.withNodes.length > 0) {
      edgesWithLabelCollisions++;
    }

    // Track longest/shortest
    if (!longestEdge || baseMetrics.length > longestEdge.length) {
      longestEdge = { id: edge.id, length: baseMetrics.length };
    }
    if (!shortestEdge || baseMetrics.length < shortestEdge.length) {
      shortestEdge = { id: edge.id, length: baseMetrics.length };
    }

    edgeVisualizations.push({
      ...baseMetrics,
      sourcePosition,
      targetPosition,
      labelPosition,
      labelBoundingBox,
      hasLabel,
      qualityRating,
      heatmapColor,
      crossingEdgeIds,
      labelCollisions,
    });
  }

  return {
    quality,
    edgeVisualizations,
    summary: {
      totalEdges: safeEdges.length,
      edgesWithLabels,
      edgesWithCrossings,
      edgesWithLabelCollisions,
      goodQualityEdges: goodCount,
      fairQualityEdges: fairCount,
      poorQualityEdges: poorCount,
      averageLength: quality.metrics.averageEdgeLength,
      longestEdge,
      shortestEdge,
    },
    labelCollisionResult,
    crossingPairs,
  };
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format quality score for display
 */
export function formatQualityScore(score: number): string {
  const percent = qualityScoreToPercent(score);
  const grade = getQualityGrade(score);
  return `${grade} (${percent}%)`;
}

/**
 * Format length in pixels
 */
export function formatLength(length: number): string {
  return `${Math.round(length)}px`;
}

/**
 * Format edge metrics for console logging
 */
export function formatEdgeMetricsForConsole(metrics: EdgeDebugMetrics): string {
  const lines = [
    '=== Edge Routing Debug Metrics ===',
    '',
    `Overall Quality: ${formatQualityScore(metrics.quality.overallScore)}`,
    '',
    'Summary:',
    `  Total Edges: ${metrics.summary.totalEdges}`,
    `  Edges with Labels: ${metrics.summary.edgesWithLabels}`,
    `  Edges with Crossings: ${metrics.summary.edgesWithCrossings}`,
    `  Label Collisions: ${metrics.summary.edgesWithLabelCollisions}`,
    '',
    'Quality Distribution:',
    `  Good: ${metrics.summary.goodQualityEdges}`,
    `  Fair: ${metrics.summary.fairQualityEdges}`,
    `  Poor: ${metrics.summary.poorQualityEdges}`,
    '',
    'Metrics:',
    `  Total Crossings: ${metrics.quality.metrics.totalCrossings}`,
    `  Total Bends: ${metrics.quality.metrics.totalBends}`,
    `  Average Length: ${formatLength(metrics.summary.averageLength)}`,
  ];

  if (metrics.summary.longestEdge) {
    lines.push(`  Longest Edge: ${metrics.summary.longestEdge.id} (${formatLength(metrics.summary.longestEdge.length)})`);
  }
  if (metrics.summary.shortestEdge) {
    lines.push(`  Shortest Edge: ${metrics.summary.shortestEdge.id} (${formatLength(metrics.summary.shortestEdge.length)})`);
  }

  if (metrics.quality.suggestions.length > 0) {
    lines.push('', 'Suggestions:');
    for (const suggestion of metrics.quality.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Log metrics to developer console
 */
export function logEdgeMetricsToConsole(metrics: EdgeDebugMetrics): void {
  console.group('Edge Routing Debug');
  console.log(formatEdgeMetricsForConsole(metrics));
  console.groupEnd();
}

// =============================================================================
// Export grouped utilities
// =============================================================================

export const EdgeMetricsUtils = {
  calculateEdgeDebugMetrics,
  rateEdgeQuality,
  getHeatmapColor,
  qualityScoreToPercent,
  formatQualityScore,
  formatLength,
  formatEdgeMetricsForConsole,
  logEdgeMetricsToConsole,
  findCrossingPairs,
};
