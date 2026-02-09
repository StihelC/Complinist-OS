import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Grid3x3, ZoomIn, ZoomOut, Maximize2, Type, ArrowUp, ArrowDown } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useReactFlow } from '@xyflow/react';

interface AlignmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlignmentPanel = ({ isOpen, onClose }: AlignmentPanelProps) => {
  const [activeTab, setActiveTab] = useState('text-sizing');

  const { globalSettings, setGlobalSettings } = useFlowStore();
  const reactFlow = useReactFlow();

  const handleZoomTo = (zoomLevel: number) => {
    reactFlow.zoomTo(zoomLevel, { duration: 300 });
  };

  const handleFitView = () => {
    reactFlow.fitView({ padding: 0.2, duration: 300 });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="topology-panel topology-panel-left">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Styling</CardTitle>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Close alignment panel"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-250px)] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-3">
              <TabsTrigger value="text-sizing" className="text-xs">
                <Type className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="grid" className="text-xs">
                <Grid3x3 className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="view" className="text-xs">
                <ZoomIn className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>

            {/* Text Sizing Tab */}
            <TabsContent value="text-sizing" className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Device Labels: {globalSettings.globalDeviceLabelSize}px
                  </Label>
                  <Input
                    type="range"
                    min="6"
                    max="100"
                    step="1"
                    value={globalSettings.globalDeviceLabelSize}
                    onChange={(e) =>
                      setGlobalSettings({
                        globalDeviceLabelSize: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>6px</span>
                    <span>50px</span>
                    <span>100px</span>
                  </div>
                  <div 
                    className="p-2 bg-gray-50 rounded border text-center"
                    style={{ fontSize: `${globalSettings.globalDeviceLabelSize}px` }}
                  >
                    Preview Text
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold">
                      Boundary Labels: {globalSettings.globalBoundaryLabelSize}px
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

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Connection Labels: {globalSettings.globalConnectionLabelSize}px
                  </Label>
                  <Input
                    type="range"
                    min="8"
                    max="100"
                    step="1"
                    value={globalSettings.globalConnectionLabelSize}
                    onChange={(e) =>
                      setGlobalSettings({
                        globalConnectionLabelSize: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>8px</span>
                    <span>50px</span>
                    <span>100px</span>
                  </div>
                  <div 
                    className="p-2 bg-gray-50 rounded border text-center"
                    style={{ fontSize: `${globalSettings.globalConnectionLabelSize}px` }}
                  >
                    Preview Text
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Device Image Size: {globalSettings.globalDeviceImageSize}%
                  </Label>
                  <Input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={globalSettings.globalDeviceImageSize}
                    onChange={(e) =>
                      setGlobalSettings({
                        globalDeviceImageSize: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>20%</span>
                    <span>60%</span>
                    <span>100%</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded border text-center">
                    <div 
                      className="mx-auto bg-blue-100 rounded"
                      style={{ 
                        width: `${globalSettings.globalDeviceImageSize}px`, 
                        height: `${globalSettings.globalDeviceImageSize}px` 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Handles Per Side: {globalSettings.deviceAttachmentSlots ?? 1}
                  </Label>
                  <Input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={globalSettings.deviceAttachmentSlots ?? 1}
                    onChange={(e) =>
                      setGlobalSettings({
                        deviceAttachmentSlots: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded border text-xs text-gray-600">
                    <div className="text-center">
                      {(globalSettings.deviceAttachmentSlots ?? 1)} connection point{(globalSettings.deviceAttachmentSlots ?? 1) > 1 ? 's' : ''} per side
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Boundary Padding: {globalSettings.boundaryPadding ?? 45}px
                  </Label>
                  <Input
                    type="range"
                    min="20"
                    max="150"
                    step="5"
                    value={globalSettings.boundaryPadding ?? 45}
                    onChange={(e) =>
                      setGlobalSettings({
                        boundaryPadding: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>20px</span>
                    <span>85px</span>
                    <span>150px</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded border text-xs text-gray-600">
                    <div className="text-center">
                      Internal spacing within boundaries
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Grid & Snap Tab */}
            <TabsContent value="grid" className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showGrid"
                    checked={globalSettings.showGrid}
                    onChange={(e) =>
                      setGlobalSettings({ showGrid: e.target.checked })
                    }
                  />
                  <Label htmlFor="showGrid" className="text-sm cursor-pointer">
                    Show Grid
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="snapToGrid"
                    checked={globalSettings.snapToGrid}
                    onChange={(e) =>
                      setGlobalSettings({ snapToGrid: e.target.checked })
                    }
                  />
                  <Label htmlFor="snapToGrid" className="text-sm cursor-pointer">
                    Snap to Grid
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Grid Size: {globalSettings.gridSize}px
                  </Label>
                  <Input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={globalSettings.gridSize}
                    onChange={(e) =>
                      setGlobalSettings({ gridSize: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>10px</span>
                    <span>50px</span>
                    <span>100px</span>
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <Label className="text-xs font-semibold mb-2 block">Edge Connections</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useFloatingEdges"
                      checked={globalSettings.useFloatingEdges ?? true}
                      onChange={(e) =>
                        setGlobalSettings({ useFloatingEdges: e.target.checked })
                      }
                    />
                    <Label htmlFor="useFloatingEdges" className="text-sm cursor-pointer">
                      Floating Edges
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, edges connect to node boundaries automatically. When disabled, edges use fixed handle positions.
                  </p>

                  <div className="flex items-center space-x-2 mt-3">
                    <Checkbox
                      id="hierarchicalEdgeRouting"
                      checked={globalSettings.hierarchicalEdgeRouting ?? false}
                      onChange={(e) =>
                        setGlobalSettings({ hierarchicalEdgeRouting: e.target.checked })
                      }
                    />
                    <Label htmlFor="hierarchicalEdgeRouting" className="text-sm cursor-pointer">
                      Hierarchical Edge Routing
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Routes connections through parent boundary borders, creating clear hierarchical paths.
                  </p>
                </div>

                <div className="pt-2 text-xs text-muted-foreground">
                  Grid and snap settings help align elements precisely on the canvas.
                </div>
              </div>
            </TabsContent>

            {/* View Tab */}
            <TabsContent value="view" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Zoom Presets</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleZoomTo(0.25)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <ZoomOut className="w-3 h-3 mr-1" />
                    25%
                  </Button>
                  <Button
                    onClick={() => handleZoomTo(0.5)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <ZoomOut className="w-3 h-3 mr-1" />
                    50%
                  </Button>
                  <Button
                    onClick={() => handleZoomTo(1.0)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    100%
                  </Button>
                  <Button
                    onClick={() => handleZoomTo(1.5)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <ZoomIn className="w-3 h-3 mr-1" />
                    150%
                  </Button>
                  <Button
                    onClick={() => handleZoomTo(2.0)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <ZoomIn className="w-3 h-3 mr-1" />
                    200%
                  </Button>
                  <Button
                    onClick={handleFitView}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Maximize2 className="w-3 h-3 mr-1" />
                    Fit View
                  </Button>
                </div>

                <div className="pt-2 text-xs text-muted-foreground">
                  Use zoom presets to quickly navigate your diagram.
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

