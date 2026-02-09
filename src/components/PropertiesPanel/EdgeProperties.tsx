import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EdgeMetadata } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';

interface EdgePropertiesProps {
  data: EdgeMetadata;
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

export const EdgeProperties = ({ data }: EdgePropertiesProps) => {
  const { selectedEdgeId, updateEdge } = useFlowStore();
  const [activeTab, setActiveTab] = useState('connection');

  const handleChange = (field: keyof EdgeMetadata, value: any) => {
    if (selectedEdgeId) {
      updateEdge(selectedEdgeId, { [field]: value });
    }
  };

  const handleLabelFieldToggle = (field: string, checked: boolean) => {
    if (!selectedEdgeId) return;
    
    const currentFields = data.labelFields || [];
    const newFields = checked
      ? [...currentFields, field]
      : currentFields.filter((f) => f !== field);
    
    updateEdge(selectedEdgeId, { labelFields: newFields });
  };

  const isLabelFieldSelected = (field: string) => {
    return (data.labelFields || []).includes(field);
  };

  return (
    <Card className="shadow-lg max-h-[calc(100vh-120px)] overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-lg">Connection Properties</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
          </TabsList>

          {/* Connection Info Tab */}
          <TabsContent value="connection" className="space-y-4">
            <div>
              <Label htmlFor="linkType">Link Type</Label>
              <Input
                id="linkType"
                value={data.linkType || ''}
                onChange={(e) => handleChange('linkType', e.target.value)}
                placeholder="Ethernet, Fiber, Wireless"
              />
            </div>

            <div>
              <Label htmlFor="protocol">Protocol</Label>
              <Input
                id="protocol"
                value={data.protocol || ''}
                onChange={(e) => handleChange('protocol', e.target.value)}
                placeholder="TCP, UDP, HTTPS, SSH"
              />
            </div>

            <div>
              <Label htmlFor="dataFlow">Data Flow</Label>
              <Select
                id="dataFlow"
                value={data.dataFlow || 'bidirectional'}
                onChange={(e) => handleChange('dataFlow', e.target.value)}
              >
                <option value="bidirectional">Bidirectional</option>
                <option value="source-to-target">Source to Target</option>
                <option value="target-to-source">Target to Source</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="bandwidth">Bandwidth</Label>
              <Input
                id="bandwidth"
                value={data.bandwidth || ''}
                onChange={(e) => handleChange('bandwidth', e.target.value)}
                placeholder="1 Gbps, 100 Mbps, 10 Gbps"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="portSource">Source Port</Label>
                <Input
                  id="portSource"
                  value={data.portSource || ''}
                  onChange={(e) => handleChange('portSource', e.target.value)}
                  placeholder="8080"
                />
              </div>
              <div>
                <Label htmlFor="portTarget">Target Port</Label>
                <Input
                  id="portTarget"
                  value={data.portTarget || ''}
                  onChange={(e) => handleChange('portTarget', e.target.value)}
                  placeholder="443"
                />
              </div>
            </div>

            {/* Network Configuration */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-sm mb-3">Network Configuration</h4>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="vlanId">VLAN ID</Label>
                  <Input
                    id="vlanId"
                    value={data.vlanId || ''}
                    onChange={(e) => handleChange('vlanId', e.target.value)}
                    placeholder="VLAN 100"
                  />
                </div>

                <div>
                  <Label htmlFor="qosClass">QoS Class</Label>
                  <Select
                    id="qosClass"
                    value={data.qosClass || ''}
                    onChange={(e) => handleChange('qosClass', e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="High Priority">High Priority</option>
                    <option value="Medium Priority">Medium Priority</option>
                    <option value="Best Effort">Best Effort</option>
                    <option value="Background">Background</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="redundancyType">Redundancy Type</Label>
                  <Select
                    id="redundancyType"
                    value={data.redundancyType || ''}
                    onChange={(e) => handleChange('redundancyType', e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="Active-Active">Active-Active</option>
                    <option value="Active-Passive">Active-Passive</option>
                    <option value="Load Balanced">Load Balanced</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="connectionState">Connection State</Label>
                  <Select
                    id="connectionState"
                    value={data.connectionState || 'active'}
                    onChange={(e) => handleChange('connectionState', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="standby">Standby</option>
                    <option value="failed">Failed</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-sm mb-3">Security</h4>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="encryptionProtocol">Encryption Protocol</Label>
                  <Input
                    id="encryptionProtocol"
                    value={data.encryptionProtocol || ''}
                    onChange={(e) => handleChange('encryptionProtocol', e.target.value)}
                    placeholder="TLS 1.3, IPSec, WPA3"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="authenticationRequired"
                      checked={data.authenticationRequired || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleChange('authenticationRequired', e.target.checked)
                      }
                    />
                    <Label htmlFor="authenticationRequired">Authentication Required</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="firewalled"
                      checked={data.firewalled || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleChange('firewalled', e.target.checked)
                      }
                    />
                    <Label htmlFor="firewalled">Firewalled</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="monitored"
                      checked={data.monitored || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleChange('monitored', e.target.checked)
                      }
                    />
                    <Label htmlFor="monitored">Monitored</Label>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div>
              <Label htmlFor="latency">Latency</Label>
              <Input
                id="latency"
                value={data.latency || ''}
                onChange={(e) => handleChange('latency', e.target.value)}
                placeholder="10ms, 50ms, 1s"
              />
            </div>

            <div>
              <Label htmlFor="jitter">Jitter</Label>
              <Input
                id="jitter"
                value={data.jitter || ''}
                onChange={(e) => handleChange('jitter', e.target.value)}
                placeholder="5ms, 10ms"
              />
            </div>

            <div>
              <Label htmlFor="packetLoss">Packet Loss</Label>
              <Input
                id="packetLoss"
                value={data.packetLoss || ''}
                onChange={(e) => handleChange('packetLoss', e.target.value)}
                placeholder="0.01%, 0.1%, 1%"
              />
            </div>

            <div>
              <Label htmlFor="errorRate">Error Rate</Label>
              <Input
                id="errorRate"
                value={data.errorRate || ''}
                onChange={(e) => handleChange('errorRate', e.target.value)}
                placeholder="0.001%, 0.01%"
              />
            </div>
          </TabsContent>

          {/* Visual Settings Tab */}
          <TabsContent value="visual" className="space-y-4">
            <div>
              <Label htmlFor="customLabel">Custom Label</Label>
              <Input
                id="customLabel"
                value={data.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="Custom edge label"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to show selected fields below
              </p>
            </div>

            {/* Label Fields Selection */}
            <div>
              <Label>Display Fields on Edge</Label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {LABEL_FIELD_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`label-field-${option.value}`}
                      checked={isLabelFieldSelected(option.value)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleLabelFieldToggle(option.value, e.target.checked)
                      }
                    />
                    <Label
                      htmlFor={`label-field-${option.value}`}
                      className="text-sm font-normal"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Edge Type */}
            <div>
              <Label htmlFor="edgeType">Edge Routing Style</Label>
              <Select
                id="edgeType"
                value={data.edgeType || 'default'}
                onChange={(e) => handleChange('edgeType', e.target.value)}
              >
                <option value="default">Bezier (Default)</option>
                <option value="straight">Straight</option>
                <option value="step">Step</option>
                <option value="smoothstep">Smooth Step</option>
                <option value="simplebezier">Simple Bezier</option>
              </Select>
            </div>

            {/* Animation Settings */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-sm mb-3">Animation</h4>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="animated"
                    checked={data.animated || false}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange('animated', e.target.checked)
                    }
                  />
                  <Label htmlFor="animated">Animate Data Flow</Label>
                </div>

                {data.animated && (
                  <>
                    <div>
                      <Label htmlFor="animationSpeed">Animation Speed (seconds)</Label>
                      <Input
                        id="animationSpeed"
                        type="number"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={data.animationSpeed || 2}
                        onChange={(e) => handleChange('animationSpeed', parseFloat(e.target.value))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="animationColor">Animation Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="animationColor"
                          type="color"
                          value={data.animationColor || '#ff0073'}
                          onChange={(e) => handleChange('animationColor', e.target.value)}
                          className="w-20 h-10"
                        />
                        <Input
                          value={data.animationColor || '#ff0073'}
                          onChange={(e) => handleChange('animationColor', e.target.value)}
                          placeholder="#ff0073"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
