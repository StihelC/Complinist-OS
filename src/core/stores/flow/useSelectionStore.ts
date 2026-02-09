/**
 * Selection Store
 *
 * Manages selection state for nodes and edges in the flow canvas.
 * Supports both single and multi-selection.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface SelectionState {
  // Single selection (legacy compatibility)
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Multi-selection
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // Actions
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  setSelectedEdgeIds: (edgeIds: string[]) => void;
  clearAllSelections: () => void;
  getMultiSelectCount: () => { nodes: number; edges: number };
}

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],

      // Single node selection - clears edge selection and syncs multi-select
      setSelectedNodeId: (nodeId) => {
        set({
          selectedNodeId: nodeId,
          selectedEdgeId: null,
          selectedNodeIds: nodeId ? [nodeId] : [],
          selectedEdgeIds: [],
        });
      },

      // Single edge selection - clears node selection and syncs multi-select
      setSelectedEdgeId: (edgeId) => {
        set({
          selectedEdgeId: edgeId,
          selectedNodeId: null,
          selectedEdgeIds: edgeId ? [edgeId] : [],
          selectedNodeIds: [],
        });
      },

      // Multi-node selection - syncs single selection when only one selected
      setSelectedNodeIds: (nodeIds) => {
        set({
          selectedNodeIds: nodeIds,
          selectedNodeId: nodeIds.length === 1 ? nodeIds[0] : null,
          selectedEdgeId: null,
          selectedEdgeIds: [],
        });
      },

      // Multi-edge selection - syncs single selection when only one selected
      setSelectedEdgeIds: (edgeIds) => {
        set({
          selectedEdgeIds: edgeIds,
          selectedEdgeId: edgeIds.length === 1 ? edgeIds[0] : null,
          selectedNodeId: null,
          selectedNodeIds: [],
        });
      },

      // Clear all selections
      clearAllSelections: () => {
        set({
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
        });
      },

      // Get count of selected items
      getMultiSelectCount: () => {
        const { selectedNodeIds, selectedEdgeIds } = get();
        return {
          nodes: selectedNodeIds.length,
          edges: selectedEdgeIds.length,
        };
      },
    }),
    { name: 'Selection Store' }
  )
);
