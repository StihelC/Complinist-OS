/**
 * Layout Validator
 *
 * Post-layout validation and automatic fixes for common issues.
 * Catches and resolves overlaps, boundary violations, and other problems.
 *
 * @module layout-validator
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import type { LayoutDimensions } from './layout-dimensions';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import { layoutLogger } from './layoutLogger';

// =============================================================================
// Types
// =============================================================================

export interface NodeOverlap {
  node1Id: string;
  node2Id: string;
  overlapArea: number;
  overlapPercent: number;
}

export interface BoundaryViolation {
  boundaryId: string;
  childId: string;
  violation: 'outside' | 'insufficient-padding';
  details: string;
}

export interface EdgeIssue {
  edgeId: string;
  issue: 'crosses-node' | 'too-long' | 'invalid-connection';
  details: string;
}

export interface ValidationResult {
  passed: boolean;
  overlaps: NodeOverlap[];
  boundaryViolations: BoundaryViolation[];
  edgeIssues: EdgeIssue[];
  summary: string;
}

// =============================================================================
// Overlap Detection
// =============================================================================

/**
 * Check if two nodes overlap
 */
function checkNodeOverlap(
  node1: AppNode,
  node2: AppNode,
  dims1: LayoutDimensions,
  dims2: LayoutDimensions
): NodeOverlap | null {
  // Skip if nodes have different parents (can overlap visually)
  if (node1.parentId !== node2.parentId) {
    return null;
  }

  // Calculate bounds
  const rect1 = {
    left: node1.position.x,
    right: node1.position.x + dims1.visual.width,
    top: node1.position.y,
    bottom: node1.position.y + dims1.visual.height,
  };

  const rect2 = {
    left: node2.position.x,
    right: node2.position.x + dims2.visual.width,
    top: node2.position.y,
    bottom: node2.position.y + dims2.visual.height,
  };

  // Check for overlap
  const overlapLeft = Math.max(rect1.left, rect2.left);
  const overlapRight = Math.min(rect1.right, rect2.right);
  const overlapTop = Math.max(rect1.top, rect2.top);
  const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

  const overlapWidth = overlapRight - overlapLeft;
  const overlapHeight = overlapBottom - overlapTop;

  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return null; // No overlap
  }

  const overlapArea = overlapWidth * overlapHeight;
  const area1 = dims1.visual.width * dims1.visual.height;
  const area2 = dims2.visual.width * dims2.visual.height;
  const smallerArea = Math.min(area1, area2);
  const overlapPercent = (overlapArea / smallerArea) * 100;

  return {
    node1Id: node1.id,
    node2Id: node2.id,
    overlapArea,
    overlapPercent,
  };
}

/**
 * Detect all node overlaps
 */
export function detectNodeOverlaps(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>
): NodeOverlap[] {
  const overlaps: NodeOverlap[] = [];

  // Only check device nodes (boundaries can overlap visually)
  const devices = nodes.filter(n => n.type === 'device');

  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const node1 = devices[i];
      const node2 = devices[j];

      const dims1 = dimensionsMap.get(node1.id);
      const dims2 = dimensionsMap.get(node2.id);

      if (!dims1 || !dims2) continue;

      const overlap = checkNodeOverlap(node1, node2, dims1, dims2);
      if (overlap) {
        overlaps.push(overlap);
      }
    }
  }

  return overlaps;
}

// =============================================================================
// Boundary Violation Detection
// =============================================================================

/**
 * Check if child is properly contained within boundary
 */
function checkBoundaryContainment(
  boundary: AppNode,
  child: AppNode,
  boundaryDims: LayoutDimensions,
  childDims: LayoutDimensions
): BoundaryViolation | null {
  const padding = LAYOUT_CONSTANTS.BOUNDARY_PADDING;

  // Child bounds (relative to boundary)
  const childLeft = child.position.x;
  const childRight = child.position.x + childDims.visual.width;
  const childTop = child.position.y;
  const childBottom = child.position.y + childDims.visual.height;

  // Boundary bounds
  const boundaryWidth = boundaryDims.visual.width;
  const boundaryHeight = boundaryDims.visual.height;

  // Check if child is outside boundary
  if (
    childLeft < 0 ||
    childRight > boundaryWidth ||
    childTop < 0 ||
    childBottom > boundaryHeight
  ) {
    return {
      boundaryId: boundary.id,
      childId: child.id,
      violation: 'outside',
      details: `Child at (${childLeft}, ${childTop}) extends beyond boundary (${boundaryWidth}×${boundaryHeight})`,
    };
  }

  // Check if child is too close to edges (insufficient padding)
  if (
    childLeft < padding ||
    childRight > boundaryWidth - padding ||
    childTop < padding ||
    childBottom > boundaryHeight - padding
  ) {
    return {
      boundaryId: boundary.id,
      childId: child.id,
      violation: 'insufficient-padding',
      details: `Child needs at least ${padding}px padding from boundary edges`,
    };
  }

  return null;
}

/**
 * Detect all boundary violations
 */
export function detectBoundaryViolations(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  const boundaries = nodes.filter(n => n.type === 'boundary');

  for (const boundary of boundaries) {
    const children = nodes.filter(n => n.parentId === boundary.id);
    const boundaryDims = dimensionsMap.get(boundary.id);

    if (!boundaryDims) continue;

    for (const child of children) {
      const childDims = dimensionsMap.get(child.id);
      if (!childDims) continue;

      const violation = checkBoundaryContainment(boundary, child, boundaryDims, childDims);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  return violations;
}

// =============================================================================
// Edge Issue Detection
// =============================================================================

/**
 * Detect edge routing issues (basic checks)
 */
export function detectEdgeIssues(
  nodes: AppNode[],
  edges: AppEdge[],
  _dimensionsMap: Map<string, LayoutDimensions>
): EdgeIssue[] {
  const issues: EdgeIssue[] = [];

  for (const edge of edges) {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);

    // Check if source/target exist
    if (!source || !target) {
      issues.push({
        edgeId: edge.id,
        issue: 'invalid-connection',
        details: `Edge connects to non-existent node (source: ${edge.source}, target: ${edge.target})`,
      });
      continue;
    }

    // Check if edge is extremely long (might indicate layout issue)
    const distance = Math.sqrt(
      Math.pow(target.position.x - source.position.x, 2) +
      Math.pow(target.position.y - source.position.y, 2)
    );

    if (distance > 2000) {
      issues.push({
        edgeId: edge.id,
        issue: 'too-long',
        details: `Edge length ${Math.round(distance)}px exceeds reasonable limit`,
      });
    }
  }

  return issues;
}

// =============================================================================
// Automatic Fixes
// =============================================================================

/**
 * Attempt to resolve overlaps by slightly shifting nodes
 */
export function resolveOverlaps(
  nodes: AppNode[],
  overlaps: NodeOverlap[],
  dimensionsMap: Map<string, LayoutDimensions>
): AppNode[] {
  if (overlaps.length === 0) return nodes;

  layoutLogger.debug(`[LayoutValidator] Resolving ${overlaps.length} overlaps...`);

  let result = [...nodes];

  for (const overlap of overlaps) {
    const node1Index = result.findIndex(n => n.id === overlap.node1Id);
    const node2Index = result.findIndex(n => n.id === overlap.node2Id);

    if (node1Index === -1 || node2Index === -1) continue;

    const node2 = result[node2Index];
    const dims2 = dimensionsMap.get(node2.id);

    if (!dims2) continue;

    // Simple fix: shift node2 to the right by overlap amount + buffer
    const shiftAmount = 20; // 20px buffer
    result[node2Index] = {
      ...node2,
      position: {
        x: node2.position.x + shiftAmount,
        y: node2.position.y,
      },
    };
  }

  return result;
}

/**
 * Fix boundary violations by adjusting child positions
 */
export function fixBoundaryViolations(
  nodes: AppNode[],
  violations: BoundaryViolation[],
  dimensionsMap: Map<string, LayoutDimensions>
): AppNode[] {
  if (violations.length === 0) return nodes;

  layoutLogger.debug(`[LayoutValidator] Fixing ${violations.length} boundary violations...`);

  let result = [...nodes];

  for (const violation of violations) {
    const childIndex = result.findIndex(n => n.id === violation.childId);
    const boundary = result.find(n => n.id === violation.boundaryId);

    if (childIndex === -1 || !boundary) continue;

    const child = result[childIndex];
    const childDims = dimensionsMap.get(child.id);
    const boundaryDims = dimensionsMap.get(boundary.id);

    if (!childDims || !boundaryDims) continue;

    // Clamp child position within boundary with padding
    const padding = LAYOUT_CONSTANTS.BOUNDARY_PADDING;
    const maxX = boundaryDims.visual.width - childDims.visual.width - padding;
    const maxY = boundaryDims.visual.height - childDims.visual.height - padding;

    result[childIndex] = {
      ...child,
      position: {
        x: Math.max(padding, Math.min(child.position.x, maxX)),
        y: Math.max(padding, Math.min(child.position.y, maxY)),
      },
    };
  }

  return result;
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate layout and automatically fix issues
 *
 * @param nodes - Nodes after layout
 * @param dimensionsMap - Dimension data for all nodes
 * @param edges - Edges in the topology
 * @returns Validated and potentially adjusted nodes
 */
export function validateAndAdjust(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>,
  edges: AppEdge[]
): AppNode[] {
  layoutLogger.debug('[LayoutValidator] Running post-layout validation...');

  // Detect issues
  const overlaps = detectNodeOverlaps(nodes, dimensionsMap);
  const boundaryViolations = detectBoundaryViolations(nodes, dimensionsMap);
  const edgeIssues = detectEdgeIssues(nodes, edges, dimensionsMap);

  // Log findings
  if (overlaps.length > 0) {
    layoutLogger.warn(`[LayoutValidator] Found ${overlaps.length} node overlaps`);
  }
  if (boundaryViolations.length > 0) {
    layoutLogger.warn(`[LayoutValidator] Found ${boundaryViolations.length} boundary violations`);
  }
  if (edgeIssues.length > 0) {
    layoutLogger.warn(`[LayoutValidator] Found ${edgeIssues.length} edge issues`);
  }

  // Apply fixes
  let result = nodes;

  if (overlaps.length > 0) {
    result = resolveOverlaps(result, overlaps, dimensionsMap);
  }

  if (boundaryViolations.length > 0) {
    result = fixBoundaryViolations(result, boundaryViolations, dimensionsMap);
  }

  // Note: Edge issues are logged but not auto-fixed (layout algorithm's responsibility)

  const totalIssues = overlaps.length + boundaryViolations.length + edgeIssues.length;
  layoutLogger.info('[LayoutValidator] Validation complete', {
    overlaps: overlaps.length,
    boundaryViolations: boundaryViolations.length,
    edgeIssues: edgeIssues.length,
    totalIssues
  });

  return result;
}

/**
 * Run validation without fixes (for reporting only)
 */
export function validate(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>,
  edges: AppEdge[]
): ValidationResult {
  const overlaps = detectNodeOverlaps(nodes, dimensionsMap);
  const boundaryViolations = detectBoundaryViolations(nodes, dimensionsMap);
  const edgeIssues = detectEdgeIssues(nodes, edges, dimensionsMap);

  const passed = overlaps.length === 0 && boundaryViolations.length === 0 && edgeIssues.length === 0;

  const summary = passed
    ? 'Layout validation passed - no issues found'
    : `Found ${overlaps.length} overlaps, ${boundaryViolations.length} boundary violations, ${edgeIssues.length} edge issues`;

  return {
    passed,
    overlaps,
    boundaryViolations,
    edgeIssues,
    summary,
  };
}

export default {
  detectNodeOverlaps,
  detectBoundaryViolations,
  detectEdgeIssues,
  resolveOverlaps,
  fixBoundaryViolations,
  validateAndAdjust,
  validate,
};
