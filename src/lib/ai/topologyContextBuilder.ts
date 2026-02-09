// Topology Context Builder
// Builds comprehensive topology context from both in-memory state and SQL database
// Used by AI assistant to answer questions about devices, connections, and controls

import type { AppNode, DeviceNodeData } from '@/lib/utils/types';
import { getFlowStoreState } from '@/core/stores/flowStoreAccessor';

export interface TopologyContext {
  devices: DeviceInfo[];
  connections: ConnectionInfo[];
  boundaryDevices: BoundaryInfo[];
  summary: {
    totalDevices: number;
    totalConnections: number;
    deviceTypes: Record<string, number>;
    securityZones: string[];
  };
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  ipAddress?: string;
  manufacturer?: string;
  model?: string;
  securityZone?: string;
  applicableControls?: string[];
  assignedControls?: string[];
  encryptionEnabled?: boolean;
  firewallEnabled?: boolean;
  metadata: Record<string, any>;
}

export interface ConnectionInfo {
  id: string;
  source: string;
  target: string;
  sourceDevice: string;
  targetDevice: string;
  protocol?: string;
  port?: string;
  encrypted?: boolean;
  dataFlow?: string;
  label?: string;
}

export interface BoundaryInfo {
  id: string;
  name: string;
  type: string;
  devices: string[];
}

/**
 * Build comprehensive topology context from both sources
 */
export async function buildTopologyContext(
  projectId: number | null,
  _query?: string
): Promise<TopologyContext> {
  // Get in-memory state using the flowStoreAccessor
  // This avoids circular dependencies by using a registered store reference
  const flowStore = getFlowStoreState();
  const { nodes, edges } = flowStore;

  // Filter device nodes and boundary nodes
  const deviceNodes = nodes.filter((n) => n.type === 'device') as AppNode[];
  const boundaryNodes = nodes.filter((n) => n.type === 'boundary') as AppNode[];

  // Build device info from in-memory state
  const devices: DeviceInfo[] = deviceNodes.map((node) => {
    const data = node.data as DeviceNodeData;
    return {
      id: node.id,
      name: data.name || node.id,
      type: data.deviceType || 'unknown',
      subtype: data.deviceSubtype,
      ipAddress: data.ipAddress,
      manufacturer: data.manufacturer,
      model: data.model,
      securityZone: data.securityZone,
      applicableControls: data.applicableControls,
      assignedControls: data.assignedControls,
      encryptionEnabled: data.encryptionAtRest || data.encryptionInTransit,
      firewallEnabled: data.firewallEnabled,
      metadata: {
        hostname: data.hostname,
        operatingSystem: data.operatingSystem,
        osVersion: data.osVersion,
        missionCritical: data.missionCritical,
        dataClassification: data.dataClassification,
        owner: data.owner || data.systemOwner,
        department: data.department,
        location: data.location,
        status: data.status,
      },
    };
  });

  // Build connection info
  const connections: ConnectionInfo[] = edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    const edgeData = edge.data as any;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceDevice: (sourceNode?.data as any)?.name || edge.source,
      targetDevice: (targetNode?.data as any)?.name || edge.target,
      protocol: edgeData?.protocol,
      port: edgeData?.port ? String(edgeData.port) : undefined,
      encrypted: edgeData?.encrypted,
      dataFlow: edgeData?.dataFlow,
      label: edgeData?.label || edge.label as string | undefined,
    };
  });

  // Build boundary info
  const boundaryDevices: BoundaryInfo[] = boundaryNodes.map((node) => {
    const data = node.data as any;
    return {
      id: node.id,
      name: data.name || node.id,
      type: data.boundaryType || 'boundary',
      devices: [], // TODO: Determine which devices are inside boundary based on position
    };
  });

  // Calculate summary statistics
  const deviceTypes: Record<string, number> = {};
  const securityZonesSet = new Set<string>();

  devices.forEach((device) => {
    // Count device types
    deviceTypes[device.type] = (deviceTypes[device.type] || 0) + 1;

    // Collect security zones
    if (device.securityZone) {
      securityZonesSet.add(device.securityZone);
    }
  });

  // If projectId is provided, enhance with SQL database data
  if (projectId && typeof window !== 'undefined' && window.electronAPI) {
    try {
      const dbDevices = await window.electronAPI.queryDevices({
        projectId,
      });

      // Merge database metadata into devices
      devices.forEach((device) => {
        const dbDevice = dbDevices.find((d: any) => d.id === device.id);
        if (dbDevice) {
          // Enhance with additional database fields
          device.metadata = {
            ...device.metadata,
            serialNumber: dbDevice.serial_number,
            firmwareVersion: dbDevice.firmware_version,
            software: dbDevice.software,
            cpuModel: dbDevice.cpu_model,
            memorySize: dbDevice.memory_size,
            storageSize: dbDevice.storage_size,
            assetValue: dbDevice.asset_value,
            lastPatchDate: dbDevice.last_patch_date,
            patchLevel: dbDevice.patch_level,
            lastVulnScan: dbDevice.last_vuln_scan,
            complianceStatus: dbDevice.compliance_status,
            notes: dbDevice.notes,
            tags: dbDevice.tags ? (typeof dbDevice.tags === 'string' ? JSON.parse(dbDevice.tags) : dbDevice.tags) : [],
          };

          // Parse applicable controls if stored as JSON
          if (dbDevice.applicable_controls) {
            try {
              device.applicableControls = typeof dbDevice.applicable_controls === 'string' ? JSON.parse(dbDevice.applicable_controls) : dbDevice.applicable_controls;
            } catch (e) {
              // Keep existing value
            }
          }

          // Parse assigned controls if stored as JSON
          if (dbDevice.assigned_controls) {
            try {
              device.assignedControls = typeof dbDevice.assigned_controls === 'string' ? JSON.parse(dbDevice.assigned_controls) : dbDevice.assigned_controls;
            } catch (e) {
              // Keep existing value
            }
          }
        }
      });
    } catch (error) {
      console.warn('[Topology Context] Failed to query database:', error);
      // Continue with in-memory data only
    }
  }

  return {
    devices,
    connections,
    boundaryDevices,
    summary: {
      totalDevices: devices.length,
      totalConnections: connections.length,
      deviceTypes,
      securityZones: Array.from(securityZonesSet),
    },
  };
}

/**
 * Get connections for a specific device
 */
export function getConnectionsForDevice(
  deviceId: string,
  context: TopologyContext
): ConnectionInfo[] {
  return context.connections.filter(
    (conn) => conn.source === deviceId || conn.target === deviceId
  );
}

/**
 * Query devices by filters
 */
export async function queryDevicesByFilters(
  projectId: number,
  filters: {
    deviceType?: string;
    manufacturer?: string;
    location?: string;
    securityZone?: string;
    ipAddress?: string;
    status?: string;
  }
): Promise<DeviceInfo[]> {
  if (!window.electronAPI) {
    console.warn('[Topology Context] Electron API not available');
    return [];
  }

  try {
    const dbDevices = await window.electronAPI.queryDevices({
      projectId,
      ...filters,
    });

    return dbDevices.map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.device_type,
      subtype: d.device_subtype || undefined,
      ipAddress: d.ip_address || undefined,
      manufacturer: d.manufacturer || undefined,
      model: d.model || undefined,
      securityZone: d.security_zone || undefined,
      applicableControls: d.applicable_controls
        ? JSON.parse(d.applicable_controls)
        : undefined,
      assignedControls: d.assigned_controls
        ? JSON.parse(d.assigned_controls)
        : undefined,
      encryptionEnabled: d.encryption_at_rest === 1 || d.encryption_in_transit === 1,
      firewallEnabled: d.firewall_enabled === 1,
      metadata: {
        hostname: d.hostname,
        operatingSystem: d.operating_system,
        osVersion: d.os_version,
        missionCritical: d.mission_critical === 1,
        dataClassification: d.data_classification,
        owner: d.owner || d.system_owner,
        department: d.department,
        location: d.location,
        status: d.status,
        serialNumber: d.serial_number,
        firmwareVersion: d.firmware_version,
        notes: d.notes,
      },
    }));
  } catch (error) {
    console.error('[Topology Context] Query devices failed:', error);
    return [];
  }
}

/**
 * Get applicable NIST controls for a device
 */
export function getApplicableControls(device: DeviceInfo): string[] {
  const controls = new Set<string>();

  // Add from applicableControls field
  if (device.applicableControls) {
    device.applicableControls.forEach((c) => controls.add(c));
  }

  // Add from assignedControls field
  if (device.assignedControls) {
    device.assignedControls.forEach((c) => controls.add(c));
  }

  return Array.from(controls);
}

/**
 * Extract topology-relevant information from query
 */
export function extractTopologyRelevantInfo(query: string): {
  asksAboutDevices: boolean;
  asksAboutConnections: boolean;
  asksAboutControls: boolean;
  mentionedDeviceNames: string[];
  mentionedControlIds: string[];
} {
  const lowerQuery = query.toLowerCase();

  // Check what the query is asking about
  const asksAboutDevices =
    lowerQuery.includes('device') ||
    lowerQuery.includes('server') ||
    lowerQuery.includes('firewall') ||
    lowerQuery.includes('router') ||
    lowerQuery.includes('workstation') ||
    lowerQuery.includes('on the canvas') ||
    lowerQuery.includes('in the topology') ||
    lowerQuery.includes('in the diagram');

  const asksAboutConnections =
    lowerQuery.includes('connection') ||
    lowerQuery.includes('connect') ||
    lowerQuery.includes('link') ||
    lowerQuery.includes('edge') ||
    lowerQuery.includes('communicate') ||
    lowerQuery.includes('talk to') ||
    lowerQuery.includes('connected to');

  const asksAboutControls =
    lowerQuery.includes('control') ||
    lowerQuery.includes('nist') ||
    lowerQuery.includes('compliance') ||
    lowerQuery.includes('applicable');

  // Extract mentioned control IDs (e.g., AC-2, SI-7)
  const controlIdPattern = /\b([A-Z]{2,3})-(\d+(?:\(\d+\))?)\b/gi;
  const mentionedControlIds = Array.from(query.matchAll(controlIdPattern)).map(
    (match) => match[0].toUpperCase()
  );

  // Extract potential device names (quoted strings or specific terms)
  const quotedPattern = /"([^"]+)"|'([^']+)'/g;
  const mentionedDeviceNames = Array.from(query.matchAll(quotedPattern)).map(
    (match) => match[1] || match[2]
  );

  return {
    asksAboutDevices,
    asksAboutConnections,
    asksAboutControls,
    mentionedDeviceNames,
    mentionedControlIds,
  };
}

/**
 * Format topology context for LLM prompt
 */
export function formatTopologyContextForPrompt(context: TopologyContext): string {
  const sections: string[] = [];

  // Summary
  sections.push(`Topology Summary:
- Total Devices: ${context.summary.totalDevices}
- Total Connections: ${context.summary.totalConnections}
- Device Types: ${Object.entries(context.summary.deviceTypes)
    .map(([type, count]) => `${type} (${count})`)
    .join(', ')}
- Security Zones: ${context.summary.securityZones.join(', ') || 'None defined'}`);

  // Devices
  if (context.devices.length > 0) {
    sections.push('\nDevices on Canvas:');
    context.devices.forEach((device) => {
      const parts = [
        `- ${device.name} (${device.type})`,
        device.ipAddress ? `IP: ${device.ipAddress}` : null,
        device.manufacturer ? `Manufacturer: ${device.manufacturer}` : null,
        device.model ? `Model: ${device.model}` : null,
        device.securityZone ? `Zone: ${device.securityZone}` : null,
        device.applicableControls && device.applicableControls.length > 0
          ? `Controls: ${device.applicableControls.join(', ')}`
          : null,
      ].filter(Boolean);

      sections.push(parts.join(', '));
    });
  }

  // Connections
  if (context.connections.length > 0) {
    sections.push('\nConnections:');
    context.connections.forEach((conn) => {
      const parts = [
        `- ${conn.sourceDevice} → ${conn.targetDevice}`,
        conn.protocol ? `Protocol: ${conn.protocol}` : null,
        conn.port ? `Port: ${conn.port}` : null,
        conn.encrypted ? 'Encrypted' : null,
        conn.dataFlow ? `Flow: ${conn.dataFlow}` : null,
      ].filter(Boolean);

      sections.push(parts.join(', '));
    });
  }

  return sections.join('\n');
}








