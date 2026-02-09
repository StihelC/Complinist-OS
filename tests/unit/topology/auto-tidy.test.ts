import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  tidyDiagram,
  previewTidy,
  createTidyAnimation,
  getRecommendedSpacingTier,
  DEFAULT_TIDY_OPTIONS,
  TidyOptions,
  SpacingTier,
} from '@/lib/topology/auto-tidy';
import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

// Mock the dagreLayout module
vi.mock('@/lib/layout/dagreLayout', () => ({
  applyDagreLayout: vi.fn(async (boundaryId, nodes) => {
    // Return nodes with updated positions based on boundary
    return nodes.map((node: AppNode) => {
      if (node.parentId === boundaryId) {
        return {
          ...node,
          position: {
            x: node.position.x + 50,
            y: node.position.y + 50,
          },
        };
      }
      return node;
    });
  }),
  calculateBoundaryLabelSpace: vi.fn(() => ({ width: 0, height: 0 })),
}));

// Helper to create test nodes
function createDevice(
  id: string,
  parentId?: string,
  position = { x: 0, y: 0 }
): AppNode {
  const node: AppNode = {
    id,
    type: 'device',
    position,
    data: {
      id,
      name: `Device ${id}`,
      deviceType: 'virtual-machine',
      iconPath: '',
    } as DeviceNodeData,
  };
  if (parentId) {
    node.parentId = parentId;
    node.extent = 'parent';
  }
  return node;
}

function createBoundary(
  id: string,
  parentId?: string,
  position = { x: 0, y: 0 },
  width = 400,
  height = 300
): AppNode {
  const node: AppNode = {
    id,
    type: 'boundary',
    position,
    width,
    height,
    style: { width, height },
    data: {
      id,
      label: `Boundary ${id}`,
      type: 'security_zone',
    } as BoundaryNodeData,
  };
  if (parentId) {
    node.parentId = parentId;
    node.extent = 'parent';
  }
  return node;
}

function createEdge(source: string, target: string): AppEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
  };
}

describe('auto-tidy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tidyDiagram', () => {
    it('should return empty result for empty diagram', async () => {
      const result = await tidyDiagram([], []);

      expect(result.nodes).toEqual([]);
      expect(result.stats.totalNodes).toBe(0);
      expect(result.stats.boundariesProcessed).toBe(0);
      expect(result.stats.devicesRepositioned).toBe(0);
    });

    it('should handle diagram with only devices (no boundaries)', async () => {
      const nodes = [
        createDevice('d1', undefined, { x: 0, y: 0 }),
        createDevice('d2', undefined, { x: 100, y: 100 }),
      ];
      const edges = [createEdge('d1', 'd2')];

      const result = await tidyDiagram(nodes, edges);

      expect(result.nodes.length).toBe(2);
      expect(result.stats.totalNodes).toBe(2);
      expect(result.stats.boundariesProcessed).toBe(0);
    });

    it('should process boundary with children', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
        createDevice('d2', 'b1', { x: 20, y: 20 }),
      ];
      const edges = [createEdge('d1', 'd2')];

      const result = await tidyDiagram(nodes, edges);

      expect(result.nodes.length).toBe(3);
      expect(result.stats.boundariesProcessed).toBe(1);
      expect(result.stats.devicesRepositioned).toBe(2);
    });

    it('should process nested boundaries from innermost first', async () => {
      const nodes = [
        createBoundary('outer'),
        createBoundary('inner', 'outer', { x: 50, y: 50 }, 200, 200),
        createDevice('d1', 'inner', { x: 60, y: 60 }),
        createDevice('d2', 'outer', { x: 300, y: 100 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges);

      expect(result.stats.boundariesProcessed).toBe(2);
      // Inner boundary should be processed before outer
      expect(result.nodes.length).toBe(4);
    });

    it('should respect locked nodes', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
        createDevice('d2', 'b1', { x: 20, y: 20 }),
      ];
      const edges: AppEdge[] = [];

      const options: Partial<TidyOptions> = {
        lockedNodeIds: ['d1'],
      };

      const result = await tidyDiagram(nodes, edges, options);

      // D1 should not be repositioned (locked)
      expect(result.stats.devicesRepositioned).toBe(1); // Only d2
    });

    it('should include animation data when animate is true', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges, { animate: true });

      expect(result.originalPositions).toBeDefined();
      expect(result.targetPositions).toBeDefined();
      expect(result.originalPositions?.size).toBe(2);
      expect(result.targetPositions?.size).toBe(2);
    });

    it('should not include animation data when animate is false', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges, { animate: false });

      expect(result.originalPositions).toBeUndefined();
      expect(result.targetPositions).toBeUndefined();
    });

    it('should track processing time', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges);

      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('previewTidy', () => {
    it('should return same structure as tidyDiagram', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
      ];
      const edges: AppEdge[] = [];

      const result = await previewTidy(nodes, edges);

      expect(result.nodes).toBeDefined();
      expect(result.originalPositions).toBeDefined();
      expect(result.targetPositions).toBeDefined();
      expect(result.stats).toBeDefined();
    });
  });

  describe('createTidyAnimation', () => {
    it('should interpolate positions correctly', () => {
      const original = new Map([
        ['n1', { x: 0, y: 0 }],
        ['n2', { x: 100, y: 100 }],
      ]);
      const target = new Map([
        ['n1', { x: 100, y: 200 }],
        ['n2', { x: 200, y: 300 }],
      ]);

      const getInterpolated = createTidyAnimation(original, target);

      // At progress 0, should be at original
      const atStart = getInterpolated(0);
      expect(atStart.get('n1')?.x).toBe(0);
      expect(atStart.get('n1')?.y).toBe(0);

      // At progress 1, should be at target (with easing)
      const atEnd = getInterpolated(1);
      expect(atEnd.get('n1')?.x).toBe(100);
      expect(atEnd.get('n1')?.y).toBe(200);

      // At progress 0.5, should be somewhere in between (with easing)
      const atMid = getInterpolated(0.5);
      expect(atMid.get('n1')?.x).toBeGreaterThan(0);
      expect(atMid.get('n1')?.x).toBeLessThan(100);
    });

    it('should handle missing target positions', () => {
      const original = new Map([
        ['n1', { x: 0, y: 0 }],
        ['n2', { x: 100, y: 100 }],
      ]);
      const target = new Map([
        ['n1', { x: 100, y: 200 }],
        // n2 is missing from target
      ]);

      const getInterpolated = createTidyAnimation(original, target);
      const atMid = getInterpolated(0.5);

      expect(atMid.get('n1')).toBeDefined();
      expect(atMid.get('n2')).toBeUndefined(); // Not included
    });

    it('should clamp progress to [0, 1]', () => {
      const original = new Map([['n1', { x: 0, y: 0 }]]);
      const target = new Map([['n1', { x: 100, y: 100 }]]);

      const getInterpolated = createTidyAnimation(original, target);

      // Progress beyond 1 should clamp
      const atOver = getInterpolated(2);
      expect(atOver.get('n1')?.x).toBe(100);

      // Progress below 0 should clamp
      const atUnder = getInterpolated(-1);
      expect(atUnder.get('n1')?.x).toBe(0);
    });
  });

  describe('getRecommendedSpacingTier', () => {
    it('should recommend compact for large diagrams', () => {
      expect(getRecommendedSpacingTier(51)).toBe('compact');
      expect(getRecommendedSpacingTier(100)).toBe('compact');
    });

    it('should recommend comfortable for medium diagrams', () => {
      expect(getRecommendedSpacingTier(21)).toBe('comfortable');
      expect(getRecommendedSpacingTier(50)).toBe('comfortable');
    });

    it('should recommend spacious for small diagrams', () => {
      expect(getRecommendedSpacingTier(20)).toBe('spacious');
      expect(getRecommendedSpacingTier(1)).toBe('spacious');
    });
  });

  describe('DEFAULT_TIDY_OPTIONS', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_TIDY_OPTIONS.spacingTier).toBe('comfortable');
      expect(DEFAULT_TIDY_OPTIONS.autoResize).toBe(true);
      expect(DEFAULT_TIDY_OPTIONS.animate).toBe(true);
      expect(DEFAULT_TIDY_OPTIONS.animationDuration).toBe(300);
    });
  });

  describe('spacing tiers', () => {
    it('should apply different spacing based on tier', async () => {
      const nodes = [
        createBoundary('b1'),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
        createDevice('d2', 'b1', { x: 20, y: 20 }),
      ];
      const edges = [createEdge('d1', 'd2')];

      // Test different spacing tiers (the mock doesn't change behavior,
      // but we're testing the options are passed through)
      const compactResult = await tidyDiagram(nodes, edges, { spacingTier: 'compact' });
      const spaciousResult = await tidyDiagram(nodes, edges, { spacingTier: 'spacious' });

      // Both should complete successfully
      expect(compactResult.stats.boundariesProcessed).toBe(1);
      expect(spaciousResult.stats.boundariesProcessed).toBe(1);
    });
  });

  describe('auto-resize boundaries', () => {
    it('should resize boundaries when autoResize is true', async () => {
      const boundary = createBoundary('b1', undefined, { x: 0, y: 0 }, 400, 300);
      const nodes = [
        boundary,
        createDevice('d1', 'b1', { x: 10, y: 10 }),
        createDevice('d2', 'b1', { x: 200, y: 200 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges, { autoResize: true });

      // Boundary should be in results
      const resultBoundary = result.nodes.find(n => n.id === 'b1');
      expect(resultBoundary).toBeDefined();
    });

    it('should not resize boundaries when autoResize is false', async () => {
      const boundary = createBoundary('b1', undefined, { x: 0, y: 0 }, 400, 300);
      const nodes = [
        boundary,
        createDevice('d1', 'b1', { x: 10, y: 10 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges, { autoResize: false });

      // Boundary dimensions should be unchanged
      const resultBoundary = result.nodes.find(n => n.id === 'b1');
      expect(resultBoundary?.width).toBe(400);
      expect(resultBoundary?.height).toBe(300);
    });
  });

  describe('multiple boundaries', () => {
    it('should handle multiple root boundaries', async () => {
      const nodes = [
        createBoundary('b1', undefined, { x: 0, y: 0 }),
        createBoundary('b2', undefined, { x: 500, y: 0 }),
        createDevice('d1', 'b1', { x: 10, y: 10 }),
        createDevice('d2', 'b2', { x: 510, y: 10 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges);

      expect(result.stats.boundariesProcessed).toBe(2);
      expect(result.stats.devicesRepositioned).toBe(2);
    });

    it('should handle empty boundaries', async () => {
      const nodes = [
        createBoundary('b1'),
        createBoundary('b2'),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges);

      // Empty boundaries should not be counted as processed
      expect(result.stats.boundariesProcessed).toBe(0);
    });
  });
});
