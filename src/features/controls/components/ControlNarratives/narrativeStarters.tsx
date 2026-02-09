// narrativeStarters.ts - Provides example narrative starters for control implementations
// Based on common implementation patterns for each NIST 800-53 control family

export interface NarrativeStarter {
  title: string;
  preview: string;
  template: string;
}

/**
 * Get narrative starters based on control family and ID
 * Returns 2-3 relevant starter templates for common implementation patterns
 */
export function getNarrativeStarters(controlId: string, family: string): NarrativeStarter[] {
  const familyCode = family || controlId.split('-')[0].toUpperCase();

  // Get family-specific starters
  const familyStarters = FAMILY_STARTERS[familyCode] || DEFAULT_STARTERS;

  // Return first 3 starters (or all if less than 3)
  return familyStarters.slice(0, 3);
}

const DEFAULT_STARTERS: NarrativeStarter[] = [
  {
    title: 'Technical Implementation',
    preview: 'Describe specific technical controls and configurations...',
    template: `The organization implements this control through the following technical measures:

- [Primary control mechanism]: [Description of how it works]
- [Supporting technology]: [How it integrates with primary controls]
- [Monitoring/verification]: [How compliance is verified]

These controls are configured according to [policy/standard] and are reviewed [frequency].`,
  },
  {
    title: 'Process-Based Approach',
    preview: 'Document procedures, roles, and responsibilities...',
    template: `This control is implemented through established organizational processes:

Responsible Party: [Role/Team responsible]
Process Description: [High-level description of the process]

Key procedures include:
1. [Procedure 1]: [Brief description]
2. [Procedure 2]: [Brief description]
3. [Procedure 3]: [Brief description]

Documentation is maintained in [location] and reviewed [frequency].`,
  },
  {
    title: 'Hybrid Implementation',
    preview: 'Combine automated controls with manual procedures...',
    template: `This control is implemented through a combination of automated and manual measures:

Automated Controls:
- [Tool/System]: [What it automates]

Manual Procedures:
- [Process]: [What is done manually and why]

The [automated/manual] controls are primary, with [automated/manual] providing supplementary coverage. Effectiveness is monitored through [method].`,
  },
];

const FAMILY_STARTERS: Record<string, NarrativeStarter[]> = {
  // Access Control (AC)
  AC: [
    {
      title: 'Role-Based Access Control',
      preview: 'Define user roles, permissions, and access approval processes...',
      template: `The system implements role-based access control (RBAC) to manage user access:

User Roles:
- Administrators: Full system access for authorized IT personnel
- Operators: Day-to-day operational access
- Users: Limited access based on job function
- Auditors: Read-only access for compliance verification

Access Provisioning:
- Access requests are submitted through [ticketing system]
- Approval required from [approver role]
- Access granted based on principle of least privilege
- Access reviews conducted [quarterly/annually]

Technical Implementation:
- [Directory service/IAM system] manages user accounts
- Multi-factor authentication required for [privileged/all] access
- Session timeouts configured for [duration]`,
    },
    {
      title: 'Account Management',
      preview: 'Document account lifecycle from creation to termination...',
      template: `Account management is implemented through standardized procedures:

Account Creation:
- Initiated by [HR/Manager] upon employee onboarding
- Verified against [HR system] before provisioning
- Default permissions based on role/department

Account Maintenance:
- Password expiration: [X days]
- Account lockout after [X] failed attempts
- Periodic access reviews: [frequency]

Account Termination:
- Immediate disable upon separation notice
- Full removal within [X hours] of departure
- Access logs retained for [X months]`,
    },
    {
      title: 'Remote Access Controls',
      preview: 'Describe VPN, remote authentication, and monitoring...',
      template: `Remote access to the system is controlled through multiple layers:

Authentication:
- VPN connection required for all remote access
- Multi-factor authentication (MFA) mandatory
- Device certificates for managed endpoints

Authorization:
- Remote access limited to [specific systems/data]
- Just-in-time access for privileged functions
- Geographic restrictions enforced where applicable

Monitoring:
- All remote sessions logged and monitored
- Anomaly detection for unusual access patterns
- Automated alerts for policy violations`,
    },
  ],

  // Audit and Accountability (AU)
  AU: [
    {
      title: 'Centralized Logging',
      preview: 'Describe log collection, SIEM integration, and retention...',
      template: `Audit logging is implemented through a centralized logging infrastructure:

Log Collection:
- [Log management/SIEM solution] aggregates logs from all systems
- Log sources include: servers, network devices, applications, security tools
- Real-time log forwarding with [protocol]

Log Content:
- User authentication events (success/failure)
- Privileged actions and administrative changes
- Data access and modification events
- Security-relevant system events

Retention and Protection:
- Logs retained for [X months/years]
- Immutable storage prevents tampering
- Access restricted to security and audit personnel`,
    },
    {
      title: 'Audit Review Process',
      preview: 'Document log review procedures and escalation...',
      template: `Audit logs are reviewed through established procedures:

Automated Review:
- [SIEM/Tool] performs continuous log analysis
- Correlation rules detect suspicious patterns
- Automated alerts for high-priority events

Manual Review:
- Security team reviews [daily/weekly] summary reports
- Detailed investigation of flagged events
- Documentation of findings and actions taken

Escalation:
- Critical findings escalated to [role] within [timeframe]
- Incident response initiated for confirmed threats
- Monthly trend analysis reported to management`,
    },
    {
      title: 'Audit Record Generation',
      preview: 'Define what events are logged and audit record format...',
      template: `The system generates audit records for security-relevant events:

Events Captured:
- Authentication: Login attempts, password changes, MFA events
- Authorization: Access grants, denials, privilege escalation
- Data: Creation, modification, deletion, access of sensitive data
- System: Startup/shutdown, configuration changes, errors

Audit Record Content:
- Timestamp (synchronized via NTP)
- User/process identity
- Event type and outcome
- Source and destination addresses
- Resource accessed

Generation is automatic and cannot be disabled by users.`,
    },
  ],

  // Configuration Management (CM)
  CM: [
    {
      title: 'Baseline Configuration',
      preview: 'Document standard configurations and hardening guides...',
      template: `System baseline configurations are established and maintained:

Baseline Standards:
- Operating systems: [CIS Benchmarks/DISA STIGs/custom]
- Applications: Vendor-recommended secure configurations
- Network devices: [Standard/framework used]

Configuration Management:
- Baselines documented in [configuration management system]
- Changes require approval through change management process
- Automated deployment via [tool] ensures consistency

Compliance Monitoring:
- [Scanner/tool] verifies configuration compliance [frequency]
- Deviations reported and remediated within [timeframe]
- Exceptions documented and approved by [authority]`,
    },
    {
      title: 'Change Control Process',
      preview: 'Describe change management and approval workflow...',
      template: `Configuration changes follow a controlled process:

Change Request:
- All changes submitted through [ticketing system]
- Required information: description, impact, rollback plan
- Emergency changes follow expedited process

Change Approval:
- [CAB/Manager] reviews and approves changes
- Security impact assessment for significant changes
- Testing required in [non-production] environment

Change Implementation:
- Scheduled during maintenance windows when possible
- Changes logged and attributed to requestor
- Post-implementation verification performed`,
    },
    {
      title: 'Software Inventory',
      preview: 'Document authorized software and installation controls...',
      template: `Software inventory and installation is controlled:

Authorized Software:
- Approved software list maintained in [system]
- New software requires security review and approval
- Regular review of installed software against approved list

Installation Controls:
- Users cannot install software on managed endpoints
- Software deployed through [MDM/SCCM/deployment tool]
- Application whitelisting enforced on [critical systems]

Inventory Management:
- [Asset management tool] maintains software inventory
- Automated discovery identifies unauthorized software
- License compliance tracked and reported`,
    },
  ],

  // Identification and Authentication (IA)
  IA: [
    {
      title: 'Multi-Factor Authentication',
      preview: 'Describe MFA implementation and authenticator management...',
      template: `Multi-factor authentication is required for system access:

MFA Implementation:
- [MFA solution] provides second-factor authentication
- Supported factors: [TOTP, push notification, hardware token]
- Required for: [all users/privileged users/remote access]

Authenticator Management:
- Enrollment verified through [identity verification process]
- Lost/stolen authenticator replacement procedure
- Backup authentication method for recovery

Enforcement:
- MFA cannot be bypassed except through documented exception
- Failed MFA attempts trigger account lockout
- MFA events logged for security monitoring`,
    },
    {
      title: 'Password Policy',
      preview: 'Document password requirements and credential management...',
      template: `Password policy enforces strong authentication credentials:

Password Requirements:
- Minimum length: [X] characters
- Complexity: [uppercase, lowercase, numbers, symbols]
- History: Cannot reuse last [X] passwords
- Expiration: [X] days for standard, [X] days for privileged

Technical Enforcement:
- [Directory service/IAM] enforces password policy
- Account lockout after [X] failed attempts
- Self-service password reset with identity verification

Privileged Account Passwords:
- Managed by [PAM solution]
- Automatic rotation [frequency]
- One-time passwords for shared accounts`,
    },
    {
      title: 'Device Authentication',
      preview: 'Describe how devices are identified and authenticated...',
      template: `Device authentication ensures only authorized endpoints connect:

Device Identification:
- Managed devices registered in [asset management/MDM]
- Device certificates issued by [internal CA]
- MAC address registration for network access

Authentication Methods:
- Certificate-based authentication for managed devices
- 802.1X network access control
- Device health checks before network access

Enforcement:
- Unmanaged devices restricted to [guest network/quarantine]
- Device compliance required for full access
- Non-compliant devices receive limited access or remediation`,
    },
  ],

  // Incident Response (IR)
  IR: [
    {
      title: 'Incident Response Procedures',
      preview: 'Document detection, response, and recovery processes...',
      template: `Incident response follows established procedures:

Detection:
- [SIEM/Security tools] detect potential incidents
- Users report suspected incidents to [help desk/security]
- Automated alerts for high-severity events

Response:
- Incident Response Team activated for confirmed incidents
- Containment actions taken within [timeframe]
- Evidence preservation and chain of custody maintained

Recovery:
- Systems restored from known-good backups
- Root cause analysis performed
- Lessons learned documented and shared`,
    },
    {
      title: 'Incident Response Team',
      preview: 'Define team structure, roles, and contact procedures...',
      template: `The Incident Response Team manages security incidents:

Team Structure:
- Incident Commander: [Role] - Overall incident management
- Technical Lead: [Role] - Technical investigation and remediation
- Communications: [Role] - Internal/external communications
- Legal/Compliance: [Role] - Regulatory and legal coordination

Activation:
- Team activated via [communication method]
- On-call rotation for 24/7 coverage
- Escalation to management for [severity levels]

External Resources:
- [Forensics firm] retained for major incidents
- Law enforcement contacts established
- Cyber insurance carrier notification procedures`,
    },
    {
      title: 'Incident Reporting',
      preview: 'Document incident documentation and reporting requirements...',
      template: `Incidents are documented and reported according to policy:

Internal Reporting:
- All incidents logged in [incident tracking system]
- Status updates provided [frequency] during active incidents
- Post-incident report within [X days] of closure

External Reporting:
- Regulatory notifications as required by [regulations]
- Customer notification per contractual obligations
- Law enforcement reporting for criminal activity

Metrics:
- Monthly incident statistics reported to [management]
- Trend analysis identifies systemic issues
- Metrics inform security program improvements`,
    },
  ],

  // System and Communications Protection (SC)
  SC: [
    {
      title: 'Boundary Protection',
      preview: 'Describe firewalls, network segmentation, and traffic control...',
      template: `Network boundaries are protected through multiple controls:

Perimeter Security:
- [Firewall solution] controls traffic at network boundary
- Default deny policy - only explicitly allowed traffic permitted
- DMZ architecture separates public-facing services

Network Segmentation:
- Internal networks segmented by [function/sensitivity]
- VLANs separate [user/server/management] traffic
- Microsegmentation for critical assets

Monitoring:
- [IDS/IPS] monitors traffic for threats
- Network flow data collected and analyzed
- Alerts generated for anomalous traffic patterns`,
    },
    {
      title: 'Encryption in Transit',
      preview: 'Document TLS/encryption requirements for data transmission...',
      template: `Data in transit is protected through encryption:

External Communications:
- TLS 1.2+ required for all external connections
- Certificate validation enforced
- Forward secrecy cipher suites preferred

Internal Communications:
- Sensitive data encrypted within internal network
- TLS for internal web applications
- Encrypted protocols for administrative access (SSH, HTTPS)

Implementation:
- [Load balancer/WAF] terminates TLS at boundary
- Certificate management via [PKI/certificate manager]
- Regular cipher suite review and updates`,
    },
    {
      title: 'Encryption at Rest',
      preview: 'Describe data-at-rest encryption and key management...',
      template: `Data at rest is encrypted to protect confidentiality:

Storage Encryption:
- Full disk encryption on [servers/endpoints]
- Database encryption for sensitive data
- Backup encryption using [method]

Key Management:
- Encryption keys managed by [KMS/HSM]
- Key rotation [frequency]
- Separation of duties for key access

Scope:
- All systems storing [PII/sensitive data] require encryption
- Encryption verified through [compliance scanning]
- Exceptions documented and risk-accepted`,
    },
  ],

  // System and Information Integrity (SI)
  SI: [
    {
      title: 'Malware Protection',
      preview: 'Document antivirus, EDR, and malware prevention controls...',
      template: `Malware protection is implemented across the environment:

Endpoint Protection:
- [EDR/Antivirus solution] deployed on all endpoints
- Real-time scanning enabled
- Automatic definition updates [frequency]

Detection and Response:
- Behavioral analysis detects unknown threats
- Automated isolation of compromised endpoints
- Security team alerted for manual investigation

Coverage:
- [X]% of managed endpoints protected
- Compliance monitored via [console/dashboard]
- Non-compliant devices remediated within [timeframe]`,
    },
    {
      title: 'Patch Management',
      preview: 'Document vulnerability patching procedures and timelines...',
      template: `Patch management ensures systems remain current:

Patch Assessment:
- [Vulnerability scanner] identifies missing patches
- Patches prioritized by severity and exploitability
- Critical patches addressed within [X days]

Deployment Process:
- Patches tested in [non-production] environment
- Deployment via [WSUS/SCCM/patch management tool]
- Phased rollout: [test > pilot > production]

Tracking:
- Patch compliance reported [frequency]
- Exceptions documented with compensating controls
- [X]% patch compliance target maintained`,
    },
    {
      title: 'Security Monitoring',
      preview: 'Describe continuous monitoring and alerting...',
      template: `Security monitoring provides visibility into system integrity:

Monitoring Infrastructure:
- [SIEM solution] aggregates security events
- [X] data sources integrated
- Real-time correlation and analysis

Alert Management:
- Alert rules tuned to minimize false positives
- Tiered response based on severity
- [SOC/Security team] monitors alerts [24/7/business hours]

Threat Intelligence:
- [TI feeds] integrated for known indicators
- Automated blocking of known malicious IPs/domains
- Regular threat briefings from [sources]`,
    },
  ],

  // Contingency Planning (CP)
  CP: [
    {
      title: 'Backup Procedures',
      preview: 'Document backup frequency, testing, and restoration...',
      template: `Data backup ensures recovery capability:

Backup Schedule:
- Critical systems: [Daily/Continuous] backups
- Standard systems: [Daily/Weekly] backups
- Retention period: [X days/months] based on data classification

Backup Infrastructure:
- [Backup solution] manages backup operations
- [On-site/Off-site/Cloud] storage for redundancy
- Encryption of backup data

Testing:
- Backup restoration tested [quarterly/annually]
- Recovery time objectives verified
- Test results documented and issues remediated`,
    },
    {
      title: 'Business Continuity',
      preview: 'Describe continuity planning and alternate processing...',
      template: `Business continuity ensures operational resilience:

Recovery Objectives:
- Recovery Time Objective (RTO): [X hours/days]
- Recovery Point Objective (RPO): [X hours]
- Critical functions prioritized for recovery

Alternate Processing:
- [DR site/cloud region] provides failover capability
- Failover tested [annually/semi-annually]
- [Manual/Automatic] failover procedures documented

Plan Maintenance:
- Business continuity plan reviewed [annually]
- Updates following significant changes
- Key personnel trained on procedures`,
    },
    {
      title: 'Disaster Recovery',
      preview: 'Document DR site, failover, and recovery procedures...',
      template: `Disaster recovery provides system restoration capability:

DR Infrastructure:
- [DR site location] maintains recovery systems
- Data replication [synchronous/asynchronous]
- Network connectivity via [method]

Recovery Procedures:
- Documented runbooks for each critical system
- Contact lists and escalation procedures
- Recovery priorities based on business impact

Testing:
- Annual DR exercise simulates [scenario]
- Tabletop exercises conducted [frequency]
- Lessons learned incorporated into plans`,
    },
  ],

  // Risk Assessment (RA)
  RA: [
    {
      title: 'Risk Assessment Process',
      preview: 'Document risk identification, analysis, and treatment...',
      template: `Risk assessments are conducted per established methodology:

Assessment Process:
- Annual comprehensive risk assessment
- Event-triggered assessments for significant changes
- Methodology based on [NIST RMF/ISO 27005/custom]

Risk Identification:
- Threat modeling for critical systems
- Vulnerability assessment results
- Business impact analysis input

Risk Treatment:
- Risk register maintained in [GRC tool]
- Treatment decisions: mitigate, transfer, accept, avoid
- Residual risk accepted by [authority]`,
    },
    {
      title: 'Vulnerability Scanning',
      preview: 'Describe scanning tools, frequency, and remediation...',
      template: `Vulnerability scanning identifies security weaknesses:

Scanning Program:
- [Scanner tool] performs [authenticated/unauthenticated] scans
- Internal network scanned [weekly/monthly]
- External-facing systems scanned [weekly/monthly]

Vulnerability Management:
- Findings prioritized by CVSS score and exploitability
- Critical/High: Remediation within [X days]
- Medium: Remediation within [X days]
- Low: Addressed in regular patching cycles

Tracking:
- Vulnerabilities tracked in [tracking system]
- Metrics reported to [management] [frequency]
- Aging vulnerabilities escalated`,
    },
    {
      title: 'Penetration Testing',
      preview: 'Document penetration testing scope and frequency...',
      template: `Penetration testing validates security controls:

Testing Program:
- Annual penetration test by [internal team/third party]
- Scope includes [networks/applications/social engineering]
- Rules of engagement documented and approved

Testing Methodology:
- Based on [OWASP/PTES/custom] methodology
- [Black box/Gray box/White box] approach
- Production systems tested during [maintenance windows]

Findings Management:
- Critical findings reported immediately
- Remediation plan required within [X days]
- Retest to verify remediation effectiveness`,
    },
  ],
};
