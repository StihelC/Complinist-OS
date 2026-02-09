/**
 * Device Property Registry
 * 
 * Centralized field definitions for all device properties.
 * Used for validation, UI rendering, and property management.
 */

import { DeviceMetadata } from '@/lib/utils/types';

export type PropertyFieldType = 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'date' | 'email' | 'url';
export type PropertyRequirement = 'required' | 'recommended' | 'optional';
export type PropertyValidator = 'ipAddress' | 'macAddress' | 'email' | 'url' | 'positiveInteger' | 'portNumber' | 'nonEmpty' | 'date';

export interface PropertyFieldDefinition {
  /** Field name (key in DeviceMetadata) */
  fieldName: keyof DeviceMetadata;
  
  /** Where to store: 'direct' (on device) or 'config' (in device.config) - always 'direct' for our implementation */
  storagePath: 'direct';
  
  /** Field type for UI rendering */
  fieldType: PropertyFieldType;
  
  /** Requirement level */
  requirement: PropertyRequirement;
  
  /** Validator function name */
  validator?: PropertyValidator;
  
  /** Default value */
  defaultValue?: any;
  
  /** Field description */
  description: string;
  
  /** Select options (for select fields) */
  options?: Array<{ value: string; label: string }>;
  
  /** Category for grouping in UI */
  category: 'Basic' | 'Network' | 'Hardware' | 'Software' | 'Security' | 'Compliance' | 'Ownership' | 'Visual';
}

/**
 * Complete property field registry
 */
export const DEVICE_PROPERTY_FIELDS: Record<string, PropertyFieldDefinition> = {
  // ============================================
  // BASIC FIELDS
  // ============================================
  name: {
    fieldName: 'name',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'required',
    validator: 'nonEmpty',
    description: 'Device name',
    category: 'Basic',
  },
  
  deviceType: {
    fieldName: 'deviceType',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'required',
    description: 'Device type',
    category: 'Basic',
  },
  
  deviceSubtype: {
    fieldName: 'deviceSubtype',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Device subtype or variant',
    category: 'Basic',
  },
  
  // ============================================
  // NETWORK PROPERTIES
  // ============================================
  ipAddress: {
    fieldName: 'ipAddress',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    validator: 'ipAddress',
    description: 'IP address (IPv4 or IPv6)',
    category: 'Network',
  },
  
  macAddress: {
    fieldName: 'macAddress',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    validator: 'macAddress',
    description: 'MAC address',
    category: 'Network',
  },
  
  subnetMask: {
    fieldName: 'subnetMask',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    validator: 'ipAddress',
    description: 'Subnet mask',
    category: 'Network',
  },
  
  defaultGateway: {
    fieldName: 'defaultGateway',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    validator: 'ipAddress',
    description: 'Default gateway',
    category: 'Network',
  },
  
  hostname: {
    fieldName: 'hostname',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Hostname or FQDN',
    category: 'Network',
  },
  
  dnsServers: {
    fieldName: 'dnsServers',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'DNS servers (comma-separated)',
    category: 'Network',
  },
  
  vlanId: {
    fieldName: 'vlanId',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'VLAN ID',
    category: 'Network',
  },
  
  ports: {
    fieldName: 'ports',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Open ports (comma-separated)',
    category: 'Network',
  },
  
  // ============================================
  // HARDWARE PROPERTIES
  // ============================================
  manufacturer: {
    fieldName: 'manufacturer',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Device manufacturer',
    category: 'Hardware',
  },
  
  model: {
    fieldName: 'model',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Device model',
    category: 'Hardware',
  },
  
  serialNumber: {
    fieldName: 'serialNumber',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Serial number',
    category: 'Hardware',
  },
  
  firmwareVersion: {
    fieldName: 'firmwareVersion',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Firmware version',
    category: 'Hardware',
  },
  
  cpuModel: {
    fieldName: 'cpuModel',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'CPU model',
    category: 'Hardware',
  },
  
  memorySize: {
    fieldName: 'memorySize',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Memory size (e.g., "16GB")',
    category: 'Hardware',
  },
  
  storageSize: {
    fieldName: 'storageSize',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Storage size (e.g., "500GB")',
    category: 'Hardware',
  },
  
  // ============================================
  // SOFTWARE PROPERTIES
  // ============================================
  operatingSystem: {
    fieldName: 'operatingSystem',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Operating System',
    category: 'Software',
  },
  
  osVersion: {
    fieldName: 'osVersion',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'OS version',
    category: 'Software',
  },
  
  software: {
    fieldName: 'software',
    storagePath: 'direct',
    fieldType: 'textarea',
    requirement: 'optional',
    description: 'Installed software (one per line)',
    category: 'Software',
  },
  
  patchLevel: {
    fieldName: 'patchLevel',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Patch level',
    category: 'Software',
  },
  
  lastPatchDate: {
    fieldName: 'lastPatchDate',
    storagePath: 'direct',
    fieldType: 'date',
    requirement: 'optional',
    validator: 'date',
    description: 'Last patch date',
    category: 'Software',
  },
  
  // ============================================
  // SECURITY PROPERTIES
  // ============================================
  securityZone: {
    fieldName: 'securityZone',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'recommended',
    description: 'Security zone',
    options: [
      { value: 'untrusted', label: 'Untrusted' },
      { value: 'dmz', label: 'DMZ' },
      { value: 'trusted', label: 'Trusted' },
      { value: 'internal', label: 'Internal' },
    ],
    category: 'Security',
  },
  
  assetValue: {
    fieldName: 'assetValue',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'recommended',
    description: 'Asset value',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'high', label: 'High' },
    ],
    category: 'Security',
  },
  
  missionCritical: {
    fieldName: 'missionCritical',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Mission critical device',
    category: 'Security',
  },
  
  dataClassification: {
    fieldName: 'dataClassification',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Data classification level',
    category: 'Security',
  },
  
  multifactorAuth: {
    fieldName: 'multifactorAuth',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Multi-factor authentication enabled',
    category: 'Security',
  },
  
  encryptionAtRest: {
    fieldName: 'encryptionAtRest',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Encryption at rest enabled',
    category: 'Security',
  },
  
  encryptionInTransit: {
    fieldName: 'encryptionInTransit',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Encryption in transit enabled',
    category: 'Security',
  },
  
  encryptionStatus: {
    fieldName: 'encryptionStatus',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'optional',
    description: 'Overall encryption status',
    options: [
      { value: 'Enabled', label: 'Enabled' },
      { value: 'Partial', label: 'Partial' },
      { value: 'Not Configured', label: 'Not Configured' },
    ],
    category: 'Security',
  },
  
  backupsConfigured: {
    fieldName: 'backupsConfigured',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Backups configured',
    category: 'Security',
  },
  
  monitoringEnabled: {
    fieldName: 'monitoringEnabled',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Monitoring enabled',
    category: 'Security',
  },
  
  vulnerabilityManagement: {
    fieldName: 'vulnerabilityManagement',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'optional',
    description: 'Vulnerability management frequency',
    options: [
      { value: 'none', label: 'None' },
      { value: 'quarterly', label: 'Quarterly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'continuous', label: 'Continuous' },
    ],
    category: 'Security',
  },
  
  riskLevel: {
    fieldName: 'riskLevel',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'recommended',
    defaultValue: 'Moderate',
    description: 'Risk level',
    options: [
      { value: 'Low', label: 'Low' },
      { value: 'Moderate', label: 'Moderate' },
      { value: 'High', label: 'High' },
    ],
    category: 'Security',
  },
  
  criticality: {
    fieldName: 'criticality',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'optional',
    description: 'Criticality level',
    options: [
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
      { value: 'Critical', label: 'Critical' },
    ],
    category: 'Security',
  },
  
  firewallEnabled: {
    fieldName: 'firewallEnabled',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Firewall enabled',
    category: 'Security',
  },
  
  antivirusEnabled: {
    fieldName: 'antivirusEnabled',
    storagePath: 'direct',
    fieldType: 'boolean',
    requirement: 'optional',
    description: 'Antivirus enabled',
    category: 'Security',
  },
  
  // ============================================
  // COMPLIANCE PROPERTIES
  // ============================================
  applicableControls: {
    fieldName: 'applicableControls',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Applicable NIST controls (comma-separated)',
    category: 'Compliance',
  },
  
  lastVulnScan: {
    fieldName: 'lastVulnScan',
    storagePath: 'direct',
    fieldType: 'date',
    requirement: 'optional',
    validator: 'date',
    description: 'Last vulnerability scan date',
    category: 'Compliance',
  },
  
  complianceStatus: {
    fieldName: 'complianceStatus',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'recommended',
    description: 'Compliance status',
    options: [
      { value: 'compliant', label: 'Compliant' },
      { value: 'non-compliant', label: 'Non-Compliant' },
      { value: 'partial', label: 'Partial' },
    ],
    category: 'Compliance',
  },
  
  // ============================================
  // OWNERSHIP PROPERTIES
  // ============================================
  systemOwner: {
    fieldName: 'systemOwner',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'System owner',
    category: 'Ownership',
  },
  
  owner: {
    fieldName: 'owner',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Owner/Administrator',
    category: 'Ownership',
  },
  
  department: {
    fieldName: 'department',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Department name',
    category: 'Ownership',
  },
  
  contactEmail: {
    fieldName: 'contactEmail',
    storagePath: 'direct',
    fieldType: 'email',
    requirement: 'optional',
    validator: 'email',
    description: 'Contact email',
    category: 'Ownership',
  },
  
  location: {
    fieldName: 'location',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Physical location',
    category: 'Ownership',
  },
  
  costCenter: {
    fieldName: 'costCenter',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Cost center',
    category: 'Ownership',
  },
  
  purchaseDate: {
    fieldName: 'purchaseDate',
    storagePath: 'direct',
    fieldType: 'date',
    requirement: 'optional',
    validator: 'date',
    description: 'Purchase date',
    category: 'Ownership',
  },
  
  warrantyExpiration: {
    fieldName: 'warrantyExpiration',
    storagePath: 'direct',
    fieldType: 'date',
    requirement: 'optional',
    validator: 'date',
    description: 'Warranty expiration date',
    category: 'Ownership',
  },
  
  // ============================================
  // ADDITIONAL METADATA
  // ============================================
  notes: {
    fieldName: 'notes',
    storagePath: 'direct',
    fieldType: 'textarea',
    requirement: 'optional',
    description: 'General notes',
    category: 'Basic',
  },
  
  tags: {
    fieldName: 'tags',
    storagePath: 'direct',
    fieldType: 'string',
    requirement: 'optional',
    description: 'Tags (comma-separated)',
    category: 'Basic',
  },
  
  status: {
    fieldName: 'status',
    storagePath: 'direct',
    fieldType: 'select',
    requirement: 'optional',
    description: 'Device status',
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Inactive', label: 'Inactive' },
      { value: 'Maintenance', label: 'Maintenance' },
      { value: 'Retired', label: 'Retired' },
    ],
    category: 'Basic',
  },
};

/**
 * Get property value from device
 */
export function getDevicePropertyValue(device: DeviceMetadata, field: string): any {
  const fieldDef = DEVICE_PROPERTY_FIELDS[field];
  if (!fieldDef) return undefined;
  
  // All fields are stored directly on device
  return device[field as keyof DeviceMetadata];
}

/**
 * Get field definition
 */
export function getFieldDefinition(field: string): PropertyFieldDefinition | undefined {
  return DEVICE_PROPERTY_FIELDS[field];
}

/**
 * Get all fields by category
 */
export function getFieldsByCategory(category: PropertyFieldDefinition['category']): PropertyFieldDefinition[] {
  return Object.values(DEVICE_PROPERTY_FIELDS).filter(field => field.category === category);
}

