/**
 * Canvas Keyboard Hook
 *
 * Manages keyboard shortcuts for the flow canvas including
 * ESC to exit modes and Delete/Backspace for deletion.
 */

import { useEffect, useCallback } from 'react';
import { useCanvasUIStore } from '@/core/stores/flow/useCanvasUIStore';
import { useTopologyStore } from '@/core/stores/flow/useTopologyStore';
import { useSelectionStore } from '@/core/stores/flow/useSelectionStore';

interface UseCanvasKeyboardOptions {
  /**
   * Callback when boundary drawing is cancelled via ESC
   */
  onBoundaryDrawingCancel?: () => void;
}

/**
 * Hook that sets up keyboard handlers for the canvas.
 *
 * Handles:
 * - ESC: Exit boundary drawing mode and placement mode
 * - Delete/Backspace: Delete selected nodes and edges
 */
export function useCanvasKeyboard(options: UseCanvasKeyboardOptions = {}): void {
  const { onBoundaryDrawingCancel } = options;

  // Canvas UI state
  const boundaryDrawingMode = useCanvasUIStore(
    (state) => state.boundaryDrawingMode
  );
  const placementMode = useCanvasUIStore((state) => state.placementMode);
  const setBoundaryDrawingMode = useCanvasUIStore(
    (state) => state.setBoundaryDrawingMode
  );
  const handlePlacementComplete = useCanvasUIStore(
    (state) => state.handlePlacementComplete
  );

  // Topology state
  const nodes = useTopologyStore((state) => state.nodes);
  const edges = useTopologyStore((state) => state.edges);
  const deleteNode = useTopologyStore((state) => state.deleteNode);
  const deleteEdge = useTopologyStore((state) => state.deleteEdge);

  // Selection state
  const selectedNodeIds = useSelectionStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useSelectionStore((state) => state.selectedEdgeIds);
  const clearAllSelections = useSelectionStore(
    (state) => state.clearAllSelections
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Prevent deletion if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === 'Escape') {
        // Exit boundary drawing mode
        if (boundaryDrawingMode) {
          setBoundaryDrawingMode(null);
          // Also cancel any in-progress drawing
          if (onBoundaryDrawingCancel) {
            onBoundaryDrawingCancel();
          }
        }
        // Exit placement mode
        if (placementMode) {
          handlePlacementComplete();
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        // Get ALL selected nodes and edges directly from the arrays
        // React Flow tracks selection via the 'selected' property
        const allSelectedNodeIds = nodes
          .filter((n) => n.selected)
          .map((n) => n.id);

        const allSelectedEdgeIds = edges
          .filter((e) => e.selected)
          .map((e) => e.id);

        // Also check store's selection state (for multi-select panel compatibility)
        const storeNodeIds = selectedNodeIds || [];
        const storeEdgeIds = selectedEdgeIds || [];

        // Combine both sources and remove duplicates
        const allNodeIds = Array.from(
          new Set([...allSelectedNodeIds, ...storeNodeIds])
        );
        const allEdgeIds = Array.from(
          new Set([...allSelectedEdgeIds, ...storeEdgeIds])
        );

        // Delete all selected nodes
        allNodeIds.forEach((nodeId) => {
          deleteNode(nodeId);
        });

        // Delete all selected edges
        allEdgeIds.forEach((edgeId) => {
          deleteEdge(edgeId);
        });

        // Clear selections after deletion
        if (allNodeIds.length > 0 || allEdgeIds.length > 0) {
          clearAllSelections();
        }
      }
    },
    [
      boundaryDrawingMode,
      placementMode,
      setBoundaryDrawingMode,
      handlePlacementComplete,
      selectedNodeIds,
      selectedEdgeIds,
      nodes,
      edges,
      deleteNode,
      deleteEdge,
      clearAllSelections,
      onBoundaryDrawingCancel,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
