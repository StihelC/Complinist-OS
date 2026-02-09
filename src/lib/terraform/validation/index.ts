/**
 * Terraform Import Validation Module
 *
 * Provides comprehensive validation for Terraform imports:
 * - Phase 1: Duplicate Resource Protection
 * - Phase 2: Boundary Enforcement & Nesting Validation
 * - Phase 3: Connection Semantics Verification
 * - Phase 4: Post-Import Integrity Audit
 */

// Types
export * from './types';

// Phase 1: External ID Generation & Duplicate Detection
export {
  generateExternalId,
  generateExternalIdAsync,
  generateDeterministicHash,
  generateDeterministicHashAsync,
  normalizeProviderName,
  parseExternalId,
  externalIdsMatch,
  matchesTerraformAddress,
} from './externalIdGenerator';

// Phase 1: Duplicate Detection
export {
  detectDuplicates,
  buildExternalIdMap,
  buildTerraformAddressMap,
  extractExternalIdFromNode,
  getTerraformAddressFromNode,
  findByTerraformAddress,
  findByName,
  applyCollisionResolutions,
  generateDetectionSummary,
} from './duplicateDetector';

// Phase 2: Boundary Validation
export {
  validateBoundaryHierarchy,
  buildHierarchyTree,
  findContainingBoundaries,
  findInnermostBoundary,
  identifyMissingBoundaries,
  generateAutoCreateSuggestions,
  autoCreateMissingBoundaries,
  validateHierarchyLevels,
  generateBoundaryValidationSummary,
} from './boundaryValidator';

// Phase 3: Connection Validation
export {
  validateConnectionSemantics,
  classifyConnectionSemantics,
  suggestRepair,
  applyAutoRepairs,
  generateConnectionValidationSummary,
} from './connectionValidator';

// Phase 4: Integrity Audit
export {
  performIntegrityAudit,
  createImportContext,
  updateImportStatistics,
} from './integrityAuditor';

export {
  generateAuditReportMarkdown,
  generateAuditReportJSON,
  generateAuditReportHTML,
  generateAuditSummary,
} from './auditReportGenerator';
