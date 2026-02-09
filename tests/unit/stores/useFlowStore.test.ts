import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useFlowStore } from '@/core/stores/useFlowStore';
import type { AppNode, AppEdge, Project } from '@/lib/utils/types';

// Mock dependencies
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

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import { db } from '@/core/database/client';

describe('useFlowStore', () => {
  const createMockNode = (id: string, type = 'device'): AppNode => ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: { id, label: `Node ${id}`, deviceType: 'server' },
  } as AppNode);

  const createMockEdge = (id: string, source: string, target: string): AppEdge => ({
    id,
    source,
    target,
    type: 'default',
  } as AppEdge);

  const mockProject: Project = {
    id: 1,
    name: 'Test Project',
    baseline: 'MODERATE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
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
        showGrid: false,
        snapToGrid: false,
        gridSize: 20,
      },
      reactFlowInstance: { getNodesBounds: null },
    });
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useFlowStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedEdgeId).toBeNull();
      expect(state.currentProject).toBeNull();
      expect(state.placementMode).toBeNull();
    });
  });

  describe('Node Operations', () => {
    describe('addNode', () => {
      it('should add a node', () => {
        const node = createMockNode('node-1');
        useFlowStore.getState().addNode(node);

        expect(useFlowStore.getState().nodes).toHaveLength(1);
        expect(useFlowStore.getState().nodes[0].id).toBe('node-1');
      });

      it('should filter out deprecated capture nodes', () => {
        const captureNode = { ...createMockNode('capture-1'), type: 'capture' } as AppNode;
        useFlowStore.getState().setNodes([captureNode]);

        expect(useFlowStore.getState().nodes).toHaveLength(0);
      });
    });

    describe('updateNode', () => {
      it('should update node data', () => {
        const node = createMockNode('node-1');
        useFlowStore.setState({ ...useFlowStore.getState(), nodes: [node] });

        useFlowStore.getState().updateNode('node-1', { label: 'Updated Label' });

        const updatedNode = useFlowStore.getState().nodes[0];
        expect(updatedNode.data.label).toBe('Updated Label');
      });

      it('should preserve other node properties', () => {
        const node = createMockNode('node-1');
        useFlowStore.setState({ ...useFlowStore.getState(), nodes: [node] });

        useFlowStore.getState().updateNode('node-1', { label: 'Updated' });

        const updatedNode = useFlowStore.getState().nodes[0];
        expect(updatedNode.data.deviceType).toBe('server');
      });
    });

    describe('deleteNode', () => {
      it('should delete a node', () => {
        const node = createMockNode('node-1');
        useFlowStore.setState({ ...useFlowStore.getState(), nodes: [node] });

        useFlowStore.getState().deleteNode('node-1');

        expect(useFlowStore.getState().nodes).toHaveLength(0);
      });

      it('should clear selection if deleted node was selected', () => {
        const node = createMockNode('node-1');
        useFlowStore.setState({
          ...useFlowStore.getState(),
          nodes: [node],
          selectedNodeId: 'node-1',
        });

        useFlowStore.getState().deleteNode('node-1');

        expect(useFlowStore.getState().selectedNodeId).toBeNull();
      });

      it('should clean up orphaned children', () => {
        const parentNode = createMockNode('parent');
        const childNode = {
          ...createMockNode('child'),
          parentId: 'parent',
          extent: 'parent' as const,
        } as AppNode;

        useFlowStore.setState({
          ...useFlowStore.getState(),
          nodes: [parentNode, childNode],
        });

        useFlowStore.getState().deleteNode('parent');

        const remainingNodes = useFlowStore.getState().nodes;
        expect(remainingNodes).toHaveLength(1);
        expect(remainingNodes[0].parentId).toBeUndefined();
      });
    });

    describe('setNodes', () => {
      it('should set nodes array', () => {
        const nodes = [createMockNode('node-1'), createMockNode('node-2')];
        useFlowStore.getState().setNodes(nodes);

        expect(useFlowStore.getState().nodes).toHaveLength(2);
      });

      it('should accept function updater', () => {
        useFlowStore.setState({
          ...useFlowStore.getState(),
          nodes: [createMockNode('node-1')],
        });

        useFlowStore.getState().setNodes((prev) => [...prev, createMockNode('node-2')]);

        expect(useFlowStore.getState().nodes).toHaveLength(2);
      });

      it('should sort nodes topologically (parent before children)', () => {
        const child = {
          ...createMockNode('child'),
          parentId: 'parent',
        } as AppNode;
        const parent = createMockNode('parent');

        // Add child before parent
        useFlowStore.getState().setNodes([child, parent]);

        const nodes = useFlowStore.getState().nodes;
        const parentIndex = nodes.findIndex((n) => n.id === 'parent');
        const childIndex = nodes.findIndex((n) => n.id === 'child');
        expect(parentIndex).toBeLessThan(childIndex);
      });

      it('should clean up orphaned parentId references', () => {
        const orphanedChild = {
          ...createMockNode('orphan'),
          parentId: 'non-existent',
        } as AppNode;

        useFlowStore.getState().setNodes([orphanedChild]);

        const nodes = useFlowStore.getState().nodes;
        expect(nodes[0].parentId).toBeUndefined();
      });
    });
  });

  describe('Edge Operations', () => {
    describe('addEdgeCustom', () => {
      it('should add an edge', () => {
        const edge = createMockEdge('edge-1', 'node-1', 'node-2');
        useFlowStore.getState().addEdgeCustom(edge);

        expect(useFlowStore.getState().edges).toHaveLength(1);
      });
    });

    describe('updateEdge', () => {
      it('should update edge data', () => {
        const edge = createMockEdge('edge-1', 'node-1', 'node-2');
        useFlowStore.setState({ ...useFlowStore.getState(), edges: [edge] });

        useFlowStore.getState().updateEdge('edge-1', { label: 'Connection' });

        const updatedEdge = useFlowStore.getState().edges[0];
        expect(updatedEdge.data?.label).toBe('Connection');
      });
    });

    describe('deleteEdge', () => {
      it('should delete an edge', () => {
        const edge = createMockEdge('edge-1', 'node-1', 'node-2');
        useFlowStore.setState({ ...useFlowStore.getState(), edges: [edge] });

        useFlowStore.getState().deleteEdge('edge-1');

        expect(useFlowStore.getState().edges).toHaveLength(0);
      });

      it('should clear selection if deleted edge was selected', () => {
        const edge = createMockEdge('edge-1', 'node-1', 'node-2');
        useFlowStore.setState({
          ...useFlowStore.getState(),
          edges: [edge],
          selectedEdgeId: 'edge-1',
        });

        useFlowStore.getState().deleteEdge('edge-1');

        expect(useFlowStore.getState().selectedEdgeId).toBeNull();
      });
    });

    describe('setEdges', () => {
      it('should set edges array', () => {
        const edges = [
          createMockEdge('edge-1', 'node-1', 'node-2'),
          createMockEdge('edge-2', 'node-2', 'node-3'),
        ];
        useFlowStore.getState().setEdges(edges);

        expect(useFlowStore.getState().edges).toHaveLength(2);
      });
    });
  });

  describe('Selection', () => {
    it('should set selected node and clear edge selection', () => {
      useFlowStore.setState({
        ...useFlowStore.getState(),
        selectedEdgeId: 'edge-1',
      });

      useFlowStore.getState().setSelectedNodeId('node-1');

      expect(useFlowStore.getState().selectedNodeId).toBe('node-1');
      expect(useFlowStore.getState().selectedEdgeId).toBeNull();
    });

    it('should set selected edge and clear node selection', () => {
      useFlowStore.setState({
        ...useFlowStore.getState(),
        selectedNodeId: 'node-1',
      });

      useFlowStore.getState().setSelectedEdgeId('edge-1');

      expect(useFlowStore.getState().selectedEdgeId).toBe('edge-1');
      expect(useFlowStore.getState().selectedNodeId).toBeNull();
    });

    it('should return selected node from computed property', () => {
      const node = createMockNode('node-1');
      useFlowStore.setState({
        ...useFlowStore.getState(),
        nodes: [node],
        selectedNodeId: 'node-1',
      });

      expect(useFlowStore.getState().getSelectedNode()).toEqual(node);
    });

    it('should return selected edge from computed property', () => {
      const edge = createMockEdge('edge-1', 'node-1', 'node-2');
      useFlowStore.setState({
        ...useFlowStore.getState(),
        edges: [edge],
        selectedEdgeId: 'edge-1',
      });

      expect(useFlowStore.getState().getSelectedEdge()).toEqual(edge);
    });
  });

  describe('Placement Mode', () => {
    it('should set placement mode', () => {
      const placementData = {
        deviceType: 'server' as const,
        iconFilename: 'server.svg',
        displayName: 'Server',
      };

      useFlowStore.getState().setPlacementMode(placementData);

      expect(useFlowStore.getState().placementMode).toEqual(placementData);
    });

    it('should clear placement mode on complete', () => {
      useFlowStore.setState({
        ...useFlowStore.getState(),
        placementMode: {
          deviceType: 'server' as const,
          iconFilename: 'server.svg',
          displayName: 'Server',
        },
      });

      useFlowStore.getState().handlePlacementComplete();

      expect(useFlowStore.getState().placementMode).toBeNull();
    });
  });

  describe('Boundary Creation', () => {
    it('should create a boundary node', () => {
      useFlowStore.getState().createBoundary({
        label: 'Test Boundary',
        type: 'authorization',
        position: { x: 100, y: 100 },
        width: 400,
        height: 300,
      });

      const nodes = useFlowStore.getState().nodes;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('boundary');
      expect(nodes[0].data.label).toBe('Test Boundary');
    });
  });

  describe('Project Management', () => {
    it('should set current project', () => {
      useFlowStore.getState().setCurrentProject(mockProject);
      expect(useFlowStore.getState().currentProject).toEqual(mockProject);
    });

    it('should set projects list', () => {
      useFlowStore.getState().setProjects([mockProject]);
      expect(useFlowStore.getState().projects).toEqual([mockProject]);
    });

    it('should toggle project dialog', () => {
      useFlowStore.getState().setShowProjectDialog(true);
      expect(useFlowStore.getState().showProjectDialog).toBe(true);

      useFlowStore.getState().setShowProjectDialog(false);
      expect(useFlowStore.getState().showProjectDialog).toBe(false);
    });

    it('should set new project name', () => {
      useFlowStore.getState().setNewProjectName('New Project');
      expect(useFlowStore.getState().newProjectName).toBe('New Project');
    });

    it('should set new project baseline', () => {
      useFlowStore.getState().setNewProjectBaseline('HIGH');
      expect(useFlowStore.getState().newProjectBaseline).toBe('HIGH');
    });

    describe('loadProjects', () => {
      it('should load projects from database', async () => {
        vi.mocked(db.listProjects).mockResolvedValueOnce([mockProject]);
        vi.mocked(db.loadDiagram).mockResolvedValueOnce({ nodes: [], edges: [] });

        await useFlowStore.getState().loadProjects();

        expect(useFlowStore.getState().projects).toHaveLength(1);
        expect(db.listProjects).toHaveBeenCalled();
      });
    });

    describe('loadProject', () => {
      it('should load project diagram', async () => {
        const nodes = [createMockNode('node-1')];
        const edges = [createMockEdge('edge-1', 'node-1', 'node-2')];

        useFlowStore.setState({
          ...useFlowStore.getState(),
          projects: [mockProject],
        });

        vi.mocked(db.loadDiagram).mockResolvedValueOnce({ nodes, edges });

        await useFlowStore.getState().loadProject(1);

        expect(useFlowStore.getState().nodes).toHaveLength(1);
        expect(useFlowStore.getState().edges).toHaveLength(1);
        expect(useFlowStore.getState().currentProject).toEqual(mockProject);
      });
    });

    describe('createNewProject', () => {
      it('should create new project', async () => {
        useFlowStore.setState({
          ...useFlowStore.getState(),
          newProjectName: 'New Project',
          newProjectBaseline: 'HIGH',
        });

        const newProject = { ...mockProject, id: 2, name: 'New Project', baseline: 'HIGH' as const };
        vi.mocked(db.createProject).mockResolvedValueOnce(newProject);
        vi.mocked(db.listProjects).mockResolvedValueOnce([newProject]);

        await useFlowStore.getState().createNewProject();

        expect(useFlowStore.getState().currentProject).toEqual(newProject);
        expect(useFlowStore.getState().nodes).toEqual([]);
        expect(useFlowStore.getState().edges).toEqual([]);
        expect(useFlowStore.getState().newProjectName).toBe('');
        expect(useFlowStore.getState().showProjectDialog).toBe(false);
      });

      it('should not create project with empty name', async () => {
        useFlowStore.setState({
          ...useFlowStore.getState(),
          newProjectName: '   ',
        });

        await useFlowStore.getState().createNewProject();

        expect(db.createProject).not.toHaveBeenCalled();
      });
    });

    describe('deleteProject', () => {
      it('should delete project and reload', async () => {
        useFlowStore.setState({
          ...useFlowStore.getState(),
          currentProject: mockProject,
          nodes: [createMockNode('node-1')],
        });

        vi.mocked(db.deleteProject).mockResolvedValueOnce(undefined);
        vi.mocked(db.listProjects).mockResolvedValueOnce([]);

        await useFlowStore.getState().deleteProject(1);

        expect(db.deleteProject).toHaveBeenCalledWith(1);
        expect(useFlowStore.getState().currentProject).toBeNull();
        expect(useFlowStore.getState().nodes).toEqual([]);
      });
    });
  });

  describe('Global Settings', () => {
    it('should update global settings', () => {
      useFlowStore.getState().setGlobalSettings({ showGrid: true });

      expect(useFlowStore.getState().globalSettings.showGrid).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should preserve other settings when updating', () => {
      const initialSettings = useFlowStore.getState().globalSettings;
      useFlowStore.getState().setGlobalSettings({ showGrid: true });

      const settings = useFlowStore.getState().globalSettings;
      expect(settings.globalDeviceLabelSize).toBe(initialSettings.globalDeviceLabelSize);
    });
  });

  describe('Export Selection', () => {
    it('should start export selection mode', () => {
      const callback = vi.fn();
      useFlowStore.getState().startExportSelection(callback);

      expect(useFlowStore.getState().exportSelectionMode).toBe(true);
      expect(useFlowStore.getState().exportSelectionBounds).toBeNull();
    });

    it('should cancel export selection', () => {
      useFlowStore.setState({
        ...useFlowStore.getState(),
        exportSelectionMode: true,
        exportSelectionBounds: { x: 0, y: 0, width: 100, height: 100 },
      });

      useFlowStore.getState().cancelExportSelection();

      expect(useFlowStore.getState().exportSelectionMode).toBe(false);
      expect(useFlowStore.getState().exportSelectionBounds).toBeNull();
    });

    it('should set export selection bounds', () => {
      const bounds = { x: 10, y: 20, width: 300, height: 200 };
      useFlowStore.getState().setExportSelectionBounds(bounds);

      expect(useFlowStore.getState().exportSelectionBounds).toEqual(bounds);
    });

    it('should save and clear export bounds', () => {
      const bounds = { x: 10, y: 20, width: 300, height: 200 };
      useFlowStore.getState().saveExportBounds(bounds);
      expect(useFlowStore.getState().savedExportBounds).toEqual(bounds);

      useFlowStore.getState().clearSavedExportBounds();
      expect(useFlowStore.getState().savedExportBounds).toBeNull();
    });
  });

  describe('Undo/Redo State', () => {
    it('should update undo/redo state', () => {
      useFlowStore.getState().updateUndoRedoState(true, false);

      expect(useFlowStore.getState().canUndo).toBe(true);
      expect(useFlowStore.getState().canRedo).toBe(false);
    });
  });

  describe('Modal State', () => {
    it('should toggle inventory panel', () => {
      useFlowStore.getState().setShowInventoryPanel(true);
      expect(useFlowStore.getState().showInventoryPanel).toBe(true);
    });

    it('should toggle SSP modal', () => {
      useFlowStore.getState().setShowSSPModal(true);
      expect(useFlowStore.getState().showSSPModal).toBe(true);
    });

    it('should toggle control suggestion modal', () => {
      useFlowStore.getState().setShowControlSuggestionModal(true);
      expect(useFlowStore.getState().showControlSuggestionModal).toBe(true);
    });

    it('should set suggestion modal data', () => {
      const data = {
        deviceId: 'device-1',
        deviceName: 'Server',
        deviceType: 'server',
        suggestions: [],
      };

      useFlowStore.getState().setSuggestionModalData(data);
      expect(useFlowStore.getState().suggestionModalData).toEqual(data);
    });
  });

  describe('assignControlsToDevice', () => {
    it('should assign controls to device', () => {
      const node = createMockNode('device-1');
      useFlowStore.setState({ ...useFlowStore.getState(), nodes: [node] });

      useFlowStore.getState().assignControlsToDevice('device-1', ['AC-2', 'SC-7']);

      const device = useFlowStore.getState().nodes[0];
      expect(device.data.assignedControls).toContain('AC-2');
      expect(device.data.assignedControls).toContain('SC-7');
    });

    it('should merge with existing controls', () => {
      const node = {
        ...createMockNode('device-1'),
        data: {
          ...createMockNode('device-1').data,
          assignedControls: ['AU-2'],
          controlNotes: { 'AU-2': 'Existing note' },
        },
      } as AppNode;
      useFlowStore.setState({ ...useFlowStore.getState(), nodes: [node] });

      useFlowStore.getState().assignControlsToDevice('device-1', ['AC-2', 'SC-7']);

      const device = useFlowStore.getState().nodes[0];
      expect(device.data.assignedControls).toContain('AU-2');
      expect(device.data.assignedControls).toContain('AC-2');
      expect(device.data.assignedControls).toContain('SC-7');
    });
  });
});
