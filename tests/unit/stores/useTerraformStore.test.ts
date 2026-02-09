import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTerraformStore } from '@/core/stores/useTerraformStore';

// Mock the terraform utilities
vi.mock('@/lib/terraform/planParser', () => ({
  parseTerraformPlan: vi.fn((jsonString: string) => {
    const plan = JSON.parse(jsonString);
    return {
      format_version: plan.format_version || '1.0',
      terraform_version: plan.terraform_version || '1.5.0',
      planned_values: plan.planned_values || { root_module: { resources: [] } },
      resource_changes: plan.resource_changes || [],
      configuration: plan.configuration || {},
    };
  }),
}));

vi.mock('@/lib/terraform/dependencyAnalyzer', () => ({
  analyzeDependencies: vi.fn(() => new Map()),
}));

vi.mock('@/lib/terraform/stateConverter', () => ({
  convertTerraformPlanToNodes: vi.fn(() => ({
    nodes: [
      { id: 'node-1', type: 'resource', position: { x: 0, y: 0 }, data: { label: 'aws_instance.web' } },
      { id: 'node-2', type: 'resource', position: { x: 100, y: 0 }, data: { label: 'aws_vpc.main' } },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ],
  })),
  convertTerraformPlanToNodesAsync: vi.fn(async () => ({
    nodes: [
      { id: 'node-1', type: 'resource', position: { x: 0, y: 0 }, data: { label: 'aws_instance.web' } },
      { id: 'node-2', type: 'resource', position: { x: 100, y: 0 }, data: { label: 'aws_vpc.main' } },
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2' },
    ],
  })),
}));

describe('useTerraformStore', () => {
  const mockPlan = {
    format_version: '1.0',
    terraform_version: '1.5.0',
    planned_values: {
      root_module: {
        resources: [
          {
            address: 'aws_instance.web',
            type: 'aws_instance',
            name: 'web',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            values: {
              instance_type: 't3.micro',
              ami: 'ami-12345678',
            },
          },
        ],
      },
    },
    resource_changes: [],
    configuration: {},
  };

  beforeEach(() => {
    // Reset store to initial state
    useTerraformStore.setState({
      currentPlan: null,
      beforeState: null,
      afterState: null,
      viewMode: 'diff',
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useTerraformStore.getState();
      expect(state.currentPlan).toBeNull();
      expect(state.beforeState).toBeNull();
      expect(state.afterState).toBeNull();
      expect(state.viewMode).toBe('diff');
    });
  });

  describe('loadTerraformPlan', () => {
    it('should load and parse Terraform plan', async () => {
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));

      const state = useTerraformStore.getState();
      expect(state.currentPlan).toBeDefined();
      expect(state.afterState).toBeDefined();
      expect(state.afterState?.nodes).toHaveLength(2);
      expect(state.afterState?.edges).toHaveLength(1);
    });

    it('should convert plan to nodes and edges', async () => {
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));

      const state = useTerraformStore.getState();
      expect(state.afterState?.nodes[0].data.label).toBe('aws_instance.web');
      expect(state.afterState?.nodes[1].data.label).toBe('aws_vpc.main');
    });

    it('should handle empty plan', async () => {
      const emptyPlan = {
        format_version: '1.0',
        terraform_version: '1.5.0',
        planned_values: { root_module: { resources: [] } },
        resource_changes: [],
        configuration: {},
      };

      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(emptyPlan));

      const state = useTerraformStore.getState();
      expect(state.currentPlan).toBeDefined();
    });

    it('should maintain plan reference', async () => {
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));

      const state = useTerraformStore.getState();
      expect(state.currentPlan?.terraform_version).toBe('1.5.0');
    });
  });

  describe('setViewMode', () => {
    it('should change to before view', () => {
      useTerraformStore.getState().setViewMode('before');
      expect(useTerraformStore.getState().viewMode).toBe('before');
    });

    it('should change to after view', () => {
      useTerraformStore.getState().setViewMode('after');
      expect(useTerraformStore.getState().viewMode).toBe('after');
    });

    it('should change to diff view', () => {
      useTerraformStore.getState().setViewMode('diff');
      expect(useTerraformStore.getState().viewMode).toBe('diff');
    });

    it('should change to side-by-side view', () => {
      useTerraformStore.getState().setViewMode('side-by-side');
      expect(useTerraformStore.getState().viewMode).toBe('side-by-side');
    });

    it('should persist view mode through state changes', async () => {
      useTerraformStore.getState().setViewMode('side-by-side');
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));

      // View mode should not be affected by loading a plan
      expect(useTerraformStore.getState().viewMode).toBe('side-by-side');
    });
  });

  describe('State Reset', () => {
    it('should reset all state when setting state manually', async () => {
      // First load a plan
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));
      useTerraformStore.getState().setViewMode('after');

      // Reset state
      useTerraformStore.setState({
        currentPlan: null,
        beforeState: null,
        afterState: null,
        viewMode: 'diff',
      });

      const state = useTerraformStore.getState();
      expect(state.currentPlan).toBeNull();
      expect(state.beforeState).toBeNull();
      expect(state.afterState).toBeNull();
      expect(state.viewMode).toBe('diff');
    });
  });

  describe('Plan Loading Sequence', () => {
    it('should handle multiple plan loads', async () => {
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));
      const firstPlan = useTerraformStore.getState().currentPlan;

      const secondPlan = { ...mockPlan, terraform_version: '1.6.0' };
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(secondPlan));

      expect(useTerraformStore.getState().currentPlan?.terraform_version).toBe('1.6.0');
      expect(useTerraformStore.getState().currentPlan).not.toBe(firstPlan);
    });
  });

  describe('View Mode Transitions', () => {
    it('should cycle through all view modes', () => {
      const modes: Array<'before' | 'after' | 'diff' | 'side-by-side'> = [
        'before',
        'after',
        'diff',
        'side-by-side',
      ];

      modes.forEach((mode) => {
        useTerraformStore.getState().setViewMode(mode);
        expect(useTerraformStore.getState().viewMode).toBe(mode);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle plan with complex nested values', async () => {
      const complexPlan = {
        ...mockPlan,
        planned_values: {
          root_module: {
            resources: [
              {
                address: 'aws_instance.web',
                type: 'aws_instance',
                values: {
                  tags: { Name: 'Test', Environment: 'dev' },
                  root_block_device: [{ volume_size: 100 }],
                },
              },
            ],
            child_modules: [
              {
                address: 'module.vpc',
                resources: [],
              },
            ],
          },
        },
      };

      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(complexPlan));
      expect(useTerraformStore.getState().currentPlan).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      await expect(async () => {
        await useTerraformStore.getState().loadTerraformPlan('not valid json');
      }).rejects.toThrow();
    });
  });

  describe('Store Integration', () => {
    it('should maintain state consistency across operations', async () => {
      // Initial state
      expect(useTerraformStore.getState().currentPlan).toBeNull();

      // Load plan
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(mockPlan));
      expect(useTerraformStore.getState().currentPlan).toBeDefined();
      expect(useTerraformStore.getState().afterState).toBeDefined();

      // Change view mode
      useTerraformStore.getState().setViewMode('before');
      expect(useTerraformStore.getState().viewMode).toBe('before');
      expect(useTerraformStore.getState().currentPlan).toBeDefined(); // Plan should persist

      // Load another plan
      const newPlan = { ...mockPlan, terraform_version: '2.0.0' };
      await useTerraformStore.getState().loadTerraformPlan(JSON.stringify(newPlan));
      expect(useTerraformStore.getState().currentPlan?.terraform_version).toBe('2.0.0');
      expect(useTerraformStore.getState().viewMode).toBe('before'); // View mode preserved
    });
  });
});
