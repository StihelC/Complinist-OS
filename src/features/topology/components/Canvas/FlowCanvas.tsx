import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  OnConnectStart,
  OnConnectEnd,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  Node,
  Edge,
  Connection,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DeviceNode } from '@/features/topology/components/Nodes/DeviceNode';
import { GroupNode } from '@/features/topology/components/Nodes/GroupNode';
import { RecenterButton } from '@/features/topology/components/Canvas/RecenterButton';
import { LayoutDevTools } from '@/features/topology/components/Canvas/LayoutDevTools';
import { edgeTypes } from '@/features/topology/components/Edges/edgeTypes';
import { FixedPropertiesPanel } from '@/features/topology/components/PropertiesPanel/FixedPropertiesPanel';
import { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { getDeviceIconMetadata } from '@/lib/utils/deviceIconMapping';
import { isDescendant, calculateNestingDepth, getAbsolutePosition } from '@/lib/utils/utils';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import { findCrossingPairs } from '@/lib/topology/edge-routing-metrics';

export const FlowCanvas = () => {
  // Define nodeTypes inside component to avoid module-level circular dependency issues
  const nodeTypes = {
    device: DeviceNode,
    boundary: GroupNode,
  };
  try {
    const {
      nodes,
      edges,
      placementMode,
      boundaryDrawingMode,
      globalSettings,
      setNodes,
      setEdges,
      onEdgesChange: storeOnEdgesChange,
      onConnect,
      addNode,
      addEdgeCustom,
      deleteNode,
      deleteEdge,
      setSelectedNodeId,
      setSelectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
      clearAllSelections,
      handlePlacementComplete,
      setReactFlowInstance,
      setBoundaryDrawingMode,
      createBoundary,
    } = useFlowStore();  const { screenToFlowPosition, getNode, getNodesBounds, getViewport } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const connectionMade = useRef<boolean>(false);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  // Boundary drawing state
  const [isDrawingBoundary, setIsDrawingBoundary] = useState(false);
  const [boundaryStartPos, setBoundaryStartPos] = useState<{ x: number; y: number } | null>(null);
  const [boundaryCurrentPos, setBoundaryCurrentPos] = useState<{ x: number; y: number } | null>(null);
  
  // Undo/Redo state management
  const undoStack = useRef<Array<{ nodes: AppNode[]; edges: AppEdge[] }>>([]);
  const redoStack = useRef<Array<{ nodes: AppNode[]; edges: AppEdge[] }>>([]);
  const isUndoRedoOperation = useRef(false);
  const pendingCheckpoint = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);
  const lastCheckpointTime = useRef<number>(0);
  const lastHoverState = useRef<{[nodeId: string]: string | null}>({});
  
  // Store latest nodes/edges in refs to avoid circular dependencies
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);
  
  // Store store methods in refs to avoid initialization issues
  const updateUndoRedoStateRef = useRef<((canUndo: boolean, canRedo: boolean) => void) | null>(null);
  const setUndoRedoFunctionsRef = useRef<((undoFn: () => void, redoFn: () => void) => void) | null>(null);
  
  // Initialize store method refs after mount (defer to avoid initialization issues)
  useEffect(() => {
    // Use setTimeout to ensure store is fully initialized
    const timeoutId = setTimeout(() => {
      try {
        const store = useFlowStore.getState();
        if (store && store.updateUndoRedoState && store.setUndoRedoFunctions) {
          updateUndoRedoStateRef.current = store.updateUndoRedoState;
          setUndoRedoFunctionsRef.current = store.setUndoRedoFunctions;
        }
      } catch (error) {
        // Store not ready yet, will retry on next render
        console.warn('Store not ready for undo/redo setup:', error);
      }
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Debounce configuration
  const CHECKPOINT_DEBOUNCE_MS = 150;
  const MIN_CHECKPOINT_INTERVAL_MS = 100;

  // Create checkpoint for undo/redo (defined BEFORE onEdgesChange to avoid forward reference)
  const createCheckpoint = useCallback((force = false) => {
    const now = Date.now();
    const timeSinceLastCheckpoint = now - lastCheckpointTime.current;
    
    // Clear any pending checkpoint
    if (pendingCheckpoint.current) {
      clearTimeout(pendingCheckpoint.current);
      pendingCheckpoint.current = null;
    }
    
    // If forcing (non-position change) or enough time has passed, create checkpoint immediately
    if (force || timeSinceLastCheckpoint >= MIN_CHECKPOINT_INTERVAL_MS) {
      // Use current nodes/edges from refs (always fresh, avoids circular deps)
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      
      // Only create checkpoint if state actually changed
      const lastCheckpoint = undoStack.current[undoStack.current.length - 1];
      if (lastCheckpoint) {
        const nodesChanged = JSON.stringify(currentNodes) !== JSON.stringify(lastCheckpoint.nodes);
        const edgesChanged = JSON.stringify(currentEdges) !== JSON.stringify(lastCheckpoint.edges);
        if (!nodesChanged && !edgesChanged) {
          return; // No change, skip checkpoint
        }
      }
      
      // Add to undo stack
      undoStack.current.push({
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      });
      
      // Limit undo stack size to prevent memory issues (keep last 50 checkpoints)
      if (undoStack.current.length > 50) {
        undoStack.current.shift();
      }
      
      // Clear redo stack when new action is performed
      redoStack.current = [];
      
      lastCheckpointTime.current = now;
      
      // Update store's undo/redo availability
      if (updateUndoRedoStateRef.current) {
        updateUndoRedoStateRef.current(undoStack.current.length > 0, redoStack.current.length > 0);
      }
    } else {
      // Debounce checkpoint creation
      pendingCheckpoint.current = setTimeout(() => {
        createCheckpoint(true);
      }, CHECKPOINT_DEBOUNCE_MS);
    }
  }, []);
  
  // Wrap onEdgesChange to create checkpoints (defined AFTER createCheckpoint)
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      storeOnEdgesChange(changes);
      // Create checkpoint for edge changes (always meaningful operations)
      if (!isUndoRedoOperation.current) {
        createCheckpoint(true);
      }
    },
    [storeOnEdgesChange, createCheckpoint]
  );
  
  // Undo function
  const performUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    
    const currentState = {
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    };
    
    // Move current state to redo stack
    redoStack.current.push(currentState);
    
    // Restore previous state from undo stack
    const previousState = undoStack.current.pop()!;
    
    isUndoRedoOperation.current = true;
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
    isUndoRedoOperation.current = false;
    
    // Update undo/redo availability
    if (updateUndoRedoStateRef.current) {
      updateUndoRedoStateRef.current(undoStack.current.length > 0, redoStack.current.length > 0);
    }
  }, [setNodes, setEdges]);
  
  // Redo function
  const performRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    
    const currentState = {
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    };
    
    // Move current state to undo stack
    undoStack.current.push(currentState);
    
    // Restore next state from redo stack
    const nextState = redoStack.current.pop()!;
    
    isUndoRedoOperation.current = true;
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    isUndoRedoOperation.current = false;
    
    // Update undo/redo availability
    if (updateUndoRedoStateRef.current) {
      updateUndoRedoStateRef.current(undoStack.current.length > 0, redoStack.current.length > 0);
    }
  }, [setNodes, setEdges]);
  
  // Expose undo/redo functions to store
  useEffect(() => {
    if (setUndoRedoFunctionsRef.current) {
      setUndoRedoFunctionsRef.current(performUndo, performRedo);
    }
  }, [performUndo, performRedo]);
  
  // Clear undo stack when project changes
  const currentProject = useFlowStore((state) => state.currentProject);
  useEffect(() => {
    if (currentProject) {
      // Clear undo/redo stacks when project loads
      undoStack.current = [];
      redoStack.current = [];
      if (updateUndoRedoStateRef.current) {
        updateUndoRedoStateRef.current(false, false);
      }
      
      // Clear any pending checkpoint
      if (pendingCheckpoint.current) {
        clearTimeout(pendingCheckpoint.current);
        pendingCheckpoint.current = null;
      }
    }
  }, [currentProject?.id]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingCheckpoint.current) {
        clearTimeout(pendingCheckpoint.current);
      }
    };
  }, []);

  // Keyboard handler for ESC, Delete, and Backspace keys
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent deletion if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (event.key === 'Escape') {
        // Exit boundary drawing mode
        if (boundaryDrawingMode) {
          setBoundaryDrawingMode(null);
          // Also cancel any in-progress drawing
          setIsDrawingBoundary(false);
          setBoundaryStartPos(null);
          setBoundaryCurrentPos(null);
        }
        // Exit placement mode
        if (placementMode) {
          handlePlacementComplete();
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        // Get ALL selected nodes and edges directly from the arrays
        // React Flow tracks selection via the 'selected' property
        const allSelectedNodeIds = nodes
          .filter(n => n.selected)
          .map(n => n.id);
        
        const allSelectedEdgeIds = edges
          .filter(e => e.selected)
          .map(e => e.id);
        
        // Also check store's selection state (for multi-select panel compatibility)
        const storeNodeIds = selectedNodeIds || [];
        const storeEdgeIds = selectedEdgeIds || [];
        
        // Combine both sources and remove duplicates
        const allNodeIds = Array.from(new Set([...allSelectedNodeIds, ...storeNodeIds]));
        const allEdgeIds = Array.from(new Set([...allSelectedEdgeIds, ...storeEdgeIds]));
        
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
  ]);
  
  // Expose React Flow instance methods to the store for export functionality
  useEffect(() => {
    setReactFlowInstance({
      getNodesBounds,
      getViewport,
    });
  }, [getNodesBounds, getViewport, setReactFlowInstance]);

  // Handle node deletion via custom event
  useEffect(() => {
    const handleDeleteNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string }>;
      deleteNode(customEvent.detail.nodeId);
    };
    window.addEventListener('delete-node', handleDeleteNode);
    return () => window.removeEventListener('delete-node', handleDeleteNode);
  }, [deleteNode]);

  // Check for multiple device selections and clear selectedNodeId if needed
  useEffect(() => {
    const selectedDeviceNodes = nodes.filter(
      (node) => node.type === 'device' && node.selected
    );
    if (selectedDeviceNodes.length > 1) {
      // Multiple devices selected - clear selectedNodeId to hide toolbars
      setSelectedNodeId(null);
    }
  }, [nodes, setSelectedNodeId]);

  // Enhanced onNodesChange with grouping logic and optimized undo checkpoints
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Track dragging state for optimization
      const hasPositionChange = changes.some(c => c.type === 'position');
      const isDragStart = changes.some(c => c.type === 'position' && 'dragging' in c && c.dragging === true);
      const isDragEnd = changes.some(c => c.type === 'position' && 'dragging' in c && c.dragging === false);
      
      if (isDragStart) {
        isDragging.current = true;
      }
      if (isDragEnd) {
        isDragging.current = false;
      }
      
      // Determine if we should create a checkpoint
      // Only checkpoint on non-position changes or drag end (skip during active dragging)
      const shouldCreateCheckpoint = !isUndoRedoOperation.current && (
        // Always checkpoint on non-position changes (add, remove, select, etc.)
        !hasPositionChange ||
        // Checkpoint on drag end (batches the entire drag operation)
        isDragEnd
      );
      
      setNodes((nds: AppNode[]) => {
        let nextNodes = applyNodeChanges(changes, nds) as AppNode[];

        // Validate node relationships before processing
        // This ensures we don't try to access missing parent nodes
        const validNodeIds = new Set(nextNodes.map(n => n.id));
        nextNodes = nextNodes.map(node => {
          if (node.parentId && !validNodeIds.has(node.parentId)) {
            const { parentId, extent, ...cleanNode } = node;
            return cleanNode as AppNode;
          }
          if (node.extent === 'parent' && !node.parentId) {
            const { extent, ...cleanNode } = node;
            return cleanNode as AppNode;
          }
          return node;
        });

        // Pre-filter boundaries and create caches for performance optimization
        const boundaries = nextNodes.filter(n => n.type === 'boundary');
        const positionCache = new Map<string, {x: number, y: number}>();
        const depthCache = new Map<string, number>();

        // Handle node dragging for grouping/ungrouping
        changes.forEach((change) => {
          if (change.type === 'position') {
            const draggedNode = nextNodes.find((n) => n.id === change.id);
            if (!draggedNode) {
              return;
            }
            
            // Handle boundary nodes separately (they need to check for nesting on drop)
            if (draggedNode.type === 'boundary') {
              // Calculate absolute position for overlap detection
              const absolutePosition = getAbsolutePosition(draggedNode.id, nextNodes, positionCache);

              // During dragging - clear parent constraints to allow dragging out
              if ('dragging' in change && change.dragging) {
                // Clear parentId and extent to allow free dragging (similar to devices)
                const nodeIndex = nextNodes.findIndex(n => n.id === draggedNode.id);
                if (nodeIndex !== -1) {
                  nextNodes[nodeIndex] = {
                    ...nextNodes[nodeIndex],
                    position: absolutePosition,
                    parentId: undefined,
                    extent: undefined,
                  };
                }

                // Find all boundaries that contain this position
                const candidateBoundaries = boundaries.filter((n) => {
                  if (n.id === draggedNode.id) return false;
                  // Prevent circular nesting
                  if (isDescendant(n.id, draggedNode.id, nextNodes)) {
                    return false;
                  }
                  const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes, positionCache);
                  const nodeWidth = n.width ?? 300;
                  const nodeHeight = n.height ?? 200;
                  return (
                    absolutePosition.x >= boundaryAbsolutePos.x &&
                    absolutePosition.x <= boundaryAbsolutePos.x + nodeWidth &&
                    absolutePosition.y >= boundaryAbsolutePos.y &&
                    absolutePosition.y <= boundaryAbsolutePos.y + nodeHeight
                  );
                });

                // Select the deepest nested boundary
                const groupNode = candidateBoundaries.reduce((deepest, current) => {
                  if (!deepest) return current;
                  const deepestDepth = calculateNestingDepth(deepest.id, nextNodes, depthCache);
                  const currentDepth = calculateNestingDepth(current.id, nextNodes, depthCache);
                  return currentDepth > deepestDepth ? current : deepest;
                }, null as AppNode | null);

                // Update hover state for boundaries (only if changed)
                const newHoverId = groupNode?.id || null;
                const lastHoverId = lastHoverState.current[draggedNode.id];

                if (newHoverId !== lastHoverId) {
                  lastHoverState.current[draggedNode.id] = newHoverId;

                  nextNodes = nextNodes.map((node) => {
                    if (node.type === 'boundary') {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          hoveredGroupId: newHoverId,
                        } as BoundaryNodeData,
                      };
                    }
                    return node;
                  });
                }

                return;
              }

              // On drag end - assign to parent and clear hover
              if ('dragging' in change && !change.dragging) {                // Clear hover state
                const lastHoverId = lastHoverState.current[draggedNode.id];
                if (lastHoverId !== null) {
                  lastHoverState.current[draggedNode.id] = null;

                  nextNodes = nextNodes.map((node) => {
                    if (node.type === 'boundary') {
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          hoveredGroupId: null,
                        } as BoundaryNodeData,
                      };
                    }
                    return node;
                  });
                }

                // Check if dropped inside another boundary
                const candidateTargets = boundaries.filter((n) => {
                  if (n.id === draggedNode.id) return false;
                  // Prevent circular nesting
                  if (isDescendant(n.id, draggedNode.id, nextNodes)) {
                    return false;
                  }
                  const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes, positionCache);
                  const nodeWidth = n.width ?? 300;
                  const nodeHeight = n.height ?? 200;
                  return (
                    absolutePosition.x >= boundaryAbsolutePos.x &&
                    absolutePosition.x <= boundaryAbsolutePos.x + nodeWidth &&
                    absolutePosition.y >= boundaryAbsolutePos.y &&
                    absolutePosition.y <= boundaryAbsolutePos.y + nodeHeight
                  );
                });                // Select the deepest nested boundary as target
                const targetBoundary = candidateTargets.reduce((deepest, current) => {
                  if (!deepest) return current;
                  const deepestDepth = calculateNestingDepth(deepest.id, nextNodes, depthCache);
                  const currentDepth = calculateNestingDepth(current.id, nextNodes, depthCache);
                  return currentDepth > deepestDepth ? current : deepest;
                }, null as AppNode | null);
                
                // Get original parent from data (since parentId was cleared during dragging)
                const originalParentId = (draggedNode.data as BoundaryNodeData)?.parentBoundaryId;
                
                // If we found a valid target (new parent or same parent)
                if (targetBoundary) {
                  // Assign to parent - calculate relative position
                  const targetAbsolutePos = getAbsolutePosition(targetBoundary.id, nextNodes, positionCache);
                  const relativePosition = {
                    x: absolutePosition.x - targetAbsolutePos.x,
                    y: absolutePosition.y - targetAbsolutePos.y,
                  };

                  // Update the node properly (both parentId and data.parentBoundaryId)
                  const nodeIndex = nextNodes.findIndex(n => n.id === draggedNode.id);
                  if (nodeIndex !== -1) {
                    const updatedNode = {
                      ...nextNodes[nodeIndex],
                      parentId: targetBoundary.id,
                      position: relativePosition,
                      extent: 'parent' as const,
                      data: {
                        ...nextNodes[nodeIndex].data,
                        parentBoundaryId: targetBoundary.id,
                      } as BoundaryNodeData,
                    };
                    nextNodes[nodeIndex] = updatedNode;
                  }
                } else if (!targetBoundary && originalParentId) {
                  // Dragged out of parent boundary - keep at absolute position
                  const nodeIndex = nextNodes.findIndex(n => n.id === draggedNode.id);
                  if (nodeIndex !== -1) {
                    const { parentId, extent, ...rest } = nextNodes[nodeIndex];
                    nextNodes[nodeIndex] = {
                      ...rest,
                      position: absolutePosition,
                      data: {
                        ...nextNodes[nodeIndex].data,
                        parentBoundaryId: undefined,
                      } as BoundaryNodeData,
                    } as AppNode;
                  }
                }
              }
              return;
            }
            
            // Device nodes use detach/reattach logic

            // Calculate absolute position by traversing entire parent chain (with cache)
            const absolutePosition = getAbsolutePosition(draggedNode.id, nextNodes, positionCache);

            // During dragging
            if ('dragging' in change && change.dragging) {
              draggedNode.position = absolutePosition;
              draggedNode.parentId = undefined;
              draggedNode.extent = undefined;

              // Find boundaries containing device center (use absolute positions)
              const deviceWidth = draggedNode.measured?.width || draggedNode.width || LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
              const deviceHeight = draggedNode.measured?.height || draggedNode.height || LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
              const deviceCenterX = absolutePosition.x + deviceWidth / 2;
              const deviceCenterY = absolutePosition.y + deviceHeight / 2;
              
              const candidateBoundaries = boundaries.filter((n) => {
                if (n.id === draggedNode.id) return false;
                const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes, positionCache);
                const nodeWidth = n.width ?? (n.style?.width as number) ?? 300;
                const nodeHeight = n.height ?? (n.style?.height as number) ?? 200;
                return (
                  deviceCenterX >= boundaryAbsolutePos.x &&
                  deviceCenterX <= boundaryAbsolutePos.x + nodeWidth &&
                  deviceCenterY >= boundaryAbsolutePos.y &&
                  deviceCenterY <= boundaryAbsolutePos.y + nodeHeight
                );
              });
              
              // Select the deepest nested boundary (highest nesting depth) with cache
              // This ensures devices go into the innermost boundary
              const groupNode = candidateBoundaries.reduce((deepest, current) => {
                if (!deepest) return current;
                const deepestDepth = calculateNestingDepth(deepest.id, nextNodes, depthCache);
                const currentDepth = calculateNestingDepth(current.id, nextNodes, depthCache);
                return currentDepth > deepestDepth ? current : deepest;
              }, null as AppNode | null);

              // Only update hover state if it actually changed to avoid unnecessary re-renders
              const newHoverId = groupNode?.id || null;
              const lastHoverId = lastHoverState.current[draggedNode.id];
              
              if (newHoverId !== lastHoverId) {
                lastHoverState.current[draggedNode.id] = newHoverId;
                
                // Update hover state for boundaries
                nextNodes = nextNodes.map((node) => {
                  if (node.type === 'boundary') {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        hoveredGroupId: newHoverId,
                      } as BoundaryNodeData,
                    };
                  }
                  return node;
                });
              }

              return;
            }

            // When drag ends
            if ('dragging' in change && !change.dragging) {
              // Clear hover state for this dragged node
              const lastHoverId = lastHoverState.current[draggedNode.id];
              if (lastHoverId !== null) {
                lastHoverState.current[draggedNode.id] = null;
                
                nextNodes = nextNodes.map((node) => {
                  if (node.type === 'boundary') {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        hoveredGroupId: null,
                      } as BoundaryNodeData,
                    };
                  }
                  return node;
                });
              }

              // Find all boundaries that contain this position using pre-filtered boundaries
              // IMPORTANT: Use absolute position for boundaries too!
              const candidateBoundaries = boundaries.filter((n) => {
                if (n.id === draggedNode.id) return false;
                const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes, positionCache);
                const nodeWidth = n.width ?? 300;
                const nodeHeight = n.height ?? 200;
                return (
                  absolutePosition.x >= boundaryAbsolutePos.x &&
                  absolutePosition.x <= boundaryAbsolutePos.x + nodeWidth &&
                  absolutePosition.y >= boundaryAbsolutePos.y &&
                  absolutePosition.y <= boundaryAbsolutePos.y + nodeHeight
                );
              });
              
              // Select the deepest nested boundary (highest nesting depth) with cache
              // This ensures devices go into the innermost boundary
              const groupNode = candidateBoundaries.reduce((deepest, current) => {
                if (!deepest) return current;
                const deepestDepth = calculateNestingDepth(deepest.id, nextNodes, depthCache);
                const currentDepth = calculateNestingDepth(current.id, nextNodes, depthCache);
                return currentDepth > deepestDepth ? current : deepest;
              }, null as AppNode | null);

              if (groupNode) {
                // Assign to group - calculate relative position using absolute position (with cache)
                const groupAbsolutePos = getAbsolutePosition(groupNode.id, nextNodes, positionCache);
                draggedNode.parentId = groupNode.id;
                draggedNode.position = {
                  x: absolutePosition.x - groupAbsolutePos.x,
                  y: absolutePosition.y - groupAbsolutePos.y,
                };
                draggedNode.extent = 'parent';
              }
            }
          }
        });

        return nextNodes;
      });
      
      // Create checkpoint after state update (debounced for position changes)
      if (shouldCreateCheckpoint) {
        // For drag end, create checkpoint immediately (batches the entire drag)
        // For other changes, use debouncing
        createCheckpoint(isDragEnd);
      }
    },
    [setNodes, createCheckpoint]
  );

  // Handle connection start (for add-node-on-drop feature)
  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId as string;
    connectionMade.current = false;
  }, []);

  // Wrap onConnect to track when a connection is successfully made and create checkpoint
  const handleConnect = useCallback(
    (connection: Connection) => {
      connectionMade.current = true;
      onConnect(connection);
      // Create checkpoint for new connections
      if (!isUndoRedoOperation.current) {
        createCheckpoint(true);
      }
    },
    [onConnect, createCheckpoint]
  );

  // Handle connection end (add node on drop to empty space)
  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!connectingNodeId.current) return;

      // Only create a new node if a connection was NOT made to an existing node
      if (!connectionMade.current) {
      const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');

      if (targetIsPane && flowWrapperRef.current) {
        const rect = flowWrapperRef.current.getBoundingClientRect();
        const position = screenToFlowPosition({
          x: (event as MouseEvent).clientX - rect.left,
          y: (event as MouseEvent).clientY - rect.top,
        });

        // Create a new device node at the drop position with default server icon
        const newNodeId = `device-${Date.now()}`;
        const newNode: AppNode = {
          id: newNodeId,
          type: 'device',
          position,
          data: {
            id: newNodeId,
            name: 'New Device',
            deviceType: 'virtual-machine',
            iconPath: 'src/Icons/Azure/Compute/Virtual-Machine.svg', // Default Azure icon
            // All other fields undefined
          } as DeviceNodeData,
        };

        addNode(newNode);

        // Connect the original node to the new node
        const sourceNode = getNode(connectingNodeId.current!);
        if (sourceNode) {
          const newEdge: AppEdge = {
            id: `edge-${Date.now()}`,
            source: connectingNodeId.current!,
            target: newNodeId,
            type: 'default',
          };
          addEdgeCustom(newEdge);
          }
        }
      }

      connectingNodeId.current = null;
      connectionMade.current = false;
    },
    [screenToFlowPosition, addNode, addEdgeCustom, getNode]
  );

  // Handle canvas click for placement mode
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (placementMode && flowWrapperRef.current) {
        const rect = flowWrapperRef.current.getBoundingClientRect();
        const position = screenToFlowPosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });

        const newNodeId = `device-${Date.now()}`;
        const newNode: AppNode = {
          id: newNodeId,
          type: 'device',
          position,
          width: LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
          height: LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
          data: {
            id: newNodeId,
            name: placementMode.displayName || `Device-${Date.now()}`,
            deviceType: placementMode.deviceType,
            deviceSubtype: placementMode.deviceSubtype,
            iconPath: placementMode.iconFilename,
            // Initialize all other fields as null/undefined
            ipAddress: undefined,
            macAddress: undefined,
            subnetMask: undefined,
            defaultGateway: undefined,
            manufacturer: undefined,
            model: undefined,
            serialNumber: undefined,
            operatingSystem: undefined,
            osVersion: undefined,
            securityZone: undefined,
            assetValue: undefined,
            missionCritical: undefined,
            dataClassification: undefined,
            multifactorAuth: undefined,
            encryptionAtRest: undefined,
            encryptionInTransit: undefined,
            backupsConfigured: undefined,
            monitoringEnabled: undefined,
            vulnerabilityManagement: undefined,
            applicableControls: undefined,
            lastVulnScan: undefined,
            complianceStatus: undefined,
            systemOwner: undefined,
            department: undefined,
            contactEmail: undefined,
            location: undefined,
          } as DeviceNodeData,
        };

        addNode(newNode);
        handlePlacementComplete();
      } else {
        // Deselect when clicking on empty canvas
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    },
    [placementMode, screenToFlowPosition, addNode, handlePlacementComplete, setSelectedNodeId, setSelectedEdgeId]
  );

  // Handle drag over for device palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from device palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const iconFilename = event.dataTransfer.getData('application/reactflow');
      if (!iconFilename || !flowWrapperRef.current) return;

      // Get metadata from icon filename
      const metadata = getDeviceIconMetadata(iconFilename);
      if (!metadata) return;

      const rect = flowWrapperRef.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      const newNodeId = `device-${Date.now()}`;
      const newNode: AppNode = {
        id: newNodeId,
        type: 'device',
        position,
        width: LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
        height: LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
        data: {
          id: newNodeId,
          name: metadata.displayName || `Device-${Date.now()}`,
          deviceType: metadata.deviceType,
          deviceSubtype: metadata.deviceSubtype,
          iconPath: iconFilename,
          // All other fields undefined/null by default
        } as DeviceNodeData,
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  // Handle edge selection
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
    },
    [setSelectedEdgeId]
  );

  // Boundary drawing handlers
  const handleBoundaryMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!boundaryDrawingMode || !flowWrapperRef.current) return;

      // Only start drawing on left mouse button
      if (event.button !== 0) return;

      const rect = flowWrapperRef.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      setIsDrawingBoundary(true);
      setBoundaryStartPos(position);
      setBoundaryCurrentPos(position);
    },
    [boundaryDrawingMode, screenToFlowPosition]
  );

  const handleBoundaryMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDrawingBoundary || !boundaryStartPos || !flowWrapperRef.current) return;

      const rect = flowWrapperRef.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      setBoundaryCurrentPos(position);
    },
    [isDrawingBoundary, boundaryStartPos, screenToFlowPosition]
  );

  const handleBoundaryMouseUp = useCallback(
    (_event: React.MouseEvent) => {
      if (!isDrawingBoundary || !boundaryStartPos || !boundaryCurrentPos || !boundaryDrawingMode) {
        setIsDrawingBoundary(false);
        setBoundaryStartPos(null);
        setBoundaryCurrentPos(null);
        return;
      }

      // Calculate boundary dimensions
      const minX = Math.min(boundaryStartPos.x, boundaryCurrentPos.x);
      const minY = Math.min(boundaryStartPos.y, boundaryCurrentPos.y);
      const width = Math.abs(boundaryCurrentPos.x - boundaryStartPos.x);
      const height = Math.abs(boundaryCurrentPos.y - boundaryStartPos.y);

      // Only create boundary if it has minimum size (avoid accidental clicks)
      if (width > 50 && height > 50) {
        createBoundary({
          label: boundaryDrawingMode.label,
          type: boundaryDrawingMode.type,
          position: { x: minX, y: minY },
          width,
          height,
          color: boundaryDrawingMode.color,
        });

        // Create checkpoint for undo/redo
        if (!isUndoRedoOperation.current) {
          createCheckpoint(true);
        }
      }

      // Reset drawing state
      setIsDrawingBoundary(false);
      setBoundaryStartPos(null);
      setBoundaryCurrentPos(null);
    },
    [isDrawingBoundary, boundaryStartPos, boundaryCurrentPos, boundaryDrawingMode, createBoundary, createCheckpoint]
  );

  // Calculate preview rectangle dimensions
  const previewRect = isDrawingBoundary && boundaryStartPos && boundaryCurrentPos
    ? {
        x: Math.min(boundaryStartPos.x, boundaryCurrentPos.x),
        y: Math.min(boundaryStartPos.y, boundaryCurrentPos.y),
        width: Math.abs(boundaryCurrentPos.x - boundaryStartPos.x),
        height: Math.abs(boundaryCurrentPos.y - boundaryStartPos.y),
      }
    : null;
  
  // Get viewport for coordinate transformation
  const viewport = getViewport();
  
  // Calculate overlaps and enrich edges with overlap information
  const enrichedEdges = useMemo(() => {
    const safeEdges = Array.isArray(edges) ? edges : [];
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    
    if (safeEdges.length === 0 || safeNodes.length === 0) {
      return safeEdges;
    }
    
    // Find all crossing pairs
    const crossingPairs = findCrossingPairs(safeEdges, safeNodes);
    
    // Build overlap count map
    const overlapCountMap = new Map<string, number>();
    for (const crossing of crossingPairs) {
      overlapCountMap.set(crossing.edgeA, (overlapCountMap.get(crossing.edgeA) || 0) + 1);
      overlapCountMap.set(crossing.edgeB, (overlapCountMap.get(crossing.edgeB) || 0) + 1);
    }
    
    // Enrich edges with overlap information
    return safeEdges.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        overlapCount: overlapCountMap.get(edge.id) || 0,
        hasOverlap: (overlapCountMap.get(edge.id) || 0) > 0,
      },
    }));
  }, [edges, nodes]);

  return (
    <div
      ref={flowWrapperRef}
      className={`w-full h-full ${placementMode ? 'placement-mode' : ''} ${boundaryDrawingMode ? 'boundary-drawing-mode' : ''}`}
      onMouseDown={boundaryDrawingMode ? handleBoundaryMouseDown : undefined}
      onMouseMove={boundaryDrawingMode ? handleBoundaryMouseMove : undefined}
      onMouseUp={boundaryDrawingMode ? handleBoundaryMouseUp : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={enrichedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={4}
        fitView
        attributionPosition="bottom-right"
        snapToGrid={globalSettings.snapToGrid}
        snapGrid={[globalSettings.gridSize, globalSettings.gridSize]}
        noDragClassName="nodrag"
        noWheelClassName="nowheel"
        noPanClassName="nopan"
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={true}
      >
        <Background
          variant={globalSettings.showGrid ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={globalSettings.gridSize}
          size={globalSettings.showGrid ? 1 : 1}
          color={globalSettings.showGrid ? '#ddd' : '#ccc'}
        />
        <Controls />
        <MiniMap
          nodeColor={(node): string => {
            if (node.type === 'boundary') {
              const data = node.data as BoundaryNodeData | undefined;
              return data?.customColor ?? '#e2e8f0';
            }
            return '#3b82f6'; // Blue for device nodes
          }}
          maskColor="rgb(240, 240, 240, 0.6)"
          position="bottom-right"
          pannable={true}
          zoomable={true}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }}
        />
        <RecenterButton />

        {/* Boundary drawing preview overlay */}
        {previewRect && boundaryDrawingMode && (
          <div
            className="react-flow__panel"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
              }}
            >
              <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
                <rect
                  x={previewRect.x}
                  y={previewRect.y}
                  width={previewRect.width}
                  height={previewRect.height}
                  fill={boundaryDrawingMode.color}
                  fillOpacity={0.2}
                  stroke={boundaryDrawingMode.color}
                  strokeWidth={2 / viewport.zoom}
                  strokeDasharray="5,5"
                  rx={8}
                />
                <text
                  x={previewRect.x + previewRect.width / 2}
                  y={previewRect.y + previewRect.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#666"
                  fontSize="14"
                  fontWeight="500"
                >
                  {boundaryDrawingMode.label}
                </text>
              </g>
            </svg>
          </div>
        )}
      </ReactFlow>

      {/* Fixed Properties Panel - displays device/edge/boundary settings in top-right */}
      <FixedPropertiesPanel />

      {/* Layout DevTools - only shown when layoutDebugMode is enabled */}
      {globalSettings.layoutDebugMode && (
        <LayoutDevTools
          onClose={() => {
            // Toggle off debug mode when closing DevTools
            const { setGlobalSettings } = useFlowStore.getState();
            setGlobalSettings({ layoutDebugMode: false });
          }}
        />
      )}
    </div>
  );
  } catch (error) {
    console.error('[FlowCanvas] ERROR in FlowCanvas component:', error);
    console.error('[FlowCanvas] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
};
