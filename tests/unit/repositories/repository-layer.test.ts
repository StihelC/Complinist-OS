/**
 * Repository Layer Unit Tests
 *
 * Tests the repository pattern implementation to verify:
 * - Repository instances are created correctly
 * - CRUD operations work through the repository layer
 * - Query building functions work correctly
 * - Error handling is appropriate
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Import repositories
import { BaseRepository } from '../../../electron/database/repositories/BaseRepository.js';
import { ProjectRepository } from '../../../electron/database/repositories/ProjectRepository.js';
import { DiagramRepository } from '../../../electron/database/repositories/DiagramRepository.js';
import { DeviceRepository } from '../../../electron/database/repositories/DeviceRepository.js';
import { ControlNarrativeRepository } from '../../../electron/database/repositories/ControlNarrativeRepository.js';
import { SSPMetadataRepository } from '../../../electron/database/repositories/SSPMetadataRepository.js';
import { getRepositories, clearRepositoryCache } from '../../../electron/database/repositories/index.js';

describe('Repository Layer Tests', () => {
  let db: any;
  let testDbPath: string;

  beforeAll(() => {
    // Create a temporary test database
    testDbPath = path.join(os.tmpdir(), `complinist-test-${Date.now()}.db`);
    db = new Database(testDbPath);

    // Create necessary tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        baseline TEXT DEFAULT 'MODERATE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS diagrams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        nodes TEXT DEFAULT '[]',
        edges TEXT DEFAULT '[]',
        viewport TEXT,
        compliance_data TEXT,
        report_metadata TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        name TEXT,
        device_type TEXT,
        device_subtype TEXT,
        icon_path TEXT,
        ip_address TEXT,
        mac_address TEXT,
        subnet_mask TEXT,
        default_gateway TEXT,
        hostname TEXT,
        dns_servers TEXT,
        vlan_id TEXT,
        ports TEXT,
        manufacturer TEXT,
        model TEXT,
        serial_number TEXT,
        firmware_version TEXT,
        operating_system TEXT,
        os_version TEXT,
        software TEXT,
        cpu_model TEXT,
        memory_size TEXT,
        storage_size TEXT,
        security_zone TEXT,
        asset_value TEXT,
        mission_critical INTEGER DEFAULT 0,
        data_classification TEXT,
        multifactor_auth INTEGER DEFAULT 0,
        encryption_at_rest INTEGER DEFAULT 0,
        encryption_in_transit INTEGER DEFAULT 0,
        encryption_status TEXT,
        backups_configured INTEGER DEFAULT 0,
        monitoring_enabled INTEGER DEFAULT 0,
        vulnerability_management TEXT,
        risk_level TEXT,
        criticality TEXT,
        firewall_enabled INTEGER DEFAULT 0,
        antivirus_enabled INTEGER DEFAULT 0,
        patch_level TEXT,
        last_patch_date TEXT,
        applicable_controls TEXT,
        last_vuln_scan TEXT,
        compliance_status TEXT,
        assigned_controls TEXT,
        system_owner TEXT,
        owner TEXT,
        department TEXT,
        contact_email TEXT,
        location TEXT,
        cost_center TEXT,
        purchase_date TEXT,
        warranty_expiration TEXT,
        notes TEXT,
        tags TEXT,
        status TEXT,
        control_notes TEXT,
        label TEXT,
        label_fields TEXT,
        device_image_size TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS control_narratives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        control_id TEXT NOT NULL,
        narrative TEXT,
        system_implementation TEXT,
        implementation_status TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, control_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ssp_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        organization_name TEXT,
        prepared_by TEXT,
        system_description TEXT,
        system_purpose TEXT,
        deployment_model TEXT,
        service_model TEXT,
        information_type_title TEXT,
        information_type_description TEXT,
        confidentiality_impact TEXT DEFAULT 'moderate',
        integrity_impact TEXT DEFAULT 'moderate',
        availability_impact TEXT DEFAULT 'moderate',
        authorization_boundary_description TEXT,
        system_status TEXT DEFAULT 'operational',
        system_owner TEXT,
        system_owner_email TEXT,
        authorizing_official TEXT,
        authorizing_official_email TEXT,
        security_contact TEXT,
        security_contact_email TEXT,
        physical_location TEXT,
        data_types_processed TEXT,
        users_description TEXT,
        unedited_controls_mode TEXT DEFAULT 'placeholder',
        on_premises_details TEXT,
        cloud_provider TEXT,
        custom_sections TEXT DEFAULT '[]',
        selected_control_ids TEXT DEFAULT '[]',
        topology_screenshot TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    clearRepositoryCache();
  });

  beforeEach(() => {
    // Clean up tables before each test
    db.exec('DELETE FROM ssp_metadata');
    db.exec('DELETE FROM control_narratives');
    db.exec('DELETE FROM devices');
    db.exec('DELETE FROM diagrams');
    db.exec('DELETE FROM projects');
  });

  describe('Repository Factory', () => {
    it('should create repository instances', () => {
      const repos = getRepositories(db);
      expect(repos.projects).toBeInstanceOf(ProjectRepository);
      expect(repos.diagrams).toBeInstanceOf(DiagramRepository);
      expect(repos.devices).toBeInstanceOf(DeviceRepository);
      expect(repos.controlNarratives).toBeInstanceOf(ControlNarrativeRepository);
      expect(repos.sspMetadata).toBeInstanceOf(SSPMetadataRepository);
    });

    it('should cache repository instances', () => {
      const repos1 = getRepositories(db);
      const repos2 = getRepositories(db);
      expect(repos1.projects).toBe(repos2.projects);
    });

    it('should throw error if database is null', () => {
      clearRepositoryCache();
      expect(() => getRepositories(null as any)).toThrow('Database instance is required');
    });
  });

  describe('ProjectRepository', () => {
    let projectRepo: ProjectRepository;

    beforeEach(() => {
      projectRepo = new ProjectRepository(db);
    });

    it('should create a project', () => {
      const result = projectRepo.createProject({ name: 'Test Project', baseline: 'HIGH' });
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test Project');
      expect(result.data?.baseline).toBe('HIGH');
      expect(result.data?.id).toBeDefined();
    });

    it('should list projects', () => {
      projectRepo.createProject({ name: 'Project 1' });
      projectRepo.createProject({ name: 'Project 2' });

      const result = projectRepo.listProjects();
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });

    it('should get project by ID', () => {
      const created = projectRepo.createProject({ name: 'Test Project' });
      const result = projectRepo.getProject(created.data?.id);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Test Project');
    });

    it('should update project name', () => {
      const created = projectRepo.createProject({ name: 'Original Name' });
      const result = projectRepo.updateProjectName(created.data?.id, 'Updated Name');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Name');
    });

    it('should update project baseline', () => {
      const created = projectRepo.createProject({ name: 'Test', baseline: 'LOW' });
      const result = projectRepo.updateProjectBaseline(created.data?.id, 'HIGH');

      expect(result.success).toBe(true);
      expect(result.data?.baseline).toBe('HIGH');
    });

    it('should delete project', () => {
      const created = projectRepo.createProject({ name: 'To Delete' });
      const deleteResult = projectRepo.deleteProject(created.data?.id);

      expect(deleteResult.success).toBe(true);
      expect(projectRepo.projectExists(created.data?.id)).toBe(false);
    });

    it('should search projects', () => {
      projectRepo.createProject({ name: 'Alpha Project' });
      projectRepo.createProject({ name: 'Beta Project' });
      projectRepo.createProject({ name: 'Gamma System' });

      const result = projectRepo.searchProjects('Project');
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });

    it('should return validation error for empty name', () => {
      const result = projectRepo.createProject({ name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('DiagramRepository', () => {
    let diagramRepo: DiagramRepository;
    let projectRepo: ProjectRepository;
    let testProjectId: number;

    beforeEach(() => {
      diagramRepo = new DiagramRepository(db);
      projectRepo = new ProjectRepository(db);
      const project = projectRepo.createProject({ name: 'Test Project' });
      testProjectId = project.data?.id;
    });

    it('should save a new diagram', () => {
      const nodes = [{ id: 'node1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Server' } }];
      const edges = [{ id: 'edge1', source: 'node1', target: 'node2' }];
      const viewport = { x: 0, y: 0, zoom: 1 };

      const result = diagramRepo.saveDiagram(testProjectId, nodes, edges, viewport);
      expect(result.success).toBe(true);
    });

    it('should load a diagram', () => {
      const nodes = [{ id: 'node1', type: 'device', position: { x: 100, y: 200 }, data: { name: 'Router' } }];
      const edges: any[] = [];

      diagramRepo.saveDiagram(testProjectId, nodes, edges, null);
      const result = diagramRepo.loadDiagram(testProjectId);

      expect(result.success).toBe(true);
      expect(result.data?.nodes.length).toBe(1);
      expect(result.data?.nodes[0].data.name).toBe('Router');
    });

    it('should return empty arrays for non-existent diagram', () => {
      const result = diagramRepo.loadDiagram(99999);
      expect(result.success).toBe(true);
      expect(result.data?.nodes).toEqual([]);
      expect(result.data?.edges).toEqual([]);
    });

    it('should apply delta changes', () => {
      // Save initial diagram
      const initialNodes = [
        { id: 'node1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Node 1' } }
      ];
      diagramRepo.saveDiagram(testProjectId, initialNodes, [], null);

      // Apply delta changes
      const nodeChanges = [
        { type: 'add', nodeId: 'node2', node: { id: 'node2', type: 'device', position: { x: 100, y: 0 }, data: { name: 'Node 2' } } },
        { type: 'update', nodeId: 'node1', node: { id: 'node1', type: 'device', position: { x: 0, y: 50 }, data: { name: 'Updated Node 1' } } }
      ];

      const deltaResult = diagramRepo.saveDiagramDelta(testProjectId, nodeChanges as any, [], 1);
      expect(deltaResult.success).toBe(true);
      expect(deltaResult.isDelta).toBe(true);

      // Verify changes
      const loaded = diagramRepo.loadDiagram(testProjectId);
      expect(loaded.data?.nodes.length).toBe(2);
    });

    it('should update viewport', () => {
      diagramRepo.saveDiagram(testProjectId, [], [], { x: 0, y: 0, zoom: 1 });

      const newViewport = { x: 100, y: 200, zoom: 1.5 };
      diagramRepo.updateViewport(testProjectId, newViewport);

      const loaded = diagramRepo.loadDiagram(testProjectId);
      expect(loaded.data?.viewport).toEqual(newViewport);
    });
  });

  describe('DeviceRepository', () => {
    let deviceRepo: DeviceRepository;
    let projectRepo: ProjectRepository;
    let diagramRepo: DiagramRepository;
    let testProjectId: number;

    beforeEach(() => {
      deviceRepo = new DeviceRepository(db);
      projectRepo = new ProjectRepository(db);
      diagramRepo = new DiagramRepository(db);
      const project = projectRepo.createProject({ name: 'Test Project' });
      testProjectId = project.data?.id;
    });

    it('should sync devices from nodes', () => {
      const nodes = [
        { id: 'device1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Server', deviceType: 'server', ipAddress: '192.168.1.1' } },
        { id: 'device2', type: 'device', position: { x: 100, y: 0 }, data: { name: 'Router', deviceType: 'router', ipAddress: '192.168.1.254' } }
      ];

      const result = deviceRepo.syncDevicesFromNodes(testProjectId, nodes);
      expect(result.success).toBe(true);
      expect(result.data?.synced).toBe(2);
    });

    it('should query devices with filters', () => {
      // Sync some devices first
      const nodes = [
        { id: 'device1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Server', deviceType: 'server' } },
        { id: 'device2', type: 'device', position: { x: 100, y: 0 }, data: { name: 'Router', deviceType: 'router' } }
      ];
      deviceRepo.syncDevicesFromNodes(testProjectId, nodes);

      const result = deviceRepo.queryDevices(testProjectId, { deviceType: 'server' });
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].name).toBe('Server');
    });

    it('should search devices', () => {
      const nodes = [
        { id: 'device1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Web Server', deviceType: 'server' } },
        { id: 'device2', type: 'device', position: { x: 100, y: 0 }, data: { name: 'Database', deviceType: 'server' } }
      ];
      deviceRepo.syncDevicesFromNodes(testProjectId, nodes);

      const result = deviceRepo.searchDevices(testProjectId, 'Web');
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
    });

    it('should get device count', () => {
      const nodes = [
        { id: 'device1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Device 1' } },
        { id: 'device2', type: 'device', position: { x: 100, y: 0 }, data: { name: 'Device 2' } },
        { id: 'device3', type: 'device', position: { x: 200, y: 0 }, data: { name: 'Device 3' } }
      ];
      deviceRepo.syncDevicesFromNodes(testProjectId, nodes);

      const count = deviceRepo.getDeviceCount(testProjectId);
      expect(count).toBe(3);
    });

    it('should clean up orphaned devices', () => {
      // Sync initial devices
      const initialNodes = [
        { id: 'device1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Device 1' } },
        { id: 'device2', type: 'device', position: { x: 100, y: 0 }, data: { name: 'Device 2' } }
      ];
      deviceRepo.syncDevicesFromNodes(testProjectId, initialNodes);
      expect(deviceRepo.getDeviceCount(testProjectId)).toBe(2);

      // Sync with fewer devices (device2 removed)
      const updatedNodes = [
        { id: 'device1', type: 'device', position: { x: 0, y: 0 }, data: { name: 'Device 1' } }
      ];
      deviceRepo.syncDevicesFromNodes(testProjectId, updatedNodes);
      expect(deviceRepo.getDeviceCount(testProjectId)).toBe(1);
    });
  });

  describe('ControlNarrativeRepository', () => {
    let narrativeRepo: ControlNarrativeRepository;
    let projectRepo: ProjectRepository;
    let testProjectId: number;

    beforeEach(() => {
      narrativeRepo = new ControlNarrativeRepository(db);
      projectRepo = new ProjectRepository(db);
      const project = projectRepo.createProject({ name: 'Test Project' });
      testProjectId = project.data?.id;
    });

    it('should save narratives', () => {
      const narratives = [
        { control_id: 'AC-1', narrative: 'Access control policy', implementation_status: 'implemented' },
        { control_id: 'AC-2', narrative: 'Account management', implementation_status: 'partial' }
      ];

      const result = narrativeRepo.saveNarratives(testProjectId, narratives);
      expect(result.success).toBe(true);
      expect(result.data?.saved).toBe(2);
    });

    it('should load narratives', () => {
      narrativeRepo.saveNarratives(testProjectId, [
        { control_id: 'AC-1', narrative: 'Test narrative' }
      ]);

      const result = narrativeRepo.loadNarratives(testProjectId);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].control_id).toBe('AC-1');
    });

    it('should get single narrative', () => {
      narrativeRepo.saveNarratives(testProjectId, [
        { control_id: 'AC-1', narrative: 'Specific narrative', implementation_status: 'implemented' }
      ]);

      const result = narrativeRepo.getNarrative(testProjectId, 'AC-1');
      expect(result.success).toBe(true);
      expect(result.data?.narrative).toBe('Specific narrative');
    });

    it('should reset narrative', () => {
      narrativeRepo.saveNarratives(testProjectId, [
        { control_id: 'AC-1', narrative: 'To be reset' }
      ]);

      const resetResult = narrativeRepo.resetNarrative(testProjectId, 'AC-1');
      expect(resetResult.success).toBe(true);

      const checkResult = narrativeRepo.getNarrative(testProjectId, 'AC-1');
      expect(checkResult.data).toBeNull();
    });

    it('should get status counts', () => {
      narrativeRepo.saveNarratives(testProjectId, [
        { control_id: 'AC-1', implementation_status: 'implemented' },
        { control_id: 'AC-2', implementation_status: 'implemented' },
        { control_id: 'AC-3', implementation_status: 'partial' },
        { control_id: 'AC-4', implementation_status: 'planned' }
      ]);

      const counts = narrativeRepo.getStatusCounts(testProjectId);
      expect(counts.total).toBe(4);
      expect(counts.implemented).toBe(2);
      expect(counts.partial).toBe(1);
      expect(counts.planned).toBe(1);
    });
  });

  describe('SSPMetadataRepository', () => {
    let sspRepo: SSPMetadataRepository;
    let projectRepo: ProjectRepository;
    let testProjectId: number;

    beforeEach(() => {
      sspRepo = new SSPMetadataRepository(db);
      projectRepo = new ProjectRepository(db);
      const project = projectRepo.createProject({ name: 'Test Project' });
      testProjectId = project.data?.id;
    });

    it('should save SSP metadata', () => {
      const metadata = {
        organization_name: 'Test Organization',
        system_description: 'A test system',
        confidentiality_impact: 'high',
        integrity_impact: 'moderate',
        availability_impact: 'low'
      };

      const result = sspRepo.saveMetadata(testProjectId, metadata);
      expect(result.success).toBe(true);
    });

    it('should get SSP metadata', () => {
      sspRepo.saveMetadata(testProjectId, {
        organization_name: 'Test Org',
        system_description: 'Test Description'
      });

      const result = sspRepo.getMetadata(testProjectId);
      expect(result.success).toBe(true);
      expect(result.data?.organization_name).toBe('Test Org');
    });

    it('should update SSP metadata', () => {
      sspRepo.saveMetadata(testProjectId, { organization_name: 'Original' });

      sspRepo.updateMetadata(testProjectId, { organization_name: 'Updated' });

      const result = sspRepo.getMetadata(testProjectId);
      expect(result.data?.organization_name).toBe('Updated');
    });

    it('should manage custom sections', () => {
      sspRepo.saveMetadata(testProjectId, { custom_sections: '[]' });

      const customSections = [
        { id: 'section1', title: 'Custom Section 1', content: 'Content 1' }
      ];
      sspRepo.saveCustomSections(testProjectId, customSections);

      const loaded = sspRepo.getCustomSections(testProjectId);
      expect(loaded.length).toBe(1);
      expect(loaded[0].title).toBe('Custom Section 1');
    });

    it('should manage selected control IDs', () => {
      sspRepo.saveMetadata(testProjectId, { selected_control_ids: '[]' });

      const controlIds = ['AC-1', 'AC-2', 'AC-3'];
      sspRepo.saveSelectedControlIds(testProjectId, controlIds);

      const loaded = sspRepo.getSelectedControlIds(testProjectId);
      expect(loaded).toEqual(controlIds);
    });

    it('should get impact levels', () => {
      sspRepo.saveMetadata(testProjectId, {
        confidentiality_impact: 'high',
        integrity_impact: 'moderate',
        availability_impact: 'low'
      });

      const levels = sspRepo.getImpactLevels(testProjectId);
      expect(levels.confidentiality_impact).toBe('high');
      expect(levels.integrity_impact).toBe('moderate');
      expect(levels.availability_impact).toBe('low');
    });
  });

  describe('BaseRepository', () => {
    it('should throw error for invalid column names', () => {
      const baseRepo = new BaseRepository(db, 'projects');
      expect(() => baseRepo.sanitizeColumnName('invalid; DROP TABLE')).toThrow('Invalid column name');
    });

    it('should build select queries with filters', () => {
      const baseRepo = new BaseRepository(db, 'projects');
      const { sql, params } = baseRepo.buildSelectQuery(['*'], {
        filters: { name: 'test', baseline: 'HIGH' }
      });

      expect(sql).toContain('SELECT');
      expect(sql).toContain('WHERE');
      expect(params).toContain('test');
      expect(params).toContain('HIGH');
    });

    it('should handle operator filters', () => {
      const baseRepo = new BaseRepository(db, 'projects');
      const { sql, params } = baseRepo.buildSelectQuery(['*'], {
        filters: {
          id: { $gt: 5 },
          name: { $like: '%test%' }
        }
      });

      expect(sql).toContain('>');
      expect(sql).toContain('LIKE');
      expect(params).toContain(5);
      expect(params).toContain('%test%');
    });

    it('should handle IN clause with arrays', () => {
      const baseRepo = new BaseRepository(db, 'projects');
      const { sql, params } = baseRepo.buildSelectQuery(['*'], {
        filters: { id: [1, 2, 3] }
      });

      expect(sql).toContain('IN');
      expect(params).toContain(1);
      expect(params).toContain(2);
      expect(params).toContain(3);
    });
  });
});
