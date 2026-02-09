/**
 * Flow Store Selectors
 *
 * Provides optimized selectors for useFlowStore using Zustand's shallow equality checking.
 * These selectors prevent unnecessary re-renders by only triggering updates when
 * the specific slice of state actually changes.
 *
 * Usage:
 * ```tsx
 * import { useFlowStore } from '@/core/stores/useFlowStore';
 * import { selectTopology, selectProjectUI } from '@/core/stores/selectors/flowSelectors';
 * import { useShallow } from 'zustand/react/shallow';
 *
 * // In component:
 * const { nodes, edges } = useFlowStore(useShallow(selectTopology));
 * ```
 */

import type { AppNode, AppEdge, Project, GlobalSettings, NistBaseline } from '@/lib/utils/types';
import type { PlacementModeData } from '../useFlowStore';

// Type for the full flow state
interface FlowState {
  nodes: AppNode[];
  edges: AppEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  placementMode: PlacementModeData | null;
  currentProject: Project | null;
  projects: Project[];
  showProjectDialog: boolean;
  newProjectName: string;
  newProjectBaseline: NistBaseline;
  showInventoryPanel: boolean;
  showSSPModal: boolean;
  showControlSuggestionModal: boolean;
  suggestionModalData: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    suggestions: any[];
  } | null;
  exportSelectionMode: boolean;
  exportSelectionBounds: { x: number; y: number; width: number; height: number } | null;
  savedExportBounds: { x: number; y: number; width: number; height: number } | null;
  exportSelectionCallback: ((data: { bounds: { x: number; y: number; width: number; height: number }; previewImage: string }) => void) | null;
  globalSettings: GlobalSettings;
  reactFlowInstance: {
    getNodesBounds: ((nodes: any[]) => any) | null;
    getViewport: (() => { x: number; y: number; zoom: number }) | null;
  };
  getSelectedNode: () => AppNode | undefined;
  getSelectedEdge: () => AppEdge | undefined;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setNodes: (nodes: AppNode[] | ((nodes: AppNode[]) => AppNode[])) => void;
  setEdges: (edges: AppEdge[]) => void;
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  addNode: (node: AppNode) => void;
  updateNode: (nodeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;
  addEdgeCustom: (edge: AppEdge) => void;
  updateEdge: (edgeId: string, data: any) => void;
  deleteEdge: (edgeId: string) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  setPlacementMode: (mode: PlacementModeData | null) => void;
  handlePlacementComplete: () => void;
  createBoundary: (boundary: any) => void;
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setShowProjectDialog: (show: boolean) => void;
  setNewProjectName: (name: string) => void;
  setNewProjectBaseline: (baseline: NistBaseline) => void;
  setShowInventoryPanel: (show: boolean) => void;
  setShowSSPModal: (show: boolean) => void;
  setShowControlSuggestionModal: (show: boolean) => void;
  setSuggestionModalData: (data: any) => void;
  assignControlsToDevice: (deviceId: string, controlIds: string[]) => void;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: number) => Promise<void>;
  createNewProject: () => Promise<void>;
  createFromTemplate: (templateId: string, projectName: string) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  saveCurrentDiagram: () => Promise<void>;
  exportFullReport: () => Promise<any>;
  importDiagramFromJSON: () => Promise<any>;
  undo: () => void;
  redo: () => void;
  setUndoRedoFunctions: (undoFn: () => void, redoFn: () => void) => void;
  updateUndoRedoState: (canUndo: boolean, canRedo: boolean) => void;
  initialize: () => Promise<void>;
  setGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  setReactFlowInstance: (instance: {
    getNodesBounds: (nodes: any[]) => any;
    getViewport: () => { x: number; y: number; zoom: number };
  }) => void;
  startExportSelection: (callback?: (data: { bounds: { x: number; y: number; width: number; height: number }; previewImage: string }) => void) => void;
  cancelExportSelection: () => void;
  setExportSelectionBounds: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
  saveExportBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  clearSavedExportBounds: () => void;
}

// ==================== State Slice Selectors ====================

/**
 * Selects topology data (nodes and edges)
 * Use when you need to render or analyze the graph structure
 */
export const selectTopology = (state: FlowState) => ({
  nodes: state.nodes,
  edges: state.edges,
});

/**
 * Selects current project and projects list
 * Use for project management views
 */
export const selectProjects = (state: FlowState) => ({
  currentProject: state.currentProject,
  projects: state.projects,
});

/**
 * Selects project dialog UI state
 * Use for the project dialog component
 */
export const selectProjectDialogState = (state: FlowState) => ({
  showProjectDialog: state.showProjectDialog,
  newProjectName: state.newProjectName,
  newProjectBaseline: state.newProjectBaseline,
});

/**
 * Selects all modal visibility states
 * Use for components that need to show/hide modals
 */
export const selectModalStates = (state: FlowState) => ({
  showProjectDialog: state.showProjectDialog,
  showSSPModal: state.showSSPModal,
  showControlSuggestionModal: state.showControlSuggestionModal,
  showInventoryPanel: state.showInventoryPanel,
});

/**
 * Selects control suggestion modal data
 * Use for ControlSuggestionModal component
 */
export const selectControlSuggestionModal = (state: FlowState) => ({
  showControlSuggestionModal: state.showControlSuggestionModal,
  suggestionModalData: state.suggestionModalData,
});

/**
 * Selects selection state (selected node/edge)
 * Use for components that display or react to selection
 */
export const selectSelection = (state: FlowState) => ({
  selectedNodeId: state.selectedNodeId,
  selectedEdgeId: state.selectedEdgeId,
  selectedNode: state.getSelectedNode(),
  selectedEdge: state.getSelectedEdge(),
});

/**
 * Selects placement mode state
 * Use for device placement functionality
 */
export const selectPlacementMode = (state: FlowState) => ({
  placementMode: state.placementMode,
});

/**
 * Selects global settings
 * Use for styling and display preferences
 */
export const selectGlobalSettings = (state: FlowState) => ({
  globalSettings: state.globalSettings,
});

/**
 * Selects export selection state
 * Use for export selection functionality
 */
export const selectExportSelection = (state: FlowState) => ({
  exportSelectionMode: state.exportSelectionMode,
  exportSelectionBounds: state.exportSelectionBounds,
  savedExportBounds: state.savedExportBounds,
});

/**
 * Selects undo/redo state
 * Use for undo/redo UI buttons
 */
export const selectUndoRedo = (state: FlowState) => ({
  canUndo: state.canUndo,
  canRedo: state.canRedo,
});

/**
 * Selects React Flow instance
 * Use for accessing React Flow methods
 */
export const selectReactFlowInstance = (state: FlowState) => ({
  reactFlowInstance: state.reactFlowInstance,
});

// ==================== Action Selectors ====================

/**
 * Selects topology mutation actions
 * Use when you need to modify the graph
 */
export const selectTopologyActions = (state: FlowState) => ({
  setNodes: state.setNodes,
  setEdges: state.setEdges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addNode: state.addNode,
  updateNode: state.updateNode,
  deleteNode: state.deleteNode,
  addEdgeCustom: state.addEdgeCustom,
  updateEdge: state.updateEdge,
  deleteEdge: state.deleteEdge,
});

/**
 * Selects selection actions
 * Use when you need to change selection
 */
export const selectSelectionActions = (state: FlowState) => ({
  setSelectedNodeId: state.setSelectedNodeId,
  setSelectedEdgeId: state.setSelectedEdgeId,
});

/**
 * Selects placement mode actions
 * Use for device placement functionality
 */
export const selectPlacementActions = (state: FlowState) => ({
  setPlacementMode: state.setPlacementMode,
  handlePlacementComplete: state.handlePlacementComplete,
  createBoundary: state.createBoundary,
});

/**
 * Selects project management actions
 * Use for project CRUD operations
 */
export const selectProjectActions = (state: FlowState) => ({
  setCurrentProject: state.setCurrentProject,
  setProjects: state.setProjects,
  loadProjects: state.loadProjects,
  loadProject: state.loadProject,
  createNewProject: state.createNewProject,
  createFromTemplate: state.createFromTemplate,
  deleteProject: state.deleteProject,
});

/**
 * Selects project dialog actions
 * Use for the project dialog component
 */
export const selectProjectDialogActions = (state: FlowState) => ({
  setShowProjectDialog: state.setShowProjectDialog,
  setNewProjectName: state.setNewProjectName,
  setNewProjectBaseline: state.setNewProjectBaseline,
});

/**
 * Selects modal toggle actions
 * Use for components that need to show/hide modals
 */
export const selectModalActions = (state: FlowState) => ({
  setShowProjectDialog: state.setShowProjectDialog,
  setShowSSPModal: state.setShowSSPModal,
  setShowControlSuggestionModal: state.setShowControlSuggestionModal,
  setShowInventoryPanel: state.setShowInventoryPanel,
  setSuggestionModalData: state.setSuggestionModalData,
});

/**
 * Selects control assignment action
 * Use for control management on devices
 */
export const selectControlActions = (state: FlowState) => ({
  assignControlsToDevice: state.assignControlsToDevice,
});

/**
 * Selects export/import actions
 * Use for file operations
 */
export const selectExportImportActions = (state: FlowState) => ({
  saveCurrentDiagram: state.saveCurrentDiagram,
  exportFullReport: state.exportFullReport,
  importDiagramFromJSON: state.importDiagramFromJSON,
});

/**
 * Selects undo/redo actions
 * Use for undo/redo functionality
 */
export const selectUndoRedoActions = (state: FlowState) => ({
  undo: state.undo,
  redo: state.redo,
  setUndoRedoFunctions: state.setUndoRedoFunctions,
  updateUndoRedoState: state.updateUndoRedoState,
});

/**
 * Selects global settings actions
 * Use for modifying display settings
 */
export const selectGlobalSettingsActions = (state: FlowState) => ({
  setGlobalSettings: state.setGlobalSettings,
});

/**
 * Selects export selection actions
 * Use for export selection functionality
 */
export const selectExportSelectionActions = (state: FlowState) => ({
  startExportSelection: state.startExportSelection,
  cancelExportSelection: state.cancelExportSelection,
  setExportSelectionBounds: state.setExportSelectionBounds,
  saveExportBounds: state.saveExportBounds,
  clearSavedExportBounds: state.clearSavedExportBounds,
});

/**
 * Selects React Flow instance action
 * Use for setting React Flow methods
 */
export const selectReactFlowInstanceAction = (state: FlowState) => ({
  setReactFlowInstance: state.setReactFlowInstance,
});

/**
 * Selects initialize action
 * Use for app initialization
 */
export const selectInitialize = (state: FlowState) => state.initialize;

// ==================== Combined Selectors for Common Use Cases ====================

/**
 * Combined selector for App.tsx - main app component needs
 * Combines most commonly used state and actions
 */
export const selectAppState = (state: FlowState) => ({
  // State
  currentProject: state.currentProject,
  projects: state.projects,
  showProjectDialog: state.showProjectDialog,
  newProjectName: state.newProjectName,
  newProjectBaseline: state.newProjectBaseline,
  nodes: state.nodes,
  edges: state.edges,
  globalSettings: state.globalSettings,
  reactFlowInstance: state.reactFlowInstance,
  showControlSuggestionModal: state.showControlSuggestionModal,
  suggestionModalData: state.suggestionModalData,
});

/**
 * Combined selector for App.tsx actions
 */
export const selectAppActions = (state: FlowState) => ({
  setShowProjectDialog: state.setShowProjectDialog,
  setNewProjectName: state.setNewProjectName,
  setNewProjectBaseline: state.setNewProjectBaseline,
  loadProject: state.loadProject,
  createNewProject: state.createNewProject,
  createFromTemplate: state.createFromTemplate,
  deleteProject: state.deleteProject,
  importDiagramFromJSON: state.importDiagramFromJSON,
  initialize: state.initialize,
  setShowControlSuggestionModal: state.setShowControlSuggestionModal,
  assignControlsToDevice: state.assignControlsToDevice,
});

/**
 * Selector for ViewRouter - only needs selected node and current project
 */
export const selectViewRouterState = (state: FlowState) => ({
  selectedNode: state.getSelectedNode(),
  currentProject: state.currentProject,
});

/**
 * Selector for ControlSelectionWidget - nodes and edges
 */
export const selectControlSelectionState = (state: FlowState) => ({
  nodes: state.nodes,
  edges: state.edges,
});

/**
 * Selector for ControlCoveragePanel
 */
export const selectControlCoverageState = (state: FlowState) => ({
  nodes: state.nodes,
  setSelectedNodeId: state.setSelectedNodeId,
});

/**
 * Selector for SSPWizard
 */
export const selectSSPWizardState = (state: FlowState) => ({
  nodes: state.nodes,
  edges: state.edges,
  currentProject: state.currentProject,
});

/**
 * Selector for InventoryPanel
 */
export const selectInventoryState = (state: FlowState) => ({
  nodes: state.nodes,
  updateNode: state.updateNode,
});

/**
 * Selector for properties panels
 */
export const selectPropertiesState = (state: FlowState) => ({
  selectedNodeId: state.selectedNodeId,
  nodes: state.nodes,
  updateNode: state.updateNode,
});
