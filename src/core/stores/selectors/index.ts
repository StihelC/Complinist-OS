/**
 * Store Selectors Index
 *
 * Re-exports all selectors for easy importing.
 * Also re-exports the useShallow hook from Zustand for convenience.
 *
 * Usage:
 * ```tsx
 * import { useShallow } from 'zustand/react/shallow';
 * import { selectTopology, selectAppState } from '@/core/stores/selectors';
 *
 * // In component:
 * const { nodes, edges } = useFlowStore(useShallow(selectTopology));
 * ```
 */

// Re-export the useShallow hook from Zustand for convenience
export { useShallow } from 'zustand/react/shallow';

// Flow Store Selectors
export {
  // State selectors
  selectTopology,
  selectProjects,
  selectProjectDialogState,
  selectModalStates,
  selectControlSuggestionModal,
  selectSelection,
  selectPlacementMode,
  selectGlobalSettings,
  selectExportSelection,
  selectUndoRedo,
  selectReactFlowInstance,
  // Action selectors
  selectTopologyActions,
  selectSelectionActions,
  selectPlacementActions,
  selectProjectActions,
  selectProjectDialogActions,
  selectModalActions,
  selectControlActions,
  selectExportImportActions,
  selectUndoRedoActions,
  selectGlobalSettingsActions,
  selectExportSelectionActions,
  selectReactFlowInstanceAction,
  selectInitialize,
  // Combined selectors
  selectAppState,
  selectAppActions,
  selectViewRouterState,
  selectControlSelectionState,
  selectControlCoverageState,
  selectSSPWizardState,
  selectInventoryState,
  selectPropertiesState,
} from './flowSelectors';

// Control Narratives Store Selectors
export {
  // State selectors
  selectControlItems,
  selectItems,
  selectFamilies,
  selectControlFilters,
  selectDirtyState,
  selectLoadingStates,
  selectGenerationProgress,
  selectErrorState,
  selectProjectContext,
  selectHiddenCustomCount,
  // Action selectors
  selectLoadActions,
  selectFilterActions,
  selectNarrativeActions,
  selectSaveActions,
  selectAIActions,
  selectGetterActions,
  // Combined selectors
  selectControlCardActions,
  selectControlCardState,
  selectControlPanelState,
  selectControlPanelActions,
  selectControlCoverageState as selectNarrativeCoverageState,
  selectAIGenerationState,
  selectAIGenerationActions,
} from './controlNarrativesSelectors';

// AI Service Store Selectors
export {
  // State selectors
  selectAIStatus,
  selectPreloadProgress,
  selectAIStatusAndProgress,
  selectOverallStatus,
  selectLLMStatus,
  selectEmbeddingStatus,
  selectChromaDBStatus,
  selectGPUBackend,
  selectModelInfo,
  selectIsPreloading,
  // Action selectors
  selectInitializeActions,
  selectStatusActions,
  selectPreloadListenerActions,
  selectPreloadProgressAction,
  // Combined selectors
  selectAIStatusIndicator,
  selectAIStatusIndicatorActions,
  selectAppAIStatus,
  selectAppAIActions,
  selectIsAIReady,
  selectHasAIError,
  selectAIError,
} from './aiServiceSelectors';
