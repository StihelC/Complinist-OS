/**
 * Test fixtures for network topology configurations
 * Used to test topologyAnalyzer, controlRecommendations, and controlSuggestions
 */

import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

// Helper to create device nodes
function createDevice(
  id: string,
  deviceType: string,
  overrides: Partial<DeviceNodeData & { parentId?: string }> = {}
): AppNode {
  const { parentId, ...dataOverrides } = overrides;
  const node: AppNode = {
    id,
    type: 'device',
    position: { x: 0, y: 0 },
    data: {
      id,
      name: dataOverrides.name || `Device-${id}`,
      deviceType: deviceType as any,
      iconPath: '',
      ...dataOverrides,
    } as DeviceNodeData,
  };
  // Set parentId at node level for React Flow
  if (parentId) {
    (node as any).parentId = parentId;
  }
  return node;
}

// Helper to create boundary nodes
function createBoundary(
  id: string,
  label: string,
  boundaryType: 'ato' | 'network_segment' | 'security_zone' | 'physical_location' | 'datacenter' | 'office',
  zoneType?: 'untrusted' | 'dmz' | 'trusted' | 'internal',
  overrides: Partial<BoundaryNodeData> = {}
): AppNode {
  return {
    id,
    type: 'boundary',
    position: { x: 0, y: 0 },
    data: {
      id,
      label,
      type: boundaryType,
      zoneType,
      ...overrides,
    } as BoundaryNodeData,
  };
}

// Helper to create edges
function createEdge(
  source: string,
  target: string,
  overrides: Partial<AppEdge['data']> = {}
): AppEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    data: overrides,
  };
}

// ============================================
// EMPTY TOPOLOGY
// ============================================
export const emptyTopology = {
  nodes: [] as AppNode[],
  edges: [] as AppEdge[],
};

// ============================================
// SINGLE DEVICE (No boundaries)
// ============================================
export const singleDeviceTopology = {
  nodes: [
    createDevice('server-1', 'web-server', {
      name: 'Production Web Server',
      operatingSystem: 'Ubuntu 22.04',
      ipAddress: '10.0.1.10',
      multifactorAuth: true,
      encryptionAtRest: true,
      encryptionInTransit: true,
    }),
  ],
  edges: [] as AppEdge[],
};

// ============================================
// SIMPLE DMZ NETWORK
// 3 devices: Firewall, Web Server, Database
// ============================================
export const simpleDmzNetwork = {
  nodes: [
    createBoundary('dmz-boundary', 'DMZ Zone', 'security_zone', 'dmz'),
    createDevice('fw-1', 'firewall', {
      name: 'Edge Firewall',
      parentId: 'dmz-boundary',
      operatingSystem: 'Palo Alto PAN-OS',
    }),
    createDevice('web-1', 'web-server', {
      name: 'Web Application Server',
      parentId: 'dmz-boundary',
      operatingSystem: 'CentOS 8',
      ipAddress: '192.168.1.10',
      encryptionInTransit: true,
    }),
    createDevice('db-1', 'database-server', {
      name: 'MySQL Database',
      parentId: 'dmz-boundary',
      operatingSystem: 'Ubuntu 20.04',
      ipAddress: '192.168.1.20',
      encryptionAtRest: true,
      backupsConfigured: true,
    }),
  ] as AppNode[],
  edges: [
    createEdge('fw-1', 'web-1', { firewalled: true }),
    createEdge('web-1', 'db-1', { encryptionProtocol: 'TLS 1.3' }),
  ],
};

// ============================================
// ENTERPRISE NETWORK WITH MULTIPLE ZONES
// DMZ, Internal, Cloud boundaries
// ============================================
export const enterpriseNetwork = {
  nodes: [
    // Boundaries
    createBoundary('dmz', 'DMZ', 'security_zone', 'dmz'),
    createBoundary('internal', 'Internal Network', 'security_zone', 'internal'),
    createBoundary('cloud-zone', 'AWS Cloud', 'security_zone', 'trusted'),

    // DMZ devices
    createDevice('fw-edge', 'firewall', {
      name: 'Edge Firewall',
      parentId: 'dmz',
      operatingSystem: 'Cisco ASA',
      ipAddress: '10.0.0.1',
    }),
    createDevice('lb-1', 'load-balancer', {
      name: 'Primary Load Balancer',
      parentId: 'dmz',
      ipAddress: '10.0.0.5',
    }),
    createDevice('web-dmz', 'web-server', {
      name: 'Public Web Server',
      parentId: 'dmz',
      operatingSystem: 'nginx',
      ipAddress: '10.0.0.10',
      encryptionInTransit: true,
    }),

    // Internal devices
    createDevice('router-internal', 'router', {
      name: 'Core Router',
      parentId: 'internal',
      operatingSystem: 'Cisco IOS',
      ipAddress: '192.168.0.1',
    }),
    createDevice('switch-1', 'switch', {
      name: 'Distribution Switch',
      parentId: 'internal',
      ipAddress: '192.168.0.2',
    }),
    createDevice('db-internal', 'database-server', {
      name: 'Enterprise Database',
      parentId: 'internal',
      operatingSystem: 'Oracle Linux',
      ipAddress: '192.168.1.100',
      encryptionAtRest: true,
      backupsConfigured: true,
      monitoringEnabled: true,
    }),
    createDevice('file-server', 'file-server', {
      name: 'Corporate File Server',
      parentId: 'internal',
      operatingSystem: 'Windows Server 2022',
      ipAddress: '192.168.1.50',
      encryptionAtRest: true,
    }),
    createDevice('workstation-1', 'workstation', {
      name: 'Admin Workstation',
      parentId: 'internal',
      operatingSystem: 'Windows 11',
      ipAddress: '192.168.2.10',
      multifactorAuth: true,
    }),

    // Cloud devices
    createDevice('vpn-gw', 'vpn-gateway', {
      name: 'Site-to-Cloud VPN',
      parentId: 'cloud-zone',
      ipAddress: '10.100.0.1',
      encryptionInTransit: true,
    }),
    createDevice('cloud-app', 'app-services', {
      name: 'Cloud Application',
      parentId: 'cloud-zone',
      operatingSystem: 'Azure App Service',
    }),
  ] as AppNode[],
  edges: [
    // DMZ connections
    createEdge('fw-edge', 'lb-1', { firewalled: true }),
    createEdge('lb-1', 'web-dmz', { encryptionProtocol: 'TLS 1.2' }),

    // Cross-zone: DMZ to Internal
    createEdge('web-dmz', 'db-internal', {
      encryptionProtocol: 'TLS 1.3',
      authenticationRequired: true,
    }),

    // Internal connections
    createEdge('router-internal', 'switch-1'),
    createEdge('switch-1', 'db-internal'),
    createEdge('switch-1', 'file-server'),
    createEdge('switch-1', 'workstation-1'),

    // Cross-zone: Internal to Cloud
    createEdge('router-internal', 'vpn-gw', {
      encryptionProtocol: 'IPSec',
      linkType: 'vpn',
    }),
    createEdge('vpn-gw', 'cloud-app', { encryptionProtocol: 'TLS 1.3' }),
  ],
};

// ============================================
// WIRELESS NETWORK TOPOLOGY
// Access points, wireless devices
// ============================================
export const wirelessNetwork = {
  nodes: [
    createBoundary('wireless-zone', 'Wireless Network', 'network_segment', 'untrusted'),
    createDevice('ap-1', 'access-point', {
      name: 'Main Access Point',
      parentId: 'wireless-zone',
      ipAddress: '192.168.10.1',
    }),
    createDevice('ap-2', 'wireless-router', {
      name: 'Guest WiFi Router',
      parentId: 'wireless-zone',
      ipAddress: '192.168.10.2',
    }),
    createDevice('laptop-1', 'laptop', {
      name: 'Employee Laptop',
      parentId: 'wireless-zone',
      operatingSystem: 'macOS Sonoma',
      encryptionAtRest: true,
    }),
    createDevice('laptop-2', 'laptop', {
      name: 'Guest Laptop',
      parentId: 'wireless-zone',
      operatingSystem: 'Windows 11',
    }),
  ] as AppNode[],
  edges: [
    createEdge('ap-1', 'laptop-1', { encryptionProtocol: 'WPA3' }),
    createEdge('ap-2', 'laptop-2', { encryptionProtocol: 'WPA2' }),
  ],
};

// ============================================
// CLOUD-ONLY TOPOLOGY (Azure)
// ============================================
export const cloudOnlyNetwork = {
  nodes: [
    createBoundary('azure-boundary', 'Azure Cloud', 'security_zone', 'trusted'),
    createDevice('vnet', 'virtual-networks', {
      name: 'Production VNet',
      parentId: 'azure-boundary',
    }),
    createDevice('azure-fw', 'azure-firewall', {
      name: 'Azure Firewall',
      parentId: 'azure-boundary',
    }),
    createDevice('app-gw', 'application-gateways', {
      name: 'Application Gateway',
      parentId: 'azure-boundary',
    }),
    createDevice('cosmos', 'cosmos-db', {
      name: 'Cosmos DB',
      parentId: 'azure-boundary',
      encryptionAtRest: true,
      encryptionInTransit: true,
    }),
    createDevice('keyvault', 'key-vaults', {
      name: 'Key Vault',
      parentId: 'azure-boundary',
      multifactorAuth: true,
    }),
    createDevice('aks', 'kubernetes-services', {
      name: 'AKS Cluster',
      parentId: 'azure-boundary',
      monitoringEnabled: true,
    }),
  ] as AppNode[],
  edges: [
    createEdge('azure-fw', 'app-gw', { firewalled: true }),
    createEdge('app-gw', 'aks', { encryptionProtocol: 'TLS 1.3' }),
    createEdge('aks', 'cosmos', { encryptionProtocol: 'TLS 1.3' }),
    createEdge('aks', 'keyvault', { authenticationRequired: true }),
  ],
};

// ============================================
// LARGE NETWORK (10+ devices for boundary protection recommendations)
// ============================================
export const largeNetwork = {
  nodes: [
    createBoundary('datacenter', 'Primary Datacenter', 'datacenter', 'internal'),

    // Create 12 servers to trigger SC-7 recommendation
    ...Array.from({ length: 12 }, (_, i) =>
      createDevice(`server-${i + 1}`, 'server', {
        name: `Application Server ${i + 1}`,
        parentId: 'datacenter',
        operatingSystem: 'RHEL 8',
        ipAddress: `10.0.1.${10 + i}`,
        monitoringEnabled: true,
      })
    ),
  ] as AppNode[],
  edges: [
    // Connect servers in a chain
    ...Array.from({ length: 11 }, (_, i) =>
      createEdge(`server-${i + 1}`, `server-${i + 2}`)
    ),
  ],
};

// ============================================
// NESTED BOUNDARIES TOPOLOGY
// Tests parentId chain resolution
// ============================================
export const nestedBoundaries = {
  nodes: [
    // Root boundary
    createBoundary('ato-boundary', 'Authorization Boundary', 'ato'),

    // Child boundaries
    createBoundary('dmz-nested', 'DMZ', 'security_zone', 'dmz'),
    createBoundary('internal-nested', 'Internal', 'security_zone', 'internal'),

    // Devices in DMZ (nested)
    createDevice('fw-nested', 'firewall', {
      name: 'DMZ Firewall',
      parentId: 'dmz-nested',
    }),

    // Devices in Internal (nested)
    createDevice('db-nested', 'database-server', {
      name: 'Internal DB',
      parentId: 'internal-nested',
      encryptionAtRest: true,
    }),
  ] as AppNode[],
  edges: [
    createEdge('fw-nested', 'db-nested', { encryptionProtocol: 'TLS 1.3' }),
  ],
};

// Set parentIds for nested structure
(nestedBoundaries.nodes[1] as any).parentId = 'ato-boundary';
(nestedBoundaries.nodes[2] as any).parentId = 'ato-boundary';

// ============================================
// DEVICES WITHOUT TYPES
// Tests handling of unknown/missing device types
// ============================================
export const unknownDevicesTopology = {
  nodes: [
    createDevice('unknown-1', '', {
      name: 'Unknown Device 1',
    }),
    createDevice('unknown-2', 'mystery-device', {
      name: 'Mystery Device',
    }),
    createDevice('generic-1', 'generic-appliance', {
      name: 'Generic Appliance',
    }),
    createDevice('endpoint-1', 'endpoint', {
      name: 'Generic Endpoint',
    }),
  ] as AppNode[],
  edges: [] as AppEdge[],
};

// ============================================
// SECURITY FEATURES TOPOLOGY
// Tests security metrics aggregation
// ============================================
export const securityFeaturesTopology = {
  nodes: [
    createDevice('mfa-device', 'server', {
      name: 'MFA-Enabled Server',
      multifactorAuth: true,
    }),
    createDevice('encrypted-device', 'database-server', {
      name: 'Encrypted Database',
      encryptionAtRest: true,
      encryptionInTransit: true,
    }),
    createDevice('monitored-device', 'web-server', {
      name: 'Monitored Web Server',
      monitoringEnabled: true,
      backupsConfigured: true,
    }),
    createDevice('all-features', 'server', {
      name: 'Fully Protected Server',
      multifactorAuth: true,
      encryptionAtRest: true,
      encryptionInTransit: true,
      backupsConfigured: true,
      monitoringEnabled: true,
    }),
  ] as AppNode[],
  edges: [] as AppEdge[],
};

// ============================================
// EDGE ENCRYPTION VARIANTS
// Tests various encryption detection scenarios
// ============================================
export const encryptionVariantsTopology = {
  nodes: [
    createDevice('source-1', 'server', { name: 'Source Server 1' }),
    createDevice('target-1', 'server', { name: 'Target Server 1' }),
    createDevice('source-2', 'server', { name: 'Source Server 2' }),
    createDevice('target-2', 'server', { name: 'Target Server 2' }),
    createDevice('source-3', 'server', { name: 'Source Server 3' }),
    createDevice('target-3', 'server', { name: 'Target Server 3' }),
    createDevice('source-4', 'server', { name: 'Source Server 4' }),
    createDevice('target-4', 'server', { name: 'Target Server 4' }),
    createDevice('source-5', 'server', { name: 'Source Server 5' }),
    createDevice('target-5', 'server', { name: 'Target Server 5' }),
  ] as AppNode[],
  edges: [
    // Encrypted via encryptionProtocol
    createEdge('source-1', 'target-1', { encryptionProtocol: 'TLS 1.3' }),
    // Encrypted via authenticationRequired
    createEdge('source-2', 'target-2', { authenticationRequired: true }),
    // Encrypted via firewalled
    createEdge('source-3', 'target-3', { firewalled: true }),
    // Encrypted via VPN linkType
    createEdge('source-4', 'target-4', { linkType: 'vpn-tunnel' }),
    // Unencrypted connection
    createEdge('source-5', 'target-5', {}),
  ],
};

// ============================================
// CROSS-ZONE CONNECTIONS TOPOLOGY
// Tests cross-zone connection detection
// ============================================
export const crossZoneTopology = {
  nodes: [
    createBoundary('zone-a', 'Zone A', 'security_zone', 'dmz'),
    createBoundary('zone-b', 'Zone B', 'security_zone', 'internal'),
    createBoundary('zone-c', 'Zone C', 'security_zone', 'trusted'),

    createDevice('device-a1', 'server', {
      name: 'Server A1',
      parentId: 'zone-a',
    }),
    createDevice('device-a2', 'server', {
      name: 'Server A2',
      parentId: 'zone-a',
    }),
    createDevice('device-b1', 'server', {
      name: 'Server B1',
      parentId: 'zone-b',
    }),
    createDevice('device-c1', 'server', {
      name: 'Server C1',
      parentId: 'zone-c',
    }),
  ] as AppNode[],
  edges: [
    // Same zone connection (Zone A)
    createEdge('device-a1', 'device-a2'),
    // Cross-zone: A to B
    createEdge('device-a1', 'device-b1'),
    // Cross-zone: B to C
    createEdge('device-b1', 'device-c1'),
    // Cross-zone: A to C
    createEdge('device-a2', 'device-c1'),
  ],
};
