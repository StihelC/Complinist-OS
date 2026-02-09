/**
 * Terraform Import Validation Types
 *
 * Types for the 4-phase validation system:
 * - Phase 1: Duplicate Resource Protection
 * - Phase 2: Boundary Enforcement & Nesting Validation
 * - Phase 3: Connection Semantics Verification
 * - Phase 4: Post-Import Integrity Audit
 */

import type { TerraformResourceChange } from '../terraformTypes';
import type { AppNode, AppEdge, BoundaryType } from '@/core/types/topology.types';

// =============================================================================
// Phase 1: Duplicate Resource Protection
// =============================================================================

/**
 * External ID for tracking Terraform resources in CompliNIST
 * Format: provider:type:name:hash
 * Example: "hashicorp/aws:aws_instance:web_server:a1b2c3d4"
 */
export interface ExternalResourceId {
  /** Normalized provider name (e.g., "hashicorp/aws") */
  provider: string;
  /** Terraform resource type (e.g., "aws_instance") */
  resourceType: string;
  /** Resource name from Terraform (e.g., "web_server") */
  resourceName: string;
  /** Optional module address for module-scoped resources */
  moduleAddress?: string;
  /** SHA-256 hash (first 8 chars) of provider+type+name+module */
  deterministicHash: string;
  /** Full concatenated ID for comparison */
  fullId: string;
}

/**
 * Collision types when detecting duplicates
 */
export type CollisionType = 'exact_match' | 'same_address' | 'same_name';

/**
 * Resolution options for resource collisions
 */
export type CollisionResolution = 'skip' | 'replace' | 'create_new' | 'manual';

/**
 * Represents a collision between an incoming Terraform resource
 * and an existing topology node
 */
export interface ResourceCollision {
  /** The incoming Terraform resource that caused the collision */
  incomingResource: TerraformResourceChange;
  /** External ID computed for the incoming resource */
  incomingExternalId: ExternalResourceId;
  /** The existing node in the topology */
  existingNode: AppNode;
  /** External ID of the existing node (if available) */
  existingExternalId: ExternalResourceId | null;
  /** Type of collision detected */
  collisionType: CollisionType;
  /** User-selected resolution (set during conflict resolution) */
  resolution?: CollisionResolution;
}

/**
 * Result of duplicate detection phase
 */
export interface DuplicateDetectionResult {
  /** Resources that are safe to import (no collisions) */
  newResources: TerraformResourceChange[];
  /** Resources that collide with existing topology */
  collisions: ResourceCollision[];
  /** Map of terraform addresses to existing nodes (for reference tracking) */
  existingReferences: Map<string, AppNode>;
  /** True if no collisions were detected */
  isClean: boolean;
}

// =============================================================================
// Phase 2: Boundary Enforcement & Nesting Validation
// =============================================================================

/**
 * Boundary hierarchy levels (from highest to lowest)
 */
export type BoundaryHierarchyLevel = 'account' | 'region' | 'vpc' | 'subnet' | 'segment';

/**
 * Confidence level for boundary resolution
 */
export type ResolutionConfidence = 'high' | 'medium' | 'low';

/**
 * Resolution details for a device's parent boundary
 */
export interface BoundaryResolution {
  /** Terraform address of the resource */
  resourceAddress: string;
  /** ID of the resolved parent boundary (null if orphaned) */
  resolvedParentBoundary: string | null;
  /** Hierarchy level of the resolved boundary */
  hierarchyLevel: BoundaryHierarchyLevel | null;
  /** Confidence in the resolution */
  confidence: ResolutionConfidence;
  /** IDs of boundaries auto-created during resolution */
  autoCreatedBoundaries: string[];
}

/**
 * A boundary that should exist but doesn't
 */
export interface MissingBoundary {
  /** Expected hierarchy level */
  expectedLevel: BoundaryHierarchyLevel;
  /** Terraform address that referenced this boundary */
  inferredFrom: string;
  /** Suggested label for the boundary */
  suggestedLabel: string;
  /** Suggested boundary type */
  suggestedType: BoundaryType;
  /** Whether it's safe to auto-create */
  canAutoCreate: boolean;
  /** Reason if cannot auto-create */
  cannotCreateReason?: string;
}

/**
 * Suggestion for auto-creating a missing boundary
 */
export interface AutoCreateSuggestion {
  /** The missing boundary info */
  missingBoundary: MissingBoundary;
  /** Suggested position for the new boundary */
  suggestedPosition: { x: number; y: number };
  /** Suggested dimensions */
  suggestedDimensions: { width: number; height: number };
  /** Parent boundary ID (if nested) */
  parentBoundaryId?: string;
}

/**
 * Node in the boundary hierarchy tree
 */
export interface BoundaryHierarchyNode {
  /** Boundary node ID */
  boundaryId: string;
  /** Boundary type */
  boundaryType: BoundaryType;
  /** Nesting level (0 = root) */
  level: number;
  /** Parent boundary ID (null for root) */
  parentId: string | null;
  /** Child boundary IDs */
  childBoundaries: string[];
  /** Device IDs contained directly in this boundary */
  containedDevices: string[];
  /** Terraform address if imported from Terraform */
  terraformAddress?: string;
}

/**
 * Result of boundary validation phase
 */
export interface BoundaryValidationResult {
  /** True if all boundary validations pass */
  valid: boolean;
  /** Device IDs that have no parent boundary */
  devicesWithoutBoundary: string[];
  /** Device IDs that appear in multiple boundaries (invalid state) */
  devicesInMultipleBoundaries: string[];
  /** Boundaries that should exist but don't */
  missingBoundaries: MissingBoundary[];
  /** Resolved boundary hierarchy tree */
  boundaryHierarchy: BoundaryHierarchyNode[];
  /** Suggestions for auto-creating missing boundaries */
  autoCreateSuggestions: AutoCreateSuggestion[];
  /** Per-device boundary resolution details */
  resolutions: BoundaryResolution[];
}

// =============================================================================
// Phase 3: Connection Semantics Verification
// =============================================================================

/**
 * Connection semantic types
 */
export type ConnectionSemantics =
  | 'device_to_device'      // Valid: network connection between devices
  | 'boundary_containment'  // Valid but should use parentId, not edges
  | 'device_to_boundary'    // Invalid: devices connect to devices, not boundaries
  | 'boundary_to_device'    // Invalid: boundaries don't connect to devices
  | 'boundary_network';     // Invalid: boundaries don't have network connections

/**
 * Repair action for invalid edges
 */
export type EdgeRepairAction = 'remove' | 'convert_to_containment' | 'reroute';

/**
 * Suggestion for repairing an invalid edge
 */
export interface EdgeRepairSuggestion {
  /** Action to take */
  action: EdgeRepairAction;
  /** Human-readable description of the repair */
  description: string;
  /** New edge configuration (for reroute action) */
  newEdge?: Partial<AppEdge>;
}

/**
 * An edge that violates connection semantics
 */
export interface InvalidEdge {
  /** The invalid edge */
  edge: AppEdge;
  /** The semantic violation type */
  semantics: ConnectionSemantics;
  /** Human-readable reason for invalidity */
  reason: string;
  /** Type of the source node */
  sourceNodeType: 'device' | 'boundary';
  /** Type of the target node */
  targetNodeType: 'device' | 'boundary';
}

/**
 * An invalid edge that can be automatically repaired
 */
export interface AutoRepairableEdge extends InvalidEdge {
  /** Suggested repair for this edge */
  suggestedRepair: EdgeRepairSuggestion;
}

/**
 * Result of connection validation phase
 */
export interface ConnectionValidationResult {
  /** True if all connections are valid */
  valid: boolean;
  /** Edges that pass validation */
  validEdges: AppEdge[];
  /** All invalid edges (including auto-repairable) */
  invalidEdges: InvalidEdge[];
  /** Invalid edges that can be automatically repaired */
  autoRepairableEdges: AutoRepairableEdge[];
  /** Invalid edges requiring manual review */
  requiresManualReview: InvalidEdge[];
}

// =============================================================================
// Phase 4: Post-Import Integrity Audit
// =============================================================================

/**
 * Severity levels for audit issues
 */
export type AuditSeverity = 'critical' | 'warning' | 'info';

/**
 * Categories for audit issues
 */
export type AuditCategory = 'duplicate' | 'boundary' | 'connection' | 'orphan' | 'hierarchy';

/**
 * Overall audit status
 */
export type AuditStatus = 'pass' | 'warning' | 'fail';

/**
 * An issue found during integrity audit
 */
export interface AuditIssue {
  /** Unique ID for this issue */
  id: string;
  /** Severity of the issue */
  severity: AuditSeverity;
  /** Category of the issue */
  category: AuditCategory;
  /** Human-readable message */
  message: string;
  /** Node IDs affected by this issue */
  affectedNodes: string[];
  /** Suggested action to resolve */
  suggestedAction: string;
  /** Whether this issue can be auto-fixed */
  autoFixable: boolean;
}

/**
 * Recommendation for improving topology integrity
 */
export interface AuditRecommendation {
  /** Priority (1 = highest) */
  priority: number;
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Related audit issues */
  relatedIssues: string[];
}

/**
 * Statistics from the import operation
 */
export interface ImportStatistics {
  /** Number of new devices imported */
  newDevicesImported: number;
  /** Number of new boundaries imported */
  newBoundariesImported: number;
  /** Number of new edges imported */
  newEdgesImported: number;
  /** Number of duplicates that were skipped */
  duplicatesSkipped: number;
  /** Number of issues auto-repaired */
  autoRepairedIssues: number;
  /** Number of issues requiring manual intervention */
  manualInterventionRequired: number;
}

/**
 * Check results for each audit category
 */
export interface DuplicateCheckResult {
  /** True if no duplicates found */
  passed: boolean;
  /** Number of duplicates detected */
  duplicateCount: number;
  /** Duplicate device IDs */
  duplicateIds: string[];
}

export interface BoundaryCheckResult {
  /** True if all boundary rules pass */
  passed: boolean;
  /** Number of devices without boundaries */
  orphanedDeviceCount: number;
  /** Number of boundary hierarchy violations */
  hierarchyViolations: number;
}

export interface ConnectionCheckResult {
  /** True if all connections are valid */
  passed: boolean;
  /** Number of invalid edges */
  invalidEdgeCount: number;
  /** Number of edges auto-repaired */
  repairedEdgeCount: number;
}

export interface OrphanCheckResult {
  /** True if no orphans found */
  passed: boolean;
  /** Number of orphaned nodes (no connections and no boundary) */
  orphanCount: number;
  /** Orphaned node IDs */
  orphanIds: string[];
}

export interface HierarchyCheckResult {
  /** True if hierarchy is valid */
  passed: boolean;
  /** Number of hierarchy violations */
  violationCount: number;
  /** Description of violations */
  violations: string[];
}

/**
 * Context for the import operation
 */
export interface ImportContext {
  /** Source of the import */
  source: 'terraform' | 'manual' | 'json_import';
  /** Project ID being imported into */
  projectId: number;
  /** Project name */
  projectName: string;
  /** Import statistics (populated during import) */
  statistics: ImportStatistics;
}

/**
 * Complete integrity audit report
 */
export interface IntegrityAuditReport {
  /** Timestamp of the audit */
  timestamp: string;
  /** Source of the import */
  importSource: 'terraform' | 'manual' | 'json_import';
  /** Project ID */
  projectId: number;
  /** Project name */
  projectName: string;

  /** Overall audit status */
  overallStatus: AuditStatus;

  /** Total counts */
  totalNodes: number;
  totalEdges: number;
  totalBoundaries: number;
  totalDevices: number;

  /** Detailed check results */
  duplicateCheck: DuplicateCheckResult;
  boundaryCheck: BoundaryCheckResult;
  connectionCheck: ConnectionCheckResult;
  orphanCheck: OrphanCheckResult;
  hierarchyCheck: HierarchyCheckResult;

  /** Actionable items */
  criticalIssues: AuditIssue[];
  warnings: AuditIssue[];
  recommendations: AuditRecommendation[];

  /** Import statistics */
  statistics: ImportStatistics;
}

// =============================================================================
// Validation Pipeline Types
// =============================================================================

/**
 * Combined result from all validation phases
 */
export interface ValidationPipelineResult {
  /** Phase 1 result */
  duplicateDetection: DuplicateDetectionResult;
  /** Phase 2 result */
  boundaryValidation: BoundaryValidationResult;
  /** Phase 3 result */
  connectionValidation: ConnectionValidationResult;
  /** Phase 4 result */
  integrityAudit: IntegrityAuditReport;
  /** Whether all phases passed without critical issues */
  allPassed: boolean;
  /** Whether import can proceed (may have warnings but no blockers) */
  canProceed: boolean;
}
