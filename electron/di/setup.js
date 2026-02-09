/**
 * DI Container Setup for Main Process
 *
 * This module configures the DI container with all main process services.
 * It registers factories for each service with their dependencies,
 * enabling automatic dependency resolution and lazy instantiation.
 *
 * @module electron/di/setup
 */

import { ipcMain } from 'electron';
import { getMainContainer, ServiceTokens } from './container.js';

/**
 * Setup the main process DI container with all services
 * Call this during app initialization before creating windows
 *
 * @param {Object} options - Setup options
 * @param {Object} [options.overrides] - Service overrides for testing
 * @returns {Promise<import('./container.js').DIContainer>} - Configured container
 */
export async function setupMainContainer(options = {}) {
  const container = getMainContainer();
  const { overrides = {} } = options;

  console.log('[DI] Setting up main process container...');

  // Register core Electron services
  container.registerInstance(ServiceTokens.IPC_MAIN, ipcMain);

  // Register Database Service
  if (overrides[ServiceTokens.DATABASE]) {
    container.registerInstance(ServiceTokens.DATABASE, overrides[ServiceTokens.DATABASE]);
  } else {
    container.registerSingleton(ServiceTokens.DATABASE, async () => {
      const { initDatabase, getDatabase, syncDevicesToTable, enrichNodesWithDeviceMetadata } =
        await import('../database/index.js');

      // Initialize database on first access
      initDatabase();

      return {
        getDatabase,
        initialize: initDatabase,
        syncDevicesToTable,
        enrichNodesWithDeviceMetadata,
        close: () => {
          const db = getDatabase();
          if (db) db.close();
        },
      };
    });
  }

  // Register AI Service
  if (overrides[ServiceTokens.AI_SERVICE]) {
    container.registerInstance(ServiceTokens.AI_SERVICE, overrides[ServiceTokens.AI_SERVICE]);
  } else {
    container.registerSingleton(ServiceTokens.AI_SERVICE, async () => {
      const aiService = await import('../ai-service-manager.js');

      return {
        initialize: aiService.initializeAIServices,
        generateText: aiService.generateText,
        generateTextStream: aiService.generateTextStream,
        generateEmbedding: aiService.generateEmbedding,
        generateEmbeddings: aiService.generateEmbeddings,
        queryChromaDB: aiService.queryChromaDB,
        addToChromaDB: aiService.addToChromaDB,
        checkHealth: aiService.checkHealth,
        getCalibratedContextSize: aiService.getCalibratedContextSize,
        queryDualSource: aiService.queryDualSource,
        shutdown: aiService.shutdownAIServices,
      };
    });
  }

  // Register Chunking Service
  if (overrides[ServiceTokens.CHUNKING_SERVICE]) {
    container.registerInstance(ServiceTokens.CHUNKING_SERVICE, overrides[ServiceTokens.CHUNKING_SERVICE]);
  } else {
    container.registerSingleton(
      ServiceTokens.CHUNKING_SERVICE,
      async (aiService) => {
        const chunkingService = await import('../chunking-service.js');

        return {
          chunkDocument: chunkingService.chunkDocument,
          registerChunkingHandlers: chunkingService.registerChunkingHandlers,
          queryUserChromaDB: chunkingService.queryUserChromaDB,
          // Expose the AI service for internal use
          _aiService: aiService,
        };
      },
      [ServiceTokens.AI_SERVICE]
    );
  }

  // Register User Data Service
  if (overrides[ServiceTokens.USER_DATA_SERVICE]) {
    container.registerInstance(ServiceTokens.USER_DATA_SERVICE, overrides[ServiceTokens.USER_DATA_SERVICE]);
  } else {
    container.registerSingleton(ServiceTokens.USER_DATA_SERVICE, async () => {
      const { app } = await import('electron');
      const path = await import('path');
      const { getModelsRoot, getChromaRoot } = await import('../path-resolver.js');

      return {
        getUserDataPath: () => app.getPath('userData'),
        getModelsPath: () => getModelsRoot(),
        getChromaDbPath: () => getChromaRoot(),
        getConfigPath: (filename) => path.join(app.getPath('userData'), filename),
      };
    });
  }

  // Register File Service
  if (overrides[ServiceTokens.FILE_SERVICE]) {
    container.registerInstance(ServiceTokens.FILE_SERVICE, overrides[ServiceTokens.FILE_SERVICE]);
  } else {
    container.registerSingleton(ServiceTokens.FILE_SERVICE, async () => {
      const fs = await import('fs');
      const fsPromises = fs.promises;

      return {
        readFile: (path) => fsPromises.readFile(path, 'utf8'),
        readFileBuffer: (path) => fsPromises.readFile(path),
        writeFile: (path, data) => fsPromises.writeFile(path, data),
        exists: async (path) => {
          try {
            await fsPromises.access(path);
            return true;
          } catch {
            return false;
          }
        },
        mkdir: (path) => fsPromises.mkdir(path, { recursive: true }),
        remove: (path) => fsPromises.rm(path, { recursive: true, force: true }),
        readDir: (path) => fsPromises.readdir(path),
        stat: (path) => fsPromises.stat(path),
      };
    });
  }

  // Register Config Service
  if (overrides[ServiceTokens.CONFIG]) {
    container.registerInstance(ServiceTokens.CONFIG, overrides[ServiceTokens.CONFIG]);
  } else {
    container.registerSingleton(
      ServiceTokens.CONFIG,
      async (userDataService, fileService) => {
        const configPath = userDataService.getConfigPath('config.json');
        let config = {};

        // Try to load existing config
        try {
          if (await fileService.exists(configPath)) {
            const content = await fileService.readFile(configPath);
            config = JSON.parse(content);
          }
        } catch (error) {
          console.warn('[DI] Failed to load config:', error.message);
        }

        const save = async () => {
          try {
            await fileService.writeFile(configPath, JSON.stringify(config, null, 2));
          } catch (error) {
            console.error('[DI] Failed to save config:', error.message);
          }
        };

        return {
          get: (key) => config[key],
          set: (key, value) => {
            config[key] = value;
            save();
          },
          getAll: () => ({ ...config }),
          save,
        };
      },
      [ServiceTokens.USER_DATA_SERVICE, ServiceTokens.FILE_SERVICE]
    );
  }

  // Register Project Service
  if (overrides[ServiceTokens.PROJECT_SERVICE]) {
    container.registerInstance(ServiceTokens.PROJECT_SERVICE, overrides[ServiceTokens.PROJECT_SERVICE]);
  } else {
    container.registerSingleton(
      ServiceTokens.PROJECT_SERVICE,
      async (databaseService) => {
        return {
          createProject: (name, baseline = 'MODERATE') => {
            const db = databaseService.getDatabase();
            const stmt = db.prepare(
              'INSERT INTO projects (name, baseline) VALUES (?, ?)'
            );
            const result = stmt.run(name, baseline);
            return { id: result.lastInsertRowid, name, baseline };
          },

          getAllProjects: () => {
            const db = databaseService.getDatabase();
            return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
          },

          getProject: (id) => {
            const db = databaseService.getDatabase();
            return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
          },

          deleteProject: (id) => {
            const db = databaseService.getDatabase();
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
          },

          updateProjectBaseline: (id, baseline) => {
            const db = databaseService.getDatabase();
            db.prepare(
              'UPDATE projects SET baseline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(baseline, id);
          },
        };
      },
      [ServiceTokens.DATABASE]
    );
  }

  // Register Device Service
  if (overrides[ServiceTokens.DEVICE_SERVICE]) {
    container.registerInstance(ServiceTokens.DEVICE_SERVICE, overrides[ServiceTokens.DEVICE_SERVICE]);
  } else {
    container.registerSingleton(
      ServiceTokens.DEVICE_SERVICE,
      async (databaseService) => {
        return {
          queryDevices: (projectId, options = {}) => {
            const db = databaseService.getDatabase();
            const { limit = 100, offset = 0, filters = {} } = options;

            let query = 'SELECT * FROM devices WHERE project_id = ?';
            const params = [projectId];

            // Apply filters
            if (filters.deviceType) {
              query += ' AND device_type = ?';
              params.push(filters.deviceType);
            }
            if (filters.securityZone) {
              query += ' AND security_zone = ?';
              params.push(filters.securityZone);
            }

            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            return db.prepare(query).all(...params);
          },

          getDevice: (projectId, deviceId) => {
            const db = databaseService.getDatabase();
            return db
              .prepare('SELECT * FROM devices WHERE project_id = ? AND id = ?')
              .get(projectId, deviceId);
          },

          searchDevices: (projectId, searchTerm, limit = 20) => {
            const db = databaseService.getDatabase();
            const pattern = `%${searchTerm}%`;
            return db
              .prepare(
                `SELECT * FROM devices WHERE project_id = ? AND (
                name LIKE ? OR device_type LIKE ? OR ip_address LIKE ? OR hostname LIKE ?
              ) LIMIT ?`
              )
              .all(projectId, pattern, pattern, pattern, pattern, limit);
          },
        };
      },
      [ServiceTokens.DATABASE]
    );
  }

  // Register Control Service
  if (overrides[ServiceTokens.CONTROL_SERVICE]) {
    container.registerInstance(ServiceTokens.CONTROL_SERVICE, overrides[ServiceTokens.CONTROL_SERVICE]);
  } else {
    container.registerSingleton(
      ServiceTokens.CONTROL_SERVICE,
      async (databaseService) => {
        return {
          getControlNarrative: (projectId, controlId) => {
            const db = databaseService.getDatabase();
            return db
              .prepare(
                'SELECT * FROM control_narratives WHERE project_id = ? AND control_id = ?'
              )
              .get(projectId, controlId);
          },

          saveControlNarratives: (projectId, narratives) => {
            const db = databaseService.getDatabase();
            const upsertStmt = db.prepare(`
            INSERT INTO control_narratives (project_id, control_id, narrative, system_implementation, implementation_status, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(project_id, control_id) DO UPDATE SET
              narrative = excluded.narrative,
              system_implementation = excluded.system_implementation,
              implementation_status = excluded.implementation_status,
              updated_at = CURRENT_TIMESTAMP
          `);

            const saveMany = db.transaction((items) => {
              for (const item of items) {
                upsertStmt.run(
                  projectId,
                  item.controlId,
                  item.narrative || null,
                  item.systemImplementation || null,
                  item.implementationStatus || null
                );
              }
            });

            saveMany(narratives);
          },

          resetControlNarrative: (projectId, controlId) => {
            const db = databaseService.getDatabase();
            db.prepare(
              'DELETE FROM control_narratives WHERE project_id = ? AND control_id = ?'
            ).run(projectId, controlId);
          },

          getAllControlNarratives: (projectId) => {
            const db = databaseService.getDatabase();
            return db
              .prepare('SELECT * FROM control_narratives WHERE project_id = ?')
              .all(projectId);
          },
        };
      },
      [ServiceTokens.DATABASE]
    );
  }

  // Register License Service
  if (overrides[ServiceTokens.LICENSE_SERVICE]) {
    container.registerInstance(ServiceTokens.LICENSE_SERVICE, overrides[ServiceTokens.LICENSE_SERVICE]);
  } else {
    container.registerSingleton(
      ServiceTokens.LICENSE_SERVICE,
      async (databaseService) => {
        return {
          getCurrentLicense: () => {
            const db = databaseService.getDatabase();
            return db.prepare('SELECT * FROM licenses ORDER BY imported_at DESC LIMIT 1').get();
          },

          saveLicense: (licenseData) => {
            const db = databaseService.getDatabase();
            const stmt = db.prepare(`
            INSERT INTO licenses (license_code, user_id, email, expires_at, subscription_status, subscription_plan, subscription_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

            stmt.run(
              licenseData.licenseCode,
              licenseData.userId,
              licenseData.email,
              licenseData.expiresAt,
              licenseData.subscriptionStatus,
              licenseData.subscriptionPlan,
              licenseData.subscriptionId,
              licenseData.createdAt
            );

            return { success: true };
          },

          validateLicense: () => {
            const db = databaseService.getDatabase();
            const license = db
              .prepare('SELECT * FROM licenses ORDER BY imported_at DESC LIMIT 1')
              .get();

            if (!license) return false;
            if (license.expires_at < Date.now()) return false;
            if (license.subscription_status !== 'active') return false;

            return true;
          },

          clearLicense: () => {
            const db = databaseService.getDatabase();
            db.prepare('DELETE FROM licenses').run();
          },
        };
      },
      [ServiceTokens.DATABASE]
    );
  }

  console.log('[DI] Main process container setup complete');
  console.log('[DI] Registered services:', container.getRegisteredTokens().join(', '));

  return container;
}

/**
 * Create a test container with mock services
 * @param {Object} mocks - Object mapping service tokens to mock implementations
 * @returns {Promise<import('./container.js').DIContainer>}
 */
export async function createTestContainer(mocks = {}) {
  const { resetMainContainer } = await import('./container.js');
  const container = resetMainContainer();

  // Register all mocks
  for (const [token, implementation] of Object.entries(mocks)) {
    container.registerInstance(token, implementation);
  }

  return container;
}

export default setupMainContainer;
