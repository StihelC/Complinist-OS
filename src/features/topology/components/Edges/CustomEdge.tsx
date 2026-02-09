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
} from '@xyflow/react';
import { EdgeMetadata } from '@/lib/utils/types';
import { EdgeLabel } from './EdgeLabel';

/**
 * Extended EdgeMetadata with collision-aware positioning
 */
interface ExtendedEdgeMetadata extends EdgeMetadata {
  /** Label offset from auto-tidy collision resolution */
  labelOffset?: { x: number; y: number };
  /** Label rotation in degrees (if enabled) */
  labelRotation?: number;
  /** Whether label was adjusted for collision */
  labelAdjusted?: boolean;
  /** Number of overlapping edges */
  overlapCount?: number;
  /** Whether this edge overlaps with other edges */
  hasOverlap?: boolean;
  /** Handle offset for multiple edges to same target (in pixels) */
  handleOffset?: number;
}

// Custom comparison function to prevent unnecessary re-renders
const areEdgePropsEqual = (prevProps: EdgeProps, nextProps: EdgeProps): boolean => {
  // Compare primitive props that affect rendering
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.sourceX !== nextProps.sourceX) return false;
  if (prevProps.sourceY !== nextProps.sourceY) return false;
  if (prevProps.targetX !== nextProps.targetX) return false;
  if (prevProps.targetY !== nextProps.targetY) return false;
  if (prevProps.sourcePosition !== nextProps.sourcePosition) return false;
  if (prevProps.targetPosition !== nextProps.targetPosition) return false;
  if (prevProps.markerEnd !== nextProps.markerEnd) return false;

  // Compare style objects
  const prevStyle = prevProps.style || {};
  const nextStyle = nextProps.style || {};
  if (JSON.stringify(prevStyle) !== JSON.stringify(nextStyle)) return false;

  // Deep compare edge data (EdgeMetadata)
  const prevData = (prevProps.data || {}) as EdgeMetadata;
  const nextData = (nextProps.data || {}) as EdgeMetadata;

  // Compare all EdgeMetadata properties that affect rendering
  if (prevData.edgeType !== nextData.edgeType) return false;
  if (prevData.animated !== nextData.animated) return false;
  if (prevData.animationSpeed !== nextData.animationSpeed) return false;
  if (prevData.animationColor !== nextData.animationColor) return false;
  if (prevData.connectionState !== nextData.connectionState) return false;
  if (prevData.label !== nextData.label) return false;
  if (prevData.protocol !== nextData.protocol) return false;
  if (prevData.bandwidth !== nextData.bandwidth) return false;
  if (prevData.latency !== nextData.latency) return false;
  if (prevData.jitter !== nextData.jitter) return false;
  if (prevData.packetLoss !== nextData.packetLoss) return false;
  if (prevData.errorRate !== nextData.errorRate) return false;
  if (prevData.linkType !== nextData.linkType) return false;
  if (prevData.vlanId !== nextData.vlanId) return false;
  if (prevData.qosClass !== nextData.qosClass) return false;
  if (prevData.redundancyType !== nextData.redundancyType) return false;
  if (prevData.portSource !== nextData.portSource) return false;
  if (prevData.portTarget !== nextData.portTarget) return false;
  if (prevData.dataFlow !== nextData.dataFlow) return false;
  if (prevData.encryptionProtocol !== nextData.encryptionProtocol) return false;
  if (prevData.monitored !== nextData.monitored) return false;

  // Compare labelFields array
  const prevLabelFields = prevData.labelFields || [];
  const nextLabelFields = nextData.labelFields || [];
  if (prevLabelFields.length !== nextLabelFields.length) return false;
  for (let i = 0; i < prevLabelFields.length; i++) {
    if (prevLabelFields[i] !== nextLabelFields[i]) return false;
  }

  // Compare collision-aware label positioning properties
  const prevExtData = prevData as ExtendedEdgeMetadata;
  const nextExtData = nextData as ExtendedEdgeMetadata;

  if (prevExtData.labelOffset?.x !== nextExtData.labelOffset?.x) return false;
  if (prevExtData.labelOffset?.y !== nextExtData.labelOffset?.y) return false;
  if (prevExtData.labelRotation !== nextExtData.labelRotation) return false;
  if (prevExtData.labelAdjusted !== nextExtData.labelAdjusted) return false;
  if (prevExtData.overlapCount !== nextExtData.overlapCount) return false;
  if (prevExtData.hasOverlap !== nextExtData.hasOverlap) return false;
  if (prevExtData.handleOffset !== nextExtData.handleOffset) return false;

  return true;
};

// Helper to get the appropriate path based on edge type
const getEdgePath = (
  edgeType: string,
  params: {
    sourceX: number;
    sourceY: number;
    sourcePosition: any;
    targetX: number;
    targetY: number;
    targetPosition: any;
  },
  handleOffset?: number
) => {
  // Apply handle offset for orthogonal edge types (smoothstep, step)
  // Offset is applied to target connection point to separate multiple edges
  let finalTargetX = params.targetX;
  let finalTargetY = params.targetY;
  
  if (handleOffset !== undefined && handleOffset !== 0 && (edgeType === 'smoothstep' || edgeType === 'step')) {
    // Determine if target handle is vertical (Left/Right) or horizontal (Top/Bottom)
    const isVerticalHandle = params.targetPosition === Position.Left || params.targetPosition === Position.Right;
    
    if (isVerticalHandle) {
      // For vertical handles, offset Y coordinate
      finalTargetY = params.targetY + handleOffset;
    } else {
      // For horizontal handles, offset X coordinate
      finalTargetX = params.targetX + handleOffset;
    }
  }

  const finalParams = {
    ...params,
    targetX: finalTargetX,
    targetY: finalTargetY,
  };

  switch (edgeType) {
    case 'straight':
      return getStraightPath(finalParams);
    case 'step':
      // Step edges use smoothstep with specific parameters
      return getSmoothStepPath({ ...finalParams, borderRadius: 0 });
    case 'smoothstep':
      return getSmoothStepPath(finalParams);
    case 'simplebezier':
      return getSimpleBezierPath(finalParams);
    case 'default':
    default:
      return getBezierPath(finalParams);
  }
};

const CustomEdgeComponent = (props: EdgeProps) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    selected,
  } = props;

  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const edgeData: ExtendedEdgeMetadata = (data || {}) as ExtendedEdgeMetadata;
  const edgeType = edgeData.edgeType || 'smoothstep';
  const animated = edgeData.animated || false;
  const animationSpeed = edgeData.animationSpeed || 2;
  const animationColor = edgeData.animationColor || '#ff0073';
  const connectionState = edgeData.connectionState || 'active';

  // Get collision-aware label positioning
  const labelOffset = edgeData.labelOffset || { x: 0, y: 0 };
  const labelRotation = edgeData.labelRotation || 0;
  const labelAdjusted = edgeData.labelAdjusted || false;

  // Get overlap information
  const hasOverlap = edgeData.hasOverlap || false;
  const overlapCount = edgeData.overlapCount || 0;

  // Get handle offset for multiple edges to same target
  const handleOffset = edgeData.handleOffset;

  // Get the path based on edge type
  const [edgePath, labelX, labelY] = getEdgePath(
    edgeType,
    {
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    },
    handleOffset
  );

  // Calculate final label position with collision offset applied
  const finalLabelX = labelX + labelOffset.x;
  const finalLabelY = labelY + labelOffset.y;

  // Style based on connection state and hover
  const getEdgeStyle = useCallback(() => {
    const baseStyle: React.CSSProperties = { ...(style as React.CSSProperties) };

    // Hover takes precedence for visual feedback (but not over selection)
    if (hovered && !selected) {
      baseStyle.stroke = '#60a5fa'; // blue-400
      baseStyle.strokeWidth = 2.5;
      baseStyle.cursor = 'pointer';
      return baseStyle;
    }

    switch (connectionState) {
      case 'active':
        if (hasOverlap) {
          // Overlapped edges use subtle gray with double-line effect (handled in render)
          baseStyle.stroke = selected ? '#4b5563' : '#6b7280'; // Medium gray
          baseStyle.strokeWidth = selected ? 2.5 : 2;
        } else {
          baseStyle.stroke = selected ? '#3b82f6' : '#6b7280';
          baseStyle.strokeWidth = selected ? 3 : 2;
        }
        break;
      case 'standby':
        baseStyle.stroke = '#eab308';
        baseStyle.strokeWidth = selected ? 3 : 2;
        baseStyle.strokeDasharray = '5,5';
        if (hasOverlap) {
          baseStyle.strokeOpacity = selected ? 1 : 0.7;
        }
        break;
      case 'failed':
        baseStyle.stroke = '#ef4444';
        baseStyle.strokeWidth = selected ? 3 : 2;
        baseStyle.strokeDasharray = '3,3';
        if (hasOverlap) {
          baseStyle.strokeOpacity = selected ? 1 : 0.7;
        }
        break;
    }

    return baseStyle;
  }, [connectionState, selected, style, hasOverlap, overlapCount, hovered]);

  // Generate transform string for label positioning with optional rotation
  const labelTransform = useMemo(() => {
    let transform = `translate(-50%, -50%) translate(${finalLabelX}px, ${finalLabelY}px)`;
    if (labelRotation !== 0) {
      transform += ` rotate(${labelRotation}deg)`;
    }
    return transform;
  }, [finalLabelX, finalLabelY, labelRotation]);

  // Get styles for double-line effect on overlapping edges
  const edgeStyle = getEdgeStyle();
  const showDoubleLine = hasOverlap && connectionState === 'active';

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
      {/* Hover/selection highlight glow effect */}
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
      {/* Double-line effect: outer stroke for overlapping edges */}
      {showDoubleLine && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeStyle.stroke as string}
          strokeWidth={(edgeStyle.strokeWidth as number) + 1.5}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/* Double-line effect: inner gap (background color) */}
      {showDoubleLine && (
        <path
          d={edgePath}
          fill="none"
          stroke="#f9fafb"
          strokeWidth={(edgeStyle.strokeWidth as number) - 0.5}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={showDoubleLine ? { ...edgeStyle, strokeWidth: 1 } : edgeStyle}
        markerEnd={markerEnd ? (typeof markerEnd === 'string' ? markerEnd : String(markerEnd)) : undefined}
      />

      {/* Animated marker for data flow */}
      {animated && (
        <circle r="5" fill={animationColor}>
          <animateMotion dur={`${animationSpeed}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Edge Label - with collision-aware positioning */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: labelTransform,
            pointerEvents: 'all',
            zIndex: 50,
            // Add subtle transition for smooth position updates
            transition: labelAdjusted ? 'transform 0.2s ease-out' : undefined,
          }}
          className="nodrag nopan"
          data-collision-adjusted={labelAdjusted ? 'true' : 'false'}
        >
          <EdgeLabel data={edgeData} labelFields={edgeData.labelFields || []} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Export memoized component with custom comparison function
export const CustomEdge = memo(CustomEdgeComponent, areEdgePropsEqual);
CustomEdge.displayName = 'CustomEdge';
