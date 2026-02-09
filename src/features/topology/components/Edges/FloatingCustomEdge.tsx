/**
 * Floating Custom Edge
 *
 * A custom edge that supports two modes:
 * 1. Floating edges (default): Connects to node boundaries automatically
 * 2. Handle-based edges: Uses fixed handle positions
 */

import { memo, useCallback, useMemo, useState } from 'react';
import type React from 'react';
import {
  EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  getSimpleBezierPath,
  Position,
  useInternalNode,
} from '@xyflow/react';
import { EdgeMetadata } from '@/lib/utils/types';
import { EdgeLabel } from './EdgeLabel';
import { useFlowStore } from '@/core/stores/useFlowStore';

interface ExtendedEdgeMetadata extends EdgeMetadata {
  labelOffset?: { x: number; y: number };
  labelRotation?: number;
  labelAdjusted?: boolean;
  hasOverlap?: boolean;
  handleOffset?: number;
}

/**
 * Calculate where a line from node center to target intersects the node boundary
 */
function getIntersection(
  nodeX: number,
  nodeY: number,
  nodeW: number,
  nodeH: number,
  targetX: number,
  targetY: number
): { x: number; y: number; position: Position } {
  const cx = nodeX + nodeW / 2;
  const cy = nodeY + nodeH / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy, position: Position.Bottom };
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const hw = nodeW / 2;
  const hh = nodeH / 2;

  let x: number, y: number, position: Position;

  // Determine which edge the line intersects
  if (absDx * hh > absDy * hw) {
    // Intersects left or right
    if (dx > 0) {
      x = nodeX + nodeW;
      y = cy + (hw / dx) * dy;
      position = Position.Right;
    } else {
      x = nodeX;
      y = cy - (hw / dx) * dy;
      position = Position.Left;
    }
  } else {
    // Intersects top or bottom
    if (dy > 0) {
      x = cx + (hh / dy) * dx;
      y = nodeY + nodeH;
      position = Position.Bottom;
    } else {
      x = cx - (hh / dy) * dx;
      y = nodeY;
      position = Position.Top;
    }
  }

  return { x, y, position };
}

const getEdgePath = (
  edgeType: string,
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: Position;
    targetX: number;
    targetY: number;
    targetPosition: Position;
  }
) => {
  switch (edgeType) {
    case 'straight':
      return getStraightPath(params);
    case 'step':
      return getSmoothStepPath({ ...params, borderRadius: 0 });
    case 'smoothstep':
      return getSmoothStepPath(params);
    case 'simplebezier':
      return getSimpleBezierPath(params);
    default:
      return getBezierPath(params);
  }
};

const FloatingCustomEdgeComponent = (props: EdgeProps) => {
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
    style = {},
    markerEnd,
    data,
    selected,
  } = props;

  const useFloatingEdges = useFlowStore((state) => state.globalSettings.useFloatingEdges);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  // Calculate edge positions
  const edgeParams = useMemo(() => {
    // Use default positions if floating edges disabled or nodes not available
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

    // Get node positions and dimensions
    const sX = sourceNode.internals.positionAbsolute.x;
    const sY = sourceNode.internals.positionAbsolute.y;
    const sW = sourceNode.measured?.width || sourceNode.width || 100;
    const sH = sourceNode.measured?.height || sourceNode.height || 100;

    const tX = targetNode.internals.positionAbsolute.x;
    const tY = targetNode.internals.positionAbsolute.y;
    const tW = targetNode.measured?.width || targetNode.width || 100;
    const tH = targetNode.measured?.height || targetNode.height || 100;

    // Calculate centers
    const sCenterX = sX + sW / 2;
    const sCenterY = sY + sH / 2;
    const tCenterX = tX + tW / 2;
    const tCenterY = tY + tH / 2;

    // Get intersection points
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

  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const edgeData = (data || {}) as ExtendedEdgeMetadata;
  const edgeType = edgeData.edgeType || 'smoothstep';
  const animated = edgeData.animated || false;
  const animationSpeed = edgeData.animationSpeed || 2;
  const animationColor = edgeData.animationColor || '#ff0073';
  const connectionState = edgeData.connectionState || 'active';
  const labelOffset = edgeData.labelOffset || { x: 0, y: 0 };
  const hasOverlap = edgeData.hasOverlap || false;

  const [edgePath, labelX, labelY] = getEdgePath(edgeType, edgeParams);

  const finalLabelX = labelX + labelOffset.x;
  const finalLabelY = labelY + labelOffset.y;

  const edgeStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = { ...(style as React.CSSProperties) };

    // Hover takes precedence (but not over selection)
    if (hovered && !selected) {
      base.stroke = '#60a5fa'; // blue-400
      base.strokeWidth = 2.5;
      return base;
    }

    switch (connectionState) {
      case 'active':
        base.stroke = selected ? '#3b82f6' : '#6b7280';
        base.strokeWidth = selected ? 3 : 2;
        if (hasOverlap) {
          base.stroke = selected ? '#4b5563' : '#6b7280';
          base.strokeWidth = selected ? 2.5 : 2;
        }
        break;
      case 'standby':
        base.stroke = '#eab308';
        base.strokeWidth = selected ? 3 : 2;
        base.strokeDasharray = '5,5';
        break;
      case 'failed':
        base.stroke = '#ef4444';
        base.strokeWidth = selected ? 3 : 2;
        base.strokeDasharray = '3,3';
        break;
    }
    return base;
  }, [connectionState, selected, style, hasOverlap, hovered]);

  const labelTransform = `translate(-50%, -50%) translate(${finalLabelX}px, ${finalLabelY}px)`;

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      />
      {/* Hover/selection highlight */}
      {(selected || hovered) && (
        <path
          d={edgePath}
          fill="none"
          stroke={selected ? '#3b82f6' : '#60a5fa'}
          strokeWidth={8}
          strokeLinecap="round"
          strokeOpacity={selected ? 0.3 : 0.2}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd ? String(markerEnd) : undefined}
      />
      {animated && (
        <circle r="5" fill={animationColor}>
          <animateMotion dur={`${animationSpeed}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: labelTransform,
            pointerEvents: 'all',
            zIndex: 50,
          }}
          className="nodrag nopan"
        >
          <EdgeLabel data={edgeData} labelFields={edgeData.labelFields || []} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export const FloatingCustomEdge = memo(FloatingCustomEdgeComponent);
FloatingCustomEdge.displayName = 'FloatingCustomEdge';
