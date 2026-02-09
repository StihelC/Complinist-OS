/**
 * Lightweight Dependency Injection Container for Renderer Process
 *
 * A TypeScript DI container for managing service dependencies in the
 * React/renderer process. Provides type-safe dependency injection
 * with support for singleton and transient lifetimes.
 *
 * @module src/core/di/container
 */

/**
 * Service lifetime options
 */
export type ServiceLifetime = 'singleton' | 'transient';

/**
 * Factory function type that creates a service instance
 */
export type ServiceFactory<T> = (...deps: unknown[]) => T | Promise<T>;

/**
 * Service registration configuration
 */
interface ServiceRegistration<T = unknown> {
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  dependencies: string[];
}

/**
 * DI Container class with TypeScript type safety
 */
export class DIContainer {
  private registrations: Map<string, ServiceRegistration> = new Map();
  private singletons: Map<string, unknown> = new Map();
  private pendingResolutions: Map<string, Promise<unknown>> = new Map();
  private isDisposed = false;

  /**
   * Register a service with a factory function
   * @param token - Unique service identifier
   * @param factory - Factory function that creates the service
   * @param options - Registration options
   * @returns This container for method chaining
   */
  register<T>(
    token: string,
    factory: ServiceFactory<T>,
    options: {
      lifetime?: ServiceLifetime;
      dependencies?: string[];
    } = {}
  ): this {
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
   */
  registerSingleton<T>(
    token: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): this {
    return this.register(token, factory, { lifetime: 'singleton', dependencies });
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(
    token: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): this {
    return this.register(token, factory, { lifetime: 'transient', dependencies });
  }

  /**
   * Register an existing instance as a singleton
   */
  registerInstance<T>(token: string, instance: T): this {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    this.registrations.set(token, {
      factory: () => instance,
      lifetime: 'singleton',
      dependencies: [],
    });

    this.singletons.set(token, instance);

    return this;
  }

  /**
   * Resolve a service by its token (async)
   */
  async resolve<T>(token: string): Promise<T> {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    const registration = this.registrations.get(token);

    if (!registration) {
      throw new Error(`Service "${token}" is not registered`);
    }

    // Return cached singleton if available
    if (registration.lifetime === 'singleton' && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Handle concurrent resolution of the same singleton
    if (registration.lifetime === 'singleton' && this.pendingResolutions.has(token)) {
      return this.pendingResolutions.get(token) as Promise<T>;
    }

    // Create resolution promise
    const resolutionPromise = this.createInstance<T>(token, registration);

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
   * Resolve a service synchronously
   * Only works if no async dependencies
   */
  resolveSync<T>(token: string): T {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }

    const registration = this.registrations.get(token);

    if (!registration) {
      throw new Error(`Service "${token}" is not registered`);
    }

    // Return cached singleton if available
    if (registration.lifetime === 'singleton' && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Resolve dependencies synchronously
    const deps = registration.dependencies.map(dep => this.resolveSync(dep));

    // Call factory with resolved dependencies
    const instance = registration.factory(...deps);

    // Handle async factories
    if (instance instanceof Promise) {
      throw new Error(`Cannot resolve "${token}" synchronously - factory is async`);
    }

    // Cache singleton
    if (registration.lifetime === 'singleton') {
      this.singletons.set(token, instance);
    }

    return instance as T;
  }

  /**
   * Create a service instance with resolved dependencies
   */
  private async createInstance<T>(
    _token: string,
    registration: ServiceRegistration
  ): Promise<T> {
    // Resolve all dependencies
    const deps = await Promise.all(
      registration.dependencies.map(dep => this.resolve(dep))
    );

    // Call factory with resolved dependencies
    const instance = await registration.factory(...deps);

    return instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.registrations.has(token);
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Create a child container that inherits from this container
   */
  createScope(): DIContainer {
    const child = new DIContainer();

    // Copy registrations (not singletons)
    for (const [token, registration] of this.registrations) {
      child.registrations.set(token, registration);
    }

    return child;
  }

  /**
   * Reset all singletons
   */
  resetSingletons(): void {
    this.singletons.clear();
    this.pendingResolutions.clear();
  }

  /**
   * Clear all registrations and singletons
   */
  clear(): void {
    this.registrations.clear();
    this.singletons.clear();
    this.pendingResolutions.clear();
  }

  /**
   * Dispose of the container and all disposable services
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) return;

    this.isDisposed = true;

    // Dispose all singletons that have a dispose method
    for (const [token, instance] of this.singletons) {
      if (instance && typeof (instance as { dispose?: () => unknown }).dispose === 'function') {
        try {
          await (instance as { dispose: () => unknown }).dispose();
        } catch (error) {
          console.error(`Error disposing service "${token}":`, error);
        }
      }
    }

    this.clear();
  }
}

/**
 * Service tokens for renderer process services
 */
export const RendererServiceTokens = {
  // IPC Client services
  DATABASE_CLIENT: 'databaseClient',
  AI_CLIENT: 'aiClient',
  EXPORT_CLIENT: 'exportClient',
  FILE_CLIENT: 'fileClient',

  // State stores
  FLOW_STORE: 'flowStore',
  AI_SERVICE_STORE: 'aiServiceStore',
  AUTH_STORE: 'authStore',

  // UI services
  NOTIFICATION_SERVICE: 'notificationService',
  DIALOG_SERVICE: 'dialogService',

  // Utility services
  LOGGER: 'logger',
  CONFIG: 'config',
} as const;

/**
 * Global container instance for the renderer process
 */
let rendererContainer: DIContainer | null = null;

/**
 * Get or create the renderer process container
 */
export function getRendererContainer(): DIContainer {
  if (!rendererContainer) {
    rendererContainer = new DIContainer();
  }
  return rendererContainer;
}

/**
 * Reset the renderer container (useful for testing)
 */
export function resetRendererContainer(): DIContainer {
  if (rendererContainer) {
    rendererContainer.clear();
  }
  rendererContainer = new DIContainer();
  return rendererContainer;
}

/**
 * Create a new container instance
 */
export function createContainer(): DIContainer {
  return new DIContainer();
}

export default DIContainer;
