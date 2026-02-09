/**
 * Control Recommendations Engine
 * 
 * Analyzes network topology to recommend relevant NIST 800-53 controls
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import priorityMappings from '@/assets/catalog/control-priorities.json';

export interface ControlRecommendation {
  controlId: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  triggerDevices: string[]; // IDs of devices that triggered this recommendation
}

interface TopologyStats {
  deviceCounts: Record<string, number>;
  boundaryTypes: Record<string, number>;
  totalDevices: number;
  totalConnections: number;
  hasWireless: boolean;
  hasCloud: boolean;
  hasDatabase: boolean;
  hasWebServer: boolean;
  hasVPN: boolean;
  hasFirewall: boolean;
}

/**
 * Analyze topology and return statistics
 */
function analyzeTopologyStats(nodes: AppNode[], edges: AppEdge[]): TopologyStats {
  const deviceNodes = nodes.filter(n => n.type === 'device' || !n.type);
  const boundaryNodes = nodes.filter(n => n.type === 'boundary');
  
  const deviceCounts: Record<string, number> = {};
  const boundaryTypes: Record<string, number> = {};
  
  // Count device types
  deviceNodes.forEach(node => {
    const data = node.data as any;
    const deviceType = data?.deviceType || 'unknown';
    deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
  });
  
  // Count boundary types
  boundaryNodes.forEach(node => {
    const data = node.data as any;
    const boundaryType = data?.zoneType || 'unknown';
    boundaryTypes[boundaryType] = (boundaryTypes[boundaryType] || 0) + 1;
  });
  
  // Check for specific device types
  const hasWireless = Object.keys(deviceCounts).some(type => 
    type.includes('wireless') || type.includes('access-point') || type.includes('ap')
  );
  
  const hasCloud = Object.keys(deviceCounts).some(type => 
    type.includes('cloud')
  ) || Object.keys(boundaryTypes).some(type => type.includes('cloud'));
  
  const hasDatabase = Object.keys(deviceCounts).some(type => 
    type.includes('database')
  );
  
  const hasWebServer = Object.keys(deviceCounts).some(type => 
    type.includes('web-server') || type.includes('webserver')
  );
  
  const hasVPN = Object.keys(deviceCounts).some(type => 
    type.includes('vpn')
  );
  
  const hasFirewall = Object.keys(deviceCounts).some(type => 
    type.includes('firewall')
  );
  
  return {
    deviceCounts,
    boundaryTypes,
    totalDevices: deviceNodes.length,
    totalConnections: edges.length,
    hasWireless,
    hasCloud,
    hasDatabase,
    hasWebServer,
    hasVPN,
    hasFirewall,
  };
}

/**
 * Get recommended controls based on detected devices
 */
function getRecommendationsFromDevices(
  nodes: AppNode[],
  _stats: TopologyStats
): ControlRecommendation[] {
  const recommendations: ControlRecommendation[] = [];
  const mappings = priorityMappings.topology_mappings as Record<string, string[]>;
  const added = new Set<string>();
  
  const deviceNodes = nodes.filter(n => n.type === 'device' || !n.type);
  
  // Map device types to controls
  deviceNodes.forEach(node => {
    const data = node.data as any;
    let deviceType = (data?.deviceType || 'unknown').toLowerCase();
    
    // Normalize device type for matching
    deviceType = deviceType.replace(/-/g, '-');
    
    // Find matching controls from mappings
    Object.keys(mappings).forEach(mappingKey => {
      if (deviceType.includes(mappingKey) || mappingKey.includes(deviceType)) {
        const controlIds = mappings[mappingKey];
        controlIds.forEach(controlId => {
          if (!added.has(controlId)) {
            recommendations.push({
              controlId,
              reason: `Recommended for ${data?.name || deviceType} (${deviceType})`,
              confidence: 'high',
              triggerDevices: [node.id],
            });
            added.add(controlId);
          } else {
            // Add device to existing recommendation
            const existing = recommendations.find(r => r.controlId === controlId);
            if (existing && !existing.triggerDevices.includes(node.id)) {
              existing.triggerDevices.push(node.id);
            }
          }
        });
      }
    });
  });
  
  return recommendations;
}

/**
 * Get recommendations based on boundary types
 */
function getRecommendationsFromBoundaries(
  nodes: AppNode[],
  _stats: TopologyStats
): ControlRecommendation[] {
  const recommendations: ControlRecommendation[] = [];
  const mappings = priorityMappings.topology_mappings as Record<string, string[]>;
  const added = new Set<string>();
  
  const boundaryNodes = nodes.filter(n => n.type === 'boundary');
  
  boundaryNodes.forEach(node => {
    const data = node.data as any;
    const boundaryType = (data?.zoneType || 'unknown').toLowerCase();
    
    // Check mappings for boundary types
    Object.keys(mappings).forEach(mappingKey => {
      if (boundaryType.includes(mappingKey) || mappingKey.includes(boundaryType)) {
        const controlIds = mappings[mappingKey];
        controlIds.forEach(controlId => {
          if (!added.has(controlId)) {
            recommendations.push({
              controlId,
              reason: `Recommended for ${data?.label || boundaryType} boundary`,
              confidence: 'high',
              triggerDevices: [node.id],
            });
            added.add(controlId);
          }
        });
      }
    });
  });
  
  return recommendations;
}

/**
 * Get general recommendations based on topology characteristics
 */
function getGeneralRecommendations(stats: TopologyStats): ControlRecommendation[] {
  const recommendations: ControlRecommendation[] = [];
  
  // Wireless recommendations
  if (stats.hasWireless) {
    recommendations.push({
      controlId: 'AC-18',
      reason: 'Wireless access detected in topology',
      confidence: 'high',
      triggerDevices: [],
    });
    recommendations.push({
      controlId: 'AC-19',
      reason: 'Wireless access control needed',
      confidence: 'high',
      triggerDevices: [],
    });
  }
  
  // Cloud recommendations
  if (stats.hasCloud) {
    recommendations.push({
      controlId: 'SA-9',
      reason: 'Cloud services detected',
      confidence: 'high',
      triggerDevices: [],
    });
  }
  
  // Database recommendations
  if (stats.hasDatabase) {
    recommendations.push({
      controlId: 'SC-28',
      reason: 'Database servers require data at rest encryption',
      confidence: 'high',
      triggerDevices: [],
    });
  }
  
  // Web server recommendations
  if (stats.hasWebServer) {
    recommendations.push({
      controlId: 'SC-8',
      reason: 'Web servers require transmission protection',
      confidence: 'high',
      triggerDevices: [],
    });
    recommendations.push({
      controlId: 'SC-23',
      reason: 'Session authenticity protection for web applications',
      confidence: 'medium',
      triggerDevices: [],
    });
  }
  
  // VPN recommendations
  if (stats.hasVPN) {
    recommendations.push({
      controlId: 'AC-17',
      reason: 'VPN gateway requires remote access controls',
      confidence: 'high',
      triggerDevices: [],
    });
    recommendations.push({
      controlId: 'SC-10',
      reason: 'Network disconnect for VPN sessions',
      confidence: 'medium',
      triggerDevices: [],
    });
  }
  
  // Network segmentation (if multiple boundaries or many devices)
  if (stats.totalDevices > 10 || Object.keys(stats.boundaryTypes).length > 1) {
    recommendations.push({
      controlId: 'SC-7',
      reason: `Complex network with ${stats.totalDevices} devices requires boundary protection`,
      confidence: 'high',
      triggerDevices: [],
    });
  }
  
  return recommendations;
}

/**
 * Main function to get control recommendations from topology
 */
export function getControlRecommendations(
  nodes: AppNode[],
  edges: AppEdge[]
): ControlRecommendation[] {
  const stats = analyzeTopologyStats(nodes, edges);
  
  // Gather recommendations from different sources
  const deviceRecs = getRecommendationsFromDevices(nodes, stats);
  const boundaryRecs = getRecommendationsFromBoundaries(nodes, stats);
  const generalRecs = getGeneralRecommendations(stats);
  
  // Merge and deduplicate recommendations
  const allRecs = [...deviceRecs, ...boundaryRecs, ...generalRecs];
  const uniqueRecs = new Map<string, ControlRecommendation>();
  
  allRecs.forEach(rec => {
    if (!uniqueRecs.has(rec.controlId)) {
      uniqueRecs.set(rec.controlId, rec);
    } else {
      // Merge trigger devices
      const existing = uniqueRecs.get(rec.controlId)!;
      existing.triggerDevices = [
        ...existing.triggerDevices,
        ...rec.triggerDevices.filter(id => !existing.triggerDevices.includes(id))
      ];
      // Update reason to be more comprehensive if different
      if (rec.reason !== existing.reason && !existing.reason.includes('multiple')) {
        existing.reason = `${existing.reason} (multiple factors)`;
      }
    }
  });
  
  // Sort by confidence and number of trigger devices
  const sorted = Array.from(uniqueRecs.values()).sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const confidenceDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    return b.triggerDevices.length - a.triggerDevices.length;
  });
  
  // Limit to top 10 recommendations
  return sorted.slice(0, 10);
}

/**
 * Check if a control is recommended for the given topology
 */
export function isControlRecommended(
  controlId: string,
  nodes: AppNode[],
  edges: AppEdge[]
): { isRecommended: boolean; reason?: string } {
  const recommendations = getControlRecommendations(nodes, edges);
  const rec = recommendations.find(r => r.controlId === controlId);
  
  if (rec) {
    return {
      isRecommended: true,
      reason: rec.reason,
    };
  }
  
  return { isRecommended: false };
}

