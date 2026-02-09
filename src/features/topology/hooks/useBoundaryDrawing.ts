/**
 * Boundary Drawing Hook
 *
 * Manages state and handlers for drawing boundaries on the canvas.
 */

import { useState, useCallback, RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasUIStore } from '@/core/stores/flow/useCanvasUIStore';
import { useTopologyStore } from '@/core/stores/flow/useTopologyStore';

interface Position {
  x: number;
  y: number;
}

interface PreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseBoundaryDrawingReturn {
  /**
   * Whether a boundary is currently being drawn
   */
  isDrawingBoundary: boolean;

  /**
   * The preview rectangle for the boundary being drawn
   */
  previewRect: PreviewRect | null;

  /**
   * Mouse event handlers for boundary drawing
   */
  handlers: {
    onMouseDown: (event: React.MouseEvent) => void;
    onMouseMove: (event: React.MouseEvent) => void;
    onMouseUp: (event: React.MouseEvent) => void;
  };

  /**
   * Reset drawing state (e.g., when ESC is pressed)
   */
  resetDrawing: () => void;
}

// Minimum size for a boundary to be created
const MIN_BOUNDARY_SIZE = 50;

/**
 * Hook for managing boundary drawing state and interactions.
 */
export function useBoundaryDrawing(
  flowWrapperRef: RefObject<HTMLDivElement>,
  onCheckpoint?: (force?: boolean) => void
): UseBoundaryDrawingReturn {
  const { screenToFlowPosition } = useReactFlow();
  const boundaryDrawingMode = useCanvasUIStore(
    (state) => state.boundaryDrawingMode
  );
  const createBoundary = useTopologyStore((state) => state.createBoundary);

  // Drawing state
  const [isDrawingBoundary, setIsDrawingBoundary] = useState(false);
  const [boundaryStartPos, setBoundaryStartPos] = useState<Position | null>(
    null
  );
  const [boundaryCurrentPos, setBoundaryCurrentPos] = useState<Position | null>(
    null
  );

  // Mouse down handler - start drawing
  const handleMouseDown = useCallback(
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
    [boundaryDrawingMode, flowWrapperRef, screenToFlowPosition]
  );

  // Mouse move handler - update preview
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDrawingBoundary || !boundaryStartPos || !flowWrapperRef.current)
        return;

      const rect = flowWrapperRef.current.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      setBoundaryCurrentPos(position);
    },
    [isDrawingBoundary, boundaryStartPos, flowWrapperRef, screenToFlowPosition]
  );

  // Mouse up handler - finalize boundary
  const handleMouseUp = useCallback(
    (_event: React.MouseEvent) => {
      if (
        !isDrawingBoundary ||
        !boundaryStartPos ||
        !boundaryCurrentPos ||
        !boundaryDrawingMode
      ) {
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

      // Only create boundary if it has minimum size
      if (width > MIN_BOUNDARY_SIZE && height > MIN_BOUNDARY_SIZE) {
        createBoundary({
          label: boundaryDrawingMode.label,
          type: boundaryDrawingMode.type,
          position: { x: minX, y: minY },
          width,
          height,
          color: boundaryDrawingMode.color,
        });

        // Create checkpoint for undo/redo
        if (onCheckpoint) {
          onCheckpoint(true);
        }
      }

      // Reset drawing state
      setIsDrawingBoundary(false);
      setBoundaryStartPos(null);
      setBoundaryCurrentPos(null);
    },
    [
      isDrawingBoundary,
      boundaryStartPos,
      boundaryCurrentPos,
      boundaryDrawingMode,
      createBoundary,
      onCheckpoint,
    ]
  );

  // Reset drawing state (e.g., on ESC)
  const resetDrawing = useCallback(() => {
    setIsDrawingBoundary(false);
    setBoundaryStartPos(null);
    setBoundaryCurrentPos(null);
  }, []);

  // Calculate preview rectangle
  const previewRect: PreviewRect | null =
    isDrawingBoundary && boundaryStartPos && boundaryCurrentPos
      ? {
          x: Math.min(boundaryStartPos.x, boundaryCurrentPos.x),
          y: Math.min(boundaryStartPos.y, boundaryCurrentPos.y),
          width: Math.abs(boundaryCurrentPos.x - boundaryStartPos.x),
          height: Math.abs(boundaryCurrentPos.y - boundaryStartPos.y),
        }
      : null;

  return {
    isDrawingBoundary,
    previewRect,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
    },
    resetDrawing,
  };
}
