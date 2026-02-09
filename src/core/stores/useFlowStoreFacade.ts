/**
 * Flow Store Facade
 *
 * Provides a unified, backward-compatible interface to all flow domain stores.
 * This facade maintains the exact same API as the original useFlowStore,
 * ensuring all 82+ consumer files continue to work without modification.
 *
 * Supports Zustand's selector pattern: useFlowStore((state) => state.nodes)
 *
 * Architecture:
 * - useTopologyStore: nodes, edges, mutations
 * - useSelectionStore: selection state
 * - useProjectStore: project management
 * - useCanvasUIStore: UI modes, modals, panels
 * - useSettingsStore: global settings, React Flow instance
 * - useUndoRedoStore: undo/redo with hash-based change detection
 */

import { useSyncExternalStore, useCallback, useRef } from 'react';
import {
  useTopologyStore,
  useSelectionStore,
  useProjectStore,
  useCanvasUIStore,
  useSettingsStore,
  useUndoRedoStore,
  PlacementModeData,
  BoundaryDrawingModeData,
} from './flow';
import {
  AppNode,
  AppEdge,
  DeviceNodeData,
  BoundaryNodeData,
  EdgeMetadata,
  BoundaryType,
  Project,
  NistBaseline,
  GlobalSettings,
} from '@/lib/utils/types';
import { TidyOptions, TidyResult } from '@/lib/topology/auto-tidy';
import {
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';

// Re-export types for consumers
export type { PlacementModeData, BoundaryDrawingModeData };

/**
 * FlowState interface - maintains exact same shape as original useFlowStore
 */
export interface FlowState {
  // Topology State
  nodes: AppNode[];
  edges: AppEdge[];

  // Selection State
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // UI Modes
  placementMode: PlacementModeData | null;
  boundaryDrawingMode: BoundaryDrawingModeData | null;

  // Project State
  currentProject: Project | null;
  projects: Project[];
  showProjectDialog: boolean;
  newProjectName: string;
  newProjectBaseline: NistBaseline;

  // Panels & Modals
  showInventoryPanel: boolean;
  showSSPModal: boolean;
  showControlSuggestionModal: boolean;
  suggestionModalData: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    suggestions: any[];
  } | null;

  // Export Selection
  exportSelectionMode: boolean;
  exportSelectionBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  savedExportBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  exportSelectionCallback:
    | ((data: {
        bounds: { x: number; y: number; width: number; height: number };
        previewImage: string;
      }) => void)
    | null;

  // Settings
  globalSettings: GlobalSettings;
  reactFlowInstance: {
    getNodesBounds: ((nodes: any[]) => any) | null;
    getViewport: (() => { x: number; y: number; zoom: number }) | null;
  };

  // Auto-Tidy
  isTidying: boolean;
  tidyProgress: number;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;

  // Computed selectors
  getSelectedNode: () => AppNode | undefined;
  getSelectedEdge: () => AppEdge | undefined;

  // Node/Edge mutations
  setNodes: (nodes: AppNode[] | ((nodes: AppNode[]) => AppNode[])) => void;
  setEdges: (edges: AppEdge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: AppNode) => void;
  updateNode: (
    nodeId: string,
    data: Partial<DeviceNodeData | BoundaryNodeData>
  ) => void;
  deleteNode: (nodeId: string) => void;
  addEdgeCustom: (edge: AppEdge) => void;
  updateEdge: (edgeId: string, data: Partial<EdgeMetadata>) => void;
  deleteEdge: (edgeId: string) => void;

  // Selection actions
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  setSelectedNodeIds: (nodeIds: string[]) => void;
  setSelectedEdgeIds: (edgeIds: string[]) => void;
  clearAllSelections: () => void;
  getMultiSelectCount: () => { nodes: number; edges: number };

  // Placement mode
  setPlacementMode: (mode: PlacementModeData | null) => void;
  handlePlacementComplete: () => void;

  // Boundary drawing mode
  setBoundaryDrawingMode: (mode: BoundaryDrawingModeData | null) => void;

  // Boundary creation
  createBoundary: (boundary: {
    label: string;
    type: BoundaryType;
    position: { x: number; y: number };
    width: number;
    height: number;
    color?: string;
  }) => void;

  // Project management
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setShowProjectDialog: (show: boolean) => void;
  setNewProjectName: (name: string) => void;
  setNewProjectBaseline: (baseline: NistBaseline) => void;
  setShowInventoryPanel: (show: boolean) => void;
  setShowSSPModal: (show: boolean) => void;
  setShowControlSuggestionModal: (show: boolean) => void;
  setSuggestionModalData: (
    data: {
      deviceId: string;
      deviceName: string;
      deviceType: string;
      suggestions: any[];
    } | null
  ) => void;
  assignControlsToDevice: (deviceId: string, controlIds: string[]) => void;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: number) => Promise<void>;
  createNewProject: () => Promise<void>;
  createFromTemplate: (templateId: string, projectName: string) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;

  // Export selection
  startExportSelection: (
    callback?: (data: {
      bounds: { x: number; y: number; width: number; height: number };
      previewImage: string;
    }) => void
  ) => void;
  cancelExportSelection: () => void;
  setExportSelectionBounds: (
    bounds: { x: number; y: number; width: number; height: number } | null
  ) => void;
  saveExportBounds: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  clearSavedExportBounds: () => void;

  // Settings
  setGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  setReactFlowInstance: (instance: {
    getNodesBounds: (nodes: any[]) => any;
    getViewport: () => { x: number; y: number; zoom: number };
  }) => void;

  // Auto-save
  saveCurrentDiagram: () => Promise<void>;

  // Export/Import
  exportFullReport: () => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
    canceled?: boolean;
  }>;
  importDiagramFromJSON: () => Promise<{ success: boolean; error?: string }>;

  // Sample Network
  loadSampleNetwork: () => Promise<void>;

  // Auto-Tidy
  tidyDiagram: (options?: Partial<TidyOptions>) => Promise<TidyResult | null>;
  smartTidy: (options?: Partial<TidyOptions>) => Promise<TidyResult | null>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;

  // Legacy compatibility (no-ops, kept for backward compatibility)
  setUndoRedoFunctions: (undoFn: () => void, redoFn: () => void) => void;
  updateUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;

  // Initialize
  initialize: () => Promise<void>;
}

/**
 * Build the combined state from all domain stores
 */
function buildCombinedState(): FlowState {
  const topology = useTopologyStore.getState();
  const selection = useSelectionStore.getState();
  const project = useProjectStore.getState();
  const canvasUI = useCanvasUIStore.getState();
  const settings = useSettingsStore.getState();
  const undoRedo = useUndoRedoStore.getState();

  // Computed selectors
  const getSelectedNode = () => {
    if (!selection.selectedNodeId) return undefined;
    return topology.nodes.find((n) => n.id === selection.selectedNodeId);
  };

  const getSelectedEdge = () => {
    if (!selection.selectedEdgeId) return undefined;
    if (!Array.isArray(topology.edges)) return undefined;
    return topology.edges.find((e) => e.id === selection.selectedEdgeId);
  };

  // Undo/redo wrappers
  const undo = () => {
    undoRedo.undo(
      (nodes) => topology.setNodes(nodes),
      (edges) => topology.setEdges(edges),
      () => useTopologyStore.getState().nodes,
      () => useTopologyStore.getState().edges
    );
  };

  const redo = () => {
    undoRedo.redo(
      (nodes) => topology.setNodes(nodes),
      (edges) => topology.setEdges(edges),
      () => useTopologyStore.getState().nodes,
      () => useTopologyStore.getState().edges
    );
  };

  return {
    // Topology State
    nodes: topology.nodes,
    edges: topology.edges,

    // Selection State
    selectedNodeId: selection.selectedNodeId,
    selectedEdgeId: selection.selectedEdgeId,
    selectedNodeIds: selection.selectedNodeIds,
    selectedEdgeIds: selection.selectedEdgeIds,

    // UI Modes
    placementMode: canvasUI.placementMode,
    boundaryDrawingMode: canvasUI.boundaryDrawingMode,

    // Project State
    currentProject: project.currentProject,
    projects: project.projects,
    showProjectDialog: canvasUI.showProjectDialog,
    newProjectName: project.newProjectName,
    newProjectBaseline: project.newProjectBaseline,

    // Panels & Modals
    showInventoryPanel: canvasUI.showInventoryPanel,
    showSSPModal: canvasUI.showSSPModal,
    showControlSuggestionModal: canvasUI.showControlSuggestionModal,
    suggestionModalData: canvasUI.suggestionModalData,

    // Export Selection
    exportSelectionMode: canvasUI.exportSelectionMode,
    exportSelectionBounds: canvasUI.exportSelectionBounds,
    savedExportBounds: canvasUI.savedExportBounds,
    exportSelectionCallback: canvasUI.exportSelectionCallback,

    // Settings
    globalSettings: settings.globalSettings,
    reactFlowInstance: settings.reactFlowInstance,

    // Auto-Tidy
    isTidying: settings.isTidying,
    tidyProgress: settings.tidyProgress,

    // Undo/Redo
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,

    // Computed selectors
    getSelectedNode,
    getSelectedEdge,

    // Node/Edge mutations
    setNodes: topology.setNodes,
    setEdges: topology.setEdges,
    onNodesChange: topology.onNodesChange,
    onEdgesChange: topology.onEdgesChange,
    onConnect: topology.onConnect,
    addNode: topology.addNode,
    updateNode: topology.updateNode,
    deleteNode: topology.deleteNode,
    addEdgeCustom: topology.addEdgeCustom,
    updateEdge: topology.updateEdge,
    deleteEdge: topology.deleteEdge,

    // Selection actions
    setSelectedNodeId: selection.setSelectedNodeId,
    setSelectedEdgeId: selection.setSelectedEdgeId,
    setSelectedNodeIds: selection.setSelectedNodeIds,
    setSelectedEdgeIds: selection.setSelectedEdgeIds,
    clearAllSelections: selection.clearAllSelections,
    getMultiSelectCount: selection.getMultiSelectCount,

    // Placement mode
    setPlacementMode: canvasUI.setPlacementMode,
    handlePlacementComplete: canvasUI.handlePlacementComplete,

    // Boundary drawing mode
    setBoundaryDrawingMode: canvasUI.setBoundaryDrawingMode,

    // Boundary creation
    createBoundary: topology.createBoundary,

    // Project management
    setCurrentProject: project.setCurrentProject,
    setProjects: project.setProjects,
    setShowProjectDialog: canvasUI.setShowProjectDialog,
    setNewProjectName: project.setNewProjectName,
    setNewProjectBaseline: project.setNewProjectBaseline,
    setShowInventoryPanel: canvasUI.setShowInventoryPanel,
    setShowSSPModal: canvasUI.setShowSSPModal,
    setShowControlSuggestionModal: canvasUI.setShowControlSuggestionModal,
    setSuggestionModalData: canvasUI.setSuggestionModalData,
    assignControlsToDevice: project.assignControlsToDevice,
    loadProjects: project.loadProjects,
    loadProject: project.loadProject,
    createNewProject: project.createNewProject,
    createFromTemplate: project.createFromTemplate,
    deleteProject: project.deleteProject,

    // Export selection
    startExportSelection: canvasUI.startExportSelection,
    cancelExportSelection: canvasUI.cancelExportSelection,
    setExportSelectionBounds: canvasUI.setExportSelectionBounds,
    saveExportBounds: canvasUI.saveExportBounds,
    clearSavedExportBounds: canvasUI.clearSavedExportBounds,

    // Settings
    setGlobalSettings: settings.setGlobalSettings,
    setReactFlowInstance: settings.setReactFlowInstance,

    // Auto-save
    saveCurrentDiagram: project.saveCurrentDiagram,

    // Export/Import
    exportFullReport: project.exportFullReport,
    importDiagramFromJSON: project.importDiagramFromJSON,

    // Sample Network
    loadSampleNetwork: project.loadSampleNetwork,

    // Auto-Tidy
    tidyDiagram: project.tidyDiagram,
    smartTidy: project.smartTidy,

    // Undo/Redo
    undo,
    redo,

    // Legacy compatibility (no-ops)
    setUndoRedoFunctions: () => {},
    updateUndoRedoState: () => {},

    // Initialize
    initialize: project.initialize,
  };
}

// Listeners for store subscriptions
type Listener = () => void;
const listeners = new Set<Listener>();

// Cached combined state - rebuilt only when stores change
let cachedState: FlowState | null = null;
let stateVersion = 0;

/**
 * Get or rebuild the cached combined state
 */
function getCachedState(): FlowState {
  if (cachedState === null) {
    cachedState = buildCombinedState();
  }
  return cachedState;
}

/**
 * Invalidate the cache and notify listeners
 */
function invalidateCache() {
  cachedState = null;
  stateVersion++;
  listeners.forEach((listener) => listener());
}

// Subscribe to all domain stores and notify listeners when any changes
let isSubscribed = false;
function ensureSubscribed() {
  if (isSubscribed) return;
  isSubscribed = true;

  useTopologyStore.subscribe(invalidateCache);
  useSelectionStore.subscribe(invalidateCache);
  useProjectStore.subscribe(invalidateCache);
  useCanvasUIStore.subscribe(invalidateCache);
  useSettingsStore.subscribe(invalidateCache);
  useUndoRedoStore.subscribe(invalidateCache);
}

// Initialize subscriptions immediately
ensureSubscribed();

/**
 * Subscribe function for useSyncExternalStore
 */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * useFlowStore - Facade hook that combines all domain stores
 *
 * Supports two call patterns:
 * 1. useFlowStore() - returns full FlowState
 * 2. useFlowStore(selector) - returns selected subset
 * 3. useFlowStore(selector, equalityFn) - returns selected subset with custom equality
 */
export function useFlowStore(): FlowState;
export function useFlowStore<T>(selector: (state: FlowState) => T): T;
export function useFlowStore<T>(
  selector: (state: FlowState) => T,
  equalityFn: (a: T, b: T) => boolean
): T;
export function useFlowStore<T>(
  selector?: (state: FlowState) => T,
  equalityFn?: (a: T, b: T) => boolean
): T | FlowState {
  // Store selector and equalityFn in refs to keep getSnapshot stable
  const selectorRef = useRef(selector);
  const equalityFnRef = useRef(equalityFn);
  const prevSelectedRef = useRef<T | undefined>(undefined);
  const prevVersionRef = useRef<number>(-1);

  // Update refs on each render (but don't change getSnapshot reference)
  selectorRef.current = selector;
  equalityFnRef.current = equalityFn;

  // Create a stable getSnapshot function using refs
  const getSnapshotWithSelector = useCallback(() => {
    const state = getCachedState();
    const currentSelector = selectorRef.current;
    const currentEqualityFn = equalityFnRef.current;

    if (!currentSelector) return state;

    const selected = currentSelector(state);

    // If we have an equality function and version hasn't changed, check equality
    if (currentEqualityFn && prevVersionRef.current === stateVersion && prevSelectedRef.current !== undefined) {
      if (currentEqualityFn(prevSelectedRef.current, selected)) {
        return prevSelectedRef.current;
      }
    }

    prevSelectedRef.current = selected;
    prevVersionRef.current = stateVersion;
    return selected;
  }, []); // Empty deps - stable reference

  return useSyncExternalStore(
    subscribe,
    getSnapshotWithSelector,
    getSnapshotWithSelector // Server snapshot (same as client for now)
  );
}

/**
 * Static getState() equivalent for non-React contexts.
 * Use this when you need to access state outside of React components.
 */
useFlowStore.getState = getCachedState;

/**
 * Subscribe to store changes (for non-React usage)
 */
useFlowStore.subscribe = (listener: (state: FlowState) => void): (() => void) => {
  const wrappedListener = () => listener(getCachedState());
  listeners.add(wrappedListener);
  return () => {
    listeners.delete(wrappedListener);
  };
};

/**
 * Set state directly (limited support for backward compatibility)
 * Only supports partial state updates that map to specific domain stores
 */
useFlowStore.setState = (partial: Partial<FlowState>): void => {
  if (partial.nodes !== undefined) {
    useTopologyStore.getState().setNodes(partial.nodes);
  }
  if (partial.edges !== undefined) {
    useTopologyStore.getState().setEdges(partial.edges);
  }
  if (partial.selectedNodeId !== undefined) {
    useSelectionStore.getState().setSelectedNodeId(partial.selectedNodeId);
  }
  if (partial.selectedEdgeId !== undefined) {
    useSelectionStore.getState().setSelectedEdgeId(partial.selectedEdgeId);
  }
  if (partial.globalSettings !== undefined) {
    useSettingsStore.getState().setGlobalSettings(partial.globalSettings);
  }
  // Add more as needed
};
