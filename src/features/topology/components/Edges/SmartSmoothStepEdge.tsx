/**
 * Smart Smooth Step Edge
 *
 * A custom edge that routes around nodes with smooth rounded corners.
 * Uses ID-based offset to help prevent edge overlap.
 * Uses shared utilities from smartEdgeUtils and useSmartEdge hook.
 */

import { memo, useMemo, useState, useCallback } from 'react';
import { EdgeProps, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { EdgeMetadata } from '@/lib/utils/types';
import { EdgeLabel } from './EdgeLabel';
import { useSmartEdge } from './useSmartEdge';
import { getEdgeStyle, ConnectionState } from './smartEdgeUtils';

interface ExtendedEdgeMetadata extends EdgeMetadata {
  labelOffset?: { x: number; y: number };
  hasOverlap?: boolean;
}

const SmartSmoothStepEdgeComponent = ({
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
}: EdgeProps) => {
  // Use shared hook for path calculation (with offset for overlap prevention)
  const { path: edgePath, labelX, labelY } = useSmartEdge({
    id,
    source,
    target,
    sourceX: defaultSourceX,
    sourceY: defaultSourceY,
    targetX: defaultTargetX,
    targetY: defaultTargetY,
    sourcePosition: defaultSourcePosition,
    targetPosition: defaultTargetPosition,
    borderRadius: 10,
    useOffset: true,
  });

  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const edgeData = (data || {}) as ExtendedEdgeMetadata;
  const animated = edgeData.animated || false;
  const animationSpeed = edgeData.animationSpeed || 2;
  const animationColor = edgeData.animationColor || '#ff0073';
  const connectionState = (edgeData.connectionState || 'active') as ConnectionState;
  const labelOffset = edgeData.labelOffset || { x: 0, y: 0 };
  const hasOverlap = edgeData.hasOverlap || false;

  // Memoize edge style
  const edgeStyle = useMemo(
    () => getEdgeStyle(connectionState, selected ?? false, hasOverlap, hovered, style as React.CSSProperties),
    [connectionState, selected, hasOverlap, hovered, style]
  );

  const finalLabelX = labelX + labelOffset.x;
  const finalLabelY = labelY + labelOffset.y;
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

export const SmartSmoothStepEdge = memo(SmartSmoothStepEdgeComponent);
SmartSmoothStepEdge.displayName = 'SmartSmoothStepEdge';
