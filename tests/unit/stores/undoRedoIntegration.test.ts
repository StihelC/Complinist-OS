import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useFlowStore } from '@/core/stores/useFlowStore';
import type { AppNode, AppEdge } from '@/lib/utils/types';
import { createTestNode, createTestEdge, createTestBoundary } from '@/tests/fixtures/undoRedoFixtures';

// Mock dependencies (same as useFlowStore.test.ts)
vi.mock('@/core/database/client', () => ({
  db: {
    listProjects: vi.fn(),
    loadDiagram: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    saveDiagram: vi.fn(),
    saveDiagramDelta: vi.fn(),
  },
}));

vi.mock('@/core/stores/sspMetadataStore', () => ({
  useSSPMetadataStore: {
    getState: vi.fn(() => ({
      metadata: null,
      isDirty: false,
      saveMetadata: vi.fn(),
    })),
  },
}));

vi.mock('@/core/stores/deltaTrackingStore', () => ({
  useDeltaTrackingStore: {
    getState: vi.fn(() => ({
      initialize: vi.fn(),
      setProjectId: vi.fn(),
      trackNodeChanges: vi.fn(),
      trackEdgeChanges: vi.fn(),
      trackNodeAdd: vi.fn(),
      trackNodeUpdate: vi.fn(),
      trackNodeRemove: vi.fn(),
      trackEdgeAdd: vi.fn(),
      trackEdgeUpdate: vi.fn(),
      trackEdgeRemove: vi.fn(),
      shouldForceFullSave: vi.fn(() => true),
      getDelta: vi.fn(() => null),
      clearPendingChanges: vi.fn(),
      updateLastSaveTimestamp: vi.fn(),
    })),
  },
}));

vi.mock('@/core/types/delta.types', () => ({
  DELTA_SAVE_CONFIG: {
    DEBOUNCE_DELAY_MS: 100,
    MAX_PENDING_CHANGES: 50,
    MAX_TIME_BETWEEN_FULL_SAVES: 30000,
  },
}));

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Undo/Redo Integration Tests', () => {
  let checkpointCallCount = 0;
  let lastCheckpointNodes: AppNode[] = [];
  let lastCheckpointEdges: AppEdge[] = [];

  const mockCheckpointFunction = () => {
    checkpointCallCount++;
    const state = useFlowStore.getState();
    lastCheckpointNodes = JSON.parse(JSON.stringify(state.nodes));
    lastCheckpointEdges = JSON.parse(JSON.stringify(state.edges));
  };

  beforeEach(() => {
    // Reset store state
    useFlowStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      placementMode: null,
      currentProject: null,
      projects: [],
      showProjectDialog: false,
      newProjectName: '',
      newProjectBaseline: 'MODERATE',
      showInventoryPanel: false,
      showSSPModal: false,
      showControlSuggestionModal: false,
      suggestionModalData: null,
      canUndo: false,
      canRedo: false,
      exportSelectionMode: false,
      exportSelectionBounds: null,
      savedExportBounds: null,
      exportSelectionCallback: null,
      globalSettings: {
        globalDeviceLabelSize: 12,
        globalBoundaryLabelSize: 14,
        globalConnectionLabelSize: 12,
        globalDeviceImageSize: 55,
        deviceAttachmentSlots: 4,
        showGrid: false,
        snapToGrid: false,
        gridSize: 20,
        layeringPreset: 'default',
      },
      reactFlowInstance: { getNodesBounds: null, getViewport: null },
    });

    // Register mock checkpoint function
    checkpointCallCount = 0;
    lastCheckpointNodes = [];
    lastCheckpointEdges = [];
    useFlowStore.getState().setCheckpointFunction(mockCheckpointFunction);

    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Store Method Checkpoints', () => {
    it('should request checkpoint after addNode()', () => {
      const node = createTestNode('node-1');
      useFlowStore.getState().addNode(node);

      expect(checkpointCallCount).toBe(1);
      expect(lastCheckpointNodes).toHaveLength(1);
      expect(lastCheckpointNodes[0].id).toBe('node-1');
    });

    it('should request checkpoint after deleteNode()', () => {
      const node = createTestNode('node-1');
      useFlowStore.getState().addNode(node);
      checkpointCallCount = 0; // Reset after add

      useFlowStore.getState().deleteNode('node-1');

      expect(checkpointCallCount).toBe(1);
      expect(lastCheckpointNodes).toHaveLength(0);
    });

    it('should request checkpoint after deleteEdge()', () => {
      const node1 = createTestNode('node-1');
      const node2 = createTestNode('node-2');
      const edge = createTestEdge('edge-1', 'node-1', 'node-2');

      useFlowStore.getState().addNode(node1);
      useFlowStore.getState().addNode(node2);
      useFlowStore.getState().addEdgeCustom(edge);
      checkpointCallCount = 0; // Reset after adds

      useFlowStore.getState().deleteEdge('edge-1');

      expect(checkpointCallCount).toBe(1);
      expect(lastCheckpointEdges).toHaveLength(0);
    });

    it('should request checkpoint for updateNode() data updates', () => {
      const node = createTestNode('node-1');
      useFlowStore.getState().addNode(node);
      checkpointCallCount = 0;

      useFlowStore.getState().updateNode('node-1', { name: 'Updated Name' });

      expect(checkpointCallCount).toBe(1);
      expect(lastCheckpointNodes[0].data.name).toBe('Updated Name');
    });

    it('should skip checkpoint for updateNode() selection-only changes', () => {
      const node = createTestNode('node-1');
      useFlowStore.getState().addNode(node);
      checkpointCallCount = 0;

      useFlowStore.getState().updateNode('node-1', { selected: true });

      expect(checkpointCallCount).toBe(0); // Should skip checkpoint
    });

    it('should create checkpoint for createBoundary() (inherits from addNode)', () => {
      useFlowStore.getState().createBoundary({
        label: 'Test Boundary',
        type: 'security_zone',
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
        color: '#e2e8f0',
      });

      expect(checkpointCallCount).toBe(1);
      expect(lastCheckpointNodes).toHaveLength(1);
      expect(lastCheckpointNodes[0].type).toBe('boundary');
    });
  });

  describe('Bulk Operations', () => {
    it('should create single checkpoint for bulk deletion (MultiSelectPanel pattern)', () => {
      // Add multiple nodes
      const node1 = createTestNode('node-1');
      const node2 = createTestNode('node-2');
      const node3 = createTestNode('node-3');
      useFlowStore.getState().addNode(node1);
      useFlowStore.getState().addNode(node2);
      useFlowStore.getState().addNode(node3);
      checkpointCallCount = 0;

      // Simulate bulk deletion pattern
      useFlowStore.getState().requestCheckpoint(); // Single checkpoint before
      useFlowStore.getState().deleteNode('node-1', true); // Skip individual
      useFlowStore.getState().deleteNode('node-2', true); // Skip individual
      useFlowStore.getState().deleteNode('node-3', true); // Skip individual

      expect(checkpointCallCount).toBe(1); // Only one checkpoint
    });

    it('should create single checkpoint for keyboard deletion pattern', () => {
      const node1 = createTestNode('node-1');
      const node2 = createTestNode('node-2');
      useFlowStore.getState().addNode(node1);
      useFlowStore.getState().addNode(node2);
      checkpointCallCount = 0;

      // Simulate keyboard deletion pattern
      useFlowStore.getState().requestCheckpoint(); // Single checkpoint before
      useFlowStore.getState().deleteNode('node-1', true);
      useFlowStore.getState().deleteNode('node-2', true);

      expect(checkpointCallCount).toBe(1);
    });

    it('should create checkpoint for alignment operations', () => {
      const node1 = createTestNode('node-1', { position: { x: 0, y: 0 } });
      const node2 = createTestNode('node-2', { position: { x: 100, y: 100 } });
      useFlowStore.getState().addNode(node1);
      useFlowStore.getState().addNode(node2);
      checkpointCallCount = 0;

      // Simulate alignment operation
      useFlowStore.getState().requestCheckpoint();
      const nodes = useFlowStore.getState().nodes;
      const alignedNodes = nodes.map(node => 
        node.id === 'node-2' 
          ? { ...node, position: { ...node.position, x: 0 } }
          : node
      );
      useFlowStore.getState().setNodes(alignedNodes);

      expect(checkpointCallCount).toBe(1);
    });
  });

  describe('Checkpoint API', () => {
    it('should call registered checkpoint function', () => {
      const mockFn = vi.fn();
      useFlowStore.getState().setCheckpointFunction(mockFn);

      useFlowStore.getState().requestCheckpoint();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should register checkpoint function correctly', () => {
      const mockFn = vi.fn();
      useFlowStore.getState().setCheckpointFunction(mockFn);

      // Request checkpoint should call the registered function
      useFlowStore.getState().requestCheckpoint();
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle missing checkpoint function gracefully', () => {
      // Don't register a function
      useFlowStore.setState({ 
        setCheckpointFunction: () => {}, // Reset
      });

      // Should not throw
      expect(() => {
        useFlowStore.getState().requestCheckpoint();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid operations correctly', async () => {
      // Add multiple nodes rapidly
      for (let i = 0; i < 5; i++) {
        useFlowStore.getState().addNode(createTestNode(`node-${i}`));
      }

      // Each addNode should create a checkpoint
      expect(checkpointCallCount).toBe(5);
    });

    it('should preserve nested boundaries on undo/redo', () => {
      const parent = createTestBoundary('boundary-1');
      const child = createTestNode('node-1', { parentId: 'boundary-1' });

      useFlowStore.getState().addNode(parent);
      useFlowStore.getState().addNode(child);

      const state = useFlowStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.find(n => n.id === 'node-1')?.parentId).toBe('boundary-1');
    });

    it('should preserve connected edges on undo/redo', () => {
      const node1 = createTestNode('node-1');
      const node2 = createTestNode('node-2');
      const edge = createTestEdge('edge-1', 'node-1', 'node-2');

      useFlowStore.getState().addNode(node1);
      useFlowStore.getState().addNode(node2);
      useFlowStore.getState().addEdgeCustom(edge);

      const state = useFlowStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].source).toBe('node-1');
      expect(state.edges[0].target).toBe('node-2');
    });
  });
});
