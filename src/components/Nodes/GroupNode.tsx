import { memo } from 'react';
import { NodeProps, NodeResizer, NodeToolbar, Position } from '@xyflow/react';
import { BoundaryNodeData, getEffectiveBoundaryStyle } from '@/lib/utils/types';
import { cn, calculateNestingDepth } from '@/lib/utils/utils';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { BoundaryToolbar } from './BoundaryToolbar';

export const GroupNode = memo(({ id, data, selected, width, height }: NodeProps) => {
  const boundaryData = data as BoundaryNodeData;
  const style = getEffectiveBoundaryStyle(boundaryData.type, boundaryData);
  const isHovered = id === boundaryData.hoveredGroupId;
  const nodes = useFlowStore((state) => state.nodes);
  const node = nodes.find((n) => n.id === id);
  const globalSettings = useFlowStore((state) => state.globalSettings);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const hasChildren = nodes.some((n) => n.parentId === id);
  const actualWidth = width || (node?.width as number) || (node?.style?.width as number) || 300;
  const actualHeight = height || (node?.height as number) || (node?.style?.height as number) || 200;
  
  // Only show toolbar if this is the single selected boundary node
  const shouldShowToolbar = selected && selectedNodeId === id && selectedNodeId !== null;
  
  
  // Calculate nesting depth for gradient background
  const nestingDepth = calculateNestingDepth(id, nodes);
  
  // Calculate background opacity - use custom if set, otherwise calculate from nesting depth
  const backgroundOpacity = style.backgroundOpacity ?? (10 + (nestingDepth * 5));

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

      {/* Main container - relative positioning for label */}
      <div className="relative w-full h-full">
        {/* Boundary box */}
        <div
          className={cn(
            'w-full h-full transition-all duration-200',
            'backdrop-blur-sm'
          )}
          style={{
            border: style.dashArray 
              ? `${style.strokeWidth}px dashed ${style.color}`
              : `${style.strokeWidth}px solid ${style.color}`,
            borderRadius: `${style.borderRadius}px`,
            padding: `${style.padding}px`,
            minWidth: '300px',
            minHeight: '200px',
            backgroundColor: isHovered 
              ? 'rgba(59, 130, 246, 0.2)' // Blue hover effect
              : `${style.color}${backgroundOpacity.toString(16).padStart(2, '0')}`, // Gradient based on nesting or custom
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

        {/* Label - Positioned based on configuration */}
        <div 
          className={getLabelPositionClasses()}
          style={getLabelPositionStyle()}
          key={`boundary-label-${globalSettings.globalBoundaryLabelSize}`}
        >
          <div
            className="rounded-md font-semibold shadow-sm backdrop-blur-sm whitespace-nowrap"
            style={getLabelSizeStyle()}
          >
            {boundaryData.label}
          </div>
        </div>
      </div>

      {/* Boundary Toolbar - shown only when this is the single selected boundary */}
      {shouldShowToolbar && (
        <BoundaryToolbar
          nodeId={id}
          data={boundaryData}
          nodeWidth={actualWidth}
          nodeHeight={actualHeight}
        />
      )}
    </>
  );
});

GroupNode.displayName = 'GroupNode';

