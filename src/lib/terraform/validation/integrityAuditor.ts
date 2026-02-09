/**
 * Post-Import Integrity Auditor
 *
 * Performs comprehensive integrity checks after Terraform import:
 * - No duplicate devices
 * - No orphan nodes
 * - All devices nested in boundaries
 * - All connections valid
 * - Boundary hierarchy intact
 */

import type { AppNode, AppEdge } from '@/core/types/topology.types';
import type {
  IntegrityAuditReport,
  ImportContext,
  AuditStatus,
  AuditIssue,
  AuditRecommendation,
  DuplicateCheckResult,
  BoundaryCheckResult,
  ConnectionCheckResult,
  OrphanCheckResult,
  HierarchyCheckResult,
  ImportStatistics,
} from './types';
import { extractExternalIdFromNode } from './duplicateDetector';
import { validateConnectionSemantics } from './connectionValidator';

/**
 * Check for duplicate nodes by external ID
 */
function checkForDuplicates(nodes: AppNode[]): DuplicateCheckResult {
  const externalIdMap = new Map<string, AppNode[]>();
  const duplicateIds: string[] = [];

  for (const node of nodes) {
    const externalId = extractExternalIdFromNode(node);
    if (externalId) {
      const existing = externalIdMap.get(externalId.fullId) || [];
      existing.push(node);
      externalIdMap.set(externalId.fullId, existing);

      if (existing.length > 1) {
        duplicateIds.push(...existing.map(n => n.id));
      }
    }
  }

  // Dedupe the duplicate IDs list
  const uniqueDuplicateIds = [...new Set(duplicateIds)];

  return {
    passed: uniqueDuplicateIds.length === 0,
    duplicateCount: uniqueDuplicateIds.length,
    duplicateIds: uniqueDuplicateIds,
  };
}

/**
 * Check boundary integrity
 */
function checkBoundaryIntegrity(
  boundaries: AppNode[],
  devices: AppNode[]
): BoundaryCheckResult {
  let orphanedDeviceCount = 0;
  let hierarchyViolations = 0;

  // Check for orphaned devices (no parent boundary)
  for (const device of devices) {
    if (!device.parentId) {
      orphanedDeviceCount++;
    }
  }

  // Check hierarchy violations
  // (This is a simplified check - full validation done in validateBoundaryHierarchy)
  for (const boundary of boundaries) {
    if (boundary.parentId) {
      const parent = boundaries.find(b => b.id === boundary.parentId);
      if (!parent) {
        hierarchyViolations++;
      }
    }
  }

  return {
    passed: orphanedDeviceCount === 0 && hierarchyViolations === 0,
    orphanedDeviceCount,
    hierarchyViolations,
  };
}

/**
 * Check connection integrity
 */
function checkConnectionIntegrity(
  nodes: AppNode[],
  edges: AppEdge[]
): ConnectionCheckResult {
  const result = validateConnectionSemantics(nodes, edges);

  return {
    passed: result.valid,
    invalidEdgeCount: result.invalidEdges.length,
    repairedEdgeCount: result.autoRepairableEdges.length,
  };
}

/**
 * Check for orphan nodes (no connections and no boundary parent)
 */
function checkForOrphans(
  nodes: AppNode[],
  edges: AppEdge[]
): OrphanCheckResult {
  const orphanIds: string[] = [];

  // Build connection map
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }

  // Check each node
  for (const node of nodes) {
    if (node.type === 'boundary') continue; // Boundaries can be "orphans" (root level)

    const hasConnections = connectedNodes.has(node.id);
    const hasParent = !!node.parentId;

    // A node is orphaned if it has no connections AND no parent boundary
    if (!hasConnections && !hasParent) {
      orphanIds.push(node.id);
    }
  }

  return {
    passed: orphanIds.length === 0,
    orphanCount: orphanIds.length,
    orphanIds,
  };
}

/**
 * Check boundary hierarchy integrity
 */
function checkBoundaryHierarchy(boundaries: AppNode[]): HierarchyCheckResult {
  // Simple hierarchy check - look for circular references
  const violations: string[] = [];

  for (const boundary of boundaries) {
    // Check for circular references
    const visited = new Set<string>();
    let current: AppNode | undefined = boundary;

    while (current?.parentId) {
      if (visited.has(current.id)) {
        violations.push(`Circular reference detected at ${current.id}`);
        break;
      }
      visited.add(current.id);
      current = boundaries.find(b => b.id === current?.parentId);
    }
  }

  return {
    passed: violations.length === 0,
    violationCount: violations.length,
    violations,
  };
}

/**
 * Aggregate critical issues from all checks
 */
function aggregateCriticalIssues(
  duplicateCheck: DuplicateCheckResult,
  _boundaryCheck: BoundaryCheckResult,
  connectionCheck: ConnectionCheckResult
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  let issueId = 1;

  // Duplicate issues
  if (!duplicateCheck.passed) {
    issues.push({
      id: `issue-${issueId++}`,
      severity: 'critical',
      category: 'duplicate',
      message: `Found ${duplicateCheck.duplicateCount} duplicate device(s) with the same external ID`,
      affectedNodes: duplicateCheck.duplicateIds,
      suggestedAction: 'Review and remove or rename duplicate devices',
      autoFixable: false,
    });
  }

  // Connection issues
  if (!connectionCheck.passed && connectionCheck.invalidEdgeCount > 0) {
    issues.push({
      id: `issue-${issueId++}`,
      severity: 'critical',
      category: 'connection',
      message: `Found ${connectionCheck.invalidEdgeCount} invalid connection(s) that violate topology rules`,
      affectedNodes: [],
      suggestedAction: 'Review and fix invalid connections (device↔device only)',
      autoFixable: connectionCheck.repairedEdgeCount > 0,
    });
  }

  return issues;
}

/**
 * Aggregate warnings from all checks
 */
function aggregateWarnings(
  orphanCheck: OrphanCheckResult,
  hierarchyCheck: HierarchyCheckResult,
  boundaryCheck: BoundaryCheckResult
): AuditIssue[] {
  const warnings: AuditIssue[] = [];
  let issueId = 100;

  // Orphan warnings
  if (!orphanCheck.passed) {
    warnings.push({
      id: `issue-${issueId++}`,
      severity: 'warning',
      category: 'orphan',
      message: `Found ${orphanCheck.orphanCount} orphaned device(s) with no connections and no parent boundary`,
      affectedNodes: orphanCheck.orphanIds,
      suggestedAction: 'Place orphaned devices inside appropriate boundaries or add connections',
      autoFixable: false,
    });
  }

  // Boundary warnings
  if (boundaryCheck.orphanedDeviceCount > 0) {
    warnings.push({
      id: `issue-${issueId++}`,
      severity: 'warning',
      category: 'boundary',
      message: `Found ${boundaryCheck.orphanedDeviceCount} device(s) not placed inside any boundary`,
      affectedNodes: [],
      suggestedAction: 'Place devices inside appropriate security boundaries (VPC, Subnet, etc.)',
      autoFixable: false,
    });
  }

  // Hierarchy warnings
  if (!hierarchyCheck.passed) {
    warnings.push({
      id: `issue-${issueId++}`,
      severity: 'warning',
      category: 'hierarchy',
      message: `Found ${hierarchyCheck.violationCount} boundary hierarchy violation(s)`,
      affectedNodes: [],
      suggestedAction: hierarchyCheck.violations.join('; '),
      autoFixable: false,
    });
  }

  return warnings;
}

/**
 * Generate recommendations based on issues
 */
function generateRecommendations(
  criticalIssues: AuditIssue[],
  warnings: AuditIssue[]
): AuditRecommendation[] {
  const recommendations: AuditRecommendation[] = [];
  let priority = 1;

  // Critical issue recommendations
  if (criticalIssues.some(i => i.category === 'duplicate')) {
    recommendations.push({
      priority: priority++,
      title: 'Resolve Duplicate Resources',
      description:
        'Multiple devices share the same external ID. This can cause data loss during future imports. ' +
        'Review the duplicate devices and either remove extras or assign unique identifiers.',
      relatedIssues: criticalIssues.filter(i => i.category === 'duplicate').map(i => i.id),
    });
  }

  if (criticalIssues.some(i => i.category === 'connection')) {
    recommendations.push({
      priority: priority++,
      title: 'Fix Invalid Connections',
      description:
        'Some edges connect devices to boundaries or boundaries to each other. ' +
        'CompliNIST requires device-to-device connections only. Boundary relationships should use containment (parentId).',
      relatedIssues: criticalIssues.filter(i => i.category === 'connection').map(i => i.id),
    });
  }

  // Warning recommendations
  if (warnings.some(i => i.category === 'orphan' || i.category === 'boundary')) {
    recommendations.push({
      priority: priority++,
      title: 'Organize Devices into Boundaries',
      description:
        'Some devices are not placed inside security boundaries. ' +
        'For proper RMF compliance, all devices should be organized into appropriate VPCs, subnets, and security zones.',
      relatedIssues: warnings
        .filter(i => i.category === 'orphan' || i.category === 'boundary')
        .map(i => i.id),
    });
  }

  if (warnings.some(i => i.category === 'hierarchy')) {
    recommendations.push({
      priority: priority++,
      title: 'Review Boundary Hierarchy',
      description:
        'The boundary hierarchy has issues (circular references or invalid nesting). ' +
        'Ensure boundaries follow a valid hierarchy: Account > VPC > Subnet > Segment.',
      relatedIssues: warnings.filter(i => i.category === 'hierarchy').map(i => i.id),
    });
  }

  return recommendations;
}

/**
 * Determine overall audit status
 */
function determineOverallStatus(
  criticalIssues: AuditIssue[],
  warnings: AuditIssue[]
): AuditStatus {
  if (criticalIssues.length > 0) {
    return 'fail';
  }
  if (warnings.length > 0) {
    return 'warning';
  }
  return 'pass';
}

/**
 * Perform comprehensive integrity audit
 */
export function performIntegrityAudit(
  nodes: AppNode[],
  edges: AppEdge[],
  importContext: ImportContext
): IntegrityAuditReport {
  // Separate devices and boundaries
  const devices = nodes.filter(n => n.type === 'device');
  const boundaries = nodes.filter(n => n.type === 'boundary');

  // Run all checks
  const duplicateCheck = checkForDuplicates(nodes);
  const boundaryCheck = checkBoundaryIntegrity(boundaries, devices);
  const connectionCheck = checkConnectionIntegrity(nodes, edges);
  const orphanCheck = checkForOrphans(nodes, edges);
  const hierarchyCheck = checkBoundaryHierarchy(boundaries);

  // Aggregate issues
  const criticalIssues = aggregateCriticalIssues(duplicateCheck, boundaryCheck, connectionCheck);
  const warnings = aggregateWarnings(orphanCheck, hierarchyCheck, boundaryCheck);

  // Determine overall status
  const overallStatus = determineOverallStatus(criticalIssues, warnings);

  // Generate recommendations
  const recommendations = generateRecommendations(criticalIssues, warnings);

  return {
    timestamp: new Date().toISOString(),
    importSource: importContext.source,
    projectId: importContext.projectId,
    projectName: importContext.projectName,
    overallStatus,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalBoundaries: boundaries.length,
    totalDevices: devices.length,
    duplicateCheck,
    boundaryCheck,
    connectionCheck,
    orphanCheck,
    hierarchyCheck,
    criticalIssues,
    warnings,
    recommendations,
    statistics: importContext.statistics,
  };
}

/**
 * Create a default import context
 */
export function createImportContext(
  projectId: number,
  projectName: string,
  source: 'terraform' | 'manual' | 'json_import' = 'terraform'
): ImportContext {
  return {
    source,
    projectId,
    projectName,
    statistics: {
      newDevicesImported: 0,
      newBoundariesImported: 0,
      newEdgesImported: 0,
      duplicatesSkipped: 0,
      autoRepairedIssues: 0,
      manualInterventionRequired: 0,
    },
  };
}

/**
 * Update import statistics
 */
export function updateImportStatistics(
  context: ImportContext,
  updates: Partial<ImportStatistics>
): ImportContext {
  return {
    ...context,
    statistics: {
      ...context.statistics,
      ...updates,
    },
  };
}
