/**
 * Implementation Examples Database
 *
 * Provides real-world implementation examples for NIST 800-53 controls
 * organized by environment type. These examples help users understand
 * how controls are commonly implemented in practice.
 *
 * Environment Types:
 * - cloud-aws: AWS cloud environments
 * - cloud-azure: Azure cloud environments
 * - cloud-gcp: Google Cloud Platform environments
 * - on-premise: Traditional data center environments
 * - hybrid: Combined cloud and on-premise environments
 * - container: Kubernetes/container-based environments
 * - dod: Department of Defense specific implementations
 */

export type EnvironmentType =
  | 'cloud-aws'
  | 'cloud-azure'
  | 'cloud-gcp'
  | 'on-premise'
  | 'hybrid'
  | 'container'
  | 'dod'
  | 'generic';

export interface ImplementationExample {
  controlId: string;
  controlName: string;
  environment: EnvironmentType;
  title: string;
  bullets: string[];
  tools?: string[];
  notes?: string;
}

export interface EnvironmentPatterns {
  environment: EnvironmentType;
  displayName: string;
  description: string;
  commonTools: string[];
  indicators: string[]; // Topology indicators that suggest this environment
}

/**
 * Environment pattern definitions with detection indicators
 */
export const ENVIRONMENT_PATTERNS: EnvironmentPatterns[] = [
  {
    environment: 'cloud-aws',
    displayName: 'AWS Cloud',
    description: 'Amazon Web Services cloud environment',
    commonTools: ['AWS GuardDuty', 'CloudWatch', 'CloudTrail', 'IAM', 'VPC Flow Logs', 'AWS Config', 'Security Hub'],
    indicators: ['aws', 'ec2', 's3', 'lambda', 'rds', 'cloudwatch', 'guardduty', 'vpc']
  },
  {
    environment: 'cloud-azure',
    displayName: 'Azure Cloud',
    description: 'Microsoft Azure cloud environment',
    commonTools: ['Azure Sentinel', 'Azure Monitor', 'Azure AD', 'Key Vault', 'Azure Defender', 'Network Watcher'],
    indicators: ['azure', 'entra', 'microsoft', 'sentinel', 'defender', 'key-vault', 'virtual-machine', 'app-service']
  },
  {
    environment: 'cloud-gcp',
    displayName: 'Google Cloud',
    description: 'Google Cloud Platform environment',
    commonTools: ['Cloud Security Command Center', 'Cloud Logging', 'Cloud IAM', 'VPC Service Controls', 'Chronicle'],
    indicators: ['gcp', 'google', 'gke', 'bigquery', 'cloud-sql', 'compute-engine']
  },
  {
    environment: 'on-premise',
    displayName: 'On-Premise Data Center',
    description: 'Traditional on-premise data center',
    commonTools: ['Splunk', 'SIEM', 'Active Directory', 'Network IDS/IPS', 'VMware', 'Tripwire'],
    indicators: ['datacenter', 'physical', 'server', 'firewall', 'router', 'switch', 'on-prem']
  },
  {
    environment: 'hybrid',
    displayName: 'Hybrid Environment',
    description: 'Combined cloud and on-premise infrastructure',
    commonTools: ['Azure Arc', 'AWS Outposts', 'SIEM Integration', 'VPN Gateway', 'ExpressRoute'],
    indicators: ['hybrid', 'expressroute', 'vpn-gateway', 'outposts', 'azure-arc']
  },
  {
    environment: 'container',
    displayName: 'Container/Kubernetes',
    description: 'Container-based infrastructure',
    commonTools: ['Falco', 'Aqua Security', 'Twistlock', 'Service Mesh', 'OPA/Gatekeeper', 'Calico'],
    indicators: ['kubernetes', 'k8s', 'container', 'docker', 'aks', 'eks', 'gke', 'openshift']
  },
  {
    environment: 'dod',
    displayName: 'DoD Environment',
    description: 'Department of Defense compliance environment',
    commonTools: ['ACAS', 'HBSS', 'eMASS', 'STIG Viewer', 'SCAP', 'Splunk SIEM'],
    indicators: ['dod', 'military', 'govcloud', 'il4', 'il5', 'fedramp', 'stig']
  },
  {
    environment: 'generic',
    displayName: 'General',
    description: 'Generic implementation guidance',
    commonTools: ['SIEM', 'IAM', 'Firewall', 'IDS/IPS', 'Vulnerability Scanner'],
    indicators: []
  }
];

/**
 * Implementation examples database
 * Organized by control ID with examples for different environments
 */
export const IMPLEMENTATION_EXAMPLES: ImplementationExample[] = [
  // ========================================
  // SI-4: System Monitoring
  // ========================================
  {
    controlId: 'SI-4',
    controlName: 'System Monitoring',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'AWS GuardDuty for threat detection and anomaly identification',
      'VPC Flow Logs for network traffic monitoring',
      'CloudWatch Logs for centralized log aggregation',
      'AWS Security Hub for security findings consolidation',
      'CloudTrail for API activity monitoring'
    ],
    tools: ['GuardDuty', 'CloudWatch', 'VPC Flow Logs', 'Security Hub', 'CloudTrail']
  },
  {
    controlId: 'SI-4',
    controlName: 'System Monitoring',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Azure Sentinel for SIEM and security analytics',
      'Azure Monitor for centralized logging',
      'Network Watcher for network monitoring',
      'Microsoft Defender for Cloud for threat protection',
      'Log Analytics Workspace for log aggregation'
    ],
    tools: ['Azure Sentinel', 'Azure Monitor', 'Network Watcher', 'Defender for Cloud']
  },
  {
    controlId: 'SI-4',
    controlName: 'System Monitoring',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Network IDS/IPS at boundary points (Snort, Suricata)',
      'Host-based monitoring agents (OSSEC, Wazuh)',
      'SIEM for log correlation and alerting (Splunk, ELK)',
      'Network traffic analysis (Zeek, NetFlow)',
      'File integrity monitoring (Tripwire, AIDE)'
    ],
    tools: ['Splunk', 'Snort', 'Wazuh', 'Tripwire', 'Zeek']
  },
  {
    controlId: 'SI-4',
    controlName: 'System Monitoring',
    environment: 'container',
    title: 'Container/Kubernetes Implementation',
    bullets: [
      'Falco for runtime security and anomaly detection',
      'Container runtime monitoring (cAdvisor, Prometheus)',
      'Service mesh observability (Istio, Linkerd)',
      'Kubernetes audit logging enabled',
      'Network policy monitoring with Calico'
    ],
    tools: ['Falco', 'Prometheus', 'Istio', 'Calico', 'Grafana']
  },
  {
    controlId: 'SI-4',
    controlName: 'System Monitoring',
    environment: 'dod',
    title: 'DoD Implementation',
    bullets: [
      'ACAS for vulnerability scanning and compliance',
      'HBSS endpoint protection and monitoring',
      'Splunk SIEM for DoD security event correlation',
      'SCAP compliance scanning and reporting',
      'Integration with eMASS for continuous monitoring'
    ],
    tools: ['ACAS', 'HBSS', 'Splunk', 'SCAP', 'eMASS']
  },

  // ========================================
  // AC-2: Account Management
  // ========================================
  {
    controlId: 'AC-2',
    controlName: 'Account Management',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'AWS IAM for user and role management',
      'AWS Organizations for multi-account governance',
      'IAM Identity Center (SSO) for centralized access',
      'CloudTrail for account activity auditing',
      'IAM Access Analyzer for policy validation'
    ],
    tools: ['IAM', 'AWS Organizations', 'IAM Identity Center', 'CloudTrail']
  },
  {
    controlId: 'AC-2',
    controlName: 'Account Management',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Microsoft Entra ID (Azure AD) for identity management',
      'Privileged Identity Management (PIM) for just-in-time access',
      'Access Reviews for periodic account validation',
      'Conditional Access policies for risk-based authentication',
      'Azure AD audit logs for account activity tracking'
    ],
    tools: ['Entra ID', 'PIM', 'Access Reviews', 'Conditional Access']
  },
  {
    controlId: 'AC-2',
    controlName: 'Account Management',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Active Directory for centralized identity management',
      'Group Policy for access control enforcement',
      'ServiceNow or similar for account provisioning workflows',
      'Quarterly access reviews with manager attestation',
      'PAM solution for privileged account management'
    ],
    tools: ['Active Directory', 'Group Policy', 'ServiceNow', 'CyberArk']
  },
  {
    controlId: 'AC-2',
    controlName: 'Account Management',
    environment: 'dod',
    title: 'DoD Implementation',
    bullets: [
      'CAC/PIV authentication required for all users',
      'DMDC identity proofing for account creation',
      'Enterprise directory services (Active Directory)',
      'Automated account disable after 35 days of inactivity',
      'Annual access recertification by data owners'
    ],
    tools: ['Active Directory', 'CAC/PIV', 'DMDC', 'CyberArk']
  },

  // ========================================
  // SC-7: Boundary Protection
  // ========================================
  {
    controlId: 'SC-7',
    controlName: 'Boundary Protection',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'VPC with public/private subnet architecture',
      'Security Groups for instance-level filtering',
      'Network ACLs for subnet-level protection',
      'AWS WAF for web application protection',
      'AWS Shield for DDoS protection'
    ],
    tools: ['VPC', 'Security Groups', 'Network ACLs', 'AWS WAF', 'Shield']
  },
  {
    controlId: 'SC-7',
    controlName: 'Boundary Protection',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Azure Virtual Network with NSG enforcement',
      'Azure Firewall for centralized network protection',
      'Application Gateway with WAF for web apps',
      'Azure DDoS Protection Standard',
      'Private endpoints for PaaS service access'
    ],
    tools: ['Virtual Network', 'Azure Firewall', 'Application Gateway', 'NSG']
  },
  {
    controlId: 'SC-7',
    controlName: 'Boundary Protection',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Perimeter firewall with stateful inspection',
      'DMZ architecture for public-facing services',
      'Network segmentation using VLANs',
      'IDS/IPS at network boundaries',
      'Proxy servers for outbound traffic control'
    ],
    tools: ['Palo Alto', 'Cisco ASA', 'Fortinet', 'IDS/IPS', 'Proxy']
  },
  {
    controlId: 'SC-7',
    controlName: 'Boundary Protection',
    environment: 'container',
    title: 'Container/Kubernetes Implementation',
    bullets: [
      'Kubernetes Network Policies for pod isolation',
      'Service mesh (Istio/Linkerd) for mTLS and traffic control',
      'Ingress controllers with WAF capabilities',
      'Calico or Cilium for advanced network security',
      'API gateway for external access control'
    ],
    tools: ['Network Policies', 'Istio', 'Calico', 'Ingress Controller', 'API Gateway']
  },

  // ========================================
  // AU-2: Event Logging
  // ========================================
  {
    controlId: 'AU-2',
    controlName: 'Event Logging',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'CloudTrail enabled in all regions',
      'S3 access logging for storage buckets',
      'RDS audit logging for databases',
      'VPC Flow Logs for network events',
      'Lambda execution logs to CloudWatch'
    ],
    tools: ['CloudTrail', 'CloudWatch', 'VPC Flow Logs', 'S3 Logging']
  },
  {
    controlId: 'AU-2',
    controlName: 'Event Logging',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Azure Activity Log for control plane events',
      'Diagnostic settings for resource logging',
      'Azure AD sign-in and audit logs',
      'Storage Analytics for blob/file access',
      'NSG flow logs for network events'
    ],
    tools: ['Activity Log', 'Diagnostic Settings', 'Azure AD Logs', 'NSG Flow Logs']
  },
  {
    controlId: 'AU-2',
    controlName: 'Event Logging',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Windows Event Log forwarding to SIEM',
      'Linux syslog/auditd configuration',
      'Database audit logging (Oracle, SQL Server)',
      'Application-level logging to centralized collector',
      'Network device logging (syslog) to SIEM'
    ],
    tools: ['Splunk', 'ELK Stack', 'Windows Event Collector', 'Syslog-ng']
  },

  // ========================================
  // IA-2: Identification and Authentication
  // ========================================
  {
    controlId: 'IA-2',
    controlName: 'Identification and Authentication (Organizational Users)',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'IAM Identity Center with MFA enforcement',
      'SAML/OIDC federation with corporate IdP',
      'IAM policies requiring MFA for sensitive actions',
      'AWS Organizations SCPs for authentication standards',
      'Password policy enforcement via IAM'
    ],
    tools: ['IAM Identity Center', 'IAM', 'SAML Federation', 'MFA']
  },
  {
    controlId: 'IA-2',
    controlName: 'Identification and Authentication (Organizational Users)',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Microsoft Entra ID with MFA enforcement',
      'Conditional Access policies for risk-based auth',
      'Passwordless authentication (FIDO2, Windows Hello)',
      'Integration with on-premises AD via Connect',
      'Identity Protection for sign-in risk detection'
    ],
    tools: ['Entra ID', 'Conditional Access', 'MFA', 'Identity Protection']
  },
  {
    controlId: 'IA-2',
    controlName: 'Identification and Authentication (Organizational Users)',
    environment: 'dod',
    title: 'DoD Implementation',
    bullets: [
      'CAC/PIV smart card authentication mandatory',
      'Alternate token for non-CAC enabled systems',
      'FIPS 140-2 validated cryptographic modules',
      'Enterprise directory integration (AD with CAC)',
      'PKI certificate-based authentication'
    ],
    tools: ['CAC/PIV', 'PKI', 'Active Directory', 'FIPS 140-2 Modules']
  },

  // ========================================
  // CM-2: Baseline Configuration
  // ========================================
  {
    controlId: 'CM-2',
    controlName: 'Baseline Configuration',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'AWS Config rules for configuration compliance',
      'EC2 Image Builder for hardened AMIs',
      'Systems Manager State Manager for config enforcement',
      'CloudFormation/Terraform for infrastructure as code',
      'AWS Security Hub for baseline compliance scoring'
    ],
    tools: ['AWS Config', 'EC2 Image Builder', 'Systems Manager', 'CloudFormation']
  },
  {
    controlId: 'CM-2',
    controlName: 'Baseline Configuration',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Azure Policy for configuration compliance',
      'Azure Blueprints for baseline deployment',
      'Shared Image Gallery for hardened images',
      'Azure Automation State Configuration (DSC)',
      'ARM/Bicep templates for infrastructure as code'
    ],
    tools: ['Azure Policy', 'Blueprints', 'Shared Image Gallery', 'ARM Templates']
  },
  {
    controlId: 'CM-2',
    controlName: 'Baseline Configuration',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'CIS Benchmarks applied to all systems',
      'SCCM/Ansible for configuration management',
      'Golden images for server deployment',
      'SCAP scanning for compliance verification',
      'Change management board for baseline updates'
    ],
    tools: ['CIS Benchmarks', 'SCCM', 'Ansible', 'SCAP', 'Golden Images']
  },
  {
    controlId: 'CM-2',
    controlName: 'Baseline Configuration',
    environment: 'dod',
    title: 'DoD Implementation',
    bullets: [
      'DISA STIG compliance for all systems',
      'SCAP scanning with DISA benchmarks',
      'STIG Viewer for configuration validation',
      'ACAS for continuous configuration monitoring',
      'POA&M for deviations from baseline'
    ],
    tools: ['DISA STIGs', 'STIG Viewer', 'SCAP', 'ACAS', 'eMASS']
  },

  // ========================================
  // RA-5: Vulnerability Scanning
  // ========================================
  {
    controlId: 'RA-5',
    controlName: 'Vulnerability Monitoring and Scanning',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'Amazon Inspector for EC2 and ECR scanning',
      'AWS Security Hub for vulnerability aggregation',
      'Third-party scanner integration (Tenable, Qualys)',
      'GuardDuty for runtime vulnerability detection',
      'Systems Manager Patch Manager for remediation'
    ],
    tools: ['Amazon Inspector', 'Security Hub', 'Tenable', 'Patch Manager']
  },
  {
    controlId: 'RA-5',
    controlName: 'Vulnerability Monitoring and Scanning',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Microsoft Defender for Cloud vulnerability assessment',
      'Qualys integration for comprehensive scanning',
      'Container registry scanning for images',
      'Azure Update Management for patching',
      'Security Center recommendations remediation'
    ],
    tools: ['Defender for Cloud', 'Qualys', 'Update Management', 'Container Registry']
  },
  {
    controlId: 'RA-5',
    controlName: 'Vulnerability Monitoring and Scanning',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Nessus/Tenable for authenticated scanning',
      'Qualys agents for continuous monitoring',
      'WSUS/SCCM for patch deployment',
      'Web application scanning (Burp Suite, OWASP ZAP)',
      'Monthly scan cycle with 30-day remediation SLA'
    ],
    tools: ['Nessus', 'Qualys', 'WSUS', 'SCCM', 'Burp Suite']
  },
  {
    controlId: 'RA-5',
    controlName: 'Vulnerability Monitoring and Scanning',
    environment: 'dod',
    title: 'DoD Implementation',
    bullets: [
      'ACAS (Tenable.sc) for enterprise vulnerability management',
      'STIG compliance scanning via SCAP',
      'IAVM compliance tracking and reporting',
      'DoD vulnerability database integration',
      '21-day remediation for critical vulnerabilities'
    ],
    tools: ['ACAS', 'SCAP', 'STIG Viewer', 'IAVM', 'VMS']
  },

  // ========================================
  // CP-9: System Backup
  // ========================================
  {
    controlId: 'CP-9',
    controlName: 'System Backup',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'AWS Backup for centralized backup management',
      'S3 versioning and cross-region replication',
      'RDS automated backups and snapshots',
      'EBS snapshots with lifecycle policies',
      'Glacier for long-term retention'
    ],
    tools: ['AWS Backup', 'S3 Versioning', 'RDS Snapshots', 'EBS Snapshots', 'Glacier']
  },
  {
    controlId: 'CP-9',
    controlName: 'System Backup',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Azure Backup for VM and database protection',
      'Recovery Services Vault for backup storage',
      'Geo-redundant storage for backup replication',
      'Azure Site Recovery for disaster recovery',
      'Blob versioning and soft delete'
    ],
    tools: ['Azure Backup', 'Recovery Services Vault', 'Site Recovery', 'GRS']
  },
  {
    controlId: 'CP-9',
    controlName: 'System Backup',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Veeam or Commvault for enterprise backup',
      'Tape backup for offsite storage',
      'Database native backup (RMAN, SQL BAK)',
      'Quarterly backup restoration testing',
      'Air-gapped backup copies for ransomware protection'
    ],
    tools: ['Veeam', 'Commvault', 'RMAN', 'Tape Library']
  },

  // ========================================
  // SC-8: Transmission Confidentiality
  // ========================================
  {
    controlId: 'SC-8',
    controlName: 'Transmission Confidentiality and Integrity',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'TLS 1.2+ enforced on all endpoints',
      'ACM for certificate management',
      'ALB/NLB with TLS termination',
      'VPN/Direct Connect for private connectivity',
      'S3 bucket policies requiring encryption in transit'
    ],
    tools: ['ACM', 'ALB', 'VPN', 'Direct Connect', 'CloudFront']
  },
  {
    controlId: 'SC-8',
    controlName: 'Transmission Confidentiality and Integrity',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'TLS 1.2+ required for all services',
      'Azure Front Door with end-to-end TLS',
      'ExpressRoute for private connectivity',
      'Key Vault for certificate management',
      'Storage account secure transfer required'
    ],
    tools: ['Azure Front Door', 'ExpressRoute', 'Key Vault', 'Application Gateway']
  },
  {
    controlId: 'SC-8',
    controlName: 'Transmission Confidentiality and Integrity',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'TLS 1.2+ on all web servers and load balancers',
      'IPSec VPN for site-to-site connections',
      'Certificate authority for internal PKI',
      'HTTPS redirect enforcement',
      'Network encryption for database connections'
    ],
    tools: ['F5 BIG-IP', 'Cisco VPN', 'PKI', 'SSL/TLS Certificates']
  },

  // ========================================
  // SI-3: Malicious Code Protection
  // ========================================
  {
    controlId: 'SI-3',
    controlName: 'Malicious Code Protection',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'GuardDuty for malware detection',
      'Amazon Macie for data protection',
      'Inspector for vulnerability and malware scanning',
      'Third-party EDR on EC2 instances',
      'S3 malware scanning before processing'
    ],
    tools: ['GuardDuty', 'Macie', 'Inspector', 'CrowdStrike', 'Trend Micro']
  },
  {
    controlId: 'SI-3',
    controlName: 'Malicious Code Protection',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Microsoft Defender for Endpoint on all VMs',
      'Microsoft Defender for Cloud threat protection',
      'Azure AD Identity Protection',
      'Safe Attachments for email',
      'Azure Storage malware scanning'
    ],
    tools: ['Defender for Endpoint', 'Defender for Cloud', 'Safe Attachments']
  },
  {
    controlId: 'SI-3',
    controlName: 'Malicious Code Protection',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'Enterprise antivirus on all endpoints (CrowdStrike, Symantec)',
      'EDR solution for advanced threat detection',
      'Email gateway with malware scanning',
      'Centralized AV management console',
      'Daily signature updates via WSUS/SCCM'
    ],
    tools: ['CrowdStrike', 'Symantec', 'Proofpoint', 'SCCM']
  },
  {
    controlId: 'SI-3',
    controlName: 'Malicious Code Protection',
    environment: 'dod',
    title: 'DoD Implementation',
    bullets: [
      'HBSS (McAfee ePolicy Orchestrator) enterprise-wide',
      'DoD-approved antivirus definitions',
      'Host-based firewall via HBSS',
      'USB device control policies',
      'Integration with DoD threat intelligence'
    ],
    tools: ['HBSS', 'McAfee ePO', 'USB Device Control']
  },

  // ========================================
  // AC-17: Remote Access
  // ========================================
  {
    controlId: 'AC-17',
    controlName: 'Remote Access',
    environment: 'cloud-aws',
    title: 'AWS Implementation',
    bullets: [
      'AWS Client VPN for secure remote access',
      'Session Manager for bastion-less access',
      'IAM Identity Center with MFA',
      'CloudWatch logging of all remote sessions',
      'VPN split tunneling disabled'
    ],
    tools: ['Client VPN', 'Session Manager', 'IAM Identity Center', 'CloudWatch']
  },
  {
    controlId: 'AC-17',
    controlName: 'Remote Access',
    environment: 'cloud-azure',
    title: 'Azure Implementation',
    bullets: [
      'Azure Bastion for secure VM access',
      'Azure VPN Gateway with MFA',
      'Conditional Access for remote sessions',
      'Just-in-time VM access via Defender',
      'Azure AD sign-in logs for audit'
    ],
    tools: ['Azure Bastion', 'VPN Gateway', 'Conditional Access', 'JIT Access']
  },
  {
    controlId: 'AC-17',
    controlName: 'Remote Access',
    environment: 'on-premise',
    title: 'On-Premise Implementation',
    bullets: [
      'SSL VPN with MFA (Cisco AnyConnect, GlobalProtect)',
      'Privileged access workstations for admins',
      'Session recording for privileged sessions',
      'Network segmentation for VPN users',
      'VPN access reviews and recertification'
    ],
    tools: ['Cisco AnyConnect', 'Palo Alto GlobalProtect', 'CyberArk', 'Duo MFA']
  }
];

/**
 * Get implementation examples for a specific control
 * @param controlId - NIST control ID (e.g., "SI-4")
 * @param environment - Optional environment filter
 * @returns Array of implementation examples
 */
export function getImplementationExamples(
  controlId: string,
  environment?: EnvironmentType
): ImplementationExample[] {
  const normalizedId = controlId.toUpperCase().trim();

  // Get base control ID (without enhancement)
  const baseControlId = normalizedId.replace(/\(\d+\)$/, '');

  const examples = IMPLEMENTATION_EXAMPLES.filter(
    example => example.controlId === baseControlId
  );

  if (environment) {
    const filtered = examples.filter(e => e.environment === environment);
    if (filtered.length > 0) {
      return filtered;
    }
    // Fall back to generic if no environment-specific example exists
    return examples.filter(e => e.environment === 'generic');
  }

  return examples;
}

/**
 * Get implementation example formatted as a prompt string
 * @param controlId - NIST control ID
 * @param environment - Optional environment type
 * @returns Formatted string for prompt injection
 */
export function getImplementationExamplePrompt(
  controlId: string,
  environment?: EnvironmentType
): string {
  const examples = getImplementationExamples(controlId, environment);

  if (examples.length === 0) {
    return '';
  }

  // If environment specified, show only that environment
  if (environment) {
    const example = examples[0];
    return formatExampleForPrompt(example);
  }

  // Show multiple environment examples (up to 3)
  const limitedExamples = examples.slice(0, 3);
  return limitedExamples.map(formatExampleForPrompt).join('\n\n');
}

/**
 * Format a single example for prompt injection
 */
function formatExampleForPrompt(example: ImplementationExample): string {
  const bullets = example.bullets.map(b => `  - ${b}`).join('\n');
  const tools = example.tools ? `  Common Tools: ${example.tools.join(', ')}` : '';

  return `**${example.title}:**
${bullets}
${tools}`.trim();
}

/**
 * Detect environment type from topology
 * Analyzes device types, names, and configurations
 */
export function detectEnvironmentFromTopology(
  deviceTypes: string[],
  deviceNames: string[],
  boundaryTypes?: string[]
): EnvironmentType {
  // Combine all indicators
  const allIndicators = [
    ...deviceTypes.map(t => t.toLowerCase()),
    ...deviceNames.map(n => n.toLowerCase()),
    ...(boundaryTypes || []).map(b => b.toLowerCase())
  ].join(' ');

  // Score each environment
  const scores: Record<EnvironmentType, number> = {
    'cloud-aws': 0,
    'cloud-azure': 0,
    'cloud-gcp': 0,
    'on-premise': 0,
    'hybrid': 0,
    'container': 0,
    'dod': 0,
    'generic': 0
  };

  for (const pattern of ENVIRONMENT_PATTERNS) {
    for (const indicator of pattern.indicators) {
      if (allIndicators.includes(indicator.toLowerCase())) {
        scores[pattern.environment] += 1;
      }
    }
  }

  // Check for hybrid indicators
  const hasCloudIndicators = scores['cloud-aws'] + scores['cloud-azure'] + scores['cloud-gcp'] > 0;
  const hasOnPremIndicators = scores['on-premise'] > 0;

  if (hasCloudIndicators && hasOnPremIndicators) {
    scores['hybrid'] += 2;
  }

  // Find highest scoring environment
  let maxScore = 0;
  let detectedEnvironment: EnvironmentType = 'generic';

  for (const [env, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedEnvironment = env as EnvironmentType;
    }
  }

  return detectedEnvironment;
}

/**
 * Get all available controls with implementation examples
 */
export function getAvailableControlIds(): string[] {
  return [...new Set(IMPLEMENTATION_EXAMPLES.map(e => e.controlId))].sort();
}

/**
 * Check if a control has implementation examples
 */
export function hasImplementationExamples(controlId: string): boolean {
  const normalizedId = controlId.toUpperCase().trim().replace(/\(\d+\)$/, '');
  return IMPLEMENTATION_EXAMPLES.some(e => e.controlId === normalizedId);
}

/**
 * Get environment display name
 */
export function getEnvironmentDisplayName(environment: EnvironmentType): string {
  const pattern = ENVIRONMENT_PATTERNS.find(p => p.environment === environment);
  return pattern?.displayName || 'General';
}
