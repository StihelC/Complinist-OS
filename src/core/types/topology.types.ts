import { Node, Edge } from '@xyflow/react';
import type { SecurityZone, AssetValue, VulnerabilityManagement, ComplianceStatus, SecurityLevel, DataFlow } from './common.types';

// Device Types - Azure-based services
// DeviceType is now flexible to support all Azure services (600+ icons)
// Common Azure services are listed below for type checking, but any string is allowed
export type DeviceType = 
  // Compute
  | 'virtual-machine'
  | 'vm-scale-sets'
  | 'app-services'
  | 'function-apps'
  | 'container-instances'
  | 'kubernetes-services'
  | 'batch-accounts'
  | 'service-fabric-clusters'
  
  // Networking
  | 'virtual-networks'
  | 'load-balancers'
  | 'virtual-network-gateways'
  | 'application-gateways'
  | 'firewalls'
  | 'dns-zones'
  | 'network-security-groups'
  | 'public-ip-addresses'
  | 'route-tables'
  | 'expressroute-circuits'
  | 'virtual-wan-hub'
  | 'bastions'
  
  // Storage
  | 'storage-accounts'
  | 'disk-storage'
  | 'blob-storage'
  | 'file-storage'
  | 'azure-netapp-files'
  | 'storage-sync-services'
  
  // Databases
  | 'sql-database'
  | 'cosmos-db'
  | 'azure-database-mysql-server'
  | 'azure-database-postgresql-server'
  | 'cache-redis'
  | 'azure-sql'
  | 'azure-sql-managed-instance'
  
  // Security
  | 'key-vaults'
  | 'microsoft-defender-for-cloud'
  | 'azure-sentinel'
  | 'azure-firewall'
  | 'ddos-protection-plans'
  | 'application-security-groups'
  
  // AI & Machine Learning
  | 'cognitive-services'
  | 'machine-learning'
  | 'azure-openai'
  | 'bot-services'
  | 'ai-studio'
  
  // Analytics
  | 'synapse-analytics'
  | 'data-factories'
  | 'stream-analytics-jobs'
  | 'event-hubs'
  | 'azure-databricks'
  
  // Identity
  | 'azure-ad'
  | 'azure-ad-b2c'
  | 'managed-identities'
  | 'entra-id'
  
  // IoT
  | 'iot-hub'
  | 'iot-central-applications'
  | 'digital-twins'
  
  // Integration
  | 'logic-apps'
  | 'service-bus'
  | 'api-management-services'
  | 'event-grid-topics'
  
  // DevOps
  | 'azure-devops'
  | 'devops-starter'
  
  // Management & Governance
  | 'monitor'
  | 'cost-management'
  | 'policy'
  | 'resource-groups'
  | 'log-analytics-workspaces'
  | 'application-insights'
  
  // Web
  | 'static-apps'
  | 'cdn-profiles'
  | 'front-door'
  
  // Containers
  | 'container-registries'
  | 'azure-spring-apps'
  
  // Hybrid
  | 'azure-arc'
  | 'azure-stack'
  | 'azure-stack-edge'
  
  // Generic/Other (allows any Azure service name)
  | (string & {});

// Boundary Types
export type BoundaryType =
  | 'ato'
  | 'network_segment'
  | 'security_zone'
  | 'physical_location'
  | 'datacenter'
  | 'office'
  | 'cloud_region'
  | 'custom';

// Device Metadata Interface
export interface DeviceMetadata extends Record<string, unknown> {
  // Basic Info
  name: string;
  deviceType: DeviceType;
  deviceSubtype?: string; // For specific variants (e.g., "Cisco PIX 515")
  iconPath: string; // Path to the device icon image
  
  // Network Info
  ipAddress?: string;
  macAddress?: string;
  subnetMask?: string;
  defaultGateway?: string;
  hostname?: string;
  dnsServers?: string;
  vlanId?: string;
  ports?: string; // Comma-separated port numbers
  
  // Hardware Info
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  operatingSystem?: string;
  osVersion?: string;
  software?: string; // Newline-separated list of installed software
  cpuModel?: string;
  memorySize?: string;
  storageSize?: string;
  
  // Security Classification
  securityZone?: SecurityZone;
  assetValue?: AssetValue;
  missionCritical?: boolean;
  dataClassification?: string;
  
  // Security Posture
  multifactorAuth?: boolean;
  encryptionAtRest?: boolean;
  encryptionInTransit?: boolean;
  encryptionStatus?: string; // 'Enabled' | 'Partial' | 'Not Configured'
  backupsConfigured?: boolean;
  monitoringEnabled?: boolean;
  vulnerabilityManagement?: VulnerabilityManagement;
  riskLevel?: string; // 'Low' | 'Moderate' | 'High'
  criticality?: string; // Criticality level for inventory
  firewallEnabled?: boolean;
  antivirusEnabled?: boolean;
  patchLevel?: string;
  lastPatchDate?: string;
  
  // Compliance
  applicableControls?: string[];
  lastVulnScan?: string;
  complianceStatus?: ComplianceStatus;
  
  // Ownership
  systemOwner?: string;
  owner?: string; // Alternative owner field for inventory
  department?: string;
  contactEmail?: string;
  location?: string;
  costCenter?: string;
  purchaseDate?: string;
  warrantyExpiration?: string;
  
  // Additional Metadata
  notes?: string; // General notes field
  tags?: string[]; // Tags for categorization
  status?: string; // Device status: 'Active' | 'Inactive' | 'Maintenance' | 'Retired'
  assignedControls?: string[]; // Control IDs that reference this device
  controlNotes?: Record<string, string>; // Per-control implementation notes keyed by control ID
  
  // Visual Configuration
  label?: string;
  labelFields?: string[];
  deviceImageSize?: number; // Individual device image size (20-100%), overrides global setting

  // External Resource Tracking (for imported resources)
  /** External ID for tracking imported resources (format: provider:type:name:hash) */
  externalId?: string;
  /** Source of the import */
  externalSource?: 'terraform' | 'cloudformation' | 'manual';
  /** Timestamp of last import */
  lastImportTimestamp?: string;
  /** Original Terraform address (e.g., "aws_instance.web") */
  terraformAddress?: string;
  /** Original Terraform resource type (e.g., "aws_instance") */
  terraformType?: string;
}

// Edge Types
export type EdgeType = 'smart' | 'smartSmoothStep' | 'default' | 'straight' | 'step' | 'smoothstep' | 'simplebezier';
export type ConnectionState = 'active' | 'standby' | 'failed';

// Edge Metadata Interface
export interface EdgeMetadata extends Record<string, unknown> {
  // Connection Info
  linkType?: string;
  protocol?: string;
  bandwidth?: string;
  portSource?: string;
  portTarget?: string;
  dataFlow?: DataFlow;
  
  // Performance Metrics
  latency?: string;
  jitter?: string;
  packetLoss?: string;
  errorRate?: string;
  
  // Network Configuration
  vlanId?: string;
  qosClass?: string;
  redundancyType?: string;
  connectionState?: ConnectionState;
  
  // Security
  encryptionProtocol?: string;
  authenticationRequired?: boolean;
  firewalled?: boolean;
  
  // Monitoring
  monitored?: boolean;
  
  // Visual Configuration
  label?: string;
  labelFields?: string[];
  edgeType?: EdgeType;
  animated?: boolean;
  animationSpeed?: number;
  animationColor?: string;
}

// Boundary Layout Types
export type LabelPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

export type LabelPlacement = 'inside' | 'outside';

export type DeviceAlignment = 
  | 'none'
  | 'dagre-tb'         // Dagre: Top to Bottom (recommended)
  | 'dagre-lr'         // Dagre: Left to Right
  | 'dagre-bt'         // Dagre: Bottom to Top
  | 'dagre-rl';        // Dagre: Right to Left

export type LayoutDirection = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';

// Boundary Metadata Interface
export interface BoundaryMetadata extends Record<string, unknown> {
  label: string;
  type: BoundaryType;
  securityLevel?: SecurityLevel;
  zoneType?: SecurityZone;
  requiresAuthentication?: boolean;
  dataTypesProcessed?: string[];
  labelPosition?: LabelPosition;
  labelPlacement?: LabelPlacement;
  labelSize?: number; // Label size in px (12-200)
  deviceAlignment?: DeviceAlignment;
  layoutDirection?: LayoutDirection;
  nodeSpacing?: number;
  spacing?: number; // Layout spacing for Dagre algorithm (20-150)
  nestingDepth?: number; // Calculated depth in the boundary hierarchy (0 = root level)

  // Nesting relationship - explicit parent boundary ID for hierarchical tracking
  parentBoundaryId?: string; // ID of parent boundary for nesting hierarchy

  // Visual Customization Fields
  customColor?: string; // Hex color override (e.g., "#dc2626")
  labelSpacing?: number; // Distance from boundary edge (px) (0-100)
  labelOffset?: number; // Additional vertical offset for label (px) (-50 to 50)
  borderStrokeWidth?: number; // Custom border width override (1-10)
  borderDashArray?: string; // Custom dash pattern (e.g., "10,5", "5,5")
  backgroundOpacity?: number; // Background opacity (0-100%)
  borderRadius?: number; // Border radius (0-50px)
  labelBackgroundColor?: string; // Label background color (hex or "auto")
  labelTextColor?: string; // Label text color (hex or "auto")
  padding?: number; // Internal padding (0-50px)

  // Auto-resize settings
  autoResize?: boolean; // Enable automatic resize when children change
  autoResizePadding?: number; // Padding to use for auto-resize (20-100px)

  // External Resource Tracking (for imported boundaries)
  /** External ID for tracking imported resources (format: provider:type:name:hash) */
  externalId?: string;
  /** Source of the import */
  externalSource?: 'terraform' | 'cloudformation' | 'manual';
  /** Timestamp of last import */
  lastImportTimestamp?: string;
  /** Original Terraform address (e.g., "aws_vpc.main") */
  terraformAddress?: string;
  /** Original Terraform resource type (e.g., "aws_vpc") */
  terraformType?: string;
}

// Boundary Style Configuration
export interface BoundaryStyle {
  color: string;
  strokeWidth: number;
  dashArray: string;
}

export const boundaryStyles: Record<BoundaryType, BoundaryStyle> = {
  ato: { color: '#dc2626', strokeWidth: 3, dashArray: '10,5' },
  network_segment: { color: '#2563eb', strokeWidth: 2, dashArray: '5,5' },
  security_zone: { color: '#ea580c', strokeWidth: 3, dashArray: '8,4' },
  physical_location: { color: '#16a34a', strokeWidth: 2, dashArray: '6,3' },
  datacenter: { color: '#7c3aed', strokeWidth: 3, dashArray: '12,6' },
  office: { color: '#0891b2', strokeWidth: 2, dashArray: '4,4' },
  cloud_region: { color: '#0ea5e9', strokeWidth: 2, dashArray: '6,4' },
  custom: { color: '#6b7280', strokeWidth: 2, dashArray: '5,5' },
};

// Helper function to get effective boundary style with custom overrides
export function getEffectiveBoundaryStyle(
  boundaryType: BoundaryType,
  metadata: BoundaryNodeData
): BoundaryStyle & {
  backgroundColor?: string;
  labelBgColor?: string;
  labelTextColor?: string;
  borderRadius?: number;
  padding?: number;
  backgroundOpacity?: number;
} {
  const defaultStyle = boundaryStyles[boundaryType];
  
  return {
    color: metadata.customColor || defaultStyle.color,
    strokeWidth: metadata.borderStrokeWidth ?? defaultStyle.strokeWidth,
    dashArray: metadata.borderDashArray || defaultStyle.dashArray,
    borderRadius: metadata.borderRadius ?? 12,
    padding: metadata.padding ?? 4,
    backgroundOpacity: metadata.backgroundOpacity,
    labelBgColor: metadata.labelBackgroundColor,
    labelTextColor: metadata.labelTextColor,
  };
}

// React Flow Node Data Types
export interface DeviceNodeData extends DeviceMetadata {
  id: string;
}

export interface BoundaryNodeData extends BoundaryMetadata {
  id: string;
  hoveredGroupId?: string | null;
}

export type AppNode = Node<DeviceNodeData | BoundaryNodeData>;
export type AppEdge = Edge<EdgeMetadata>;

// Diagram State
export interface DiagramState {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
}

// Device Category for Palette
export interface DeviceCategory {
  name: string;
  icon: string;
  devices: DeviceType[];
}

