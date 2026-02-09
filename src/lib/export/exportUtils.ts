import {
  AppNode,
  AppEdge,
  DeviceNodeData,
  BoundaryNodeData,
  EdgeMetadata,
  FullReport,
  ReportMetadata,
  DeviceReport,
  BoundaryReport,
  ConnectionReport,
} from '@/lib/utils/types';
import { calculateNestingDepth } from '@/lib/utils/utils';

// Debug: Track module initialization (after all imports)
console.log('[exportUtils] Module loading started');
console.log('[exportUtils] All imports completed');
console.log('[exportUtils] Stack trace:', new Error().stack);

/**
 * Sanitize nodes and edges for JSON serialization
 * Removes non-serializable properties like React refs, functions, etc.
 */
function sanitizeNodesForExport(nodes: AppNode[]): AppNode[] {
  return nodes.map((node, index) => {
    try {
      // Only include serializable properties
      const sanitized: any = {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      };
      
      // Include optional properties if they exist
      if (node.parentId !== undefined) sanitized.parentId = node.parentId;
      if (node.width !== undefined) sanitized.width = node.width;
      if (node.height !== undefined) sanitized.height = node.height;
      if (node.selected !== undefined) sanitized.selected = node.selected;
      if (node.draggable !== undefined) sanitized.draggable = node.draggable;
      if (node.selectable !== undefined) sanitized.selectable = node.selectable;
      if (node.style !== undefined) sanitized.style = node.style;
      if (node.className !== undefined) sanitized.className = node.className;
      if (node.hidden !== undefined) sanitized.hidden = node.hidden;
      if (node.zIndex !== undefined) sanitized.zIndex = node.zIndex;
      
      return sanitized as AppNode;
    } catch (error) {
      console.error(`[EXPORT] Error sanitizing node ${index} (${node.id}):`, error);
      throw error;
    }
  });
}

/**
 * Sanitize edges for JSON serialization
 * Removes non-serializable properties
 */
function sanitizeEdgesForExport(edges: AppEdge[]): AppEdge[] {
  return edges.map((edge, index) => {
    try {
      // Only include serializable properties
      const sanitized: any = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge.data,
      };
      
      // Include optional properties if they exist
      if (edge.type !== undefined) sanitized.type = edge.type;
      if (edge.sourceHandle !== undefined) sanitized.sourceHandle = edge.sourceHandle;
      if (edge.targetHandle !== undefined) sanitized.targetHandle = edge.targetHandle;
      if (edge.label !== undefined) sanitized.label = edge.label;
      if (edge.labelStyle !== undefined) sanitized.labelStyle = edge.labelStyle;
      if (edge.labelShowBg !== undefined) sanitized.labelShowBg = edge.labelShowBg;
      if (edge.labelBgStyle !== undefined) sanitized.labelBgStyle = edge.labelBgStyle;
      if (edge.style !== undefined) sanitized.style = edge.style;
      if (edge.className !== undefined) sanitized.className = edge.className;
      if (edge.hidden !== undefined) sanitized.hidden = edge.hidden;
      if (edge.zIndex !== undefined) sanitized.zIndex = edge.zIndex;
      if (edge.animated !== undefined) sanitized.animated = edge.animated;
      if (edge.markerEnd !== undefined) sanitized.markerEnd = edge.markerEnd;
      if (edge.markerStart !== undefined) sanitized.markerStart = edge.markerStart;
      
      return sanitized as AppEdge;
    } catch (error) {
      console.error(`[EXPORT] Error sanitizing edge ${index} (${edge.id}):`, error);
      throw error;
    }
  });
}

/**
 * Generate a full compliance report with all device, boundary, and connection metadata
 * for SSP (System Security Plan) generation
 */
export function generateFullReport(
  nodes: AppNode[],
  edges: AppEdge[],
  projectName: string,
  projectId?: number
): FullReport {
  console.log('[EXPORT] generateFullReport called:', {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    projectName,
    projectId,
  });

  const metadata: ReportMetadata = {
    projectName,
    projectId,
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    description: 'Network topology diagram with compliance metadata',
  };

  // Extract device nodes
  const deviceNodes = nodes.filter((node) => node.type === 'device');
  const boundaryNodes = nodes.filter((node) => node.type === 'boundary');
  
  console.log('[EXPORT] Filtered nodes:', {
    deviceCount: deviceNodes.length,
    boundaryCount: boundaryNodes.length,
  });

  // Generate device reports
  const devices: DeviceReport[] = deviceNodes.map((node) => {
    const data = node.data as DeviceNodeData;
    return {
      // Basic Info
      id: node.id,
      name: data.name,
      deviceType: data.deviceType,
      deviceSubtype: data.deviceSubtype ?? null,
      iconPath: data.iconPath ?? null,
      
      // Network Info
      ipAddress: data.ipAddress ?? null,
      macAddress: data.macAddress ?? null,
      subnetMask: data.subnetMask ?? null,
      defaultGateway: data.defaultGateway ?? null,
      hostname: data.hostname ?? null,
      
      // Hardware Info
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      serialNumber: data.serialNumber ?? null,
      operatingSystem: data.operatingSystem ?? null,
      osVersion: data.osVersion ?? null,
      firmwareVersion: data.firmwareVersion ?? null,
      
      // Security Classification
      securityZone: data.securityZone ?? null,
      assetValue: data.assetValue ?? null,
      missionCritical: data.missionCritical ?? null,
      dataClassification: data.dataClassification ?? null,
      
      // Security Posture
      multifactorAuth: data.multifactorAuth ?? null,
      encryptionAtRest: data.encryptionAtRest ?? null,
      encryptionInTransit: data.encryptionInTransit ?? null,
      backupsConfigured: data.backupsConfigured ?? null,
      monitoringEnabled: data.monitoringEnabled ?? null,
      vulnerabilityManagement: data.vulnerabilityManagement ?? null,
      
      // Compliance
      applicableControls: data.applicableControls ?? null,
      lastVulnScan: data.lastVulnScan ?? null,
      complianceStatus: data.complianceStatus ?? null,
      criticality: data.criticality ?? null,
      complianceControls: Array.isArray(data.complianceControls) ? data.complianceControls : (data.complianceControls ? [] : null),
      processes: Array.isArray(data.processes) ? data.processes : (data.processes ? [] : null),
      
      // Ownership
      systemOwner: data.systemOwner ?? null,
      department: data.department ?? null,
      contactEmail: data.contactEmail ?? null,
      location: data.location ?? null,
      
      // Visual Configuration
      label: data.label ?? null,
      labelFields: data.labelFields ?? null,
      
      // Position and Layout
      boundaryId: node.parentId ?? null,
      position: node.position,
      width: node.width ?? null,
      height: node.height ?? null,
    };
  });

  // Generate boundary reports
  const boundaries: BoundaryReport[] = boundaryNodes.map((node) => {
    const data = node.data as BoundaryNodeData;
    const childDevices = nodes.filter((n) => n.parentId === node.id && n.type === 'device');
    const childBoundaries = nodes.filter((n) => n.parentId === node.id && n.type === 'boundary');
    const nestingDepth = calculateNestingDepth(node.id, nodes);
    
    return {
      // Basic Info
      id: node.id,
      label: data.label,
      type: data.type,
      
      // Security
      securityLevel: data.securityLevel ?? null,
      zoneType: data.zoneType ?? null,
      requiresAuthentication: data.requiresAuthentication ?? null,
      dataTypesProcessed: data.dataTypesProcessed ?? null,
      
      // Hierarchy
      deviceIds: childDevices.map((d) => d.id),
      parentBoundaryId: node.parentId ?? null,
      childBoundaryIds: childBoundaries.map((b) => b.id),
      nestingDepth,
      
      // Position and Layout
      position: node.position,
      width: node.width ?? 300,
      height: node.height ?? 200,
      
      // Layout Configuration
      deviceAlignment: data.deviceAlignment ?? null,
      layoutDirection: data.layoutDirection ?? null,
      nodeSpacing: data.nodeSpacing ?? null,
      spacing: data.spacing ?? null,
      
      // Visual Customization
      customColor: data.customColor ?? null,
      labelPosition: data.labelPosition ?? null,
      labelPlacement: data.labelPlacement ?? null,
      labelSize: data.labelSize ?? null,
      labelSpacing: data.labelSpacing ?? null,
      labelOffset: data.labelOffset ?? null,
      borderStrokeWidth: data.borderStrokeWidth ?? null,
      borderDashArray: data.borderDashArray ?? null,
      borderRadius: data.borderRadius ?? null,
      backgroundOpacity: data.backgroundOpacity ?? null,
      padding: data.padding ?? null,
      labelBackgroundColor: data.labelBackgroundColor ?? null,
      labelTextColor: data.labelTextColor ?? null,
    };
  });

  // Generate connection reports
  const connections: ConnectionReport[] = edges.map((edge) => {
    const data = edge.data as EdgeMetadata | undefined;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    
    return {
      // Basic Connection Info
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceDevice: (sourceNode?.data.name as string) ?? null,
      targetDevice: (targetNode?.data.name as string) ?? null,
      
      // Connection Info
      linkType: data?.linkType ?? null,
      protocol: data?.protocol ?? null,
      bandwidth: data?.bandwidth ?? null,
      portSource: data?.portSource ?? null,
      portTarget: data?.portTarget ?? null,
      dataFlow: data?.dataFlow ?? null,
      
      // Performance Metrics
      latency: data?.latency ?? null,
      jitter: data?.jitter ?? null,
      packetLoss: data?.packetLoss ?? null,
      errorRate: data?.errorRate ?? null,
      
      // Network Configuration
      vlanId: data?.vlanId ?? null,
      qosClass: data?.qosClass ?? null,
      redundancyType: data?.redundancyType ?? null,
      connectionState: data?.connectionState ?? null,
      
      // Security
      encryptionProtocol: data?.encryptionProtocol ?? null,
      authenticationRequired: data?.authenticationRequired ?? null,
      firewalled: data?.firewalled ?? null,
      
      // Monitoring
      monitored: data?.monitored ?? null,
      
      // Visual Configuration
      label: data?.label ?? null,
      labelFields: data?.labelFields ?? null,
      edgeType: data?.edgeType ?? null,
      animated: data?.animated ?? null,
      animationSpeed: data?.animationSpeed ?? null,
      animationColor: data?.animationColor ?? null,
    };
  });

  // Generate summary statistics
  const devicesByType: Record<string, number> = {};
  devices.forEach((device) => {
    const type = device.deviceType;
    devicesByType[type] = (devicesByType[type] || 0) + 1;
  });

  const boundariesByType: Record<string, number> = {};
  boundaries.forEach((boundary) => {
    const type = boundary.type;
    boundariesByType[type] = (boundariesByType[type] || 0) + 1;
  });

  const securityZones = Array.from(
    new Set(boundaries.map((b) => b.zoneType).filter((z) => !!z) as string[])
  );

  // Sanitize nodes and edges to remove non-serializable properties
  console.log('[EXPORT] Sanitizing nodes and edges...');
  const sanitizedNodes = sanitizeNodesForExport(nodes);
  const sanitizedEdges = sanitizeEdgesForExport(edges);
  console.log('[EXPORT] Sanitization complete:', {
    sanitizedNodeCount: sanitizedNodes.length,
    sanitizedEdgeCount: sanitizedEdges.length,
  });

  const report: FullReport = {
    metadata,
    devices,
    boundaries,
    connections,
    summary: {
      totalDevices: devices.length,
      totalBoundaries: boundaries.length,
      totalConnections: connections.length,
      devicesByType,
      boundariesByType,
      securityZones,
    },
    diagram: {
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
    },
  };
  
  console.log('[EXPORT] Full report generated successfully');
  return report;
}

/**
 * Export diagram data to JSON format via Electron
 */
console.log('[exportUtils] About to export exportToJSON function');
export async function exportToJSON(
  nodes: AppNode[],
  edges: AppEdge[],
  projectName: string,
  projectId?: number
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  console.log('[exportUtils] exportToJSON function called');
  console.log('[EXPORT] exportToJSON called with:', {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    projectName,
    projectId,
    hasElectronAPI: !!window.electronAPI,
  });

  if (!window.electronAPI) {
    console.error('[EXPORT] Electron API not available');
    return { success: false, error: 'Electron API not available' };
  }

  try {
    console.log('[EXPORT] Generating full report...');
    const reportData = generateFullReport(nodes, edges, projectName, projectId);
    console.log('[EXPORT] Report generated:', {
      deviceCount: reportData.devices.length,
      boundaryCount: reportData.boundaries.length,
      connectionCount: reportData.connections.length,
      diagramNodeCount: reportData.diagram.nodes.length,
      diagramEdgeCount: reportData.diagram.edges.length,
    });
    
    // Test JSON serialization before sending to Electron
    console.log('[EXPORT] Testing JSON serialization...');
    let serializedData: string;
    try {
      serializedData = JSON.stringify(reportData);
      console.log('[EXPORT] Serialization successful, size:', serializedData.length, 'bytes');
    } catch (serializationError) {
      console.error('[EXPORT] JSON serialization failed:', serializationError);
      console.error('[EXPORT] Serialization error details:', {
        message: serializationError instanceof Error ? serializationError.message : 'Unknown',
        stack: serializationError instanceof Error ? serializationError.stack : 'No stack',
      });
      
      // Try to identify the problematic property
      try {
        console.log('[EXPORT] Attempting to identify problematic data...');
        JSON.stringify(reportData.metadata);
        console.log('[EXPORT] metadata OK');
        JSON.stringify(reportData.devices);
        console.log('[EXPORT] devices OK');
        JSON.stringify(reportData.boundaries);
        console.log('[EXPORT] boundaries OK');
        JSON.stringify(reportData.connections);
        console.log('[EXPORT] connections OK');
        JSON.stringify(reportData.summary);
        console.log('[EXPORT] summary OK');
        JSON.stringify(reportData.diagram.nodes);
        console.log('[EXPORT] diagram.nodes OK');
        JSON.stringify(reportData.diagram.edges);
        console.log('[EXPORT] diagram.edges OK');
      } catch (partialError) {
        console.error('[EXPORT] Partial serialization test failed:', partialError);
      }
      
      return {
        success: false,
        error: `Data serialization failed: ${serializationError instanceof Error ? serializationError.message : 'Unknown serialization error'}`,
      };
    }
    
    console.log('[EXPORT] Calling Electron API exportJSON...');
    console.log('[EXPORT] Platform info (from renderer):', navigator.platform);
    const result = await window.electronAPI.exportJSON({
      projectName,
      reportData,
    });
    
    console.log('[EXPORT] Electron API returned:', {
      success: result.success,
      hasFilePath: !!result.filePath,
      filePath: result.filePath,
      canceled: result.canceled,
      error: result.error,
      fullResult: result,
    });
    
    // If canceled on Linux, this means old Electron code is running
    if (result.canceled && navigator.platform.toLowerCase().includes('linux')) {
      console.warn('[EXPORT] WARNING: Got canceled=true on Linux - Electron may need restart!');
      console.warn('[EXPORT] Please restart Electron to load the new code that saves directly to Downloads');
    }
    
    if (!result.success && result.error) {
      console.error('[EXPORT] Export failed with error:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('[EXPORT] Error exporting JSON:', error);
    console.error('[EXPORT] Error type:', error?.constructor?.name);
    console.error('[EXPORT] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[EXPORT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Import diagram data from JSON file via Electron
 */
console.log('[exportUtils] About to export importFromJSON function');
export async function importFromJSON(): Promise<{
  success: boolean;
  data?: FullReport;
  error?: string;
}> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API not available' };
  }

  try {
    const result = await window.electronAPI.importJSON();
    
    if (!result.success) {
      return result;
    }

    // Validate imported data structure
    const data = result.data;
    if (!data || !data.diagram || !data.diagram.nodes || !data.diagram.edges) {
      return {
        success: false,
        error: 'Invalid JSON file format. Missing required diagram data.',
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error importing JSON:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate imported report data
 */
export function validateImportedData(data: any): data is FullReport {
  return (
    data &&
    typeof data === 'object' &&
    data.metadata &&
    data.diagram &&
    Array.isArray(data.diagram.nodes) &&
    Array.isArray(data.diagram.edges)
  );
}

console.log('[exportUtils] Module loading complete, all exports defined');

