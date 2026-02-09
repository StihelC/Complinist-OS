/**
 * Device Repository
 *
 * Handles all database operations for devices including:
 * - CRUD operations for device records
 * - Filtering and searching
 * - Synchronization from diagram nodes
 * - Device metadata enrichment
 */

import { BaseRepository } from './BaseRepository.js';

/**
 * @typedef {Object} DeviceFilters
 * @property {string} [deviceType]
 * @property {string} [manufacturer]
 * @property {string} [location]
 * @property {string} [status]
 * @property {boolean} [missionCritical]
 * @property {boolean} [encryptionAtRest]
 */

/**
 * @typedef {Object} DeviceRecord
 * @property {string} id
 * @property {number} project_id
 * @property {string} name
 * @property {string} device_type
 * ... (many more fields)
 */

export class DeviceRepository extends BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    super(db, 'devices', { primaryKey: 'id', hasTimestamps: true });
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Query devices with filters
   * @param {number} projectId
   * @param {DeviceFilters} [filters={}]
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  queryDevices(projectId, filters = {}) {
    try {
      let query = 'SELECT * FROM devices WHERE project_id = ?';
      const params = [projectId];

      // Build WHERE clause from filters
      const conditions = this.buildFilterConditions(filters, params);
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      const stmt = this.db.prepare(query);
      const devices = stmt.all(...params);

      // Parse JSON fields and convert booleans
      const parsedDevices = devices.map(device => this.parseDeviceRecord(device));

      return { success: true, data: parsedDevices };
    } catch (error) {
      console.error('[DeviceRepository] Error querying devices:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build filter conditions for device queries
   * @private
   * @param {DeviceFilters} filters
   * @param {any[]} params
   * @returns {string[]}
   */
  buildFilterConditions(filters, params) {
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

    return conditions;
  }

  /**
   * Get a single device by ID
   * @param {number} projectId
   * @param {string} deviceId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getDevice(projectId, deviceId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM devices WHERE project_id = ? AND id = ?');
      const device = stmt.get(projectId, deviceId);

      if (!device) {
        return { success: true, data: null };
      }

      return { success: true, data: this.parseDeviceRecord(device) };
    } catch (error) {
      console.error('[DeviceRepository] Error getting device:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search devices by text
   * @param {number} projectId
   * @param {string} searchTerm
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  searchDevices(projectId, searchTerm) {
    try {
      const searchPattern = `%${searchTerm}%`;
      const stmt = this.db.prepare(`
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

      const parsedDevices = devices.map(device => this.parseDeviceRecord(device));
      return { success: true, data: parsedDevices };
    } catch (error) {
      console.error('[DeviceRepository] Error searching devices:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all devices for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getDevicesByProject(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM devices WHERE project_id = ?');
      const devices = stmt.all(projectId);
      const parsedDevices = devices.map(device => this.parseDeviceRecord(device));
      return { success: true, data: parsedDevices };
    } catch (error) {
      console.error('[DeviceRepository] Error getting devices by project:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  /**
   * Sync devices from diagram nodes to the devices table
   * @param {number} projectId
   * @param {Object[]} nodes
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  syncDevicesFromNodes(projectId, nodes) {
    try {
      // Filter to only device nodes (exclude boundaries)
      const deviceNodes = nodes.filter(node =>
        (node.type === 'device' || !node.type) && node.data
      );

      if (deviceNodes.length === 0) {
        // No devices, clean up orphaned devices
        this.cleanupOrphanedDevices(projectId, []);
        return { success: true, data: { synced: 0 } };
      }

      // Use transaction for atomicity
      const syncResult = this.transaction(() => {
        const nodeIds = [];
        for (const node of deviceNodes) {
          const metadata = this.extractDeviceMetadata(node);
          metadata.project_id = projectId;
          this.upsertDevice(metadata);
          nodeIds.push(node.id);
        }
        // Clean up orphaned devices
        this.cleanupOrphanedDevices(projectId, nodeIds);
        return nodeIds.length;
      });

      return { success: true, data: { synced: syncResult } };
    } catch (error) {
      console.error('[DeviceRepository] Error syncing devices:', error);
      // Don't throw - allow diagram save to succeed even if device sync fails
      return { success: false, error: error.message };
    }
  }

  /**
   * Upsert a device record
   * @private
   * @param {Object} metadata
   */
  upsertDevice(metadata) {
    const stmt = this.db.prepare(`
      INSERT INTO devices (
        id, project_id, name, device_type, device_subtype, icon_path,
        ip_address, mac_address, subnet_mask, default_gateway, hostname, dns_servers, vlan_id, ports,
        manufacturer, model, serial_number, firmware_version, operating_system, os_version, software,
        cpu_model, memory_size, storage_size,
        security_zone, asset_value, mission_critical, data_classification,
        multifactor_auth, encryption_at_rest, encryption_in_transit, encryption_status,
        backups_configured, monitoring_enabled, vulnerability_management, risk_level, criticality,
        firewall_enabled, antivirus_enabled, patch_level, last_patch_date,
        applicable_controls, last_vuln_scan, compliance_status, assigned_controls,
        system_owner, owner, department, contact_email, location, cost_center, purchase_date, warranty_expiration,
        notes, tags, status, control_notes,
        label, label_fields, device_image_size,
        updated_at
      ) VALUES (
        @id, @project_id, @name, @device_type, @device_subtype, @icon_path,
        @ip_address, @mac_address, @subnet_mask, @default_gateway, @hostname, @dns_servers, @vlan_id, @ports,
        @manufacturer, @model, @serial_number, @firmware_version, @operating_system, @os_version, @software,
        @cpu_model, @memory_size, @storage_size,
        @security_zone, @asset_value, @mission_critical, @data_classification,
        @multifactor_auth, @encryption_at_rest, @encryption_in_transit, @encryption_status,
        @backups_configured, @monitoring_enabled, @vulnerability_management, @risk_level, @criticality,
        @firewall_enabled, @antivirus_enabled, @patch_level, @last_patch_date,
        @applicable_controls, @last_vuln_scan, @compliance_status, @assigned_controls,
        @system_owner, @owner, @department, @contact_email, @location, @cost_center, @purchase_date, @warranty_expiration,
        @notes, @tags, @status, @control_notes,
        @label, @label_fields, @device_image_size,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(project_id, id) DO UPDATE SET
        name = excluded.name,
        device_type = excluded.device_type,
        device_subtype = excluded.device_subtype,
        icon_path = excluded.icon_path,
        ip_address = excluded.ip_address,
        mac_address = excluded.mac_address,
        subnet_mask = excluded.subnet_mask,
        default_gateway = excluded.default_gateway,
        hostname = excluded.hostname,
        dns_servers = excluded.dns_servers,
        vlan_id = excluded.vlan_id,
        ports = excluded.ports,
        manufacturer = excluded.manufacturer,
        model = excluded.model,
        serial_number = excluded.serial_number,
        firmware_version = excluded.firmware_version,
        operating_system = excluded.operating_system,
        os_version = excluded.os_version,
        software = excluded.software,
        cpu_model = excluded.cpu_model,
        memory_size = excluded.memory_size,
        storage_size = excluded.storage_size,
        security_zone = excluded.security_zone,
        asset_value = excluded.asset_value,
        mission_critical = excluded.mission_critical,
        data_classification = excluded.data_classification,
        multifactor_auth = excluded.multifactor_auth,
        encryption_at_rest = excluded.encryption_at_rest,
        encryption_in_transit = excluded.encryption_in_transit,
        encryption_status = excluded.encryption_status,
        backups_configured = excluded.backups_configured,
        monitoring_enabled = excluded.monitoring_enabled,
        vulnerability_management = excluded.vulnerability_management,
        risk_level = excluded.risk_level,
        criticality = excluded.criticality,
        firewall_enabled = excluded.firewall_enabled,
        antivirus_enabled = excluded.antivirus_enabled,
        patch_level = excluded.patch_level,
        last_patch_date = excluded.last_patch_date,
        applicable_controls = excluded.applicable_controls,
        last_vuln_scan = excluded.last_vuln_scan,
        compliance_status = excluded.compliance_status,
        assigned_controls = excluded.assigned_controls,
        system_owner = excluded.system_owner,
        owner = excluded.owner,
        department = excluded.department,
        contact_email = excluded.contact_email,
        location = excluded.location,
        cost_center = excluded.cost_center,
        purchase_date = excluded.purchase_date,
        warranty_expiration = excluded.warranty_expiration,
        notes = excluded.notes,
        tags = excluded.tags,
        status = excluded.status,
        control_notes = excluded.control_notes,
        label = excluded.label,
        label_fields = excluded.label_fields,
        device_image_size = excluded.device_image_size,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(metadata);
  }

  /**
   * Extract device metadata from a node
   * @private
   * @param {Object} node
   * @returns {Object}
   */
  extractDeviceMetadata(node) {
    const data = node.data || {};

    // Helper to convert boolean to INTEGER
    const boolToInt = (val) => (val === true ? 1 : 0);

    // Helper to convert array/object to JSON string
    const toJsonString = (val) => {
      if (val === null || val === undefined) return null;
      if (Array.isArray(val) || typeof val === 'object') {
        return JSON.stringify(val);
      }
      return val;
    };

    return {
      id: node.id || '',
      name: data.name || '',
      device_type: data.deviceType || '',
      device_subtype: data.deviceSubtype || null,
      icon_path: data.iconPath || null,

      // Network Info
      ip_address: data.ipAddress || null,
      mac_address: data.macAddress || null,
      subnet_mask: data.subnetMask || null,
      default_gateway: data.defaultGateway || null,
      hostname: data.hostname || null,
      dns_servers: data.dnsServers || null,
      vlan_id: data.vlanId || null,
      ports: data.ports || null,

      // Hardware Info
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      serial_number: data.serialNumber || null,
      firmware_version: data.firmwareVersion || null,
      operating_system: data.operatingSystem || null,
      os_version: data.osVersion || null,
      software: data.software || null,
      cpu_model: data.cpuModel || null,
      memory_size: data.memorySize || null,
      storage_size: data.storageSize || null,

      // Security Classification
      security_zone: data.securityZone || null,
      asset_value: data.assetValue || null,
      mission_critical: boolToInt(data.missionCritical),
      data_classification: data.dataClassification || null,

      // Security Posture
      multifactor_auth: boolToInt(data.multifactorAuth),
      encryption_at_rest: boolToInt(data.encryptionAtRest),
      encryption_in_transit: boolToInt(data.encryptionInTransit),
      encryption_status: data.encryptionStatus || null,
      backups_configured: boolToInt(data.backupsConfigured),
      monitoring_enabled: boolToInt(data.monitoringEnabled),
      vulnerability_management: data.vulnerabilityManagement || null,
      risk_level: data.riskLevel || null,
      criticality: data.criticality || null,
      firewall_enabled: boolToInt(data.firewallEnabled),
      antivirus_enabled: boolToInt(data.antivirusEnabled),
      patch_level: data.patchLevel || null,
      last_patch_date: data.lastPatchDate || null,

      // Compliance
      applicable_controls: toJsonString(data.applicableControls),
      last_vuln_scan: data.lastVulnScan || null,
      compliance_status: data.complianceStatus || null,
      assigned_controls: toJsonString(data.assignedControls),

      // Ownership
      system_owner: data.systemOwner || null,
      owner: data.owner || null,
      department: data.department || null,
      contact_email: data.contactEmail || null,
      location: data.location || null,
      cost_center: data.costCenter || null,
      purchase_date: data.purchaseDate || null,
      warranty_expiration: data.warrantyExpiration || null,

      // Additional Metadata
      notes: data.notes || null,
      tags: toJsonString(data.tags),
      status: data.status || null,
      control_notes: toJsonString(data.controlNotes),

      // Visual Configuration
      label: data.label || null,
      label_fields: toJsonString(data.labelFields),
      device_image_size: data.deviceImageSize || null,
    };
  }

  /**
   * Clean up orphaned devices
   * @private
   * @param {number} projectId
   * @param {string[]} nodeIds
   */
  cleanupOrphanedDevices(projectId, nodeIds) {
    try {
      if (nodeIds.length === 0) {
        // Delete all devices for this project
        this.db.prepare('DELETE FROM devices WHERE project_id = ?').run(projectId);
      } else {
        // Delete devices not in the current nodeIds list
        const placeholders = nodeIds.map(() => '?').join(',');
        this.db.prepare(`
          DELETE FROM devices
          WHERE project_id = ? AND id NOT IN (${placeholders})
        `).run(projectId, ...nodeIds);
      }
    } catch (error) {
      console.error('[DeviceRepository] Error cleaning up orphaned devices:', error);
    }
  }

  // ==========================================================================
  // Enrichment Operations
  // ==========================================================================

  /**
   * Enrich diagram nodes with device metadata from the devices table
   * @param {number} projectId
   * @param {Object[]} nodes
   * @returns {Object[]}
   */
  enrichNodesWithMetadata(projectId, nodes) {
    try {
      // Get all devices for this project
      const devicesStmt = this.db.prepare('SELECT * FROM devices WHERE project_id = ?');
      const devices = devicesStmt.all(projectId);

      if (devices.length === 0) {
        return nodes;
      }

      // Create a map of device_id -> device record for fast lookup
      const devicesMap = new Map();
      devices.forEach(device => {
        devicesMap.set(device.id, device);
      });

      // Enrich each device node with metadata from devices table
      return nodes.map(node => {
        // Only enrich device nodes (not boundaries)
        if (node.type === 'boundary' || !node.data) {
          return node;
        }

        const deviceRecord = devicesMap.get(node.id);
        if (!deviceRecord) {
          return node;
        }

        // Merge device metadata from table into node.data
        const enrichedData = this.mergeDeviceDataIntoNode(node.data, deviceRecord);

        return {
          ...node,
          data: enrichedData,
        };
      });
    } catch (error) {
      console.error('[DeviceRepository] Error enriching nodes:', error);
      return nodes;
    }
  }

  /**
   * Merge device record into node data
   * @private
   * @param {Object} nodeData
   * @param {Object} deviceRecord
   * @returns {Object}
   */
  mergeDeviceDataIntoNode(nodeData, deviceRecord) {
    const parseJsonField = (val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    };

    const intToBool = (val) => val === 1;

    return {
      ...nodeData,
      // Basic Info
      name: deviceRecord.name || nodeData.name,
      deviceType: deviceRecord.device_type || nodeData.deviceType,
      deviceSubtype: deviceRecord.device_subtype || nodeData.deviceSubtype,
      iconPath: deviceRecord.icon_path || nodeData.iconPath,

      // Network Info
      ipAddress: deviceRecord.ip_address || nodeData.ipAddress,
      macAddress: deviceRecord.mac_address || nodeData.macAddress,
      subnetMask: deviceRecord.subnet_mask || nodeData.subnetMask,
      defaultGateway: deviceRecord.default_gateway || nodeData.defaultGateway,
      hostname: deviceRecord.hostname || nodeData.hostname,
      dnsServers: deviceRecord.dns_servers || nodeData.dnsServers,
      vlanId: deviceRecord.vlan_id || nodeData.vlanId,
      ports: deviceRecord.ports || nodeData.ports,

      // Hardware Info
      manufacturer: deviceRecord.manufacturer || nodeData.manufacturer,
      model: deviceRecord.model || nodeData.model,
      serialNumber: deviceRecord.serial_number || nodeData.serialNumber,
      firmwareVersion: deviceRecord.firmware_version || nodeData.firmwareVersion,
      operatingSystem: deviceRecord.operating_system || nodeData.operatingSystem,
      osVersion: deviceRecord.os_version || nodeData.osVersion,
      software: deviceRecord.software || nodeData.software,
      cpuModel: deviceRecord.cpu_model || nodeData.cpuModel,
      memorySize: deviceRecord.memory_size || nodeData.memorySize,
      storageSize: deviceRecord.storage_size || nodeData.storageSize,

      // Security Classification
      securityZone: deviceRecord.security_zone || nodeData.securityZone,
      assetValue: deviceRecord.asset_value || nodeData.assetValue,
      missionCritical: deviceRecord.mission_critical !== undefined
        ? intToBool(deviceRecord.mission_critical)
        : nodeData.missionCritical,
      dataClassification: deviceRecord.data_classification || nodeData.dataClassification,

      // Security Posture
      multifactorAuth: deviceRecord.multifactor_auth !== undefined
        ? intToBool(deviceRecord.multifactor_auth)
        : nodeData.multifactorAuth,
      encryptionAtRest: deviceRecord.encryption_at_rest !== undefined
        ? intToBool(deviceRecord.encryption_at_rest)
        : nodeData.encryptionAtRest,
      encryptionInTransit: deviceRecord.encryption_in_transit !== undefined
        ? intToBool(deviceRecord.encryption_in_transit)
        : nodeData.encryptionInTransit,
      encryptionStatus: deviceRecord.encryption_status || nodeData.encryptionStatus,
      backupsConfigured: deviceRecord.backups_configured !== undefined
        ? intToBool(deviceRecord.backups_configured)
        : nodeData.backupsConfigured,
      monitoringEnabled: deviceRecord.monitoring_enabled !== undefined
        ? intToBool(deviceRecord.monitoring_enabled)
        : nodeData.monitoringEnabled,
      vulnerabilityManagement: deviceRecord.vulnerability_management || nodeData.vulnerabilityManagement,
      riskLevel: deviceRecord.risk_level || nodeData.riskLevel,
      criticality: deviceRecord.criticality || nodeData.criticality,
      firewallEnabled: deviceRecord.firewall_enabled !== undefined
        ? intToBool(deviceRecord.firewall_enabled)
        : nodeData.firewallEnabled,
      antivirusEnabled: deviceRecord.antivirus_enabled !== undefined
        ? intToBool(deviceRecord.antivirus_enabled)
        : nodeData.antivirusEnabled,
      patchLevel: deviceRecord.patch_level || nodeData.patchLevel,
      lastPatchDate: deviceRecord.last_patch_date || nodeData.lastPatchDate,

      // Compliance
      applicableControls: parseJsonField(deviceRecord.applicable_controls) || nodeData.applicableControls,
      lastVulnScan: deviceRecord.last_vuln_scan || nodeData.lastVulnScan,
      complianceStatus: deviceRecord.compliance_status || nodeData.complianceStatus,
      assignedControls: parseJsonField(deviceRecord.assigned_controls) || nodeData.assignedControls,

      // Ownership
      systemOwner: deviceRecord.system_owner || nodeData.systemOwner,
      owner: deviceRecord.owner || nodeData.owner,
      department: deviceRecord.department || nodeData.department,
      contactEmail: deviceRecord.contact_email || nodeData.contactEmail,
      location: deviceRecord.location || nodeData.location,
      costCenter: deviceRecord.cost_center || nodeData.costCenter,
      purchaseDate: deviceRecord.purchase_date || nodeData.purchaseDate,
      warrantyExpiration: deviceRecord.warranty_expiration || nodeData.warrantyExpiration,

      // Additional Metadata
      notes: deviceRecord.notes || nodeData.notes,
      tags: parseJsonField(deviceRecord.tags) || nodeData.tags,
      status: deviceRecord.status || nodeData.status,
      controlNotes: parseJsonField(deviceRecord.control_notes) || nodeData.controlNotes,

      // Visual Configuration
      label: deviceRecord.label || nodeData.label,
      labelFields: parseJsonField(deviceRecord.label_fields) || nodeData.labelFields,
      deviceImageSize: deviceRecord.device_image_size || nodeData.deviceImageSize,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Parse a device record from database format to API format
   * @private
   * @param {Object} device
   * @returns {Object}
   */
  parseDeviceRecord(device) {
    const parseJsonField = (val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    };

    return {
      ...device,
      applicableControls: parseJsonField(device.applicable_controls),
      assignedControls: parseJsonField(device.assigned_controls),
      tags: parseJsonField(device.tags),
      controlNotes: parseJsonField(device.control_notes),
      labelFields: parseJsonField(device.label_fields),
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
   * Get device count for a project
   * @param {number} projectId
   * @returns {number}
   */
  getDeviceCount(projectId) {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM devices WHERE project_id = ?');
      const result = stmt.get(projectId);
      return result ? result.count : 0;
    } catch (error) {
      console.error('[DeviceRepository] Error getting device count:', error);
      return 0;
    }
  }

  /**
   * Get distinct values for a column (for filter options)
   * @param {number} projectId
   * @param {string} column
   * @returns {string[]}
   */
  getDistinctValues(projectId, column) {
    try {
      const safeColumn = this.sanitizeColumnName(column);
      const stmt = this.db.prepare(`
        SELECT DISTINCT ${safeColumn}
        FROM devices
        WHERE project_id = ? AND ${safeColumn} IS NOT NULL AND ${safeColumn} != ''
        ORDER BY ${safeColumn}
      `);
      const results = stmt.all(projectId);
      return results.map(r => r[column]);
    } catch (error) {
      console.error('[DeviceRepository] Error getting distinct values:', error);
      return [];
    }
  }

  /**
   * Delete all devices for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  deleteByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('DELETE FROM devices WHERE project_id = ?');
      const result = stmt.run(projectId);
      return { success: true, data: result.changes };
    } catch (error) {
      console.error('[DeviceRepository] Error deleting devices:', error);
      return { success: false, error: error.message };
    }
  }
}

export default DeviceRepository;
