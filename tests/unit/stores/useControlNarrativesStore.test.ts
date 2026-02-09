import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import type { ControlNarrative, NistBaseline } from '@/lib/utils/types';

// Mock the dependencies
vi.mock('@/lib/controls/controlCatalog', () => ({
  getAllControlsWithBaselineFlags: vi.fn(),
  groupControlsByFamily: vi.fn((controls) => {
    const families: Record<string, any[]> = {};
    controls.forEach((c: any) => {
      const fam = c.family || 'UNKNOWN';
      if (!families[fam]) families[fam] = [];
      families[fam].push(c);
    });
    return Object.entries(families).map(([id, controls]) => ({ id, controls }));
  }),
}));

vi.mock('@/core/database/client', () => ({
  db: {
    loadControlNarratives: vi.fn(),
    saveControlNarratives: vi.fn(),
    resetControlNarrative: vi.fn(),
    saveSingleControlNarrative: vi.fn(),
    updateProjectBaseline: vi.fn(),
  },
}));

vi.mock('@/lib/topology/topologyAnalyzer', () => ({
  analyzeTopology: vi.fn(() => ({
    devices: { details: [], count: 0 },
    boundaries: { zones: [] },
    connections: [],
  })),
}));

vi.mock('@/lib/utils/narrativeGenerators', () => ({
  generateNarrativeForControl: vi.fn(() => 'Generated narrative'),
}));

vi.mock('@/lib/ai/implementationAssistant', () => ({
  recommendImplementation: vi.fn(),
}));

import { getAllControlsWithBaselineFlags } from '@/lib/controls/controlCatalog';
import { db } from '@/core/database/client';

describe('useControlNarrativesStore', () => {
  const mockControlCatalog = {
    items: {
      'AC-2': {
        control_id: 'AC-2',
        title: 'Account Management',
        family: 'AC',
        default_narrative: 'Default AC-2 narrative',
        isApplicableToBaseline: true,
      },
      'SC-7': {
        control_id: 'SC-7',
        title: 'Boundary Protection',
        family: 'SC',
        default_narrative: 'Default SC-7 narrative',
        isApplicableToBaseline: true,
      },
      'CM-8': {
        control_id: 'CM-8',
        title: 'Information System Component Inventory',
        family: 'CM',
        default_narrative: 'Default CM-8 narrative',
        isApplicableToBaseline: true,
      },
    },
  };

  const mockSavedNarratives = [
    {
      control_id: 'AC-2',
      narrative: 'Custom AC-2 narrative',
      system_implementation: 'Custom AC-2 implementation',
      implementation_status: 'implemented',
    },
  ];

  beforeEach(() => {
    // Reset store state
    useControlNarrativesStore.setState({
      items: {},
      families: [],
      baseline: 'MODERATE',
      searchTerm: '',
      showOnlyApplicable: true,
      hiddenCustomCount: 0,
      dirtyIds: new Set(),
      dirtyCount: 0,
      loading: false,
      saving: false,
      generating: false,
      generationProgress: null,
      error: null,
      projectId: null,
    });

    vi.clearAllMocks();
    vi.mocked(getAllControlsWithBaselineFlags).mockResolvedValue(mockControlCatalog);
    vi.mocked(db.loadControlNarratives).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useControlNarrativesStore.getState();
      expect(state.items).toEqual({});
      expect(state.families).toEqual([]);
      expect(state.baseline).toBe('MODERATE');
      expect(state.searchTerm).toBe('');
      expect(state.showOnlyApplicable).toBe(true);
      expect(state.dirtyIds.size).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.saving).toBe(false);
      expect(state.generating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.projectId).toBeNull();
    });
  });

  describe('loadControls', () => {
    it('should load controls for a baseline', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      const state = useControlNarrativesStore.getState();
      expect(state.items['AC-2']).toBeDefined();
      expect(state.items['SC-7']).toBeDefined();
      expect(state.projectId).toBe(1);
      expect(state.loading).toBe(false);
    });

    it('should merge saved narratives', async () => {
      vi.mocked(db.loadControlNarratives).mockResolvedValueOnce(mockSavedNarratives);

      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      const ac2 = useControlNarrativesStore.getState().items['AC-2'];
      expect(ac2.system_implementation).toBe('Custom AC-2 implementation');
      expect(ac2.implementation_status).toBe('implemented');
      expect(ac2.isCustom).toBe(true);
    });

    it('should set error if no project ID', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 0,
      });

      expect(useControlNarrativesStore.getState().error).toBe(
        'A project must be selected before loading control narratives.'
      );
    });

    it('should handle load errors', async () => {
      vi.mocked(getAllControlsWithBaselineFlags).mockRejectedValueOnce(
        new Error('Catalog load failed')
      );

      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      expect(useControlNarrativesStore.getState().error).toBe('Catalog load failed');
      expect(useControlNarrativesStore.getState().loading).toBe(false);
    });
  });

  describe('setSearchTerm', () => {
    it('should set search term and filter families', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().setSearchTerm('AC-2');

      const state = useControlNarrativesStore.getState();
      expect(state.searchTerm).toBe('AC-2');
    });

    it('should handle empty search term', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().setSearchTerm('test');
      useControlNarrativesStore.getState().setSearchTerm('');

      expect(useControlNarrativesStore.getState().searchTerm).toBe('');
    });
  });

  describe('setShowOnlyApplicable', () => {
    it('should update filter setting', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().setShowOnlyApplicable(false);

      expect(useControlNarrativesStore.getState().showOnlyApplicable).toBe(false);
    });
  });

  describe('updateNarrative', () => {
    it('should update control narrative', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'New narrative text');

      const state = useControlNarrativesStore.getState();
      expect(state.items['AC-2'].system_implementation).toBe('New narrative text');
      expect(state.items['AC-2'].isCustom).toBe(true);
      expect(state.dirtyIds.has('AC-2')).toBe(true);
      expect(state.dirtyCount).toBe(1);
    });

    it('should mark as not custom if narrative cleared', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'Some text');
      useControlNarrativesStore.getState().updateNarrative('AC-2', '');

      const control = useControlNarrativesStore.getState().items['AC-2'];
      expect(control.isCustom).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update implementation status', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateStatus('AC-2', 'implemented');

      const state = useControlNarrativesStore.getState();
      expect(state.items['AC-2'].implementation_status).toBe('implemented');
      expect(state.items['AC-2'].isCustom).toBe(true);
      expect(state.dirtyIds.has('AC-2')).toBe(true);
    });
  });

  describe('resetControl', () => {
    it('should reset control to default', async () => {
      vi.mocked(db.loadControlNarratives).mockResolvedValueOnce(mockSavedNarratives);

      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().resetControl('AC-2');

      const control = useControlNarrativesStore.getState().items['AC-2'];
      expect(control.system_implementation).toBe('');
      expect(control.implementation_status).toBeUndefined();
      expect(control.isCustom).toBe(false);
    });

    it('should mark as dirty if was previously custom', async () => {
      vi.mocked(db.loadControlNarratives).mockResolvedValueOnce(mockSavedNarratives);

      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      // AC-2 has wasCustom=true from saved narrative
      useControlNarrativesStore.getState().resetControl('AC-2');

      expect(useControlNarrativesStore.getState().dirtyIds.has('AC-2')).toBe(true);
    });
  });

  describe('saveNarratives', () => {
    it('should save dirty narratives', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'New text');
      vi.mocked(db.saveControlNarratives).mockResolvedValueOnce(undefined);

      const result = await useControlNarrativesStore.getState().saveNarratives();

      expect(db.saveControlNarratives).toHaveBeenCalledWith(1, expect.any(Array));
      expect(result?.saved).toBe(1);
      expect(useControlNarrativesStore.getState().dirtyCount).toBe(0);
    });

    it('should not save if no dirty controls', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      await useControlNarrativesStore.getState().saveNarratives();

      expect(db.saveControlNarratives).not.toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'New text');
      vi.mocked(db.saveControlNarratives).mockRejectedValueOnce(new Error('Save failed'));

      await useControlNarrativesStore.getState().saveNarratives();

      expect(useControlNarrativesStore.getState().error).toBe('Save failed');
      expect(useControlNarrativesStore.getState().saving).toBe(false);
    });
  });

  describe('saveSingleControl', () => {
    it('should save single control', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'New text');
      vi.mocked(db.saveSingleControlNarrative).mockResolvedValueOnce(undefined);

      const result = await useControlNarrativesStore.getState().saveSingleControl('AC-2');

      expect(result.success).toBe(true);
      expect(useControlNarrativesStore.getState().dirtyIds.has('AC-2')).toBe(false);
    });

    it('should return error if no project selected', async () => {
      const result = await useControlNarrativesStore.getState().saveSingleControl('AC-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No project selected');
    });

    it('should return success if nothing to save', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      const result = await useControlNarrativesStore.getState().saveSingleControl('AC-2');

      expect(result.success).toBe(true);
      expect(db.saveSingleControlNarrative).not.toHaveBeenCalled();
    });
  });

  describe('getNarrativesForBaseline', () => {
    it('should return all items', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      const narratives = useControlNarrativesStore.getState().getNarrativesForBaseline();

      expect(narratives['AC-2']).toBeDefined();
      expect(narratives['SC-7']).toBeDefined();
    });
  });

  describe('autoPopulateFromTopology', () => {
    it('should auto-generate narratives from topology', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      const mockNodes = [
        { id: 'node-1', type: 'device', position: { x: 0, y: 0 }, data: { deviceType: 'firewall' } },
      ];

      await useControlNarrativesStore.getState().autoPopulateFromTopology(mockNodes as any, []);

      // SC-7 and others should be populated
      const state = useControlNarrativesStore.getState();
      expect(state.items['SC-7'].autoGenerated).toBe(true);
      expect(state.dirtyIds.has('SC-7')).toBe(true);
    });

    it('should set error if no nodes', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      await useControlNarrativesStore.getState().autoPopulateFromTopology([], []);

      expect(useControlNarrativesStore.getState().error).toBe(
        'Add devices to the topology before auto-populating narratives.'
      );
    });
  });

  describe('cancelGeneration', () => {
    it('should set cancel flag', () => {
      useControlNarrativesStore.getState().cancelGeneration();

      expect((useControlNarrativesStore.getState() as any)._cancelGeneration).toBe(true);
    });
  });

  describe('changeBaseline', () => {
    it('should change baseline and reload', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      vi.mocked(db.updateProjectBaseline).mockResolvedValueOnce(undefined);
      vi.mocked(getAllControlsWithBaselineFlags).mockResolvedValueOnce(mockControlCatalog);
      vi.mocked(db.loadControlNarratives).mockResolvedValueOnce([]);

      await useControlNarrativesStore.getState().changeBaseline('HIGH');

      expect(db.updateProjectBaseline).toHaveBeenCalledWith(1, 'HIGH');
    });

    it('should set error if no project selected', async () => {
      await useControlNarrativesStore.getState().changeBaseline('HIGH');

      expect(useControlNarrativesStore.getState().error).toBe(
        'A project must be selected before changing baseline.'
      );
    });

    it('should not reload if same baseline', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      vi.clearAllMocks();

      await useControlNarrativesStore.getState().changeBaseline('MODERATE');

      expect(db.updateProjectBaseline).not.toHaveBeenCalled();
    });
  });

  describe('Dirty State Tracking', () => {
    it('should track multiple dirty controls', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'Text 1');
      useControlNarrativesStore.getState().updateNarrative('SC-7', 'Text 2');

      const state = useControlNarrativesStore.getState();
      expect(state.dirtyCount).toBe(2);
      expect(state.dirtyIds.has('AC-2')).toBe(true);
      expect(state.dirtyIds.has('SC-7')).toBe(true);
    });

    it('should remove from dirty when cleared', async () => {
      await useControlNarrativesStore.getState().loadControls({
        baseline: 'MODERATE',
        projectId: 1,
      });

      useControlNarrativesStore.getState().updateNarrative('AC-2', 'Text');
      expect(useControlNarrativesStore.getState().dirtyIds.has('AC-2')).toBe(true);

      // Clear narrative
      useControlNarrativesStore.getState().updateNarrative('AC-2', '');
      expect(useControlNarrativesStore.getState().dirtyIds.has('AC-2')).toBe(false);
    });
  });
});
