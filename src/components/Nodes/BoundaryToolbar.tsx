import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BoundaryNodeData, DeviceAlignment, LabelPosition, LabelPlacement } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useReactFlow } from '@xyflow/react';
import { Ban, ArrowDown, ArrowRight, ArrowUp, ArrowLeft } from 'lucide-react';
import { applyDagreLayout } from '@/lib/layout/dagreLayout';

interface BoundaryToolbarProps {
  nodeId: string;
  data: BoundaryNodeData;
  nodeWidth: number;
  nodeHeight: number;
}

export const BoundaryToolbar = ({ nodeId, data, nodeWidth, nodeHeight }: BoundaryToolbarProps) => {
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const globalSettings = useFlowStore((state) => state.globalSettings);
  const setGlobalSettings = useFlowStore((state) => state.setGlobalSettings);
  const { getNode, flowToScreenPosition, getViewport } = useReactFlow();
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 });
  
  const [activeTab, setActiveTab] = useState('layout');
  const [boundaryLabel, setBoundaryLabel] = useState<string>(
    data.label || 'Boundary'
  );
  const [deviceAlignment, setDeviceAlignment] = useState<DeviceAlignment>(
    data.deviceAlignment || 'none'
  );
  const [nodeSpacing, setNodeSpacing] = useState<number>(
    data.nodeSpacing || 50
  );
  
  // Visual customization state
  const [customColor, setCustomColor] = useState<string>(data.customColor || '');
  const [useDefaultColor, setUseDefaultColor] = useState<boolean>(!data.customColor);
  const [labelPosition, setLabelPosition] = useState<LabelPosition>(
    data.labelPosition || 'bottom-center'
  );
  const [labelPlacement, setLabelPlacement] = useState<LabelPlacement>(
    data.labelPlacement || 'outside'
  );
  const [labelSpacing, setLabelSpacing] = useState<number>(data.labelSpacing || 8);
  const [labelOffset, setLabelOffset] = useState<number>(data.labelOffset || 0);
  const [borderStrokeWidth, setBorderStrokeWidth] = useState<number>(
    data.borderStrokeWidth || 2
  );
  const [borderDashArray, setBorderDashArray] = useState<string>(
    data.borderDashArray || '5,5'
  );
  const [borderRadius, setBorderRadius] = useState<number>(data.borderRadius || 12);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(
    data.backgroundOpacity ?? 20
  );
  const [padding, setPadding] = useState<number>(data.padding || 4);
  const [labelBackgroundColor, setLabelBackgroundColor] = useState<string>(
    data.labelBackgroundColor || 'auto'
  );
  const [labelTextColor, setLabelTextColor] = useState<string>(
    data.labelTextColor || 'auto'
  );

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
      || 300;
  }, [reactFlowNode?.measured?.width, reactFlowNode?.width, nodeWidth, storeNode?.width, storeNode?.style?.width]);

  const actualNodeHeight = useMemo(() => {
    return reactFlowNode?.measured?.height 
      || reactFlowNode?.height 
      || nodeHeight 
      || (storeNode?.height as number) 
      || (storeNode?.style?.height as number) 
      || 200;
  }, [reactFlowNode?.measured?.height, reactFlowNode?.height, nodeHeight, storeNode?.height, storeNode?.style?.height]);

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

  // Calculate toolbar position function - only called when needed
  const calculateToolbarPosition = useCallback(() => {
    const currentNode = getNode(nodeId);
    if (!currentNode) return { x: 0, y: 0 };

    const nodeEdgeCoords = getNodeEdgeCoordinates();
    const viewport = getViewport();
    const settingsBoxHeightScreen = 380;
    const settingsBoxHeightFlow = settingsBoxHeightScreen / viewport.zoom;
    
    const offsetX = 20;
    const offsetY = 0;
    
    const settingsBoxWestEdgeX = nodeEdgeCoords.east.x + offsetX;
    const settingsBoxWestEdgeY = nodeEdgeCoords.east.y + offsetY;
    
    const settingsBoxFlowPos = {
      x: settingsBoxWestEdgeX,
      y: settingsBoxWestEdgeY - settingsBoxHeightFlow / 2,
    };
    
    return flowToScreenPosition(settingsBoxFlowPos);
  }, [nodeId, getNode, getNodeEdgeCoordinates, flowToScreenPosition, getViewport]);

  // Track viewport for dependency tracking
  const viewport = getViewport();
  
  // Update toolbar position only when node position, dimensions, or viewport actually changes
  useEffect(() => {
    const newPos = calculateToolbarPosition();
    setScreenPos(newPos);
  }, [calculateToolbarPosition, viewport.x, viewport.y, viewport.zoom, reactFlowNode?.position?.x, reactFlowNode?.position?.y, reactFlowNode?.width, reactFlowNode?.height, reactFlowNode?.parentId]);

  // Sync local state when data prop changes
  useEffect(() => {
    setBoundaryLabel(data.label || 'Boundary');
    setDeviceAlignment(data.deviceAlignment || 'none');
    setNodeSpacing(data.nodeSpacing || 50);
    setCustomColor(data.customColor || '');
    setUseDefaultColor(!data.customColor);
    setLabelPosition(data.labelPosition || 'bottom-center');
    setLabelPlacement(data.labelPlacement || 'outside');
    setLabelSpacing(data.labelSpacing || 8);
    setLabelOffset(data.labelOffset || 0);
    setBorderStrokeWidth(data.borderStrokeWidth || 2);
    setBorderDashArray(data.borderDashArray || '5,5');
    setBorderRadius(data.borderRadius || 12);
    setBackgroundOpacity(data.backgroundOpacity ?? 20);
    setPadding(data.padding || 4);
    setLabelBackgroundColor(data.labelBackgroundColor || 'auto');
    setLabelTextColor(data.labelTextColor || 'auto');
  }, [data]);

  // Dynamic updates for visual properties (non-layout)
  useEffect(() => {
    updateNode(nodeId, {
      label: boundaryLabel,
      customColor: useDefaultColor ? undefined : customColor,
      labelPosition,
      labelPlacement,
      labelSpacing,
      labelOffset,
      borderStrokeWidth,
      borderDashArray,
      borderRadius,
      backgroundOpacity,
      padding,
      labelBackgroundColor: labelBackgroundColor === 'auto' ? undefined : labelBackgroundColor,
      labelTextColor: labelTextColor === 'auto' ? undefined : labelTextColor,
    });
  }, [
    boundaryLabel,
    customColor,
    useDefaultColor,
    labelPosition,
    labelPlacement,
    labelSpacing,
    labelOffset,
    borderStrokeWidth,
    borderDashArray,
    borderRadius,
    backgroundOpacity,
    padding,
    labelBackgroundColor,
    labelTextColor,
    nodeId,
    updateNode,
  ]);

  // Dynamic updates for device alignment and node spacing
  useEffect(() => {
    updateNode(nodeId, {
      deviceAlignment,
      nodeSpacing,
    });
  }, [deviceAlignment, nodeSpacing, nodeId, updateNode]);

  const applyDeviceAlignment = async () => {
    const boundaryNode = nodes.find((n) => n.id === nodeId);
    if (!boundaryNode) return;

    const childNodes = nodes.filter((n) => n.parentId === nodeId);
    if (childNodes.length === 0) return;

    const boundaryWidth = boundaryNode.width || 300;
    const boundaryHeight = boundaryNode.height || 200;

    // Use Dagre for all layouts
    if (deviceAlignment !== 'none') {
      const globalSettings = useFlowStore.getState().globalSettings;
      const updatedNodes = await applyDagreLayout(
        nodeId,
        nodes,
        edges,
        boundaryWidth,
        boundaryHeight,
        deviceAlignment,
        nodeSpacing,
        globalSettings.globalDeviceImageSize,
        globalSettings.globalBoundaryLabelSize
      );
      setNodes(updatedNodes);
    }
  };

  // Auto-apply layout when deviceAlignment or nodeSpacing changes
  useEffect(() => {
    if (deviceAlignment !== 'none') {
      applyDeviceAlignment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceAlignment, nodeSpacing]); // Only trigger on layout-related changes

  
  const handleReset = () => {
    // Reset to defaults
    setUseDefaultColor(true);
    setCustomColor('');
    setLabelPosition('bottom-center');
    setLabelPlacement('outside');
    setLabelSpacing(8);
    setLabelOffset(0);
    setBorderStrokeWidth(2);
    setBorderDashArray('5,5');
    setBorderRadius(12);
    setBackgroundOpacity(20);
    setPadding(4);
    setLabelBackgroundColor('auto');
    setLabelTextColor('auto');
  };

  const alignmentOptions: {
    value: DeviceAlignment;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: 'none', label: 'None', icon: <Ban className="w-4 h-4" /> },
    { value: 'dagre-tb', label: 'Hierarchical Flow (Top→Bottom)', icon: <ArrowDown className="w-4 h-4" /> },
    { value: 'dagre-lr', label: 'Horizontal Flow (Left→Right)', icon: <ArrowRight className="w-4 h-4" /> },
    { value: 'dagre-bt', label: 'Reverse Hierarchy (Bottom→Top)', icon: <ArrowUp className="w-4 h-4" /> },
    { value: 'dagre-rl', label: 'Reverse Horizontal (Right→Left)', icon: <ArrowLeft className="w-4 h-4" /> },
  ];

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
      className="nodrag nopan"
    >
      <Card className="shadow-xl border-2 border-blue-400" style={{ width: '420px', minWidth: '250px', maxWidth: '800px', height: '380px', minHeight: '300px', maxHeight: '90vh', resize: 'both', overflow: 'hidden' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Boundary Settings</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto" style={{ height: 'calc(100% - 60px)' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex w-full gap-1 mb-3 p-1">
              <TabsTrigger value="layout" className="text-[10px] px-2 py-1 min-w-0 flex-1">Layout</TabsTrigger>
              <TabsTrigger value="visual" className="text-[10px] px-2 py-1 min-w-0 flex-1">Visual</TabsTrigger>
            </TabsList>
            
            {/* Layout Tab */}
            <TabsContent value="layout" className="space-y-4 mt-4">
              {/* Boundary Name */}
              <div className="space-y-2">
                <Label htmlFor="boundaryLabel" className="text-xs font-semibold">
                  Boundary Name
                </Label>
                <Input
                  id="boundaryLabel"
                  type="text"
                  value={boundaryLabel}
                  onChange={(e) => setBoundaryLabel(e.target.value)}
                  placeholder="Enter boundary name"
                  className="w-full"
                />
              </div>

              {/* Label Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="labelSize" className="text-xs font-semibold">
                    Label Size: {globalSettings.globalBoundaryLabelSize}px
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGlobalSettings({
                          globalBoundaryLabelSize: Math.max(6, globalSettings.globalBoundaryLabelSize - 2),
                        })
                      }
                      className="h-6 w-6 p-0"
                      disabled={globalSettings.globalBoundaryLabelSize <= 6}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setGlobalSettings({
                          globalBoundaryLabelSize: Math.min(400, globalSettings.globalBoundaryLabelSize + 2),
                        })
                      }
                      className="h-6 w-6 p-0"
                      disabled={globalSettings.globalBoundaryLabelSize >= 400}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Input
                  id="labelSize"
                  type="range"
                  min="6"
                  max="400"
                  step="2"
                  value={globalSettings.globalBoundaryLabelSize}
                  onChange={(e) =>
                    setGlobalSettings({
                      globalBoundaryLabelSize: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>6px</span>
                  <span>200px</span>
                  <span>400px</span>
                </div>
                <div 
                  className="p-2 bg-gray-50 rounded border text-center font-semibold"
                  style={{ fontSize: `${globalSettings.globalBoundaryLabelSize}px` }}
                >
                  Preview
                </div>
              </div>

              {/* Layout Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Layout Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {alignmentOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDeviceAlignment(option.value)}
                      className={`
                        p-2 rounded border transition-colors flex items-center gap-2 text-xs
                        ${
                          deviceAlignment === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Node Spacing Control - Only show if layout selected */}
              {deviceAlignment !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="nodeSpacing" className="text-xs font-semibold">
                    Spacing: {nodeSpacing}px
                  </Label>
                  <Input
                    id="nodeSpacing"
                    type="range"
                    min="20"
                    max="150"
                    step="10"
                    value={nodeSpacing}
                    onChange={(e) => setNodeSpacing(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Compact</span>
                    <span>Default</span>
                    <span>Spacious</span>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Visual Tab */}
            <TabsContent value="visual" className="space-y-4 mt-4">
              {/* Color Customization */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Border Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={customColor || '#2563eb'}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setUseDefaultColor(false);
                    }}
                    disabled={useDefaultColor}
                    className="w-20 h-8"
                  />
                  <Input
                    type="text"
                    value={useDefaultColor ? 'Default' : customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setUseDefaultColor(false);
                    }}
                    disabled={useDefaultColor}
                    placeholder="#2563eb"
                    className="flex-1 h-8 text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useDefaultColor"
                    checked={useDefaultColor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setUseDefaultColor(e.target.checked);
                      if (e.target.checked) {
                        setCustomColor('');
                      }
                    }}
                  />
                  <Label htmlFor="useDefaultColor" className="text-xs font-normal cursor-pointer">
                    Use default color
                  </Label>
                </div>
              </div>

              {/* Label Colors */}
              <div className="space-y-2">
                <Label htmlFor="labelBgColor" className="text-xs font-semibold">
                  Label Background
                </Label>
                <Select
                  id="labelBgColor"
                  value={labelBackgroundColor}
                  onChange={(e) => setLabelBackgroundColor(e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="auto">Auto (match border)</option>
                  <option value="#ffffff">White</option>
                  <option value="#000000">Black</option>
                  <option value="#f3f4f6">Light Gray</option>
                  <option value="#1f2937">Dark Gray</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="labelTextColor" className="text-xs font-semibold">
                  Label Text Color
                </Label>
                <Select
                  id="labelTextColor"
                  value={labelTextColor}
                  onChange={(e) => setLabelTextColor(e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="auto">Auto (match border)</option>
                  <option value="#000000">Black</option>
                  <option value="#ffffff">White</option>
                  <option value="#374151">Dark Gray</option>
                  <option value="#9ca3af">Light Gray</option>
                </Select>
              </div>

              {/* Label Position */}
              <div className="space-y-2">
                <Label htmlFor="labelPosition" className="text-xs font-semibold">
                  Label Position
                </Label>
                <Select
                  id="labelPosition"
                  value={labelPosition}
                  onChange={(e) => setLabelPosition(e.target.value as LabelPosition)}
                  className="h-8 text-xs"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                </Select>
              </div>

              {/* Label Placement */}
              <div className="space-y-2">
                <Label htmlFor="labelPlacement" className="text-xs font-semibold">
                  Label Placement
                </Label>
                <Select
                  id="labelPlacement"
                  value={labelPlacement}
                  onChange={(e) => setLabelPlacement(e.target.value as LabelPlacement)}
                  className="h-8 text-xs"
                >
                  <option value="outside">Outside</option>
                  <option value="inside">Inside</option>
                </Select>
              </div>

              {/* Label Spacing */}
              <div className="space-y-2">
                <Label htmlFor="labelSpacing" className="text-xs font-semibold">
                  Label Spacing: {labelSpacing}px
                </Label>
                <Input
                  id="labelSpacing"
                  type="range"
                  min="0"
                  max="100"
                  step="2"
                  value={labelSpacing}
                  onChange={(e) => setLabelSpacing(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0px</span>
                  <span>50px</span>
                  <span>100px</span>
                </div>
              </div>

              {/* Label Offset */}
              <div className="space-y-2">
                <Label htmlFor="labelOffset" className="text-xs font-semibold">
                  Label Offset: {labelOffset}px
                </Label>
                <Input
                  id="labelOffset"
                  type="range"
                  min="-50"
                  max="50"
                  step="2"
                  value={labelOffset}
                  onChange={(e) => setLabelOffset(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>-50px</span>
                  <span>0px</span>
                  <span>+50px</span>
                </div>
              </div>

              {/* Border Width */}
              <div className="space-y-2">
                <Label htmlFor="borderWidth" className="text-xs font-semibold">
                  Border Width: {borderStrokeWidth}px
                </Label>
                <Input
                  id="borderWidth"
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={borderStrokeWidth}
                  onChange={(e) => setBorderStrokeWidth(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1px</span>
                  <span>5px</span>
                  <span>10px</span>
                </div>
              </div>

              {/* Border Dash Pattern */}
              <div className="space-y-2">
                <Label htmlFor="borderDash" className="text-xs font-semibold">
                  Border Pattern
                </Label>
                <Select
                  id="borderDash"
                  value={borderDashArray}
                  onChange={(e) => setBorderDashArray(e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="">Solid</option>
                  <option value="3,3">Small Dashes (3,3)</option>
                  <option value="5,5">Medium Dashes (5,5)</option>
                  <option value="10,5">Large Dashes (10,5)</option>
                  <option value="8,4">Pattern (8,4)</option>
                  <option value="12,6">Wide Pattern (12,6)</option>
                </Select>
              </div>

              {/* Border Radius */}
              <div className="space-y-2">
                <Label htmlFor="borderRadius" className="text-xs font-semibold">
                  Border Radius: {borderRadius}px
                </Label>
                <Input
                  id="borderRadius"
                  type="range"
                  min="0"
                  max="50"
                  step="2"
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0px</span>
                  <span>25px</span>
                  <span>50px</span>
                </div>
              </div>

              {/* Background Opacity */}
              <div className="space-y-2">
                <Label htmlFor="bgOpacity" className="text-xs font-semibold">
                  Background Opacity: {backgroundOpacity}%
                </Label>
                <Input
                  id="bgOpacity"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={backgroundOpacity}
                  onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Padding */}
              <div className="space-y-2">
                <Label htmlFor="padding" className="text-xs font-semibold">
                  Internal Padding: {padding}px
                </Label>
                <Input
                  id="padding"
                  type="range"
                  min="0"
                  max="50"
                  step="2"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0px</span>
                  <span>25px</span>
                  <span>50px</span>
                </div>
              </div>

              {/* Reset Button */}
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
                size="sm"
              >
                Reset to Defaults
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
};

