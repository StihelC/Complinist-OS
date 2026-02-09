// Context Builder
// Transforms topology data into AI-ready context for control narratives

import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';
import type { TopologyContext } from './types';

export function buildTopologyContext(
  nodes: AppNode[],
  _edges: AppEdge[],
  selectedDeviceIds?: string[],
  selectedBoundaryIds?: string[]
): TopologyContext {
  // const analysis = analyzeTopology(nodes, edges); // Unused - kept for potential future use

  // Filter selected devices if provided
  const deviceNodes = nodes.filter((node) => {
    if (node.type !== 'device' && node.type) return false;
    if (selectedDeviceIds && selectedDeviceIds.length > 0) {
      return selectedDeviceIds.includes(node.id);
    }
    return true;
  });

  // Filter selected boundaries if provided
  const boundaryNodes = nodes.filter((node) => {
    if (node.type !== 'boundary') return false;
    if (selectedBoundaryIds && selectedBoundaryIds.length > 0) {
      return selectedBoundaryIds.includes(node.id);
    }
    return true;
  });

  // Build device summaries
  const selectedDevices = deviceNodes.map((node) => {
    const data = node.data as DeviceNodeData;
    const boundaryId = node.parentId || data.boundaryId || null;
    const boundaryNode = boundaryId ? nodes.find((n) => n.id === boundaryId) : null;
    const boundaryData = boundaryNode?.data as BoundaryNodeData | undefined;

    return {
      id: node.id,
      name: data.name || data.hostname || `Device ${node.id}`,
      type: (data.deviceType || 'unknown') as string,
      os: data.operatingSystem || undefined,
      zone: (data.securityZone || boundaryData?.zoneType || undefined) as string | undefined,
      riskLevel: data.riskLevel || undefined,
      encryptionStatus: data.encryptionStatus || (data.encryptionAtRest ? 'Enabled' : undefined),
      securityNotes: data.notes || (typeof data.securityNotes === 'string' ? data.securityNotes : (data.securityNotes ? JSON.stringify(data.securityNotes) : undefined)),
    };
  });

  // Build boundary summaries
  const selectedBoundaries = boundaryNodes.map((node) => {
    const data = node.data as BoundaryNodeData;
    return {
      id: node.id,
      label: data.label || `Boundary ${node.id}`,
      type: data.type,
      zoneType: data.zoneType || undefined,
    };
  });

  // Calculate device counts by type for selected devices
  const devicesByType: Record<string, number> = {};
  selectedDevices.forEach((device) => {
    devicesByType[device.type] = (devicesByType[device.type] || 0) + 1;
  });

  // Extract zones from selected devices and boundaries
  const zones = new Set<string>();
  selectedDevices.forEach((device) => {
    if (device.zone) zones.add(device.zone);
  });
  selectedBoundaries.forEach((boundary) => {
    if (boundary.zoneType) zones.add(boundary.zoneType);
  });

  // Calculate security metrics for selected devices
  const securityMetrics = {
    mfaEnabled: selectedDevices.filter((d) => {
      const node = deviceNodes.find((n) => n.id === d.id);
      return node ? (node.data as DeviceNodeData).multifactorAuth : false;
    }).length,
    encryptionAtRest: selectedDevices.filter((d) => {
      const node = deviceNodes.find((n) => n.id === d.id);
      return node ? (node.data as DeviceNodeData).encryptionAtRest : false;
    }).length,
    encryptionInTransit: selectedDevices.filter((d) => {
      const node = deviceNodes.find((n) => n.id === d.id);
      return node ? (node.data as DeviceNodeData).encryptionInTransit : false;
    }).length,
    backupsConfigured: selectedDevices.filter((d) => {
      const node = deviceNodes.find((n) => n.id === d.id);
      return node ? (node.data as DeviceNodeData).backupsConfigured : false;
    }).length,
  };

  return {
    deviceCount: selectedDevices.length,
    devicesByType,
    zones: Array.from(zones),
    securityMetrics,
    selectedDevices,
    selectedBoundaries,
  };
}

export function buildTopologySummary(context: TopologyContext): string {
  const lines: string[] = [];

  lines.push(`Total devices: ${context.deviceCount}`);
  
  if (Object.keys(context.devicesByType).length > 0) {
    const typeSummary = Object.entries(context.devicesByType)
      .map(([type, count]) => `${type} x${count}`)
      .join(', ');
    lines.push(`Device types: ${typeSummary}`);
  }

  if (context.zones.length > 0) {
    lines.push(`Security zones: ${context.zones.join(', ')}`);
  }

  const { securityMetrics } = context;
  if (context.deviceCount > 0) {
    const mfaPct = Math.round((securityMetrics.mfaEnabled / context.deviceCount) * 100);
    const encryptionPct = Math.round((securityMetrics.encryptionAtRest / context.deviceCount) * 100);
    const backupPct = Math.round((securityMetrics.backupsConfigured / context.deviceCount) * 100);
    
    lines.push(`MFA coverage: ${mfaPct}% (${securityMetrics.mfaEnabled}/${context.deviceCount} devices)`);
    lines.push(`Encryption at rest: ${encryptionPct}% (${securityMetrics.encryptionAtRest}/${context.deviceCount} devices)`);
    lines.push(`Backups configured: ${backupPct}% (${securityMetrics.backupsConfigured}/${context.deviceCount} devices)`);
  }

  return lines.join('\n');
}

export function buildDeviceDetails(context: TopologyContext): string {
  if (context.selectedDevices.length === 0) {
    return 'No devices selected.';
  }

  const lines: string[] = [];
  lines.push('Selected Devices:');
  lines.push('');

  context.selectedDevices.forEach((device) => {
    lines.push(`- ${device.name} (${device.type})`);
    if (device.os) lines.push(`  OS: ${device.os}`);
    if (device.zone) lines.push(`  Zone: ${device.zone}`);
    if (device.riskLevel) lines.push(`  Risk Level: ${device.riskLevel}`);
    if (device.encryptionStatus) lines.push(`  Encryption: ${device.encryptionStatus}`);
    if (device.securityNotes) lines.push(`  Notes: ${device.securityNotes}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function buildBoundaryDetails(context: TopologyContext): string {
  if (context.selectedBoundaries.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('Selected Boundaries:');
  lines.push('');

  context.selectedBoundaries.forEach((boundary) => {
    lines.push(`- ${boundary.label} (${boundary.type})`);
    if (boundary.zoneType) lines.push(`  Zone Type: ${boundary.zoneType}`);
    lines.push('');
  });

  return lines.join('\n');
}

