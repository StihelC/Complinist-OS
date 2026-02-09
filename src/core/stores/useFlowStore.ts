/**
 * Flow Store
 *
 * This module re-exports from the facade for backward compatibility.
 * All 82+ files importing from this path continue to work unchanged.
 *
 * The store is now split into domain stores:
 * - useTopologyStore: nodes, edges, mutations
 * - useSelectionStore: selection state
 * - useProjectStore: project management
 * - useCanvasUIStore: UI modes, modals, panels
 * - useSettingsStore: global settings, React Flow instance
 * - useUndoRedoStore: undo/redo with hash-based change detection
 *
 * For new code, consider importing domain stores directly:
 *   import { useTopologyStore } from '@/core/stores/flow';
 */

// Re-export everything from the facade
export {
  useFlowStore,
  type FlowState,
  type PlacementModeData,
  type BoundaryDrawingModeData,
} from './useFlowStoreFacade';

// Also re-export domain stores for consumers who want more granular access
export {
  useTopologyStore,
  useSelectionStore,
  useProjectStore,
  useCanvasUIStore,
  useSettingsStore,
  useUndoRedoStore,
} from './flow';

// Re-export from flowStoreAccessor for backward compatibility
export { registerFlowStore } from './flowStoreAccessor';
