import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeviceNodeData, DeviceType } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useReactFlow } from '@xyflow/react';
import { DeviceBasicTab } from './toolbar/DeviceBasicTab';
import { DeviceNetworkTab } from './toolbar/DeviceNetworkTab';
import { DeviceSoftwareTab } from './toolbar/DeviceSoftwareTab';
import { DeviceSecurityTab } from './toolbar/DeviceSecurityTab';
import { DeviceComplianceTab } from './toolbar/DeviceComplianceTab';
import { DeviceVisualTab } from './toolbar/DeviceVisualTab';

// Consistent panel sizing from CSS custom properties
const PANEL_CONFIG = {
  width: 380,
  minWidth: 320,
  maxWidth: 450,
  height: 420,
  minHeight: 300,
  offset: 20,
  viewportPadding: 16,
} as const;

interface DeviceToolbarProps {
  nodeId: string;
  data: DeviceNodeData;
  nodeWidth: number;
  nodeHeight: number;
}

export const DeviceToolbar = ({ nodeId, data, nodeWidth, nodeHeight }: DeviceToolbarProps) => {
  const { updateNode, globalSettings, nodes } = useFlowStore();
  const { getNode, flowToScreenPosition, getViewport } = useReactFlow();
  const [localData, setLocalData] = useState<DeviceNodeData>(data);
  const [activeTab, setActiveTab] = useState('basic');
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0, repositionLeft: false, repositionTop: false });
  
  // Get node from React Flow to access measured dimensions
  const reactFlowNode = getNode(nodeId);
  const storeNode = nodes.find((n) => n.id === nodeId);
  
  // Prefer measured dimensions (actual rendered size), then passed props, then stored dimensions
  const actualNodeWidth = useMemo(() => {
    return reactFlowNode?.measured?.width 
      || reactFlowNode?.width 
      || nodeWidth 
      || (storeNode?.width as number) 
      || (storeNode?.style?.width as number) 
      || 120;
  }, [reactFlowNode?.measured?.width, reactFlowNode?.width, nodeWidth, storeNode?.width, storeNode?.style?.width]);

  const actualNodeHeight = useMemo(() => {
    return reactFlowNode?.measured?.height 
      || reactFlowNode?.height 
      || nodeHeight 
      || (storeNode?.height as number) 
      || (storeNode?.style?.height as number) 
      || 150;
  }, [reactFlowNode?.measured?.height, reactFlowNode?.height, nodeHeight, storeNode?.height, storeNode?.style?.height]);

  // Sync localData when data prop changes
  useEffect(() => {
    setLocalData(data);
  }, [data]);

  // Calculate absolute position (handling parent nesting)
  const getAbsolutePosition = useCallback((): { x: number; y: number } => {
    const currentNode = getNode(nodeId);
    if (!currentNode) return { x: 0, y: 0 };
    
    let position = { ...currentNode.position };
    let currentParentId = currentNode.parentId;
    
    while (currentParentId) {
      const parentNode = getNode(currentParentId);
      if (!parentNode) break;
      position.x += parentNode.position.x;
      position.y += parentNode.position.y;
      currentParentId = parentNode.parentId;
    }
    
    return position;
  }, [nodeId, getNode]);

  // Calculate node edge coordinates
  const getNodeEdgeCoordinates = useCallback(() => {
    const absolutePos = getAbsolutePosition();
    const width = actualNodeWidth;
    const height = actualNodeHeight;
    
    return {
      north: { x: absolutePos.x + width / 2, y: absolutePos.y },
      south: { x: absolutePos.x + width / 2, y: absolutePos.y + height },
      east: { x: absolutePos.x + width, y: absolutePos.y + height / 2 },
      west: { x: absolutePos.x, y: absolutePos.y + height / 2 },
      center: { x: absolutePos.x + width / 2, y: absolutePos.y + height / 2 },
    };
  }, [getAbsolutePosition, actualNodeWidth, actualNodeHeight]);

  // Calculate toolbar position with viewport boundary detection
  const calculateToolbarPosition = useCallback(() => {
    const currentNode = getNode(nodeId);
    if (!currentNode) return { x: 0, y: 0, repositionLeft: false, repositionTop: false };

    const nodeEdgeCoords = getNodeEdgeCoordinates();
    const viewport = getViewport();
    const panelHeightFlow = PANEL_CONFIG.height / viewport.zoom;

    // Default position: to the right of the node
    const settingsBoxFlowPos = {
      x: nodeEdgeCoords.east.x + PANEL_CONFIG.offset,
      y: nodeEdgeCoords.east.y - panelHeightFlow / 2,
    };

    let screenPos = flowToScreenPosition(settingsBoxFlowPos);

    // Viewport boundary detection
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let repositionLeft = false;
    let repositionTop = false;

    // Check if panel would overflow right edge
    if (screenPos.x + PANEL_CONFIG.width + PANEL_CONFIG.viewportPadding > viewportWidth) {
      // Position to the left of the node instead
      const leftFlowPos = {
        x: nodeEdgeCoords.west.x - PANEL_CONFIG.offset - (PANEL_CONFIG.width / viewport.zoom),
        y: settingsBoxFlowPos.y,
      };
      screenPos = flowToScreenPosition(leftFlowPos);
      repositionLeft = true;
    }

    // Check if panel would overflow bottom edge
    if (screenPos.y + PANEL_CONFIG.height + PANEL_CONFIG.viewportPadding > viewportHeight) {
      // Adjust Y to keep panel in view
      screenPos.y = Math.max(PANEL_CONFIG.viewportPadding, viewportHeight - PANEL_CONFIG.height - PANEL_CONFIG.viewportPadding);
      repositionTop = true;
    }

    // Check if panel would overflow top edge
    if (screenPos.y < PANEL_CONFIG.viewportPadding) {
      screenPos.y = PANEL_CONFIG.viewportPadding;
    }

    // Check if panel would overflow left edge
    if (screenPos.x < PANEL_CONFIG.viewportPadding) {
      screenPos.x = PANEL_CONFIG.viewportPadding;
    }

    return { ...screenPos, repositionLeft, repositionTop };
  }, [nodeId, getNode, getNodeEdgeCoordinates, flowToScreenPosition, getViewport]);

  // Track viewport for dependency tracking
  const viewport = getViewport();
  
  // Update toolbar position only when node position, dimensions, or viewport actually changes
  useEffect(() => {
    const newPos = calculateToolbarPosition();
    setScreenPos(newPos);
  }, [calculateToolbarPosition, viewport.x, viewport.y, viewport.zoom, reactFlowNode?.position?.x, reactFlowNode?.position?.y, reactFlowNode?.width, reactFlowNode?.height, reactFlowNode?.parentId]);

  const handleChange = (field: keyof DeviceNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    updateNode(nodeId, { [field]: value });
  };

  const handleIconChange = (iconFilename: string, deviceType: DeviceType, deviceSubtype?: string) => {
    const updatedData = { 
      ...localData, 
      iconPath: iconFilename, 
      deviceType, 
      deviceSubtype: deviceSubtype || undefined
    };
    setLocalData(updatedData);
    updateNode(nodeId, {
      iconPath: iconFilename,
      deviceType,
      deviceSubtype: deviceSubtype || undefined,
    });
  };

  // Use portal to render outside React Flow's transformed DOM tree
  // This ensures position: fixed works correctly relative to viewport
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        pointerEvents: 'all',
        zIndex: 9999,
      }}
      className="nodrag nopan properties-panel-wrapper"
    >
      <Card
        className="properties-panel"
        style={{
          width: `${PANEL_CONFIG.width}px`,
          minWidth: `${PANEL_CONFIG.minWidth}px`,
          maxWidth: `${PANEL_CONFIG.maxWidth}px`,
          height: `${PANEL_CONFIG.height}px`,
          minHeight: `${PANEL_CONFIG.minHeight}px`,
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        <CardHeader className="pb-3 properties-panel-header">
          <CardTitle className="text-base">Device Settings</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto properties-panel-content" style={{ height: 'calc(100% - 52px)' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full flex-wrap gap-1 mb-3 p-1">
              <TabsTrigger value="basic" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">Basic</TabsTrigger>
              <TabsTrigger value="network" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">Network</TabsTrigger>
              <TabsTrigger value="software" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">Software</TabsTrigger>
              <TabsTrigger value="security" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">Security</TabsTrigger>
              <TabsTrigger value="compliance" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">Compliance</TabsTrigger>
              <TabsTrigger value="visual" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">Visual</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-3">
              <DeviceBasicTab
                data={localData}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Network Info Tab */}
            <TabsContent value="network" className="space-y-3">
              <DeviceNetworkTab
                data={localData}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Software Tab */}
            <TabsContent value="software" className="space-y-3">
              <DeviceSoftwareTab
                data={localData}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-3">
              <DeviceSecurityTab
                data={localData}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-3">
              <DeviceComplianceTab
                data={localData}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Visual Tab */}
            <TabsContent value="visual" className="space-y-3">
              <DeviceVisualTab
                data={localData}
                globalDeviceImageSize={globalSettings.globalDeviceImageSize}
                onChange={handleChange}
                onIconChange={handleIconChange}
                onResetImageSize={() => {
                  const newData = { ...localData };
                  delete newData.deviceImageSize;
                  setLocalData(newData);
                  updateNode(nodeId, { deviceImageSize: undefined });
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
};

