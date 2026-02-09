import { useState, useMemo } from 'react';
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EdgeMetadata } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { X } from 'lucide-react';

// Consistent panel sizing from CSS custom properties
const PANEL_CONFIG = {
  width: 380,
  minWidth: 320,
  maxWidth: 450,
  height: 420,
  minHeight: 300,
  viewportPadding: 16,
} as const;

interface EdgeToolbarProps {
  edgeId: string;
  data: EdgeMetadata;
  labelX: number;
  labelY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  onClose: () => void;
}

// Available fields for label display
const LABEL_FIELD_OPTIONS = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'bandwidth', label: 'Bandwidth' },
  { value: 'latency', label: 'Latency' },
  { value: 'jitter', label: 'Jitter' },
  { value: 'packetLoss', label: 'Packet Loss' },
  { value: 'linkType', label: 'Link Type' },
  { value: 'vlanId', label: 'VLAN ID' },
  { value: 'qosClass', label: 'QoS Class' },
  { value: 'connectionState', label: 'Connection State' },
  { value: 'portSource', label: 'Source Port' },
  { value: 'portTarget', label: 'Target Port' },
];

export const EdgeToolbar = ({ edgeId, data, labelX, labelY, sourceX, sourceY, targetX, targetY, onClose }: EdgeToolbarProps) => {
  const { updateEdge } = useFlowStore();
  const { flowToScreenPosition, getViewport } = useReactFlow();
  const [localData, setLocalData] = useState<EdgeMetadata>(data);
  const [activeTab, setActiveTab] = useState('connection');

  // Calculate edge toolbar position with viewport boundary detection
  const toolbarPos = useMemo(() => {
    const viewport = getViewport();
    const deltaX = Math.abs(targetX - sourceX);
    const deltaY = Math.abs(targetY - sourceY);

    // Determine if edge is more horizontal or vertical
    const isHorizontal = deltaX > deltaY;

    let offsetX = labelX;
    let offsetY = labelY;

    if (isHorizontal) {
      // Left-to-right edge: place toolbar below
      offsetY = labelY + 80 / viewport.zoom;
    } else {
      // Up-to-down edge: place toolbar to the right
      offsetX = labelX + 100 / viewport.zoom;
    }

    // Convert to screen position for boundary checking
    const screenPos = flowToScreenPosition({ x: offsetX, y: offsetY });
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust if panel would overflow right edge
    if (screenPos.x + PANEL_CONFIG.width / 2 + PANEL_CONFIG.viewportPadding > viewportWidth) {
      offsetX = labelX - 100 / viewport.zoom;
    }

    // Adjust if panel would overflow bottom edge
    if (screenPos.y + PANEL_CONFIG.height / 2 + PANEL_CONFIG.viewportPadding > viewportHeight) {
      offsetY = labelY - 80 / viewport.zoom;
    }

    return { x: offsetX, y: offsetY };
  }, [labelX, labelY, sourceX, sourceY, targetX, targetY, flowToScreenPosition, getViewport]);

  const handleChange = (field: keyof EdgeMetadata, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    updateEdge(edgeId, { [field]: value });
  };

  const handleLabelFieldToggle = (field: string, checked: boolean) => {
    const currentFields = localData.labelFields || [];
    const newFields = checked
      ? [...currentFields, field]
      : currentFields.filter((f) => f !== field);
    
    const newData = { ...localData, labelFields: newFields };
    setLocalData(newData);
    updateEdge(edgeId, { labelFields: newFields });
  };

  const isLabelFieldSelected = (field: string) => {
    return (localData.labelFields || []).includes(field);
  };

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${toolbarPos.x}px, ${toolbarPos.y}px)`,
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
          <CardHeader className="pb-3 properties-panel-header flex flex-row items-center justify-between">
            <CardTitle className="text-base">Connection Settings</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="overflow-y-auto properties-panel-content" style={{ height: 'calc(100% - 52px)' }}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-3">
                <TabsTrigger value="connection" className="text-xs">Info</TabsTrigger>
                <TabsTrigger value="performance" className="text-xs">Perf</TabsTrigger>
                <TabsTrigger value="visual" className="text-xs">Visual</TabsTrigger>
              </TabsList>

              {/* Connection Info Tab */}
              <TabsContent value="connection" className="space-y-3">
                <div>
                  <Label htmlFor="linkType" className="text-xs">Link Type</Label>
                  <Input
                    id="linkType"
                    value={localData.linkType || ''}
                    onChange={(e) => handleChange('linkType', e.target.value)}
                    placeholder="Ethernet, Fiber, Wireless"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="protocol" className="text-xs">Protocol</Label>
                  <Input
                    id="protocol"
                    value={localData.protocol || ''}
                    onChange={(e) => handleChange('protocol', e.target.value)}
                    placeholder="TCP, UDP, HTTPS"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="bandwidth" className="text-xs">Bandwidth</Label>
                  <Input
                    id="bandwidth"
                    value={localData.bandwidth || ''}
                    onChange={(e) => handleChange('bandwidth', e.target.value)}
                    placeholder="1 Gbps, 100 Mbps"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="portSource" className="text-xs">Src Port</Label>
                    <Input
                      id="portSource"
                      value={localData.portSource || ''}
                      onChange={(e) => handleChange('portSource', e.target.value)}
                      placeholder="8080"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portTarget" className="text-xs">Dst Port</Label>
                    <Input
                      id="portTarget"
                      value={localData.portTarget || ''}
                      onChange={(e) => handleChange('portTarget', e.target.value)}
                      placeholder="443"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="vlanId" className="text-xs">VLAN ID</Label>
                  <Input
                    id="vlanId"
                    value={localData.vlanId || ''}
                    onChange={(e) => handleChange('vlanId', e.target.value)}
                    placeholder="VLAN 100"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="connectionState" className="text-xs">State</Label>
                  <Select
                    id="connectionState"
                    value={localData.connectionState || 'active'}
                    onChange={(e) => handleChange('connectionState', e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="standby">Standby</option>
                    <option value="failed">Failed</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="encrypted"
                      checked={!!localData.encryptionProtocol}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!e.target.checked) {
                          handleChange('encryptionProtocol', '');
                        }
                      }}
                    />
                    <Label htmlFor="encrypted" className="text-xs">Encrypted</Label>
                  </div>
                  {localData.encryptionProtocol !== undefined && localData.encryptionProtocol !== '' && (
                    <Input
                      value={localData.encryptionProtocol || ''}
                      onChange={(e) => handleChange('encryptionProtocol', e.target.value)}
                      placeholder="TLS 1.3, IPSec"
                      className="h-8 text-xs"
                    />
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="monitored"
                    checked={localData.monitored || false}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange('monitored', e.target.checked)
                    }
                  />
                  <Label htmlFor="monitored" className="text-xs">Monitored</Label>
                </div>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-3">
                <div>
                  <Label htmlFor="latency" className="text-xs">Latency</Label>
                  <Input
                    id="latency"
                    value={localData.latency || ''}
                    onChange={(e) => handleChange('latency', e.target.value)}
                    placeholder="10ms"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="jitter" className="text-xs">Jitter</Label>
                  <Input
                    id="jitter"
                    value={localData.jitter || ''}
                    onChange={(e) => handleChange('jitter', e.target.value)}
                    placeholder="5ms"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="packetLoss" className="text-xs">Packet Loss</Label>
                  <Input
                    id="packetLoss"
                    value={localData.packetLoss || ''}
                    onChange={(e) => handleChange('packetLoss', e.target.value)}
                    placeholder="0.01%"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="errorRate" className="text-xs">Error Rate</Label>
                  <Input
                    id="errorRate"
                    value={localData.errorRate || ''}
                    onChange={(e) => handleChange('errorRate', e.target.value)}
                    placeholder="0.001%"
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="qosClass" className="text-xs">QoS Class</Label>
                  <Select
                    id="qosClass"
                    value={localData.qosClass || ''}
                    onChange={(e) => handleChange('qosClass', e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="">None</option>
                    <option value="High Priority">High Priority</option>
                    <option value="Medium Priority">Medium Priority</option>
                    <option value="Best Effort">Best Effort</option>
                  </Select>
                </div>
              </TabsContent>

              {/* Visual Settings Tab */}
              <TabsContent value="visual" className="space-y-3">
                <div>
                  <Label htmlFor="customLabel" className="text-xs">Custom Label</Label>
                  <Input
                    id="customLabel"
                    value={localData.label || ''}
                    onChange={(e) => handleChange('label', e.target.value)}
                    placeholder="Custom label"
                    className="h-8 text-xs"
                  />
                </div>

                {/* Label Fields Selection */}
                <div>
                  <Label className="text-xs">Show Fields</Label>
                  <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto border rounded p-2">
                    {LABEL_FIELD_OPTIONS.slice(0, 6).map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${option.value}`}
                          checked={isLabelFieldSelected(option.value)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleLabelFieldToggle(option.value, e.target.checked)
                          }
                        />
                        <Label
                          htmlFor={`field-${option.value}`}
                          className="text-xs font-normal"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edge Type */}
                <div>
                  <Label htmlFor="edgeType" className="text-xs">Routing</Label>
                  <Select
                    id="edgeType"
                    value={localData.edgeType || 'default'}
                    onChange={(e) => handleChange('edgeType', e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="default">Bezier</option>
                    <option value="straight">Straight</option>
                    <option value="step">Step</option>
                    <option value="smoothstep">Smooth Step</option>
                    <option value="simplebezier">Simple Bezier</option>
                  </Select>
                </div>

                {/* Animation */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="animated"
                      checked={localData.animated || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleChange('animated', e.target.checked)
                      }
                    />
                    <Label htmlFor="animated" className="text-xs">Animate</Label>
                  </div>

                  {localData.animated && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="animSpeed" className="text-xs">Speed (s)</Label>
                        <Input
                          id="animSpeed"
                          type="number"
                          min="0.5"
                          max="10"
                          step="0.5"
                          value={localData.animationSpeed || 2}
                          onChange={(e) => handleChange('animationSpeed', parseFloat(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="animColor" className="text-xs">Color</Label>
                        <Input
                          id="animColor"
                          type="color"
                          value={localData.animationColor || '#ff0073'}
                          onChange={(e) => handleChange('animationColor', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </EdgeLabelRenderer>
  );
};

