/**
 * Store Exports
 *
 * This file exports all Zustand stores for the application.
 *
 * Store Architecture (7 bounded domains):
 * =========================================
 *
 * 1. CORE STORES (Standalone)
 *    - useFlowStore: Diagram topology, projects, UI state
 *    - useAuthStore: License-based authentication
 *    - useDocumentStore: User document management
 *    - useTerraformStore: Terraform visualization
 *    - useDeltaTrackingStore: Incremental save tracking (internal)
 *
 * 2. UNIFIED AI STORE (Facade over 3 AI stores)
 *    - useAIStore: Single interface for all AI functionality
 *      ├── useAIServiceStore: Service health & status
 *      ├── useNISTQueryStore: NIST document queries
 *      └── useAINarrativesStore: AI narrative generation
 *
 * 3. UNIFIED COMPLIANCE STORE (Facade over 5 compliance stores)
 *    - useComplianceStore: Single interface for compliance
 *      ├── useControlNarrativesStore: Control implementations
 *      ├── useControlSelectionStore: Control selection
 *      ├── useSSPMetadataStore: SSP metadata
 *      ├── useSSPTemplateStore: SSP templates
 *      └── useOrganizationDefaultsStore: Organization defaults
 *
 * Migration Guide:
 * ================
 * For new code, prefer using the unified stores (useAIStore, useComplianceStore)
 * for cleaner imports and better separation of concerns.
 *
 * Individual stores are still exported for backward compatibility
 * and for cases where you need granular subscriptions.
 */

// ============================================================================
// Core Stores (Standalone)
// ============================================================================

export { useFlowStore } from './useFlowStore';
export { useAuthStore } from './useAuthStore';
export { useDocumentStore } from './useDocumentStore';
export { useTerraformStore } from './useTerraformStore';
export { useDeltaTrackingStore } from './deltaTrackingStore';

// ============================================================================
// Unified AI Store (Recommended for AI functionality)
// ============================================================================

export {
  useAIStore,
  useAIServiceStatus,
  useNISTQueryStreaming,
  useNarrativeStatus,
  useChatHistory,
  getAIState,
  initializeAI,
  checkAIHealth,
} from './useAIStore';

// Individual AI stores (for backward compatibility and granular subscriptions)
export { useAIServiceStore } from './useAIServiceStore';
export { useNISTQueryStore } from './useNISTQueryStore';
export { useAINarrativesStore } from './useAINarrativesStore';

// ============================================================================
// Unified Compliance Store (Recommended for compliance functionality)
// ============================================================================

export {
  useComplianceStore,
  useSelectedControls,
  useControlNarrative,
  useControlLoadingState,
  useSSPState,
  useTemplatesList,
  useGenerationProgress,
  getComplianceState,
  loadControlsForProject,
  saveAllNarratives,
  getSelectedControlCount,
} from './useComplianceStore';

// Individual compliance stores (for backward compatibility)
export { useControlNarrativesStore } from './useControlNarrativesStore';
export { useControlSelectionStore } from './useControlSelectionStore';
export { useSSPMetadataStore } from './sspMetadataStore';
export { useSSPTemplateStore } from './useSSPTemplateStore';
export { useOrganizationDefaultsStore } from './useOrganizationDefaultsStore';

// ============================================================================
// Selectors (Re-exported from individual stores)
// ============================================================================

export * from './selectors';
