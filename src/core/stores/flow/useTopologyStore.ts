/**
 * Topology Store
 *
 * Manages nodes and edges for the flow canvas topology.
 * Handles all node/edge mutations with proper validation,
 * topological sorting, and delta tracking integration.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import {
  AppNode,
  AppEdge,
  DeviceNodeData,
  BoundaryNodeData,
  BoundaryType,
} from '@/lib/utils/types';
import { useDeltaTrackingStore } from '../deltaTrackingStore';
import { routeEdges, getLayoutDirectionFromContext } from '@/lib/topology/port-router';
import { layoutLogger } from '@/lib/topology/layoutLogger';
import { getDeviceZIndex, getBoundaryZIndex } from '@/lib/utils/zIndexLayers';

// Topological sort helper - ensures parent nodes come before their children
const sortNodesTopologically = (nodes: AppNode[]): AppNode[] => {
  if (nodes.length === 0) return nodes;

  // Create a map of node id to node for quick lookup
  const nodeMap = new Map<string, AppNode>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  // Build adjacency list (parent -> children)
  const children = new Map<string, Set<string>>();
  const hasParent = new Set<string>();

  nodes.forEach((node) => {
    if (node.parentId) {
      hasParent.add(node.id);
      if (!children.has(node.parentId)) {
        children.set(node.parentId, new Set());
      }
      children.get(node.parentId)!.add(node.id);
    }
  });

  // Get all root nodes (nodes without parents)
  const roots = nodes.filter((node) => !hasParent.has(node.id));

  // DFS-based topological sort
  const result: AppNode[] = [];
  const visited = new Set<string>();

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;

    const node = nodeMap.get(nodeId);
    if (!node) return; // Skip if node doesn't exist (orphaned reference)

    visited.add(nodeId);
    result.push(node);

    // Visit all children recursively
    const nodeChildren = children.get(nodeId);
    if (nodeChildren) {
      nodeChildren.forEach((childId) => visit(childId));
    }
  };

  // Visit all root nodes first
  roots.forEach((node) => visit(node.id));

  // Handle any orphaned nodes (shouldn't happen, but be safe)
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      result.push(node);
    }
  });

  return result;
};

// Validate and clean node relationships - fixes orphaned parentId references
const validateAndCleanNodes = (nodes: AppNode[]): AppNode[] => {
  if (nodes.length === 0) return nodes;

  // Create a set of valid node IDs for quick lookup
  const validNodeIds = new Set(nodes.map((node) => node.id));

  // Clean up orphaned parentId references and invalid extent
  return nodes.map((node) => {
    // If node has a parentId that doesn't exist in the nodes array
    if (node.parentId && !validNodeIds.has(node.parentId)) {
      // Remove the orphaned parentId and extent
      const { parentId, extent, ...cleanNode } = node;
      return cleanNode as AppNode;
    }

    // If node has extent: 'parent' but no parentId, remove extent
    if (node.extent === 'parent' && !node.parentId) {
      const { extent, ...cleanNode } = node;
      return cleanNode as AppNode;
    }

    return node;
  });
};

// Debounce helper - stored in closure to avoid module-level variables
const createDebouncer = () => {
  let timeoutId: NodeJS.Timeout | null = null;
  return {
    debounce: (callback: () => void, delay: number) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delay);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
};

interface TopologyState {
  // State
  nodes: AppNode[];
  edges: AppEdge[];

  // Node mutations
  setNodes: (nodes: AppNode[] | ((nodes: AppNode[]) => AppNode[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  addNode: (node: AppNode) => void;
  updateNode: (
    nodeId: string,
    data: Partial<DeviceNodeData | BoundaryNodeData>
  ) => void;
  deleteNode: (nodeId: string) => void;

  // Edge mutations
  setEdges: (edges: AppEdge[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addEdgeCustom: (edge: AppEdge) => void;
  updateEdge: (edgeId: string, data: Partial<AppEdge['data']>) => void;
  deleteEdge: (edgeId: string) => void;

  // Boundary creation
  createBoundary: (boundary: {
    label: string;
    type: BoundaryType;
    position: { x: number; y: number };
    width: number;
    height: number;
    color?: string;
  }) => void;

  // Save trigger callback - set by project store
  _onSaveNeeded: (() => void) | null;
  _setOnSaveNeeded: (callback: (() => void) | null) => void;

  // Internal debouncer
  _debouncer: ReturnType<typeof createDebouncer>;
}

const DEBOUNCE_DELAY_MS = 150;

export const useTopologyStore = create<TopologyState>()(
  devtools(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],

      // Internal debouncer instance
      _debouncer: createDebouncer(),

      // Save callback - will be set by project store
      _onSaveNeeded: null,
      _setOnSaveNeeded: (callback) => set({ _onSaveNeeded: callback }),

      // Trigger debounced save
      _triggerSave: () => {
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      // Node mutations
      setNodes: (nodes) => {
        const oldNodes = get().nodes;
        const newNodes = typeof nodes === 'function' ? nodes(oldNodes) : nodes;
        // Filter out deprecated capture nodes (from old implementation)
        const filteredNodes = newNodes.filter(
          (node: AppNode) => node.type !== 'capture'
        );
        const validatedNodes = validateAndCleanNodes(filteredNodes);
        const sortedNodes = sortNodesTopologically(validatedNodes);
        set({ nodes: sortedNodes });

        // Track changes for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackNodeChanges(oldNodes, sortedNodes);

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      setEdges: (edges) => {
        const oldEdges = get().edges;
        const safeEdges = Array.isArray(edges) ? edges : [];
        set({ edges: safeEdges });

        // Track changes for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackEdgeChanges(oldEdges, safeEdges);

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      onNodesChange: (changes: NodeChange[]) => {
        const oldNodes = get().nodes;
        const updatedNodes = applyNodeChanges(changes, oldNodes) as AppNode[];

        // Only validate when structural changes occur (add/remove nodes)
        const needsValidation = changes.some(
          (change) => change.type === 'add' || change.type === 'remove'
        );

        const validatedNodes = needsValidation
          ? validateAndCleanNodes(updatedNodes)
          : updatedNodes;

        // Only apply topological sorting when nodes are added or removed
        const needsSorting = changes.some(
          (change) => change.type === 'add' || change.type === 'remove'
        );

        const finalNodes = needsSorting
          ? sortNodesTopologically(validatedNodes)
          : validatedNodes;

        set({ nodes: finalNodes });

        // Track changes for delta save (only for meaningful changes, not selection)
        const hasMeaningfulChanges = changes.some(
          (change) =>
            change.type === 'add' ||
            change.type === 'remove' ||
            change.type === 'position' ||
            change.type === 'dimensions'
        );

        if (hasMeaningfulChanges) {
          const deltaStore = useDeltaTrackingStore.getState();
          deltaStore.trackNodeChanges(oldNodes, finalNodes);
        }

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        const oldEdges = get().edges;
        const newEdges = applyEdgeChanges(changes, oldEdges);
        set({ edges: newEdges });

        // Track changes for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackEdgeChanges(oldEdges, newEdges);

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      onConnect: (connection: Connection) => {
        const oldEdges = get().edges;
        const nodes = get().nodes;

        // Validate nodes exist before creating edge
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (!sourceNode || !targetNode) {
          layoutLogger.warn(
            `[onConnect] Cannot create edge: nodes not found (source: ${connection.source}${!sourceNode ? ' [MISSING]' : ''}, target: ${connection.target}${!targetNode ? ' [MISSING]' : ''})`
          );
          return;
        }

        const newEdge = { ...connection, type: 'default' } as AppEdge;
        const edgesWithNew = addEdge(newEdge, oldEdges);

        // Calculate optimal handle positions based on layout direction
        const direction = getLayoutDirectionFromContext(sourceNode.parentId ?? null, nodes);
        const edgesWithOptimalHandles = routeEdges(nodes, edgesWithNew, direction);

        set({ edges: edgesWithOptimalHandles });

        // Track the new edge for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        const addedEdge = edgesWithOptimalHandles.find(
          (e) => !oldEdges.some((old) => old.id === e.id)
        );
        if (addedEdge) {
          deltaStore.trackEdgeAdd(addedEdge);
        }

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      addNode: (node) => {
        // Set z-index based on node type if not already set
        const nodeWithZIndex = node.zIndex !== undefined ? node : {
          ...node,
          zIndex: node.type === 'boundary'
            ? getBoundaryZIndex(0) // Will be recalculated when nesting changes
            : getDeviceZIndex(false),
        };
        const newNodes = [...get().nodes, nodeWithZIndex];
        const validatedNodes = validateAndCleanNodes(newNodes);
        const sortedNodes = sortNodesTopologically(validatedNodes);
        set({ nodes: sortedNodes });

        // Track the new node for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackNodeAdd(node);

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      updateNode: (nodeId, data) => {
        const updatedNodes = get().nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        );
        set({ nodes: updatedNodes });

        // Track the updated node for delta save
        const updatedNode = updatedNodes.find((n) => n.id === nodeId);
        if (updatedNode) {
          const deltaStore = useDeltaTrackingStore.getState();
          deltaStore.trackNodeUpdate(nodeId, updatedNode);
        }

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      deleteNode: (nodeId) => {
        const currentNodes = get().nodes;
        const currentEdges = get().edges;

        // Remove edges connected to this node
        const updatedEdges = currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        );

        // Remove the node and clean up child references
        let updatedNodes = currentNodes.filter((n) => n.id !== nodeId);

        // Clean up any child nodes that had this node as their parent
        updatedNodes = updatedNodes.map((node) => {
          if (node.parentId === nodeId) {
            const { parentId, extent, ...cleanNode } = node;
            return cleanNode as AppNode;
          }
          return node;
        });

        // Validate and clean all nodes, then sort topologically
        updatedNodes = validateAndCleanNodes(updatedNodes);
        updatedNodes = sortNodesTopologically(updatedNodes);

        set({
          nodes: updatedNodes,
          edges: updatedEdges,
        });

        // Track the removed node for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackNodeRemove(nodeId);

        // Track edge removals for delta save
        const removedEdges = currentEdges.filter(
          (edge) => edge.source === nodeId || edge.target === nodeId
        );
        removedEdges.forEach((edge) => {
          deltaStore.trackEdgeRemove(edge.id);
        });

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      addEdgeCustom: (edge) => {
        set({ edges: [...get().edges, edge] });

        // Track the new edge for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackEdgeAdd(edge);

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      updateEdge: (edgeId, data) => {
        const updatedEdges = get().edges.map((edge) =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, ...data } } : edge
        );
        set({ edges: updatedEdges });

        // Track the updated edge for delta save
        const updatedEdge = updatedEdges.find((e) => e.id === edgeId);
        if (updatedEdge) {
          const deltaStore = useDeltaTrackingStore.getState();
          deltaStore.trackEdgeUpdate(edgeId, updatedEdge);
        }

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      deleteEdge: (edgeId) => {
        set({
          edges: get().edges.filter((e) => e.id !== edgeId),
        });

        // Track the removed edge for delta save
        const deltaStore = useDeltaTrackingStore.getState();
        deltaStore.trackEdgeRemove(edgeId);

        // Trigger debounced save
        const { _onSaveNeeded, _debouncer } = get();
        if (_onSaveNeeded) {
          _debouncer.debounce(_onSaveNeeded, DEBOUNCE_DELAY_MS);
        }
      },

      // Boundary creation
      createBoundary: (boundary) => {
        const newNodeId = `boundary-${Date.now()}`;
        const newNode: AppNode = {
          id: newNodeId,
          type: 'boundary',
          position: boundary.position,
          data: {
            id: newNodeId,
            label: boundary.label,
            type: boundary.type,
            color: boundary.color,
          } as BoundaryNodeData,
          style: {
            width: boundary.width,
            height: boundary.height,
          },
          zIndex: 100, // Base boundary z-index (above edges and devices)
        };
        get().addNode(newNode);
      },
    }),
    { name: 'Topology Store' }
  )
);

// Export helper functions for external use
export { sortNodesTopologically, validateAndCleanNodes };
