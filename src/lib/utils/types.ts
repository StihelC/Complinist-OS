import { Node, Edge } from '@xyflow/react';

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

// Device Categorization - Azure-based categories
export type ITCategory = 
  | 'Compute'
  | 'Networking'
  | 'Storage'
  | 'Databases'
  | 'Security'
  | 'AI-Machine-Learning'
  | 'Analytics'
  | 'Identity'
  | 'IoT'
  | 'Integration'
  | 'DevOps'
  | 'Management-Governance'
  | 'Web'
  | 'Containers'
  | 'Hybrid-Multicloud'
  | 'Blockchain'
  | 'Mobile'
  | 'Mixed-Reality'
  | 'Intune'
  | 'Azure-Ecosystem'
  | 'Azure-Stack'
  | 'Migrate'
  | 'Monitor'
  | 'Other';

export type NetworkLayer = 
  | 'Physical'
  | 'Data Link'
  | 'Network'
  | 'Application';

// Security Classifications
export type SecurityZone = 'untrusted' | 'dmz' | 'trusted' | 'internal';
export type AssetValue = 'low' | 'moderate' | 'high';
export type VulnerabilityManagement = 'none' | 'quarterly' | 'monthly' | 'continuous';
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial';
export type SecurityLevel = 'unclassified' | 'confidential' | 'secret';
export type DataFlow = 'bidirectional' | 'source-to-target' | 'target-to-source';

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
  
  // Handle offset for multiple edges to same target (orthogonal routing)
  handleOffset?: number;
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
export type LabelStyle = 'tab' | 'badge';

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
  labelStyle?: LabelStyle; // 'tab' or 'badge'
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

  // Channel Routing Handler Configuration
  handlerConfig?: {
    side: 'top' | 'right' | 'bottom' | 'left';
    position: number;
    visible: boolean;
  };
}

// Boundary Style Configuration
export interface BoundaryStyle {
  color: string;
  strokeWidth: number;
  dashArray: string;
}

// Professional, muted color palette for enterprise diagrams
export const boundaryStyles: Record<BoundaryType, BoundaryStyle> = {
  ato: { color: '#991b1b', strokeWidth: 2, dashArray: '' }, // Dark red - solid, authoritative
  network_segment: { color: '#1e40af', strokeWidth: 2, dashArray: '' }, // Deep blue - solid, clean
  security_zone: { color: '#b45309', strokeWidth: 2, dashArray: '8,4' }, // Amber - dashed for security
  physical_location: { color: '#166534', strokeWidth: 2, dashArray: '' }, // Forest green - solid
  datacenter: { color: '#5b21b6', strokeWidth: 2, dashArray: '' }, // Deep purple - solid
  office: { color: '#0e7490', strokeWidth: 2, dashArray: '' }, // Teal - solid
  cloud_region: { color: '#0369a1', strokeWidth: 2, dashArray: '6,3' }, // Sky blue - subtle dash
  custom: { color: '#475569', strokeWidth: 2, dashArray: '' }, // Slate gray - solid
};

// Professional style presets for quick application
export interface BoundaryStylePreset {
  name: string;
  description: string;
  color: string;
  strokeWidth: number;
  dashArray: string;
  borderRadius: number;
  backgroundOpacity: number;
}

export const boundaryStylePresets: Record<string, BoundaryStylePreset> = {
  corporate: {
    name: 'Corporate',
    description: 'Clean, professional blue',
    color: '#1e3a5f',
    strokeWidth: 2,
    dashArray: '',
    borderRadius: 8,
    backgroundOpacity: 0,
  },
  minimal: {
    name: 'Minimal',
    description: 'Subtle gray outline',
    color: '#64748b',
    strokeWidth: 1,
    dashArray: '',
    borderRadius: 4,
    backgroundOpacity: 0,
  },
  security: {
    name: 'Security Zone',
    description: 'Red dashed security boundary',
    color: '#dc2626',
    strokeWidth: 2,
    dashArray: '8,4',
    borderRadius: 0,
    backgroundOpacity: 0,
  },
  network: {
    name: 'Network',
    description: 'Blue network segment',
    color: '#0284c7',
    strokeWidth: 2,
    dashArray: '',
    borderRadius: 12,
    backgroundOpacity: 0,
  },
  cloud: {
    name: 'Cloud',
    description: 'Modern cloud boundary',
    color: '#0891b2',
    strokeWidth: 2,
    dashArray: '4,2',
    borderRadius: 16,
    backgroundOpacity: 0,
  },
  datacenter: {
    name: 'Data Center',
    description: 'Deep purple infrastructure',
    color: '#7c3aed',
    strokeWidth: 3,
    dashArray: '',
    borderRadius: 6,
    backgroundOpacity: 0,
  },
  compliance: {
    name: 'Compliance',
    description: 'Green compliance boundary',
    color: '#059669',
    strokeWidth: 2,
    dashArray: '',
    borderRadius: 8,
    backgroundOpacity: 0,
  },
  modern: {
    name: 'Modern',
    description: 'Sleek dark with rounded corners',
    color: '#334155',
    strokeWidth: 1,
    dashArray: '',
    borderRadius: 20,
    backgroundOpacity: 0,
  },
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

// Project
export type NistBaseline = 'LOW' | 'MODERATE' | 'HIGH';

export interface Project {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  baseline: NistBaseline;
}

export type ControlPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ControlNarrative {
  control_id: string;
  family: string;
  title: string;
  default_narrative: string;
  narrative: string;
  system_implementation?: string;
  implementation_status?: string;
  isCustom: boolean;
  wasCustom?: boolean;
  enhancements?: string[];
  baselines: NistBaseline[];
  referencedDevices?: string[];
  referencedBoundaries?: string[];
  coverageStatus?: ControlCoverageStatus;
  autoGenerated?: boolean;
  autoGeneratedAt?: string;
  isApplicableToBaseline?: boolean;
  priority?: ControlPriority;
  isRecommended?: boolean;
  recommendationReason?: string;
}

export interface ControlFamily {
  code: string;
  name: string;
  controls: ControlNarrative[];
}

export type ControlCoverageStatus = 'full' | 'partial' | 'none';

// Device Category for Palette
export interface DeviceCategory {
  name: string;
  icon: string;
  devices: DeviceType[];
}

// Layout Algorithm Types
export type LayoutAlgorithmType = 'dagre' | 'elkjs';
export type ElkAlgorithmVariantType = 'layered' | 'mrtree';
export type LayoutDirectionType = 'DOWN' | 'UP' | 'RIGHT' | 'LEFT';
export type ElkAlignmentType = 'AUTOMATIC' | 'BEGIN' | 'CENTER' | 'END';
export type ElkPortConstraintsType = 'UNDEFINED' | 'FREE' | 'FIXED_SIDE' | 'FIXED_ORDER' | 'FIXED_POS';
export type ElkHierarchyHandlingType = 'INHERIT' | 'INCLUDE_CHILDREN' | 'SEPARATE_CHILDREN';
export type MrTreeEdgeRoutingModeType = 'AVOID_OVERLAP' | 'BEND_POINTS';
export type MrTreeSearchOrderType = 'DFS' | 'BFS';
export type EdgeRoutingTypeOption = 'smart' | 'smartSmoothStep' | 'default' | 'straight' | 'smoothstep' | 'step';
export type SpacingTierType = 'compact' | 'comfortable' | 'spacious';

// Layout Settings Interface
export interface LayoutSettings {
  // Algorithm
  algorithm: LayoutAlgorithmType;
  elkAlgorithm: ElkAlgorithmVariantType;
  direction: LayoutDirectionType;

  // Spacing
  horizontalSpacing: number;
  verticalSpacing: number;
  nodeSpacing: number;
  rankSpacing: number;
  boundaryPadding: number;
  nestedBoundarySpacing: number;

  // Edge & Spacing
  edgeRouting: EdgeRoutingTypeOption;
  spacingTier: SpacingTierType;

  // Behavior
  autoResize: boolean;
  animate: boolean;
  animationDuration: number;

  // ELK Graph options
  elkAlignment?: ElkAlignmentType;
  elkEdgeSpacing?: number;
  elkRandomSeed?: number;

  // ELK Node options
  elkPortConstraints?: ElkPortConstraintsType;
  elkHierarchyHandling?: ElkHierarchyHandlingType;

  // ELK Sub-graph options
  elkSeparateComponents?: boolean;
  elkCompaction?: boolean;
  elkComponentSpacing?: number;

  // MrTree options
  mrTreeEdgeRoutingMode?: MrTreeEdgeRoutingModeType;
  mrTreeEdgeEndTextureLength?: number;
  mrTreeSearchOrder?: MrTreeSearchOrderType;
}

// Global Settings for Styling
export interface GlobalSettings {
  // Text Sizing
  globalDeviceLabelSize: number; // 6-100px, default 6
  globalBoundaryLabelSize: number; // 6-400px, default 14
  globalConnectionLabelSize: number; // 8-100px, default 12

  // Device Image Sizing
  globalDeviceImageSize: number; // 20-100%, default 55

  // Device Attachment Slots - number of connection handles per side
  deviceAttachmentSlots: number; // 1-4, default 1 (fixed number of handles per side)

  // Boundary Padding - internal padding for child layout within boundaries
  boundaryPadding: number; // 20-150px, default 45

  // Grid & Snap
  showGrid: boolean; // default false
  snapToGrid: boolean; // default false
  gridSize: number; // 10-100px, default 20

  // Floating Edges - edges connect to node boundaries instead of fixed handles
  useFloatingEdges: boolean; // default true

  // Hierarchical Edge Routing - routes edges through parent boundary borders
  hierarchicalEdgeRouting: boolean; // default false

  // Layout Debug Mode - shows ReactFlow DevTools and enables layout logging
  layoutDebugMode: boolean; // default false

  // Layout Settings - ELK/Dagre layout configuration
  layoutSettings?: LayoutSettings;
}

// Global Window Interface for Electron API
// Note: Full type definition is in src/window.d.ts
// This declaration is merged with window.d.ts

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

// ============================================
// Inventory Types
// ============================================

export type InventoryCategory = 'Hardware' | 'Software' | 'Network' | 'Security';

export interface InventoryItem {
  /** Unique identifier for this inventory item */
  id: string;
  
  /** ID of the device this item belongs to */
  deviceId: string;
  
  /** Category of inventory item */
  category: InventoryCategory;
  
  /** Name of the item */
  name: string;
  
  /** Type of item (e.g., "Server", "Operating System", "Network Interface") */
  type: string;
  
  /** Manufacturer or vendor */
  manufacturer: string;
  
  /** Model number or identifier */
  model: string;
  
  /** Version information */
  version: string;
  
  /** Physical or logical location */
  location: string;
  
  /** Owner or administrator */
  owner: string;
  
  /** Status (e.g., "Active", "Inactive") */
  status: string;
  
  /** Criticality level */
  criticality: string;
  
  /** IP address (for network items) */
  ipAddress?: string;
  
  /** MAC address (for network items) */
  macAddress?: string;
  
  /** Last updated timestamp */
  lastUpdated: string;
  
  /** Additional notes */
  notes?: string;
}

export interface InventoryExtractionResult {
  /** All inventory items */
  items: InventoryItem[];
  
  /** Items grouped by category */
  byCategory: {
    Hardware: InventoryItem[];
    Software: InventoryItem[];
    Network: InventoryItem[];
    Security: InventoryItem[];
  };
  
  /** Statistics */
  stats: {
    totalItems: number;
    hardwareCount: number;
    softwareCount: number;
    networkCount: number;
    securityCount: number;
  };
}

// ============================================
// SSP Generation Types
// ============================================

export type SSPBaseline = 'LOW' | 'MODERATE' | 'HIGH';
export type UneditedControlsMode = 'placeholder' | 'nist_text' | 'exclude';

export interface CustomSection {
  id: string;
  title: string;
  content: string;
  position: string; // e.g., "after-section-3" or "appendix"
}

export interface SSPSystemCharacteristics {
  // Basic Info
  system_name: string;
  organization_name: string;
  prepared_by: string;
  baseline: SSPBaseline;
  
  // System Description (Mad Libs fields)
  system_description: string;
  system_purpose: string;
  deployment_model: 'on-premises' | 'private-cloud' | 'public-cloud' | 'hybrid-cloud' | 'other';
  service_model: 'saas' | 'paas' | 'iaas' | 'on-premises' | 'hybrid' | 'other';
  
  // On-premises specific details (conditional)
  on_premises_details?: {
    data_center_location?: string;
    physical_security_description?: string;
    server_infrastructure?: string;
    network_infrastructure?: string;
    backup_systems?: string;
    disaster_recovery?: string;
  };
  
  // Cloud specific details (conditional)
  cloud_provider?: string; // e.g., "AWS", "Azure", "GCP", "Oracle", "IBM Cloud"
  
  // Information Types
  information_type_title: string;
  information_type_description: string;
  data_sensitivity?: string; // TEMPORARY - keeping for backward compatibility
  
  // Security Impact Levels (FIPS 199)
  confidentiality_impact: 'low' | 'moderate' | 'high';
  integrity_impact: 'low' | 'moderate' | 'high';
  availability_impact: 'low' | 'moderate' | 'high';
  
  // Authorization & Status
  authorization_boundary_description: string;
  system_status: 'operational' | 'under-development' | 'major-modification' | 'other';
  authorization_date?: string;
  
  // Responsible Parties
  system_owner: string;
  system_owner_email: string;
  authorizing_official: string;
  authorizing_official_email: string;
  security_contact: string;
  security_contact_email: string;
  
  // Additional Context
  physical_location: string;
  data_types_processed: string;
  users_description: string;
  
  // Topology Screenshot
  topology_screenshot?: string; // Base64 encoded PNG
  
  // Custom Sections
  custom_sections?: CustomSection[];
}

export interface SSPGenerationRequest extends SSPSystemCharacteristics {
  unedited_controls_mode: UneditedControlsMode;
  topology_image?: string; // Base64 encoded SVG
  custom_narratives?: Record<string, {
    narrative: string;
    implementation_status?: string;
    referenced_devices?: string[];
    referenced_boundaries?: string[];
  }>;
  project_id?: number;
  selected_control_ids?: string[]; // Optional list of control IDs to include in SSP
  enhanced_narratives?: Record<string, string>; // AI-enhanced narratives keyed by control family (AC, AU, etc.)
}

export interface NISTControl {
  id: string; // e.g., "AC-1"
  family: string; // e.g., "AC"
  title: string;
  objective: string;
  baselines?: SSPBaseline[]; // Optional - defaults to MODERATE if not specified
  narrative?: string; // Custom implementation narrative
  implementation_status?: string;
  referencedDevices?: string[];
  referencedBoundaries?: string[];
  implementingDevices?: ControlImplementer[];
}

export interface NISTControlFamily {
  id: string;
  name: string;
  controls: NISTControl[];
}

export interface ControlImplementer {
  id: string;
  name: string;
  ipAddress?: string | null;
  zone?: string | null;
}

export interface SSPDocument {
  metadata: SSPSystemCharacteristics & {
    generatedDate: string;
  };
  topology: {
    totalDevices: number;
    devicesByType: Record<string, number>;
    totalConnections: number;
    securityZones: string[];
    image?: string; // Base64 SVG
  };
  inventory?: {
    hardware: InventoryItem[];
    software: InventoryItem[];
    network?: InventoryItem[];
    security?: InventoryItem[];
  };
  controls: NISTControl[];
}

