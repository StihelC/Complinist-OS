import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceNodeData, DeviceType } from '@/lib/utils/types';
import { useState } from 'react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { ControlAssignment } from '@/features/topology/components/DeviceProperties/ControlAssignment';
import { PropertySection } from './PropertySection';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { NetworkSection } from './sections/NetworkSection';
import { HardwareSection } from './sections/HardwareSection';
import { SoftwareSection } from './sections/SoftwareSection';
import { SecuritySection } from './sections/SecuritySection';
import { SecurityPostureSection } from './sections/SecurityPostureSection';
import { ComplianceSection } from './sections/ComplianceSection';
import { OwnershipSection } from './sections/OwnershipSection';

export const DeviceProperties = () => {
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const nodes = useFlowStore((state) => state.nodes);
  const updateNode = useFlowStore((state) => state.updateNode);
  const currentProject = useFlowStore((state) => state.currentProject);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const data = selectedNode?.data as DeviceNodeData;

  if (!data || !selectedNodeId) {
    return null;
  }
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    network: false,
    hardware: false,
    software: false,
    security: false,
    posture: false,
    compliance: false,
    ownership: false,
    controls: true, // Expanded by default for easy control assignment
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (field: keyof DeviceNodeData, value: any) => {
    updateNode(selectedNodeId, { [field]: value });
  };

  const handleIconChange = (iconFilename: string, deviceType: DeviceType, deviceSubtype?: string) => {
    updateNode(selectedNodeId, {
      iconPath: iconFilename,
      deviceType,
      deviceSubtype,
    });
  };

  return (
    <Card className="shadow-lg max-h-[calc(100vh-100px)] overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-lg">Device Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <PropertySection
          title="Basic Information"
          expanded={expandedSections.basic}
          onToggle={() => toggleSection('basic')}
        >
          <BasicInfoSection
            data={data}
            onChange={handleChange}
            onIconChange={handleIconChange}
          />
        </PropertySection>

        {/* Network Info */}
        <PropertySection
          title="Network Information"
          expanded={expandedSections.network}
          onToggle={() => toggleSection('network')}
        >
          <NetworkSection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>

        {/* Hardware Info */}
        <PropertySection
          title="Hardware Information"
          expanded={expandedSections.hardware}
          onToggle={() => toggleSection('hardware')}
        >
          <HardwareSection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>

        {/* Software Info */}
        <PropertySection
          title="Software Information"
          expanded={expandedSections.software}
          onToggle={() => toggleSection('software')}
        >
          <SoftwareSection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>

        {/* Security Classification */}
        <PropertySection
          title="Security Classification"
          expanded={expandedSections.security}
          onToggle={() => toggleSection('security')}
        >
          <SecuritySection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>

        {/* Security Posture */}
        <PropertySection
          title="Security Posture"
          expanded={expandedSections.posture}
          onToggle={() => toggleSection('posture')}
        >
          <SecurityPostureSection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>

        {/* Compliance */}
        <PropertySection
          title="Compliance"
          expanded={expandedSections.compliance}
          onToggle={() => toggleSection('compliance')}
        >
          <ComplianceSection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>

        {/* Controls */}
        <PropertySection
          title="Controls"
          expanded={expandedSections.controls}
          onToggle={() => toggleSection('controls')}
        >
          <ControlAssignment
            baseline={currentProject?.baseline ?? 'MODERATE'}
            assignedControls={data.assignedControls || []}
            controlNotes={data.controlNotes || {}}
            deviceType={data.deviceType}
            onChange={(controls, notes) => {
              handleChange('assignedControls', controls);
              handleChange('controlNotes', notes);
            }}
          />
        </PropertySection>

        {/* Ownership */}
        <PropertySection
          title="Ownership"
          expanded={expandedSections.ownership}
          onToggle={() => toggleSection('ownership')}
        >
          <OwnershipSection
            data={data}
            onChange={handleChange}
          />
        </PropertySection>
      </CardContent>
    </Card>
  );
};


