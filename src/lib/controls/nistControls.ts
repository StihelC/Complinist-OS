/**
 * NIST 800-53 Rev 5 Control Catalog
 * 
 * Simplified control catalog with key controls for LOW, MODERATE, and HIGH baselines.
 * This is a representative subset - a full implementation would include all controls.
 */

import { NISTControl, NISTControlFamily } from '@/lib/utils/types';

/**
 * NIST Control Families
 */
export const CONTROL_FAMILIES: NISTControlFamily[] = [
  {
    id: 'AC',
    name: 'Access Control',
    controls: []
  },
  {
    id: 'AU',
    name: 'Audit and Accountability',
    controls: []
  },
  {
    id: 'AT',
    name: 'Awareness and Training',
    controls: []
  },
  {
    id: 'CM',
    name: 'Configuration Management',
    controls: []
  },
  {
    id: 'CP',
    name: 'Contingency Planning',
    controls: []
  },
  {
    id: 'IA',
    name: 'Identification and Authentication',
    controls: []
  },
  {
    id: 'IR',
    name: 'Incident Response',
    controls: []
  },
  {
    id: 'MA',
    name: 'Maintenance',
    controls: []
  },
  {
    id: 'MP',
    name: 'Media Protection',
    controls: []
  },
  {
    id: 'PE',
    name: 'Physical and Environmental Protection',
    controls: []
  },
  {
    id: 'PL',
    name: 'Planning',
    controls: []
  },
  {
    id: 'PS',
    name: 'Personnel Security',
    controls: []
  },
  {
    id: 'RA',
    name: 'Risk Assessment',
    controls: []
  },
  {
    id: 'SA',
    name: 'System and Services Acquisition',
    controls: []
  },
  {
    id: 'SC',
    name: 'System and Communications Protection',
    controls: []
  },
  {
    id: 'SI',
    name: 'System and Information Integrity',
    controls: []
  },
  {
    id: 'SR',
    name: 'Supply Chain Risk Management',
    controls: []
  }
];

/**
 * Sample NIST Controls (representative subset)
 * In a full implementation, this would include all 1000+ controls
 */
export const NIST_CONTROLS: NISTControl[] = [
  // Access Control
  {
    id: 'AC-1',
    family: 'AC',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate access control policy and procedures.',
  },
  {
    id: 'AC-2',
    family: 'AC',
    title: 'Account Management',
    objective: 'Create, enable, modify, disable, and remove accounts in accordance with organizational policy.',
  },
  {
    id: 'AC-3',
    family: 'AC',
    title: 'Access Enforcement',
    objective: 'Enforce approved authorizations for logical access to information and system resources.',
  },
  {
    id: 'AC-4',
    family: 'AC',
    title: 'Information Flow Enforcement',
    objective: 'Enforce approved authorizations for controlling the flow of information within the system.',
  },
  {
    id: 'AC-7',
    family: 'AC',
    title: 'Unsuccessful Logon Attempts',
    objective: 'Enforce a limit of consecutive invalid logon attempts by a user during a time period.',
  },
  {
    id: 'AC-8',
    family: 'AC',
    title: 'System Use Notification',
    objective: 'Display an approved system use notification message before granting access.',
  },
  {
    id: 'AC-17',
    family: 'AC',
    title: 'Remote Access',
    objective: 'Control and monitor methods for remote access to the system.',
  },
  {
    id: 'AC-19',
    family: 'AC',
    title: 'Access Control for Mobile Devices',
    objective: 'Establish usage restrictions and implementation guidance for mobile devices.',
  },
  
  // Audit and Accountability
  {
    id: 'AU-1',
    family: 'AU',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate audit and accountability policy and procedures.',
  },
  {
    id: 'AU-2',
    family: 'AU',
    title: 'Audit Events',
    objective: 'Determine the events that need to be audited.',
  },
  {
    id: 'AU-3',
    family: 'AU',
    title: 'Content of Audit Records',
    objective: 'Ensure audit records contain information that establishes what, when, where, who, and how.',
  },
  {
    id: 'AU-4',
    family: 'AU',
    title: 'Audit Log Storage Capacity',
    objective: 'Allocate audit log storage capacity and configure auditing to reduce the likelihood of storage capacity being exceeded.',
  },
  {
    id: 'AU-5',
    family: 'AU',
    title: 'Response to Audit Logging Failures',
    objective: 'Alert designated organizational officials in the event of an audit logging failure.',
  },
  {
    id: 'AU-6',
    family: 'AU',
    title: 'Audit Record Review, Analysis, and Reporting',
    objective: 'Review and analyze audit records for indications of inappropriate or unusual activity.',
  },
  {
    id: 'AU-11',
    family: 'AU',
    title: 'Audit Record Retention',
    objective: 'Retain audit records for a time period consistent with records retention requirements.',
  },
  
  // Identification and Authentication
  {
    id: 'IA-1',
    family: 'IA',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate identification and authentication policy and procedures.',
  },
  {
    id: 'IA-2',
    family: 'IA',
    title: 'Identification and Authentication (Organizational Users)',
    objective: 'Uniquely identify and authenticate organizational users.',
  },
  {
    id: 'IA-3',
    family: 'IA',
    title: 'Device Identification and Authentication',
    objective: 'Uniquely identify and authenticate devices before establishing connections.',
  },
  {
    id: 'IA-4',
    family: 'IA',
    title: 'Identifier Management',
    objective: 'Manage identifiers by uniquely identifying individuals, groups, roles, and devices.',
  },
  {
    id: 'IA-5',
    family: 'IA',
    title: 'Authenticator Management',
    objective: 'Manage authenticators for accounts by establishing initial authenticator content, developing authenticator policies and procedures, and changing or removing authenticators.',
  },
  {
    id: 'IA-8',
    family: 'IA',
    title: 'Identification and Authentication (Non-Organizational Users)',
    objective: 'Uniquely identify and authenticate non-organizational users.',
  },
  
  // System and Communications Protection
  {
    id: 'SC-1',
    family: 'SC',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate system and communications protection policy and procedures.',
  },
  {
    id: 'SC-5',
    family: 'SC',
    title: 'Denial-of-Service Protection',
    objective: 'Protect against or limit the effects of denial-of-service attacks.',
  },
  {
    id: 'SC-7',
    family: 'SC',
    title: 'Boundary Protection',
    objective: 'Monitor and control communications at the external managed interfaces to the system and at key internal managed interfaces.',
  },
  {
    id: 'SC-8',
    family: 'SC',
    title: 'Transmission Confidentiality and Integrity',
    objective: 'Protect the confidentiality and integrity of transmitted information.',
  },
  {
    id: 'SC-12',
    family: 'SC',
    title: 'Cryptographic Key Establishment and Management',
    objective: 'Establish and manage cryptographic keys when cryptography is employed.',
  },
  {
    id: 'SC-13',
    family: 'SC',
    title: 'Cryptographic Protection',
    objective: 'Employ cryptographic mechanisms to protect the confidentiality and integrity of information.',
  },
  {
    id: 'SC-28',
    family: 'SC',
    title: 'Protection of Information at Rest',
    objective: 'Protect the confidentiality and integrity of information at rest.',
  },
  
  // System and Information Integrity
  {
    id: 'SI-1',
    family: 'SI',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate system and information integrity policy and procedures.',
  },
  {
    id: 'SI-2',
    family: 'SI',
    title: 'Flaw Remediation',
    objective: 'Identify, report, and correct system flaws.',
  },
  {
    id: 'SI-3',
    family: 'SI',
    title: 'Malicious Code Protection',
    objective: 'Implement malicious code protection mechanisms at system entry and exit points.',
  },
  {
    id: 'SI-4',
    family: 'SI',
    title: 'System Monitoring',
    objective: 'Monitor the system to detect attacks and indicators of potential attacks.',
  },
  {
    id: 'SI-5',
    family: 'SI',
    title: 'Security Alerts, Advisories, and Directives',
    objective: 'Receive and respond to security alerts, advisories, and directives from external organizations.',
  },
  {
    id: 'SI-7',
    family: 'SI',
    title: 'Software, Firmware, and Information Integrity',
    objective: 'Employ integrity verification tools to detect unauthorized changes to software, firmware, and information.',
  },
  
  // Configuration Management
  {
    id: 'CM-1',
    family: 'CM',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate configuration management policy and procedures.',
  },
  {
    id: 'CM-2',
    family: 'CM',
    title: 'Baseline Configuration',
    objective: 'Develop, document, and maintain current baseline configuration of the system.',
  },
  {
    id: 'CM-4',
    family: 'CM',
    title: 'Security Impact Analysis',
    objective: 'Analyze changes to the system to determine potential security impacts prior to change implementation.',
  },
  {
    id: 'CM-5',
    family: 'CM',
    title: 'Access Restrictions for Change',
    objective: 'Define, document, approve, and enforce physical and logical access restrictions associated with changes to the system.',
  },
  {
    id: 'CM-6',
    family: 'CM',
    title: 'Configuration Settings',
    objective: 'Establish and document configuration settings for components employed within the system.',
  },
  {
    id: 'CM-7',
    family: 'CM',
    title: 'Least Functionality',
    objective: 'Configure the system to provide only essential capabilities and prohibit the use of functions, ports, protocols, and services that are not necessary for mission or business functions.',
  },
  {
    id: 'CM-8',
    family: 'CM',
    title: 'System Component Inventory',
    objective: 'Develop and document an inventory of system components that accurately reflects the current system.',
  },
  
  // Contingency Planning
  {
    id: 'CP-1',
    family: 'CP',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate contingency planning policy and procedures.',
  },
  {
    id: 'CP-2',
    family: 'CP',
    title: 'Contingency Plan',
    objective: 'Develop and document a contingency plan for the system.',
  },
  {
    id: 'CP-4',
    family: 'CP',
    title: 'Contingency Plan Testing',
    objective: 'Test the contingency plan for the system to determine the plan\'s effectiveness and the system\'s ability to meet contingency objectives.',
  },
  {
    id: 'CP-6',
    family: 'CP',
    title: 'Alternate Storage Site',
    objective: 'Establish an alternate storage site including necessary agreements to permit the storage and retrieval of system backup information.',
  },
  {
    id: 'CP-9',
    family: 'CP',
    title: 'System Backup',
    objective: 'Conduct backups of user-level and system-level information contained in the system.',
  },
  
  // Risk Assessment
  {
    id: 'RA-1',
    family: 'RA',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate risk assessment policy and procedures.',
  },
  {
    id: 'RA-2',
    family: 'RA',
    title: 'Security Categorization',
    objective: 'Categorize the system and information processed, stored, and transmitted by the system.',
  },
  {
    id: 'RA-3',
    family: 'RA',
    title: 'Risk Assessment',
    objective: 'Conduct a risk assessment, including threat and vulnerability analyses, to inform risk response decisions.',
  },
  {
    id: 'RA-5',
    family: 'RA',
    title: 'Vulnerability Monitoring and Scanning',
    objective: 'Monitor and scan for vulnerabilities in the system and hosted applications and when new vulnerabilities potentially affecting the system are identified and reported.',
  },
  
  // Planning
  {
    id: 'PL-1',
    family: 'PL',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate planning policy and procedures.',
  },
  {
    id: 'PL-2',
    family: 'PL',
    title: 'System Security and Privacy Plans',
    objective: 'Develop security and privacy plans for the system that are consistent with the organization\'s enterprise architecture.',
  },
  {
    id: 'PL-8',
    family: 'PL',
    title: 'Security and Privacy Architectures',
    objective: 'Develop and implement security and privacy architectures for the system.',
  },
  
  // Incident Response
  {
    id: 'IR-1',
    family: 'IR',
    title: 'Policy and Procedures',
    objective: 'Develop, document, and disseminate incident response policy and procedures.',
  },
  {
    id: 'IR-2',
    family: 'IR',
    title: 'Incident Response Training',
    objective: 'Provide incident response training to system users consistent with assigned roles and responsibilities.',
  },
  {
    id: 'IR-4',
    family: 'IR',
    title: 'Incident Handling',
    objective: 'Implement an incident handling capability for security and privacy incidents.',
  },
  {
    id: 'IR-5',
    family: 'IR',
    title: 'Incident Monitoring',
    objective: 'Track and document security and privacy incidents.',
  },
  {
    id: 'IR-6',
    family: 'IR',
    title: 'Incident Reporting',
    objective: 'Require personnel to report suspected security and privacy incidents.',
  },
  {
    id: 'IR-8',
    family: 'IR',
    title: 'Incident Response Plan',
    objective: 'Establish an operational incident response capability for the system.',
  }
];

/**
 * Get controls by family
 */
export function getControlsByFamily(family: string): NISTControl[] {
  return NIST_CONTROLS.filter(control => control.family === family);
}

/**
 * Get control by ID
 */
export function getControlById(controlId: string): NISTControl | undefined {
  return NIST_CONTROLS.find(control => control.id === controlId);
}

/**
 * Get all control families with their controls
 */
export function getControlFamiliesWithControls(): NISTControlFamily[] {
  return CONTROL_FAMILIES.map(family => ({
    ...family,
    controls: getControlsByFamily(family.id)
  })).filter(family => family.controls.length > 0);
}

