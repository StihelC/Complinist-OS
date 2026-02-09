/**
 * IPC Database Channel Tests (db:*)
 *
 * Tests all database-related IPC channels for:
 * - Type safety
 * - Error handling
 * - Data serialization
 * - State management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockElectronAPI,
  resetMockState,
  getMockCalls,
  getCallsForChannel,
  setMockConfig,
  seedMockDevices,
  mockState
} from '../../fixtures/ipc/__mocks__/electronAPI.mock';
import type { ElectronAPI } from '@/window.d';

describe('Database IPC Channels (db:*)', () => {
  let mockAPI: ElectronAPI;

  beforeEach(() => {
    resetMockState();
    setMockConfig({});
    mockAPI = createMockElectronAPI();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('db:create-project', () => {
    it('should create a project with valid data', async () => {
      const result = await mockAPI.createProject({ name: 'Test Project', baseline: 'MODERATE' });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Project');
      expect(result.baseline).toBe('MODERATE');
      expect(getCallsForChannel('db:create-project')).toHaveLength(1);
    });

    it('should create project with HIGH baseline', async () => {
      const result = await mockAPI.createProject({ name: 'High Security', baseline: 'HIGH' });

      expect(result.baseline).toBe('HIGH');
    });

    it('should create project with LOW baseline', async () => {
      const result = await mockAPI.createProject({ name: 'Low Security', baseline: 'LOW' });

      expect(result.baseline).toBe('LOW');
    });

    it('should handle special characters in project name', async () => {
      const specialName = "Test & Special <Characters> \"Quoted\"";
      const result = await mockAPI.createProject({ name: specialName, baseline: 'MODERATE' });

      expect(result.name).toBe(specialName);
    });

    it('should handle unicode in project name', async () => {
      const unicodeName = "Proyecto de Prueba 测试项目 テスト";
      const result = await mockAPI.createProject({ name: unicodeName, baseline: 'MODERATE' });

      expect(result.name).toBe(unicodeName);
    });

    it('should assign incremental IDs to projects', async () => {
      const result1 = await mockAPI.createProject({ name: 'Project 1', baseline: 'LOW' });
      const result2 = await mockAPI.createProject({ name: 'Project 2', baseline: 'MODERATE' });
      const result3 = await mockAPI.createProject({ name: 'Project 3', baseline: 'HIGH' });

      expect(result1.id).toBeLessThan(result2.id);
      expect(result2.id).toBeLessThan(result3.id);
    });

    it('should handle errors during creation', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Database error' });

      await expect(mockAPI.createProject({ name: 'Test', baseline: 'MODERATE' }))
        .rejects.toThrow('Database error');
    });
  });

  describe('db:list-projects', () => {
    it('should return empty array when no projects exist', async () => {
      const result = await mockAPI.listProjects();

      expect(result).toEqual([]);
    });

    it('should return all created projects', async () => {
      await mockAPI.createProject({ name: 'Project 1', baseline: 'LOW' });
      await mockAPI.createProject({ name: 'Project 2', baseline: 'MODERATE' });
      await mockAPI.createProject({ name: 'Project 3', baseline: 'HIGH' });

      const result = await mockAPI.listProjects();

      expect(result).toHaveLength(3);
      expect(result.map(p => p.name)).toContain('Project 1');
      expect(result.map(p => p.name)).toContain('Project 2');
      expect(result.map(p => p.name)).toContain('Project 3');
    });

    it('should record IPC call correctly', async () => {
      await mockAPI.listProjects();

      expect(getCallsForChannel('db:list-projects')).toHaveLength(1);
    });
  });

  describe('db:save-diagram', () => {
    it('should save diagram with nodes and edges', async () => {
      const projectId = 1;
      const nodes = [
        { id: 'node-1', type: 'device', position: { x: 0, y: 0 }, data: { label: 'Server' } },
        { id: 'node-2', type: 'device', position: { x: 100, y: 100 }, data: { label: 'Router' } }
      ];
      const edges = [
        { id: 'edge-1', source: 'node-1', target: 'node-2' }
      ];
      const viewport = { x: 0, y: 0, zoom: 1 };

      const result = await mockAPI.saveDiagram({ projectId, nodes, edges, viewport });

      expect(result.success).toBe(true);
      expect(getCallsForChannel('db:save-diagram')).toHaveLength(1);
    });

    it('should save diagram with null viewport', async () => {
      const result = await mockAPI.saveDiagram({
        projectId: 1,
        nodes: [],
        edges: [],
        viewport: null
      });

      expect(result.success).toBe(true);
    });

    it('should save complex node data', async () => {
      const complexNode = {
        id: 'complex-node',
        type: 'device',
        position: { x: 50, y: 75 },
        data: {
          label: 'Complex Server',
          metadata: {
            ip: '192.168.1.1',
            ports: [22, 80, 443],
            tags: ['production', 'critical'],
            nested: {
              deep: {
                value: true
              }
            }
          }
        }
      };

      const result = await mockAPI.saveDiagram({
        projectId: 1,
        nodes: [complexNode],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1.5 }
      });

      expect(result.success).toBe(true);
    });

    it('should handle errors during save', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Write error' });

      await expect(mockAPI.saveDiagram({ projectId: 1, nodes: [], edges: [], viewport: null }))
        .rejects.toThrow('Write error');
    });
  });

  describe('db:save-diagram-delta', () => {
    beforeEach(async () => {
      // Setup: Save initial diagram
      await mockAPI.saveDiagram({
        projectId: 1,
        nodes: [{ id: 'node-1', type: 'device', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      });
    });

    it('should apply add changes', async () => {
      const result = await mockAPI.saveDiagramDelta({
        projectId: 1,
        nodeChanges: [
          { type: 'add', nodeId: 'node-2', node: { id: 'node-2', type: 'device', position: { x: 100, y: 0 }, data: {} } }
        ],
        edgeChanges: [],
        sequence: 1
      });

      expect(result.success).toBe(true);
      expect(result.isDelta).toBe(true);
      expect(result.appliedChanges?.nodes).toBe(1);
    });

    it('should apply update changes', async () => {
      const result = await mockAPI.saveDiagramDelta({
        projectId: 1,
        nodeChanges: [
          { type: 'update', nodeId: 'node-1', node: { id: 'node-1', type: 'device', position: { x: 50, y: 50 }, data: { updated: true } } }
        ],
        edgeChanges: [],
        sequence: 1
      });

      expect(result.success).toBe(true);
      expect(result.isDelta).toBe(true);
    });

    it('should apply remove changes', async () => {
      const result = await mockAPI.saveDiagramDelta({
        projectId: 1,
        nodeChanges: [
          { type: 'remove', nodeId: 'node-1' }
        ],
        edgeChanges: [],
        sequence: 1
      });

      expect(result.success).toBe(true);
    });

    it('should return requiresFullSave for non-existent diagram', async () => {
      const result = await mockAPI.saveDiagramDelta({
        projectId: 999, // Non-existent
        nodeChanges: [],
        edgeChanges: [],
        sequence: 1
      });

      expect(result.success).toBe(false);
      expect(result.requiresFullSave).toBe(true);
    });

    it('should apply mixed changes correctly', async () => {
      const result = await mockAPI.saveDiagramDelta({
        projectId: 1,
        nodeChanges: [
          { type: 'add', nodeId: 'node-2', node: { id: 'node-2' } },
          { type: 'update', nodeId: 'node-1', node: { id: 'node-1', position: { x: 10, y: 10 } } }
        ],
        edgeChanges: [
          { type: 'add', edgeId: 'edge-1', edge: { id: 'edge-1', source: 'node-1', target: 'node-2' } }
        ],
        sequence: 1
      });

      expect(result.success).toBe(true);
      expect(result.appliedChanges?.nodes).toBe(2);
      expect(result.appliedChanges?.edges).toBe(1);
    });

    it('should include serverSequence in response', async () => {
      const result = await mockAPI.saveDiagramDelta({
        projectId: 1,
        nodeChanges: [],
        edgeChanges: [],
        sequence: 42
      });

      expect(result.serverSequence).toBe(42);
    });
  });

  describe('db:load-diagram', () => {
    it('should return empty diagram for non-existent project', async () => {
      const result = await mockAPI.loadDiagram(999);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should return saved diagram', async () => {
      const nodes = [{ id: 'node-1', type: 'device', position: { x: 0, y: 0 }, data: {} }];
      const edges = [{ id: 'edge-1', source: 'node-1', target: 'node-2' }];
      const viewport = { x: 100, y: 200, zoom: 1.5 };

      await mockAPI.saveDiagram({ projectId: 1, nodes, edges, viewport });
      const result = await mockAPI.loadDiagram(1);

      expect(result.nodes).toEqual(nodes);
      expect(result.edges).toEqual(edges);
      expect(result.viewport).toEqual(viewport);
    });
  });

  describe('db:delete-project', () => {
    it('should delete existing project', async () => {
      await mockAPI.createProject({ name: 'To Delete', baseline: 'MODERATE' });

      const result = await mockAPI.deleteProject(1);

      expect(result.success).toBe(true);
    });

    it('should handle deleting non-existent project', async () => {
      const result = await mockAPI.deleteProject(999);

      expect(result.success).toBe(true); // Mock doesn't validate existence
    });
  });

  describe('db:control-narratives', () => {
    describe('db:load-control-narratives', () => {
      it('should return empty array for project without narratives', async () => {
        const result = await mockAPI.loadControlNarratives(1);

        expect(result).toEqual([]);
      });

      it('should return saved narratives', async () => {
        await mockAPI.saveControlNarratives({
          projectId: 1,
          narratives: [
            { control_id: 'AC-1', narrative: 'Access control narrative' },
            { control_id: 'AC-2', narrative: 'Account management narrative' }
          ]
        });

        const result = await mockAPI.loadControlNarratives(1);

        expect(result).toHaveLength(2);
      });
    });

    describe('db:save-control-narratives', () => {
      it('should save multiple narratives', async () => {
        const result = await mockAPI.saveControlNarratives({
          projectId: 1,
          narratives: [
            { control_id: 'AC-1', narrative: 'Test 1' },
            { control_id: 'AC-2', narrative: 'Test 2', implementation_status: 'implemented' }
          ]
        });

        expect(result.success).toBe(true);
      });

      it('should handle empty narratives array', async () => {
        const result = await mockAPI.saveControlNarratives({
          projectId: 1,
          narratives: []
        });

        expect(result.success).toBe(true);
      });
    });

    describe('db:save-single-control-narrative', () => {
      it('should save individual narrative', async () => {
        const result = await mockAPI.saveSingleControlNarrative({
          projectId: 1,
          controlId: 'AC-1',
          systemImplementation: 'The organization implements access control...',
          implementationStatus: 'implemented'
        });

        expect(result.success).toBe(true);
      });
    });

    describe('db:reset-control-narrative', () => {
      it('should reset narrative', async () => {
        await mockAPI.saveSingleControlNarrative({
          projectId: 1,
          controlId: 'AC-1',
          systemImplementation: 'Test implementation'
        });

        const result = await mockAPI.resetControlNarrative({ projectId: 1, controlId: 'AC-1' });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('db:ssp-metadata', () => {
    describe('db:get-ssp-metadata', () => {
      it('should return null for project without metadata', async () => {
        const result = await mockAPI.getSSPMetadata(1);

        expect(result).toBeNull();
      });
    });

    describe('db:save-ssp-metadata', () => {
      it('should save SSP metadata', async () => {
        const metadata = {
          organization_name: 'Test Org',
          prepared_by: 'Test User',
          system_description: 'A test system',
          system_purpose: 'Testing',
          deployment_model: 'on-premises',
          confidentiality_impact: 'moderate',
          integrity_impact: 'moderate',
          availability_impact: 'moderate'
        };

        const result = await mockAPI.saveSSPMetadata({ projectId: 1, metadata });

        expect(result.success).toBe(true);
      });

      it('should allow retrieval of saved metadata', async () => {
        const metadata = { organization_name: 'Saved Org' };
        await mockAPI.saveSSPMetadata({ projectId: 1, metadata });

        const result = await mockAPI.getSSPMetadata(1);

        expect(result).toEqual(metadata);
      });
    });
  });

  describe('db:update-project-baseline', () => {
    it('should update baseline', async () => {
      await mockAPI.createProject({ name: 'Test', baseline: 'LOW' });

      const result = await mockAPI.updateProjectBaseline({ projectId: 1, baseline: 'HIGH' });

      expect(result.success).toBe(true);
      expect(result.baseline).toBe('HIGH');
    });
  });

  describe('Device Query Channels', () => {
    beforeEach(() => {
      seedMockDevices(1, 5);
    });

    describe('db:query-devices', () => {
      it('should return devices for project', async () => {
        const result = await mockAPI.queryDevices({ projectId: 1 });

        expect(result).toHaveLength(5);
      });

      it('should return empty array for project without devices', async () => {
        const result = await mockAPI.queryDevices({ projectId: 999 });

        expect(result).toEqual([]);
      });

      it('should accept optional filters', async () => {
        const result = await mockAPI.queryDevices({
          projectId: 1,
          filters: { deviceType: 'server' }
        });

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('db:get-device', () => {
      it('should return null for non-existent device', async () => {
        const result = await mockAPI.getDevice({ projectId: 1, deviceId: 'nonexistent' });

        expect(result).toBeNull();
      });

      it('should return device when exists', async () => {
        const result = await mockAPI.getDevice({ projectId: 1, deviceId: 'device-0' });

        expect(result).not.toBeNull();
        expect(result?.id).toBe('device-0');
      });
    });

    describe('db:search-devices', () => {
      it('should search devices by term', async () => {
        const result = await mockAPI.searchDevices({ projectId: 1, searchTerm: 'Device 0' });

        expect(result.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty search term', async () => {
        const result = await mockAPI.searchDevices({ projectId: 1, searchTerm: '' });

        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Type Safety', () => {
    it('should maintain type structure for project', async () => {
      const result = await mockAPI.createProject({ name: 'Type Test', baseline: 'MODERATE' });

      expect(typeof result.id).toBe('number');
      expect(typeof result.name).toBe('string');
      expect(typeof result.baseline).toBe('string');
    });

    it('should maintain type structure for diagram', async () => {
      await mockAPI.saveDiagram({
        projectId: 1,
        nodes: [{ id: 'n1', type: 'test', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      });

      const result = await mockAPI.loadDiagram(1);

      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
    });
  });

  describe('Async Delay Simulation', () => {
    it('should handle simulated network delay', async () => {
      setMockConfig({ delay: 50 });

      const start = Date.now();
      await mockAPI.listProjects();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });
});
