import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { DeviceNodeData } from '@/lib/utils/types';
import { getDeviceIcon } from '@/lib/utils/deviceIcons';
import { getIconPath, logIconError } from '@/lib/utils/iconPath';
import { cn } from '@/lib/utils/utils';
import { DeviceLabel } from '@/features/topology/components/Nodes/DeviceLabel';
import { useFlowStore } from '@/core/stores/useFlowStore';

type Side = 'left' | 'right' | 'top' | 'bottom';

// Custom comparison function to prevent unnecessary re-renders
const areDeviceNodePropsEqual = (prevProps: NodeProps, nextProps: NodeProps): boolean => {
  // Compare primitive props that affect rendering
  if (prevProps.id !== nextProps.id) return false;
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.width !== nextProps.width) return false;
  if (prevProps.height !== nextProps.height) return false;

  // Deep compare device data (DeviceNodeData)
  const prevData = prevProps.data as DeviceNodeData;
  const nextData = nextProps.data as DeviceNodeData;

  // Compare all DeviceNodeData properties that affect rendering
  if (prevData.id !== nextData.id) return false;
  if (prevData.name !== nextData.name) return false;
  if (prevData.deviceType !== nextData.deviceType) return false;
  if (prevData.deviceSubtype !== nextData.deviceSubtype) return false;
  if (prevData.iconPath !== nextData.iconPath) return false;
  if (prevData.ipAddress !== nextData.ipAddress) return false;
  if (prevData.macAddress !== nextData.macAddress) return false;
  if (prevData.subnetMask !== nextData.subnetMask) return false;
  if (prevData.defaultGateway !== nextData.defaultGateway) return false;
  if (prevData.manufacturer !== nextData.manufacturer) return false;
  if (prevData.model !== nextData.model) return false;
  if (prevData.serialNumber !== nextData.serialNumber) return false;
  if (prevData.operatingSystem !== nextData.operatingSystem) return false;
  if (prevData.osVersion !== nextData.osVersion) return false;
  if (prevData.securityZone !== nextData.securityZone) return false;
  if (prevData.assetValue !== nextData.assetValue) return false;
  if (prevData.missionCritical !== nextData.missionCritical) return false;
  if (prevData.dataClassification !== nextData.dataClassification) return false;
  if (prevData.multifactorAuth !== nextData.multifactorAuth) return false;
  if (prevData.encryptionAtRest !== nextData.encryptionAtRest) return false;
  if (prevData.encryptionInTransit !== nextData.encryptionInTransit) return false;
  if (prevData.backupsConfigured !== nextData.backupsConfigured) return false;
  if (prevData.monitoringEnabled !== nextData.monitoringEnabled) return false;
  if (prevData.vulnerabilityManagement !== nextData.vulnerabilityManagement) return false;
  if (prevData.lastVulnScan !== nextData.lastVulnScan) return false;
  if (prevData.complianceStatus !== nextData.complianceStatus) return false;
  if (prevData.systemOwner !== nextData.systemOwner) return false;
  if (prevData.department !== nextData.department) return false;
  if (prevData.contactEmail !== nextData.contactEmail) return false;
  if (prevData.location !== nextData.location) return false;
  if (prevData.label !== nextData.label) return false;
  if (prevData.deviceImageSize !== nextData.deviceImageSize) return false;

  // Compare labelFields array
  const prevLabelFields = prevData.labelFields || [];
  const nextLabelFields = nextData.labelFields || [];
  if (prevLabelFields.length !== nextLabelFields.length) return false;
  for (let i = 0; i < prevLabelFields.length; i++) {
    if (prevLabelFields[i] !== nextLabelFields[i]) return false;
  }

  // Compare applicableControls array
  const prevControls = prevData.applicableControls || [];
  const nextControls = nextData.applicableControls || [];
  if (prevControls.length !== nextControls.length) return false;
  for (let i = 0; i < prevControls.length; i++) {
    if (prevControls[i] !== nextControls[i]) return false;
  }

  return true;
};

const DeviceNodeComponent = ({ data, selected }: NodeProps) => {
  const deviceData = data as DeviceNodeData;
  const Icon = getDeviceIcon(deviceData.deviceType);
  const globalDeviceImageSize = useFlowStore((state) => state.globalSettings.globalDeviceImageSize);
  const useFloatingEdges = useFlowStore((state) => state.globalSettings.useFloatingEdges);
  const deviceAttachmentSlots = useFlowStore((state) => state.globalSettings.deviceAttachmentSlots);

  // State to track if the icon failed to load - triggers fallback to Lucide icon
  const [iconLoadError, setIconLoadError] = useState(false);

  // Use individual device image size if set, otherwise fall back to global
  const deviceImageSize = deviceData.deviceImageSize ?? globalDeviceImageSize;

  // Determine if we should show the icon image or fallback to lucide icon
  const hasIconPath = deviceData.iconPath && deviceData.iconPath.length > 0;
  const iconImagePath = hasIconPath ? getIconPath(deviceData.iconPath) : '';

  // Callback for handling icon load errors with proper logging
  const handleIconError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Log the error for debugging
    if (deviceData.iconPath && iconImagePath) {
      logIconError(deviceData.iconPath, iconImagePath, e.nativeEvent);
    }
    // Trigger React state update to show fallback icon
    setIconLoadError(true);
  }, [deviceData.iconPath, iconImagePath]);

  // Callback for successful icon load - reset error state
  const handleIconLoad = useCallback(() => {
    setIconLoadError(false);
  }, []);

  // Determine if we should show the SVG image or the fallback Lucide icon
  const showSvgIcon = hasIconPath && !iconLoadError;

  // Generate handles for a given side with a fixed count based on user settings
  // When floating edges are enabled, handles are invisible but still functional
  const generateHandlesForSide = useCallback((side: Side, position: Position) => {
    // When floating edges enabled, only render one invisible handle per side for connections
    if (useFloatingEdges) {
      const targetId = `${side}-target`;
      const sourceId = `${side}-source`;

      // Position in center of each side
      const positionStyle = (side === 'left' || side === 'right')
        ? { top: '50%' }
        : { left: '50%' };

      // Invisible handles - still functional for drag-to-connect
      return [
        <Handle
          key={targetId}
          type="target"
          position={position}
          id={targetId}
          style={{ ...positionStyle, opacity: 0, width: 1, height: 1 }}
          className="!bg-transparent !border-0"
        />,
        <Handle
          key={sourceId}
          type="source"
          position={position}
          id={sourceId}
          style={{ ...positionStyle, opacity: 0, width: 1, height: 1 }}
          className="!bg-transparent !border-0"
        />
      ];
    }

    // Standard visible handles when floating edges are disabled
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
  }, [deviceAttachmentSlots, selected, useFloatingEdges]);

  return (
    <>
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
        // Z-Index is now set via ReactFlow's native node.zIndex property (see auto-tidy.ts)
        title={deviceData.ipAddress || deviceData.name}
      >
          {/* Device Icon - Scales with container */}
          <div className="flex flex-col items-center gap-2 h-full">
            <div className="flex items-center justify-center min-h-[40px] w-full" style={{ flex: '0 0 50%' }}>
              {/* SVG Icon - shown when we have a valid icon path and no load error */}
              {showSvgIcon && (
                <img
                  src={iconImagePath}
                  alt={deviceData.name}
                  className="max-w-full max-h-full object-contain"
                  style={{ width: `${deviceImageSize}%`, height: `${deviceImageSize}%` }}
                  onError={handleIconError}
                  onLoad={handleIconLoad}
                />
              )}
              {/* Lucide Fallback Icon - shown when no icon path or load error */}
              {!showSvgIcon && (
                <Icon
                  className="text-gray-700"
                  style={{
                    width: `${deviceImageSize}%`,
                    height: `${deviceImageSize}%`,
                    maxWidth: '80px',
                    maxHeight: '80px'
                  }}
                />
              )}
            </div>
            
            {/* Device Label - Configurable fields - Takes more space now */}
            <div className="flex-1 flex items-start justify-center w-full overflow-hidden">
              <DeviceLabel data={deviceData} labelFields={deviceData.labelFields} />
            </div>
          </div>

        {/* Handles for connections - dynamically scaled based on connection count per side */}
        {generateHandlesForSide('left', Position.Left)}
        {generateHandlesForSide('right', Position.Right)}
        {generateHandlesForSide('top', Position.Top)}
        {generateHandlesForSide('bottom', Position.Bottom)}
      </div>
    </>
  );
};

// Export memoized component with custom comparison function
export const DeviceNode = memo(DeviceNodeComponent, areDeviceNodePropsEqual);
DeviceNode.displayName = 'DeviceNode';

