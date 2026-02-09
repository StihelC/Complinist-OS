/**
 * Tests for the Dynamic Spacing Calculation System
 *
 * Tests cover:
 * - Edge density calculation
 * - Density adjustment factors
 * - Spacing calculations for all tiers
 * - Various node counts and edge densities
 * - Edge cases (empty graphs, single nodes, etc.)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEdgeDensity,
  getDensityAdjustmentFactor,
  calculateOptimalSpacing,
  calculateOptimalSpacingWithConfig,
  isValidSpacingTier,
  getSpacingTier,
  createSpacingConfig,
  SPACING_TIER_MULTIPLIERS,
  DENSITY_THRESHOLDS,
  DENSITY_ADJUSTMENTS,
  DEFAULT_BASE_SPACING,
  type SpacingTier,
  type OptimalSpacing,
} from '@/lib/topology/spacing-algorithm';
import type { Node, Edge } from '@xyflow/react';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock node for testing.
 */
function createMockNode(id: string): Node {
  return {
    id,
    type: 'device',
    position: { x: 0, y: 0 },
    data: { id, name: `Node-${id}` },
  };
}

/**
 * Creates a mock edge for testing.
 */
function createMockEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  };
}

/**
 * Creates an array of mock nodes.
 */
function createNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => createMockNode(`node-${i + 1}`));
}

/**
 * Creates edges to form a complete graph (every node connected to every other).
 */
function createCompleteGraphEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      edges.push(createMockEdge(nodes[i].id, nodes[j].id));
    }
  }
  return edges;
}

/**
 * Creates edges to form a linear chain (each node connected to the next).
 */
function createLinearEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push(createMockEdge(nodes[i].id, nodes[i + 1].id));
  }
  return edges;
}

// =============================================================================
// Edge Density Tests
// =============================================================================

describe('calculateEdgeDensity', () => {
  describe('edge cases', () => {
    it('should return 0 for empty graph (0 nodes)', () => {
      const density = calculateEdgeDensity(0, 0);
      expect(density).toBe(0);
    });

    it('should return 0 for single node', () => {
      const density = calculateEdgeDensity(1, 0);
      expect(density).toBe(0);
    });

    it('should return 0 for two nodes with no edges', () => {
      const density = calculateEdgeDensity(2, 0);
      expect(density).toBe(0);
    });
  });

  describe('complete graphs', () => {
    it('should return 1 for complete graph with 2 nodes', () => {
      // 2 nodes: max edges = 1, actual edges = 1
      const density = calculateEdgeDensity(2, 1);
      expect(density).toBe(1);
    });

    it('should return 1 for complete graph with 3 nodes', () => {
      // 3 nodes: max edges = 3, actual edges = 3
      const density = calculateEdgeDensity(3, 3);
      expect(density).toBe(1);
    });

    it('should return 1 for complete graph with 4 nodes', () => {
      // 4 nodes: max edges = 6, actual edges = 6
      const density = calculateEdgeDensity(4, 6);
      expect(density).toBe(1);
    });

    it('should return 1 for complete graph with 5 nodes', () => {
      // 5 nodes: max edges = 10, actual edges = 10
      const density = calculateEdgeDensity(5, 10);
      expect(density).toBe(1);
    });
  });

  describe('partial graphs', () => {
    it('should return 0.5 for half-connected 4-node graph', () => {
      // 4 nodes: max edges = 6, actual edges = 3
      const density = calculateEdgeDensity(4, 3);
      expect(density).toBe(0.5);
    });

    it('should return correct density for linear graph', () => {
      // 5 nodes: max edges = 10, linear = 4 edges
      const density = calculateEdgeDensity(5, 4);
      expect(density).toBe(0.4);
    });

    it('should return correct density for sparse graph', () => {
      // 10 nodes: max edges = 45, actual = 5
      const density = calculateEdgeDensity(10, 5);
      expect(density).toBeCloseTo(0.111, 2);
    });
  });

  describe('multigraphs (density > 1)', () => {
    it('should handle density greater than 1 for multigraphs', () => {
      // 3 nodes with more edges than a complete graph would have
      // max edges = 3, actual = 6 (parallel edges)
      const density = calculateEdgeDensity(3, 6);
      expect(density).toBe(2);
    });
  });
});

// =============================================================================
// Density Adjustment Factor Tests
// =============================================================================

describe('getDensityAdjustmentFactor', () => {
  describe('high density (> 0.5)', () => {
    it('should return 0.8 for density of 0.6', () => {
      const factor = getDensityAdjustmentFactor(0.6);
      expect(factor).toBe(DENSITY_ADJUSTMENTS.HIGH_DENSITY_FACTOR);
      expect(factor).toBe(0.8);
    });

    it('should return 0.8 for density of 1.0', () => {
      const factor = getDensityAdjustmentFactor(1.0);
      expect(factor).toBe(0.8);
    });

    it('should return 0.8 for density of 0.51', () => {
      const factor = getDensityAdjustmentFactor(0.51);
      expect(factor).toBe(0.8);
    });
  });

  describe('low density (< 0.2)', () => {
    it('should return 1.15 for density of 0.1', () => {
      const factor = getDensityAdjustmentFactor(0.1);
      expect(factor).toBe(DENSITY_ADJUSTMENTS.LOW_DENSITY_FACTOR);
      expect(factor).toBe(1.15);
    });

    it('should return 1.15 for density of 0', () => {
      const factor = getDensityAdjustmentFactor(0);
      expect(factor).toBe(1.15);
    });

    it('should return 1.15 for density of 0.19', () => {
      const factor = getDensityAdjustmentFactor(0.19);
      expect(factor).toBe(1.15);
    });
  });

  describe('normal density (0.2 - 0.5)', () => {
    it('should return 1.0 for density of 0.2', () => {
      const factor = getDensityAdjustmentFactor(0.2);
      expect(factor).toBe(1.0);
    });

    it('should return 1.0 for density of 0.35', () => {
      const factor = getDensityAdjustmentFactor(0.35);
      expect(factor).toBe(1.0);
    });

    it('should return 1.0 for density of 0.5', () => {
      const factor = getDensityAdjustmentFactor(0.5);
      expect(factor).toBe(1.0);
    });
  });

  describe('boundary values', () => {
    it('should return 1.0 at exactly HIGH threshold (0.5)', () => {
      const factor = getDensityAdjustmentFactor(DENSITY_THRESHOLDS.HIGH);
      expect(factor).toBe(1.0);
    });

    it('should return 1.0 at exactly LOW threshold (0.2)', () => {
      const factor = getDensityAdjustmentFactor(DENSITY_THRESHOLDS.LOW);
      expect(factor).toBe(1.0);
    });
  });
});

// =============================================================================
// Spacing Tier Multipliers Tests
// =============================================================================

describe('SPACING_TIER_MULTIPLIERS', () => {
  it('should have correct compact tier multipliers', () => {
    expect(SPACING_TIER_MULTIPLIERS.compact).toEqual({
      nodesep: 2.0,
      ranksep: 2.5,
      edgesep: 0.4,
    });
  });

  it('should have correct comfortable tier multipliers', () => {
    expect(SPACING_TIER_MULTIPLIERS.comfortable).toEqual({
      nodesep: 2.6,
      ranksep: 3.5,
      edgesep: 0.6,
    });
  });

  it('should have correct spacious tier multipliers', () => {
    expect(SPACING_TIER_MULTIPLIERS.spacious).toEqual({
      nodesep: 3.5,
      ranksep: 5.0,
      edgesep: 0.8,
    });
  });

  it('should have increasing spacing from compact to spacious', () => {
    const { compact, comfortable, spacious } = SPACING_TIER_MULTIPLIERS;

    // nodesep should increase
    expect(compact.nodesep).toBeLessThan(comfortable.nodesep);
    expect(comfortable.nodesep).toBeLessThan(spacious.nodesep);

    // ranksep should increase
    expect(compact.ranksep).toBeLessThan(comfortable.ranksep);
    expect(comfortable.ranksep).toBeLessThan(spacious.ranksep);

    // edgesep should increase
    expect(compact.edgesep).toBeLessThan(comfortable.edgesep);
    expect(comfortable.edgesep).toBeLessThan(spacious.edgesep);
  });
});

// =============================================================================
// calculateOptimalSpacing Tests
// =============================================================================

describe('calculateOptimalSpacing', () => {
  describe('with default parameters', () => {
    it('should use comfortable tier by default', () => {
      const nodes = createNodes(5);
      const edges = createLinearEdges(nodes);

      const spacing = calculateOptimalSpacing(nodes, edges);

      // Default base spacing = DEFAULT_BASE_SPACING, comfortable multipliers
      // With normal density (0.4 for 5 nodes, 4 edges), no adjustment
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 3.5));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.6));
    });

    it('should use DEFAULT_BASE_SPACING by default', () => {
      const nodes = createNodes(3);
      const edges = createLinearEdges(nodes);

      const spacing = calculateOptimalSpacing(nodes, edges);

      expect(DEFAULT_BASE_SPACING).toBe(38);
      // 2 edges for 3 nodes = 2/3 = 0.67 density (high)
      // Base values with high density adjustment (0.8)
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6 * 0.8));
    });
  });

  describe('with empty graph', () => {
    it('should return valid spacing for empty nodes array', () => {
      const spacing = calculateOptimalSpacing([], []);

      // Empty graph has 0 density (low), so 1.15 adjustment
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6 * 1.15));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 3.5 * 1.15));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.6 * 1.15));
    });
  });

  describe('compact tier', () => {
    it('should calculate correct spacing for compact tier', () => {
      const nodes = createNodes(4);
      const edges = createLinearEdges(nodes); // 3 edges, density = 0.5

      const spacing = calculateOptimalSpacing(nodes, edges, 'compact');

      // Normal density (0.5), no adjustment
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.0));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.5));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.4));
    });

    it('should apply high density adjustment for compact tier', () => {
      const nodes = createNodes(3);
      const edges = createCompleteGraphEdges(nodes); // 3 edges, density = 1.0

      const spacing = calculateOptimalSpacing(nodes, edges, 'compact');

      // High density, 0.8 adjustment
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.0 * 0.8));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.5 * 0.8));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.4 * 0.8));
    });
  });

  describe('comfortable tier', () => {
    it('should calculate correct spacing for comfortable tier', () => {
      const nodes = createNodes(4);
      const edges = createLinearEdges(nodes); // 3 edges, density = 0.5

      const spacing = calculateOptimalSpacing(nodes, edges, 'comfortable');

      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 3.5));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.6));
    });
  });

  describe('spacious tier', () => {
    it('should calculate correct spacing for spacious tier', () => {
      const nodes = createNodes(4);
      const edges = createLinearEdges(nodes); // 3 edges, density = 0.5

      const spacing = calculateOptimalSpacing(nodes, edges, 'spacious');

      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 3.5));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 5.0));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.8));
    });

    it('should apply low density adjustment for spacious tier', () => {
      const nodes = createNodes(10);
      const edges: Edge[] = [createMockEdge('node-1', 'node-2')]; // 1 edge, density = 0.022

      const spacing = calculateOptimalSpacing(nodes, edges, 'spacious');

      // Low density, 1.15 adjustment
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 3.5 * 1.15));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 5.0 * 1.15));
      expect(spacing.edgesep).toBe(Math.round(DEFAULT_BASE_SPACING * 0.8 * 1.15));
    });
  });

  describe('custom base spacing', () => {
    it('should use custom base spacing of 100', () => {
      const nodes = createNodes(4);
      const edges = createLinearEdges(nodes);

      const spacing = calculateOptimalSpacing(nodes, edges, 'comfortable', 100);

      expect(spacing.nodesep).toBe(Math.round(100 * 2.6));
      expect(spacing.ranksep).toBe(Math.round(100 * 3.5));
      expect(spacing.edgesep).toBe(Math.round(100 * 0.6));
    });

    it('should use custom base spacing of 50', () => {
      const nodes = createNodes(4);
      const edges = createLinearEdges(nodes);

      const spacing = calculateOptimalSpacing(nodes, edges, 'compact', 50);

      expect(spacing.nodesep).toBe(Math.round(50 * 2.0));
      expect(spacing.ranksep).toBe(Math.round(50 * 2.5));
      expect(spacing.edgesep).toBe(Math.round(50 * 0.4));
    });
  });

  describe('density-based adjustments', () => {
    it('should reduce spacing for high-density graphs', () => {
      const nodes = createNodes(4);
      const completeEdges = createCompleteGraphEdges(nodes); // 6 edges, density = 1.0

      const highDensitySpacing = calculateOptimalSpacing(nodes, completeEdges, 'comfortable');

      // Compare with normal density
      const linearEdges = createLinearEdges(nodes); // 3 edges, density = 0.5
      const normalDensitySpacing = calculateOptimalSpacing(nodes, linearEdges, 'comfortable');

      expect(highDensitySpacing.nodesep).toBeLessThan(normalDensitySpacing.nodesep);
      expect(highDensitySpacing.ranksep).toBeLessThan(normalDensitySpacing.ranksep);
    });

    it('should increase spacing for low-density graphs', () => {
      const nodes = createNodes(10);
      const fewEdges = [createMockEdge('node-1', 'node-2')]; // Very sparse

      const lowDensitySpacing = calculateOptimalSpacing(nodes, fewEdges, 'comfortable');

      // Compare with normal density
      const nodes4 = createNodes(4);
      const normalEdges = createLinearEdges(nodes4); // density = 0.5
      const normalDensitySpacing = calculateOptimalSpacing(nodes4, normalEdges, 'comfortable');

      expect(lowDensitySpacing.nodesep).toBeGreaterThan(normalDensitySpacing.nodesep);
    });
  });

  describe('return value structure', () => {
    it('should return OptimalSpacing object with all required properties', () => {
      const spacing = calculateOptimalSpacing([], []);

      expect(spacing).toHaveProperty('nodesep');
      expect(spacing).toHaveProperty('ranksep');
      expect(spacing).toHaveProperty('edgesep');
      expect(typeof spacing.nodesep).toBe('number');
      expect(typeof spacing.ranksep).toBe('number');
      expect(typeof spacing.edgesep).toBe('number');
    });

    it('should return rounded integer values', () => {
      const nodes = createNodes(5);
      const edges = createLinearEdges(nodes);

      const spacing = calculateOptimalSpacing(nodes, edges);

      expect(Number.isInteger(spacing.nodesep)).toBe(true);
      expect(Number.isInteger(spacing.ranksep)).toBe(true);
      expect(Number.isInteger(spacing.edgesep)).toBe(true);
    });
  });
});

// =============================================================================
// calculateOptimalSpacingWithConfig Tests
// =============================================================================

describe('calculateOptimalSpacingWithConfig', () => {
  it('should work with empty config (uses defaults)', () => {
    const nodes = createNodes(4);
    const edges = createLinearEdges(nodes);

    const spacingWithConfig = calculateOptimalSpacingWithConfig(nodes, edges, {});
    const spacingDirect = calculateOptimalSpacing(nodes, edges, 'comfortable', DEFAULT_BASE_SPACING);

    expect(spacingWithConfig).toEqual(spacingDirect);
  });

  it('should accept tier in config', () => {
    const nodes = createNodes(4);
    const edges = createLinearEdges(nodes);

    const spacing = calculateOptimalSpacingWithConfig(nodes, edges, { tier: 'spacious' });
    const expected = calculateOptimalSpacing(nodes, edges, 'spacious', DEFAULT_BASE_SPACING);

    expect(spacing).toEqual(expected);
  });

  it('should accept baseSpacing in config', () => {
    const nodes = createNodes(4);
    const edges = createLinearEdges(nodes);

    const spacing = calculateOptimalSpacingWithConfig(nodes, edges, { baseSpacing: 100 });
    const expected = calculateOptimalSpacing(nodes, edges, 'comfortable', 100);

    expect(spacing).toEqual(expected);
  });

  it('should accept both tier and baseSpacing in config', () => {
    const nodes = createNodes(4);
    const edges = createLinearEdges(nodes);

    const spacing = calculateOptimalSpacingWithConfig(nodes, edges, {
      tier: 'compact',
      baseSpacing: 50,
    });
    const expected = calculateOptimalSpacing(nodes, edges, 'compact', 50);

    expect(spacing).toEqual(expected);
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('isValidSpacingTier', () => {
  it('should return true for valid tiers', () => {
    expect(isValidSpacingTier('compact')).toBe(true);
    expect(isValidSpacingTier('comfortable')).toBe(true);
    expect(isValidSpacingTier('spacious')).toBe(true);
  });

  it('should return false for invalid tiers', () => {
    expect(isValidSpacingTier('invalid')).toBe(false);
    expect(isValidSpacingTier('')).toBe(false);
    expect(isValidSpacingTier(null)).toBe(false);
    expect(isValidSpacingTier(undefined)).toBe(false);
    expect(isValidSpacingTier(123)).toBe(false);
    expect(isValidSpacingTier({})).toBe(false);
  });
});

describe('getSpacingTier', () => {
  it('should return valid tiers as-is', () => {
    expect(getSpacingTier('compact')).toBe('compact');
    expect(getSpacingTier('comfortable')).toBe('comfortable');
    expect(getSpacingTier('spacious')).toBe('spacious');
  });

  it('should return comfortable for invalid values', () => {
    expect(getSpacingTier('invalid')).toBe('comfortable');
    expect(getSpacingTier('')).toBe('comfortable');
    expect(getSpacingTier(null)).toBe('comfortable');
    expect(getSpacingTier(undefined)).toBe('comfortable');
  });
});

describe('createSpacingConfig', () => {
  it('should create config with defaults', () => {
    const config = createSpacingConfig();

    expect(config.tier).toBe('comfortable');
    expect(config.baseSpacing).toBe(DEFAULT_BASE_SPACING);
  });

  it('should create config with custom tier', () => {
    const config = createSpacingConfig('compact');

    expect(config.tier).toBe('compact');
    expect(config.baseSpacing).toBe(DEFAULT_BASE_SPACING);
  });

  it('should create config with custom values', () => {
    const config = createSpacingConfig('spacious', 100);

    expect(config.tier).toBe('spacious');
    expect(config.baseSpacing).toBe(100);
  });
});

// =============================================================================
// Integration-style Tests (Realistic Scenarios)
// =============================================================================

describe('realistic scenarios', () => {
  describe('small diagram (3-5 nodes)', () => {
    it('should produce appropriate spacing for small well-connected diagram', () => {
      const nodes = createNodes(4);
      const edges = createCompleteGraphEdges(nodes); // Fully connected

      const spacing = calculateOptimalSpacing(nodes, edges, 'comfortable');

      // Should have reduced spacing due to high density
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6 * 0.8));
      expect(spacing.ranksep).toBe(Math.round(DEFAULT_BASE_SPACING * 3.5 * 0.8));
    });
  });

  describe('medium diagram (10-20 nodes)', () => {
    it('should handle linear topology efficiently', () => {
      const nodes = createNodes(15);
      const edges = createLinearEdges(nodes); // 14 edges

      // Density = 14 / (15 * 14 / 2) = 14 / 105 = 0.133 (low)
      const spacing = calculateOptimalSpacing(nodes, edges, 'comfortable');

      // Should have increased spacing due to low density
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6 * 1.15));
    });
  });

  describe('large diagram (50+ nodes)', () => {
    it('should scale appropriately for large sparse graphs', () => {
      const nodes = createNodes(50);
      const edges = createLinearEdges(nodes); // 49 edges

      // Density = 49 / (50 * 49 / 2) = 49 / 1225 = 0.04 (very low)
      const spacing = calculateOptimalSpacing(nodes, edges, 'comfortable');

      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6 * 1.15));
    });

    it('should handle moderately connected large graphs', () => {
      const nodes = createNodes(50);
      // Create edges to achieve ~0.3 density
      // Max edges = 1225, target ~368 edges
      const edges: Edge[] = [];
      for (let i = 0; i < 50; i++) {
        for (let j = i + 1; j < Math.min(i + 8, 50); j++) {
          edges.push(createMockEdge(`node-${i + 1}`, `node-${j + 1}`));
        }
      }

      const spacing = calculateOptimalSpacing(nodes, edges, 'comfortable');

      // Should be in normal density range, no adjustment
      expect(spacing.nodesep).toBe(Math.round(DEFAULT_BASE_SPACING * 2.6));
    });
  });

  describe('presentation vs work modes', () => {
    it('spacious tier should provide significantly more space than compact', () => {
      const nodes = createNodes(10);
      const edges = createLinearEdges(nodes);

      const compactSpacing = calculateOptimalSpacing(nodes, edges, 'compact');
      const spaciousSpacing = calculateOptimalSpacing(nodes, edges, 'spacious');

      // Spacious should be roughly 75% larger than compact
      expect(spaciousSpacing.nodesep).toBeGreaterThan(compactSpacing.nodesep * 1.5);
      expect(spaciousSpacing.ranksep).toBeGreaterThan(compactSpacing.ranksep * 1.5);
    });
  });
});
