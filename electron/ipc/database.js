import { getDatabase, syncDevicesToTable, enrichNodesWithDeviceMetadata } from '../database/index.js';

/**
 * Apply delta changes to stored diagram JSON
 * @param {Object} currentDiagram - Current diagram from database
 * @param {Array} nodeChanges - Node changes to apply
 * @param {Array} edgeChanges - Edge changes to apply
 * @returns {Object} Updated nodes and edges arrays
 */
function applyDeltaChanges(currentDiagram, nodeChanges, edgeChanges) {
  // Parse current state
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

  // Create maps for fast lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edgeMap = new Map(edges.map(e => [e.id, e]));

  // Apply node changes
  for (const change of nodeChanges) {
    switch (change.type) {
      case 'add':
        if (change.node) {
          nodeMap.set(change.nodeId, change.node);
        }
        break;
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

  // Apply edge changes
  for (const change of edgeChanges) {
    switch (change.type) {
      case 'add':
        if (change.edge) {
          edgeMap.set(change.edgeId, change.edge);
        }
        break;
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
 * Register all database-related IPC handlers
 */
export function registerDatabaseHandlers(ipcMain) {
  const db = getDatabase();

  ipcMain.handle('db:create-project', async (event, { name, baseline }) => {
    try {
      const stmt = db.prepare('INSERT INTO projects (name, baseline) VALUES (?, ?)');
      const result = stmt.run(name, baseline || 'MODERATE');
      return { id: result.lastInsertRowid, name, baseline: baseline || 'MODERATE' };
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:list-projects', async () => {
    try {
      const stmt = db.prepare(`
        SELECT id, name, created_at, updated_at, COALESCE(baseline, 'MODERATE') as baseline
        FROM projects
        ORDER BY updated_at DESC
      `);
      return stmt.all();
    } catch (error) {
      console.error('Error listing projects:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-diagram', async (event, { projectId, nodes, edges, viewport }) => {
    try {
      // Update project updated_at
      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
      
      // Check if diagram exists
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
      
      // Sync devices to normalized table (after successful JSON save)
      syncDevicesToTable(projectId, nodes);

      return { success: true, isDelta: false };
    } catch (error) {
      console.error('Error saving diagram:', error);
      throw error;
    }
  });

  /**
   * Delta-based save handler
   * Applies incremental changes instead of replacing the entire diagram
   * Reduces IPC overhead and database write volume for large diagrams
   */
  ipcMain.handle('db:save-diagram-delta', async (event, { projectId, nodeChanges, edgeChanges, sequence }) => {
    try {
      // Update project updated_at
      db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

      // Get current diagram
      const existing = db.prepare('SELECT id, nodes, edges, viewport FROM diagrams WHERE project_id = ?').get(projectId);

      if (!existing) {
        // No existing diagram - this shouldn't happen for delta saves
        // Signal that a full save is required
        return {
          success: false,
          requiresFullSave: true,
          error: 'No existing diagram found for delta save',
        };
      }

      // Apply delta changes
      const { nodes: updatedNodes, edges: updatedEdges } = applyDeltaChanges(
        existing,
        nodeChanges || [],
        edgeChanges || []
      );

      // Save updated diagram
      const stmt = db.prepare(`
        UPDATE diagrams
        SET nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(updatedNodes), JSON.stringify(updatedEdges), projectId);

      // Sync only changed device nodes to normalized table
      // For delta saves, we can be more selective about what we sync
      const changedNodeIds = new Set((nodeChanges || []).map(c => c.nodeId));
      const changedNodes = updatedNodes.filter(n => changedNodeIds.has(n.id));

      if (changedNodes.length > 0) {
        // Sync only the changed devices
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
    } catch (error) {
      console.error('Error saving diagram delta:', error);
      // On error, signal that a full save might be needed
      return {
        success: false,
        requiresFullSave: true,
        error: error.message,
      };
    }
  });

  ipcMain.handle('db:load-diagram', async (event, projectId) => {
    try {
      const stmt = db.prepare('SELECT * FROM diagrams WHERE project_id = ?');
      const diagram = stmt.get(projectId);
      
      if (!diagram) {
        return { nodes: [], edges: [], viewport: null };
      }
      
      let nodes = JSON.parse(diagram.nodes);
      
      // Enrich device nodes with metadata from devices table (single source of truth)
      // This ensures inventory and topology both use the same data
      nodes = enrichNodesWithDeviceMetadata(projectId, nodes);
      
      return {
        nodes,
        edges: JSON.parse(diagram.edges),
        viewport: diagram.viewport ? JSON.parse(diagram.viewport) : null,
      };
    } catch (error) {
      console.error('Error loading diagram:', error);
      throw error;
    }
  });

  ipcMain.handle('db:load-control-narratives', async (event, projectId) => {
    try {
      const stmt = db.prepare(`
        SELECT control_id, narrative, implementation_status, system_implementation
        FROM control_narratives
        WHERE project_id = ?
      `);
      return stmt.all(projectId);
    } catch (error) {
      console.error('Error loading control narratives:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-control-narratives', async (event, { projectId, narratives }) => {
    try {
      if (!projectId || !Array.isArray(narratives)) {
        throw new Error('Invalid payload for saving control narratives');
      }

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
    } catch (error) {
      console.error('Error saving control narratives:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-ssp-metadata', async (event, { projectId, metadata }) => {
    if (process.env.DEBUG) {
      console.log('[IPC] db:save-ssp-metadata called with projectId:', projectId);
    }
    try {
      if (!projectId || !metadata) {
        throw new Error('Invalid payload for saving SSP metadata');
      }

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
    } catch (error) {
      console.error('Error saving SSP metadata:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-ssp-metadata', async (event, projectId) => {
    if (process.env.DEBUG) {
      console.log('[IPC] db:get-ssp-metadata called with projectId:', projectId);
    }
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const metadata = db.prepare('SELECT * FROM ssp_metadata WHERE project_id = ?').get(projectId);
      if (process.env.DEBUG) {
        console.log('[IPC] db:get-ssp-metadata returning:', metadata ? 'data found' : 'no data');
      }
      return metadata || null;
    } catch (error) {
      console.error('Error fetching SSP metadata:', error);
      throw error;
    }
  });

  ipcMain.handle('db:reset-control-narrative', async (event, { projectId, controlId }) => {
    try {
      if (!projectId || !controlId) {
        throw new Error('Invalid payload for resetting control narrative');
      }

      db.prepare('DELETE FROM control_narratives WHERE project_id = ? AND control_id = ?')
        .run(projectId, controlId);

      return { success: true };
    } catch (error) {
      console.error('Error resetting control narrative:', error);
      throw error;
    }
  });

  ipcMain.handle('db:update-project-baseline', async (event, { projectId, baseline }) => {
    if (process.env.DEBUG) {
      console.log('[IPC] db:update-project-baseline called with:', { projectId, baseline });
    }
    try {
      if (!projectId || !baseline) {
        throw new Error('Invalid payload for updating project baseline');
      }

      const stmt = db.prepare(`
        UPDATE projects
        SET baseline = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(baseline, projectId);

      if (process.env.DEBUG) {
        console.log('[IPC] db:update-project-baseline success');
      }
      return { success: true, baseline };
    } catch (error) {
      console.error('Error updating project baseline:', error);
      throw error;
    }
  });

  ipcMain.handle('db:save-single-control-narrative', async (event, { projectId, controlId, systemImplementation, implementationStatus }) => {
    try {
      if (!projectId || !controlId) {
        throw new Error('Invalid payload for saving single control narrative');
      }

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
    } catch (error) {
      console.error('Error saving single control narrative:', error);
      throw error;
    }
  });

  ipcMain.handle('db:delete-project', async (event, projectId) => {
    try {
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:query-devices', async (event, { projectId, filters = {} }) => {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      let query = 'SELECT * FROM devices WHERE project_id = ?';
      const params = [projectId];

      // Build WHERE clause from filters
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
      
      // Parse JSON fields back to objects/arrays
      return devices.map(device => ({
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
      }));
    } catch (error) {
      console.error('Error querying devices:', error);
      throw error;
    }
  });

  ipcMain.handle('db:get-device', async (event, { projectId, deviceId }) => {
    try {
      if (!projectId || !deviceId) {
        throw new Error('Project ID and Device ID are required');
      }

      const stmt = db.prepare('SELECT * FROM devices WHERE project_id = ? AND id = ?');
      const device = stmt.get(projectId, deviceId);
      
      if (!device) {
        return null;
      }

      // Parse JSON fields back to objects/arrays
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
    } catch (error) {
      console.error('Error getting device:', error);
      throw error;
    }
  });

  ipcMain.handle('db:search-devices', async (event, { projectId, searchTerm }) => {
    try {
      if (!projectId || !searchTerm) {
        throw new Error('Project ID and search term are required');
      }

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
      
      // Parse JSON fields back to objects/arrays
      return devices.map(device => ({
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
      }));
    } catch (error) {
      console.error('Error searching devices:', error);
      throw error;
    }
  });
}

