/**
 * Delta Tracking Store
 *
 * Manages incremental change tracking for diagram nodes and edges.
 * Instead of serializing the entire diagram on every change,
 * this store tracks only changed entities and batches them for efficient saves.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppNode, AppEdge } from '@/lib/utils/types';
import type {
  DeltaTrackingState,
  SerializedDiagramDelta,
} from '@/core/types/delta.types';
import { DELTA_SAVE_CONFIG } from '@/core/types/delta.types';

/**
 * Simple hash function for state verification
 * Uses a fast string hash for comparing state snapshots
 */
function computeStateHash(nodes: AppNode[], edges: AppEdge[]): string {
  // Create a simplified fingerprint of the state
  const nodeIds = nodes.map((n) => n.id).sort().join(',');
  const edgeIds = edges.map((e) => e.id).sort().join(',');
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  // Simple hash computation
  const str = `${nodeCount}:${edgeCount}:${nodeIds}:${edgeIds}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Determine if a node has meaningfully changed
 * Ignores transient properties like selection state
 */
function hasNodeChanged(oldNode: AppNode | undefined, newNode: AppNode): boolean {
  if (!oldNode) return true;

  // Compare position
  if (
    oldNode.position.x !== newNode.position.x ||
    oldNode.position.y !== newNode.position.y
  ) {
    return true;
  }

  // Compare dimensions (for boundaries)
  if (oldNode.width !== newNode.width || oldNode.height !== newNode.height) {
    return true;
  }

  // Compare parentId
  if (oldNode.parentId !== newNode.parentId) {
    return true;
  }

  // Deep compare data (excluding transient properties)
  const oldData = { ...oldNode.data };
  const newData = { ...newNode.data };

  // Remove transient properties that don't need saving
  delete (oldData as Record<string, unknown>).hoveredGroupId;
  delete (newData as Record<string, unknown>).hoveredGroupId;

  return JSON.stringify(oldData) !== JSON.stringify(newData);
}

/**
 * Determine if an edge has meaningfully changed
 */
function hasEdgeChanged(oldEdge: AppEdge | undefined, newEdge: AppEdge): boolean {
  if (!oldEdge) return true;

  // Compare source/target
  if (
    oldEdge.source !== newEdge.source ||
    oldEdge.target !== newEdge.target ||
    oldEdge.sourceHandle !== newEdge.sourceHandle ||
    oldEdge.targetHandle !== newEdge.targetHandle
  ) {
    return true;
  }

  // Compare type
  if (oldEdge.type !== newEdge.type) {
    return true;
  }

  // Deep compare data
  return JSON.stringify(oldEdge.data) !== JSON.stringify(newEdge.data);
}

interface DeltaTrackingStore {
  // State
  state: DeltaTrackingState;

  // Previous state snapshot for change detection
  previousNodes: Map<string, AppNode>;
  previousEdges: Map<string, AppEdge>;

  // Actions
  initialize: (nodes: AppNode[], edges: AppEdge[]) => void;
  trackNodeChanges: (oldNodes: AppNode[], newNodes: AppNode[]) => void;
  trackEdgeChanges: (oldEdges: AppEdge[], newEdges: AppEdge[]) => void;
  trackNodeUpdate: (nodeId: string, node: AppNode) => void;
  trackNodeAdd: (node: AppNode) => void;
  trackNodeRemove: (nodeId: string) => void;
  trackEdgeUpdate: (edgeId: string, edge: AppEdge) => void;
  trackEdgeAdd: (edge: AppEdge) => void;
  trackEdgeRemove: (edgeId: string) => void;
  getDelta: () => SerializedDiagramDelta | null;
  clearPendingChanges: () => void;
  shouldForceFullSave: () => boolean;
  updateLastSaveTimestamp: () => void;
  getPendingChangeCount: () => number;
  setProjectId: (projectId: number) => void;
  reset: () => void;

  // Project tracking
  currentProjectId: number | null;
}

const initialState: DeltaTrackingState = {
  sequence: 0,
  pendingNodeChanges: new Map(),
  pendingEdgeChanges: new Map(),
  lastSavedStateHash: null,
  isActive: true,
  lastSaveTimestamp: null,
};

export const useDeltaTrackingStore = create<DeltaTrackingStore>()(
  devtools(
    (set, get) => ({
      state: { ...initialState },
      previousNodes: new Map(),
      previousEdges: new Map(),
      currentProjectId: null,

  setProjectId: (projectId: number) => {
    set({ currentProjectId: projectId });
  },

  initialize: (nodes: AppNode[], edges: AppEdge[]) => {
    // Store initial state for future comparisons
    const nodeMap = new Map<string, AppNode>();
    const edgeMap = new Map<string, AppEdge>();

    nodes.forEach((node) => nodeMap.set(node.id, node));
    edges.forEach((edge) => edgeMap.set(edge.id, edge));

    const stateHash = computeStateHash(nodes, edges);

    set({
      previousNodes: nodeMap,
      previousEdges: edgeMap,
      state: {
        ...initialState,
        lastSavedStateHash: stateHash,
        lastSaveTimestamp: Date.now(),
      },
    });
  },

  trackNodeChanges: (oldNodes: AppNode[], newNodes: AppNode[]) => {
    const { state, previousNodes } = get();
    const newPendingChanges = new Map(state.pendingNodeChanges);
    const newPreviousNodes = new Map(previousNodes);

    const oldNodeMap = new Map(oldNodes.map((n) => [n.id, n]));
    const newNodeMap = new Map(newNodes.map((n) => [n.id, n]));
    const timestamp = Date.now();

    // Find added and updated nodes
    newNodes.forEach((node) => {
      const oldNode = oldNodeMap.get(node.id);
      const prevNode = previousNodes.get(node.id);

      if (!oldNode && !prevNode) {
        // New node added
        newPendingChanges.set(node.id, {
          type: 'add',
          nodeId: node.id,
          node,
          timestamp,
        });
        newPreviousNodes.set(node.id, node);
      } else if (hasNodeChanged(prevNode, node)) {
        // Node was updated
        newPendingChanges.set(node.id, {
          type: prevNode ? 'update' : 'add',
          nodeId: node.id,
          node,
          timestamp,
        });
        newPreviousNodes.set(node.id, node);
      }
    });

    // Find removed nodes
    oldNodes.forEach((node) => {
      if (!newNodeMap.has(node.id)) {
        newPendingChanges.set(node.id, {
          type: 'remove',
          nodeId: node.id,
          timestamp,
        });
        newPreviousNodes.delete(node.id);
      }
    });

    set({
      state: { ...state, pendingNodeChanges: newPendingChanges },
      previousNodes: newPreviousNodes,
    });
  },

  trackEdgeChanges: (oldEdges: AppEdge[], newEdges: AppEdge[]) => {
    const { state, previousEdges } = get();
    const newPendingChanges = new Map(state.pendingEdgeChanges);
    const newPreviousEdges = new Map(previousEdges);

    const oldEdgeMap = new Map(oldEdges.map((e) => [e.id, e]));
    const newEdgeMap = new Map(newEdges.map((e) => [e.id, e]));
    const timestamp = Date.now();

    // Find added and updated edges
    newEdges.forEach((edge) => {
      const oldEdge = oldEdgeMap.get(edge.id);
      const prevEdge = previousEdges.get(edge.id);

      if (!oldEdge && !prevEdge) {
        // New edge added
        newPendingChanges.set(edge.id, {
          type: 'add',
          edgeId: edge.id,
          edge,
          timestamp,
        });
        newPreviousEdges.set(edge.id, edge);
      } else if (hasEdgeChanged(prevEdge, edge)) {
        // Edge was updated
        newPendingChanges.set(edge.id, {
          type: prevEdge ? 'update' : 'add',
          edgeId: edge.id,
          edge,
          timestamp,
        });
        newPreviousEdges.set(edge.id, edge);
      }
    });

    // Find removed edges
    oldEdges.forEach((edge) => {
      if (!newEdgeMap.has(edge.id)) {
        newPendingChanges.set(edge.id, {
          type: 'remove',
          edgeId: edge.id,
          timestamp,
        });
        newPreviousEdges.delete(edge.id);
      }
    });

    set({
      state: { ...state, pendingEdgeChanges: newPendingChanges },
      previousEdges: newPreviousEdges,
    });
  },

  trackNodeUpdate: (nodeId: string, node: AppNode) => {
    const { state, previousNodes } = get();
    const prevNode = previousNodes.get(nodeId);

    // Only track if there's an actual change
    if (!hasNodeChanged(prevNode, node)) {
      return;
    }

    const newPendingChanges = new Map(state.pendingNodeChanges);
    const newPreviousNodes = new Map(previousNodes);

    newPendingChanges.set(nodeId, {
      type: prevNode ? 'update' : 'add',
      nodeId,
      node,
      timestamp: Date.now(),
    });
    newPreviousNodes.set(nodeId, node);

    set({
      state: { ...state, pendingNodeChanges: newPendingChanges },
      previousNodes: newPreviousNodes,
    });
  },

  trackNodeAdd: (node: AppNode) => {
    const { state, previousNodes } = get();
    const newPendingChanges = new Map(state.pendingNodeChanges);
    const newPreviousNodes = new Map(previousNodes);

    newPendingChanges.set(node.id, {
      type: 'add',
      nodeId: node.id,
      node,
      timestamp: Date.now(),
    });
    newPreviousNodes.set(node.id, node);

    set({
      state: { ...state, pendingNodeChanges: newPendingChanges },
      previousNodes: newPreviousNodes,
    });
  },

  trackNodeRemove: (nodeId: string) => {
    const { state, previousNodes } = get();
    const newPendingChanges = new Map(state.pendingNodeChanges);
    const newPreviousNodes = new Map(previousNodes);

    newPendingChanges.set(nodeId, {
      type: 'remove',
      nodeId,
      timestamp: Date.now(),
    });
    newPreviousNodes.delete(nodeId);

    set({
      state: { ...state, pendingNodeChanges: newPendingChanges },
      previousNodes: newPreviousNodes,
    });
  },

  trackEdgeUpdate: (edgeId: string, edge: AppEdge) => {
    const { state, previousEdges } = get();
    const prevEdge = previousEdges.get(edgeId);

    // Only track if there's an actual change
    if (!hasEdgeChanged(prevEdge, edge)) {
      return;
    }

    const newPendingChanges = new Map(state.pendingEdgeChanges);
    const newPreviousEdges = new Map(previousEdges);

    newPendingChanges.set(edgeId, {
      type: prevEdge ? 'update' : 'add',
      edgeId,
      edge,
      timestamp: Date.now(),
    });
    newPreviousEdges.set(edgeId, edge);

    set({
      state: { ...state, pendingEdgeChanges: newPendingChanges },
      previousEdges: newPreviousEdges,
    });
  },

  trackEdgeAdd: (edge: AppEdge) => {
    const { state, previousEdges } = get();
    const newPendingChanges = new Map(state.pendingEdgeChanges);
    const newPreviousEdges = new Map(previousEdges);

    newPendingChanges.set(edge.id, {
      type: 'add',
      edgeId: edge.id,
      edge,
      timestamp: Date.now(),
    });
    newPreviousEdges.set(edge.id, edge);

    set({
      state: { ...state, pendingEdgeChanges: newPendingChanges },
      previousEdges: newPreviousEdges,
    });
  },

  trackEdgeRemove: (edgeId: string) => {
    const { state, previousEdges } = get();
    const newPendingChanges = new Map(state.pendingEdgeChanges);
    const newPreviousEdges = new Map(previousEdges);

    newPendingChanges.set(edgeId, {
      type: 'remove',
      edgeId,
      timestamp: Date.now(),
    });
    newPreviousEdges.delete(edgeId);

    set({
      state: { ...state, pendingEdgeChanges: newPendingChanges },
      previousEdges: newPreviousEdges,
    });
  },

  getDelta: (): SerializedDiagramDelta | null => {
    const { state, currentProjectId } = get();

    if (!currentProjectId) {
      return null;
    }

    const nodeChanges = Array.from(state.pendingNodeChanges.values()).map(
      ({ type, nodeId, node }) => ({ type, nodeId, node })
    );

    const edgeChanges = Array.from(state.pendingEdgeChanges.values()).map(
      ({ type, edgeId, edge }) => ({ type, edgeId, edge })
    );

    // No changes to send
    if (nodeChanges.length === 0 && edgeChanges.length === 0) {
      return null;
    }

    return {
      projectId: currentProjectId,
      nodeChanges,
      edgeChanges,
      sequence: state.sequence,
    };
  },

  clearPendingChanges: () => {
    const { state } = get();
    set({
      state: {
        ...state,
        pendingNodeChanges: new Map(),
        pendingEdgeChanges: new Map(),
        sequence: state.sequence + 1,
        lastSaveTimestamp: Date.now(),
      },
    });
  },

  shouldForceFullSave: (): boolean => {
    const { state } = get();
    const pendingCount = get().getPendingChangeCount();
    const timeSinceLastSave = state.lastSaveTimestamp
      ? Date.now() - state.lastSaveTimestamp
      : Infinity;

    // Force full save if:
    // 1. Too many pending changes
    // 2. Too much time has passed since last full save
    // 3. Never saved before
    return (
      pendingCount >= DELTA_SAVE_CONFIG.MAX_PENDING_CHANGES ||
      timeSinceLastSave >= DELTA_SAVE_CONFIG.MAX_TIME_BETWEEN_FULL_SAVES ||
      state.lastSaveTimestamp === null
    );
  },

  updateLastSaveTimestamp: () => {
    const { state } = get();
    set({
      state: {
        ...state,
        lastSaveTimestamp: Date.now(),
      },
    });
  },

  getPendingChangeCount: (): number => {
    const { state } = get();
    return state.pendingNodeChanges.size + state.pendingEdgeChanges.size;
  },

      reset: () => {
        set({
          state: { ...initialState },
          previousNodes: new Map(),
          previousEdges: new Map(),
          currentProjectId: null,
        });
      },
    }),
    { name: 'Delta Tracking Store' }
  )
);

// Export the store instance for direct access
export default useDeltaTrackingStore;
