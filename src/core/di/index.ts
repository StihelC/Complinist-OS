/**
 * DI Container Module for Renderer Process
 *
 * Central export point for the dependency injection system in React/renderer.
 * Import from this module to access container functionality.
 *
 * @module src/core/di
 *
 * @example
 * // Import in renderer process
 * import { getRendererContainer, RendererServiceTokens, useService } from '@/core/di';
 *
 * // Get container and resolve services
 * const container = getRendererContainer();
 * const dbClient = await container.resolve<IDatabaseClient>(RendererServiceTokens.DATABASE_CLIENT);
 *
 * // Or use the hook in components
 * const logger = useService<ILogger>(RendererServiceTokens.LOGGER);
 */

export {
  DIContainer,
  RendererServiceTokens,
  getRendererContainer,
  resetRendererContainer,
  createContainer,
} from './container';

export type { ServiceLifetime, ServiceFactory } from './container';

export {
  setupRendererContainer,
  createTestContainer,
  useService,
} from './setup';

export type {
  IDatabaseClient,
  IAIClient,
  IExportClient,
  ILogger,
} from './setup';
