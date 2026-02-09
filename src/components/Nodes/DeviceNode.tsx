import { memo } from 'react';
import { Handle, Position, NodeProps, NodeToolbar, NodeResizer } from '@xyflow/react';
import { DeviceNodeData } from '@/lib/utils/types';
import { getDeviceIcon } from '@/lib/utils/deviceIcons';
import { getIconPath } from '@/lib/utils/iconPath';
import { cn } from '@/lib/utils/utils';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeviceToolbar } from '@/features/topology/components/Nodes/DeviceToolbar';
import { DeviceLabel } from '@/features/topology/components/Nodes/DeviceLabel';
import { useFlowStore } from '@/core/stores/useFlowStore';

export const DeviceNode = memo(({ id, data, selected, width, height }: NodeProps) => {
  const deviceData = data as DeviceNodeData;
  const Icon = getDeviceIcon(deviceData.deviceType);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const globalDeviceImageSize = useFlowStore((state) => state.globalSettings.globalDeviceImageSize);
  const nodes = useFlowStore((state) => state.nodes);
  
  // Get actual node dimensions from store
  const node = nodes.find((n) => n.id === id);
  const actualWidth = width || (node?.width as number) || (node?.style?.width as number) || 120;
  const actualHeight = height || (node?.height as number) || (node?.style?.height as number) || 150;
  

  // Use individual device image size if set, otherwise fall back to global
  const deviceImageSize = deviceData.deviceImageSize ?? globalDeviceImageSize;
  
  // Only show toolbar if this is the single selected device node
  // This prevents toolbar from showing when multiple devices are selected
  const shouldShowToolbar = selected && selectedNodeId === id && selectedNodeId !== null;
  
  // Determine if we should show the icon image or fallback to lucide icon
  const hasIconPath = deviceData.iconPath && deviceData.iconPath.length > 0;
  const iconImagePath = hasIconPath ? getIconPath(deviceData.iconPath) : '';
  

  const handleDelete = () => {
    // This will be handled by the FlowCanvas component
    const event = new CustomEvent('delete-node', { detail: { nodeId: id } });
    window.dispatchEvent(event);
  };

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          className="h-8"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </NodeToolbar>

      <NodeResizer
        minWidth={120}
        minHeight={80}
        isVisible={selected}
        lineClassName="!border-2"
        handleClassName="!w-3 !h-3 !bg-white !border-2"
      />
      
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-md border-2 transition-all duration-200 min-w-[120px] min-h-[80px] p-3 w-full h-full',
          selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'
        )}
        // Z-Index is now set via ReactFlow's native node.zIndex property
        title={deviceData.ipAddress || deviceData.name}
      >
          {/* Device Icon - Scales with container */}
          <div className="flex flex-col items-center gap-2 h-full">
            <div className="flex items-center justify-center min-h-[40px] w-full" style={{ flex: '0 0 50%' }}>
              {hasIconPath ? (
                <img
                  src={iconImagePath}
                  alt={deviceData.name}
                  className="max-w-full max-h-full object-contain"
                  style={{ width: `${deviceImageSize}%`, height: `${deviceImageSize}%` }}
                  onError={(e) => {
                    // Fallback to lucide icon if image fails to load
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) {
                      (fallback as HTMLElement).style.display = 'block';
                    }
                  }}
                />
              ) : null}
              <Icon 
                className="text-gray-700" 
                style={{ 
                  display: hasIconPath ? 'none' : 'block',
                  width: `${deviceImageSize}%`,
                  height: `${deviceImageSize}%`,
                  maxWidth: '80px',
                  maxHeight: '80px'
                }}
              />
            </div>
            
            {/* Device Label - Configurable fields - Takes more space now */}
            <div className="flex-1 flex items-start justify-center w-full overflow-hidden">
              <DeviceLabel data={deviceData} labelFields={deviceData.labelFields} />
            </div>
          </div>

        {/* Handles for connections */}
        <Handle
          type="target"
          position={Position.Left}
          className={cn(
            'w-3 h-3 !bg-blue-500 !border-2 !border-white',
            selected && '!border-blue-600'
          )}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={cn(
            'w-3 h-3 !bg-blue-500 !border-2 !border-white',
            selected && '!border-blue-600'
          )}
        />
      </div>

      {/* Device Toolbar - shown only when this is the single selected device */}
      {shouldShowToolbar && (
        <DeviceToolbar
          nodeId={id}
          data={deviceData}
          nodeWidth={actualWidth}
          nodeHeight={actualHeight}
        />
      )}
    </>
  );
});

DeviceNode.displayName = 'DeviceNode';

