/**
 * Database Router - Type-safe tRPC procedures for database operations
 * Migrates from string-based IPC channels (db:*) to type-safe procedures
 */
import { z } from 'zod';
import { router, publicProcedure } from '../trpc.js';
import {
  createProjectSchema,
  saveDiagramSchema,
  saveDiagramDeltaSchema,
  saveControlNarrativesSchema,
  resetControlNarrativeSchema,
  updateProjectBaselineSchema,
  saveSingleControlNarrativeSchema,
  queryDevicesSchema,
  getDeviceSchema,
  searchDevicesSchema,
  saveSSPMetadataSchema,
} from '../../ipc-validation.js';

// Import database functions - these will be injected at runtime
let getDatabase;
let syncDevicesToTable;
let enrichNodesWithDeviceMetadata;

/**
 * Initialize database functions - called from main process
 */
export function initializeDatabaseRouter(dbFunctions) {
  getDatabase = dbFunctions.getDatabase;
  syncDevicesToTable = dbFunctions.syncDevicesToTable;
  enrichNodesWithDeviceMetadata = dbFunctions.enrichNodesWithDeviceMetadata;
}

/**
 * Apply delta changes to stored diagram JSON
 */
function applyDeltaChanges(
  currentDiagram,
  nodeChanges,
  edgeChanges
) {
  let nodes = [];
  let edges = [];

  try {
    nodes = typeof currentDiagram.nodes === 'string'
      ? JSON.parse(currentDiagram.nodes)
      : (currentDiagram.nodes || []);
    edges = typeof currentDiagram.edges === 'string'
      ? JSON.parse(currentDiagram.edges)
      : (currentDiagram.edges || []);
  } catch (e) {
    console.error('Error parsing current diagram:', e);
    nodes = [];
    edges = [];
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(edges.map((e) => [e.id, e]));

  for (const change of nodeChanges) {
    switch (change.type) {
      case 'add':
      case 'update':
        if (change.node) {
          nodeMap.set(change.nodeId, change.node);
        }
        break;
      case 'remove':
        nodeMap.delete(change.nodeId);
        break;
    }
  }

  for (const change of edgeChanges) {
    switch (change.type) {
      case 'add':
      case 'update':
        if (change.edge) {
          edgeMap.set(change.edgeId, change.edge);
        }
        break;
      case 'remove':
        edgeMap.delete(change.edgeId);
        break;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

/**
 * Parse device JSON fields and convert booleans
 */
function parseDeviceRecord(device) {
  return {
    ...device,
    applicableControls: device.applicable_controls ? JSON.parse(device.applicable_controls) : null,
    assignedControls: device.assigned_controls ? JSON.parse(device.assigned_controls) : null,
    tags: device.tags ? JSON.parse(device.tags) : null,
    controlNotes: device.control_notes ? JSON.parse(device.control_notes) : null,
    labelFields: device.label_fields ? JSON.parse(device.label_fields) : null,
    missionCritical: device.mission_critical === 1,
    multifactorAuth: device.multifactor_auth === 1,
    encryptionAtRest: device.encryption_at_rest === 1,
    encryptionInTransit: device.encryption_in_transit === 1,
    backupsConfigured: device.backups_configured === 1,
    monitoringEnabled: device.monitoring_enabled === 1,
    firewallEnabled: device.firewall_enabled === 1,
    antivirusEnabled: device.antivirus_enabled === 1,
  };
}

/**
 * Database Router - all database operations as type-safe procedures
 */
export const databaseRouter = router({
  /**
   * Create a new project
   */
  createProject: publicProcedure
    .input(createProjectSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const stmt = db.prepare('INSERT INTO projects (name, baseline) VALUES (?, ?)');
      const result = stmt.run(input.name, input.baseline || 'MODERATE');
      return {
        id: Number(result.lastInsertRowid),
        name: input.name,
        baseline: input.baseline || 'MODERATE'
      };
    }),

  /**
   * List all projects
   */
  listProjects: publicProcedure
    .query(async () => {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT id, name, created_at, updated_at, COALESCE(baseline, 'MODERATE') as baseline
        FROM projects
        ORDER BY updated_at DESC
      `);
      return stmt.all();
    }),

  /**
   * Delete a project
   */
  deleteProject: publicProcedure
    .input(z.number().int().positive())
    .mutation(async ({ input: projectId }) => {
      const db = getDatabase();
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      return { success: true };
    }),

  /**
   * Save complete diagram state
   */
  saveDiagram: publicProcedure
    .input(saveDiagramSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, nodes, edges, viewport } = input;

      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

      const existing = db.prepare('SELECT id FROM diagrams WHERE project_id = ?').get(projectId);

      if (existing) {
        const stmt = db.prepare(`
          UPDATE diagrams
          SET nodes = ?, edges = ?, viewport = ?, updated_at = CURRENT_TIMESTAMP
          WHERE project_id = ?
        `);
        stmt.run(JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(viewport), projectId);
      } else {
        const stmt = db.prepare(`
          INSERT INTO diagrams (project_id, nodes, edges, viewport)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(projectId, JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(viewport));
      }

      syncDevicesToTable(projectId, nodes);

      return { success: true, isDelta: false };
    }),

  /**
   * Save diagram delta (incremental changes)
   */
  saveDiagramDelta: publicProcedure
    .input(saveDiagramDeltaSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, nodeChanges, edgeChanges, sequence } = input;

      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

      const existing = db.prepare('SELECT id, nodes, edges, viewport FROM diagrams WHERE project_id = ?').get(projectId);

      if (!existing) {
        return {
          success: false,
          requiresFullSave: true,
          error: 'No existing diagram found for delta save',
        };
      }

      const { nodes: updatedNodes, edges: updatedEdges } = applyDeltaChanges(
        existing,
        nodeChanges || [],
        edgeChanges || []
      );

      const stmt = db.prepare(`
        UPDATE diagrams
        SET nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(updatedNodes), JSON.stringify(updatedEdges), projectId);

      const changedNodeIds = new Set((nodeChanges || []).map((c) => c.nodeId));
      const changedNodes = updatedNodes.filter((n) => changedNodeIds.has(n.id));

      if (changedNodes.length > 0) {
        syncDevicesToTable(projectId, updatedNodes);
      }

      return {
        success: true,
        isDelta: true,
        appliedChanges: {
          nodes: (nodeChanges || []).length,
          edges: (edgeChanges || []).length,
        },
        serverSequence: sequence,
      };
    }),

  /**
   * Load diagram for a project
   */
  loadDiagram: publicProcedure
    .input(z.number().int().positive())
    .query(async ({ input: projectId }) => {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM diagrams WHERE project_id = ?');
      const diagram = stmt.get(projectId);

      if (!diagram) {
        return { nodes: [], edges: [], viewport: null };
      }

      let nodes = JSON.parse(diagram.nodes);
      nodes = enrichNodesWithDeviceMetadata(projectId, nodes);

      return {
        nodes,
        edges: JSON.parse(diagram.edges),
        viewport: diagram.viewport ? JSON.parse(diagram.viewport) : null,
      };
    }),

  /**
   * Load control narratives for a project
   */
  loadControlNarratives: publicProcedure
    .input(z.number().int().positive())
    .query(async ({ input: projectId }) => {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT control_id, narrative, implementation_status, system_implementation
        FROM control_narratives
        WHERE project_id = ?
      `);
      return stmt.all(projectId);
    }),

  /**
   * Save multiple control narratives
   */
  saveControlNarratives: publicProcedure
    .input(saveControlNarrativesSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, narratives } = input;

      const insertStmt = db.prepare(`
        INSERT INTO control_narratives (project_id, control_id, narrative, system_implementation, implementation_status)
        VALUES (@project_id, @control_id, @narrative, @system_implementation, @implementation_status)
        ON CONFLICT(project_id, control_id) DO UPDATE SET
          narrative = excluded.narrative,
          system_implementation = excluded.system_implementation,
          implementation_status = excluded.implementation_status,
          updated_at = CURRENT_TIMESTAMP
      `);

      const runInsert = db.transaction((records) => {
        for (const record of records) {
          insertStmt.run({
            project_id: projectId,
            control_id: record.control_id,
            narrative: record.narrative ?? record.system_implementation ?? null,
            system_implementation: record.system_implementation ?? record.narrative ?? null,
            implementation_status: record.implementation_status ?? null,
          });
        }
      });

      runInsert(narratives);

      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

      return { success: true };
    }),

  /**
   * Save a single control narrative
   */
  saveSingleControlNarrative: publicProcedure
    .input(saveSingleControlNarrativeSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, controlId, systemImplementation, implementationStatus } = input;

      const insertStmt = db.prepare(`
        INSERT INTO control_narratives (project_id, control_id, narrative, system_implementation, implementation_status)
        VALUES (@project_id, @control_id, @narrative, @system_implementation, @implementation_status)
        ON CONFLICT(project_id, control_id) DO UPDATE SET
          narrative = excluded.narrative,
          system_implementation = excluded.system_implementation,
          implementation_status = excluded.implementation_status,
          updated_at = CURRENT_TIMESTAMP
      `);

      insertStmt.run({
        project_id: projectId,
        control_id: controlId,
        narrative: systemImplementation ?? null,
        system_implementation: systemImplementation ?? null,
        implementation_status: implementationStatus ?? null,
      });

      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

      return { success: true };
    }),

  /**
   * Reset a control narrative to default
   */
  resetControlNarrative: publicProcedure
    .input(resetControlNarrativeSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, controlId } = input;

      db.prepare('DELETE FROM control_narratives WHERE project_id = ? AND control_id = ?')
        .run(projectId, controlId);

      return { success: true };
    }),

  /**
   * Update project baseline
   */
  updateProjectBaseline: publicProcedure
    .input(updateProjectBaselineSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, baseline } = input;

      const stmt = db.prepare(`
        UPDATE projects
        SET baseline = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(baseline, projectId);

      return { success: true, baseline };
    }),

  /**
   * Get SSP metadata for a project
   */
  getSSPMetadata: publicProcedure
    .input(z.number().int().positive())
    .query(async ({ input: projectId }) => {
      const db = getDatabase();
      const metadata = db.prepare('SELECT * FROM ssp_metadata WHERE project_id = ?').get(projectId);
      return metadata || null;
    }),

  /**
   * Save SSP metadata
   */
  saveSSPMetadata: publicProcedure
    .input(saveSSPMetadataSchema)
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const { projectId, metadata } = input;

      const insertStmt = db.prepare(`
        INSERT INTO ssp_metadata (
          project_id, organization_name, prepared_by, system_description, system_purpose,
          deployment_model, service_model, information_type_title, information_type_description,
          confidentiality_impact, integrity_impact, availability_impact,
          authorization_boundary_description, system_status, system_owner,
          system_owner_email, authorizing_official, authorizing_official_email,
          security_contact, security_contact_email, physical_location,
          data_types_processed, users_description, unedited_controls_mode,
          on_premises_details, cloud_provider, custom_sections, selected_control_ids,
          topology_screenshot
        ) VALUES (
          @project_id, @organization_name, @prepared_by, @system_description, @system_purpose,
          @deployment_model, @service_model, @information_type_title, @information_type_description,
          @confidentiality_impact, @integrity_impact, @availability_impact,
          @authorization_boundary_description, @system_status, @system_owner,
          @system_owner_email, @authorizing_official, @authorizing_official_email,
          @security_contact, @security_contact_email, @physical_location,
          @data_types_processed, @users_description, @unedited_controls_mode,
          @on_premises_details, @cloud_provider, @custom_sections, @selected_control_ids,
          @topology_screenshot
        )
        ON CONFLICT(project_id) DO UPDATE SET
          organization_name = excluded.organization_name,
          prepared_by = excluded.prepared_by,
          system_description = excluded.system_description,
          system_purpose = excluded.system_purpose,
          deployment_model = excluded.deployment_model,
          service_model = excluded.service_model,
          information_type_title = excluded.information_type_title,
          information_type_description = excluded.information_type_description,
          confidentiality_impact = excluded.confidentiality_impact,
          integrity_impact = excluded.integrity_impact,
          availability_impact = excluded.availability_impact,
          authorization_boundary_description = excluded.authorization_boundary_description,
          system_status = excluded.system_status,
          system_owner = excluded.system_owner,
          system_owner_email = excluded.system_owner_email,
          authorizing_official = excluded.authorizing_official,
          authorizing_official_email = excluded.authorizing_official_email,
          security_contact = excluded.security_contact,
          security_contact_email = excluded.security_contact_email,
          physical_location = excluded.physical_location,
          data_types_processed = excluded.data_types_processed,
          users_description = excluded.users_description,
          unedited_controls_mode = excluded.unedited_controls_mode,
          on_premises_details = excluded.on_premises_details,
          cloud_provider = excluded.cloud_provider,
          custom_sections = excluded.custom_sections,
          selected_control_ids = excluded.selected_control_ids,
          topology_screenshot = excluded.topology_screenshot,
          updated_at = CURRENT_TIMESTAMP
      `);

      insertStmt.run({
        project_id: projectId,
        organization_name: metadata.organization_name || null,
        prepared_by: metadata.prepared_by || null,
        system_description: metadata.system_description || null,
        system_purpose: metadata.system_purpose || null,
        deployment_model: metadata.deployment_model || null,
        service_model: metadata.service_model || null,
        information_type_title: metadata.information_type_title || null,
        information_type_description: metadata.information_type_description || null,
        confidentiality_impact: metadata.confidentiality_impact || 'moderate',
        integrity_impact: metadata.integrity_impact || 'moderate',
        availability_impact: metadata.availability_impact || 'moderate',
        authorization_boundary_description: metadata.authorization_boundary_description || null,
        system_status: metadata.system_status || 'operational',
        system_owner: metadata.system_owner || null,
        system_owner_email: metadata.system_owner_email || null,
        authorizing_official: metadata.authorizing_official || null,
        authorizing_official_email: metadata.authorizing_official_email || null,
        security_contact: metadata.security_contact || null,
        security_contact_email: metadata.security_contact_email || null,
        physical_location: metadata.physical_location || null,
        data_types_processed: metadata.data_types_processed || null,
        users_description: metadata.users_description || null,
        unedited_controls_mode: metadata.unedited_controls_mode || 'placeholder',
        on_premises_details: metadata.on_premises_details || null,
        cloud_provider: metadata.cloud_provider || null,
        custom_sections: metadata.custom_sections || '[]',
        selected_control_ids: metadata.selected_control_ids || '[]',
        topology_screenshot: metadata.topology_screenshot || null,
      });

      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

      return { success: true };
    }),

  /**
   * Query devices with filters
   */
  queryDevices: publicProcedure
    .input(queryDevicesSchema)
    .query(async ({ input }) => {
      const db = getDatabase();
      const { projectId, filters = {} } = input;

      let query = 'SELECT * FROM devices WHERE project_id = ?';
      const params = [projectId];

      const conditions = [];
      if (filters.deviceType) {
        conditions.push('device_type = ?');
        params.push(filters.deviceType);
      }
      if (filters.manufacturer) {
        conditions.push('manufacturer = ?');
        params.push(filters.manufacturer);
      }
      if (filters.location) {
        conditions.push('location = ?');
        params.push(filters.location);
      }
      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      if (filters.missionCritical !== undefined) {
        conditions.push('mission_critical = ?');
        params.push(filters.missionCritical ? 1 : 0);
      }
      if (filters.encryptionAtRest !== undefined) {
        conditions.push('encryption_at_rest = ?');
        params.push(filters.encryptionAtRest ? 1 : 0);
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      const stmt = db.prepare(query);
      const devices = stmt.all(...params);

      return devices.map(parseDeviceRecord);
    }),

  /**
   * Get a specific device
   */
  getDevice: publicProcedure
    .input(getDeviceSchema)
    .query(async ({ input }) => {
      const db = getDatabase();
      const { projectId, deviceId } = input;

      const stmt = db.prepare('SELECT * FROM devices WHERE project_id = ? AND id = ?');
      const device = stmt.get(projectId, deviceId);

      if (!device) {
        return null;
      }

      return parseDeviceRecord(device);
    }),

  /**
   * Search devices
   */
  searchDevices: publicProcedure
    .input(searchDevicesSchema)
    .query(async ({ input }) => {
      const db = getDatabase();
      const { projectId, searchTerm } = input;

      const searchPattern = `%${searchTerm}%`;
      const stmt = db.prepare(`
        SELECT * FROM devices
        WHERE project_id = ? AND (
          name LIKE ? OR
          device_type LIKE ? OR
          manufacturer LIKE ? OR
          model LIKE ? OR
          ip_address LIKE ? OR
          location LIKE ? OR
          hostname LIKE ? OR
          serial_number LIKE ?
        )
      `);

      const devices = stmt.all(
        projectId,
        searchPattern, searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern, searchPattern
      );

      return devices.map(parseDeviceRecord);
    }),
});
