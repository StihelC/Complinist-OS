/**
 * useSmartEdge Hook
 *
 * Shared hook for smart edge components. Handles:
 * - Node data collection with stable selectors
 * - Floating edge position calculation
 * - Obstacle detection and path computation
 * - Proper memoization to prevent unnecessary re-renders
 */

import { useMemo } from 'react';
import { Position, useInternalNode, useStore } from '@xyflow/react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import {
  NodeRect,
  HierarchicalNodeRect,
  Point,
  getIntersection,
  findBlockingNodes,
  findSiblingBoundaryObstacles,
  calculateWaypoints,
  generatePathWithWaypoints,
  calculateLabelPosition,
} from './smartEdgeUtils';
import { calculateHierarchicalWaypoints } from './hierarchicalRouting';
import { getSmoothStepPath } from '@xyflow/react';

// ============================================================================
// Stable Selectors (defined outside component to maintain referential equality)
// ============================================================================

const selectUseFloatingEdges = (state: ReturnType<typeof useFlowStore.getState>) =>
  state.globalSettings.useFloatingEdges;

const selectHierarchicalEdgeRouting = (state: ReturnType<typeof useFlowStore.getState>) =>
  state.globalSettings.hierarchicalEdgeRouting;

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseSmartEdgeProps {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  borderRadius?: number;
  useOffset?: boolean;
}

export interface UseSmartEdgeResult {
  path: string;
  labelX: number;
  labelY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSmartEdge(props: UseSmartEdgeProps): UseSmartEdgeResult {
  const {
    id,
    source,
    target,
    sourceX: defaultSourceX,
    sourceY: defaultSourceY,
    targetX: defaultTargetX,
    targetY: defaultTargetY,
    sourcePosition: defaultSourcePosition,
    targetPosition: defaultTargetPosition,
    borderRadius = 8,
    useOffset = false,
  } = props;

  // Use stable selectors for flow store
  const useFloatingEdges = useFlowStore(selectUseFloatingEdges);
  const hierarchicalEdgeRouting = useFlowStore(selectHierarchicalEdgeRouting);

  // Get source and target nodes
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  // Collect node data from ReactFlow store with memoized selector
  const nodeData = useStore(
    useMemo(
      () => (state: any) => {
        const devices: NodeRect[] = [];
        const all: HierarchicalNodeRect[] = [];
        const boundaries: HierarchicalNodeRect[] = [];
        const boundariesAbsolute: NodeRect[] = [];

        state.nodeLookup.forEach((node: any, nodeId: string) => {
          const nodeInfo: HierarchicalNodeRect = {
            id: nodeId,
            x: node.position?.x ?? 0,
            y: node.position?.y ?? 0,
            width: node.measured?.width || node.width || 100,
            height: node.measured?.height || node.height || 100,
            parentId: node.parentId,
            type: node.type,
          };
          all.push(nodeInfo);

          if (node.type === 'boundary') {
            boundaries.push(nodeInfo);
            boundariesAbsolute.push({
              id: nodeId,
              x: node.internals.positionAbsolute.x,
              y: node.internals.positionAbsolute.y,
              width: node.measured?.width || node.width || 100,
              height: node.measured?.height || node.height || 100,
            });
          } else {
            devices.push({
              id: nodeId,
              x: node.internals.positionAbsolute.x,
              y: node.internals.positionAbsolute.y,
              width: node.measured?.width || node.width || 100,
              height: node.measured?.height || node.height || 100,
            });
          }
        });

        return { devices, all, boundaries, boundariesAbsolute };
      },
      []
    )
  );

  // Calculate edge offset for overlap prevention
  const baseOffset = useMemo(() => {
    if (!useOffset) return 0;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash % 21) - 10;
  }, [id, useOffset]);

  // Calculate floating edge positions
  const edgeParams = useMemo(() => {
    if (!useFloatingEdges || !sourceNode || !targetNode) {
      return {
        sourceX: defaultSourceX,
        sourceY: defaultSourceY,
        sourcePosition: defaultSourcePosition,
        targetX: defaultTargetX,
        targetY: defaultTargetY,
        targetPosition: defaultTargetPosition,
      };
    }

    const sX = sourceNode.internals.positionAbsolute.x;
    const sY = sourceNode.internals.positionAbsolute.y;
    const sW = sourceNode.measured?.width || sourceNode.width || 100;
    const sH = sourceNode.measured?.height || sourceNode.height || 100;

    const tX = targetNode.internals.positionAbsolute.x;
    const tY = targetNode.internals.positionAbsolute.y;
    const tW = targetNode.measured?.width || targetNode.width || 100;
    const tH = targetNode.measured?.height || targetNode.height || 100;

    const tCenterX = tX + tW / 2;
    const tCenterY = tY + tH / 2;
    const sCenterX = sX + sW / 2;
    const sCenterY = sY + sH / 2;

    const sourceInt = getIntersection(sX, sY, sW, sH, tCenterX, tCenterY);
    const targetInt = getIntersection(tX, tY, tW, tH, sCenterX, sCenterY);

    return {
      sourceX: sourceInt.x,
      sourceY: sourceInt.y,
      sourcePosition: sourceInt.position,
      targetX: targetInt.x,
      targetY: targetInt.y,
      targetPosition: targetInt.position,
    };
  }, [
    useFloatingEdges,
    sourceNode,
    targetNode,
    defaultSourceX,
    defaultSourceY,
    defaultSourcePosition,
    defaultTargetX,
    defaultTargetY,
    defaultTargetPosition,
  ]);

  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition } = edgeParams;

  // Calculate path with obstacle avoidance
  const pathData = useMemo(() => {
    const { devices, all, boundaries, boundariesAbsolute } = nodeData;

    // Calculate hierarchical waypoints if enabled
    let hierarchicalWaypoints: Point[] = [];
    if (hierarchicalEdgeRouting) {
      hierarchicalWaypoints = calculateHierarchicalWaypoints(
        source,
        target,
        sourceX,
        sourceY,
        targetX,
        targetY,
        all,
        boundaries
      );
    }

    // Find sibling boundaries as obstacles
    const siblingBoundaries = findSiblingBoundaryObstacles(
      source,
      target,
      all,
      boundariesAbsolute
    );

    // Combine obstacles
    const allObstacles = [...devices, ...siblingBoundaries];

    // Find blocking nodes
    const blockingNodes = findBlockingNodes(
      sourceX, sourceY,
      targetX, targetY,
      allObstacles,
      source,
      target
    );

    // Use hierarchical waypoints if available
    if (hierarchicalWaypoints.length > 0) {
      const path = generatePathWithWaypoints(
        sourceX, sourceY,
        targetX, targetY,
        hierarchicalWaypoints,
        borderRadius
      );
      const labelPos = calculateLabelPosition(sourceX, sourceY, targetX, targetY, hierarchicalWaypoints);
      return { path, labelX: labelPos.x, labelY: labelPos.y };
    }

    // No obstacles - use standard smooth step path
    if (blockingNodes.length === 0) {
      const [path, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius,
        offset: baseOffset !== 0 ? baseOffset : undefined,
      });
      return { path, labelX, labelY };
    }

    // Calculate waypoints to route around obstacles
    const waypoints = calculateWaypoints(
      sourceX, sourceY,
      targetX, targetY,
      blockingNodes,
      baseOffset
    );

    const path = generatePathWithWaypoints(
      sourceX, sourceY,
      targetX, targetY,
      waypoints,
      borderRadius
    );
    const labelPos = calculateLabelPosition(sourceX, sourceY, targetX, targetY, waypoints);

    return { path, labelX: labelPos.x, labelY: labelPos.y };
  }, [
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    nodeData,
    source,
    target,
    baseOffset,
    hierarchicalEdgeRouting,
    borderRadius,
  ]);

  return {
    ...pathData,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };
}
