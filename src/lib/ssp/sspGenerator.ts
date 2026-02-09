/**
 * SSP Generator
 *
 * Generates System Security Plan documents from topology data.
 * Uses standardized control name formatting for consistency.
 */

import {
  AppNode,
  AppEdge,
  SSPDocument,
  NISTControl,
  NistBaseline,
  DeviceNodeData,
  ControlImplementer,
} from '@/lib/utils/types';
import { getCatalogForBaseline } from '@/lib/controls/controlCatalog';
import { extractInventoryByCategory } from '@/lib/topology/inventoryExtractor';
import { validateSSPRequestOrThrow, SSPGenerationRequest } from './sspValidation';
import { renderToString } from 'react-dom/server';
import { SSPPrintTemplate } from './sspPrintTemplate';
import { normalizeControlId } from '@/lib/controls/formatter';

/**
 * Extract topology context for narrative generation
 */
function extractTopologyContext(nodes: AppNode[], edges: AppEdge[]) {
  const deviceNodes = nodes.filter(n => n.type === 'device' || !n.type);
  const boundaryNodes = nodes.filter(n => n.type === 'boundary');

  // Count devices by type
  const devicesByType: Record<string, string[]> = {};
  deviceNodes.forEach(node => {
    const data = node.data as DeviceNodeData;
    const type = data?.deviceType || 'unknown';
    const name = data?.name || data?.hostname || node.id;
    if (!devicesByType[type]) devicesByType[type] = [];
    devicesByType[type].push(name);
  });

  // Get boundary names
  const boundaryNames = boundaryNodes.map(n => {
    const data = n.data as { label?: string; name?: string };
    return data?.label || data?.name || n.id;
  });

  // Find firewalls and security devices
  const firewalls = devicesByType['firewall'] || [];
  const routers = devicesByType['router'] || [];
  const switches = devicesByType['switch'] || [];
  const servers = devicesByType['server'] || [];
  const databases = devicesByType['database'] || [];
  const workstations = [...(devicesByType['workstation'] || []), ...(devicesByType['laptop'] || [])];
  const loadBalancers = devicesByType['load-balancer'] || [];

  return {
    deviceCount: deviceNodes.length,
    boundaryCount: boundaryNodes.length,
    connectionCount: edges.length,
    devicesByType,
    boundaryNames,
    firewalls,
    routers,
    switches,
    servers,
    databases,
    workstations,
    loadBalancers,
    hasFirewalls: firewalls.length > 0,
    hasServers: servers.length > 0,
    hasDatabases: databases.length > 0,
    hasWorkstations: workstations.length > 0,
  };
}

/**
 * Generate control narrative based on topology and control family
 */
function generateControlNarrative(
  controlId: string,
  nodes: AppNode[],
  edges: AppEdge[]
): string {
  const ctx = extractTopologyContext(nodes, edges);
  const family = controlId.split('-')[0].toUpperCase();

  // Helper to list items naturally
  const listItems = (items: string[], max = 3): string => {
    if (items.length === 0) return '';
    if (items.length <= max) return items.join(', ');
    return `${items.slice(0, max).join(', ')}, and ${items.length - max} other${items.length - max > 1 ? 's' : ''}`;
  };

  // Generate family-specific narratives that reference actual topology components
  switch (family) {
    case 'AC': // Access Control
      if (ctx.hasFirewalls) {
        return `Access control is enforced through ${ctx.firewalls.length} firewall${ctx.firewalls.length > 1 ? 's' : ''} (${listItems(ctx.firewalls)}) and network segmentation across ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''}. Role-based access policies are configured on all ${ctx.deviceCount} system components to restrict unauthorized access.`;
      }
      return `Access control is implemented across ${ctx.deviceCount} system components${ctx.boundaryNames.length > 0 ? ` within ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''} (${listItems(ctx.boundaryNames)})` : ''}. Authentication and authorization mechanisms enforce least privilege principles.`;

    case 'AU': // Audit and Accountability
      if (ctx.hasServers) {
        return `Audit logging is configured on ${ctx.servers.length} server${ctx.servers.length > 1 ? 's' : ''} (${listItems(ctx.servers)}) and all ${ctx.deviceCount} network components. Logs capture security-relevant events including authentication attempts, access control decisions, and configuration changes.`;
      }
      return `Audit mechanisms are implemented across ${ctx.deviceCount} system components to capture security-relevant events. Logs are protected, retained, and reviewed in accordance with organizational policy.`;

    case 'CA': // Assessment, Authorization, Monitoring
      return `Security assessment and continuous monitoring covers all ${ctx.deviceCount} components${ctx.boundaryNames.length > 0 ? ` across ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''} (${listItems(ctx.boundaryNames)})` : ''}. System interconnections (${ctx.connectionCount} documented) are reviewed and authorized.`;

    case 'CM': // Configuration Management
      return `Configuration management applies to all ${ctx.deviceCount} system components including ${Object.entries(ctx.devicesByType).map(([type, items]) => `${items.length} ${type}${items.length > 1 ? 's' : ''}`).join(', ')}. Baseline configurations are documented and changes are controlled through the change management process.`;

    case 'CP': // Contingency Planning
      if (ctx.hasDatabases) {
        return `Contingency planning addresses recovery of ${ctx.databases.length} database${ctx.databases.length > 1 ? 's' : ''} (${listItems(ctx.databases)}) and ${ctx.deviceCount} system components. Backup and recovery procedures are documented and tested.`;
      }
      return `Contingency planning addresses recovery of all ${ctx.deviceCount} system components${ctx.boundaryNames.length > 0 ? ` within ${listItems(ctx.boundaryNames)}` : ''}. Business impact analysis and recovery procedures are maintained.`;

    case 'IA': // Identification and Authentication
      if (ctx.hasServers || ctx.hasWorkstations) {
        const authTargets = [...ctx.servers, ...ctx.workstations];
        return `Identification and authentication is required for access to ${authTargets.length} endpoint${authTargets.length > 1 ? 's' : ''} (${listItems(authTargets)}) and ${ctx.deviceCount} total system components. Multi-factor authentication is enforced for privileged access.`;
      }
      return `Identification and authentication mechanisms are implemented on all ${ctx.deviceCount} system components. User identities are verified before granting access to system resources.`;

    case 'IR': // Incident Response
      return `Incident response capabilities cover all ${ctx.deviceCount} system components across ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''}. Detection, analysis, containment, and recovery procedures address security incidents affecting ${ctx.connectionCount} network connections.`;

    case 'MA': // Maintenance
      return `Maintenance is performed on all ${ctx.deviceCount} system components including ${Object.keys(ctx.devicesByType).length} device type${Object.keys(ctx.devicesByType).length > 1 ? 's' : ''}. Maintenance activities are logged, and remote maintenance is controlled and monitored.`;

    case 'MP': // Media Protection
      if (ctx.hasDatabases || ctx.hasServers) {
        return `Media protection controls apply to storage on ${ctx.servers.length + ctx.databases.length} server${ctx.servers.length + ctx.databases.length > 1 ? 's' : ''} and database${ctx.databases.length > 1 ? 's' : ''} (${listItems([...ctx.servers, ...ctx.databases])}). Media is sanitized before disposal or reuse.`;
      }
      return `Media protection is implemented for all ${ctx.deviceCount} system components. Digital and non-digital media containing system information is protected and controlled.`;

    case 'PE': // Physical and Environmental Protection
      return `Physical protection is implemented for ${ctx.deviceCount} system components${ctx.boundaryNames.length > 0 ? ` located within ${listItems(ctx.boundaryNames)}` : ''}. Physical access is controlled and monitored.`;

    case 'PL': // Planning
      return `Security planning addresses all ${ctx.deviceCount} system components, ${ctx.boundaryCount} security boundaries, and ${ctx.connectionCount} system interconnections documented in the system topology.`;

    case 'PS': // Personnel Security
      return `Personnel security controls govern access to ${ctx.deviceCount} system components. Personnel are screened and access is terminated upon separation.`;

    case 'RA': // Risk Assessment
      return `Risk assessment covers all ${ctx.deviceCount} system components including ${Object.entries(ctx.devicesByType).map(([type, items]) => `${items.length} ${type}${items.length > 1 ? 's' : ''}`).join(', ')}. Vulnerabilities are identified and remediated based on risk.`;

    case 'SA': // System and Services Acquisition
      return `System acquisition and development addresses security requirements for ${ctx.deviceCount} components. Third-party services and components are assessed for security compliance.`;

    case 'SC': // System and Communications Protection
      if (ctx.hasFirewalls) {
        return `Communications protection is enforced by ${ctx.firewalls.length} firewall${ctx.firewalls.length > 1 ? 's' : ''} (${listItems(ctx.firewalls)}) controlling ${ctx.connectionCount} network connections across ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''}. Encryption protects data in transit.`;
      }
      return `System and communications protection is implemented across ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''} with ${ctx.connectionCount} controlled network connections. Boundary protection and encryption mechanisms protect system communications.`;

    case 'SI': // System and Information Integrity
      return `System integrity controls are implemented on all ${ctx.deviceCount} components including ${ctx.servers.length} server${ctx.servers.length !== 1 ? 's' : ''} and ${ctx.workstations.length} workstation${ctx.workstations.length !== 1 ? 's' : ''}. Malicious code protection, patch management, and integrity monitoring are active.`;

    case 'SR': // Supply Chain Risk Management
      return `Supply chain risk management addresses ${ctx.deviceCount} system components from ${Object.keys(ctx.devicesByType).length} vendor categor${Object.keys(ctx.devicesByType).length !== 1 ? 'ies' : 'y'}. Components are validated and monitored for supply chain threats.`;

    default:
      return `This control is implemented across ${ctx.deviceCount} system components${ctx.boundaryNames.length > 0 ? ` within ${ctx.boundaryCount} security zone${ctx.boundaryCount !== 1 ? 's' : ''} (${listItems(ctx.boundaryNames)})` : ''}. Implementation details are documented in system security documentation.`;
  }
}

/**
 * Aggregate device-level implementation notes for a control
 */
function aggregateDeviceNotes(controlId: string, nodes: AppNode[]): string | null {
  const deviceNodes = nodes.filter(n => n.type === 'device' || !n.type);
  const devicesWithControl = deviceNodes
    .map(node => {
      const data = node.data as DeviceNodeData;
      if (data?.assignedControls?.includes(controlId)) {
        const notes = data?.controlNotes?.[controlId]?.trim();
        if (notes) {
          return {
            deviceName: data.name || data.hostname || node.id,
            notes,
          };
        }
      }
      return null;
    })
    .filter(Boolean) as Array<{ deviceName: string; notes: string }>;

  if (devicesWithControl.length === 0) {
    return null;
  }

  // If only one device, return its notes directly
  if (devicesWithControl.length === 1) {
    return devicesWithControl[0].notes;
  }

  // Aggregate multiple device notes
  const aggregated = devicesWithControl
    .map(({ deviceName, notes }) => `${deviceName}: ${notes}`)
    .join('\n\n');
  
  return aggregated;
}

/**
 * Build SSP document structure without generating PDF
 * Returns the SSPDocument for preview
 */
export async function buildSSPDocument(
  request: unknown,
  nodes: AppNode[],
  edges: AppEdge[],
  topologyImage?: string
): Promise<SSPDocument> {
  // Validate and parse request using Zod
  const validatedRequest = validateSSPRequestOrThrow(request);
  
  const catalog = await getCatalogForBaseline(validatedRequest.baseline as NistBaseline);
  let catalogControls = Object.values(catalog.items);
  
  // Filter controls based on selected_control_ids if provided
  if (validatedRequest.selected_control_ids && validatedRequest.selected_control_ids.length > 0) {
    const selectedSet = new Set(validatedRequest.selected_control_ids);
    catalogControls = catalogControls.filter(control => selectedSet.has(control.control_id));
  }
  
  const customNarratives = validatedRequest.custom_narratives ?? {};
  const deviceDetailMap = buildDeviceDetailMap(nodes);

  const controlsWithNarratives = catalogControls
    .map((control) => {
      const custom = customNarratives[control.control_id];
      let narrative = custom?.narrative?.trim();
      let implementationStatus = custom?.implementation_status;
      const referencedDevices = custom?.referenced_devices;
      const referencedBoundaries = custom?.referenced_boundaries;
      const implementingDevices = mapDeviceReferences(referencedDevices, deviceDetailMap);

      // If no custom narrative, try aggregating device notes first
      if (!narrative || narrative.length === 0) {
        const aggregatedNotes = aggregateDeviceNotes(control.control_id, nodes);
        if (aggregatedNotes) {
          narrative = aggregatedNotes;
        } else {
          // Fall back to default behavior
          switch (validatedRequest.unedited_controls_mode) {
            case 'exclude':
              return null;
            case 'nist_text':
              narrative = control.default_narrative;
              break;
            case 'placeholder':
            default:
              // Check for AI-enhanced narrative first
              const controlFamily = control.control_id.split('-')[0].toUpperCase();
              const enhancedNarrative = validatedRequest.enhanced_narratives?.[controlFamily];
              if (enhancedNarrative) {
                narrative = enhancedNarrative;
              } else {
                narrative = generateControlNarrative(control.control_id, nodes, edges);
              }
              break;
          }
        }
      }

      if (!implementationStatus && custom?.implementation_status) {
        implementationStatus = custom.implementation_status;
      }

      return {
        id: normalizeControlId(control.control_id),
        family: control.family.toUpperCase(),
        title: control.title,
        objective: control.default_narrative,
        baselines: control.baselines,
        narrative,
        implementation_status: implementationStatus,
        referencedDevices,
        referencedBoundaries,
        implementingDevices,
      } as NISTControl;
    })
    .filter((control): control is NISTControl => Boolean(control));

  // Analyze topology
  const deviceNodes = nodes.filter(n => n.type === 'device' || !n.type);
  const boundaryNodes = nodes.filter(n => n.type === 'boundary');
  
  // Count devices by type
  const devicesByType: Record<string, number> = {};
  deviceNodes.forEach(node => {
    const data = node.data as any;
    const type = data?.deviceType || 'unknown';
    devicesByType[type] = (devicesByType[type] || 0) + 1;
  });

  // Get security zones
  const securityZones: string[] = [];
  boundaryNodes.forEach(node => {
    const data = node.data as any;
    if (data?.zoneType && !securityZones.includes(data.zoneType)) {
      securityZones.push(data.zoneType);
    }
  });

  // Extract hardware/software inventory
  const inventoryResult = extractInventoryByCategory(nodes);

  // Build SSP document structure
  const sspDoc: SSPDocument = {
    metadata: {
      system_name: validatedRequest.system_name,
      organization_name: validatedRequest.organization_name,
      prepared_by: validatedRequest.prepared_by,
      baseline: validatedRequest.baseline,
      system_description: validatedRequest.system_description || '',
      system_purpose: validatedRequest.system_purpose || '',
      deployment_model: validatedRequest.deployment_model,
      service_model: validatedRequest.service_model,
      on_premises_details: validatedRequest.on_premises_details,
      cloud_provider: validatedRequest.cloud_provider,
      information_type_title: validatedRequest.information_type_title,
      information_type_description: validatedRequest.information_type_description,
      confidentiality_impact: validatedRequest.confidentiality_impact,
      integrity_impact: validatedRequest.integrity_impact,
      availability_impact: validatedRequest.availability_impact,
      authorization_boundary_description: validatedRequest.authorization_boundary_description,
      system_status: validatedRequest.system_status,
      authorization_date: validatedRequest.authorization_date,
      system_owner: validatedRequest.system_owner,
      system_owner_email: validatedRequest.system_owner_email || '',
      authorizing_official: validatedRequest.authorizing_official,
      authorizing_official_email: validatedRequest.authorizing_official_email || '',
      security_contact: validatedRequest.security_contact,
      security_contact_email: validatedRequest.security_contact_email || '',
      physical_location: validatedRequest.physical_location,
      data_types_processed: validatedRequest.data_types_processed,
      users_description: validatedRequest.users_description,
      generatedDate: new Date().toLocaleDateString(),
      custom_sections: validatedRequest.custom_sections
    },
    topology: {
      totalDevices: deviceNodes.length,
      devicesByType,
      totalConnections: edges.length,
      securityZones,
      image: topologyImage
    },
    inventory: {
      hardware: inventoryResult.byCategory.Hardware,
      software: inventoryResult.byCategory.Software,
      network: inventoryResult.byCategory.Network.length > 0 
        ? inventoryResult.byCategory.Network 
        : undefined,
      security: inventoryResult.byCategory.Security.length > 0 
        ? inventoryResult.byCategory.Security 
        : undefined,
    },
    controls: controlsWithNarratives
  };

  return sspDoc;
}

/**
 * Check if Electron API is available for PDF generation
 */
export function checkElectronAPIAvailability(): { available: boolean; error?: string } {
  if (typeof window === 'undefined') {
    return { available: false, error: 'Window object not available' };
  }

  if (!window.electronAPI) {
    return { 
      available: false, 
      error: 'PDF generation requires the desktop application. Please use the Electron desktop app to generate SSPs.' 
    };
  }

  if (!window.electronAPI.generateSSPPDF) {
    return { 
      available: false, 
      error: 'PDF generation API not available. Please ensure you are using the latest version of the desktop application.' 
    };
  }

  return { available: true };
}

/**
 * Retry PDF generation with exponential backoff
 */
async function generatePDFWithRetry(
  html: string,
  options: any,
  maxRetries: number = 3
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await window.electronAPI!.generateSSPPDF({ 
        html,
        options,
      });

      if (result.success && result.pdfBuffer) {
        if (attempt > 0) {
          console.log(`[SSP Generator] PDF generated successfully on attempt ${attempt + 1}`);
        }
        return result;
      }

      lastError = result.error || 'PDF generation failed without error message';
      
      // Don't retry on certain errors (invalid input, etc.)
      if (result.error?.includes('HTML content') || result.error?.includes('required')) {
        break;
      }

      // Exponential backoff: wait 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[SSP Generator] Retry attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error during PDF generation';
      
      // Don't retry on certain errors
      if (lastError.includes('timed out') || lastError.includes('timeout')) {
        break;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[SSP Generator] Retry attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError || 'PDF generation failed after multiple attempts',
  };
}

/**
 * Generate PDF from pre-built SSP document using React template and Electron's printToPDF
 */
export async function generateSSPFromDocument(
  sspDoc: SSPDocument,
  download: boolean = true
): Promise<Blob> {
  try {
    console.log('[SSP Generator] Starting PDF generation...');
    
    // Check if Electron API is available with detailed error message
    const apiCheck = checkElectronAPIAvailability();
    if (!apiCheck.available) {
      throw new Error(apiCheck.error || 'PDF generation requires the desktop application.');
    }

    // Render React component to HTML string
    console.log('[SSP Generator] Rendering SSP template to HTML...');
    const htmlContent = renderToString(SSPPrintTemplate({ sspDoc }));
    
    // Wrap in complete HTML document with DOCTYPE
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSP - ${sspDoc.metadata.system_name}</title>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Generate PDF using Electron's printToPDF with retry logic
    console.log('[SSP Generator] Calling Electron printToPDF...');
    const result = await generatePDFWithRetry(fullHTML, {
      marginsType: 1, // Standard margins
      printBackground: true,
      pageSize: 'Letter',
      landscape: false,
    });

    if (!result.success || !result.pdfBuffer) {
      throw new Error(result.error || 'Failed to generate PDF. Please try again.');
    }

    console.log('[SSP Generator] PDF generated successfully');

    // Convert buffer to Blob
    const blob = new Blob([result.pdfBuffer], { type: 'application/pdf' });

    if (download) {
      const systemName = sspDoc.metadata.system_name || 'System';
      const filename = `SSP_${systemName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      try {
        // Use file dialog to let user select save location
        if (!window.electronAPI?.exportPDF) {
          throw new Error('PDF export API not available. Please ensure you are using the latest version of the desktop application.');
        }

        const exportResult = await window.electronAPI.exportPDF({
          pdfBuffer: result.pdfBuffer,
          filename: filename,
        });

        if (exportResult.success) {
          console.log('[SSP Generator] SSP PDF exported successfully:', exportResult.filePath);
        } else if (exportResult.canceled) {
          console.log('[SSP Generator] PDF export canceled by user');
        } else {
          throw new Error(exportResult.error || 'Failed to export PDF. Please check file permissions and try again.');
        }
      } catch (saveError) {
        console.error('[SSP Generator] Failed to export PDF:', saveError);
        throw new Error(`Failed to export PDF: ${saveError instanceof Error ? saveError.message : 'Unknown error'}. Please try selecting a different save location.`);
      }
    }

    return blob;
  } catch (error) {
    console.error('[SSP Generator] PDF generation failed:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for more details.`);
  }
}

/**
 * Open PDF in new tab for preview
 */
export async function previewSSPDocument(sspDoc: SSPDocument): Promise<void> {
  try {
    const blob = await generateSSPFromDocument(sspDoc, false);
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    
    if (!newWindow) {
      throw new Error('Failed to open preview window. Please check your popup blocker settings.');
    }
    
    // Clean up after some time
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    throw new Error(`Failed to preview PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate SSP document (legacy function for backward compatibility)
 */
export async function generateSSP(
  request: SSPGenerationRequest,
  nodes: AppNode[],
  edges: AppEdge[],
  topologyImage?: string
): Promise<void> {
  const sspDoc = await buildSSPDocument(request, nodes, edges, topologyImage);
  await generateSSPFromDocument(sspDoc, true);
}

function buildDeviceDetailMap(nodes: AppNode[]): Map<string, DeviceNodeData> {
  const map = new Map<string, DeviceNodeData>();
  nodes
    .filter((node) => node.type === 'device' || !node.type)
    .forEach((node) => {
      if (node.data) {
        map.set(node.id, node.data as DeviceNodeData);
      }
    });
  return map;
}

function mapDeviceReferences(
  deviceIds: string[] | undefined,
  deviceMap: Map<string, DeviceNodeData>,
): ControlImplementer[] | undefined {
  if (!deviceIds || deviceIds.length === 0) {
    return undefined;
  }

  const references = deviceIds
    .map((id) => {
      const device = deviceMap.get(id);
      if (!device) return null;
      return {
        id,
        name: device.name || device.hostname || id,
        ipAddress: device.ipAddress || null,
        zone: device.securityZone || null,
      };
    })
    .filter(Boolean) as ControlImplementer[];

  return references.length > 0 ? references : undefined;
}

