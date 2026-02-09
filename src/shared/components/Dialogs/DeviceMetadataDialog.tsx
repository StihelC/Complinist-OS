import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceNodeData } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DeviceMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeData: DeviceNodeData;
}

export const DeviceMetadataDialog = ({
  open,
  onOpenChange,
  nodeId,
  nodeData,
}: DeviceMetadataDialogProps) => {
  const updateNode = useFlowStore((state) => state.updateNode);
  const [localData, setLocalData] = useState<DeviceNodeData>(nodeData);
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    network: false,
    hardware: false,
    security: false,
    posture: false,
    compliance: false,
    ownership: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (field: keyof DeviceNodeData, value: any) => {
    setLocalData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Update the node with all the local data changes
    updateNode(nodeId, localData);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset local data to original
    setLocalData(nodeData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Device Metadata</DialogTitle>
          <DialogDescription>
            Update the metadata and processes for {nodeData.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Information */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.basic ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Basic Information</span>
            </button>
            {expandedSections.basic && (
              <div className="p-4 space-y-3 border-t">
                <div>
                  <Label htmlFor="name">Device Name</Label>
                  <Input
                    id="name"
                    value={localData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="deviceType">Device Type</Label>
                  <Input
                    id="deviceType"
                    value={localData.deviceType}
                    disabled
                  />
                </div>
                {localData.deviceSubtype && (
                  <div>
                    <Label htmlFor="deviceSubtype">Device Subtype</Label>
                    <Input
                      id="deviceSubtype"
                      value={localData.deviceSubtype}
                      disabled
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Network Information */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('network')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.network ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Network Configuration</span>
            </button>
            {expandedSections.network && (
              <div className="p-4 space-y-3 border-t">
                <div>
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input
                    id="ipAddress"
                    value={localData.ipAddress || ''}
                    onChange={(e) => handleChange('ipAddress', e.target.value)}
                    placeholder="192.168.1.1"
                  />
                </div>
                <div>
                  <Label htmlFor="macAddress">MAC Address</Label>
                  <Input
                    id="macAddress"
                    value={localData.macAddress || ''}
                    onChange={(e) => handleChange('macAddress', e.target.value)}
                    placeholder="00:1A:2B:3C:4D:5E"
                  />
                </div>
                <div>
                  <Label htmlFor="subnetMask">Subnet Mask</Label>
                  <Input
                    id="subnetMask"
                    value={localData.subnetMask || ''}
                    onChange={(e) => handleChange('subnetMask', e.target.value)}
                    placeholder="255.255.255.0"
                  />
                </div>
                <div>
                  <Label htmlFor="defaultGateway">Default Gateway</Label>
                  <Input
                    id="defaultGateway"
                    value={localData.defaultGateway || ''}
                    onChange={(e) => handleChange('defaultGateway', e.target.value)}
                    placeholder="192.168.1.1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Hardware Information */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('hardware')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.hardware ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Hardware Details</span>
            </button>
            {expandedSections.hardware && (
              <div className="p-4 space-y-3 border-t">
                <div>
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={localData.manufacturer || ''}
                    onChange={(e) => handleChange('manufacturer', e.target.value)}
                    placeholder="Cisco, Dell, HP..."
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={localData.model || ''}
                    onChange={(e) => handleChange('model', e.target.value)}
                    placeholder="Model number"
                  />
                </div>
                <div>
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    value={localData.serialNumber || ''}
                    onChange={(e) => handleChange('serialNumber', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="operatingSystem">Operating System</Label>
                  <Input
                    id="operatingSystem"
                    value={localData.operatingSystem || ''}
                    onChange={(e) => handleChange('operatingSystem', e.target.value)}
                    placeholder="Windows, Linux, iOS..."
                  />
                </div>
                <div>
                  <Label htmlFor="osVersion">OS Version</Label>
                  <Input
                    id="osVersion"
                    value={localData.osVersion || ''}
                    onChange={(e) => handleChange('osVersion', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Security Classification */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('security')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.security ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Security Classification</span>
            </button>
            {expandedSections.security && (
              <div className="p-4 space-y-3 border-t">
                <div>
                  <Label htmlFor="securityZone">Security Zone</Label>
                  <select
                    id="securityZone"
                    value={localData.securityZone || ''}
                    onChange={(e) => handleChange('securityZone', e.target.value || undefined)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select...</option>
                    <option value="untrusted">Untrusted</option>
                    <option value="dmz">DMZ</option>
                    <option value="trusted">Trusted</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="assetValue">Asset Value</Label>
                  <select
                    id="assetValue"
                    value={localData.assetValue || ''}
                    onChange={(e) => handleChange('assetValue', e.target.value || undefined)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select...</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="missionCritical"
                    checked={localData.missionCritical || false}
                    onChange={(e) => handleChange('missionCritical', e.target.checked)}
                  />
                  <Label htmlFor="missionCritical">Mission Critical</Label>
                </div>
                <div>
                  <Label htmlFor="dataClassification">Data Classification</Label>
                  <Input
                    id="dataClassification"
                    value={localData.dataClassification || ''}
                    onChange={(e) => handleChange('dataClassification', e.target.value)}
                    placeholder="Public, Confidential, Secret..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Security Posture */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('posture')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.posture ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Security Posture</span>
            </button>
            {expandedSections.posture && (
              <div className="p-4 space-y-3 border-t">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="multifactorAuth"
                    checked={localData.multifactorAuth || false}
                    onChange={(e) => handleChange('multifactorAuth', e.target.checked)}
                  />
                  <Label htmlFor="multifactorAuth">Multi-Factor Authentication</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="encryptionAtRest"
                    checked={localData.encryptionAtRest || false}
                    onChange={(e) => handleChange('encryptionAtRest', e.target.checked)}
                  />
                  <Label htmlFor="encryptionAtRest">Encryption at Rest</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="encryptionInTransit"
                    checked={localData.encryptionInTransit || false}
                    onChange={(e) => handleChange('encryptionInTransit', e.target.checked)}
                  />
                  <Label htmlFor="encryptionInTransit">Encryption in Transit</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="backupsConfigured"
                    checked={localData.backupsConfigured || false}
                    onChange={(e) => handleChange('backupsConfigured', e.target.checked)}
                  />
                  <Label htmlFor="backupsConfigured">Backups Configured</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="monitoringEnabled"
                    checked={localData.monitoringEnabled || false}
                    onChange={(e) => handleChange('monitoringEnabled', e.target.checked)}
                  />
                  <Label htmlFor="monitoringEnabled">Monitoring Enabled</Label>
                </div>
                <div>
                  <Label htmlFor="vulnerabilityManagement">Vulnerability Management</Label>
                  <select
                    id="vulnerabilityManagement"
                    value={localData.vulnerabilityManagement || ''}
                    onChange={(e) => handleChange('vulnerabilityManagement', e.target.value || undefined)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select...</option>
                    <option value="none">None</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="continuous">Continuous</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Compliance */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('compliance')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.compliance ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Compliance</span>
            </button>
            {expandedSections.compliance && (
              <div className="p-4 space-y-3 border-t">
                <div>
                  <Label htmlFor="complianceStatus">Compliance Status</Label>
                  <select
                    id="complianceStatus"
                    value={localData.complianceStatus || ''}
                    onChange={(e) => handleChange('complianceStatus', e.target.value || undefined)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select...</option>
                    <option value="compliant">Compliant</option>
                    <option value="non-compliant">Non-Compliant</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="lastVulnScan">Last Vulnerability Scan</Label>
                  <Input
                    id="lastVulnScan"
                    type="date"
                    value={localData.lastVulnScan || ''}
                    onChange={(e) => handleChange('lastVulnScan', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="applicableControls">Applicable Controls (comma-separated)</Label>
                  <Input
                    id="applicableControls"
                    value={localData.applicableControls?.join(', ') || ''}
                    onChange={(e) => handleChange('applicableControls', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="AC-1, AC-2, SC-7..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ownership */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleSection('ownership')}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {expandedSections.ownership ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="font-semibold">Ownership & Location</span>
            </button>
            {expandedSections.ownership && (
              <div className="p-4 space-y-3 border-t">
                <div>
                  <Label htmlFor="systemOwner">System Owner</Label>
                  <Input
                    id="systemOwner"
                    value={localData.systemOwner || ''}
                    onChange={(e) => handleChange('systemOwner', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={localData.department || ''}
                    onChange={(e) => handleChange('department', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={localData.contactEmail || ''}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={localData.location || ''}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder="Building, Room, Datacenter..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

