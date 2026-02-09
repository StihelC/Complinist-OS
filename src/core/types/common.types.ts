// Common types used across multiple domains

// Security Classifications
export type SecurityZone = 'untrusted' | 'dmz' | 'trusted' | 'internal';
export type AssetValue = 'low' | 'moderate' | 'high';
export type VulnerabilityManagement = 'none' | 'quarterly' | 'monthly' | 'continuous';
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial';
export type SecurityLevel = 'unclassified' | 'confidential' | 'secret';
export type DataFlow = 'bidirectional' | 'source-to-target' | 'target-to-source';

// Network Layer
export type NetworkLayer = 
  | 'Physical'
  | 'Data Link'
  | 'Network'
  | 'Application';

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

