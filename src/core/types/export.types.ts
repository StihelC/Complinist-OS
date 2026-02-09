import type { AppNode, AppEdge, DeviceType, BoundaryType, ConnectionState, EdgeType, DeviceAlignment, LayoutDirection, LabelPosition, LabelPlacement } from './topology.types';
import type { SecurityZone, SecurityLevel, AssetValue, VulnerabilityManagement, ComplianceStatus, DataFlow } from './common.types';

// Export/Report Types for SSP Generation
export interface ReportMetadata {
  projectName: string;
  projectId?: number;
  generatedAt: string;
  version: string;
  author?: string;
  description?: string;
}

export interface DeviceReport {
  // Basic Info
  id: string;
  name: string;
  deviceType: DeviceType;
  deviceSubtype: string | null;
  iconPath: string | null;
  
  // Network Info
  ipAddress: string | null;
  macAddress: string | null;
  subnetMask: string | null;
  defaultGateway: string | null;
  hostname: string | null;
  
  // Hardware Info
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  firmwareVersion: string | null;
  
  // Security Classification
  securityZone: SecurityZone | null;
  assetValue: AssetValue | null;
  missionCritical: boolean | null;
  dataClassification: string | null;
  
  // Security Posture
  multifactorAuth: boolean | null;
  encryptionAtRest: boolean | null;
  encryptionInTransit: boolean | null;
  backupsConfigured: boolean | null;
  monitoringEnabled: boolean | null;
  vulnerabilityManagement: VulnerabilityManagement | null;
  
  // Compliance
  applicableControls: string[] | null;
  lastVulnScan: string | null;
  complianceStatus: ComplianceStatus | null;
  criticality: string | null;
  complianceControls: string[] | null;
  processes: any[] | null;
  
  // Ownership
  systemOwner: string | null;
  department: string | null;
  contactEmail: string | null;
  location: string | null;
  
  // Visual Configuration
  label: string | null;
  labelFields: string[] | null;
  
  // Position and Layout
  boundaryId: string | null;
  position: { x: number; y: number };
  width: number | null;
  height: number | null;
}

export interface BoundaryReport {
  // Basic Info
  id: string;
  label: string;
  type: BoundaryType;
  
  // Security
  securityLevel: SecurityLevel | null;
  zoneType: SecurityZone | null;
  requiresAuthentication: boolean | null;
  dataTypesProcessed: string[] | null;
  
  // Hierarchy
  deviceIds: string[];
  parentBoundaryId: string | null;
  childBoundaryIds: string[];
  nestingDepth: number;
  
  // Position and Layout
  position: { x: number; y: number };
  width: number;
  height: number;
  
  // Layout Configuration
  deviceAlignment: DeviceAlignment | null;
  layoutDirection: LayoutDirection | null;
  nodeSpacing: number | null;
  spacing: number | null;
  
  // Visual Customization
  customColor: string | null;
  labelPosition: LabelPosition | null;
  labelPlacement: LabelPlacement | null;
  labelSize: number | null;
  labelSpacing: number | null;
  labelOffset: number | null;
  borderStrokeWidth: number | null;
  borderDashArray: string | null;
  borderRadius: number | null;
  backgroundOpacity: number | null;
  padding: number | null;
  labelBackgroundColor: string | null;
  labelTextColor: string | null;
}

export interface ConnectionReport {
  // Basic Connection Info
  id: string;
  source: string;
  target: string;
  sourceDevice: string | null;
  targetDevice: string | null;
  
  // Connection Info
  linkType: string | null;
  protocol: string | null;
  bandwidth: string | null;
  portSource: string | null;
  portTarget: string | null;
  dataFlow: DataFlow | null;
  
  // Performance Metrics
  latency: string | null;
  jitter: string | null;
  packetLoss: string | null;
  errorRate: string | null;
  
  // Network Configuration
  vlanId: string | null;
  qosClass: string | null;
  redundancyType: string | null;
  connectionState: ConnectionState | null;
  
  // Security
  encryptionProtocol: string | null;
  authenticationRequired: boolean | null;
  firewalled: boolean | null;
  
  // Monitoring
  monitored: boolean | null;
  
  // Visual Configuration
  label: string | null;
  labelFields: string[] | null;
  edgeType: EdgeType | null;
  animated: boolean | null;
  animationSpeed: number | null;
  animationColor: string | null;
}

export interface FullReport {
  metadata: ReportMetadata;
  devices: DeviceReport[];
  boundaries: BoundaryReport[];
  connections: ConnectionReport[];
  summary: {
    totalDevices: number;
    totalBoundaries: number;
    totalConnections: number;
    devicesByType: Record<string, number>;
    boundariesByType: Record<string, number>;
    securityZones: string[];
  };
  diagram: {
    nodes: AppNode[];
    edges: AppEdge[];
    viewport?: { x: number; y: number; zoom: number };
  };
}

