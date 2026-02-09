/**
 * Lightweight Dependency Injection Container
 *
 * A simple yet powerful DI container for managing service dependencies
 * across Electron's main process. Uses factory pattern for lazy instantiation
 * and supports singleton and transient lifetimes.
 *
 * Features:
 * - Factory-based registration for lazy instantiation
 * - Singleton and transient service lifetimes
 * - Automatic dependency resolution
 * - Type-safe service tokens
 * - Support for async factories
 * - Easy testing via mock injection
 *
 * @module electron/di/container
 */

/**
 * Service lifetime options
 * @typedef {'singleton' | 'transient'} ServiceLifetime
 */

/**
 * Service registration options
 * @typedef {Object} ServiceRegistration
 * @property {Function} factory - Factory function to create the service
 * @property {ServiceLifetime} lifetime - Service lifetime (singleton or transient)
 * @property {Array<string>} [dependencies] - Array of dependency tokens
 */

/**
 * DI Container class
 */
class DIContainer {
  constructor() {
    /** @type {Map<string, ServiceRegistration>} */
    this.registrations = new Map();

    /** @type {Map<string, any>} */
    this.singletons = new Map();

    /** @type {Map<string, Promise<any>>} */
    this.pendingResolutions = new Map();

    /** @type {boolean} */
    this.isDisposed = false;
  }

  /**
   * Register a service with a factory function
   * @param {string} token - Unique service identifier
   * @param {Function} factory - Factory function that creates the service
   * @param {Object} [options] - Registration options
   * @param {ServiceLifetime} [options.lifetime='singleton'] - Service lifetime
   * @param {Array<string>} [options.dependencies=[]] - Array of dependency tokens
   * @returns {DIContainer} - Returns this for chaining
   */
  register(token, factory, options = {}) {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Service token must be a non-empty string');
    }

    if (typeof factory !== 'function') {
      throw new Error(`Factory for "${token}" must be a function`);
    }

    const { lifetime = 'singleton', dependencies = [] } = options;

    this.registrations.set(token, {
      factory,
      lifetime,
      dependencies,
    });

    // Clear any cached singleton if re-registering
    this.singletons.delete(token);

    return this;
  }

  /**
   * Register a singleton service
   * @param {string} token - Unique service identifier
   * @param {Function} factory - Factory function that creates the service
   * @param {Array<string>} [dependencies=[]] - Array of dependency tokens
   * @returns {DIContainer} - Returns this for chaining
   */
  registerSingleton(token, factory, dependencies = []) {
    return this.register(token, factory, { lifetime: 'singleton', dependencies });
  }

  /**
   * Register a transient service (new instance each time)
   * @param {string} token - Unique service identifier
   * @param {Function} factory - Factory function that creates the service
   * @param {Array<string>} [dependencies=[]] - Array of dependency tokens
   * @returns {DIContainer} - Returns this for chaining
   */
  registerTransient(token, factory, dependencies = []) {
    return this.register(token, factory, { lifetime: 'transient', dependencies });
  }

  /**
   * Register an existing instance as a singleton
   * @param {string} token - Unique service identifier
   * @param {any} instance - The service instance
   * @returns {DIContainer} - Returns this for chaining
   */
  registerInstance(token, instance) {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Service token must be a non-empty string');
    }

    this.registrations.set(token, {
      factory: () => instance,
      lifetime: 'singleton',
      dependencies: [],
    });

    // Store the instance directly
    this.singletons.set(token, instance);

    return this;
  }

  /**
   * Resolve a service by its token
   * @param {string} token - Service identifier
   * @returns {Promise<any>} - The resolved service instance
   */
  async resolve(token) {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    const registration = this.registrations.get(token);

    if (!registration) {
      throw new Error(`Service "${token}" is not registered`);
    }

    // Return cached singleton if available
    if (registration.lifetime === 'singleton' && this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    // Handle concurrent resolution of the same singleton
    if (registration.lifetime === 'singleton' && this.pendingResolutions.has(token)) {
      return this.pendingResolutions.get(token);
    }

    // Create resolution promise
    const resolutionPromise = this._createInstance(token, registration);

    if (registration.lifetime === 'singleton') {
      this.pendingResolutions.set(token, resolutionPromise);
    }

    try {
      const instance = await resolutionPromise;

      // Cache singleton
      if (registration.lifetime === 'singleton') {
        this.singletons.set(token, instance);
        this.pendingResolutions.delete(token);
      }

      return instance;
    } catch (error) {
      this.pendingResolutions.delete(token);
      throw error;
    }
  }

  /**
   * Resolve a service synchronously (only works if no async dependencies)
   * @param {string} token - Service identifier
   * @returns {any} - The resolved service instance
   */
  resolveSync(token) {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    const registration = this.registrations.get(token);

    if (!registration) {
      throw new Error(`Service "${token}" is not registered`);
    }

    // Return cached singleton if available
    if (registration.lifetime === 'singleton' && this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    // Resolve dependencies synchronously
    const deps = registration.dependencies.map(dep => this.resolveSync(dep));

    // Call factory with resolved dependencies
    const instance = registration.factory(...deps);

    // Handle async factories (will throw)
    if (instance instanceof Promise) {
      throw new Error(`Cannot resolve "${token}" synchronously - factory is async`);
    }

    // Cache singleton
    if (registration.lifetime === 'singleton') {
      this.singletons.set(token, instance);
    }

    return instance;
  }

  /**
   * Create a service instance with resolved dependencies
   * @private
   * @param {string} token - Service identifier
   * @param {ServiceRegistration} registration - Service registration
   * @returns {Promise<any>} - The created instance
   */
  async _createInstance(token, registration) {
    // Resolve all dependencies
    const deps = await Promise.all(
      registration.dependencies.map(dep => this.resolve(dep))
    );

    // Call factory with resolved dependencies
    const instance = await registration.factory(...deps);

    return instance;
  }

  /**
   * Check if a service is registered
   * @param {string} token - Service identifier
   * @returns {boolean}
   */
  has(token) {
    return this.registrations.has(token);
  }

  /**
   * Get all registered service tokens
   * @returns {Array<string>}
   */
  getRegisteredTokens() {
    return Array.from(this.registrations.keys());
  }

  /**
   * Create a child container that inherits from this container
   * Useful for scoped services or testing
   * @returns {DIContainer}
   */
  createScope() {
    const child = new DIContainer();

    // Copy registrations (not singletons)
    for (const [token, registration] of this.registrations) {
      child.registrations.set(token, registration);
    }

    // Reference parent's singletons for singleton services
    child._parent = this;

    return child;
  }

  /**
   * Reset all singletons (useful for testing)
   */
  resetSingletons() {
    this.singletons.clear();
    this.pendingResolutions.clear();
  }

  /**
   * Clear all registrations and singletons
   */
  clear() {
    this.registrations.clear();
    this.singletons.clear();
    this.pendingResolutions.clear();
  }

  /**
   * Dispose of the container and all disposable services
   * @returns {Promise<void>}
   */
  async dispose() {
    if (this.isDisposed) return;

    this.isDisposed = true;

    // Dispose all singletons that have a dispose method
    for (const [token, instance] of this.singletons) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          await instance.dispose();
        } catch (error) {
          console.error(`Error disposing service "${token}":`, error);
        }
      }
    }

    this.clear();
  }
}

/**
 * Service tokens for main process services
 * Use these constants instead of strings for type safety
 */
export const ServiceTokens = {
  // Core services
  DATABASE: 'database',
  CONFIG: 'config',

  // AI services
  AI_SERVICE: 'aiService',
  EMBEDDING_SERVICE: 'embeddingService',
  CHROMA_SERVICE: 'chromaService',
  CHUNKING_SERVICE: 'chunkingService',

  // IPC services
  IPC_MAIN: 'ipcMain',

  // File system services
  FILE_SERVICE: 'fileService',
  USER_DATA_SERVICE: 'userDataService',

  // Export services
  EXPORT_SERVICE: 'exportService',
  PDF_SERVICE: 'pdfService',

  // Business logic services
  PROJECT_SERVICE: 'projectService',
  DEVICE_SERVICE: 'deviceService',
  CONTROL_SERVICE: 'controlService',
  LICENSE_SERVICE: 'licenseService',
  TERRAFORM_SERVICE: 'terraformService',
};

/**
 * Global container instance for the main process
 * @type {DIContainer}
 */
let mainContainer = null;

/**
 * Get or create the main process container
 * @returns {DIContainer}
 */
export function getMainContainer() {
  if (!mainContainer) {
    mainContainer = new DIContainer();
  }
  return mainContainer;
}

/**
 * Reset the main container (useful for testing)
 */
export function resetMainContainer() {
  if (mainContainer) {
    mainContainer.clear();
  }
  mainContainer = new DIContainer();
  return mainContainer;
}

/**
 * Create a new container instance (for testing or scoped usage)
 * @returns {DIContainer}
 */
export function createContainer() {
  return new DIContainer();
}

export { DIContainer };
export default DIContainer;
