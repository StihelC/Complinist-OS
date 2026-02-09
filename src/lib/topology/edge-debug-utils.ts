/**
 * Edge Debug Utilities
 *
 * Provides debug data extraction and manipulation utilities
 * for the edge debug overlay and quality panel components.
 */

import { AppNode, AppEdge, EdgeMetadata } from '@/lib/utils/types';
import {
  EdgeDebugMetrics,
  EdgeVisualizationMetrics,
  calculateEdgeDebugMetrics,
  COLLISION_COLORS,
} from './edge-routing-metrics';
import { Point } from './edge-routing-quality';
import { LabelBoundingBox } from './edge-label-collision';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';

// =============================================================================
// Types
// =============================================================================

/**
 * Debug overlay visibility options
 */
export interface DebugOverlayOptions {
  /** Show edge label bounding boxes */
  showLabelBoundingBoxes: boolean;
  /** Show label-to-label collisions */
  showLabelCollisions: boolean;
  /** Show label-to-node collisions */
  showNodeCollisions: boolean;
  /** Show edge crossings */
  showCrossings: boolean;
  /** Show quality heatmap on edges */
  showHeatmap: boolean;
  /** Show edge metrics on hover */
  showMetricsOnHover: boolean;
  /** Highlight poor quality edges */
  highlightPoorQuality: boolean;
  /** Selected edge ID for detailed view */
  selectedEdgeId: string | null;
}

/**
 * Edge with problem indicators for user-facing tools
 */
export interface EdgeProblem {
  edgeId: string;
  severity: 'warning' | 'error';
  problems: string[];
  suggestedFix: string;
  affectedElements: string[];
}

/**
 * Quick fix action for edge issues
 */
export interface EdgeQuickFix {
  edgeId: string;
  actionType: 'reroute' | 'adjust-label' | 'change-type' | 'split';
  description: string;
  apply: () => Partial<EdgeMetadata>;
}

/**
 * Before/after comparison for optimization preview
 */
export interface OptimizationPreview {
  beforeMetrics: EdgeDebugMetrics;
  afterMetrics: EdgeDebugMetrics;
  improvements: {
    qualityDelta: number;
    crossingsReduced: number;
    collisionsResolved: number;
    lengthReduced: number;
  };
}

// =============================================================================
// Default Options
// =============================================================================

export const DEFAULT_DEBUG_OPTIONS: DebugOverlayOptions = {
  showLabelBoundingBoxes: true,
  showLabelCollisions: true,
  showNodeCollisions: true,
  showCrossings: true,
  showHeatmap: true,
  showMetricsOnHover: true,
  highlightPoorQuality: true,
  selectedEdgeId: null,
};

// =============================================================================
// Problem Detection
// =============================================================================

/**
 * Detect problems for user-facing warning indicators
 */
export function detectEdgeProblems(
  nodes: AppNode[],
  edges: AppEdge[]
): EdgeProblem[] {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const metrics = calculateEdgeDebugMetrics(safeNodes, safeEdges);
  const problems: EdgeProblem[] = [];

  for (const edgeViz of metrics.edgeVisualizations) {
    const edgeProblems: string[] = [];
    const affectedElements: string[] = [];
    let severity: 'warning' | 'error' = 'warning';

    // Check for label collisions
    if (edgeViz.labelCollisions.withLabels.length > 0) {
      edgeProblems.push(`Label overlaps with ${edgeViz.labelCollisions.withLabels.length} other label(s)`);
      affectedElements.push(...edgeViz.labelCollisions.withLabels);
      severity = 'error';
    }

    if (edgeViz.labelCollisions.withNodes.length > 0) {
      edgeProblems.push(`Label overlaps with ${edgeViz.labelCollisions.withNodes.length} node(s)`);
      affectedElements.push(...edgeViz.labelCollisions.withNodes);
      severity = 'error';
    }

    // Check for crossings
    if (edgeViz.crossingCount > 2) {
      edgeProblems.push(`Edge crosses ${edgeViz.crossingCount} other edges`);
      affectedElements.push(...edgeViz.crossingEdgeIds);
      if (edgeViz.crossingCount > 4) severity = 'error';
    }

    // Check for poor quality
    if (edgeViz.qualityRating === 'poor') {
      if (edgeViz.length > 400) {
        edgeProblems.push('Edge is very long, consider moving nodes closer');
      }
      if (edgeViz.bendCount > 2) {
        edgeProblems.push('Edge has many bends, consider different routing');
      }
    }

    if (edgeProblems.length > 0) {
      problems.push({
        edgeId: edgeViz.edgeId,
        severity,
        problems: edgeProblems,
        suggestedFix: generateSuggestedFix(edgeViz),
        affectedElements,
      });
    }
  }

  return problems;
}

/**
 * Generate a suggested fix description for an edge problem
 */
function generateSuggestedFix(edgeViz: EdgeVisualizationMetrics): string {
  if (edgeViz.labelCollisions.withLabels.length > 0 || edgeViz.labelCollisions.withNodes.length > 0) {
    return 'Use Auto-Tidy to automatically resolve label collisions';
  }

  if (edgeViz.crossingCount > 2) {
    return 'Reorganize connected nodes to reduce crossings';
  }

  if (edgeViz.length > 400) {
    return 'Move source or target node closer together';
  }

  return 'Run Auto-Tidy to optimize edge routing';
}

/**
 * Check if any edges have problems
 */
export function hasEdgeProblems(nodes: AppNode[], edges: AppEdge[]): boolean {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const problems = detectEdgeProblems(safeNodes, safeEdges);
  return problems.length > 0;
}

/**
 * Get problem count by severity
 */
export function countProblemsBySeverity(
  problems: EdgeProblem[]
): { warnings: number; errors: number } {
  let warnings = 0;
  let errors = 0;

  for (const problem of problems) {
    if (problem.severity === 'warning') warnings++;
    else errors++;
  }

  return { warnings, errors };
}

// =============================================================================
// Quick Fix Generation
// =============================================================================

/**
 * Generate quick fix suggestions for an edge
 */
export function generateQuickFixes(
  edge: AppEdge,
  edgeViz: EdgeVisualizationMetrics
): EdgeQuickFix[] {
  const fixes: EdgeQuickFix[] = [];

  // Label collision fix: change label position
  if (edgeViz.labelCollisions.withLabels.length > 0 || edgeViz.labelCollisions.withNodes.length > 0) {
    fixes.push({
      edgeId: edge.id,
      actionType: 'adjust-label',
      description: 'Hide edge label temporarily',
      apply: () => ({ label: '', labelFields: [] }),
    });
  }

  // Crossing fix: try different edge type
  if (edgeViz.crossingCount > 0) {
    const currentType = edge.data?.edgeType || 'default';
    const alternativeTypes: Array<'straight' | 'step' | 'smoothstep'> = ['straight', 'step', 'smoothstep'];
    const suggestedType = alternativeTypes.find(t => t !== currentType) || 'straight';

    fixes.push({
      edgeId: edge.id,
      actionType: 'change-type',
      description: `Change routing to ${suggestedType}`,
      apply: () => ({ edgeType: suggestedType }),
    });
  }

  return fixes;
}

// =============================================================================
// Overlay Rendering Helpers
// =============================================================================

/**
 * Calculate bounding box style for SVG/Canvas rendering
 */
export function getBoundingBoxStyle(
  box: LabelBoundingBox,
  type: 'label' | 'collision' | 'nodeCollision'
): {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  strokeDasharray?: string;
} {
  const colors = {
    label: {
      stroke: COLLISION_COLORS.boundingBox,
      fill: 'transparent',
    },
    collision: {
      stroke: COLLISION_COLORS.labelToLabel,
      fill: 'rgba(249, 115, 22, 0.1)',
    },
    nodeCollision: {
      stroke: COLLISION_COLORS.labelToNode,
      fill: 'rgba(220, 38, 38, 0.1)',
    },
  };

  const style = colors[type];

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    stroke: style.stroke,
    strokeWidth: type === 'label' ? 1 : 2,
    fill: style.fill,
    strokeDasharray: type === 'label' ? '4,4' : undefined,
  };
}

/**
 * Calculate crossing indicator position and style
 */
export function getCrossingIndicatorStyle(
  intersectionPoint: Point
): {
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
} {
  return {
    cx: intersectionPoint.x,
    cy: intersectionPoint.y,
    r: 6,
    stroke: COLLISION_COLORS.crossing,
    strokeWidth: 2,
    fill: 'rgba(139, 92, 246, 0.3)',
  };
}

/**
 * Get edge stroke style based on quality heatmap
 */
export function getHeatmapEdgeStyle(
  edgeViz: EdgeVisualizationMetrics
): {
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
} {
  return {
    stroke: edgeViz.heatmapColor,
    strokeWidth: edgeViz.qualityRating === 'poor' ? 4 : edgeViz.qualityRating === 'fair' ? 3 : 2,
    strokeOpacity: 0.8,
  };
}

// =============================================================================
// Edge Selection & Filtering
// =============================================================================

/**
 * Filter edges by quality rating
 */
export function filterEdgesByQuality(
  metrics: EdgeDebugMetrics,
  rating: 'good' | 'fair' | 'poor' | 'all'
): EdgeVisualizationMetrics[] {
  if (rating === 'all') {
    return metrics.edgeVisualizations;
  }
  return metrics.edgeVisualizations.filter(e => e.qualityRating === rating);
}

/**
 * Filter edges with problems
 */
export function filterEdgesWithProblems(
  metrics: EdgeDebugMetrics
): EdgeVisualizationMetrics[] {
  return metrics.edgeVisualizations.filter(e =>
    e.crossingCount > 0 ||
    e.labelCollisions.withLabels.length > 0 ||
    e.labelCollisions.withNodes.length > 0 ||
    e.qualityRating === 'poor'
  );
}

/**
 * Get specific edge visualization by ID
 */
export function getEdgeVisualization(
  metrics: EdgeDebugMetrics,
  edgeId: string
): EdgeVisualizationMetrics | undefined {
  return metrics.edgeVisualizations.find(e => e.edgeId === edgeId);
}

// =============================================================================
// Status Indicators
// =============================================================================

/**
 * Get status indicator data for topology status panel
 */
export function getEdgeQualityStatus(
  nodes: AppNode[],
  edges: AppEdge[]
): {
  qualityScore: number;
  qualityGrade: string;
  totalIssues: number;
  crossings: number;
  labelCollisions: number;
  status: 'good' | 'warning' | 'error';
  statusMessage: string;
} {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  if (safeEdges.length === 0) {
    return {
      qualityScore: 100,
      qualityGrade: 'A',
      totalIssues: 0,
      crossings: 0,
      labelCollisions: 0,
      status: 'good',
      statusMessage: 'No edges to analyze',
    };
  }

  const metrics = calculateEdgeDebugMetrics(safeNodes, safeEdges);
  const qualityScore = Math.round(metrics.quality.overallScore * 100);

  let qualityGrade: string;
  if (qualityScore >= 90) qualityGrade = 'A';
  else if (qualityScore >= 80) qualityGrade = 'B';
  else if (qualityScore >= 70) qualityGrade = 'C';
  else if (qualityScore >= 60) qualityGrade = 'D';
  else qualityGrade = 'F';

  const totalIssues =
    metrics.quality.metrics.totalCrossings +
    metrics.quality.metrics.labelCollisionCount;

  let status: 'good' | 'warning' | 'error';
  let statusMessage: string;

  if (qualityScore >= 80 && totalIssues === 0) {
    status = 'good';
    statusMessage = 'Edge routing is optimal';
  } else if (qualityScore >= 60 || totalIssues <= 3) {
    status = 'warning';
    statusMessage = `${totalIssues} routing issue${totalIssues !== 1 ? 's' : ''} detected`;
  } else {
    status = 'error';
    statusMessage = 'Significant routing problems - consider Auto-Tidy';
  }

  return {
    qualityScore,
    qualityGrade,
    totalIssues,
    crossings: metrics.quality.metrics.totalCrossings,
    labelCollisions: metrics.quality.metrics.labelCollisionCount,
    status,
    statusMessage,
  };
}

// =============================================================================
// Node Bounding Box for Label-Node Collision Display
// =============================================================================

/**
 * Get node bounding box for collision visualization
 */
export function getNodeBoundingBox(node: AppNode): LabelBoundingBox {
  const width = node.measured?.width || node.width ||
    (node.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH);
  const height = node.measured?.height || node.height ||
    (node.type === 'boundary'
      ? LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT
      : LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT);

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
    edgeId: node.id, // Using node ID here
  };
}

// =============================================================================
// Developer Console Integration
// =============================================================================

/**
 * Create debug data object for console inspection
 */
export function createDebugDataObject(
  nodes: AppNode[],
  edges: AppEdge[]
): {
  metrics: EdgeDebugMetrics;
  problems: EdgeProblem[];
  status: ReturnType<typeof getEdgeQualityStatus>;
  edgeDetails: Map<string, EdgeVisualizationMetrics>;
} {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const metrics = calculateEdgeDebugMetrics(safeNodes, safeEdges);
  const problems = detectEdgeProblems(safeNodes, safeEdges);
  const status = getEdgeQualityStatus(safeNodes, safeEdges);

  const edgeDetails = new Map<string, EdgeVisualizationMetrics>();
  for (const viz of metrics.edgeVisualizations) {
    edgeDetails.set(viz.edgeId, viz);
  }

  return {
    metrics,
    problems,
    status,
    edgeDetails,
  };
}

/**
 * Log detailed edge analysis to console
 */
export function logEdgeAnalysisToConsole(
  nodes: AppNode[],
  edges: AppEdge[]
): void {
  // Safety checks for invalid input
  const safeEdges = Array.isArray(edges) ? edges : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const data = createDebugDataObject(safeNodes, safeEdges);

  console.group('%cEdge Routing Analysis', 'font-size: 14px; font-weight: bold; color: #3b82f6');

  console.log('%cStatus', 'font-weight: bold', data.status);

  console.group('Quality Metrics');
  console.table({
    'Overall Score': `${data.status.qualityScore}%`,
    'Grade': data.status.qualityGrade,
    'Crossings': data.metrics.quality.metrics.totalCrossings,
    'Label Collisions': data.metrics.quality.metrics.labelCollisionCount,
    'Average Length': `${Math.round(data.metrics.summary.averageLength)}px`,
  });
  console.groupEnd();

  if (data.problems.length > 0) {
    console.group('%cProblems', 'color: #ef4444');
    console.table(data.problems.map(p => ({
      Edge: p.edgeId,
      Severity: p.severity,
      Issues: p.problems.join('; '),
    })));
    console.groupEnd();
  }

  console.log('%cFull Debug Data:', 'font-style: italic', data);
  console.groupEnd();
}

// =============================================================================
// Export
// =============================================================================

export const EdgeDebugUtils = {
  detectEdgeProblems,
  hasEdgeProblems,
  countProblemsBySeverity,
  generateQuickFixes,
  getBoundingBoxStyle,
  getCrossingIndicatorStyle,
  getHeatmapEdgeStyle,
  filterEdgesByQuality,
  filterEdgesWithProblems,
  getEdgeVisualization,
  getEdgeQualityStatus,
  getNodeBoundingBox,
  createDebugDataObject,
  logEdgeAnalysisToConsole,
  DEFAULT_DEBUG_OPTIONS,
};
