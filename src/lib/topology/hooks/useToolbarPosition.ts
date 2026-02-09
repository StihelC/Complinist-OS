/**
 * useToolbarPosition Hook
 *
 * Shared hook for calculating toolbar position relative to a node
 * using ReactFlow's built-in viewport utilities (flowToScreenPosition, getViewport).
 *
 * This hook eliminates duplicated positioning logic between DeviceToolbar and BoundaryToolbar
 * by leveraging ReactFlow's useReactFlow() hook utilities.
 *
 * @module useToolbarPosition
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '@/core/stores/useFlowStore';

// =============================================================================
// Types
// =============================================================================

export interface ToolbarPanelConfig {
  /** Panel width in pixels */
  width: number;
  /** Panel height in pixels */
  height: number;
  /** Offset from node edge in pixels */
  offset: number;
  /** Viewport edge padding in pixels */
  viewportPadding: number;
}

export interface ToolbarPosition {
  /** X position in screen coordinates */
  x: number;
  /** Y position in screen coordinates */
  y: number;
  /** Whether toolbar was repositioned to the left of the node */
  repositionLeft: boolean;
  /** Whether toolbar was repositioned vertically */
  repositionTop: boolean;
}

export interface UseToolbarPositionOptions {
  /** Node ID to position the toolbar relative to */
  nodeId: string;
  /** Panel configuration */
  panelConfig: ToolbarPanelConfig;
  /** Default node width fallback */
  defaultNodeWidth?: number;
  /** Default node height fallback */
  defaultNodeHeight?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_PANEL_CONFIG: ToolbarPanelConfig = {
  width: 380,
  height: 420,
  offset: 20,
  viewportPadding: 16,
};

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook to calculate toolbar position relative to a node
 *
 * Uses ReactFlow's built-in utilities:
 * - getNode(): Get node data including measured dimensions
 * - getViewport(): Get current viewport state (x, y, zoom)
 * - flowToScreenPosition(): Convert flow coordinates to screen coordinates
 *
 * @param options - Configuration options
 * @returns Toolbar position and node dimension utilities
 *
 * @example
 * ```tsx
 * const DeviceToolbar = ({ nodeId }) => {
 *   const { position, actualNodeWidth, actualNodeHeight } = useToolbarPosition({
 *     nodeId,
 *     panelConfig: { width: 380, height: 420, offset: 20, viewportPadding: 16 },
 *   });
 *
 *   return (
 *     <div style={{ left: position.x, top: position.y }}>
 *       ...
 *     </div>
 *   );
 * };
 * ```
 */
export function useToolbarPosition(options: UseToolbarPositionOptions) {
  const {
    nodeId,
    panelConfig,
    defaultNodeWidth = 120,
    defaultNodeHeight = 150,
  } = options;

  // ReactFlow utilities
  const { getNode, flowToScreenPosition, getViewport } = useReactFlow();

  // Store access for fallback dimensions
  const nodes = useFlowStore((state) => state.nodes);

  // State for position
  const [position, setPosition] = useState<ToolbarPosition>({
    x: 0,
    y: 0,
    repositionLeft: false,
    repositionTop: false,
  });

  // Get node from React Flow to access measured dimensions
  const reactFlowNode = getNode(nodeId);
  const storeNode = nodes.find((n) => n.id === nodeId);

  // Calculate actual node dimensions using ReactFlow's measurement system
  // Priority: measured dimensions > passed dimensions > stored dimensions > defaults
  const actualNodeWidth = useMemo(() => {
    return (
      reactFlowNode?.measured?.width ||
      reactFlowNode?.width ||
      (storeNode?.width as number) ||
      (storeNode?.style?.width as number) ||
      defaultNodeWidth
    );
  }, [
    reactFlowNode?.measured?.width,
    reactFlowNode?.width,
    storeNode?.width,
    storeNode?.style?.width,
    defaultNodeWidth,
  ]);

  const actualNodeHeight = useMemo(() => {
    return (
      reactFlowNode?.measured?.height ||
      reactFlowNode?.height ||
      (storeNode?.height as number) ||
      (storeNode?.style?.height as number) ||
      defaultNodeHeight
    );
  }, [
    reactFlowNode?.measured?.height,
    reactFlowNode?.height,
    storeNode?.height,
    storeNode?.style?.height,
    defaultNodeHeight,
  ]);

  /**
   * Calculate absolute position for nested nodes
   * Traverses parent chain to get true flow coordinates
   */
  const getAbsolutePosition = useCallback((): { x: number; y: number } => {
    const currentNode = getNode(nodeId);
    if (!currentNode) return { x: 0, y: 0 };

    let absolutePosition = { ...currentNode.position };
    let currentParentId = currentNode.parentId;

    // Walk up the parent chain to accumulate position offsets
    while (currentParentId) {
      const parentNode = getNode(currentParentId);
      if (!parentNode) break;
      absolutePosition.x += parentNode.position.x;
      absolutePosition.y += parentNode.position.y;
      currentParentId = parentNode.parentId;
    }

    return absolutePosition;
  }, [nodeId, getNode]);

  /**
   * Calculate node edge coordinates in flow space
   */
  const getNodeEdgeCoordinates = useCallback(() => {
    const absolutePos = getAbsolutePosition();

    return {
      north: { x: absolutePos.x + actualNodeWidth / 2, y: absolutePos.y },
      south: {
        x: absolutePos.x + actualNodeWidth / 2,
        y: absolutePos.y + actualNodeHeight,
      },
      east: {
        x: absolutePos.x + actualNodeWidth,
        y: absolutePos.y + actualNodeHeight / 2,
      },
      west: { x: absolutePos.x, y: absolutePos.y + actualNodeHeight / 2 },
      center: {
        x: absolutePos.x + actualNodeWidth / 2,
        y: absolutePos.y + actualNodeHeight / 2,
      },
    };
  }, [getAbsolutePosition, actualNodeWidth, actualNodeHeight]);

  /**
   * Calculate toolbar position with viewport boundary detection
   * Uses ReactFlow's flowToScreenPosition for coordinate conversion
   */
  const calculateToolbarPosition = useCallback((): ToolbarPosition => {
    const currentNode = getNode(nodeId);
    if (!currentNode) {
      return { x: 0, y: 0, repositionLeft: false, repositionTop: false };
    }

    const nodeEdgeCoords = getNodeEdgeCoordinates();
    const viewport = getViewport();
    const panelHeightFlow = panelConfig.height / viewport.zoom;

    // Default position: to the right of the node (east edge)
    const settingsBoxFlowPos = {
      x: nodeEdgeCoords.east.x + panelConfig.offset,
      y: nodeEdgeCoords.east.y - panelHeightFlow / 2,
    };

    // Convert flow coordinates to screen coordinates using ReactFlow's utility
    let screenPos = flowToScreenPosition(settingsBoxFlowPos);

    // Viewport boundary detection
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let repositionLeft = false;
    let repositionTop = false;

    // Check if panel would overflow right edge
    if (
      screenPos.x + panelConfig.width + panelConfig.viewportPadding >
      viewportWidth
    ) {
      // Position to the left of the node instead (west edge)
      const leftFlowPos = {
        x:
          nodeEdgeCoords.west.x -
          panelConfig.offset -
          panelConfig.width / viewport.zoom,
        y: settingsBoxFlowPos.y,
      };
      screenPos = flowToScreenPosition(leftFlowPos);
      repositionLeft = true;
    }

    // Check if panel would overflow bottom edge
    if (
      screenPos.y + panelConfig.height + panelConfig.viewportPadding >
      viewportHeight
    ) {
      screenPos.y = Math.max(
        panelConfig.viewportPadding,
        viewportHeight - panelConfig.height - panelConfig.viewportPadding
      );
      repositionTop = true;
    }

    // Check if panel would overflow top edge
    if (screenPos.y < panelConfig.viewportPadding) {
      screenPos.y = panelConfig.viewportPadding;
    }

    // Check if panel would overflow left edge
    if (screenPos.x < panelConfig.viewportPadding) {
      screenPos.x = panelConfig.viewportPadding;
    }

    return { ...screenPos, repositionLeft, repositionTop };
  }, [
    nodeId,
    getNode,
    getNodeEdgeCoordinates,
    flowToScreenPosition,
    getViewport,
    panelConfig,
  ]);

  // Track viewport changes for dependency tracking
  const viewport = getViewport();

  // Update toolbar position when node position, dimensions, or viewport changes
  useEffect(() => {
    const newPos = calculateToolbarPosition();
    setPosition(newPos);
  }, [
    calculateToolbarPosition,
    viewport.x,
    viewport.y,
    viewport.zoom,
    reactFlowNode?.position?.x,
    reactFlowNode?.position?.y,
    reactFlowNode?.width,
    reactFlowNode?.height,
    reactFlowNode?.parentId,
  ]);

  return {
    position,
    actualNodeWidth,
    actualNodeHeight,
    getAbsolutePosition,
    getNodeEdgeCoordinates,
    calculateToolbarPosition,
  };
}

export default useToolbarPosition;
