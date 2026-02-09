/**
 * Edge Routing Quality Metrics
 *
 * Provides aesthetic scoring for edge layouts, measuring:
 * - Total edge length (minimize)
 * - Number of edge crossings (minimize)
 * - Number of edge bends (minimize)
 * - Label collision count (must be zero)
 *
 * Quality scores help evaluate and compare different layout configurations.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import { EdgeQualityConfig, DEFAULT_EDGE_QUALITY_CONFIG, DEFAULT_EDGE_LABEL_CONFIG } from './dagre-config';
import {
  resolveEdgeLabelCollisions,
  getLabelCollisionCount,
  LabelCollisionResult,
} from './edge-label-collision';

// =============================================================================
// Types
// =============================================================================

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Line segment between two points
 */
export interface LineSegment {
  start: Point;
  end: Point;
}

/**
 * Individual edge metrics
 */
export interface EdgeMetrics {
  edgeId: string;
  length: number;
  bendCount: number;
  crossingCount: number;
}

/**
 * Complete edge routing quality result
 */
export interface EdgeRoutingQualityResult {
  /** Overall quality score (0-1, higher is better) */
  overallScore: number;

  /** Individual metric scores (0-1) */
  scores: {
    length: number;
    crossings: number;
    bends: number;
    labelCollisions: number;
  };

  /** Raw metrics */
  metrics: {
    totalEdgeLength: number;
    averageEdgeLength: number;
    maxEdgeLength: number;
    minEdgeLength: number;
    totalCrossings: number;
    totalBends: number;
    labelCollisionCount: number;
  };

  /** Per-edge breakdown */
  edgeMetrics: EdgeMetrics[];

  /** Improvement suggestions */
  suggestions: string[];
}

/**
 * Configuration for edge quality calculation
 */
export interface QualityCalculationOptions {
  /** Include label collision detection */
  checkLabelCollisions: boolean;
  /** Weight configuration for scoring */
  weights: EdgeQualityConfig;
  /** Normalize scores against baseline */
  normalizeAgainstBaseline: boolean;
  /** Baseline values for normalization (auto-calculated if not provided) */
  baseline?: {
    maxLength: number;
    maxCrossings: number;
    maxBends: number;
  };
}

// =============================================================================
// Default Values
// =============================================================================

const DEFAULT_QUALITY_OPTIONS: QualityCalculationOptions = {
  checkLabelCollisions: true,
  weights: DEFAULT_EDGE_QUALITY_CONFIG,
  normalizeAgainstBaseline: true,
};

// =============================================================================
// Geometry Utility Functions
// =============================================================================

/**
 * Calculate Euclidean distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate Manhattan distance between two points
 */
export function calculateManhattanDistance(p1: Point, p2: Point): number {
  return Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
}

/**
 * Check if two line segments intersect
 * Uses cross product method for efficiency
 */
export function segmentsIntersect(seg1: LineSegment, seg2: LineSegment): boolean {
  const { start: p1, end: p2 } = seg1;
  const { start: p3, end: p4 } = seg2;

  // Direction vectors
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  // Cross products
  const cross = d1x * d2y - d1y * d2x;

  // Parallel lines
  if (Math.abs(cross) < 1e-10) return false;

  // Parameter calculation
  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;

  const t = (dx * d2y - dy * d2x) / cross;
  const u = (dx * d1y - dy * d1x) / cross;

  // Check if intersection is within both segments
  // Exclude endpoints to avoid counting connected edges
  const eps = 0.001;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

/**
 * Calculate angle between two vectors (in radians)
 */
export function calculateAngle(v1: Point, v2: Point): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos);
}

// =============================================================================
// Edge Geometry Functions
// =============================================================================

/**
 * Get edge endpoints from node positions
 */
export function getEdgeEndpoints(
  edge: AppEdge,
  nodes: AppNode[]
): LineSegment | null {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) return null;

  // Get node centers
  const sourceWidth = sourceNode.measured?.width || sourceNode.width ||
    (sourceNode.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
  const sourceHeight = sourceNode.measured?.height || sourceNode.height ||
    (sourceNode.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

  const targetWidth = targetNode.measured?.width || targetNode.width ||
    (targetNode.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
  const targetHeight = targetNode.measured?.height || targetNode.height ||
    (targetNode.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

  return {
    start: {
      x: sourceNode.position.x + sourceWidth / 2,
      y: sourceNode.position.y + sourceHeight / 2,
    },
    end: {
      x: targetNode.position.x + targetWidth / 2,
      y: targetNode.position.y + targetHeight / 2,
    },
  };
}

/**
 * Calculate edge length
 */
export function calculateEdgeLength(edge: AppEdge, nodes: AppNode[]): number {
  const segment = getEdgeEndpoints(edge, nodes);
  if (!segment) return 0;

  return calculateDistance(segment.start, segment.end);
}

/**
 * Count bends in an edge path
 * For simple bezier/straight edges, this counts significant direction changes
 */
export function countEdgeBends(
  edge: AppEdge,
  nodes: AppNode[],
  bendThreshold: number = Math.PI / 6 // 30 degrees
): number {
  const edgeType = edge.data?.edgeType || 'default';

  // Straight edges have no bends
  if (edgeType === 'straight') return 0;

  const segment = getEdgeEndpoints(edge, nodes);
  if (!segment) return 0;

  // For step/smoothstep edges, count the implicit bends
  if (edgeType === 'step' || edgeType === 'smoothstep') {
    // These edges have at most 2 bends (one 90-degree turn at each end)
    const dx = Math.abs(segment.end.x - segment.start.x);
    const dy = Math.abs(segment.end.y - segment.start.y);

    // If the edge is mostly horizontal or vertical, fewer bends
    if (dx < 10 || dy < 10) return 0;

    return 2; // Standard orthogonal routing has 2 bends
  }

  // For bezier/default edges, estimate bends from curvature
  // Simple heuristic: count 0 for nearly straight, 1 for moderate curves
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const angle = Math.abs(Math.atan2(dy, dx));

  // Edges close to horizontal or vertical are "straighter"
  const angleFromAxis = Math.min(
    angle,
    Math.abs(angle - Math.PI / 2),
    Math.abs(angle - Math.PI)
  );

  return angleFromAxis > bendThreshold ? 1 : 0;
}

// =============================================================================
// Crossing Detection
// =============================================================================

/**
 * Count total edge crossings in the graph
 */
export function countEdgeCrossings(edges: AppEdge[], nodes: AppNode[]): number {
  let crossings = 0;
  const segments: { segment: LineSegment; edgeId: string }[] = [];

  // Collect all edge segments
  for (const edge of edges) {
    const segment = getEdgeEndpoints(edge, nodes);
    if (segment) {
      segments.push({ segment, edgeId: edge.id });
    }
  }

  // Check all pairs for intersections
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const seg1 = segments[i];
      const seg2 = segments[j];

      // Skip edges that share a node
      const edge1 = edges.find(e => e.id === seg1.edgeId);
      const edge2 = edges.find(e => e.id === seg2.edgeId);

      if (edge1 && edge2) {
        if (
          edge1.source === edge2.source ||
          edge1.source === edge2.target ||
          edge1.target === edge2.source ||
          edge1.target === edge2.target
        ) {
          continue;
        }
      }

      if (segmentsIntersect(seg1.segment, seg2.segment)) {
        crossings++;
      }
    }
  }

  return crossings;
}

/**
 * Get crossings for a specific edge
 */
export function getEdgeCrossings(
  edge: AppEdge,
  allEdges: AppEdge[],
  nodes: AppNode[]
): number {
  const mainSegment = getEdgeEndpoints(edge, nodes);
  if (!mainSegment) return 0;

  let crossings = 0;

  for (const otherEdge of allEdges) {
    if (otherEdge.id === edge.id) continue;

    // Skip edges that share a node
    if (
      edge.source === otherEdge.source ||
      edge.source === otherEdge.target ||
      edge.target === otherEdge.source ||
      edge.target === otherEdge.target
    ) {
      continue;
    }

    const otherSegment = getEdgeEndpoints(otherEdge, nodes);
    if (otherSegment && segmentsIntersect(mainSegment, otherSegment)) {
      crossings++;
    }
  }

  return crossings;
}

// =============================================================================
// Quality Score Calculation
// =============================================================================

/**
 * Calculate normalized score (0-1) where higher is better
 */
function normalizeScore(value: number, maxValue: number, inverse: boolean = true): number {
  if (maxValue === 0) return 1;
  const normalized = Math.min(1, value / maxValue);
  return inverse ? 1 - normalized : normalized;
}

/**
 * Calculate comprehensive edge routing quality metrics
 */
export function calculateEdgeRoutingQuality(
  nodes: AppNode[],
  edges: AppEdge[],
  options: Partial<QualityCalculationOptions> = {}
): EdgeRoutingQualityResult {
  const opts: QualityCalculationOptions = {
    ...DEFAULT_QUALITY_OPTIONS,
    ...options,
    weights: {
      ...DEFAULT_EDGE_QUALITY_CONFIG,
      ...options.weights,
    },
  };

  // Calculate per-edge metrics
  const edgeMetrics: EdgeMetrics[] = [];
  let totalLength = 0;
  let totalBends = 0;
  let maxLength = 0;
  let minLength = Infinity;

  for (const edge of edges) {
    const length = calculateEdgeLength(edge, nodes);
    const bendCount = countEdgeBends(edge, nodes);
    const crossingCount = getEdgeCrossings(edge, edges, nodes);

    edgeMetrics.push({
      edgeId: edge.id,
      length,
      bendCount,
      crossingCount,
    });

    totalLength += length;
    totalBends += bendCount;
    maxLength = Math.max(maxLength, length);
    minLength = Math.min(minLength, length);
  }

  if (minLength === Infinity) minLength = 0;

  // Calculate total crossings
  const totalCrossings = countEdgeCrossings(edges, nodes);

  // Calculate label collisions
  let labelCollisionCount = 0;
  let labelCollisionResult: LabelCollisionResult | null = null;

  if (opts.checkLabelCollisions) {
    labelCollisionResult = resolveEdgeLabelCollisions(edges, nodes, DEFAULT_EDGE_LABEL_CONFIG);
    labelCollisionCount = getLabelCollisionCount(labelCollisionResult);
  }

  // Calculate baseline for normalization
  const baseline = opts.baseline || {
    maxLength: edges.length > 0 ? maxLength * 2 : 500,
    maxCrossings: Math.max(1, (edges.length * (edges.length - 1)) / 4),
    maxBends: edges.length * 2,
  };

  // Calculate normalized scores (0-1, higher is better)
  const avgLength = edges.length > 0 ? totalLength / edges.length : 0;
  const lengthScore = normalizeScore(avgLength, baseline.maxLength);
  const crossingScore = normalizeScore(totalCrossings, baseline.maxCrossings);
  const bendScore = normalizeScore(totalBends, baseline.maxBends);
  const labelCollisionScore = labelCollisionCount === 0 ? 1 : 0;

  // Calculate weighted overall score
  const { lengthWeight, crossingWeight, bendWeight, labelCollisionWeight } = opts.weights;
  const totalWeight = lengthWeight + crossingWeight + bendWeight + labelCollisionWeight;

  const overallScore = totalWeight > 0
    ? (
        lengthScore * lengthWeight +
        crossingScore * crossingWeight +
        bendScore * bendWeight +
        labelCollisionScore * labelCollisionWeight
      ) / totalWeight
    : 0;

  // Generate improvement suggestions
  const suggestions: string[] = [];

  if (crossingScore < 0.7) {
    suggestions.push(
      `High edge crossings (${totalCrossings}). Consider reorganizing node positions or using hierarchical layout.`
    );
  }

  if (bendScore < 0.7) {
    suggestions.push(
      `Many edge bends (${totalBends}). Consider using straight edges or adjusting node placement.`
    );
  }

  if (lengthScore < 0.7 && avgLength > 300) {
    suggestions.push(
      `Long average edge length (${Math.round(avgLength)}px). Consider reducing node spacing or grouping related nodes.`
    );
  }

  if (labelCollisionCount > 0) {
    suggestions.push(
      `Label collisions detected (${labelCollisionCount}). Increase edge separation or enable collision avoidance.`
    );
  }

  if (overallScore > 0.9) {
    suggestions.push('Excellent edge routing quality! Layout is clean and well-organized.');
  }

  return {
    overallScore,
    scores: {
      length: lengthScore,
      crossings: crossingScore,
      bends: bendScore,
      labelCollisions: labelCollisionScore,
    },
    metrics: {
      totalEdgeLength: totalLength,
      averageEdgeLength: avgLength,
      maxEdgeLength: maxLength,
      minEdgeLength: minLength,
      totalCrossings,
      totalBends,
      labelCollisionCount,
    },
    edgeMetrics,
    suggestions,
  };
}

// =============================================================================
// Comparison and Improvement Functions
// =============================================================================

/**
 * Compare two layout quality results
 */
export function compareQuality(
  before: EdgeRoutingQualityResult,
  after: EdgeRoutingQualityResult
): {
  improvement: number;
  breakdown: {
    length: number;
    crossings: number;
    bends: number;
    labelCollisions: number;
  };
  summary: string;
} {
  const improvement = after.overallScore - before.overallScore;

  const breakdown = {
    length: after.scores.length - before.scores.length,
    crossings: after.scores.crossings - before.scores.crossings,
    bends: after.scores.bends - before.scores.bends,
    labelCollisions: after.scores.labelCollisions - before.scores.labelCollisions,
  };

  let summary: string;
  const improvementPercent = Math.round(improvement * 100);

  if (improvement > 0.1) {
    summary = `Significant improvement (+${improvementPercent}% quality)`;
  } else if (improvement > 0) {
    summary = `Slight improvement (+${improvementPercent}% quality)`;
  } else if (improvement < -0.1) {
    summary = `Quality decreased (${improvementPercent}% quality)`;
  } else {
    summary = 'Quality unchanged';
  }

  // Add specific improvements to summary
  const improvements: string[] = [];
  if (breakdown.crossings > 0.2) {
    improvements.push('fewer crossings');
  }
  if (breakdown.bends > 0.2) {
    improvements.push('fewer bends');
  }
  if (breakdown.length > 0.2) {
    improvements.push('shorter edges');
  }
  if (breakdown.labelCollisions > 0) {
    improvements.push('resolved label collisions');
  }

  if (improvements.length > 0) {
    summary += ` (${improvements.join(', ')})`;
  }

  return { improvement, breakdown, summary };
}

/**
 * Calculate target improvement for crossing reduction
 */
export function calculateCrossingReductionTarget(
  currentCrossings: number,
  targetReduction: number = 0.3
): number {
  return Math.max(0, Math.floor(currentCrossings * (1 - targetReduction)));
}

/**
 * Check if quality meets minimum threshold
 */
export function meetsQualityThreshold(
  result: EdgeRoutingQualityResult,
  minOverallScore: number = 0.7,
  maxLabelCollisions: number = 0
): boolean {
  return (
    result.overallScore >= minOverallScore &&
    result.metrics.labelCollisionCount <= maxLabelCollisions
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get quality grade (A-F) from score
 */
export function getQualityGrade(score: number): string {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B';
  if (score >= 0.7) return 'C';
  if (score >= 0.6) return 'D';
  return 'F';
}

/**
 * Format quality result as human-readable summary
 */
export function formatQualitySummary(result: EdgeRoutingQualityResult): string {
  const grade = getQualityGrade(result.overallScore);
  const scorePercent = Math.round(result.overallScore * 100);

  const lines = [
    `Edge Routing Quality: ${grade} (${scorePercent}%)`,
    '',
    'Metrics:',
    `  - Edge Crossings: ${result.metrics.totalCrossings}`,
    `  - Edge Bends: ${result.metrics.totalBends}`,
    `  - Avg Edge Length: ${Math.round(result.metrics.averageEdgeLength)}px`,
    `  - Label Collisions: ${result.metrics.labelCollisionCount}`,
  ];

  if (result.suggestions.length > 0) {
    lines.push('', 'Suggestions:');
    for (const suggestion of result.suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  return lines.join('\n');
}
