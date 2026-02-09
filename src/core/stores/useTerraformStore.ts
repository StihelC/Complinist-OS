import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TerraformPlan } from '@/lib/terraform/terraformTypes'
import type { ConversionResult } from '@/lib/terraform/stateConverter'
import { parseTerraformPlan } from '@/lib/terraform/planParser'
import { analyzeDependencies } from '@/lib/terraform/dependencyAnalyzer'
import { convertTerraformPlanToNodesAsync } from '@/lib/terraform/stateConverter'
import { useFlowStore } from './useFlowStore'
import type {
  ResourceCollision,
  CollisionResolution,
  DuplicateDetectionResult,
  BoundaryValidationResult,
  ConnectionValidationResult,
  IntegrityAuditReport,
  ImportStatistics,
} from '@/lib/terraform/validation/types'
import { detectDuplicates, applyCollisionResolutions } from '@/lib/terraform/validation/duplicateDetector'
import { validateBoundaryHierarchy } from '@/lib/terraform/validation/boundaryValidator'
import { validateConnectionSemantics, applyAutoRepairs } from '@/lib/terraform/validation/connectionValidator'
import { performIntegrityAudit, createImportContext, updateImportStatistics } from '@/lib/terraform/validation/integrityAuditor'

interface TerraformState {
  // Existing state
  currentPlan: TerraformPlan | null
  beforeState: ConversionResult | null
  afterState: ConversionResult | null
  viewMode: 'before' | 'after' | 'diff' | 'side-by-side'

  // Validation state (Phase 1-4)
  pendingCollisions: ResourceCollision[] | null
  duplicateDetectionResult: DuplicateDetectionResult | null
  boundaryValidationResult: BoundaryValidationResult | null
  connectionValidationResult: ConnectionValidationResult | null
  auditReport: IntegrityAuditReport | null
  importStatistics: ImportStatistics | null

  // Actions
  loadTerraformPlan: (jsonString: string) => Promise<void>
  loadTerraformPlanWithValidation: (jsonString: string) => Promise<{
    hasCollisions: boolean
    collisions: ResourceCollision[]
  }>
  resolveCollisionsAndImport: (resolutions: Map<number, CollisionResolution>) => Promise<void>
  setViewMode: (mode: 'before' | 'after' | 'diff' | 'side-by-side') => void
  clearValidationState: () => void
  clearAuditReport: () => void
}

export const useTerraformStore = create<TerraformState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentPlan: null,
      beforeState: null,
      afterState: null,
      viewMode: 'diff',

      // Validation state
      pendingCollisions: null,
      duplicateDetectionResult: null,
      boundaryValidationResult: null,
      connectionValidationResult: null,
      auditReport: null,
      importStatistics: null,

      /**
       * Load Terraform plan without validation (original behavior)
       * Use this for quick imports without duplicate checking
       */
      loadTerraformPlan: async (jsonString: string) => {
        const plan = parseTerraformPlan(jsonString)
        const dependencies = analyzeDependencies(plan)

        // Use async version with intelligent device type matching
        const afterState = await convertTerraformPlanToNodesAsync({
          plan,
          resourceMappings: new Map(),
          dependencies,
          layoutStrategy: 'auto',
        })

        // Check for validation warnings (stored in afterState.warnings and afterState.validation)
        if (afterState.warnings && afterState.warnings.length > 0) {
          console.warn('Terraform import validation warnings:', afterState.warnings)
        }

        // Integrate with topology canvas - add imported nodes and edges
        const flowStore = useFlowStore.getState()

        // Add imported nodes to the main canvas (with safety check)
        if (afterState.nodes && Array.isArray(afterState.nodes) && afterState.nodes.length > 0) {
          flowStore.setNodes((existingNodes) => [
            ...existingNodes,
            ...afterState.nodes
          ])
        }

        // Add imported edges to the main canvas (with safety check)
        if (afterState.edges && Array.isArray(afterState.edges) && afterState.edges.length > 0) {
          const existingEdges = flowStore.edges || []
          flowStore.setEdges([...existingEdges, ...afterState.edges])
        }

        set({
          currentPlan: plan,
          afterState,
        })
      },

      /**
       * Load Terraform plan with full validation pipeline
       * Returns collision info if duplicates detected
       */
      loadTerraformPlanWithValidation: async (jsonString: string) => {
        const plan = parseTerraformPlan(jsonString)
        const flowStore = useFlowStore.getState()
        const existingNodes = flowStore.nodes

        // Phase 1: Detect duplicates
        const duplicateResult = detectDuplicates(plan.resource_changes, existingNodes)

        set({
          currentPlan: plan,
          duplicateDetectionResult: duplicateResult,
          pendingCollisions: duplicateResult.collisions.length > 0 ? duplicateResult.collisions : null,
        })

        // If collisions detected, return them for UI to handle
        if (!duplicateResult.isClean) {
          return {
            hasCollisions: true,
            collisions: duplicateResult.collisions,
          }
        }

        // No collisions - proceed with full import
        await get().resolveCollisionsAndImport(new Map())

        return {
          hasCollisions: false,
          collisions: [],
        }
      },

      /**
       * Resolve collisions and complete import with full validation
       */
      resolveCollisionsAndImport: async (resolutions: Map<number, CollisionResolution>) => {
        const state = get()
        const { currentPlan, duplicateDetectionResult } = state

        if (!currentPlan) {
          throw new Error('No plan loaded')
        }

        const flowStore = useFlowStore.getState()
        const existingNodes = flowStore.nodes
        const existingEdges = flowStore.edges
        const dependencies = analyzeDependencies(currentPlan)

        // Get current project info for audit context
        const projectState = flowStore
        const projectId = (projectState as any).currentProjectId || 0
        const projectName = (projectState as any).currentProjectName || 'Unknown Project'

        // Initialize import context
        let importContext = createImportContext(projectId, projectName, 'terraform')

        // Apply collision resolutions if any
        let resourcesToImport = currentPlan.resource_changes
        let duplicatesSkipped = 0

        if (duplicateDetectionResult && duplicateDetectionResult.collisions.length > 0) {
          const resolved = applyCollisionResolutions(duplicateDetectionResult, resolutions)
          resourcesToImport = [...resolved.toImport]

          // Handle replacements
          for (const { existingNode } of resolved.toReplace) {
            // Remove existing node
            flowStore.deleteNode(existingNode.id)
          }

          duplicatesSkipped = resolved.skipped.length
        }

        // Convert resources to nodes
        const afterState = await convertTerraformPlanToNodesAsync({
          plan: { ...currentPlan, resource_changes: resourcesToImport },
          resourceMappings: new Map(),
          dependencies,
          layoutStrategy: 'auto',
        })

        // Phase 2: Validate boundary hierarchy
        const allNodesForValidation = [...existingNodes, ...afterState.nodes]
        const boundaryValidation = validateBoundaryHierarchy(allNodesForValidation, dependencies)

        // Phase 3: Validate connection semantics
        const allEdgesForValidation = [...existingEdges, ...afterState.edges]
        let connectionValidation = validateConnectionSemantics(allNodesForValidation, allEdgesForValidation)

        // Auto-repair edges if possible
        let repairedEdges = afterState.edges
        let autoRepairedCount = 0

        if (connectionValidation.autoRepairableEdges.length > 0) {
          const repairResult = applyAutoRepairs(
            afterState.edges,
            connectionValidation.autoRepairableEdges
          )
          repairedEdges = repairResult.repairedEdges
          autoRepairedCount = connectionValidation.autoRepairableEdges.length

          // Re-validate after repairs
          connectionValidation = validateConnectionSemantics(
            allNodesForValidation,
            [...existingEdges, ...repairedEdges]
          )
        }

        // Update import statistics
        const devicesImported = afterState.nodes.filter(n => n.type === 'device').length
        const boundariesImported = afterState.nodes.filter(n => n.type === 'boundary').length
        const edgesImported = repairedEdges.length

        importContext = updateImportStatistics(importContext, {
          newDevicesImported: devicesImported,
          newBoundariesImported: boundariesImported,
          newEdgesImported: edgesImported,
          duplicatesSkipped,
          autoRepairedIssues: autoRepairedCount,
          manualInterventionRequired: connectionValidation.requiresManualReview.length,
        })

        // Add imported nodes to the main canvas
        if (afterState.nodes.length > 0) {
          flowStore.setNodes((existing) => [...existing, ...afterState.nodes])
        }

        // Add imported edges to the main canvas
        if (repairedEdges.length > 0) {
          flowStore.setEdges([...existingEdges, ...repairedEdges])
        }

        // Phase 4: Perform integrity audit
        const finalNodes = [...existingNodes, ...afterState.nodes]
        const finalEdges = [...existingEdges, ...repairedEdges]
        const auditReport = performIntegrityAudit(finalNodes, finalEdges, importContext)

        set({
          afterState: {
            ...afterState,
            edges: repairedEdges,
          },
          boundaryValidationResult: boundaryValidation,
          connectionValidationResult: connectionValidation,
          auditReport,
          importStatistics: importContext.statistics,
          pendingCollisions: null,
        })
      },

      setViewMode: (mode) => set({ viewMode: mode }),

      clearValidationState: () => set({
        pendingCollisions: null,
        duplicateDetectionResult: null,
        boundaryValidationResult: null,
        connectionValidationResult: null,
        importStatistics: null,
      }),

      clearAuditReport: () => set({ auditReport: null }),
    }),
    { name: 'Terraform Store' }
  )
)
