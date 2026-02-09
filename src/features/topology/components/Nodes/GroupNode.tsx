import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { NodeProps, NodeResizer, NodeToolbar, Position, Handle } from '@xyflow/react';
import { BoundaryNodeData, getEffectiveBoundaryStyle } from '@/lib/utils/types';
import { cn } from '@/lib/utils/utils';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFlowStore } from '@/core/stores/useFlowStore';

type Side = 'left' | 'right' | 'top' | 'bottom';

// Custom comparison function to prevent unnecessary re-renders
const areGroupNodePropsEqual = (prevProps: NodeProps, nextProps: NodeProps): boolean => {
  // Compare primitive props that affect rendering
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.width !== nextProps.width) return false;
  if (prevProps.height !== nextProps.height) return false;

  // Deep compare boundary data (BoundaryNodeData)
  const prevData = prevProps.data as BoundaryNodeData;
  const nextData = nextProps.data as BoundaryNodeData;

  // Compare all BoundaryNodeData properties that affect rendering
  if (prevData.id !== nextData.id) return false;
  if (prevData.label !== nextData.label) return false;
  if (prevData.type !== nextData.type) return false;
  if (prevData.customColor !== nextData.customColor) return false;
  if (prevData.labelPosition !== nextData.labelPosition) return false;
  if (prevData.labelPlacement !== nextData.labelPlacement) return false;
  if (prevData.labelSpacing !== nextData.labelSpacing) return false;
  if (prevData.labelOffset !== nextData.labelOffset) return false;
  if (prevData.borderStrokeWidth !== nextData.borderStrokeWidth) return false;
  if (prevData.borderDashArray !== nextData.borderDashArray) return false;
  if (prevData.borderRadius !== nextData.borderRadius) return false;
  if (prevData.backgroundOpacity !== nextData.backgroundOpacity) return false;
  if (prevData.padding !== nextData.padding) return false;
  if (prevData.labelBackgroundColor !== nextData.labelBackgroundColor) return false;
  if (prevData.labelTextColor !== nextData.labelTextColor) return false;
  if (prevData.deviceAlignment !== nextData.deviceAlignment) return false;
  if (prevData.nodeSpacing !== nextData.nodeSpacing) return false;
  if (prevData.hoveredGroupId !== nextData.hoveredGroupId) return false;
  if (prevData.securityLevel !== nextData.securityLevel) return false;
  if (prevData.zoneType !== nextData.zoneType) return false;
  if (prevData.requiresAuthentication !== nextData.requiresAuthentication) return false;
  if (prevData.labelSize !== nextData.labelSize) return false;
  if (prevData.layoutDirection !== nextData.layoutDirection) return false;
  if (prevData.spacing !== nextData.spacing) return false;
  if (prevData.nestingDepth !== nextData.nestingDepth) return false;
  if (prevData.parentBoundaryId !== nextData.parentBoundaryId) return false;

  // Compare dataTypesProcessed array
  const prevDataTypes = prevData.dataTypesProcessed || [];
  const nextDataTypes = nextData.dataTypesProcessed || [];
  if (prevDataTypes.length !== nextDataTypes.length) return false;
  for (let i = 0; i < prevDataTypes.length; i++) {
    if (prevDataTypes[i] !== nextDataTypes[i]) return false;
  }

  return true;
};

const GroupNodeComponent = ({ id, data, selected }: NodeProps) => {
  const boundaryData = data as BoundaryNodeData;
  const style = getEffectiveBoundaryStyle(boundaryData.type, boundaryData);
  const isHovered = id === boundaryData.hoveredGroupId;
  const nodes = useFlowStore((state) => state.nodes);
  const globalSettings = useFlowStore((state) => state.globalSettings);
  const updateNode = useFlowStore((state) => state.updateNode);
  const deviceAttachmentSlots = globalSettings.deviceAttachmentSlots;

  const hasChildren = nodes.some((n) => n.parentId === id);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(boundaryData.label);
  const inputRef = useRef<HTMLInputElement>(null);


  // Default to 0 (transparent) for sleek look, user can adjust via toolbar
  const backgroundOpacity = style.backgroundOpacity ?? 0;

  // Handle double-click to start editing
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(boundaryData.label);
    setIsEditing(true);
  }, [boundaryData.label]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle save on blur or Enter key
  const handleSave = useCallback(() => {
    if (editValue.trim() !== '' && editValue !== boundaryData.label) {
      updateNode(id, { label: editValue.trim() });
    }
    setIsEditing(false);
  }, [editValue, boundaryData.label, updateNode, id]);

  // Handle key events for editing
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(boundaryData.label);
      setIsEditing(false);
    }
  }, [handleSave, boundaryData.label]);

  const handleDelete = () => {
    const event = new CustomEvent('delete-node', { detail: { nodeId: id } });
    window.dispatchEvent(event);
  };

  // Get label position classes based on configuration
  const getLabelPositionClasses = () => {
    const baseClasses = 'absolute flex items-center justify-center pointer-events-none z-[1002]';
    const position = boundaryData.labelPosition || 'bottom-center';
    // const placement = boundaryData.labelPlacement || 'outside'; // Unused in this function
    
    let positionClasses = '';
    
    // Horizontal positioning
    if (position.includes('left')) {
      positionClasses += ' left-0';
    } else if (position.includes('right')) {
      positionClasses += ' right-0';
    } else { // center
      positionClasses += ' left-1/2 -translate-x-1/2';
    }
    
    // Vertical positioning handled in style
    return `${baseClasses}${positionClasses}`;
  };

  const getLabelPositionStyle = () => {
    // Always use global setting for consistent sizing across all boundaries
    const fontSize = globalSettings.globalBoundaryLabelSize;
    const padding = Math.max(4, fontSize * 0.4);
    const spacing = boundaryData.labelSpacing ?? 8;
    const offset = boundaryData.labelOffset ?? 0;
    const position = boundaryData.labelPosition || 'bottom-center';
    const placement = boundaryData.labelPlacement || 'outside';
    
    const style: React.CSSProperties = {};
    
    if (placement === 'outside') {
      // Position outside the boundary
      if (position.startsWith('top')) {
        const totalOffset = fontSize + (padding * 2) + spacing - offset;
        style.top = `-${totalOffset}px`;
      } else { // bottom
        const totalOffset = fontSize + (padding * 2) + spacing + offset;
        style.bottom = `-${totalOffset}px`;
      }
    } else {
      // Position inside the boundary
      if (position.startsWith('top')) {
        style.top = `${spacing + offset}px`;
      } else { // bottom
        style.bottom = `${spacing - offset}px`;
      }
    }
    
    return style;
  };

  // Get label size styling (direct pixel values)
  const getLabelSizeStyle = () => {
    // Always use global setting for consistent sizing across all boundaries
    const fontSize = globalSettings.globalBoundaryLabelSize;
    const padding = Math.max(4, fontSize * 0.4); // Proportional padding
    
    // Determine label colors
    const labelBgColor = boundaryData.labelBackgroundColor && boundaryData.labelBackgroundColor !== 'auto'
      ? boundaryData.labelBackgroundColor
      : `${style.color}20`;
    
    const labelTextColorValue = boundaryData.labelTextColor && boundaryData.labelTextColor !== 'auto'
      ? boundaryData.labelTextColor
      : style.color;
    
    return {
      fontSize: `${fontSize}px`,
      padding: `${padding}px ${padding * 1.5}px`,
      backgroundColor: labelBgColor,
      color: labelTextColorValue,
      border: `1px solid ${style.color}`,
    };
  };

  // Generate handles for a given side with a fixed count based on user settings
  const generateHandlesForSide = useCallback((side: Side, position: Position) => {
    // Use fixed count from user settings (default 1 if not set or 0)
    const count = Math.max(1, deviceAttachmentSlots ?? 1);
    const handles: React.ReactNode[] = [];

    for (let i = 0; i < count; i++) {
      // Calculate position percentage (evenly spaced along the side)
      // For 1 handle: 50%, for 2: 33%, 66%, for 3: 25%, 50%, 75%, etc.
      const percentage = count === 1 ? 50 : (100 / (count + 1)) * (i + 1);

      // Position style based on side orientation
      const positionStyle = (side === 'left' || side === 'right')
        ? { top: `${percentage}%` }
        : { left: `${percentage}%` };

      // Handle IDs: first handle uses legacy ID for backward compatibility,
      // additional handles use indexed IDs
      const targetId = i === 0 ? `${side}-target` : `${side}-target-${i}`;
      const sourceId = i === 0 ? `${side}-source` : `${side}-source-${i}`;

      handles.push(
        <Handle
          key={targetId}
          type="target"
          position={position}
          id={targetId}
          style={positionStyle}
          className={cn(
            'w-3 h-3 !bg-blue-500 !border-2 !border-white',
            selected && '!border-blue-600'
          )}
        />,
        <Handle
          key={sourceId}
          type="source"
          position={position}
          id={sourceId}
          style={positionStyle}
          className={cn(
            'w-3 h-3 !bg-blue-500 !border-2 !border-white',
            selected && '!border-blue-600'
          )}
        />
      );
    }

    return handles;
  }, [deviceAttachmentSlots, selected]);

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="h-8"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </NodeToolbar>

      <NodeResizer
        minWidth={300}
        minHeight={200}
        isVisible={selected}
        lineClassName="!border-2"
        handleClassName="!w-3 !h-3 !bg-white !border-2"
      />

      {/* Main container - boundary box */}
      <div className="relative w-full h-full" style={{ zIndex: 1 }}>
        {/* Boundary box - sleek border with optional subtle fill */}
        <div
          className={cn(
            'w-full h-full transition-all duration-200',
            'pointer-events-none' // Allow clicks to pass through to devices inside
          )}
          style={{
            border: style.dashArray
              ? `${style.strokeWidth}px dashed ${style.color}`
              : `${style.strokeWidth}px solid ${style.color}`,
            borderRadius: `${style.borderRadius}px`,
            backgroundColor: isHovered
              ? 'rgba(59, 130, 246, 0.08)' // Light blue hover effect
              : backgroundOpacity > 0
                ? `${style.color}${Math.round(backgroundOpacity * 2.55).toString(16).padStart(2, '0')}`
                : 'transparent',
          }}
        >
          {/* Instructions when empty */}
          {!hasChildren && (
            <div className="flex items-center justify-center h-full pointer-events-none">
              <p className="text-sm text-gray-400 italic">
                Drop devices or boundaries here
              </p>
            </div>
          )}
        </div>

        {/* Handles for connections - dynamically scaled based on connection count per side */}
        {generateHandlesForSide('left', Position.Left)}
        {generateHandlesForSide('right', Position.Right)}
        {generateHandlesForSide('top', Position.Top)}
        {generateHandlesForSide('bottom', Position.Bottom)}
      </div>

      {/* Label - Outside boundary box container */}
      <div
        className={getLabelPositionClasses()}
        style={{ ...getLabelPositionStyle(), zIndex: 10 }}
        key={`boundary-label-${globalSettings.globalBoundaryLabelSize}`}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="rounded-md font-semibold shadow-sm backdrop-blur-sm whitespace-nowrap outline-none ring-2 ring-blue-500 pointer-events-auto"
            style={{
              ...getLabelSizeStyle(),
              minWidth: '100px',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="rounded-md font-semibold shadow-sm backdrop-blur-sm whitespace-nowrap cursor-text hover:ring-2 hover:ring-blue-300 transition-all pointer-events-auto"
            style={getLabelSizeStyle()}
            onDoubleClick={handleDoubleClick}
            title="Double-click to edit name"
          >
            {boundaryData.label}
          </div>
        )}
      </div>
    </>
  );
};

// Export memoized component with custom comparison function
export const GroupNode = memo(GroupNodeComponent, areGroupNodePropsEqual);
GroupNode.displayName = 'GroupNode';

