import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import type { AppNode, AppEdge } from '@/lib/utils/types';

// Mock the control recommendations
vi.mock('@/lib/controls/controlRecommendations', () => ({
  getControlRecommendations: vi.fn(() => [
    { controlId: 'AC-2' },
    { controlId: 'SC-7' },
  ]),
}));

// Mock the priority mappings JSON
vi.mock('@/assets/catalog/control-priorities.json', () => ({
  default: {
    critical: ['AC-2', 'AC-3', 'SC-7'],
    high: ['AU-2', 'CM-2', 'IA-2'],
    medium: ['AC-6', 'SC-8'],
    low: ['PL-1', 'SA-1'],
  },
}));

describe('useControlSelectionStore', () => {
  const allControlIds = ['AC-2', 'AC-3', 'AC-6', 'AU-2', 'CM-2', 'IA-2', 'SC-7', 'SC-8', 'PL-1', 'SA-1'];

  beforeEach(() => {
    // Reset store state before each test
    useControlSelectionStore.setState({
      selectedControlIds: [],
      initialized: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty selected controls initially', () => {
      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toEqual([]);
      expect(state.initialized).toBe(false);
    });
  });

  describe('setSelectedControlIds', () => {
    it('should set selected control IDs', () => {
      useControlSelectionStore.getState().setSelectedControlIds(['AC-2', 'SC-7']);

      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toEqual(['AC-2', 'SC-7']);
      expect(state.initialized).toBe(true);
    });

    it('should replace existing selections', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'AC-3'],
        initialized: true,
      });

      useControlSelectionStore.getState().setSelectedControlIds(['SC-7', 'SC-8']);

      expect(useControlSelectionStore.getState().selectedControlIds).toEqual(['SC-7', 'SC-8']);
    });

    it('should handle empty array', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'AC-3'],
        initialized: true,
      });

      useControlSelectionStore.getState().setSelectedControlIds([]);

      expect(useControlSelectionStore.getState().selectedControlIds).toEqual([]);
      expect(useControlSelectionStore.getState().initialized).toBe(true);
    });
  });

  describe('toggleControl', () => {
    it('should add control if not selected', () => {
      useControlSelectionStore.getState().toggleControl('AC-2');

      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-2');
    });

    it('should remove control if already selected', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'SC-7'],
        initialized: true,
      });

      useControlSelectionStore.getState().toggleControl('AC-2');

      expect(useControlSelectionStore.getState().selectedControlIds).not.toContain('AC-2');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('SC-7');
    });

    it('should toggle multiple times correctly', () => {
      const { toggleControl } = useControlSelectionStore.getState();

      toggleControl('AC-2');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-2');

      toggleControl('AC-2');
      expect(useControlSelectionStore.getState().selectedControlIds).not.toContain('AC-2');

      toggleControl('AC-2');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-2');
    });
  });

  describe('selectByPriority', () => {
    it('should select all critical controls', () => {
      useControlSelectionStore.getState().selectByPriority(['critical']);

      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toContain('AC-2');
      expect(state.selectedControlIds).toContain('AC-3');
      expect(state.selectedControlIds).toContain('SC-7');
    });

    it('should select multiple priority levels', () => {
      useControlSelectionStore.getState().selectByPriority(['critical', 'high']);

      const state = useControlSelectionStore.getState();
      // Critical
      expect(state.selectedControlIds).toContain('AC-2');
      expect(state.selectedControlIds).toContain('SC-7');
      // High
      expect(state.selectedControlIds).toContain('AU-2');
      expect(state.selectedControlIds).toContain('IA-2');
    });

    it('should merge with existing selections', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['PL-1'],
        initialized: true,
      });

      useControlSelectionStore.getState().selectByPriority(['critical']);

      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toContain('PL-1');
      expect(state.selectedControlIds).toContain('AC-2');
    });

    it('should avoid duplicates when selecting same priority twice', () => {
      useControlSelectionStore.getState().selectByPriority(['critical']);
      const countAfterFirst = useControlSelectionStore.getState().selectedControlIds.length;

      useControlSelectionStore.getState().selectByPriority(['critical']);
      const countAfterSecond = useControlSelectionStore.getState().selectedControlIds.length;

      expect(countAfterFirst).toBe(countAfterSecond);
    });

    it('should mark as initialized', () => {
      useControlSelectionStore.getState().selectByPriority(['low']);

      expect(useControlSelectionStore.getState().initialized).toBe(true);
    });
  });

  describe('selectAll', () => {
    it('should select all provided control IDs', () => {
      useControlSelectionStore.getState().selectAll(allControlIds);

      expect(useControlSelectionStore.getState().selectedControlIds).toEqual(allControlIds);
    });

    it('should replace existing selections', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2'],
        initialized: true,
      });

      useControlSelectionStore.getState().selectAll(['SC-7', 'SC-8']);

      expect(useControlSelectionStore.getState().selectedControlIds).toEqual(['SC-7', 'SC-8']);
    });

    it('should mark as initialized', () => {
      useControlSelectionStore.getState().selectAll(['AC-2']);

      expect(useControlSelectionStore.getState().initialized).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all selections', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'SC-7', 'AU-2'],
        initialized: true,
      });

      useControlSelectionStore.getState().clearAll();

      expect(useControlSelectionStore.getState().selectedControlIds).toEqual([]);
    });

    it('should mark as initialized after clearing', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2'],
        initialized: false,
      });

      useControlSelectionStore.getState().clearAll();

      expect(useControlSelectionStore.getState().initialized).toBe(true);
    });
  });

  describe('applyRecommendations', () => {
    it('should add recommended control IDs', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AU-2'],
        initialized: true,
      });

      useControlSelectionStore.getState().applyRecommendations(['AC-2', 'SC-7']);

      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toContain('AU-2');
      expect(state.selectedControlIds).toContain('AC-2');
      expect(state.selectedControlIds).toContain('SC-7');
    });

    it('should avoid duplicates', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2'],
        initialized: true,
      });

      useControlSelectionStore.getState().applyRecommendations(['AC-2', 'SC-7']);

      const state = useControlSelectionStore.getState();
      const ac2Count = state.selectedControlIds.filter((id) => id === 'AC-2').length;
      expect(ac2Count).toBe(1);
    });
  });

  describe('initializeSmartDefaults', () => {
    const mockNodes: AppNode[] = [
      {
        id: 'node-1',
        type: 'device',
        position: { x: 0, y: 0 },
        data: { id: 'node-1', label: 'Server', deviceType: 'server' },
      },
      {
        id: 'node-2',
        type: 'device',
        position: { x: 100, y: 0 },
        data: { id: 'node-2', label: 'Firewall', deviceType: 'firewall' },
      },
    ] as AppNode[];

    const mockEdges: AppEdge[] = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      },
    ] as AppEdge[];

    it('should initialize with critical controls and topology recommendations', () => {
      useControlSelectionStore.getState().initializeSmartDefaults(mockNodes, mockEdges, allControlIds);

      const state = useControlSelectionStore.getState();
      // Critical controls
      expect(state.selectedControlIds).toContain('AC-2');
      expect(state.selectedControlIds).toContain('SC-7');
      expect(state.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AU-2'],
        initialized: true,
      });

      useControlSelectionStore.getState().initializeSmartDefaults(mockNodes, mockEdges, allControlIds);

      // Should not change since already initialized
      expect(useControlSelectionStore.getState().selectedControlIds).toEqual(['AU-2']);
    });

    it('should not reinitialize if already has selections', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AU-2'],
        initialized: false,
      });

      useControlSelectionStore.getState().initializeSmartDefaults(mockNodes, mockEdges, allControlIds);

      // Should not change since there are existing selections
      expect(useControlSelectionStore.getState().selectedControlIds).toEqual(['AU-2']);
    });

    it('should only include controls that exist in allControlIds', () => {
      const limitedControlIds = ['AC-2', 'AU-2'];

      useControlSelectionStore.getState().initializeSmartDefaults(mockNodes, mockEdges, limitedControlIds);

      const state = useControlSelectionStore.getState();
      // AC-3 is critical but not in allControlIds
      expect(state.selectedControlIds).not.toContain('AC-3');
      // AC-2 is critical and in allControlIds
      expect(state.selectedControlIds).toContain('AC-2');
    });
  });

  describe('isSelected', () => {
    it('should return true for selected control', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'SC-7'],
        initialized: true,
      });

      expect(useControlSelectionStore.getState().isSelected('AC-2')).toBe(true);
    });

    it('should return false for unselected control', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'SC-7'],
        initialized: true,
      });

      expect(useControlSelectionStore.getState().isSelected('AU-2')).toBe(false);
    });
  });

  describe('getSelectedCount', () => {
    it('should return correct count', () => {
      useControlSelectionStore.setState({
        selectedControlIds: ['AC-2', 'SC-7', 'AU-2'],
        initialized: true,
      });

      expect(useControlSelectionStore.getState().getSelectedCount()).toBe(3);
    });

    it('should return 0 when no selections', () => {
      expect(useControlSelectionStore.getState().getSelectedCount()).toBe(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid toggles correctly', () => {
      const { toggleControl } = useControlSelectionStore.getState();

      // Rapid toggles on same control
      toggleControl('AC-2');
      toggleControl('AC-2');
      toggleControl('AC-2');

      // Should end up selected (odd number of toggles)
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-2');
    });

    it('should handle multiple concurrent selections', () => {
      const { toggleControl } = useControlSelectionStore.getState();

      toggleControl('AC-2');
      toggleControl('SC-7');
      toggleControl('AU-2');
      toggleControl('AC-3');

      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toHaveLength(4);
      expect(state.selectedControlIds).toContain('AC-2');
      expect(state.selectedControlIds).toContain('SC-7');
      expect(state.selectedControlIds).toContain('AU-2');
      expect(state.selectedControlIds).toContain('AC-3');
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      const store = useControlSelectionStore.getState();

      // Perform a series of operations
      store.setSelectedControlIds(['AC-2']);
      expect(useControlSelectionStore.getState().selectedControlIds).toEqual(['AC-2']);

      store.toggleControl('SC-7');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-2');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('SC-7');

      store.applyRecommendations(['AU-2']);
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AC-2');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('SC-7');
      expect(useControlSelectionStore.getState().selectedControlIds).toContain('AU-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle selecting non-existent priorities gracefully', () => {
      // selectByPriority should not throw for unknown priorities
      expect(() => {
        useControlSelectionStore.getState().selectByPriority(['unknown' as any]);
      }).not.toThrow();
    });

    it('should handle empty nodes and edges in initializeSmartDefaults', () => {
      expect(() => {
        useControlSelectionStore.getState().initializeSmartDefaults([], [], allControlIds);
      }).not.toThrow();
    });

    it('should handle duplicate control IDs in setSelectedControlIds', () => {
      useControlSelectionStore.getState().setSelectedControlIds(['AC-2', 'AC-2', 'AC-2']);

      // Store preserves the array as-is, application should handle deduplication if needed
      const state = useControlSelectionStore.getState();
      expect(state.selectedControlIds).toEqual(['AC-2', 'AC-2', 'AC-2']);
    });
  });
});
