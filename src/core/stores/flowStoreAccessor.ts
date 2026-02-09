/**
 * Flow Store Accessor
 *
 * Provides a type-safe way to access the flow store from non-React contexts
 * (utility modules, other stores) without using global window mutations.
 *
 * This module now accesses the split domain stores directly, providing
 * a unified view of the flow state for external consumers.
 *
 * Usage:
 *   import { getFlowStoreState, subscribeToFlowStore } from '@/core/stores/flowStoreAccessor';
 *
 *   // Get current state
 *   const { nodes, edges } = getFlowStoreState();
 *
 *   // Subscribe to changes
 *   const unsubscribe = subscribeToFlowStore((state) => {
 *     console.log('Nodes changed:', state.nodes);
 *   });
 */

import type { AppNode, AppEdge, Project, GlobalSettings, NistBaseline } from '@/lib/utils/types';
import {
  useTopologyStore,
  useProjectStore,
  useSettingsStore,
} from './flow';

/**
 * The subset of FlowState that can be accessed from external modules.
 * This is a deliberate subset to minimize coupling between modules.
 */
export interface FlowStoreReadableState {
  // Topology data
  nodes: AppNode[];
  edges: AppEdge[];

  // Project info
  currentProject: Project | null;

  // Global settings (for export/rendering)
  globalSettings: GlobalSettings;

  // React Flow instance methods (for topology capture)
  reactFlowInstance: {
    getNodesBounds: ((nodes: any[]) => any) | null;
  };
}

/**
 * The subset of FlowState actions that can be invoked from external modules.
 */
export interface FlowStoreActions {
  setCurrentProject: (project: Project | null) => void;
  setNewProjectBaseline: (baseline: NistBaseline) => void;
}

/**
 * Combined type for external access
 */
export type FlowStoreAccessible = FlowStoreReadableState & FlowStoreActions;

/**
 * Register the flow store for external access.
 * This is now a no-op as stores are accessed directly.
 * Kept for backward compatibility.
 *
 * @deprecated No longer needed - stores are accessed directly
 */
export function registerFlowStore(_store: any): void {
  // No-op - stores are now accessed directly
}

/**
 * Check if the flow store has been registered.
 * Now always returns true since we access stores directly.
 */
export function isFlowStoreRegistered(): boolean {
  return true;
}

/**
 * Get the current state of the flow store.
 *
 * @returns The current flow store state
 */
export function getFlowStoreState(): FlowStoreAccessible {
  const topology = useTopologyStore.getState();
  const project = useProjectStore.getState();
  const settings = useSettingsStore.getState();

  return {
    // Topology data
    nodes: topology.nodes,
    edges: topology.edges,

    // Project info
    currentProject: project.currentProject,

    // Global settings
    globalSettings: settings.globalSettings,

    // React Flow instance
    reactFlowInstance: {
      getNodesBounds: settings.reactFlowInstance.getNodesBounds,
    },

    // Actions
    setCurrentProject: project.setCurrentProject,
    setNewProjectBaseline: project.setNewProjectBaseline,
  };
}

/**
 * Safely get the flow store state, returning null if not available.
 * Use this when the store might not be initialized yet.
 *
 * @returns The current flow store state or null
 */
export function getFlowStoreStateSafe(): FlowStoreAccessible | null {
  try {
    return getFlowStoreState();
  } catch {
    return null;
  }
}

/**
 * Subscribe to flow store changes.
 *
 * @param listener - Callback function that receives the new state
 * @returns Unsubscribe function
 */
export function subscribeToFlowStore(
  listener: (state: FlowStoreAccessible, prevState: FlowStoreAccessible) => void
): () => void {
  let prevState = getFlowStoreState();

  // Subscribe to all relevant stores
  const unsubscribers = [
    useTopologyStore.subscribe(() => {
      const newState = getFlowStoreState();
      listener(newState, prevState);
      prevState = newState;
    }),
    useProjectStore.subscribe(() => {
      const newState = getFlowStoreState();
      listener(newState, prevState);
      prevState = newState;
    }),
    useSettingsStore.subscribe(() => {
      const newState = getFlowStoreState();
      listener(newState, prevState);
      prevState = newState;
    }),
  ];

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Get specific data from the flow store with a selector.
 * This is useful for extracting only what you need without subscribing.
 *
 * @param selector - Function to extract data from state
 * @returns The selected data
 */
export function selectFromFlowStore<T>(selector: (state: FlowStoreAccessible) => T): T {
  const state = getFlowStoreState();
  return selector(state);
}

/**
 * Safely select data from the flow store, returning a default value if unavailable.
 *
 * @param selector - Function to extract data from state
 * @param defaultValue - Value to return if store is not available
 * @returns The selected data or default value
 */
export function selectFromFlowStoreSafe<T>(
  selector: (state: FlowStoreAccessible) => T,
  defaultValue: T
): T {
  const state = getFlowStoreStateSafe();
  if (!state) {
    return defaultValue;
  }
  return selector(state);
}
