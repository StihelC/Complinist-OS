/**
 * DI Container Module
 *
 * Central export point for the dependency injection system.
 * Import from this module to access container functionality.
 *
 * @module electron/di
 *
 * @example
 * // Import in main process
 * import { getMainContainer, ServiceTokens } from './di/index.js';
 *
 * // Get container and register services
 * const container = getMainContainer();
 * container.registerSingleton(ServiceTokens.DATABASE, () => new DatabaseService());
 *
 * // Resolve services
 * const db = await container.resolve(ServiceTokens.DATABASE);
 */

export {
  DIContainer,
  ServiceTokens,
  getMainContainer,
  resetMainContainer,
  createContainer,
} from './container.js';

export {
  ServiceInterfaces,
  createMockService,
  createPartialMock,
  validateServiceInterface,
} from './types.js';

// Re-export setup function when it's created
export { setupMainContainer } from './setup.js';
