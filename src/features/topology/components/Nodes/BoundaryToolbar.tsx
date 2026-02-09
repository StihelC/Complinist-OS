import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BoundaryNodeData, DeviceAlignment, LabelPosition, LabelPlacement, LabelStyle, boundaryStylePresets } from '@/lib/utils/types';
import { Slider } from '@/components/ui/slider';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useReactFlow } from '@xyflow/react';
import { Ban, ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Maximize2, ChevronRight } from 'lucide-react';
import { applyDagreLayout } from '@/lib/layout/dagreLayout';
import {
  calculateOptimalSize,
  deviceAlignmentToLayoutDirection,
  BOUNDARY_SIZING_DEFAULTS
} from '@/lib/topology/boundary-sizing';
import { calculateNestingDepth } from '@/lib/utils/utils';

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
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0, repositionLeft: false, repositionTop: false });
  
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
  const [labelStyle, setLabelStyle] = useState<LabelStyle>(
    data.labelStyle || 'tab'
  );
  const [labelSpacing, setLabelSpacing] = useState<number>(data.labelSpacing || 8);
  const [labelOffset, setLabelOffset] = useState<number>(data.labelOffset || 0);
  const [borderStrokeWidth, setBorderStrokeWidth] = useState<number>(
    data.borderStrokeWidth || 2
  );
  const [borderDashArray, setBorderDashArray] = useState<string>(
    data.borderDashArray || ''
  );
  const [borderRadius, setBorderRadius] = useState<number>(data.borderRadius ?? 8);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(
    data.backgroundOpacity ?? 0
  );
  const [padding, setPadding] = useState<number>(data.padding || 4);
  const [labelBackgroundColor, setLabelBackgroundColor] = useState<string>(
    data.labelBackgroundColor || 'auto'
  );
  const [labelTextColor, setLabelTextColor] = useState<string>(
    data.labelTextColor || 'auto'
  );

  // Auto-resize state
  const [autoResize, setAutoResize] = useState<boolean>(Boolean(data.autoResize));
  const [autoResizePadding, setAutoResizePadding] = useState<number>(
    Number(data.autoResizePadding) || BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING
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

  // Get nesting path for breadcrumb display
  const nestingPath = useMemo(() => {
    if (!storeNode) return [];

    const path: Array<{ id: string; label: string }> = [];
    let currentNode: typeof storeNode | undefined = storeNode;

    while (currentNode?.parentId) {
      const parentNode = nodes.find((n) => n.id === currentNode!.parentId);
      if (parentNode && parentNode.type === 'boundary') {
        const parentData = parentNode.data as BoundaryNodeData;
        path.unshift({ id: parentNode.id, label: parentData.label });
      }
      currentNode = parentNode;
    }

    return path;
  }, [storeNode, nodes]);

  // Calculate nesting level
  const nestingLevel = useMemo(() => {
    return calculateNestingDepth(nodeId, nodes);
  }, [nodeId, nodes]);

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

  // Sync local state when data prop changes
  useEffect(() => {
    setBoundaryLabel(data.label || 'Boundary');
    setDeviceAlignment(data.deviceAlignment || 'none');
    setNodeSpacing(data.nodeSpacing || 50);
    setCustomColor(data.customColor || '');
    setUseDefaultColor(!data.customColor);
    setLabelPosition(data.labelPosition || 'bottom-center');
    setLabelPlacement(data.labelPlacement || 'outside');
    setLabelStyle(data.labelStyle || 'tab');
    setLabelSpacing(data.labelSpacing || 8);
    setLabelOffset(data.labelOffset || 0);
    setBorderStrokeWidth(data.borderStrokeWidth || 2);
    setBorderDashArray(data.borderDashArray || '');
    setBorderRadius(data.borderRadius ?? 8);
    setBackgroundOpacity(data.backgroundOpacity ?? 0);
    setPadding(data.padding || 4);
    setLabelBackgroundColor(data.labelBackgroundColor || 'auto');
    setLabelTextColor(data.labelTextColor || 'auto');
    setAutoResize(Boolean(data.autoResize));
    setAutoResizePadding(Number(data.autoResizePadding) || BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING);
  }, [data]);

  // Dynamic updates for visual properties (non-layout)
  useEffect(() => {
    updateNode(nodeId, {
      label: boundaryLabel,
      customColor: useDefaultColor ? undefined : customColor,
      labelPosition,
      labelPlacement,
      labelStyle,
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
    labelStyle,
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
    // Reset to sleek defaults
    setUseDefaultColor(true);
    setCustomColor('');
    setLabelPosition('top-center');
    setLabelPlacement('outside');
    setLabelStyle('tab');
    setLabelSpacing(8);
    setLabelOffset(0);
    setBorderStrokeWidth(2);
    setBorderDashArray(''); // Solid border
    setBorderRadius(8);
    setBackgroundOpacity(0); // Transparent
    setPadding(4);
    setLabelBackgroundColor('auto');
    setLabelTextColor('auto');
    setAutoResize(false);
    setAutoResizePadding(BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING);
  };

  // Auto-resize boundary to fit children
  const handleAutoResize = useCallback(() => {
    const boundaryNode = nodes.find((n) => n.id === nodeId);
    if (!boundaryNode) return;

    const childNodes = nodes.filter((n) => n.parentId === nodeId);

    // Get layout direction from device alignment
    const layoutDirection = deviceAlignmentToLayoutDirection(deviceAlignment);

    // Calculate optimal size
    const result = calculateOptimalSize(
      boundaryNode,
      childNodes,
      layoutDirection,
      { padding: autoResizePadding }
    );

    // Update the boundary node dimensions
    const updatedNodes = nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          width: result.width,
          height: result.height,
          style: {
            ...n.style,
            width: result.width,
            height: result.height,
          },
        };
      }
      return n;
    });

    setNodes(updatedNodes);
  }, [nodes, nodeId, deviceAlignment, autoResizePadding, setNodes]);

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
          <CardTitle className="text-base">Boundary Settings</CardTitle>
          {/* Nesting Path Breadcrumb */}
          {nestingPath.length > 0 && (
            <div className="flex items-center flex-wrap gap-0.5 text-xs text-gray-500 mt-1">
              {nestingPath.map((item) => (
                <span key={item.id} className="flex items-center">
                  <span className="text-blue-500">{item.label}</span>
                  <ChevronRight className="w-3 h-3 mx-0.5" />
                </span>
              ))}
              <span className="font-medium text-gray-700">{data.label}</span>
              <span className="ml-2 text-gray-400">(Level {nestingLevel})</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-y-auto properties-panel-content" style={{ height: 'calc(100% - 52px)' }}>
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

              {/* Auto-Resize Section */}
              <div className="space-y-3 pt-3 border-t">
                <Label className="text-xs font-semibold">Auto-Resize</Label>

                {/* Auto-resize toggle */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoResize"
                    checked={autoResize}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setAutoResize(e.target.checked);
                      updateNode(nodeId, { autoResize: e.target.checked });
                    }}
                  />
                  <Label htmlFor="autoResize" className="text-xs font-normal cursor-pointer">
                    Enable auto-resize when children change
                  </Label>
                </div>

                {/* Padding control */}
                <div className="space-y-2">
                  <Label htmlFor="autoResizePadding" className="text-xs font-semibold">
                    Padding: {autoResizePadding}px
                  </Label>
                  <Input
                    id="autoResizePadding"
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={autoResizePadding}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setAutoResizePadding(value);
                      updateNode(nodeId, { autoResizePadding: value });
                    }}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>20px</span>
                    <span>60px</span>
                    <span>100px</span>
                  </div>
                </div>

                {/* Manual resize button */}
                <Button
                  onClick={handleAutoResize}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Fit to Contents
                </Button>
              </div>
            </TabsContent>
            
            {/* Visual Tab */}
            <TabsContent value="visual" className="space-y-4 mt-4">
              {/* Style Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Quick Styles</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(boundaryStylePresets).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setCustomColor(preset.color);
                        setUseDefaultColor(false);
                        setBorderStrokeWidth(preset.strokeWidth);
                        setBorderDashArray(preset.dashArray);
                        setBorderRadius(preset.borderRadius);
                        setBackgroundOpacity(preset.backgroundOpacity);
                      }}
                      className="group relative p-1.5 rounded border border-gray-200 hover:border-gray-400 transition-all"
                      title={preset.description}
                    >
                      <div
                        className="w-full h-6 rounded"
                        style={{
                          border: `${preset.strokeWidth}px ${preset.dashArray ? 'dashed' : 'solid'} ${preset.color}`,
                          borderRadius: `${Math.min(preset.borderRadius, 8)}px`,
                        }}
                      />
                      <span className="text-[9px] text-gray-600 mt-0.5 block truncate">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-3" />

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

              {/* Label Style */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Label Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLabelStyle('badge')}
                    className={`
                      p-2 rounded border transition-colors flex flex-col items-center gap-1 text-xs
                      ${labelStyle === 'badge'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {/* Badge preview */}
                    <div className="w-full h-8 relative border border-dashed border-gray-300 rounded">
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gray-200 rounded text-[8px] border border-gray-400">
                        Label
                      </div>
                    </div>
                    <span>Badge</span>
                  </button>
                  <button
                    onClick={() => setLabelStyle('tab')}
                    className={`
                      p-2 rounded border transition-colors flex flex-col items-center gap-1 text-xs
                      ${labelStyle === 'tab'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {/* Tab preview */}
                    <div className="w-full h-8 relative">
                      <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-gray-200 rounded-t text-[8px] border-t border-l border-r border-gray-400">
                        Label
                      </div>
                      <div className="absolute top-[14px] left-0 right-0 bottom-0 border border-dashed border-gray-300 rounded-b rounded-tr" />
                    </div>
                    <span>Tab</span>
                  </button>
                </div>
              </div>

              {/* Label Position - only show for badge style */}
              {labelStyle === 'badge' && (
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
              )}

              {/* Label Placement - only show for badge style */}
              {labelStyle === 'badge' && (
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
              )}

              {/* Label Spacing - only for badge style */}
              {labelStyle === 'badge' && (
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
              )}

              {/* Label Offset - only for badge style */}
              {labelStyle === 'badge' && (
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
              )}

              {/* Border Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Border Width</Label>
                  <span className="text-xs text-gray-500 tabular-nums">{borderStrokeWidth}px</span>
                </div>
                <Slider
                  value={[borderStrokeWidth]}
                  onValueChange={(value) => setBorderStrokeWidth(value[0])}
                  min={1}
                  max={6}
                  step={1}
                  className="w-full"
                />
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Corner Radius</Label>
                  <span className="text-xs text-gray-500 tabular-nums">{borderRadius}px</span>
                </div>
                <Slider
                  value={[borderRadius]}
                  onValueChange={(value) => setBorderRadius(value[0])}
                  min={0}
                  max={24}
                  step={2}
                  className="w-full"
                />
              </div>

              {/* Background Opacity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Fill Opacity</Label>
                  <span className="text-xs text-gray-500 tabular-nums">{backgroundOpacity}%</span>
                </div>
                <Slider
                  value={[backgroundOpacity]}
                  onValueChange={(value) => setBackgroundOpacity(value[0])}
                  min={0}
                  max={30}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Live Preview */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Preview</Label>
                <div
                  className="w-full h-16 rounded transition-all"
                  style={{
                    border: `${borderStrokeWidth}px ${borderDashArray ? 'dashed' : 'solid'} ${useDefaultColor ? '#475569' : customColor}`,
                    borderRadius: `${borderRadius}px`,
                    backgroundColor: useDefaultColor
                      ? `rgba(71, 85, 105, ${backgroundOpacity / 100})`
                      : `${customColor}${Math.round(backgroundOpacity * 2.55).toString(16).padStart(2, '0')}`,
                  }}
                />
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

