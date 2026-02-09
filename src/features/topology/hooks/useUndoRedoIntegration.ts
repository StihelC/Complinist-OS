/**
 * Undo/Redo Integration Hook
 *
 * Integrates FlowCanvas with the useUndoRedoStore, providing
 * checkpoint creation and undo/redo operations.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useUndoRedoStore } from '@/core/stores/flow/useUndoRedoStore';
import { useTopologyStore } from '@/core/stores/flow/useTopologyStore';
import { useProjectStore } from '@/core/stores/flow/useProjectStore';
import { AppNode, AppEdge } from '@/lib/utils/types';

interface UseUndoRedoIntegrationReturn {
  /**
   * Create a checkpoint for undo/redo.
   * @param force - If true, creates checkpoint immediately (bypasses debouncing)
   */
  createCheckpoint: (force?: boolean) => void;

  /**
   * Flag indicating if we're currently in an undo/redo operation.
   * Use this to prevent creating checkpoints during undo/redo.
   */
  isUndoRedoOperation: boolean;

  /**
   * Perform undo operation
   */
  undo: () => void;

  /**
   * Perform redo operation
   */
  redo: () => void;

  /**
   * Whether undo is available
   */
  canUndo: boolean;

  /**
   * Whether redo is available
   */
  canRedo: boolean;
}

/**
 * Hook that integrates FlowCanvas with the undo/redo store.
 *
 * Features:
 * - Automatic checkpoint clearing when project changes
 * - Debounced checkpoint creation
 * - Hash-based change detection (via the store)
 */
export function useUndoRedoIntegration(): UseUndoRedoIntegrationReturn {
  const undoRedoStore = useUndoRedoStore();
  const nodes = useTopologyStore((state) => state.nodes);
  const edges = useTopologyStore((state) => state.edges);
  const setNodes = useTopologyStore((state) => state.setNodes);
  const setEdges = useTopologyStore((state) => state.setEdges);
  const currentProject = useProjectStore((state) => state.currentProject);

  // Keep refs to latest nodes/edges to avoid stale closures
  const nodesRef = useRef<AppNode[]>(nodes);
  const edgesRef = useRef<AppEdge[]>(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Create checkpoint callback
  const createCheckpoint = useCallback(
    (force = false) => {
      if (undoRedoStore.isUndoRedoOperation) return;
      undoRedoStore.createCheckpoint(nodesRef.current, edgesRef.current, force);
    },
    [undoRedoStore]
  );

  // Undo wrapper
  const undo = useCallback(() => {
    undoRedoStore.undo(
      setNodes,
      setEdges,
      () => nodesRef.current,
      () => edgesRef.current
    );
  }, [undoRedoStore, setNodes, setEdges]);

  // Redo wrapper
  const redo = useCallback(() => {
    undoRedoStore.redo(
      setNodes,
      setEdges,
      () => nodesRef.current,
      () => edgesRef.current
    );
  }, [undoRedoStore, setNodes, setEdges]);

  // Clear history when project changes
  useEffect(() => {
    if (currentProject) {
      undoRedoStore.clearHistory();
    }
  }, [currentProject?.id, undoRedoStore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      undoRedoStore._cancelPendingCheckpoint();
    };
  }, [undoRedoStore]);

  return {
    createCheckpoint,
    isUndoRedoOperation: undoRedoStore.isUndoRedoOperation,
    undo,
    redo,
    canUndo: undoRedoStore.canUndo,
    canRedo: undoRedoStore.canRedo,
  };
}
