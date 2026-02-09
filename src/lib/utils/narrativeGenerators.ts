import type { TopologyIntelligence, DeviceDetailSummary } from '@/lib/topology/topologyAnalyzer';

type NarrativeGenerator = (intel: TopologyIntelligence) => string;

export const narrativeGenerators: Record<string, NarrativeGenerator> = {
  'SC-7': generateSC7Narrative,
  'AC-2': generateAC2Narrative,
  'CM-8': generateCM8Narrative,
};

export function generateNarrativeForControl(controlId: string, intel: TopologyIntelligence): string | null {
  const generator = narrativeGenerators[controlId.toUpperCase()];
  return generator ? generator(intel) : null;
}

export function generateSC7Narrative(intel: TopologyIntelligence): string {
  const zones = intel.boundaries.zones;

  if (!zones.length) {
    return [
      'The system enforces boundary protection through logical segmentation and firewall policies.',
      'Although no explicit security zones are modeled, ingress and egress traffic is filtered using deny-by-default rules,',
      'and cross-network flows require explicit approvals with quarterly rule reviews.',
    ].join(' ');
  }

  const zoneDescriptions = zones
    .map((zone) => {
      const typeLabel = zone.zoneType ? zone.zoneType.toUpperCase() : zone.type.replace('_', ' ');
      return `• ${zone.name} (${typeLabel}) – ${zone.deviceCount} device(s)`;
    })
    .join('\n');

  const crossZone = intel.connections.crossZone;
  const crossZoneLine =
    crossZone > 0
      ? `${crossZone} cross-zone connection(s) are monitored for anomalous activity, and each requires explicit firewall policies.`
      : 'No direct cross-zone connections are currently modeled; boundary rules still enforce least privilege.';

  return [
    `The system implements ${zones.length} dedicated security boundary(ies):`,
    zoneDescriptions,
    '',
    'Traffic between zones is controlled by boundary enforcement devices with deny-by-default policies.',
    crossZoneLine,
    'Firewall configurations are reviewed at least quarterly and whenever new interfaces are added to the topology.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function generateAC2Narrative(intel: TopologyIntelligence): string {
  const totalDevices = intel.devices.total;
  const osBreakdown = formatCounts(intel.devices.byOS, 'Unknown OS');
  const mfaCount = intel.security.mfaEnabled;
  const monitored = intel.security.monitoringEnabled;

  const serverDevices = intel.devices.details.filter((detail) => detail.category === 'server');
  const privilegedDevices = serverDevices.filter((detail) => detail.supportsMfa);

  return [
    `Account management controls span ${totalDevices} inventoried device(s), including ${serverDevices.length} server-class assets.`,
    osBreakdown ? `Observed operating systems: ${osBreakdown}.` : '',
    '',
    'Centralized authentication governs account creation, modification, and disablement.',
    `${privilegedDevices.length || mfaCount} privileged systems enforce multi-factor authentication, and all admin accounts require manager approval.`,
    monitored
      ? `${monitored} device(s) feed audit logs into the monitoring pipeline to detect orphaned or stale accounts.`
      : 'Audit logging captures access requests for review during weekly account maintenance cycles.',
    'Group memberships and service accounts are reviewed at least quarterly in coordination with system owners.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function generateCM8Narrative(intel: TopologyIntelligence): string {
  const totalDevices = intel.devices.total;
  const typeBreakdown = formatCounts(intel.devices.byType, 'Unknown type');

  const backupCoverage = intel.security.backupsConfigured;
  const monitoringCoverage = intel.security.monitoringEnabled;

  const inventoryLine = typeBreakdown
    ? `Current inventory includes ${typeBreakdown}, totaling ${totalDevices} tracked configuration item(s).`
    : `The organization tracks ${totalDevices} configuration item(s) in the topology.`;

  const backupsLine =
    backupCoverage > 0
      ? `${backupCoverage} device(s) participate in the managed backup program to ensure recoverability.`
      : 'Backups are being onboarded for remaining assets to achieve full recoverability coverage.';

  const monitoringLine =
    monitoringCoverage > 0
      ? `${monitoringCoverage} device(s) automatically report status to the monitoring platform, enabling drift detection.`
      : 'The team is integrating monitoring hooks to detect unauthorized component changes.';

  return [
    'The organization maintains an automated component inventory sourced directly from the active topology.',
    inventoryLine,
    'Each record tracks hostname, IP address, hardware/software attributes, owner, location, and security classification.',
    'Changes to the diagram automatically update the inventory, triggering review workflows for newly added or removed components.',
    backupsLine,
    monitoringLine,
    'Monthly reconciliation compares the live inventory against procurement and CMDB records to ensure completeness.',
  ].join(' ');
}

function formatCounts(record: Record<string, number>, fallbackLabel: string): string {
  const entries = Object.entries(record).filter(([, count]) => count > 0);
  if (!entries.length) return '';
  return entries
    .map(([label, count]) => `${count} ${label === 'Unknown OS' ? fallbackLabel : label}`)
    .join(', ');
}

export function summarizeDevices(devices: DeviceDetailSummary[]): string {
  if (!devices.length) return '';
  return devices.map((device) => device.name || device.id).join(', ');
}

