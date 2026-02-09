/**
 * Undo/Redo Store
 *
 * Manages undo/redo state for the flow canvas using a command pattern.
 * Uses hash-based change detection for performance instead of JSON.stringify.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppNode, AppEdge } from '@/lib/utils/types';

// Fast string hashing function (djb2 variant)
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Compute a fast structural hash for nodes and edges.
 * Only hashes structurally significant properties, ignoring transient state.
 * Performance: O(n) where n is total nodes + edges
 */
function computeStructuralHash(nodes: AppNode[], edges: AppEdge[]): string {
  const prime = 31;
  let hash = 0;

  // Hash nodes
  for (const node of nodes) {
    hash = (hash * prime + hashString(node.id)) | 0;
    hash = (hash * prime + Math.round(node.position.x * 10)) | 0;
    hash = (hash * prime + Math.round(node.position.y * 10)) | 0;
    if (node.width !== undefined)
      hash = (hash * prime + Math.round(node.width)) | 0;
    if (node.height !== undefined)
      hash = (hash * prime + Math.round(node.height)) | 0;
    if (node.parentId) hash = (hash * prime + hashString(node.parentId)) | 0;
    if (node.type) hash = (hash * prime + hashString(node.type)) | 0;

    // Hash significant data properties
    if (node.data) {
      const data = node.data as Record<string, unknown>;
      if (data.name && typeof data.name === 'string')
        hash = (hash * prime + hashString(data.name)) | 0;
      if (data.label && typeof data.label === 'string')
        hash = (hash * prime + hashString(data.label)) | 0;
      if (data.deviceType && typeof data.deviceType === 'string')
        hash = (hash * prime + hashString(data.deviceType)) | 0;
      if (data.type && typeof data.type === 'string')
        hash = (hash * prime + hashString(data.type as string)) | 0;
    }
  }

  // Hash edges
  for (const edge of edges) {
    hash = (hash * prime + hashString(edge.id)) | 0;
    hash = (hash * prime + hashString(edge.source)) | 0;
    hash = (hash * prime + hashString(edge.target)) | 0;
    if (edge.sourceHandle)
      hash = (hash * prime + hashString(edge.sourceHandle)) | 0;
    if (edge.targetHandle)
      hash = (hash * prime + hashString(edge.targetHandle)) | 0;
    if (edge.type) hash = (hash * prime + hashString(edge.type)) | 0;
  }

  return hash.toString(16);
}

/**
 * Deep clone nodes and edges for snapshot storage.
 * More efficient than JSON.parse(JSON.stringify()) for our specific structure.
 */
function cloneSnapshot(
  nodes: AppNode[],
  edges: AppEdge[]
): { nodes: AppNode[]; edges: AppEdge[] } {
  // Use structured clone if available (modern browsers), otherwise JSON fallback
  if (typeof structuredClone === 'function') {
    return {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    };
  }
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

interface UndoRedoSnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
  hash: string;
  timestamp: number;
}

interface UndoRedoState {
  // Stack state
  undoStack: UndoRedoSnapshot[];
  redoStack: UndoRedoSnapshot[];

  // Computed availability
  canUndo: boolean;
  canRedo: boolean;

  // Configuration
  maxStackSize: number;
  minCheckpointInterval: number;

  // Timing state
  lastCheckpointTime: number;
  pendingCheckpointTimeout: ReturnType<typeof setTimeout> | null;

  // Operation flag to prevent recursive checkpoints
  isUndoRedoOperation: boolean;

  // Actions
  createCheckpoint: (
    nodes: AppNode[],
    edges: AppEdge[],
    force?: boolean
  ) => void;
  undo: (
    setNodes: (nodes: AppNode[]) => void,
    setEdges: (edges: AppEdge[]) => void,
    getCurrentNodes: () => AppNode[],
    getCurrentEdges: () => AppEdge[]
  ) => void;
  redo: (
    setNodes: (nodes: AppNode[]) => void,
    setEdges: (edges: AppEdge[]) => void,
    getCurrentNodes: () => AppNode[],
    getCurrentEdges: () => AppEdge[]
  ) => void;
  clearHistory: () => void;
  setIsUndoRedoOperation: (value: boolean) => void;

  // Internal
  _cancelPendingCheckpoint: () => void;
}

const MAX_STACK_SIZE = 50;
const MIN_CHECKPOINT_INTERVAL_MS = 100;
const CHECKPOINT_DEBOUNCE_MS = 150;

export const useUndoRedoStore = create<UndoRedoState>()(
  devtools(
    (set, get) => ({
      // Initial state
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      maxStackSize: MAX_STACK_SIZE,
      minCheckpointInterval: MIN_CHECKPOINT_INTERVAL_MS,
      lastCheckpointTime: 0,
      pendingCheckpointTimeout: null,
      isUndoRedoOperation: false,

      // Cancel any pending checkpoint
      _cancelPendingCheckpoint: () => {
        const { pendingCheckpointTimeout } = get();
        if (pendingCheckpointTimeout) {
          clearTimeout(pendingCheckpointTimeout);
          set({ pendingCheckpointTimeout: null });
        }
      },

      // Create a checkpoint for undo
      createCheckpoint: (nodes, edges, force = false) => {
        const {
          undoStack,
          lastCheckpointTime,
          minCheckpointInterval,
          maxStackSize,
          isUndoRedoOperation,
          pendingCheckpointTimeout,
        } = get();

        // Don't create checkpoints during undo/redo operations
        if (isUndoRedoOperation) return;

        const now = Date.now();
        const timeSinceLastCheckpoint = now - lastCheckpointTime;

        // Cancel any pending checkpoint
        if (pendingCheckpointTimeout) {
          clearTimeout(pendingCheckpointTimeout);
        }

        // If forcing or enough time has passed, create checkpoint immediately
        if (force || timeSinceLastCheckpoint >= minCheckpointInterval) {
          // Compute hash for current state
          const currentHash = computeStructuralHash(nodes, edges);

          // Check if state actually changed from last checkpoint
          const lastCheckpoint = undoStack[undoStack.length - 1];
          if (lastCheckpoint && lastCheckpoint.hash === currentHash) {
            set({ pendingCheckpointTimeout: null });
            return; // No change, skip checkpoint
          }

          // Clone the state for storage
          const snapshot = cloneSnapshot(nodes, edges);

          // Create new checkpoint
          const newCheckpoint: UndoRedoSnapshot = {
            nodes: snapshot.nodes,
            edges: snapshot.edges,
            hash: currentHash,
            timestamp: now,
          };

          // Add to stack, maintaining max size
          const newStack = [...undoStack, newCheckpoint];
          if (newStack.length > maxStackSize) {
            newStack.shift();
          }

          set({
            undoStack: newStack,
            redoStack: [], // Clear redo stack when new action is performed
            canUndo: newStack.length > 0,
            canRedo: false,
            lastCheckpointTime: now,
            pendingCheckpointTimeout: null,
          });
        } else {
          // Debounce checkpoint creation
          const timeout = setTimeout(() => {
            get().createCheckpoint(nodes, edges, true);
          }, CHECKPOINT_DEBOUNCE_MS);

          set({ pendingCheckpointTimeout: timeout });
        }
      },

      // Undo operation
      undo: (setNodes, setEdges, getCurrentNodes, getCurrentEdges) => {
        const { undoStack, redoStack, maxStackSize } = get();

        if (undoStack.length === 0) return;

        // Mark that we're in an undo operation
        set({ isUndoRedoOperation: true });

        try {
          // Get current state for redo stack
          const currentNodes = getCurrentNodes();
          const currentEdges = getCurrentEdges();
          const currentHash = computeStructuralHash(currentNodes, currentEdges);
          const currentSnapshot = cloneSnapshot(currentNodes, currentEdges);

          // Push current state to redo stack
          const newRedoStack = [
            ...redoStack,
            {
              nodes: currentSnapshot.nodes,
              edges: currentSnapshot.edges,
              hash: currentHash,
              timestamp: Date.now(),
            },
          ];
          if (newRedoStack.length > maxStackSize) {
            newRedoStack.shift();
          }

          // Pop from undo stack
          const newUndoStack = [...undoStack];
          const previousState = newUndoStack.pop()!;

          // Apply the previous state
          setNodes(previousState.nodes);
          setEdges(previousState.edges);

          set({
            undoStack: newUndoStack,
            redoStack: newRedoStack,
            canUndo: newUndoStack.length > 0,
            canRedo: newRedoStack.length > 0,
          });
        } finally {
          set({ isUndoRedoOperation: false });
        }
      },

      // Redo operation
      redo: (setNodes, setEdges, getCurrentNodes, getCurrentEdges) => {
        const { undoStack, redoStack, maxStackSize } = get();

        if (redoStack.length === 0) return;

        // Mark that we're in a redo operation
        set({ isUndoRedoOperation: true });

        try {
          // Get current state for undo stack
          const currentNodes = getCurrentNodes();
          const currentEdges = getCurrentEdges();
          const currentHash = computeStructuralHash(currentNodes, currentEdges);
          const currentSnapshot = cloneSnapshot(currentNodes, currentEdges);

          // Push current state to undo stack
          const newUndoStack = [
            ...undoStack,
            {
              nodes: currentSnapshot.nodes,
              edges: currentSnapshot.edges,
              hash: currentHash,
              timestamp: Date.now(),
            },
          ];
          if (newUndoStack.length > maxStackSize) {
            newUndoStack.shift();
          }

          // Pop from redo stack
          const newRedoStack = [...redoStack];
          const nextState = newRedoStack.pop()!;

          // Apply the next state
          setNodes(nextState.nodes);
          setEdges(nextState.edges);

          set({
            undoStack: newUndoStack,
            redoStack: newRedoStack,
            canUndo: newUndoStack.length > 0,
            canRedo: newRedoStack.length > 0,
          });
        } finally {
          set({ isUndoRedoOperation: false });
        }
      },

      // Clear all history
      clearHistory: () => {
        const { pendingCheckpointTimeout } = get();
        if (pendingCheckpointTimeout) {
          clearTimeout(pendingCheckpointTimeout);
        }
        set({
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          lastCheckpointTime: 0,
          pendingCheckpointTimeout: null,
        });
      },

      // Set undo/redo operation flag
      setIsUndoRedoOperation: (value) => set({ isUndoRedoOperation: value }),
    }),
    { name: 'Undo/Redo Store' }
  )
);

// Export hash function for testing
export { computeStructuralHash };
