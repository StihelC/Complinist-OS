import type { DeviceCategorySummary } from '@/lib/topology/topologyAnalyzer';

/**
 * Control Templates
 * 
 * Pre-filled implementation notes for common control/device combinations.
 * Templates include TODO placeholders for user customization.
 */

type ControlTemplateMap = Record<string, string>;

// Templates for server-class devices
const serverTemplates: ControlTemplateMap = {
  'AC-2': 'Centralized authentication via Active Directory/LDAP. Role-based access control enforced. Admin accounts require manager approval. [TODO: Document authentication mechanism and approval workflow]',
  
  'AC-3': 'Access enforcement implemented through role-based permissions and file system ACLs. Privileged access restricted to authorized administrators. [TODO: List authorized admin roles]',
  
  'AU-2': 'Audit logging captures login attempts, privilege escalation, file access, and configuration changes. Logs forwarded to central SIEM. [TODO: Specify log retention period]',
  
  'AU-9': 'Audit logs protected with restricted file permissions. Log files immutable during retention period. Centralized log storage with access controls. [TODO: Specify backup location]',
  
  'SC-28': 'Full-disk encryption enabled using BitLocker/LUKS. Data-at-rest encryption configured. Encryption keys managed by enterprise key management system. [TODO: Specify key management system and key rotation schedule]',
  
  'SI-2': 'Automated patch management via WSUS/Satellite. Security patches applied within 30 days of release. Critical vulnerabilities remediated within 7 days. [TODO: Document patch testing procedure]',
  
  'SI-3': 'Enterprise antivirus/EDR solution deployed with real-time scanning. Definitions updated daily. Quarantine procedures documented. [TODO: Specify AV product and update schedule]',
  
  'CM-8': 'Server included in automated asset inventory system. Configuration tracked via CMDB. Inventory updated automatically upon deployment. [TODO: Specify CMDB system]',
  
  'CM-6': 'Baseline configuration aligned with CIS benchmarks. Configuration drift monitored via configuration management tools. [TODO: Specify configuration standard version]',
};

// Templates for security devices (firewalls, IDS/IPS, etc.)
const securityTemplates: ControlTemplateMap = {
  'SC-7': 'Deny-by-default ruleset enforced. Inbound rules: [TODO: list allowed ports/services]. Outbound rules: [TODO: list allowed destinations]. Rule reviews conducted quarterly. Last review: [TODO: date]',
  
  'SC-8': 'All traffic inspected for encryption compliance. VPN required for remote access. TLS 1.2+ enforced for web traffic. [TODO: Specify encryption protocols and cipher suites]',
  
  'AC-4': 'Traffic flow enforcement via stateful inspection. Inter-zone traffic requires explicit allow rules. DMZ traffic restricted to necessary ports only. [TODO: Document zone-to-zone policies]',
  
  'AU-2': 'Logging enabled for all traffic decisions (allow/deny), configuration changes, and admin access. Logs sent to SIEM in real-time. [TODO: Specify SIEM destination]',
  
  'AU-6': 'Firewall logs reviewed daily for anomalies. Automated alerts configured for policy violations. Monthly trend analysis performed. [TODO: Specify alert thresholds]',
  
  'SI-4': 'Continuous monitoring of traffic patterns. IDS/IPS signatures updated automatically. Real-time alerting for suspicious activity. [TODO: Specify monitoring tools]',
  
  'CM-6': 'Firewall configuration follows vendor hardening guidelines. Management access restricted to secure jump hosts. Configuration backups automated nightly. [TODO: Specify backup retention]',
  
  'CM-7': 'Unnecessary services disabled. Management interfaces restricted to dedicated management network. Default credentials changed. [TODO: List enabled services]',
};

// Templates for network devices (routers, switches)
const networkTemplates: ControlTemplateMap = {
  'SC-7': 'Network segmentation implemented via VLANs and ACLs. Inter-VLAN routing controlled by ACL policies. Guest network isolated from internal resources. [TODO: Document VLAN scheme]',
  
  'SC-8': 'Management traffic encrypted via SSH/HTTPS. SNMPv3 with authentication enabled. Clear-text protocols disabled. [TODO: Specify management protocols]',
  
  'CM-7': 'Router/switch hardened per CIS benchmarks. Unnecessary protocols disabled (CDP, LLDP on external ports). Console access requires physical presence. [TODO: List disabled protocols]',
  
  'AU-2': 'Logging enabled for authentication events, configuration changes, and interface status changes. Logs sent to syslog server. [TODO: Specify syslog server]',
  
  'CM-8': 'Network device included in automated discovery and inventory system. Port mapping documented. Configuration archived in version control. [TODO: Specify inventory system]',
  
  'CM-6': 'Configuration baseline maintained in Git repository. Changes require change control approval. Automated compliance scanning performed weekly. [TODO: Specify change control process]',
};

// Templates for endpoint devices (workstations, laptops)
const endpointTemplates: ControlTemplateMap = {
  'AC-2': 'Local accounts disabled except emergency admin. Users authenticate via Active Directory. Standard user privileges enforced. Privileged access requires approval. [TODO: Document privilege escalation process]',
  
  'SI-3': 'Endpoint protection platform deployed with real-time scanning, behavioral analysis, and exploit prevention. Definitions updated hourly. [TODO: Specify EPP product]',
  
  'SI-7': 'Software integrity verified via code signing. Application whitelisting enforced. Unauthorized software installation blocked. [TODO: Specify whitelisting solution]',
  
  'CM-8': 'Endpoint included in asset management system. Hardware/software inventory collected via agent. Location tracking enabled for mobile devices. [TODO: Specify asset management tool]',
  
  'SC-28': 'Full-disk encryption enabled via BitLocker/FileVault. Encryption keys escrowed in enterprise key management. Pre-boot authentication required. [TODO: Specify key escrow location]',
  
  'MP-7': 'Removable media usage restricted via Group Policy. USB ports disabled except for approved devices. Data loss prevention monitors file transfers. [TODO: Specify DLP policy]',
  
  'SI-2': 'Automated patch deployment via endpoint management. Patches applied within 14 days. Critical patches expedited. [TODO: Specify patch management tool]',
};

// Templates for database servers
const databaseTemplates: ControlTemplateMap = {
  'SC-28': 'Transparent Data Encryption (TDE) enabled for all databases. Encryption keys rotated annually. Backup encryption enabled. Key management via [TODO: specify KMS solution]',
  
  'AU-9': 'Database audit logs protected with restricted permissions. Audit trail immutability enforced. Logs archived to write-once media. [TODO: Specify audit log retention]',
  
  'AC-3': 'Database access controlled via role-based permissions. Application service accounts use least-privilege principles. Direct user access restricted. [TODO: Document role assignments]',
  
  'AC-2': 'Database account lifecycle managed through IAM system. Shared accounts prohibited. Service account passwords rotated quarterly. [TODO: Specify account review frequency]',
  
  'SI-2': 'Database patching coordinated with vendor security advisories. Test environment validates patches before production. Maintenance window: [TODO: specify window]',
  
  'AU-2': 'Database auditing captures all DDL, privileged operations, and sensitive data access. Audit records include timestamp, user, and query details. [TODO: Specify audit policy]',
};

// Aggregate templates by device category
const categoryTemplates: Record<DeviceCategorySummary, ControlTemplateMap> = {
  'server': { ...serverTemplates, ...databaseTemplates },
  'security': securityTemplates,
  'network': networkTemplates,
  'endpoint': endpointTemplates,
  'other': {
    'CM-8': 'Device included in enterprise inventory system. Asset tag assigned. Configuration documented. [TODO: Specify inventory details]',
    'AC-2': 'Account management follows organizational policy. Accounts created/disabled via IAM workflow. [TODO: Document account management process]',
  },
};

/**
 * Get template text for a control/device category combination
 */
export function getControlTemplate(
  deviceCategory: DeviceCategorySummary,
  controlId: string
): string | null {
  const templates = categoryTemplates[deviceCategory];
  return templates?.[controlId] || null;
}

/**
 * Get all available templates for a device category
 */
export function getAvailableTemplates(
  deviceCategory: DeviceCategorySummary
): string[] {
  const templates = categoryTemplates[deviceCategory];
  return templates ? Object.keys(templates) : [];
}

/**
 * Check if a template exists for a control/device combination
 */
export function hasTemplate(
  deviceCategory: DeviceCategorySummary,
  controlId: string
): boolean {
  return getControlTemplate(deviceCategory, controlId) !== null;
}

/**
 * Get a simplified, shorter template (for quick fill)
 */
export function getShortTemplate(
  deviceCategory: DeviceCategorySummary,
  controlId: string
): string | null {
  const fullTemplate = getControlTemplate(deviceCategory, controlId);
  if (!fullTemplate) return null;
  
  // Return first sentence only
  const firstSentence = fullTemplate.split('.')[0];
  return firstSentence ? firstSentence + '.' : fullTemplate;
}

