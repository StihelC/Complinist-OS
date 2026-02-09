import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  OnConnectStart,
  OnConnectEnd,
  NodeChange,
  applyNodeChanges,
  Connection,
  OnSelectionChangeFunc,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DeviceNode } from '@/features/topology/components/Nodes/DeviceNode';
import { GroupNode } from '@/features/topology/components/Nodes/GroupNode';
import { RecenterButton } from '@/features/topology/components/Canvas/RecenterButton';
import { edgeTypes } from '@/features/topology/components/Edges/edgeTypes';
import { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { getDeviceIconMetadata } from '@/lib/utils/deviceIconMapping';
import { isDescendant, calculateNestingDepth, getAbsolutePosition } from '@/lib/utils/utils';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';

const nodeTypes = {
  device: DeviceNode,
  boundary: GroupNode,
};

export const FlowCanvas = () => {
  const {
    nodes,
    edges,
    placementMode,
    globalSettings,
    setNodes,
    onEdgesChange,
    onConnect,
    addNode,
    addEdgeCustom,
    deleteNode,
    setSelectedNodeId,
    setSelectedEdgeId,
    setSelectedNodeIds,
    setSelectedEdgeIds,
    clearAllSelections,
    handlePlacementComplete,
    setReactFlowInstance,
  } = useFlowStore();

  const { screenToFlowPosition, getNode, getNodesBounds, getViewport } = useReactFlow();
  const connectingNodeId = useRef<string | null>(null);
  const connectionMade = useRef<boolean>(false);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

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

  // Unified selection change handler that tracks both single and multi-selection
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const selectedNodeIdList = selectedNodes.map((n) => n.id);
      const selectedEdgeIdList = selectedEdges.map((e) => e.id);

      // Update multi-selection state in store
      if (selectedNodeIdList.length > 0) {
        setSelectedNodeIds(selectedNodeIdList);
      } else if (selectedEdgeIdList.length > 0) {
        setSelectedEdgeIds(selectedEdgeIdList);
      } else {
        // No selection - clear all
        clearAllSelections();
      }
    },
    [setSelectedNodeIds, setSelectedEdgeIds, clearAllSelections]
  );

  // Enhanced onNodesChange with grouping logic
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
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

        // Handle node dragging for grouping/ungrouping
        changes.forEach((change) => {
          if (change.type === 'position') {
            const draggedNode = nextNodes.find((n) => n.id === change.id);
            if (!draggedNode) {
              return;
            }
            
            // Handle boundary nodes separately (they need to check for nesting on drop)
            if (draggedNode.type === 'boundary') {
              // Only handle on drag end (not during drag to preserve children movement)
              if ('dragging' in change && !change.dragging) {
                // Calculate absolute position by traversing entire parent chain
                const absolutePosition = getAbsolutePosition(draggedNode.id, nextNodes);
                
                // Check if dropped inside another boundary
                // IMPORTANT: Use absolute position for boundaries too!
                const candidateTargets = nextNodes.filter((n) => {
                  if (n.type === 'boundary' && n.id !== draggedNode.id) {
                    // Prevent circular nesting
                    if (isDescendant(n.id, draggedNode.id, nextNodes)) {
                      return false;
                    }
                    const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes);
                    const nodeWidth = n.width ?? 300;
                    const nodeHeight = n.height ?? 200;
                    return (
                      absolutePosition.x >= boundaryAbsolutePos.x &&
                      absolutePosition.x <= boundaryAbsolutePos.x + nodeWidth &&
                      absolutePosition.y >= boundaryAbsolutePos.y &&
                      absolutePosition.y <= boundaryAbsolutePos.y + nodeHeight
                    );
                  }
                  return false;
                });
                
                // Select the deepest nested boundary as target
                const targetBoundary = candidateTargets.reduce((deepest, current) => {
                  if (!deepest) return current;
                  const deepestDepth = calculateNestingDepth(deepest.id, nextNodes);
                  const currentDepth = calculateNestingDepth(current.id, nextNodes);
                  return currentDepth > deepestDepth ? current : deepest;
                }, null as AppNode | null);
                
                // If we found a valid target and it's different from current parent
                if (targetBoundary && targetBoundary.id !== draggedNode.parentId) {
                  // Assign to new parent - calculate relative position
                  const targetAbsolutePos = getAbsolutePosition(targetBoundary.id, nextNodes);
                  draggedNode.parentId = targetBoundary.id;
                  draggedNode.position = {
                    x: absolutePosition.x - targetAbsolutePos.x,
                    y: absolutePosition.y - targetAbsolutePos.y,
                  };
                  draggedNode.extent = 'parent';
                } else if (!targetBoundary && draggedNode.parentId) {
                  // Dragged out of parent boundary
                  draggedNode.parentId = undefined;
                  draggedNode.position = absolutePosition;
                  draggedNode.extent = undefined;
                }
              }
              return;
            }
            
            // Device nodes use detach/reattach logic

            // Calculate absolute position by traversing entire parent chain
            const absolutePosition = getAbsolutePosition(draggedNode.id, nextNodes);

            // During dragging
            if ('dragging' in change && change.dragging) {
              draggedNode.position = absolutePosition;
              draggedNode.parentId = undefined;
              draggedNode.extent = undefined;

              // Find all boundaries that contain this position
              // IMPORTANT: Use absolute position for boundaries too!
              const candidateBoundaries = nextNodes.filter((n) => {
                if (n.type === 'boundary' && n.id !== draggedNode.id) {
                  const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes);
                  const nodeWidth = n.width ?? 300;
                  const nodeHeight = n.height ?? 200;
                  return (
                    absolutePosition.x >= boundaryAbsolutePos.x &&
                    absolutePosition.x <= boundaryAbsolutePos.x + nodeWidth &&
                    absolutePosition.y >= boundaryAbsolutePos.y &&
                    absolutePosition.y <= boundaryAbsolutePos.y + nodeHeight
                  );
                }
                return false;
              });
              
              // Select the deepest nested boundary (highest nesting depth)
              // This ensures devices go into the innermost boundary
              const groupNode = candidateBoundaries.reduce((deepest, current) => {
                if (!deepest) return current;
                const deepestDepth = calculateNestingDepth(deepest.id, nextNodes);
                const currentDepth = calculateNestingDepth(current.id, nextNodes);
                return currentDepth > deepestDepth ? current : deepest;
              }, null as AppNode | null);

              // Update hover state for boundaries
              nextNodes = nextNodes.map((node) => {
                if (node.type === 'boundary') {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      hoveredGroupId: groupNode?.id || null,
                    } as BoundaryNodeData,
                  };
                }
                return node;
              });

              return;
            }

            // When drag ends
            if ('dragging' in change && !change.dragging) {
              // Clear hover state
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

              // Find all boundaries that contain this position
              // IMPORTANT: Use absolute position for boundaries too!
              const candidateBoundaries = nextNodes.filter((n) => {
                if (n.type === 'boundary' && n.id !== draggedNode.id) {
                  const boundaryAbsolutePos = getAbsolutePosition(n.id, nextNodes);
                  const nodeWidth = n.width ?? 300;
                  const nodeHeight = n.height ?? 200;
                  return (
                    absolutePosition.x >= boundaryAbsolutePos.x &&
                    absolutePosition.x <= boundaryAbsolutePos.x + nodeWidth &&
                    absolutePosition.y >= boundaryAbsolutePos.y &&
                    absolutePosition.y <= boundaryAbsolutePos.y + nodeHeight
                  );
                }
                return false;
              });
              
              // Select the deepest nested boundary (highest nesting depth)
              // This ensures devices go into the innermost boundary
              const groupNode = candidateBoundaries.reduce((deepest, current) => {
                if (!deepest) return current;
                const deepestDepth = calculateNestingDepth(deepest.id, nextNodes);
                const currentDepth = calculateNestingDepth(current.id, nextNodes);
                return currentDepth > deepestDepth ? current : deepest;
              }, null as AppNode | null);

              if (groupNode) {
                // Assign to group - calculate relative position using absolute position
                const groupAbsolutePos = getAbsolutePosition(groupNode.id, nextNodes);
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
    },
    [setNodes]
  );

  // Handle connection start (for add-node-on-drop feature)
  const onConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    connectingNodeId.current = nodeId as string;
    connectionMade.current = false;
  }, []);

  // Wrap onConnect to track when a connection is successfully made
  const handleConnect = useCallback(
    (connection: Connection) => {
      connectionMade.current = true;
      onConnect(connection);
    },
    [onConnect]
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

  // Node click is now handled by onSelectionChange for proper multi-select support
  // We no longer override the selection behavior with individual click handlers

  return (
    <div
      ref={flowWrapperRef}
      className={`w-full h-full ${placementMode ? 'placement-mode' : ''}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onSelectionChange={onSelectionChange}
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
      >
        <Background 
          variant={globalSettings.showGrid ? BackgroundVariant.Lines : BackgroundVariant.Dots} 
          gap={globalSettings.gridSize} 
          size={globalSettings.showGrid ? 1 : 1}
          color={globalSettings.showGrid ? '#ddd' : '#ccc'}
        />
        <Controls />
        <RecenterButton />
      </ReactFlow>
    </div>
  );
};
