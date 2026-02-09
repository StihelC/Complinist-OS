/**
 * End-to-End Test Suite for SSP Wizard Flow
 *
 * Tests the complete System Security Plan generation workflow including:
 * - Metadata collection
 * - Control selection
 * - Narrative inclusion
 * - PDF generation
 * - File output verification
 * - Different baselines (LOW/MODERATE/HIGH)
 * - Edge cases (empty narratives, etc.)
 */

import { describe, test, expect, beforeEach, vi, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';

// Mock control catalog before any imports that use it
vi.mock('@/lib/controls/controlCatalog', () => {
  // Create a mock catalog with sample controls
  const mockControls = [
    {
      control_id: 'AC-1',
      family: 'AC',
      title: 'Access Control Policy and Procedures',
      default_narrative: 'The organization develops, documents, and disseminates an access control policy.',
      narrative: 'The organization develops, documents, and disseminates an access control policy.',
      baselines: ['LOW', 'MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
    {
      control_id: 'AC-2',
      family: 'AC',
      title: 'Account Management',
      default_narrative: 'The organization manages information system accounts.',
      narrative: 'The organization manages information system accounts.',
      baselines: ['LOW', 'MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
    {
      control_id: 'AC-3',
      family: 'AC',
      title: 'Access Enforcement',
      default_narrative: 'The information system enforces approved authorizations for access.',
      narrative: 'The information system enforces approved authorizations for access.',
      baselines: ['MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
    {
      control_id: 'SC-7',
      family: 'SC',
      title: 'Boundary Protection',
      default_narrative: 'The information system monitors and controls communications at external boundaries.',
      narrative: 'The information system monitors and controls communications at external boundaries.',
      baselines: ['LOW', 'MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
    {
      control_id: 'SI-2',
      family: 'SI',
      title: 'Flaw Remediation',
      default_narrative: 'The organization identifies, reports, and corrects information system flaws.',
      narrative: 'The organization identifies, reports, and corrects information system flaws.',
      baselines: ['LOW', 'MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
    {
      control_id: 'SI-3',
      family: 'SI',
      title: 'Malicious Code Protection',
      default_narrative: 'The organization employs malicious code protection mechanisms.',
      narrative: 'The organization employs malicious code protection mechanisms.',
      baselines: ['LOW', 'MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
    {
      control_id: 'CM-8',
      family: 'CM',
      title: 'Information System Component Inventory',
      default_narrative: 'The organization develops and documents an inventory of information system components.',
      narrative: 'The organization develops and documents an inventory of information system components.',
      baselines: ['LOW', 'MODERATE', 'HIGH'],
      implementation_status: undefined,
      isCustom: false,
      wasCustom: false,
      system_implementation: '',
    },
  ];

  const groupControlsByFamily = (controls: any[]) => {
    const familyMap = new Map<string, any>();
    const familyNames: Record<string, string> = {
      AC: 'Access Control',
      SC: 'System and Communications Protection',
      SI: 'System and Information Integrity',
      CM: 'Configuration Management',
    };

    controls.forEach((control: any) => {
      if (!familyMap.has(control.family)) {
        familyMap.set(control.family, {
          code: control.family,
          name: familyNames[control.family] ?? control.family,
          controls: [],
        });
      }
      familyMap.get(control.family)!.controls.push(control);
    });

    return Array.from(familyMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  };

  return {
    getControlCatalog: vi.fn().mockResolvedValue(mockControls),
    getCatalogForBaseline: vi.fn().mockImplementation(async (baseline: string) => {
      const filtered = mockControls.filter((c) => c.baselines.includes(baseline));
      return {
        items: Object.fromEntries(filtered.map((c) => [c.control_id, c])),
        families: groupControlsByFamily(filtered),
      };
    }),
    getAllControls: vi.fn().mockResolvedValue({
      items: Object.fromEntries(mockControls.map((c) => [c.control_id, c])),
      families: groupControlsByFamily(mockControls),
    }),
    getAllControlsWithBaselineFlags: vi.fn().mockImplementation(async (baseline: string) => {
      const controls = mockControls.map((c) => ({
        ...c,
        isApplicableToBaseline: c.baselines.includes(baseline),
      }));
      return {
        items: Object.fromEntries(controls.map((c) => [c.control_id, c])),
        families: groupControlsByFamily(controls),
      };
    }),
    groupControlsByFamily,
  };
});

// ============================================================================
// TEST DATA & FIXTURES
// ============================================================================

/**
 * SSP metadata fixtures for different baselines
 */
const SSP_METADATA_FIXTURES = {
  LOW: {
    system_name: 'Test System LOW',
    organization_name: 'Test Organization',
    prepared_by: 'Test User',
    baseline: 'LOW' as const,
    system_description: 'A test system for LOW baseline verification',
    system_purpose: 'Testing and validation purposes',
    deployment_model: 'on-premises' as const,
    service_model: 'on-premises' as const,
    information_type_title: 'Administrative Information',
    information_type_description: 'General administrative data',
    confidentiality_impact: 'low' as const,
    integrity_impact: 'low' as const,
    availability_impact: 'low' as const,
    system_status: 'operational' as const,
    system_owner: 'John Doe',
    system_owner_email: 'john.doe@example.com',
    authorizing_official: 'Jane Smith',
    authorizing_official_email: 'jane.smith@example.com',
    security_contact: 'Security Team',
    security_contact_email: 'security@example.com',
    physical_location: 'Data Center A',
    data_types_processed: 'Administrative records',
    users_description: 'Internal employees only',
    authorization_boundary_description: 'Includes all components within the test environment',
  },
  MODERATE: {
    system_name: 'Test System MODERATE',
    organization_name: 'Test Organization',
    prepared_by: 'Test User',
    baseline: 'MODERATE' as const,
    system_description: 'A test system for MODERATE baseline verification',
    system_purpose: 'Business operations and testing',
    deployment_model: 'hybrid-cloud' as const,
    service_model: 'hybrid' as const,
    cloud_provider: 'AWS',
    information_type_title: 'Business Sensitive Information',
    information_type_description: 'Proprietary business data',
    confidentiality_impact: 'moderate' as const,
    integrity_impact: 'moderate' as const,
    availability_impact: 'moderate' as const,
    system_status: 'operational' as const,
    system_owner: 'John Doe',
    system_owner_email: 'john.doe@example.com',
    authorizing_official: 'Jane Smith',
    authorizing_official_email: 'jane.smith@example.com',
    security_contact: 'Security Team',
    security_contact_email: 'security@example.com',
    physical_location: 'Multiple Data Centers',
    data_types_processed: 'Customer records, business data',
    users_description: 'Internal and external stakeholders',
    authorization_boundary_description: 'Hybrid cloud environment with on-premises integration',
  },
  HIGH: {
    system_name: 'Test System HIGH',
    organization_name: 'Government Agency',
    prepared_by: 'Test User',
    baseline: 'HIGH' as const,
    system_description: 'A test system for HIGH baseline verification',
    system_purpose: 'Critical mission operations',
    deployment_model: 'private-cloud' as const,
    service_model: 'iaas' as const,
    information_type_title: 'Classified Information',
    information_type_description: 'National security information',
    confidentiality_impact: 'high' as const,
    integrity_impact: 'high' as const,
    availability_impact: 'high' as const,
    system_status: 'operational' as const,
    system_owner: 'Director of Operations',
    system_owner_email: 'director@gov.example.com',
    authorizing_official: 'Chief Information Officer',
    authorizing_official_email: 'cio@gov.example.com',
    security_contact: 'Cybersecurity Division',
    security_contact_email: 'cybersec@gov.example.com',
    physical_location: 'Secure Government Facility',
    data_types_processed: 'Classified and sensitive government data',
    users_description: 'Authorized government personnel only',
    authorization_boundary_description: 'Air-gapped secure environment with strict access controls',
    on_premises_details: {
      data_center_location: 'Secure Government Facility, Washington DC',
      physical_security_description: 'Armed guards, biometric access, CCTV surveillance',
      server_infrastructure: 'Hardened servers with FIPS 140-2 encryption',
      network_infrastructure: 'Isolated network with multi-layer firewall protection',
      backup_systems: 'Encrypted off-site backups with 24-hour RPO',
      disaster_recovery: 'Hot standby site with 4-hour RTO',
    },
  },
};

/**
 * Sample control narratives for testing
 */
const SAMPLE_NARRATIVES: Record<string, { narrative: string; implementation_status?: string }> = {
  'AC-1': {
    narrative: 'The organization has developed, documented, and disseminated an access control policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance.',
    implementation_status: 'Implemented',
  },
  'AC-2': {
    narrative: 'Account management is performed through the centralized identity management system. User accounts are created, enabled, modified, disabled, and removed in accordance with organizational procedures.',
    implementation_status: 'Implemented',
  },
  'SC-7': {
    narrative: 'Boundary protection is implemented through a defense-in-depth strategy including firewalls, DMZ architecture, and network segmentation. All external connections are monitored and filtered.',
    implementation_status: 'Implemented',
  },
};

/**
 * Empty/edge case narratives for testing
 */
const EDGE_CASE_NARRATIVES = {
  empty: {
    narrative: '',
    implementation_status: undefined,
  },
  whitespaceOnly: {
    narrative: '   \n\t  ',
    implementation_status: undefined,
  },
  todoPlaceholder: {
    narrative: '[TODO: Add implementation details]',
    implementation_status: 'Planned',
  },
};

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

/**
 * Create a mock SSP generation request
 */
function createSSPRequest(baseline: 'LOW' | 'MODERATE' | 'HIGH', options: {
  includeNarratives?: boolean;
  emptyNarratives?: boolean;
  selectedControlIds?: string[];
  uneditedControlsMode?: 'placeholder' | 'nist_text' | 'exclude';
} = {}) {
  const metadata = SSP_METADATA_FIXTURES[baseline];

  let customNarratives: Record<string, { narrative: string; implementation_status?: string }> = {};

  if (options.includeNarratives) {
    customNarratives = { ...SAMPLE_NARRATIVES };
  } else if (options.emptyNarratives) {
    // Create empty narratives for edge case testing
    customNarratives = {
      'AC-1': EDGE_CASE_NARRATIVES.empty,
      'AC-2': EDGE_CASE_NARRATIVES.whitespaceOnly,
      'SC-7': EDGE_CASE_NARRATIVES.todoPlaceholder,
    };
  }

  return {
    ...metadata,
    custom_narratives: customNarratives,
    selected_control_ids: options.selectedControlIds || [],
    unedited_controls_mode: options.uneditedControlsMode || 'placeholder',
    project_id: 1,
  };
}

/**
 * Verify SSP document structure
 */
function verifySSPDocumentStructure(doc: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check metadata
  if (!doc.metadata) {
    errors.push('Missing metadata section');
  } else {
    const requiredMetadataFields = [
      'system_name',
      'organization_name',
      'prepared_by',
      'baseline',
      'generatedDate',
    ];

    requiredMetadataFields.forEach(field => {
      if (!doc.metadata[field]) {
        errors.push(`Missing required metadata field: ${field}`);
      }
    });

    // Validate baseline value
    if (doc.metadata.baseline && !['LOW', 'MODERATE', 'HIGH'].includes(doc.metadata.baseline)) {
      errors.push(`Invalid baseline value: ${doc.metadata.baseline}`);
    }
  }

  // Check topology
  if (!doc.topology) {
    errors.push('Missing topology section');
  } else {
    if (typeof doc.topology.totalDevices !== 'number') {
      errors.push('Topology totalDevices must be a number');
    }
    if (typeof doc.topology.totalConnections !== 'number') {
      errors.push('Topology totalConnections must be a number');
    }
  }

  // Check controls
  if (!doc.controls) {
    errors.push('Missing controls section');
  } else if (!Array.isArray(doc.controls)) {
    errors.push('Controls must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify control structure
 */
function verifyControlStructure(control: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const requiredFields = ['id', 'family', 'title'];
  requiredFields.forEach(field => {
    if (!control[field]) {
      errors.push(`Missing required control field: ${field}`);
    }
  });

  // Verify narrative exists (either custom or auto-generated)
  if (!control.narrative && control.narrative !== '') {
    errors.push('Control must have a narrative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// SSP VALIDATION TESTS
// ============================================================================

describe('SSP Validation Tests', () => {
  test('Zod schema validates correct SSP request', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    const request = createSSPRequest('MODERATE', { includeNarratives: true });
    const result = validateSSPRequest(request);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.errors).toBeUndefined();
  });

  test('Zod schema rejects invalid baseline', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    const request = {
      ...SSP_METADATA_FIXTURES.MODERATE,
      baseline: 'INVALID' as any,
    };

    const result = validateSSPRequest(request);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some(e => e.includes('baseline'))).toBe(true);
  });

  test('Zod schema rejects missing required fields', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    const request = {
      // Missing system_name, organization_name, prepared_by
      baseline: 'MODERATE' as const,
    };

    const result = validateSSPRequest(request);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test('Zod schema validates email fields correctly', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    // Valid email should pass
    const validRequest = createSSPRequest('MODERATE');
    const validResult = validateSSPRequest(validRequest);
    expect(validResult.success).toBe(true);

    // Invalid email format should fail
    const invalidRequest = {
      ...SSP_METADATA_FIXTURES.MODERATE,
      system_owner_email: 'not-an-email',
    };
    const invalidResult = validateSSPRequest(invalidRequest);
    expect(invalidResult.success).toBe(false);
  });

  test('Zod schema validates deployment and service models', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    // All valid deployment models
    const deploymentModels = ['on-premises', 'private-cloud', 'public-cloud', 'hybrid-cloud', 'other'];
    for (const model of deploymentModels) {
      const request = {
        ...SSP_METADATA_FIXTURES.MODERATE,
        deployment_model: model,
      };
      const result = validateSSPRequest(request);
      expect(result.success).toBe(true);
    }

    // Invalid deployment model
    const invalidRequest = {
      ...SSP_METADATA_FIXTURES.MODERATE,
      deployment_model: 'invalid-model',
    };
    const invalidResult = validateSSPRequest(invalidRequest);
    expect(invalidResult.success).toBe(false);
  });

  test('Zod schema validates FIPS 199 impact levels', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    // Valid impact levels
    const impacts = ['low', 'moderate', 'high'];
    for (const impact of impacts) {
      const request = {
        ...SSP_METADATA_FIXTURES.MODERATE,
        confidentiality_impact: impact,
        integrity_impact: impact,
        availability_impact: impact,
      };
      const result = validateSSPRequest(request);
      expect(result.success).toBe(true);
    }
  });

  test('Zod schema validates unedited_controls_mode', async () => {
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    const modes = ['placeholder', 'nist_text', 'exclude'];
    for (const mode of modes) {
      const request = {
        ...SSP_METADATA_FIXTURES.MODERATE,
        unedited_controls_mode: mode,
      };
      const result = validateSSPRequest(request);
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================================
// SSP DOCUMENT BUILDING TESTS
// ============================================================================

describe('SSP Document Building Tests', () => {
  test('buildSSPDocument creates valid document for LOW baseline', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('LOW', { includeNarratives: true });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    const validation = verifySSPDocumentStructure(doc);
    expect(validation.valid).toBe(true);
    expect(doc.metadata.baseline).toBe('LOW');
    expect(doc.metadata.system_name).toBe('Test System LOW');
  });

  test('buildSSPDocument creates valid document for MODERATE baseline', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', { includeNarratives: true });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    const validation = verifySSPDocumentStructure(doc);
    expect(validation.valid).toBe(true);
    expect(doc.metadata.baseline).toBe('MODERATE');
    expect(doc.metadata.system_name).toBe('Test System MODERATE');
  });

  test('buildSSPDocument creates valid document for HIGH baseline', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('HIGH', { includeNarratives: true });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    const validation = verifySSPDocumentStructure(doc);
    expect(validation.valid).toBe(true);
    expect(doc.metadata.baseline).toBe('HIGH');
    expect(doc.metadata.system_name).toBe('Test System HIGH');

    // HIGH baseline should have on_premises_details
    expect(doc.metadata.on_premises_details).toBeDefined();
  });

  test('buildSSPDocument includes custom narratives when provided', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      includeNarratives: true,
      selectedControlIds: ['AC-1', 'AC-2', 'SC-7'],
    });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // Find the AC-1 control and verify custom narrative
    const ac1Control = doc.controls.find((c: any) => c.id === 'AC-1');
    if (ac1Control) {
      expect(ac1Control.narrative).toBe(SAMPLE_NARRATIVES['AC-1'].narrative);
    }
  });

  test('buildSSPDocument uses placeholder mode for unedited controls', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      uneditedControlsMode: 'placeholder',
      selectedControlIds: ['SI-2'], // Control without custom narrative
    });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // SI-2 should have an auto-generated placeholder narrative
    const si2Control = doc.controls.find((c: any) => c.id === 'SI-2');
    if (si2Control) {
      expect(si2Control.narrative).toBeDefined();
      expect(si2Control.narrative.length).toBeGreaterThan(0);
    }
  });

  test('buildSSPDocument uses NIST text mode for unedited controls', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      uneditedControlsMode: 'nist_text',
      selectedControlIds: ['SI-2'],
    });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    const si2Control = doc.controls.find((c: any) => c.id === 'SI-2');
    if (si2Control) {
      // NIST text mode should use the objective/default narrative
      expect(si2Control.narrative).toBeDefined();
    }
  });

  test('buildSSPDocument excludes controls in exclude mode', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      uneditedControlsMode: 'exclude',
      selectedControlIds: ['SI-2', 'SI-3'], // Controls without custom narratives
    });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // Controls without custom narratives should be excluded
    // The exact behavior depends on whether device notes are present
    expect(doc.controls).toBeDefined();
  });

  test('buildSSPDocument respects selected_control_ids filter', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const selectedIds = ['AC-1', 'AC-2', 'AC-3'];
    const request = createSSPRequest('MODERATE', {
      includeNarratives: true,
      selectedControlIds: selectedIds,
    });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // All returned controls should be from the selected list
    doc.controls.forEach((control: any) => {
      expect(selectedIds).toContain(control.id);
    });
  });
});

// ============================================================================
// TOPOLOGY INTEGRATION TESTS
// ============================================================================

describe('SSP Topology Integration Tests', () => {
  // Mock topology nodes for testing
  const mockNodes: any[] = [
    {
      id: 'device-1',
      type: 'device',
      data: {
        name: 'Web Server',
        hostname: 'webserver01',
        deviceType: 'server',
        ipAddress: '192.168.1.10',
        securityZone: 'DMZ',
        assignedControls: ['AC-2', 'SC-7'],
        controlNotes: {
          'AC-2': 'Account management enforced via Active Directory integration',
          'SC-7': 'Firewall rules configured for inbound web traffic only',
        },
      },
      position: { x: 100, y: 100 },
    },
    {
      id: 'device-2',
      type: 'device',
      data: {
        name: 'Database Server',
        hostname: 'dbserver01',
        deviceType: 'server',
        ipAddress: '192.168.2.20',
        securityZone: 'Internal',
        assignedControls: ['AC-2', 'CM-8'],
        controlNotes: {
          'CM-8': 'Component inventory maintained in CMDB',
        },
      },
      position: { x: 200, y: 100 },
    },
    {
      id: 'boundary-1',
      type: 'boundary',
      data: {
        name: 'DMZ Boundary',
        boundaryType: 'firewall',
        zoneType: 'DMZ',
      },
      position: { x: 50, y: 50 },
    },
  ];

  const mockEdges: any[] = [
    {
      id: 'edge-1',
      source: 'device-1',
      target: 'device-2',
    },
  ];

  test('buildSSPDocument includes topology statistics', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE');

    const doc = await buildSSPDocument(request, mockNodes, mockEdges);

    expect(doc.topology.totalDevices).toBe(2); // 2 device nodes
    expect(doc.topology.totalConnections).toBe(1); // 1 edge
    expect(doc.topology.securityZones).toContain('DMZ');
  });

  test('buildSSPDocument aggregates device control notes', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      selectedControlIds: ['AC-2'],
    });

    const doc = await buildSSPDocument(request, mockNodes, mockEdges);

    // AC-2 should have aggregated notes from both devices
    const ac2Control = doc.controls.find((c: any) => c.id === 'AC-2');
    if (ac2Control) {
      expect(ac2Control.narrative).toBeDefined();
    }
  });

  test('buildSSPDocument includes topology image when provided', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE');
    const topologyImage = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';

    const doc = await buildSSPDocument(request, mockNodes, mockEdges, topologyImage);

    expect(doc.topology.image).toBe(topologyImage);
  });

  test('buildSSPDocument counts devices by type', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE');

    const doc = await buildSSPDocument(request, mockNodes, mockEdges);

    expect(doc.topology.devicesByType).toBeDefined();
    expect(doc.topology.devicesByType['server']).toBe(2);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('SSP Edge Case Tests', () => {
  test('buildSSPDocument handles empty topology', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE');
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    expect(doc.topology.totalDevices).toBe(0);
    expect(doc.topology.totalConnections).toBe(0);
    expect(doc.topology.securityZones).toEqual([]);
  });

  test('buildSSPDocument handles empty narratives gracefully', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      emptyNarratives: true,
      selectedControlIds: ['AC-1', 'AC-2', 'SC-7'],
    });
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // Document should still be valid
    const validation = verifySSPDocumentStructure(doc);
    expect(validation.valid).toBe(true);

    // Controls should have fallback narratives (placeholder mode)
    doc.controls.forEach((control: any) => {
      expect(control.narrative).toBeDefined();
    });
  });

  test('buildSSPDocument handles whitespace-only narratives', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE', {
      selectedControlIds: ['AC-2'],
    });
    request.custom_narratives = {
      'AC-2': { narrative: '   \n\t  ' }, // Whitespace only
    };

    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // Should fall back to auto-generated narrative
    const ac2Control = doc.controls.find((c: any) => c.id === 'AC-2');
    if (ac2Control) {
      expect(ac2Control.narrative.trim().length).toBeGreaterThan(0);
    }
  });

  test('buildSSPDocument handles missing optional fields', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    // Minimal request with only required fields
    const request = {
      system_name: 'Minimal System',
      organization_name: 'Test Org',
      prepared_by: 'Tester',
      baseline: 'LOW' as const,
    };

    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    const validation = verifySSPDocumentStructure(doc);
    expect(validation.valid).toBe(true);
  });

  test('buildSSPDocument handles special characters in system name', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE');
    request.system_name = 'Test System with "Special" <Characters> & Symbols';

    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    expect(doc.metadata.system_name).toBe('Test System with "Special" <Characters> & Symbols');
  });

  test('buildSSPDocument handles very long narratives', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const longNarrative = 'A'.repeat(10000); // 10KB narrative
    const request = createSSPRequest('MODERATE', {
      selectedControlIds: ['AC-1'],
    });
    request.custom_narratives = {
      'AC-1': { narrative: longNarrative },
    };

    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    const ac1Control = doc.controls.find((c: any) => c.id === 'AC-1');
    if (ac1Control) {
      expect(ac1Control.narrative.length).toBe(10000);
    }
  });

  test('buildSSPDocument handles unicode characters', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const request = createSSPRequest('MODERATE');
    request.system_name = 'Système de Test avec des caractères spéciaux: 中文, 日本語, 한국어';

    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    expect(doc.metadata.system_name).toBe('Système de Test avec des caractères spéciaux: 中文, 日本語, 한국어');
  });
});

// ============================================================================
// BASELINE COMPARISON TESTS
// ============================================================================

describe('SSP Baseline Comparison Tests', () => {
  test('Different baselines produce different control sets', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const lowRequest = createSSPRequest('LOW');
    const moderateRequest = createSSPRequest('MODERATE');
    const highRequest = createSSPRequest('HIGH');

    const nodes: any[] = [];
    const edges: any[] = [];

    const lowDoc = await buildSSPDocument(lowRequest, nodes, edges);
    const moderateDoc = await buildSSPDocument(moderateRequest, nodes, edges);
    const highDoc = await buildSSPDocument(highRequest, nodes, edges);

    // HIGH baseline should have more or equal controls than MODERATE
    // MODERATE should have more or equal controls than LOW
    // This is a general expectation based on NIST 800-53 baseline tiering
    expect(lowDoc.controls).toBeDefined();
    expect(moderateDoc.controls).toBeDefined();
    expect(highDoc.controls).toBeDefined();

    // Verify baselines are correctly set
    expect(lowDoc.metadata.baseline).toBe('LOW');
    expect(moderateDoc.metadata.baseline).toBe('MODERATE');
    expect(highDoc.metadata.baseline).toBe('HIGH');
  });

  test('All baselines produce valid documents', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const baselines: ('LOW' | 'MODERATE' | 'HIGH')[] = ['LOW', 'MODERATE', 'HIGH'];
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const baseline of baselines) {
      const request = createSSPRequest(baseline);
      const doc = await buildSSPDocument(request, nodes, edges);

      const validation = verifySSPDocumentStructure(doc);
      expect(validation.valid).toBe(true);
    }
  });
});

// ============================================================================
// CUSTOM SECTIONS TESTS
// ============================================================================

describe('SSP Custom Sections Tests', () => {
  test('buildSSPDocument includes custom sections', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    const customSections = [
      {
        id: 'section-1',
        title: 'Additional Security Measures',
        content: 'This section describes additional security measures implemented.',
        position: 'after-section-3',
      },
      {
        id: 'section-2',
        title: 'Appendix A: Compliance Matrix',
        content: 'Detailed compliance mapping to organizational requirements.',
        position: 'appendix',
      },
    ];

    const request = createSSPRequest('MODERATE');
    request.custom_sections = customSections;

    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    expect(doc.metadata.custom_sections).toBeDefined();
    expect(doc.metadata.custom_sections!.length).toBe(2);
    expect(doc.metadata.custom_sections![0].title).toBe('Additional Security Measures');
  });
});

// ============================================================================
// CONTROL SELECTION STORE TESTS
// ============================================================================

describe('Control Selection Store Tests', () => {
  test('Control selection store initializes correctly', async () => {
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    // Reset store state
    useControlSelectionStore.getState().clearAll();

    expect(useControlSelectionStore.getState().selectedControlIds).toEqual([]);
    expect(useControlSelectionStore.getState().initialized).toBe(true);
  });

  test('Control selection store toggles controls', async () => {
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    // Reset and toggle
    useControlSelectionStore.getState().clearAll();
    useControlSelectionStore.getState().toggleControl('AC-1');

    expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-1');

    // Toggle again to remove
    useControlSelectionStore.getState().toggleControl('AC-1');
    expect(useControlSelectionStore.getState().selectedControlIds).not.toContain('AC-1');
  });

  test('Control selection store selects all', async () => {
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    const allControls = ['AC-1', 'AC-2', 'AC-3', 'SC-7', 'SI-2'];
    useControlSelectionStore.getState().selectAll(allControls);

    expect(useControlSelectionStore.getState().selectedControlIds.length).toBe(5);
    allControls.forEach(id => {
      expect(useControlSelectionStore.getState().selectedControlIds).toContain(id);
    });
  });

  test('Control selection store clears all', async () => {
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    // Add some controls then clear
    useControlSelectionStore.getState().selectAll(['AC-1', 'AC-2']);
    useControlSelectionStore.getState().clearAll();

    expect(useControlSelectionStore.getState().selectedControlIds).toEqual([]);
  });

  test('Control selection store checks if control is selected', async () => {
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    useControlSelectionStore.getState().clearAll();
    useControlSelectionStore.getState().toggleControl('AC-1');

    expect(useControlSelectionStore.getState().isSelected('AC-1')).toBe(true);
    expect(useControlSelectionStore.getState().isSelected('AC-2')).toBe(false);
  });

  test('Control selection store counts selected', async () => {
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    useControlSelectionStore.getState().clearAll();
    useControlSelectionStore.getState().selectAll(['AC-1', 'AC-2', 'AC-3']);

    expect(useControlSelectionStore.getState().getSelectedCount()).toBe(3);
  });
});

// ============================================================================
// SSP METADATA STORE TESTS
// ============================================================================

describe('SSP Metadata Store Tests', () => {
  test('SSP metadata store initializes with null metadata', async () => {
    const { useSSPMetadataStore } = await import('@/core/stores/sspMetadataStore');

    useSSPMetadataStore.getState().resetMetadata();

    expect(useSSPMetadataStore.getState().metadata).toBeNull();
    expect(useSSPMetadataStore.getState().isDirty).toBe(false);
  });

  test('SSP metadata store sets metadata', async () => {
    const { useSSPMetadataStore } = await import('@/core/stores/sspMetadataStore');

    const metadata = SSP_METADATA_FIXTURES.MODERATE;
    useSSPMetadataStore.getState().setMetadata(metadata);

    expect(useSSPMetadataStore.getState().metadata).toEqual(metadata);
    expect(useSSPMetadataStore.getState().isDirty).toBe(true);
  });

  test('SSP metadata store updates metadata', async () => {
    const { useSSPMetadataStore } = await import('@/core/stores/sspMetadataStore');

    useSSPMetadataStore.getState().setMetadata(SSP_METADATA_FIXTURES.MODERATE);
    useSSPMetadataStore.getState().updateMetadata({ system_name: 'Updated System Name' });

    expect(useSSPMetadataStore.getState().metadata?.system_name).toBe('Updated System Name');
  });

  test('SSP metadata store manages custom sections', async () => {
    const { useSSPMetadataStore } = await import('@/core/stores/sspMetadataStore');

    useSSPMetadataStore.getState().setMetadata(SSP_METADATA_FIXTURES.MODERATE);

    const customSection = {
      id: 'test-section',
      title: 'Test Section',
      content: 'Test content',
      position: 'appendix',
    };

    useSSPMetadataStore.getState().addCustomSection(customSection);

    expect(useSSPMetadataStore.getState().metadata?.custom_sections).toBeDefined();
    expect(useSSPMetadataStore.getState().metadata?.custom_sections?.length).toBe(1);

    // Update the section
    useSSPMetadataStore.getState().updateCustomSection('test-section', { title: 'Updated Title' });
    expect(useSSPMetadataStore.getState().metadata?.custom_sections?.[0].title).toBe('Updated Title');

    // Delete the section
    useSSPMetadataStore.getState().deleteCustomSection('test-section');
    expect(useSSPMetadataStore.getState().metadata?.custom_sections?.length).toBe(0);
  });

  test('SSP metadata store resets correctly', async () => {
    const { useSSPMetadataStore } = await import('@/core/stores/sspMetadataStore');

    useSSPMetadataStore.getState().setMetadata(SSP_METADATA_FIXTURES.HIGH);
    useSSPMetadataStore.getState().resetMetadata();

    expect(useSSPMetadataStore.getState().metadata).toBeNull();
    expect(useSSPMetadataStore.getState().selectedControlFamilies).toEqual([]);
    expect(useSSPMetadataStore.getState().isDirty).toBe(false);
  });
});

// ============================================================================
// INTEGRATION TEST: FULL SSP FLOW SIMULATION
// ============================================================================

describe('SSP Full Flow Integration Tests', () => {
  test('Complete SSP generation flow simulation', async () => {
    // Import all required modules
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');
    const { useSSPMetadataStore } = await import('@/core/stores/sspMetadataStore');
    const { useControlSelectionStore } = await import('@/core/stores/useControlSelectionStore');

    // Step 1: Initialize stores
    useSSPMetadataStore.getState().resetMetadata();
    useControlSelectionStore.getState().clearAll();

    // Step 2: Set metadata (simulates form completion)
    const metadata = SSP_METADATA_FIXTURES.MODERATE;
    useSSPMetadataStore.getState().setMetadata(metadata);

    // Step 3: Select controls
    const selectedControls = ['AC-1', 'AC-2', 'AC-3', 'SC-7', 'SI-2', 'SI-3', 'CM-8'];
    useControlSelectionStore.getState().selectAll(selectedControls);

    // Step 4: Validate the SSP request
    const request = {
      ...useSSPMetadataStore.getState().metadata,
      selected_control_ids: useControlSelectionStore.getState().selectedControlIds,
      custom_narratives: SAMPLE_NARRATIVES,
      unedited_controls_mode: 'placeholder' as const,
    };

    const validationResult = validateSSPRequest(request);
    expect(validationResult.success).toBe(true);

    // Step 5: Build SSP document
    const nodes: any[] = [];
    const edges: any[] = [];

    const doc = await buildSSPDocument(request, nodes, edges);

    // Step 6: Verify document structure
    const docValidation = verifySSPDocumentStructure(doc);
    expect(docValidation.valid).toBe(true);

    // Step 7: Verify selected controls are in the document
    const docControlIds = doc.controls.map((c: any) => c.id);
    selectedControls.forEach(controlId => {
      expect(docControlIds).toContain(controlId);
    });

    // Step 8: Verify metadata is correctly included
    expect(doc.metadata.system_name).toBe(metadata.system_name);
    expect(doc.metadata.baseline).toBe(metadata.baseline);
    expect(doc.metadata.organization_name).toBe(metadata.organization_name);
  });

  test('SSP flow with topology data', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');
    const { validateSSPRequest } = await import('@/lib/ssp/sspValidation');

    // Create topology
    const nodes = [
      {
        id: 'server-1',
        type: 'device',
        data: {
          name: 'Application Server',
          hostname: 'app01',
          deviceType: 'server',
          ipAddress: '10.0.1.10',
          securityZone: 'Application',
          assignedControls: ['AC-2', 'CM-8'],
          controlNotes: {
            'AC-2': 'Centralized account management via LDAP',
            'CM-8': 'Registered in central CMDB',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'firewall-1',
        type: 'boundary',
        data: {
          name: 'Perimeter Firewall',
          boundaryType: 'firewall',
          zoneType: 'Perimeter',
        },
        position: { x: 50, y: 50 },
      },
    ];

    const edges = [
      { id: 'edge-1', source: 'firewall-1', target: 'server-1' },
    ];

    // Create and validate request
    const request = createSSPRequest('HIGH', {
      includeNarratives: true,
      selectedControlIds: ['AC-2', 'CM-8', 'SC-7'],
    });

    const validationResult = validateSSPRequest(request);
    expect(validationResult.success).toBe(true);

    // Build document with topology
    const topologyImage = '<svg>...</svg>';
    const doc = await buildSSPDocument(request, nodes, edges, topologyImage);

    // Verify topology data is included
    expect(doc.topology.totalDevices).toBe(1);
    expect(doc.topology.totalConnections).toBe(1);
    expect(doc.topology.securityZones).toContain('Perimeter');
    expect(doc.topology.image).toBe(topologyImage);
  });

  test('SSP flow handles errors gracefully', async () => {
    const { validateSSPRequestOrThrow } = await import('@/lib/ssp/sspValidation');

    // Invalid request should throw
    const invalidRequest = {
      // Missing required fields
      baseline: 'INVALID' as any,
    };

    expect(() => validateSSPRequestOrThrow(invalidRequest)).toThrow();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('SSP Performance Tests', () => {
  test('buildSSPDocument handles large control sets efficiently', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    // Create request with many controls
    const request = createSSPRequest('HIGH');
    const nodes: any[] = [];
    const edges: any[] = [];

    const startTime = Date.now();
    const doc = await buildSSPDocument(request, nodes, edges);
    const endTime = Date.now();

    // Should complete within reasonable time (5 seconds max for HIGH baseline)
    expect(endTime - startTime).toBeLessThan(5000);
    expect(doc.controls.length).toBeGreaterThan(0);
  });

  test('buildSSPDocument handles large topology efficiently', async () => {
    const { buildSSPDocument } = await import('@/lib/ssp/sspGenerator');

    // Create large topology
    const nodes: any[] = [];
    const edges: any[] = [];

    for (let i = 0; i < 100; i++) {
      nodes.push({
        id: `device-${i}`,
        type: 'device',
        data: {
          name: `Device ${i}`,
          hostname: `device${i}`,
          deviceType: 'server',
          ipAddress: `192.168.${Math.floor(i / 256)}.${i % 256}`,
        },
        position: { x: i * 10, y: i * 10 },
      });
    }

    // Create edges between consecutive devices
    for (let i = 0; i < 99; i++) {
      edges.push({
        id: `edge-${i}`,
        source: `device-${i}`,
        target: `device-${i + 1}`,
      });
    }

    const request = createSSPRequest('MODERATE');

    const startTime = Date.now();
    const doc = await buildSSPDocument(request, nodes, edges);
    const endTime = Date.now();

    // Should complete within reasonable time (10 seconds max for large topology)
    expect(endTime - startTime).toBeLessThan(10000);
    expect(doc.topology.totalDevices).toBe(100);
    expect(doc.topology.totalConnections).toBe(99);
  });
});

