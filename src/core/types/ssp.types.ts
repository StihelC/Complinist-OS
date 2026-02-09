import type { InventoryItem } from './inventory.types';

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

/**
 * SSP Template - Reusable template for similar projects
 */
export interface SSPTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;

  // Template metadata - partial SSP characteristics that can be reused
  metadata: Partial<SSPSystemCharacteristics>;

  // Control selection configuration
  controlConfig?: {
    selectedFamilies?: string[];
    selectedControlIds?: string[];
    excludedControlIds?: string[];
    uneditedControlsMode?: UneditedControlsMode;
  };

  // Source project info (if created from existing project)
  sourceProjectId?: number;
  sourceProjectName?: string;
}

/**
 * Bulk control selection preset
 */
export interface ControlSelectionPreset {
  id: string;
  name: string;
  description: string;
  controlIds: string[];
  baseline?: SSPBaseline;
  category?: 'baseline' | 'topology' | 'compliance-focus' | 'custom';
}

/**
 * Bulk selection options for control selection
 */
export interface BulkSelectionOptions {
  // Select by priority
  includeCritical?: boolean;
  includeHigh?: boolean;
  includeMedium?: boolean;
  includeLow?: boolean;

  // Select by topology analysis
  includeTopologyRecommended?: boolean;

  // Select by family
  includeFamilies?: string[];
  excludeFamilies?: string[];
}

