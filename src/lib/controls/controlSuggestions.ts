import { DeviceType } from '@/lib/utils/types';
import type { DeviceCategorySummary } from '@/lib/topology/topologyAnalyzer';

/**
 * Control Suggestions Engine
 * 
 * Maps device types and categories to recommended NIST controls.
 */

export interface ControlSuggestion {
  controlId: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

// Map device categories to recommended controls
const categoryControlMap: Record<DeviceCategorySummary, ControlSuggestion[]> = {
  'server': [
    { controlId: 'AC-2', priority: 'high', reason: 'Account management for privileged access' },
    { controlId: 'AC-3', priority: 'high', reason: 'Access enforcement for server resources' },
    { controlId: 'AU-2', priority: 'high', reason: 'Audit logging for server activities' },
    { controlId: 'AU-9', priority: 'medium', reason: 'Protection of audit information' },
    { controlId: 'SC-28', priority: 'high', reason: 'Encryption at rest for sensitive data' },
    { controlId: 'SI-2', priority: 'high', reason: 'Flaw remediation and patch management' },
    { controlId: 'SI-3', priority: 'medium', reason: 'Malware protection' },
    { controlId: 'CM-8', priority: 'medium', reason: 'System component inventory' },
  ],
  'security': [
    { controlId: 'SC-7', priority: 'high', reason: 'Boundary protection enforcement' },
    { controlId: 'SC-8', priority: 'high', reason: 'Transmission confidentiality and integrity' },
    { controlId: 'AC-4', priority: 'high', reason: 'Information flow enforcement' },
    { controlId: 'AU-2', priority: 'high', reason: 'Auditable events for security devices' },
    { controlId: 'AU-6', priority: 'medium', reason: 'Audit review, analysis, and reporting' },
    { controlId: 'SI-4', priority: 'medium', reason: 'Information system monitoring' },
  ],
  'network': [
    { controlId: 'SC-7', priority: 'high', reason: 'Network boundary protection' },
    { controlId: 'SC-8', priority: 'medium', reason: 'Transmission security' },
    { controlId: 'CM-7', priority: 'medium', reason: 'Least functionality configuration' },
    { controlId: 'AU-2', priority: 'medium', reason: 'Audit logging for network events' },
    { controlId: 'CM-8', priority: 'medium', reason: 'Network device inventory' },
  ],
  'endpoint': [
    { controlId: 'AC-2', priority: 'high', reason: 'Local account management' },
    { controlId: 'SI-3', priority: 'high', reason: 'Malware protection for endpoints' },
    { controlId: 'SI-7', priority: 'medium', reason: 'Software and information integrity' },
    { controlId: 'CM-8', priority: 'medium', reason: 'Endpoint inventory tracking' },
    { controlId: 'SC-28', priority: 'medium', reason: 'Full-disk encryption' },
  ],
  'other': [
    { controlId: 'CM-8', priority: 'medium', reason: 'Component inventory' },
    { controlId: 'AC-2', priority: 'low', reason: 'Basic account management' },
  ],
};

// Specific device type overrides for more granular control
const deviceTypeOverrides: Partial<Record<DeviceType, ControlSuggestion[]>> = {
  'firewall': [
    { controlId: 'SC-7', priority: 'high', reason: 'Firewall boundary protection' },
    { controlId: 'SC-8', priority: 'high', reason: 'Traffic encryption enforcement' },
    { controlId: 'AC-4', priority: 'high', reason: 'Traffic flow enforcement' },
    { controlId: 'AU-2', priority: 'high', reason: 'Firewall event logging' },
    { controlId: 'CM-6', priority: 'medium', reason: 'Firewall configuration settings' },
  ],
  'database-server': [
    { controlId: 'SC-28', priority: 'high', reason: 'Database encryption at rest' },
    { controlId: 'AU-9', priority: 'high', reason: 'Database audit log protection' },
    { controlId: 'AC-3', priority: 'high', reason: 'Database access control' },
    { controlId: 'AC-2', priority: 'high', reason: 'Database account management' },
    { controlId: 'SI-2', priority: 'medium', reason: 'Database patching' },
  ],
  'web-server': [
    { controlId: 'SC-7', priority: 'high', reason: 'Web server boundary protection' },
    { controlId: 'SC-8', priority: 'high', reason: 'HTTPS/TLS enforcement' },
    { controlId: 'AC-2', priority: 'high', reason: 'Web server account management' },
    { controlId: 'SI-3', priority: 'medium', reason: 'Web malware protection' },
    { controlId: 'SI-10', priority: 'medium', reason: 'Input validation' },
  ],
  'vpn-gateway': [
    { controlId: 'SC-8', priority: 'high', reason: 'VPN encryption' },
    { controlId: 'SC-13', priority: 'high', reason: 'Cryptographic protection' },
    { controlId: 'AC-17', priority: 'high', reason: 'Remote access control' },
    { controlId: 'IA-2', priority: 'high', reason: 'VPN authentication' },
  ],
  'router': [
    { controlId: 'SC-7', priority: 'high', reason: 'Network routing boundaries' },
    { controlId: 'CM-7', priority: 'medium', reason: 'Router hardening' },
    { controlId: 'AU-2', priority: 'medium', reason: 'Router event logging' },
  ],
  'switch': [
    { controlId: 'SC-7', priority: 'medium', reason: 'Switch-level network segmentation' },
    { controlId: 'CM-7', priority: 'medium', reason: 'Switch port security' },
    { controlId: 'AU-2', priority: 'low', reason: 'Switch event logging' },
  ],
  'workstation': [
    { controlId: 'AC-2', priority: 'high', reason: 'User account management' },
    { controlId: 'SI-3', priority: 'high', reason: 'Endpoint malware protection' },
    { controlId: 'SC-28', priority: 'medium', reason: 'Full-disk encryption' },
    { controlId: 'CM-8', priority: 'medium', reason: 'Workstation inventory' },
  ],
  'laptop': [
    { controlId: 'AC-2', priority: 'high', reason: 'Mobile device account management' },
    { controlId: 'SI-3', priority: 'high', reason: 'Mobile malware protection' },
    { controlId: 'SC-28', priority: 'high', reason: 'Laptop encryption (mobile risk)' },
    { controlId: 'MP-7', priority: 'medium', reason: 'Media use controls' },
  ],
};

/**
 * Get suggested controls for a device
 */
export function getSuggestedControls(
  deviceType: DeviceType,
  deviceCategory: DeviceCategorySummary
): ControlSuggestion[] {
  // Check for device-specific overrides first
  if (deviceTypeOverrides[deviceType]) {
    return deviceTypeOverrides[deviceType]!;
  }

  // Fall back to category-based suggestions
  return categoryControlMap[deviceCategory] || categoryControlMap['other'];
}

/**
 * Get control IDs only (simplified version)
 */
export function getSuggestedControlIds(
  deviceType: DeviceType,
  deviceCategory: DeviceCategorySummary
): string[] {
  const suggestions = getSuggestedControls(deviceType, deviceCategory);
  return suggestions.map(s => s.controlId);
}

/**
 * Get high-priority controls only
 */
export function getHighPriorityControls(
  deviceType: DeviceType,
  deviceCategory: DeviceCategorySummary
): ControlSuggestion[] {
  const suggestions = getSuggestedControls(deviceType, deviceCategory);
  return suggestions.filter(s => s.priority === 'high');
}

/**
 * Check if a device type should trigger control suggestions
 */
export function shouldSuggestControls(deviceType: DeviceType): boolean {
  // Don't suggest for generic/unknown types
  const skipTypes: DeviceType[] = ['endpoint', 'generic-appliance'];
  return !skipTypes.includes(deviceType);
}

/**
 * Get minimum recommended control count for device category
 */
export function getMinimumControlCount(deviceCategory: DeviceCategorySummary): number {
  switch (deviceCategory) {
    case 'server':
      return 4;
    case 'security':
      return 4;
    case 'network':
      return 3;
    case 'endpoint':
      return 3;
    case 'other':
      return 1;
    default:
      return 2;
  }
}

