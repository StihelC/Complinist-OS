import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, ChevronRight, Ban, ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Maximize2 } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import {
  DeviceNodeData,
  DeviceType,
  BoundaryNodeData,
  EdgeMetadata,
  DeviceAlignment,
  LabelPosition,
  LabelPlacement,
} from '@/lib/utils/types';
import { DeviceBasicTab } from '../Nodes/toolbar/DeviceBasicTab';
import { DeviceNetworkTab } from '../Nodes/toolbar/DeviceNetworkTab';
import { DeviceSoftwareTab } from '../Nodes/toolbar/DeviceSoftwareTab';
import { DeviceSecurityTab } from '../Nodes/toolbar/DeviceSecurityTab';
import { DeviceComplianceTab } from '../Nodes/toolbar/DeviceComplianceTab';
import { DeviceVisualTab } from '../Nodes/toolbar/DeviceVisualTab';
import { applyDagreLayout } from '@/lib/layout/dagreLayout';
import {
  calculateOptimalSize,
  deviceAlignmentToLayoutDirection,
  BOUNDARY_SIZING_DEFAULTS,
} from '@/lib/topology/boundary-sizing';
import { calculateNestingDepth } from '@/lib/utils/utils';

// Panel sizing configuration
const PANEL_CONFIG = {
  width: 380,
  minWidth: 320,
  maxWidth: 450,
  height: 420,
  minHeight: 300,
  topOffset: 70,
  rightOffset: 16,
} as const;

// Available fields for edge label display
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

export const FixedPropertiesPanel = () => {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNode,
    updateEdge,
    globalSettings,
    setGlobalSettings,
    setNodes,
    setSelectedNodeId,
    setSelectedEdgeId,
  } = useFlowStore();

  // Determine what's selected
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null;

  const selectionType: 'device' | 'boundary' | 'edge' | null = selectedNode
    ? selectedNode.type === 'boundary'
      ? 'boundary'
      : 'device'
    : selectedEdge
      ? 'edge'
      : null;

  // Get connection name for edges (source -> target)
  const getConnectionName = (): string => {
    if (!selectedEdge) return '';
    const edgeData = (selectedEdge.data || {}) as EdgeMetadata;
    if (edgeData.label) return edgeData.label;

    const sourceNode = nodes.find((n) => n.id === selectedEdge.source);
    const targetNode = nodes.find((n) => n.id === selectedEdge.target);
    const sourceName = (sourceNode?.data as DeviceNodeData)?.name || (sourceNode?.data as BoundaryNodeData)?.label || 'Source';
    const targetName = (targetNode?.data as DeviceNodeData)?.name || (targetNode?.data as BoundaryNodeData)?.label || 'Target';
    return `${sourceName} → ${targetName}`;
  };

  // Don't render if nothing is selected
  if (!selectionType) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: `${PANEL_CONFIG.topOffset}px`,
        right: `${PANEL_CONFIG.rightOffset}px`,
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
        {selectionType === 'device' && selectedNode && (
          <DevicePropertiesContent
            key={selectedNode.id}
            nodeId={selectedNode.id}
            data={selectedNode.data as DeviceNodeData}
            updateNode={updateNode}
            globalSettings={globalSettings}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
        {selectionType === 'boundary' && selectedNode && (
          <BoundaryPropertiesContent
            key={selectedNode.id}
            nodeId={selectedNode.id}
            data={selectedNode.data as BoundaryNodeData}
            nodes={nodes}
            edges={edges}
            updateNode={updateNode}
            globalSettings={globalSettings}
            setGlobalSettings={setGlobalSettings}
            setNodes={setNodes}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
        {selectionType === 'edge' && selectedEdge && (
          <EdgePropertiesContent
            key={selectedEdge.id}
            edgeId={selectedEdge.id}
            data={(selectedEdge.data || {}) as EdgeMetadata}
            updateEdge={updateEdge}
            onClose={() => setSelectedEdgeId(null)}
            connectionName={getConnectionName()}
          />
        )}
      </Card>
    </div>
  );
};

// Device Properties Content
interface DevicePropertiesContentProps {
  nodeId: string;
  data: DeviceNodeData;
  updateNode: (nodeId: string, data: Partial<DeviceNodeData>) => void;
  globalSettings: any;
  onClose: () => void;
}

const DevicePropertiesContent = ({
  nodeId,
  data,
  updateNode,
  globalSettings,
  onClose,
}: DevicePropertiesContentProps) => {
  const [localData, setLocalData] = useState<DeviceNodeData>(data);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    setLocalData(data);
  }, [data]);

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
      deviceSubtype: deviceSubtype || undefined,
    };
    setLocalData(updatedData);
    updateNode(nodeId, {
      iconPath: iconFilename,
      deviceType,
      deviceSubtype: deviceSubtype || undefined,
    });
  };

  return (
    <>
      <CardHeader className="pb-3 properties-panel-header flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Device Settings</CardTitle>
          <p className="text-sm text-muted-foreground truncate max-w-[280px]">{data.name || 'Unnamed Device'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="overflow-y-auto properties-panel-content" style={{ height: 'calc(100% - 52px)' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full flex-wrap gap-1 mb-3 p-1">
            <TabsTrigger value="basic" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">
              Basic
            </TabsTrigger>
            <TabsTrigger value="network" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">
              Network
            </TabsTrigger>
            <TabsTrigger value="software" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">
              Software
            </TabsTrigger>
            <TabsTrigger value="security" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">
              Security
            </TabsTrigger>
            <TabsTrigger value="compliance" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">
              Compliance
            </TabsTrigger>
            <TabsTrigger value="visual" className="text-[10px] px-2 py-1 min-w-0 flex-shrink">
              Visual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3">
            <DeviceBasicTab data={localData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="network" className="space-y-3">
            <DeviceNetworkTab data={localData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="software" className="space-y-3">
            <DeviceSoftwareTab data={localData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="security" className="space-y-3">
            <DeviceSecurityTab data={localData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="compliance" className="space-y-3">
            <DeviceComplianceTab data={localData} onChange={handleChange} />
          </TabsContent>

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
    </>
  );
};

// Edge Properties Content
interface EdgePropertiesContentProps {
  edgeId: string;
  data: EdgeMetadata;
  updateEdge: (edgeId: string, data: Partial<EdgeMetadata>) => void;
  onClose: () => void;
  connectionName: string;
}

const EdgePropertiesContent = ({ edgeId, data, updateEdge, onClose, connectionName }: EdgePropertiesContentProps) => {
  const [localData, setLocalData] = useState<EdgeMetadata>(data);
  const [activeTab, setActiveTab] = useState('connection');

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleChange = (field: keyof EdgeMetadata, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    updateEdge(edgeId, { [field]: value });
  };

  const handleLabelFieldToggle = (field: string, checked: boolean) => {
    const currentFields = localData.labelFields || [];
    const newFields = checked ? [...currentFields, field] : currentFields.filter((f) => f !== field);

    const newData = { ...localData, labelFields: newFields };
    setLocalData(newData);
    updateEdge(edgeId, { labelFields: newFields });
  };

  const isLabelFieldSelected = (field: string) => {
    return (localData.labelFields || []).includes(field);
  };

  return (
    <>
      <CardHeader className="pb-3 properties-panel-header flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Connection Settings</CardTitle>
          <p className="text-sm text-muted-foreground truncate max-w-[280px]">{connectionName}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="overflow-y-auto properties-panel-content" style={{ height: 'calc(100% - 52px)' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="connection" className="text-xs">
              Info
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">
              Perf
            </TabsTrigger>
            <TabsTrigger value="visual" className="text-xs">
              Visual
            </TabsTrigger>
          </TabsList>

          {/* Connection Info Tab */}
          <TabsContent value="connection" className="space-y-3">
            <div>
              <Label htmlFor="linkType" className="text-xs">
                Link Type
              </Label>
              <Input
                id="linkType"
                value={localData.linkType || ''}
                onChange={(e) => handleChange('linkType', e.target.value)}
                placeholder="Ethernet, Fiber, Wireless"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="protocol" className="text-xs">
                Protocol
              </Label>
              <Input
                id="protocol"
                value={localData.protocol || ''}
                onChange={(e) => handleChange('protocol', e.target.value)}
                placeholder="TCP, UDP, HTTPS"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="bandwidth" className="text-xs">
                Bandwidth
              </Label>
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
                <Label htmlFor="portSource" className="text-xs">
                  Src Port
                </Label>
                <Input
                  id="portSource"
                  value={localData.portSource || ''}
                  onChange={(e) => handleChange('portSource', e.target.value)}
                  placeholder="8080"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="portTarget" className="text-xs">
                  Dst Port
                </Label>
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
              <Label htmlFor="vlanId" className="text-xs">
                VLAN ID
              </Label>
              <Input
                id="vlanId"
                value={localData.vlanId || ''}
                onChange={(e) => handleChange('vlanId', e.target.value)}
                placeholder="VLAN 100"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="connectionState" className="text-xs">
                State
              </Label>
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
                <Label htmlFor="encrypted" className="text-xs">
                  Encrypted
                </Label>
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('monitored', e.target.checked)}
              />
              <Label htmlFor="monitored" className="text-xs">
                Monitored
              </Label>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-3">
            <div>
              <Label htmlFor="latency" className="text-xs">
                Latency
              </Label>
              <Input
                id="latency"
                value={localData.latency || ''}
                onChange={(e) => handleChange('latency', e.target.value)}
                placeholder="10ms"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="jitter" className="text-xs">
                Jitter
              </Label>
              <Input
                id="jitter"
                value={localData.jitter || ''}
                onChange={(e) => handleChange('jitter', e.target.value)}
                placeholder="5ms"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="packetLoss" className="text-xs">
                Packet Loss
              </Label>
              <Input
                id="packetLoss"
                value={localData.packetLoss || ''}
                onChange={(e) => handleChange('packetLoss', e.target.value)}
                placeholder="0.01%"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="errorRate" className="text-xs">
                Error Rate
              </Label>
              <Input
                id="errorRate"
                value={localData.errorRate || ''}
                onChange={(e) => handleChange('errorRate', e.target.value)}
                placeholder="0.001%"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="qosClass" className="text-xs">
                QoS Class
              </Label>
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
              <Label htmlFor="customLabel" className="text-xs">
                Custom Label
              </Label>
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
                    <Label htmlFor={`field-${option.value}`} className="text-xs font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Edge Type */}
            <div>
              <Label htmlFor="edgeType" className="text-xs">
                Routing
              </Label>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('animated', e.target.checked)}
                />
                <Label htmlFor="animated" className="text-xs">
                  Animate
                </Label>
              </div>

              {localData.animated && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="animSpeed" className="text-xs">
                      Speed (s)
                    </Label>
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
                    <Label htmlFor="animColor" className="text-xs">
                      Color
                    </Label>
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
    </>
  );
};

// Boundary Properties Content
interface BoundaryPropertiesContentProps {
  nodeId: string;
  data: BoundaryNodeData;
  nodes: any[];
  edges: any[];
  updateNode: (nodeId: string, data: Partial<BoundaryNodeData>) => void;
  globalSettings: any;
  setGlobalSettings: (settings: any) => void;
  setNodes: (nodes: any[] | ((nodes: any[]) => any[])) => void;
  onClose: () => void;
}

const BoundaryPropertiesContent = ({
  nodeId,
  data,
  nodes,
  edges,
  updateNode,
  globalSettings,
  setGlobalSettings,
  setNodes,
  onClose,
}: BoundaryPropertiesContentProps) => {
  const [activeTab, setActiveTab] = useState('layout');
  const [boundaryLabel, setBoundaryLabel] = useState<string>(data.label || 'Boundary');
  const [deviceAlignment, setDeviceAlignment] = useState<DeviceAlignment>(data.deviceAlignment || 'none');
  const [nodeSpacing, setNodeSpacing] = useState<number>(data.nodeSpacing || 50);

  // Visual customization state
  const [customColor, setCustomColor] = useState<string>(data.customColor || '');
  const [useDefaultColor, setUseDefaultColor] = useState<boolean>(!data.customColor);
  const [labelPosition, setLabelPosition] = useState<LabelPosition>(data.labelPosition || 'bottom-center');
  const [labelPlacement, setLabelPlacement] = useState<LabelPlacement>(data.labelPlacement || 'outside');
  const [labelSpacing, setLabelSpacing] = useState<number>(data.labelSpacing || 8);
  const [labelOffset, setLabelOffset] = useState<number>(data.labelOffset || 0);
  const [borderStrokeWidth, setBorderStrokeWidth] = useState<number>(data.borderStrokeWidth || 2);
  const [borderDashArray, setBorderDashArray] = useState<string>(data.borderDashArray || '5,5');
  const [borderRadius, setBorderRadius] = useState<number>(data.borderRadius || 12);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(data.backgroundOpacity ?? 20);
  const [padding, setPadding] = useState<number>(data.padding || 4);
  const [labelBackgroundColor, setLabelBackgroundColor] = useState<string>(data.labelBackgroundColor || 'auto');
  const [labelTextColor, setLabelTextColor] = useState<string>(data.labelTextColor || 'auto');

  // Auto-resize state
  const [autoResize, setAutoResize] = useState<boolean>(Boolean(data.autoResize));
  const [autoResizePadding, setAutoResizePadding] = useState<number>(
    Number(data.autoResizePadding) || BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING
  );

  const storeNode = nodes.find((n) => n.id === nodeId);

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

    if (deviceAlignment !== 'none') {
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
  }, [deviceAlignment, nodeSpacing]);

  const handleReset = () => {
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
    setAutoResize(false);
    setAutoResizePadding(BOUNDARY_SIZING_DEFAULTS.DEFAULT_PADDING);
  };

  const handleAutoResize = useCallback(() => {
    const boundaryNode = nodes.find((n) => n.id === nodeId);
    if (!boundaryNode) return;

    const childNodes = nodes.filter((n) => n.parentId === nodeId);
    const layoutDirection = deviceAlignmentToLayoutDirection(deviceAlignment);

    const result = calculateOptimalSize(boundaryNode, childNodes, layoutDirection, { padding: autoResizePadding });

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

  return (
    <>
      <CardHeader className="pb-3 properties-panel-header flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Boundary Settings</CardTitle>
          {nestingPath.length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted-foreground truncate max-w-[280px]">{data.label || 'Unnamed Boundary'}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="overflow-y-auto properties-panel-content" style={{ height: 'calc(100% - 52px)' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full gap-1 mb-3 p-1">
            <TabsTrigger value="layout" className="text-[10px] px-2 py-1 min-w-0 flex-1">
              Layout
            </TabsTrigger>
            <TabsTrigger value="visual" className="text-[10px] px-2 py-1 min-w-0 flex-1">
              Visual
            </TabsTrigger>
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

              <Button onClick={handleAutoResize} variant="outline" className="w-full" size="sm">
                <Maximize2 className="w-4 h-4 mr-2" />
                Fit to Contents
              </Button>
            </div>
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
            <Button onClick={handleReset} variant="outline" className="w-full" size="sm">
              Reset to Defaults
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  );
};
