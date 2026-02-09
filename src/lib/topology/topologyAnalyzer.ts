import type {
  AppNode,
  AppEdge,
  BoundaryNodeData,
  BoundaryType,
  DeviceNodeData,
  DeviceType,
  SecurityLevel,
  SecurityZone,
} from '@/lib/utils/types';
import {
  type EnvironmentType,
  ENVIRONMENT_PATTERNS,
} from '@/lib/ai/examples';

export type DeviceCategorySummary = 'server' | 'network' | 'security' | 'endpoint' | 'other';

export interface DeviceDetailSummary {
  id: string;
  name: string;
  deviceType?: DeviceType | string;
  operatingSystem?: string;
  ipAddress?: string;
  boundaryId?: string | null;
  boundaryName?: string;
  zoneType?: SecurityZone | string;
  category: DeviceCategorySummary;
  supportsMfa?: boolean;
  encryptionAtRest?: boolean;
  encryptionInTransit?: boolean;
  backupsConfigured?: boolean;
  monitoringEnabled?: boolean;
}

export interface BoundarySummary {
  id: string;
  name: string;
  type: BoundaryType;
  zoneType?: SecurityZone;
  securityLevel?: SecurityLevel;
  deviceCount: number;
  devices: string[];
}

export interface TopologyIntelligence {
  boundaries: {
    count: number;
    zones: BoundarySummary[];
  };
  devices: {
    total: number;
    byType: Record<string, number>;
    byZone: Record<string, number>;
    byOS: Record<string, number>;
    details: DeviceDetailSummary[];
    servers: DeviceDetailSummary[];
    networkEquipment: DeviceDetailSummary[];
    endpoints: DeviceDetailSummary[];
  };
  connections: {
    total: number;
    crossZone: number;
    encrypted: number;
  };
  security: {
    mfaEnabled: number;
    encryptionAtRest: number;
    encryptionInTransit: number;
    backupsConfigured: number;
    monitoringEnabled: number;
  };
  /** Detected environment type based on topology analysis */
  environment: {
    detected: EnvironmentType;
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
  };
}

interface InternalBoundarySummary extends BoundarySummary {
  zoneType?: SecurityZone;
}

export function analyzeTopology(nodes: AppNode[], edges: AppEdge[]): TopologyIntelligence {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const boundaryInfoMap = new Map<string, InternalBoundarySummary>();
  nodes
    .filter((node) => node.type === 'boundary')
    .forEach((node) => {
      const data = (node.data || {}) as BoundaryNodeData;
      boundaryInfoMap.set(node.id, {
        id: node.id,
        name: data.label || `Boundary ${node.id}`,
        type: data.type,
        zoneType: data.zoneType,
        securityLevel: data.securityLevel,
        deviceCount: 0,
        devices: [],
      });
    });

  const deviceNodes = nodes.filter((node) => node.type === 'device' || !node.type);

  const byType: Record<string, number> = {};
  const byZone: Record<string, number> = {};
  const byOS: Record<string, number> = {};

  let mfaEnabled = 0;
  let encryptionAtRest = 0;
  let encryptionInTransit = 0;
  let backupsConfigured = 0;
  let monitoringEnabled = 0;

  const deviceDetails: DeviceDetailSummary[] = [];

  deviceNodes.forEach((node) => {
    const data = (node.data || {}) as DeviceNodeData;
    if (!data) return;

    const boundaryId = findContainingBoundaryId(node, nodeMap, boundaryInfoMap) ?? data.boundaryId ?? null;
    const boundaryIdStr = typeof boundaryId === 'string' ? boundaryId : null;
    const boundaryInfo = boundaryIdStr ? boundaryInfoMap.get(boundaryIdStr) : undefined;
    const zoneType = data.securityZone || boundaryInfo?.zoneType;

    if (boundaryInfo) {
      boundaryInfo.devices.push(node.id);
      boundaryInfo.deviceCount += 1;
    }

    const osKey = (data.operatingSystem || 'Unknown OS').trim();
    byOS[osKey] = (byOS[osKey] || 0) + 1;

    const typeKey = data.deviceType || 'unknown';
    byType[typeKey] = (byType[typeKey] || 0) + 1;

    const zoneKey = zoneType || boundaryInfo?.name || 'Unassigned';
    byZone[zoneKey] = (byZone[zoneKey] || 0) + 1;

    const category = categorizeDevice(data.deviceType);

    const detail: DeviceDetailSummary = {
      id: node.id,
      name: data.name || data.hostname || `Device ${node.id}`,
      deviceType: data.deviceType,
      operatingSystem: data.operatingSystem,
      ipAddress: data.ipAddress,
      boundaryId: boundaryIdStr,
      boundaryName: boundaryInfo?.name,
      zoneType,
      category,
      supportsMfa: Boolean(data.multifactorAuth),
      encryptionAtRest: Boolean(data.encryptionAtRest),
      encryptionInTransit: Boolean(data.encryptionInTransit),
      backupsConfigured: Boolean(data.backupsConfigured),
      monitoringEnabled: Boolean(data.monitoringEnabled),
    };

    deviceDetails.push(detail);

    if (detail.supportsMfa) mfaEnabled += 1;
    if (detail.encryptionAtRest) encryptionAtRest += 1;
    if (detail.encryptionInTransit) encryptionInTransit += 1;
    if (detail.backupsConfigured) backupsConfigured += 1;
    if (detail.monitoringEnabled) monitoringEnabled += 1;
  });

  const deviceIds = new Set(deviceDetails.map((detail) => detail.id));
  const zoneLookup = new Map<string, string | undefined>();
  deviceDetails.forEach((detail) => zoneLookup.set(detail.id, detail.zoneType || detail.boundaryName));

  const relevantEdges = edges.filter((edge) => deviceIds.has(edge.source) && deviceIds.has(edge.target));

  let crossZone = 0;
  let encryptedConnections = 0;

  relevantEdges.forEach((edge) => {
    const sourceZone = zoneLookup.get(edge.source);
    const targetZone = zoneLookup.get(edge.target);

    if (sourceZone && targetZone && sourceZone !== targetZone) {
      crossZone += 1;
    }

    if (isEncryptedEdge(edge)) {
      encryptedConnections += 1;
    }
  });

  const servers = deviceDetails.filter((detail) => detail.category === 'server');
  const networkEquipment = deviceDetails.filter((detail) => detail.category === 'network');
  const endpoints = deviceDetails.filter((detail) => detail.category === 'endpoint');

  // Detect environment type from topology
  const environmentDetection = detectEnvironment(deviceDetails, boundaryInfoMap);

  return {
    boundaries: {
      count: boundaryInfoMap.size,
      zones: Array.from(boundaryInfoMap.values()),
    },
    devices: {
      total: deviceDetails.length,
      byType,
      byZone,
      byOS,
      details: deviceDetails,
      servers,
      networkEquipment,
      endpoints,
    },
    connections: {
      total: relevantEdges.length,
      crossZone,
      encrypted: encryptedConnections,
    },
    security: {
      mfaEnabled,
      encryptionAtRest,
      encryptionInTransit,
      backupsConfigured,
      monitoringEnabled,
    },
    environment: environmentDetection,
  };
}

function findContainingBoundaryId(
  node: AppNode,
  nodeMap: Map<string, AppNode>,
  boundaryMap: Map<string, InternalBoundarySummary>,
): string | null {
  let currentParent: string | null | undefined = (node as any).parentId;

  while (currentParent) {
    if (boundaryMap.has(currentParent)) {
      return currentParent;
    }
    const parentNode = nodeMap.get(currentParent);
    currentParent = parentNode ? (parentNode as any).parentId : null;
  }

  return null;
}

export function categorizeDevice(deviceType?: DeviceType | string): DeviceCategorySummary {
  if (!deviceType) {
    return 'other';
  }

  const type = deviceType.toLowerCase();

  if (type.includes('server')) {
    return 'server';
  }
  if (type.includes('firewall') || type.includes('vpn') || type.includes('security') || type.includes('ids') || type.includes('ips')) {
    return 'security';
  }
  if (type.includes('switch') || type.includes('router') || type.includes('gateway') || type.includes('load-balancer') || type.includes('proxy')) {
    return 'network';
  }
  if (type.includes('laptop') || type.includes('workstation') || type.includes('endpoint') || type.includes('pc') || type.includes('device')) {
    return 'endpoint';
  }

  return 'other';
}

function isEncryptedEdge(edge: AppEdge): boolean {
  const data = edge.data || {};
  if (!data) return false;

  if (data.encryptionProtocol) return true;
  if (data.authenticationRequired) return true;
  if (data.firewalled) return true;

  const linkType = typeof data.linkType === 'string' ? data.linkType.toLowerCase() : '';
  if (linkType.includes('vpn') || linkType.includes('tls') || linkType.includes('ssl')) {
    return true;
  }

  return false;
}

/**
 * Detect environment type from topology analysis
 * Examines device types, names, and boundary configurations
 */
function detectEnvironment(
  deviceDetails: DeviceDetailSummary[],
  boundaryInfoMap: Map<string, InternalBoundarySummary>
): { detected: EnvironmentType; confidence: 'high' | 'medium' | 'low'; indicators: string[] } {
  // Collect indicators from devices
  const deviceTypes = deviceDetails.map(d => d.deviceType || '').filter(Boolean);
  const deviceNames = deviceDetails.map(d => d.name || '').filter(Boolean);
  const operatingSystems = deviceDetails.map(d => d.operatingSystem || '').filter(Boolean);

  // Collect indicators from boundaries
  const boundaryNames = Array.from(boundaryInfoMap.values()).map(b => b.name || '');
  const boundaryTypes = Array.from(boundaryInfoMap.values()).map(b => b.type || '');

  // Combine all text for analysis
  const allIndicators = [
    ...deviceTypes,
    ...deviceNames,
    ...operatingSystems,
    ...boundaryNames,
    ...boundaryTypes
  ];

  // Score each environment pattern
  const scores: Record<EnvironmentType, number> = {
    'cloud-aws': 0,
    'cloud-azure': 0,
    'cloud-gcp': 0,
    'on-premise': 0,
    'hybrid': 0,
    'container': 0,
    'dod': 0,
    'generic': 0
  };

  const foundIndicators: string[] = [];
  const allText = allIndicators.join(' ').toLowerCase();

  for (const pattern of ENVIRONMENT_PATTERNS) {
    for (const indicator of pattern.indicators) {
      if (allText.includes(indicator.toLowerCase())) {
        scores[pattern.environment] += 1;
        foundIndicators.push(`${indicator} (${pattern.displayName})`);
      }
    }
  }

  // Check for hybrid indicators (both cloud and on-prem)
  const hasCloudIndicators = scores['cloud-aws'] + scores['cloud-azure'] + scores['cloud-gcp'] > 0;
  const hasOnPremIndicators = scores['on-premise'] > 0;

  if (hasCloudIndicators && hasOnPremIndicators) {
    scores['hybrid'] += 2;
    foundIndicators.push('hybrid-detected');
  }

  // Find highest scoring environment
  let maxScore = 0;
  let detectedEnvironment: EnvironmentType = 'generic';

  for (const [env, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedEnvironment = env as EnvironmentType;
    }
  }

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (maxScore >= 5) {
    confidence = 'high';
  } else if (maxScore >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    detected: detectedEnvironment,
    confidence,
    indicators: foundIndicators.slice(0, 5) // Return top 5 indicators
  };
}

/**
 * Get environment type for a topology
 * Convenience function for external use
 */
export function getTopologyEnvironment(nodes: AppNode[], edges: AppEdge[]): EnvironmentType {
  const intelligence = analyzeTopology(nodes, edges);
  return intelligence.environment.detected;
}

// Re-export environment type for convenience
export type { EnvironmentType };

