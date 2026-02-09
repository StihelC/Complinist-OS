/**
 * useViewportControl Hook
 *
 * Unified hook for viewport management using ReactFlow's built-in utilities.
 * Provides a centralized API for:
 * - Zoom controls (zoomIn, zoomOut, setZoom)
 * - Viewport positioning (fitView, fitBounds, setCenter)
 * - Coordinate conversion (screenToFlow, flowToScreen)
 * - Viewport state access (getViewport)
 *
 * This hook wraps ReactFlow's useReactFlow() utilities to provide a consistent
 * and centralized viewport control API throughout the application.
 *
 * @module useViewportControl
 */

import { useCallback, useMemo } from 'react';
import { useReactFlow, type Rect } from '@xyflow/react';
import { useFlowStore } from '@/core/stores/useFlowStore';

// =============================================================================
// Types
// =============================================================================

export interface FitViewOptions {
  /** Padding around the content (0 to 1, default: 0.2) */
  padding?: number;
  /** Whether to include hidden nodes */
  includeHiddenNodes?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Animation duration in ms (0 for instant) */
  duration?: number;
  /** Specific node IDs to fit (if empty, fits all) */
  nodes?: string[];
}

export interface ZoomOptions {
  /** Animation duration in ms (default: 200) */
  duration?: number;
}

export interface SetViewportOptions {
  /** Animation duration in ms (default: 0) */
  duration?: number;
}

export interface PanToNodeOptions {
  /** Animation duration in ms (default: 500) */
  duration?: number;
  /** Zoom level to use (if undefined, keeps current zoom) */
  zoom?: number;
}

export interface ViewportState {
  /** X position of viewport */
  x: number;
  /** Y position of viewport */
  y: number;
  /** Current zoom level */
  zoom: number;
}

export interface ViewportControlResult {
  // Viewport State
  /** Get current viewport state */
  getViewport: () => ViewportState;
  /** Get nodes bounds from ReactFlow */
  getNodesBounds: (nodeIds?: string[]) => Rect | null;

  // Zoom Controls
  /** Zoom in with optional animation */
  zoomIn: (options?: ZoomOptions) => void;
  /** Zoom out with optional animation */
  zoomOut: (options?: ZoomOptions) => void;
  /** Set specific zoom level */
  setZoom: (zoom: number, options?: SetViewportOptions) => void;

  // Fit Controls
  /** Fit all nodes (or specific nodes) to view */
  fitView: (options?: FitViewOptions) => void;
  /** Fit specific bounds to view */
  fitBounds: (bounds: Rect, options?: FitViewOptions) => void;
  /** Fit selected nodes to view */
  fitSelectedNodes: (options?: FitViewOptions) => void;

  // Pan Controls
  /** Pan to center on a specific node */
  panToNode: (nodeId: string, options?: PanToNodeOptions) => void;
  /** Pan to a specific position */
  panTo: (x: number, y: number, options?: SetViewportOptions) => void;
  /** Set viewport position and zoom */
  setViewport: (viewport: ViewportState, options?: SetViewportOptions) => void;

  // Coordinate Conversion
  /** Convert screen coordinates to flow coordinates */
  screenToFlowPosition: (position: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  /** Convert flow coordinates to screen coordinates */
  flowToScreenPosition: (position: { x: number; y: number }) => {
    x: number;
    y: number;
  };

  // Utility
  /** Check if a point is within the current viewport */
  isInViewport: (position: { x: number; y: number }) => boolean;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_FIT_VIEW_OPTIONS: FitViewOptions = {
  padding: 0.2,
  includeHiddenNodes: false,
  minZoom: 0.1,
  maxZoom: 2,
  duration: 500,
};

const DEFAULT_ZOOM_OPTIONS: ZoomOptions = {
  duration: 200,
};

const DEFAULT_PAN_TO_NODE_OPTIONS: PanToNodeOptions = {
  duration: 500,
};

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Unified viewport control hook using ReactFlow's built-in utilities
 *
 * @returns ViewportControlResult with all viewport control methods
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const {
 *     fitView,
 *     zoomIn,
 *     zoomOut,
 *     panToNode,
 *     getViewport,
 *   } = useViewportControl();
 *
 *   return (
 *     <div>
 *       <button onClick={() => fitView({ padding: 0.2 })}>Fit View</button>
 *       <button onClick={() => zoomIn()}>Zoom In</button>
 *       <button onClick={() => zoomOut()}>Zoom Out</button>
 *       <button onClick={() => panToNode('node-1')}>Focus Node</button>
 *     </div>
 *   );
 * };
 * ```
 */
export function useViewportControl(): ViewportControlResult {
  // Get ReactFlow utilities
  const reactFlow = useReactFlow();

  // Get selected nodes from store
  const selectedNodeIds = useFlowStore((state) => state.selectedNodeIds);
  const nodes = useFlowStore((state) => state.nodes);

  // ==========================================================================
  // Viewport State
  // ==========================================================================

  const getViewport = useCallback((): ViewportState => {
    return reactFlow.getViewport();
  }, [reactFlow]);

  const getNodesBounds = useCallback(
    (nodeIds?: string[]): Rect | null => {
      try {
        const nodesToMeasure = nodeIds
          ? nodes.filter((n) => nodeIds.includes(n.id))
          : nodes;

        if (nodesToMeasure.length === 0) return null;

        // Use ReactFlow's getNodesBounds utility
        return reactFlow.getNodesBounds(nodesToMeasure);
      } catch (error) {
        console.warn('[useViewportControl] Failed to get nodes bounds:', error);
        return null;
      }
    },
    [reactFlow, nodes]
  );

  // ==========================================================================
  // Zoom Controls
  // ==========================================================================

  const zoomIn = useCallback(
    (options: ZoomOptions = {}) => {
      const opts = { ...DEFAULT_ZOOM_OPTIONS, ...options };
      reactFlow.zoomIn({ duration: opts.duration });
    },
    [reactFlow]
  );

  const zoomOut = useCallback(
    (options: ZoomOptions = {}) => {
      const opts = { ...DEFAULT_ZOOM_OPTIONS, ...options };
      reactFlow.zoomOut({ duration: opts.duration });
    },
    [reactFlow]
  );

  const setZoom = useCallback(
    (zoom: number, options: SetViewportOptions = {}) => {
      const current = reactFlow.getViewport();
      reactFlow.setViewport(
        { ...current, zoom },
        { duration: options.duration || 0 }
      );
    },
    [reactFlow]
  );

  // ==========================================================================
  // Fit Controls
  // ==========================================================================

  const fitView = useCallback(
    (options: FitViewOptions = {}) => {
      const opts = { ...DEFAULT_FIT_VIEW_OPTIONS, ...options };

      reactFlow.fitView({
        padding: opts.padding,
        includeHiddenNodes: opts.includeHiddenNodes,
        minZoom: opts.minZoom,
        maxZoom: opts.maxZoom,
        duration: opts.duration,
        nodes: opts.nodes
          ? nodes.filter((n) => opts.nodes!.includes(n.id))
          : undefined,
      });
    },
    [reactFlow, nodes]
  );

  const fitBounds = useCallback(
    (bounds: Rect, options: FitViewOptions = {}) => {
      const opts = { ...DEFAULT_FIT_VIEW_OPTIONS, ...options };

      reactFlow.fitBounds(bounds, {
        padding: opts.padding,
        duration: opts.duration,
      });
    },
    [reactFlow]
  );

  const fitSelectedNodes = useCallback(
    (options: FitViewOptions = {}) => {
      if (selectedNodeIds.length === 0) {
        // No selection, fit all
        fitView(options);
        return;
      }

      // Fit only selected nodes
      fitView({ ...options, nodes: selectedNodeIds });
    },
    [selectedNodeIds, fitView]
  );

  // ==========================================================================
  // Pan Controls
  // ==========================================================================

  const panToNode = useCallback(
    (nodeId: string, options: PanToNodeOptions = {}) => {
      const opts = { ...DEFAULT_PAN_TO_NODE_OPTIONS, ...options };
      const node = reactFlow.getNode(nodeId);

      if (!node) {
        console.warn(`[useViewportControl] Node not found: ${nodeId}`);
        return;
      }

      // Calculate node center
      const nodeWidth = node.measured?.width || node.width || 120;
      const nodeHeight = node.measured?.height || node.height || 120;

      // Get absolute position (handling nested nodes)
      let absoluteX = node.position.x;
      let absoluteY = node.position.y;
      let parentId = node.parentId;

      while (parentId) {
        const parent = reactFlow.getNode(parentId);
        if (!parent) break;
        absoluteX += parent.position.x;
        absoluteY += parent.position.y;
        parentId = parent.parentId;
      }

      const centerX = absoluteX + nodeWidth / 2;
      const centerY = absoluteY + nodeHeight / 2;

      // Calculate viewport to center on node
      const viewport = getViewport();
      const zoom = opts.zoom !== undefined ? opts.zoom : viewport.zoom;

      // Assuming viewport container is roughly window size (can be made configurable)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const newX = viewportWidth / 2 - centerX * zoom;
      const newY = viewportHeight / 2 - centerY * zoom;

      reactFlow.setViewport(
        { x: newX, y: newY, zoom },
        { duration: opts.duration }
      );
    },
    [reactFlow, getViewport]
  );

  const panTo = useCallback(
    (x: number, y: number, options: SetViewportOptions = {}) => {
      const current = reactFlow.getViewport();
      reactFlow.setViewport(
        { x, y, zoom: current.zoom },
        { duration: options.duration || 0 }
      );
    },
    [reactFlow]
  );

  const setViewport = useCallback(
    (viewport: ViewportState, options: SetViewportOptions = {}) => {
      reactFlow.setViewport(viewport, { duration: options.duration || 0 });
    },
    [reactFlow]
  );

  // ==========================================================================
  // Coordinate Conversion
  // ==========================================================================

  const screenToFlowPosition = useCallback(
    (position: { x: number; y: number }): { x: number; y: number } => {
      return reactFlow.screenToFlowPosition(position);
    },
    [reactFlow]
  );

  const flowToScreenPosition = useCallback(
    (position: { x: number; y: number }): { x: number; y: number } => {
      return reactFlow.flowToScreenPosition(position);
    },
    [reactFlow]
  );

  // ==========================================================================
  // Utility
  // ==========================================================================

  const isInViewport = useCallback(
    (position: { x: number; y: number }): boolean => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Convert flow position to screen position
      const screenPos = flowToScreenPosition(position);

      return (
        screenPos.x >= 0 &&
        screenPos.x <= viewportWidth &&
        screenPos.y >= 0 &&
        screenPos.y <= viewportHeight
      );
    },
    [getViewport, flowToScreenPosition]
  );

  // ==========================================================================
  // Return memoized result
  // ==========================================================================

  return useMemo(
    () => ({
      // Viewport State
      getViewport,
      getNodesBounds,

      // Zoom Controls
      zoomIn,
      zoomOut,
      setZoom,

      // Fit Controls
      fitView,
      fitBounds,
      fitSelectedNodes,

      // Pan Controls
      panToNode,
      panTo,
      setViewport,

      // Coordinate Conversion
      screenToFlowPosition,
      flowToScreenPosition,

      // Utility
      isInViewport,
    }),
    [
      getViewport,
      getNodesBounds,
      zoomIn,
      zoomOut,
      setZoom,
      fitView,
      fitBounds,
      fitSelectedNodes,
      panToNode,
      panTo,
      setViewport,
      screenToFlowPosition,
      flowToScreenPosition,
      isInViewport,
    ]
  );
}

export default useViewportControl;
