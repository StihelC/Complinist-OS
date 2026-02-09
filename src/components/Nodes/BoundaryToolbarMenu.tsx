import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BoundaryNodeData, DeviceAlignment, LabelPosition, LabelPlacement } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Ban, ArrowDown, ArrowRight, ArrowUp, ArrowLeft, LayoutGrid } from 'lucide-react';
import { applyDagreLayout } from '@/lib/layout/dagreLayout';

interface BoundaryToolbarMenuProps {
  nodeId: string;
  nodeData: BoundaryNodeData;
}

export const BoundaryToolbarMenu = ({ nodeId, nodeData }: BoundaryToolbarMenuProps) => {
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('layout');
  const [boundaryLabel, setBoundaryLabel] = useState<string>(
    nodeData.label || 'Boundary'
  );
  const [_labelSize, _setLabelSize] = useState<number>(
    nodeData.labelSize || 14
  );
  const [deviceAlignment, setDeviceAlignment] = useState<DeviceAlignment>(
    nodeData.deviceAlignment || 'none'
  );
  const [nodeSpacing, setNodeSpacing] = useState<number>(
    nodeData.nodeSpacing || 50
  );
  const [_isApplying, _setIsApplying] = useState(false);
  
  // Visual customization state
  const [customColor, setCustomColor] = useState<string>(nodeData.customColor || '');
  const [useDefaultColor, setUseDefaultColor] = useState<boolean>(!nodeData.customColor);
  const [labelPosition, setLabelPosition] = useState<LabelPosition>(
    nodeData.labelPosition || 'bottom-center'
  );
  const [labelPlacement, setLabelPlacement] = useState<LabelPlacement>(
    nodeData.labelPlacement || 'outside'
  );
  const [labelSpacing, setLabelSpacing] = useState<number>(nodeData.labelSpacing || 8);
  const [labelOffset, setLabelOffset] = useState<number>(nodeData.labelOffset || 0);
  const [borderStrokeWidth, setBorderStrokeWidth] = useState<number>(
    nodeData.borderStrokeWidth || 2
  );
  const [borderDashArray, setBorderDashArray] = useState<string>(
    nodeData.borderDashArray || '5,5'
  );
  const [borderRadius, setBorderRadius] = useState<number>(nodeData.borderRadius || 12);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(
    nodeData.backgroundOpacity ?? 20
  );
  const [padding, setPadding] = useState<number>(nodeData.padding || 4);
  const [labelBackgroundColor, setLabelBackgroundColor] = useState<string>(
    nodeData.labelBackgroundColor || 'auto'
  );
  const [labelTextColor, setLabelTextColor] = useState<string>(
    nodeData.labelTextColor || 'auto'
  );

  // Dynamic updates for visual properties (non-layout)
  useEffect(() => {
    updateNode(nodeId, {
      label: boundaryLabel,
      // labelSize is now controlled globally, not per-boundary
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
    // labelSize removed from dependencies since it's global now
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

  // Auto-apply layout when deviceAlignment or nodeSpacing changes
  useEffect(() => {
    if (deviceAlignment !== 'none' && open) {
      applyDeviceAlignment();
    }
  }, [deviceAlignment, nodeSpacing]); // Only trigger on layout-related changes

  // const _handleApply = async () => { // Unused - kept for potential future use
  //   // Properties are now updated dynamically via useEffect
  //   // This button just ensures layout is applied and closes the dialog
  //   _setIsApplying(true);
  //   
  //   if (deviceAlignment !== 'none') {
  //     await applyDeviceAlignment();
  //   }
  //
  //   _setIsApplying(false);
  //   setOpen(false);
  // };
  
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



  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1">
          <LayoutGrid className="w-4 h-4" />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[600px] overflow-y-auto" align="start">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
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

          {/* Label Size - Now controlled globally */}
          <div className="space-y-2 opacity-50">
            <Label htmlFor="labelSize" className="text-xs font-semibold">
              Label Size (Global Control)
            </Label>
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
              💡 Label sizes are now controlled globally via the "Styling" panel for consistency across all boundaries.
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

          {/* Close Button - Changes apply automatically */}
          <div className="mt-4">
            <Button
              onClick={() => setOpen(false)}
              className="w-full"
              size="sm"
              variant="outline"
            >
              Close
            </Button>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

