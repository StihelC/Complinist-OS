/**
 * Main Process DI Container Tests
 *
 * Tests for the Electron main process DI container.
 * These tests verify the container API works correctly without
 * actually starting Electron or connecting to real services.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';

// We need to mock the electron module before importing the container
import { vi } from 'vitest';

// Mock electron module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => `/mock/path/${name}`),
    isPackaged: false,
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

describe('Main Process Container Module', () => {
  describe('DIContainer Class (Main Process)', () => {
    // Use dynamic import to get fresh modules for each test
    let DIContainer: typeof import('../../../electron/di/container.js').DIContainer;
    let ServiceTokens: typeof import('../../../electron/di/container.js').ServiceTokens;
    let container: InstanceType<typeof DIContainer>;

    beforeEach(async () => {
      // Dynamically import to get fresh module
      const module = await import('../../../electron/di/container.js');
      DIContainer = module.DIContainer;
      ServiceTokens = module.ServiceTokens;
      container = new DIContainer();
    });

    afterEach(() => {
      container.clear();
    });

    it('should create a new container instance', () => {
      expect(container).toBeDefined();
      expect(typeof container.register).toBe('function');
      expect(typeof container.resolve).toBe('function');
    });

    it('should register and resolve a simple service', async () => {
      container.registerSingleton('test', () => ({ value: 42 }));

      const result = await container.resolve('test');

      expect(result).toEqual({ value: 42 });
    });

    it('should support the factory pattern with dependencies', async () => {
      // Register a base service
      container.registerSingleton('config', () => ({
        dbPath: '/test/path',
      }));

      // Register a service that depends on config
      container.registerSingleton(
        'database',
        (config: { dbPath: string }) => ({
          path: config.dbPath,
          connect: () => 'connected',
        }),
        ['config']
      );

      const db = await container.resolve<{ path: string; connect: () => string }>('database');

      expect(db.path).toBe('/test/path');
      expect(db.connect()).toBe('connected');
    });

    it('should provide standard service tokens', () => {
      expect(ServiceTokens.DATABASE).toBe('database');
      expect(ServiceTokens.AI_SERVICE).toBe('aiService');
      expect(ServiceTokens.CHUNKING_SERVICE).toBe('chunkingService');
      expect(ServiceTokens.FILE_SERVICE).toBe('fileService');
      expect(ServiceTokens.PROJECT_SERVICE).toBe('projectService');
      expect(ServiceTokens.DEVICE_SERVICE).toBe('deviceService');
      expect(ServiceTokens.CONTROL_SERVICE).toBe('controlService');
      expect(ServiceTokens.LICENSE_SERVICE).toBe('licenseService');
    });

    it('should enforce singleton behavior', async () => {
      let callCount = 0;
      container.registerSingleton('counter', () => {
        callCount++;
        return { count: callCount };
      });

      await container.resolve('counter');
      await container.resolve('counter');
      await container.resolve('counter');

      expect(callCount).toBe(1);
    });

    it('should create new instances for transient services', async () => {
      let callCount = 0;
      container.registerTransient('counter', () => {
        callCount++;
        return { count: callCount };
      });

      await container.resolve('counter');
      await container.resolve('counter');
      await container.resolve('counter');

      expect(callCount).toBe(3);
    });
  });

  describe('Service Tokens', () => {
    it('should have all required main process service tokens', async () => {
      const { ServiceTokens } = await import('../../../electron/di/container.js');

      // Core services
      expect(ServiceTokens.DATABASE).toBeDefined();
      expect(ServiceTokens.CONFIG).toBeDefined();

      // AI services
      expect(ServiceTokens.AI_SERVICE).toBeDefined();
      expect(ServiceTokens.EMBEDDING_SERVICE).toBeDefined();
      expect(ServiceTokens.CHROMA_SERVICE).toBeDefined();
      expect(ServiceTokens.CHUNKING_SERVICE).toBeDefined();

      // IPC services
      expect(ServiceTokens.IPC_MAIN).toBeDefined();

      // File system services
      expect(ServiceTokens.FILE_SERVICE).toBeDefined();
      expect(ServiceTokens.USER_DATA_SERVICE).toBeDefined();

      // Export services
      expect(ServiceTokens.EXPORT_SERVICE).toBeDefined();
      expect(ServiceTokens.PDF_SERVICE).toBeDefined();

      // Business logic services
      expect(ServiceTokens.PROJECT_SERVICE).toBeDefined();
      expect(ServiceTokens.DEVICE_SERVICE).toBeDefined();
      expect(ServiceTokens.CONTROL_SERVICE).toBeDefined();
      expect(ServiceTokens.LICENSE_SERVICE).toBeDefined();
      expect(ServiceTokens.TERRAFORM_SERVICE).toBeDefined();
    });
  });

  describe('Global Container Management', () => {
    it('should provide a global container', async () => {
      const { getMainContainer, resetMainContainer } = await import(
        '../../../electron/di/container.js'
      );

      // Reset to ensure clean state
      resetMainContainer();

      const container1 = getMainContainer();
      const container2 = getMainContainer();

      expect(container1).toBe(container2);
    });

    it('should reset the global container', async () => {
      const { getMainContainer, resetMainContainer } = await import(
        '../../../electron/di/container.js'
      );

      const original = getMainContainer();
      const reset = resetMainContainer();

      expect(reset).not.toBe(original);
    });
  });
});

describe('Mock Service Integration', () => {
  it('should allow injecting mock services', async () => {
    const { DIContainer, ServiceTokens } = await import('../../../electron/di/container.js');
    const container = new DIContainer();

    // Create mock services
    const mockDatabase = {
      getDatabase: () => ({ query: vi.fn() }),
      initialize: vi.fn(),
      close: vi.fn(),
    };

    const mockAIService = {
      initialize: vi.fn().mockResolvedValue({ success: true }),
      generateText: vi.fn().mockResolvedValue({ text: 'mock response' }),
      checkHealth: vi.fn().mockResolvedValue({ llm: true, embedding: true }),
    };

    // Register mocks
    container.registerInstance(ServiceTokens.DATABASE, mockDatabase);
    container.registerInstance(ServiceTokens.AI_SERVICE, mockAIService);

    // Resolve and use mocks
    const db = await container.resolve(ServiceTokens.DATABASE);
    const ai = await container.resolve(ServiceTokens.AI_SERVICE);

    expect(db.initialize).toBeDefined();
    expect(ai.generateText).toBeDefined();

    // Call mock methods
    await ai.initialize();
    expect(mockAIService.initialize).toHaveBeenCalled();
  });

  it('should support testing service dependencies with mocks', async () => {
    const { DIContainer, ServiceTokens } = await import('../../../electron/di/container.js');
    const container = new DIContainer();

    // Mock the database
    const mockDb = {
      getDatabase: () => ({
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { id: 1, name: 'Test Project', baseline: 'MODERATE' },
          ]),
          run: vi.fn(),
          get: vi.fn(),
        }),
      }),
    };

    container.registerInstance(ServiceTokens.DATABASE, mockDb);

    // Register a service that depends on the mock
    container.registerSingleton(
      ServiceTokens.PROJECT_SERVICE,
      (db: typeof mockDb) => ({
        getAllProjects: () => {
          const database = db.getDatabase();
          return database.prepare('SELECT * FROM projects').all();
        },
      }),
      [ServiceTokens.DATABASE]
    );

    // Resolve and test
    const projectService = await container.resolve<{
      getAllProjects: () => Array<{ id: number; name: string; baseline: string }>;
    }>(ServiceTokens.PROJECT_SERVICE);

    const projects = projectService.getAllProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Test Project');
  });
});
