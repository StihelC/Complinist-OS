import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  registerFlowStore,
  isFlowStoreRegistered,
  getFlowStoreState,
  getFlowStoreStateSafe,
  subscribeToFlowStore,
  selectFromFlowStore,
  selectFromFlowStoreSafe,
  type FlowStoreAccessible,
} from '@/core/stores/flowStoreAccessor';
import type { StoreApi } from 'zustand';

// Mock electronTRPC global before any imports that use it
vi.mock('@/lib/trpc/client', () => ({
  trpc: {},
}));

// Mock electronAPI global
beforeAll(() => {
  (global as any).window = {
    electronAPI: {
      createProject: vi.fn(),
      listProjects: vi.fn(),
      saveDiagram: vi.fn(),
      loadDiagram: vi.fn(),
      deleteProject: vi.fn(),
      loadControlNarratives: vi.fn(),
      saveControlNarratives: vi.fn(),
      updateProjectBaseline: vi.fn(),
      resetControlNarrative: vi.fn(),
      saveSingleControlNarrative: vi.fn(),
      queryDevices: vi.fn(),
      getDevice: vi.fn(),
      searchDevices: vi.fn(),
      getSSPMetadata: vi.fn(),
      saveSSPMetadata: vi.fn(),
    },
  };
});

afterAll(() => {
  delete (global as any).window;
});

// Reset module state between tests
// We need to re-import to reset the module-level storeRef
const getAccessorModule = async () => {
  vi.resetModules();
  return await import('@/core/stores/flowStoreAccessor');
};

describe('flowStoreAccessor', () => {
  // Mock store state
  const createMockState = (): FlowStoreAccessible => ({
    nodes: [
      {
        id: 'node-1',
        type: 'device',
        position: { x: 100, y: 100 },
        data: { id: 'node-1', label: 'Test Server' },
      } as any,
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'default',
      } as any,
    ],
    currentProject: {
      id: 1,
      name: 'Test Project',
      baseline: 'MODERATE' as const,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    globalSettings: {
      globalDeviceLabelSize: 12,
      globalBoundaryLabelSize: 14,
      globalConnectionLabelSize: 12,
      globalDeviceImageSize: 55,
      showGrid: false,
      snapToGrid: false,
      gridSize: 20,
    },
    reactFlowInstance: { getNodesBounds: null },
    setCurrentProject: vi.fn(),
    setNewProjectBaseline: vi.fn(),
  });

  // Create mock store API
  const createMockStore = (initialState: FlowStoreAccessible): StoreApi<FlowStoreAccessible> => {
    let state = initialState;
    const listeners = new Set<(state: FlowStoreAccessible, prevState: FlowStoreAccessible) => void>();

    return {
      getState: () => state,
      getInitialState: () => initialState,
      setState: (partial, replace) => {
        const prevState = state;
        state = replace
          ? (typeof partial === 'function' ? partial(state) : partial) as FlowStoreAccessible
          : { ...state, ...(typeof partial === 'function' ? partial(state) : partial) };
        listeners.forEach((listener) => listener(state, prevState));
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as StoreApi<FlowStoreAccessible>;
  };

  describe('before registration', () => {
    beforeEach(async () => {
      // Reset module to clear storeRef
      await getAccessorModule();
    });

    it('isFlowStoreRegistered should return false', async () => {
      const module = await getAccessorModule();
      expect(module.isFlowStoreRegistered()).toBe(false);
    });

    it('getFlowStoreState should throw error', async () => {
      const module = await getAccessorModule();
      expect(() => module.getFlowStoreState()).toThrow(
        '[FlowStoreAccessor] Flow store not registered'
      );
    });

    it('getFlowStoreStateSafe should return null', async () => {
      const module = await getAccessorModule();
      expect(module.getFlowStoreStateSafe()).toBeNull();
    });

    it('subscribeToFlowStore should throw error', async () => {
      const module = await getAccessorModule();
      expect(() => module.subscribeToFlowStore(vi.fn())).toThrow(
        '[FlowStoreAccessor] Flow store not registered'
      );
    });

    it('selectFromFlowStoreSafe should return default value', async () => {
      const module = await getAccessorModule();
      const result = module.selectFromFlowStoreSafe((state) => state.nodes, []);
      expect(result).toEqual([]);
    });
  });

  describe('after registration', () => {
    let mockStore: StoreApi<FlowStoreAccessible>;
    let mockState: FlowStoreAccessible;
    let module: typeof import('@/core/stores/flowStoreAccessor');

    beforeEach(async () => {
      module = await getAccessorModule();
      mockState = createMockState();
      mockStore = createMockStore(mockState);
      module.registerFlowStore(mockStore);
    });

    it('isFlowStoreRegistered should return true', () => {
      expect(module.isFlowStoreRegistered()).toBe(true);
    });

    it('getFlowStoreState should return current state', () => {
      const state = module.getFlowStoreState();
      expect(state.nodes).toHaveLength(1);
      expect(state.edges).toHaveLength(1);
      expect(state.currentProject?.name).toBe('Test Project');
    });

    it('getFlowStoreStateSafe should return current state', () => {
      const state = module.getFlowStoreStateSafe();
      expect(state).not.toBeNull();
      expect(state?.nodes).toHaveLength(1);
    });

    it('subscribeToFlowStore should call listener on state changes', () => {
      const listener = vi.fn();
      const unsubscribe = module.subscribeToFlowStore(listener);

      // Trigger state update
      mockStore.setState({ nodes: [] });

      expect(listener).toHaveBeenCalledTimes(1);
      const [newState, prevState] = listener.mock.calls[0];
      expect(newState.nodes).toHaveLength(0);
      expect(prevState.nodes).toHaveLength(1);

      unsubscribe();
    });

    it('subscribeToFlowStore unsubscribe should stop notifications', () => {
      const listener = vi.fn();
      const unsubscribe = module.subscribeToFlowStore(listener);

      unsubscribe();

      mockStore.setState({ nodes: [] });

      expect(listener).not.toHaveBeenCalled();
    });

    it('selectFromFlowStore should return selected data', () => {
      const nodeCount = module.selectFromFlowStore((state) => state.nodes.length);
      expect(nodeCount).toBe(1);

      const projectName = module.selectFromFlowStore((state) => state.currentProject?.name);
      expect(projectName).toBe('Test Project');
    });

    it('selectFromFlowStoreSafe should return selected data', () => {
      const nodeCount = module.selectFromFlowStoreSafe((state) => state.nodes.length, 0);
      expect(nodeCount).toBe(1);
    });

    it('duplicate registration should log warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const anotherStore = createMockStore(createMockState());

      module.registerFlowStore(anotherStore);

      expect(warnSpy).toHaveBeenCalledWith(
        '[FlowStoreAccessor] Store already registered. Ignoring duplicate registration.'
      );
      warnSpy.mockRestore();
    });

    it('should provide access to store actions', () => {
      const state = module.getFlowStoreState();
      expect(typeof state.setCurrentProject).toBe('function');
      expect(typeof state.setNewProjectBaseline).toBe('function');
    });
  });

  describe('integration with actual stores', () => {
    it('should work with the actual useFlowStore registration', async () => {
      // This test verifies the integration works end-to-end
      // The actual store registers itself on import
      const { isFlowStoreRegistered, getFlowStoreStateSafe } = await import(
        '@/core/stores/flowStoreAccessor'
      );

      // Import the actual store which triggers registration
      await import('@/core/stores/useFlowStore');

      // After importing useFlowStore, it should be registered
      expect(isFlowStoreRegistered()).toBe(true);

      // Should be able to access state
      const state = getFlowStoreStateSafe();
      expect(state).not.toBeNull();
      expect(Array.isArray(state?.nodes)).toBe(true);
      expect(Array.isArray(state?.edges)).toBe(true);
    });
  });
});
