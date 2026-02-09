/**
 * DI Container Unit Tests
 *
 * Tests for the dependency injection container implementation.
 * Verifies core functionality: registration, resolution, lifetimes, and dependency chains.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DIContainer,
  RendererServiceTokens,
  getRendererContainer,
  resetRendererContainer,
  createContainer,
} from '@/core/di/container';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    container.clear();
  });

  describe('Registration', () => {
    it('should register a service with factory', () => {
      const factory = () => ({ value: 42 });
      container.register('testService', factory);

      expect(container.has('testService')).toBe(true);
    });

    it('should register singleton services', () => {
      container.registerSingleton('singleton', () => ({ id: Math.random() }));

      expect(container.has('singleton')).toBe(true);
    });

    it('should register transient services', () => {
      container.registerTransient('transient', () => ({ id: Math.random() }));

      expect(container.has('transient')).toBe(true);
    });

    it('should register instances directly', () => {
      const instance = { name: 'direct instance' };
      container.registerInstance('instance', instance);

      expect(container.has('instance')).toBe(true);
    });

    it('should throw when registering with invalid token', () => {
      expect(() => container.register('', () => ({}))).toThrow('token must be a non-empty string');
    });

    it('should throw when registering with non-function factory', () => {
      // @ts-expect-error Testing invalid input
      expect(() => container.register('test', 'not a function')).toThrow('must be a function');
    });

    it('should allow method chaining', () => {
      const result = container
        .registerSingleton('a', () => 1)
        .registerTransient('b', () => 2)
        .registerInstance('c', 3);

      expect(result).toBe(container);
      expect(container.has('a')).toBe(true);
      expect(container.has('b')).toBe(true);
      expect(container.has('c')).toBe(true);
    });
  });

  describe('Resolution', () => {
    it('should resolve a registered service', async () => {
      const expected = { value: 'test' };
      container.registerSingleton('service', () => expected);

      const result = await container.resolve<typeof expected>('service');

      expect(result).toBe(expected);
    });

    it('should throw when resolving unregistered service', async () => {
      await expect(container.resolve('unknown')).rejects.toThrow('not registered');
    });

    it('should resolve async factories', async () => {
      container.registerSingleton('async', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { async: true };
      });

      const result = await container.resolve<{ async: boolean }>('async');

      expect(result).toEqual({ async: true });
    });

    it('should resolve synchronously when possible', () => {
      container.registerSingleton('sync', () => ({ sync: true }));

      const result = container.resolveSync<{ sync: boolean }>('sync');

      expect(result).toEqual({ sync: true });
    });

    it('should throw when resolving async factory synchronously', () => {
      container.registerSingleton('async', async () => ({ async: true }));

      expect(() => container.resolveSync('async')).toThrow('factory is async');
    });

    it('should resolve registered instances', async () => {
      const instance = { direct: true };
      container.registerInstance('direct', instance);

      const result = await container.resolve('direct');

      expect(result).toBe(instance);
    });
  });

  describe('Singleton Lifetime', () => {
    it('should return the same instance for singleton services', async () => {
      let counter = 0;
      container.registerSingleton('singleton', () => ({ id: ++counter }));

      const first = await container.resolve('singleton');
      const second = await container.resolve('singleton');

      expect(first).toBe(second);
      expect(counter).toBe(1);
    });

    it('should handle concurrent singleton resolution', async () => {
      let counter = 0;
      container.registerSingleton('concurrent', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { id: ++counter };
      });

      // Resolve concurrently
      const [first, second, third] = await Promise.all([
        container.resolve('concurrent'),
        container.resolve('concurrent'),
        container.resolve('concurrent'),
      ]);

      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(counter).toBe(1);
    });
  });

  describe('Transient Lifetime', () => {
    it('should create new instance for each transient resolution', async () => {
      let counter = 0;
      container.registerTransient('transient', () => ({ id: ++counter }));

      const first = await container.resolve<{ id: number }>('transient');
      const second = await container.resolve<{ id: number }>('transient');

      expect(first).not.toBe(second);
      expect(first.id).toBe(1);
      expect(second.id).toBe(2);
    });
  });

  describe('Dependencies', () => {
    it('should resolve dependencies in order', async () => {
      container.registerSingleton('dep1', () => ({ name: 'dep1' }));
      container.registerSingleton('dep2', () => ({ name: 'dep2' }));
      container.registerSingleton(
        'main',
        (d1: { name: string }, d2: { name: string }) => ({
          deps: [d1.name, d2.name],
        }),
        ['dep1', 'dep2']
      );

      const result = await container.resolve<{ deps: string[] }>('main');

      expect(result.deps).toEqual(['dep1', 'dep2']);
    });

    it('should handle deep dependency chains', async () => {
      container.registerSingleton('a', () => 'a');
      container.registerSingleton('b', (a: string) => a + 'b', ['a']);
      container.registerSingleton('c', (b: string) => b + 'c', ['b']);
      container.registerSingleton('d', (c: string) => c + 'd', ['c']);

      const result = await container.resolve<string>('d');

      expect(result).toBe('abcd');
    });

    it('should resolve dependencies synchronously', () => {
      container.registerSingleton('sync1', () => 1);
      container.registerSingleton('sync2', (n: number) => n + 1, ['sync1']);
      container.registerSingleton('sync3', (n: number) => n * 2, ['sync2']);

      const result = container.resolveSync<number>('sync3');

      expect(result).toBe(4);
    });
  });

  describe('Container Management', () => {
    it('should list registered tokens', () => {
      container.registerSingleton('a', () => 1);
      container.registerSingleton('b', () => 2);

      const tokens = container.getRegisteredTokens();

      expect(tokens).toContain('a');
      expect(tokens).toContain('b');
      expect(tokens.length).toBe(2);
    });

    it('should check if service is registered', () => {
      container.registerSingleton('exists', () => ({}));

      expect(container.has('exists')).toBe(true);
      expect(container.has('doesNotExist')).toBe(false);
    });

    it('should clear all registrations', () => {
      container.registerSingleton('a', () => 1);
      container.registerSingleton('b', () => 2);

      container.clear();

      expect(container.has('a')).toBe(false);
      expect(container.has('b')).toBe(false);
    });

    it('should reset singletons without clearing registrations', async () => {
      let counter = 0;
      container.registerSingleton('service', () => ({ id: ++counter }));

      const first = await container.resolve<{ id: number }>('service');
      container.resetSingletons();
      const second = await container.resolve<{ id: number }>('service');

      expect(first.id).toBe(1);
      expect(second.id).toBe(2);
      expect(container.has('service')).toBe(true);
    });
  });

  describe('Scoping', () => {
    it('should create child scope with inherited registrations', async () => {
      container.registerSingleton('parent', () => ({ from: 'parent' }));

      const scope = container.createScope();

      const result = await scope.resolve<{ from: string }>('parent');
      expect(result.from).toBe('parent');
    });

    it('should allow scope to override parent registrations', async () => {
      container.registerSingleton('service', () => ({ value: 'parent' }));

      const scope = container.createScope();
      scope.registerSingleton('service', () => ({ value: 'child' }));

      const parentResult = await container.resolve<{ value: string }>('service');
      const childResult = await scope.resolve<{ value: string }>('service');

      expect(parentResult.value).toBe('parent');
      expect(childResult.value).toBe('child');
    });
  });

  describe('Disposal', () => {
    it('should dispose container and services', async () => {
      const disposeFn = vi.fn();
      container.registerInstance('disposable', {
        dispose: disposeFn,
      });

      await container.resolve('disposable');
      await container.dispose();

      expect(disposeFn).toHaveBeenCalled();
    });

    it('should throw when using disposed container', async () => {
      await container.dispose();

      expect(() => container.register('test', () => ({}))).toThrow('disposed');
      await expect(container.resolve('test')).rejects.toThrow('disposed');
    });

    it('should handle disposal errors gracefully', async () => {
      container.registerInstance('badDisposer', {
        dispose: () => {
          throw new Error('Disposal failed');
        },
      });

      await container.resolve('badDisposer');

      // Should not throw, but log error
      await expect(container.dispose()).resolves.toBeUndefined();
    });
  });
});

describe('Global Container', () => {
  afterEach(() => {
    resetRendererContainer();
  });

  it('should provide a global renderer container', () => {
    const container = getRendererContainer();

    expect(container).toBeInstanceOf(DIContainer);
  });

  it('should return the same container on multiple calls', () => {
    const first = getRendererContainer();
    const second = getRendererContainer();

    expect(first).toBe(second);
  });

  it('should reset to a new container', () => {
    const original = getRendererContainer();
    const reset = resetRendererContainer();

    expect(reset).not.toBe(original);
    expect(getRendererContainer()).toBe(reset);
  });
});

describe('RendererServiceTokens', () => {
  it('should have all expected service tokens', () => {
    expect(RendererServiceTokens.DATABASE_CLIENT).toBe('databaseClient');
    expect(RendererServiceTokens.AI_CLIENT).toBe('aiClient');
    expect(RendererServiceTokens.EXPORT_CLIENT).toBe('exportClient');
    expect(RendererServiceTokens.FILE_CLIENT).toBe('fileClient');
    expect(RendererServiceTokens.FLOW_STORE).toBe('flowStore');
    expect(RendererServiceTokens.AI_SERVICE_STORE).toBe('aiServiceStore');
    expect(RendererServiceTokens.AUTH_STORE).toBe('authStore');
    expect(RendererServiceTokens.NOTIFICATION_SERVICE).toBe('notificationService');
    expect(RendererServiceTokens.DIALOG_SERVICE).toBe('dialogService');
    expect(RendererServiceTokens.LOGGER).toBe('logger');
    expect(RendererServiceTokens.CONFIG).toBe('config');
  });
});
