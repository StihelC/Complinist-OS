import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useDeltaTrackingStore } from '@/core/stores/deltaTrackingStore';
import type { AppNode, AppEdge } from '@/lib/utils/types';

// Mock the delta config
vi.mock('@/core/types/delta.types', async () => {
  const actual = await vi.importActual('@/core/types/delta.types');
  return {
    ...actual,
    DELTA_SAVE_CONFIG: {
      DEBOUNCE_DELAY_MS: 100,
      MAX_PENDING_CHANGES: 50,
      MAX_TIME_BETWEEN_FULL_SAVES: 30000,
    },
  };
});

describe('useDeltaTrackingStore', () => {
  const createMockNode = (id: string, x: number = 0, y: number = 0): AppNode => ({
    id,
    type: 'device',
    position: { x, y },
    data: { id, label: `Node ${id}`, deviceType: 'server' },
  } as AppNode);

  const createMockEdge = (id: string, source: string, target: string): AppEdge => ({
    id,
    source,
    target,
    type: 'default',
  } as AppEdge);

  beforeEach(() => {
    // Reset store to initial state
    useDeltaTrackingStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { state, previousNodes, previousEdges, currentProjectId } = useDeltaTrackingStore.getState();
      expect(state.sequence).toBe(0);
      expect(state.pendingNodeChanges.size).toBe(0);
      expect(state.pendingEdgeChanges.size).toBe(0);
      expect(state.lastSavedStateHash).toBeNull();
      expect(state.isActive).toBe(true);
      expect(state.lastSaveTimestamp).toBeNull();
      expect(previousNodes.size).toBe(0);
      expect(previousEdges.size).toBe(0);
      expect(currentProjectId).toBeNull();
    });
  });

  describe('setProjectId', () => {
    it('should set project ID', () => {
      useDeltaTrackingStore.getState().setProjectId(123);
      expect(useDeltaTrackingStore.getState().currentProjectId).toBe(123);
    });
  });

  describe('initialize', () => {
    it('should initialize with nodes and edges', () => {
      const nodes = [createMockNode('node-1'), createMockNode('node-2')];
      const edges = [createMockEdge('edge-1', 'node-1', 'node-2')];

      useDeltaTrackingStore.getState().initialize(nodes, edges);

      const store = useDeltaTrackingStore.getState();
      expect(store.previousNodes.size).toBe(2);
      expect(store.previousEdges.size).toBe(1);
      expect(store.state.lastSavedStateHash).not.toBeNull();
      expect(store.state.lastSaveTimestamp).not.toBeNull();
    });

    it('should clear pending changes on initialize', () => {
      // Add some pending changes first
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('test'));

      // Initialize
      useDeltaTrackingStore.getState().initialize([], []);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.size).toBe(0);
    });
  });

  describe('trackNodeAdd', () => {
    it('should track new node addition', () => {
      const node = createMockNode('node-1');
      useDeltaTrackingStore.getState().trackNodeAdd(node);

      const { state, previousNodes } = useDeltaTrackingStore.getState();
      expect(state.pendingNodeChanges.has('node-1')).toBe(true);
      expect(state.pendingNodeChanges.get('node-1')?.type).toBe('add');
      expect(previousNodes.has('node-1')).toBe(true);
    });

    it('should include timestamp in change', () => {
      const node = createMockNode('node-1');
      const before = Date.now();
      useDeltaTrackingStore.getState().trackNodeAdd(node);
      const after = Date.now();

      const change = useDeltaTrackingStore.getState().state.pendingNodeChanges.get('node-1');
      expect(change?.timestamp).toBeGreaterThanOrEqual(before);
      expect(change?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('trackNodeUpdate', () => {
    it('should track node position update', () => {
      const originalNode = createMockNode('node-1', 0, 0);
      useDeltaTrackingStore.getState().initialize([originalNode], []);

      const updatedNode = createMockNode('node-1', 100, 100);
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', updatedNode);

      const { state } = useDeltaTrackingStore.getState();
      expect(state.pendingNodeChanges.has('node-1')).toBe(true);
      expect(state.pendingNodeChanges.get('node-1')?.type).toBe('update');
    });

    it('should not track update if no meaningful change', () => {
      const node = createMockNode('node-1', 100, 100);
      useDeltaTrackingStore.getState().initialize([node], []);

      // Update with same position and data
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', node);

      const { state } = useDeltaTrackingStore.getState();
      expect(state.pendingNodeChanges.size).toBe(0);
    });

    it('should track node data changes', () => {
      const node = createMockNode('node-1');
      useDeltaTrackingStore.getState().initialize([node], []);

      const updatedNode = {
        ...node,
        data: { ...node.data, label: 'Updated Label' },
      };
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', updatedNode);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.has('node-1')).toBe(true);
    });

    it('should track dimension changes', () => {
      const node = createMockNode('node-1');
      useDeltaTrackingStore.getState().initialize([node], []);

      const updatedNode = { ...node, width: 200, height: 150 };
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', updatedNode);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.has('node-1')).toBe(true);
    });

    it('should mark as add if node not previously tracked', () => {
      const node = createMockNode('new-node');
      useDeltaTrackingStore.getState().trackNodeUpdate('new-node', node);

      const change = useDeltaTrackingStore.getState().state.pendingNodeChanges.get('new-node');
      expect(change?.type).toBe('add');
    });
  });

  describe('trackNodeRemove', () => {
    it('should track node removal', () => {
      const node = createMockNode('node-1');
      useDeltaTrackingStore.getState().initialize([node], []);

      useDeltaTrackingStore.getState().trackNodeRemove('node-1');

      const { state, previousNodes } = useDeltaTrackingStore.getState();
      expect(state.pendingNodeChanges.has('node-1')).toBe(true);
      expect(state.pendingNodeChanges.get('node-1')?.type).toBe('remove');
      expect(previousNodes.has('node-1')).toBe(false);
    });
  });

  describe('trackNodeChanges', () => {
    it('should detect added nodes', () => {
      const oldNodes: AppNode[] = [];
      const newNodes = [createMockNode('node-1')];

      useDeltaTrackingStore.getState().trackNodeChanges(oldNodes, newNodes);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.get('node-1')?.type).toBe('add');
    });

    it('should detect removed nodes', () => {
      const node = createMockNode('node-1');
      useDeltaTrackingStore.getState().initialize([node], []);

      const oldNodes = [node];
      const newNodes: AppNode[] = [];

      useDeltaTrackingStore.getState().trackNodeChanges(oldNodes, newNodes);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.get('node-1')?.type).toBe('remove');
    });

    it('should detect updated nodes', () => {
      const node = createMockNode('node-1', 0, 0);
      useDeltaTrackingStore.getState().initialize([node], []);

      const oldNodes = [node];
      const newNodes = [createMockNode('node-1', 100, 100)];

      useDeltaTrackingStore.getState().trackNodeChanges(oldNodes, newNodes);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.get('node-1')?.type).toBe('update');
    });
  });

  describe('trackEdgeAdd', () => {
    it('should track new edge addition', () => {
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      useDeltaTrackingStore.getState().trackEdgeAdd(edge);

      const { state, previousEdges } = useDeltaTrackingStore.getState();
      expect(state.pendingEdgeChanges.has('edge-1')).toBe(true);
      expect(state.pendingEdgeChanges.get('edge-1')?.type).toBe('add');
      expect(previousEdges.has('edge-1')).toBe(true);
    });
  });

  describe('trackEdgeUpdate', () => {
    it('should track edge changes', () => {
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      useDeltaTrackingStore.getState().initialize([], [edge]);

      const updatedEdge = { ...edge, source: 'node-3' } as AppEdge;
      useDeltaTrackingStore.getState().trackEdgeUpdate('edge-1', updatedEdge);

      expect(useDeltaTrackingStore.getState().state.pendingEdgeChanges.get('edge-1')?.type).toBe('update');
    });

    it('should not track if no meaningful change', () => {
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      useDeltaTrackingStore.getState().initialize([], [edge]);

      useDeltaTrackingStore.getState().trackEdgeUpdate('edge-1', edge);

      expect(useDeltaTrackingStore.getState().state.pendingEdgeChanges.size).toBe(0);
    });
  });

  describe('trackEdgeRemove', () => {
    it('should track edge removal', () => {
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      useDeltaTrackingStore.getState().initialize([], [edge]);

      useDeltaTrackingStore.getState().trackEdgeRemove('edge-1');

      const { state, previousEdges } = useDeltaTrackingStore.getState();
      expect(state.pendingEdgeChanges.get('edge-1')?.type).toBe('remove');
      expect(previousEdges.has('edge-1')).toBe(false);
    });
  });

  describe('trackEdgeChanges', () => {
    it('should detect added, removed, and updated edges', () => {
      const edge1 = createMockEdge('edge-1', 'node-1', 'node-2');
      const edge2 = createMockEdge('edge-2', 'node-2', 'node-3');
      useDeltaTrackingStore.getState().initialize([], [edge1, edge2]);

      const edge2Updated = { ...edge2, target: 'node-4' } as AppEdge;
      const edge3 = createMockEdge('edge-3', 'node-3', 'node-4');

      // edge1 removed, edge2 updated, edge3 added
      const oldEdges = [edge1, edge2];
      const newEdges = [edge2Updated, edge3];

      useDeltaTrackingStore.getState().trackEdgeChanges(oldEdges, newEdges);

      const { state } = useDeltaTrackingStore.getState();
      expect(state.pendingEdgeChanges.get('edge-1')?.type).toBe('remove');
      expect(state.pendingEdgeChanges.get('edge-2')?.type).toBe('update');
      expect(state.pendingEdgeChanges.get('edge-3')?.type).toBe('add');
    });
  });

  describe('getDelta', () => {
    it('should return null if no project ID', () => {
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-1'));

      const delta = useDeltaTrackingStore.getState().getDelta();
      expect(delta).toBeNull();
    });

    it('should return null if no pending changes', () => {
      useDeltaTrackingStore.getState().setProjectId(123);

      const delta = useDeltaTrackingStore.getState().getDelta();
      expect(delta).toBeNull();
    });

    it('should return serialized delta with changes', () => {
      useDeltaTrackingStore.getState().setProjectId(123);
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-1'));
      useDeltaTrackingStore.getState().trackEdgeAdd(createMockEdge('edge-1', 'node-1', 'node-2'));

      const delta = useDeltaTrackingStore.getState().getDelta();

      expect(delta).not.toBeNull();
      expect(delta?.projectId).toBe(123);
      expect(delta?.nodeChanges).toHaveLength(1);
      expect(delta?.edgeChanges).toHaveLength(1);
      expect(delta?.sequence).toBe(0);
    });

    it('should serialize changes without timestamp', () => {
      useDeltaTrackingStore.getState().setProjectId(123);
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-1'));

      const delta = useDeltaTrackingStore.getState().getDelta();

      // Delta should not include timestamp (it's internal)
      expect(delta?.nodeChanges[0]).not.toHaveProperty('timestamp');
    });
  });

  describe('clearPendingChanges', () => {
    it('should clear all pending changes', () => {
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-1'));
      useDeltaTrackingStore.getState().trackEdgeAdd(createMockEdge('edge-1', 'node-1', 'node-2'));

      useDeltaTrackingStore.getState().clearPendingChanges();

      const { state } = useDeltaTrackingStore.getState();
      expect(state.pendingNodeChanges.size).toBe(0);
      expect(state.pendingEdgeChanges.size).toBe(0);
    });

    it('should increment sequence number', () => {
      const initialSeq = useDeltaTrackingStore.getState().state.sequence;
      useDeltaTrackingStore.getState().clearPendingChanges();
      expect(useDeltaTrackingStore.getState().state.sequence).toBe(initialSeq + 1);
    });

    it('should update last save timestamp', () => {
      const before = Date.now();
      useDeltaTrackingStore.getState().clearPendingChanges();
      const after = Date.now();

      const timestamp = useDeltaTrackingStore.getState().state.lastSaveTimestamp;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('shouldForceFullSave', () => {
    it('should return true if never saved', () => {
      expect(useDeltaTrackingStore.getState().shouldForceFullSave()).toBe(true);
    });

    it('should return false after initialization', () => {
      useDeltaTrackingStore.getState().initialize([], []);
      expect(useDeltaTrackingStore.getState().shouldForceFullSave()).toBe(false);
    });

    it('should return true if too many pending changes', () => {
      useDeltaTrackingStore.getState().initialize([], []);

      // Add many changes (more than MAX_PENDING_CHANGES)
      for (let i = 0; i < 55; i++) {
        useDeltaTrackingStore.getState().trackNodeAdd(createMockNode(`node-${i}`, i * 10, 0));
      }

      expect(useDeltaTrackingStore.getState().shouldForceFullSave()).toBe(true);
    });
  });

  describe('getPendingChangeCount', () => {
    it('should return total pending changes', () => {
      expect(useDeltaTrackingStore.getState().getPendingChangeCount()).toBe(0);

      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-1'));
      expect(useDeltaTrackingStore.getState().getPendingChangeCount()).toBe(1);

      useDeltaTrackingStore.getState().trackEdgeAdd(createMockEdge('edge-1', 'node-1', 'node-2'));
      expect(useDeltaTrackingStore.getState().getPendingChangeCount()).toBe(2);
    });
  });

  describe('updateLastSaveTimestamp', () => {
    it('should update last save timestamp', () => {
      const before = Date.now();
      useDeltaTrackingStore.getState().updateLastSaveTimestamp();
      const after = Date.now();

      const timestamp = useDeltaTrackingStore.getState().state.lastSaveTimestamp;
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useDeltaTrackingStore.getState().setProjectId(123);
      useDeltaTrackingStore.getState().initialize([createMockNode('node-1')], []);
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-2'));

      useDeltaTrackingStore.getState().reset();

      const { state, previousNodes, previousEdges, currentProjectId } = useDeltaTrackingStore.getState();
      expect(state.pendingNodeChanges.size).toBe(0);
      expect(state.pendingEdgeChanges.size).toBe(0);
      expect(state.lastSavedStateHash).toBeNull();
      expect(state.lastSaveTimestamp).toBeNull();
      expect(previousNodes.size).toBe(0);
      expect(previousEdges.size).toBe(0);
      expect(currentProjectId).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle same node update multiple times', () => {
      const node = createMockNode('node-1', 0, 0);
      useDeltaTrackingStore.getState().initialize([node], []);

      // Multiple updates - should only have one pending change
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', createMockNode('node-1', 10, 10));
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', createMockNode('node-1', 20, 20));
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', createMockNode('node-1', 30, 30));

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.size).toBe(1);
    });

    it('should handle add followed by remove', () => {
      useDeltaTrackingStore.getState().trackNodeAdd(createMockNode('node-1'));
      useDeltaTrackingStore.getState().trackNodeRemove('node-1');

      // Final state should be remove
      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.get('node-1')?.type).toBe('remove');
    });

    it('should handle parentId change detection', () => {
      const node = createMockNode('node-1');
      useDeltaTrackingStore.getState().initialize([node], []);

      const nodeWithParent = { ...node, parentId: 'parent-1' };
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', nodeWithParent);

      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.has('node-1')).toBe(true);
    });

    it('should ignore transient hoveredGroupId property', () => {
      const node = {
        ...createMockNode('node-1'),
        data: { ...createMockNode('node-1').data, hoveredGroupId: 'group-1' },
      } as AppNode;
      useDeltaTrackingStore.getState().initialize([node], []);

      const nodeWithDifferentHover = {
        ...node,
        data: { ...node.data, hoveredGroupId: 'group-2' },
      };
      useDeltaTrackingStore.getState().trackNodeUpdate('node-1', nodeWithDifferentHover);

      // Should not track as a change
      expect(useDeltaTrackingStore.getState().state.pendingNodeChanges.size).toBe(0);
    });
  });
});
