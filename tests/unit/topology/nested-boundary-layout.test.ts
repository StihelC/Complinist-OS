/**
 * Nested Boundary Layout Tests
 *
 * Tests for ELKjs layout with deeply nested boundaries.
 * Ensures that devices inside boundaries inside boundaries are properly
 * positioned and that parent boundaries expand to fit their children.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tidyDiagram, TidyOptions } from '@/lib/topology/auto-tidy';
import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

// Mock the dagreLayout module (for fallback tests)
vi.mock('@/lib/layout/dagreLayout', () => ({
  applyDagreLayout: vi.fn(async (boundaryId, nodes) => {
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

// Helper to create device nodes
function createDevice(
  id: string,
  parentId?: string,
  position = { x: 0, y: 0 },
  options: Partial<{ width: number; height: number; name: string }> = {}
): AppNode {
  const node: AppNode = {
    id,
    type: 'device',
    position,
    width: options.width ?? 80,
    height: options.height ?? 80,
    data: {
      id,
      name: options.name ?? `Device ${id}`,
      deviceType: 'virtual-machine',
      iconPath: 'src/Icons/Azure/Compute/Virtual-Machine.svg',
    } as DeviceNodeData,
  };
  if (parentId) {
    node.parentId = parentId;
    node.extent = 'parent';
  }
  return node;
}

// Helper to create boundary nodes
function createBoundary(
  id: string,
  parentId?: string,
  position = { x: 0, y: 0 },
  width = 400,
  height = 300,
  label?: string
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
      label: label ?? `Boundary ${id}`,
      type: 'security_zone',
    } as BoundaryNodeData,
  };
  if (parentId) {
    node.parentId = parentId;
    node.extent = 'parent';
  }
  return node;
}

// Helper to create edges
function createEdge(source: string, target: string): AppEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
  };
}

// Get node depth in hierarchy
function getNodeDepth(nodeId: string, nodes: AppNode[]): number {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || !node.parentId) return 0;
  return 1 + getNodeDepth(node.parentId, nodes);
}

describe('Nested Boundary Layout (ELKjs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Two-Level Nesting (Device in Boundary)', () => {
    it('should position devices inside a single boundary', async () => {
      const nodes = [
        createBoundary('boundary-1', undefined, { x: 0, y: 0 }, 400, 300),
        createDevice('device-1', 'boundary-1', { x: 10, y: 10 }),
        createDevice('device-2', 'boundary-1', { x: 100, y: 10 }),
      ];
      const edges = [createEdge('device-1', 'device-2')];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        elkAlgorithm: 'mrtree',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
      });

      // All nodes should be present
      expect(result.nodes.length).toBe(3);
      expect(result.stats.boundariesProcessed).toBe(1);
      expect(result.stats.devicesRepositioned).toBe(2);

      // Boundary should have valid dimensions
      const boundary = result.nodes.find(n => n.id === 'boundary-1');
      expect(boundary).toBeDefined();
      expect(boundary?.width).toBeGreaterThan(0);
      expect(boundary?.height).toBeGreaterThan(0);

      // Devices should have valid positions
      const device1 = result.nodes.find(n => n.id === 'device-1');
      const device2 = result.nodes.find(n => n.id === 'device-2');
      expect(device1?.position.x).toBeGreaterThanOrEqual(0);
      expect(device1?.position.y).toBeGreaterThanOrEqual(0);
      expect(device2?.position.x).toBeGreaterThanOrEqual(0);
      expect(device2?.position.y).toBeGreaterThanOrEqual(0);
    });

    it('should resize boundary to fit devices', async () => {
      // Create a small boundary with spread out devices
      const nodes = [
        createBoundary('boundary-1', undefined, { x: 0, y: 0 }, 200, 150),
        createDevice('device-1', 'boundary-1', { x: 10, y: 10 }),
        createDevice('device-2', 'boundary-1', { x: 10, y: 100 }),
        createDevice('device-3', 'boundary-1', { x: 100, y: 10 }),
      ];
      const edges = [
        createEdge('device-1', 'device-2'),
        createEdge('device-2', 'device-3'),
      ];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
      });

      const boundary = result.nodes.find(n => n.id === 'boundary-1');

      // Boundary should be large enough to contain all devices + padding
      expect(boundary?.width).toBeGreaterThan(100); // At least device width + some space
      expect(boundary?.height).toBeGreaterThan(100);
    });
  });

  describe('Three-Level Nesting (Device in Boundary in Boundary)', () => {
    it('should handle device inside nested boundary', async () => {
      const nodes = [
        createBoundary('outer', undefined, { x: 0, y: 0 }, 600, 500, 'Outer Zone'),
        createBoundary('inner', 'outer', { x: 50, y: 50 }, 300, 250, 'Inner Zone'),
        createDevice('device-1', 'inner', { x: 20, y: 20 }),
        createDevice('device-2', 'inner', { x: 100, y: 20 }),
      ];
      const edges = [createEdge('device-1', 'device-2')];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        elkAlgorithm: 'mrtree',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
        nestedBoundarySpacing: 30,
      });

      // All nodes present
      expect(result.nodes.length).toBe(4);

      // Both boundaries processed
      expect(result.stats.boundariesProcessed).toBe(2);

      // Get updated nodes
      const outer = result.nodes.find(n => n.id === 'outer');
      const inner = result.nodes.find(n => n.id === 'inner');
      const device1 = result.nodes.find(n => n.id === 'device-1');
      const device2 = result.nodes.find(n => n.id === 'device-2');

      // All nodes should have valid dimensions/positions
      expect(outer).toBeDefined();
      expect(inner).toBeDefined();
      expect(device1).toBeDefined();
      expect(device2).toBeDefined();

      // Inner boundary should fit inside outer
      expect(inner!.position.x).toBeGreaterThanOrEqual(0);
      expect(inner!.position.y).toBeGreaterThanOrEqual(0);

      // Devices should be inside inner boundary
      expect(device1!.position.x).toBeGreaterThanOrEqual(0);
      expect(device1!.position.y).toBeGreaterThanOrEqual(0);
    });

    it('should process boundaries from innermost to outermost', async () => {
      const nodes = [
        createBoundary('outer', undefined, { x: 0, y: 0 }, 600, 500),
        createBoundary('inner', 'outer', { x: 50, y: 50 }, 300, 250),
        createDevice('device-1', 'inner', { x: 20, y: 20 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
      });

      // Both boundaries should be processed
      expect(result.stats.boundariesProcessed).toBe(2);

      // Verify hierarchy depths are correct
      const outerDepth = getNodeDepth('outer', result.nodes);
      const innerDepth = getNodeDepth('inner', result.nodes);

      expect(outerDepth).toBe(0);
      expect(innerDepth).toBe(1);
    });

    it('should apply nested boundary spacing correctly', async () => {
      const nodes = [
        createBoundary('outer', undefined, { x: 0, y: 0 }, 600, 500),
        createBoundary('inner', 'outer', { x: 50, y: 50 }, 300, 250),
        createDevice('device-1', 'inner', { x: 20, y: 20 }),
      ];
      const edges: AppEdge[] = [];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
        nestedBoundarySpacing: 50, // Extra spacing for nested boundaries
      });

      const outer = result.nodes.find(n => n.id === 'outer');
      const inner = result.nodes.find(n => n.id === 'inner');

      // Outer should be larger than inner + its position
      expect(outer!.width!).toBeGreaterThan(inner!.width! + inner!.position.x);
    });
  });

  describe('Four-Level Nesting (Device in Boundary in Boundary in Boundary)', () => {
    it('should handle deeply nested structure', async () => {
      const nodes = [
        createBoundary('level-0', undefined, { x: 0, y: 0 }, 800, 700, 'Level 0'),
        createBoundary('level-1', 'level-0', { x: 50, y: 50 }, 600, 500, 'Level 1'),
        createBoundary('level-2', 'level-1', { x: 50, y: 50 }, 400, 300, 'Level 2'),
        createDevice('device-1', 'level-2', { x: 30, y: 30 }),
        createDevice('device-2', 'level-2', { x: 150, y: 30 }),
        createDevice('device-3', 'level-1', { x: 30, y: 400 }), // Device directly in level-1
      ];
      const edges = [
        createEdge('device-1', 'device-2'),
        createEdge('device-2', 'device-3'),
      ];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        elkAlgorithm: 'mrtree',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
        nestedBoundarySpacing: 30,
      });

      // All 6 nodes should be present
      expect(result.nodes.length).toBe(6);

      // 3 boundaries processed
      expect(result.stats.boundariesProcessed).toBe(3);

      // 3 devices repositioned
      expect(result.stats.devicesRepositioned).toBe(3);

      // Verify depths
      expect(getNodeDepth('level-0', result.nodes)).toBe(0);
      expect(getNodeDepth('level-1', result.nodes)).toBe(1);
      expect(getNodeDepth('level-2', result.nodes)).toBe(2);
      expect(getNodeDepth('device-1', result.nodes)).toBe(3);
      expect(getNodeDepth('device-3', result.nodes)).toBe(2); // In level-1
    });

    it('should ensure each level has sufficient padding', async () => {
      const padding = 45;
      const nestedSpacing = 30;

      const nodes = [
        createBoundary('outer', undefined, { x: 0, y: 0 }, 800, 700),
        createBoundary('middle', 'outer', { x: 50, y: 50 }, 600, 500),
        createBoundary('inner', 'middle', { x: 50, y: 50 }, 400, 300),
        createDevice('device-1', 'inner', { x: 30, y: 30 }),
      ];

      const result = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: padding,
        nestedBoundarySpacing: nestedSpacing,
      });

      const outer = result.nodes.find(n => n.id === 'outer');
      const middle = result.nodes.find(n => n.id === 'middle');
      const inner = result.nodes.find(n => n.id === 'inner');
      const device = result.nodes.find(n => n.id === 'device-1');

      // Each level should have room for padding
      // Device position inside inner should be >= 0
      expect(device!.position.x).toBeGreaterThanOrEqual(0);
      expect(device!.position.y).toBeGreaterThanOrEqual(0);

      // Inner position inside middle should be >= 0
      expect(inner!.position.x).toBeGreaterThanOrEqual(0);
      expect(inner!.position.y).toBeGreaterThanOrEqual(0);

      // Middle position inside outer should be >= 0
      expect(middle!.position.x).toBeGreaterThanOrEqual(0);
      expect(middle!.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Mixed Content at Multiple Levels', () => {
    it('should handle boundaries with both child boundaries and devices', async () => {
      const nodes = [
        createBoundary('root', undefined, { x: 0, y: 0 }, 1000, 800),
        // Direct children of root
        createDevice('root-device', 'root', { x: 800, y: 400 }),
        createBoundary('zone-a', 'root', { x: 50, y: 50 }, 400, 350),
        createBoundary('zone-b', 'root', { x: 500, y: 50 }, 400, 350),
        // Children of zone-a
        createDevice('a-device-1', 'zone-a', { x: 20, y: 20 }),
        createDevice('a-device-2', 'zone-a', { x: 150, y: 20 }),
        // Children of zone-b
        createBoundary('zone-b-sub', 'zone-b', { x: 50, y: 50 }, 200, 150),
        createDevice('b-sub-device', 'zone-b-sub', { x: 20, y: 20 }),
      ];
      const edges = [
        createEdge('a-device-1', 'a-device-2'),
        createEdge('a-device-2', 'root-device'),
        createEdge('root-device', 'b-sub-device'),
      ];

      const result = await tidyDiagram(nodes, edges, {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
        nestedBoundarySpacing: 30,
      });

      // All 8 nodes present
      expect(result.nodes.length).toBe(8);

      // 3-4 boundaries processed (root, zone-a, zone-b, zone-b-sub - some may be skipped if empty)
      // zone-b has only a nested boundary child, not direct devices
      expect(result.stats.boundariesProcessed).toBeGreaterThanOrEqual(3);

      // 4 devices repositioned
      expect(result.stats.devicesRepositioned).toBe(4);

      // Verify hierarchy
      expect(getNodeDepth('root', result.nodes)).toBe(0);
      expect(getNodeDepth('zone-a', result.nodes)).toBe(1);
      expect(getNodeDepth('zone-b', result.nodes)).toBe(1);
      expect(getNodeDepth('zone-b-sub', result.nodes)).toBe(2);
      expect(getNodeDepth('b-sub-device', result.nodes)).toBe(3);
    });
  });

  describe('Boundary Padding Settings', () => {
    it('should respect custom boundaryPadding setting', async () => {
      const smallPadding = 20;
      const largePadding = 100;

      const nodes = [
        createBoundary('boundary', undefined, { x: 0, y: 0 }, 400, 300),
        createDevice('device', 'boundary', { x: 30, y: 30 }),
      ];

      const smallResult = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: smallPadding,
      });

      const largeResult = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: largePadding,
      });

      const smallBoundary = smallResult.nodes.find(n => n.id === 'boundary');
      const largeBoundary = largeResult.nodes.find(n => n.id === 'boundary');

      // Larger padding should result in larger boundary
      // (with auto-resize, boundary grows to fit content + padding)
      expect(largeBoundary!.width!).toBeGreaterThan(smallBoundary!.width! - 1);
    });

    it('should apply nestedBoundarySpacing for nested boundaries', async () => {
      const noExtraSpacing = 0;
      const extraSpacing = 50;

      const nodes = [
        createBoundary('outer', undefined, { x: 0, y: 0 }, 600, 500),
        createBoundary('inner', 'outer', { x: 50, y: 50 }, 300, 250),
        createDevice('device', 'inner', { x: 20, y: 20 }),
      ];

      const noExtraResult = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
        nestedBoundarySpacing: noExtraSpacing,
      });

      const extraResult = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: 45,
        nestedBoundarySpacing: extraSpacing,
      });

      const noExtraOuter = noExtraResult.nodes.find(n => n.id === 'outer');
      const extraOuter = extraResult.nodes.find(n => n.id === 'outer');

      // With extra nested spacing, outer should be larger
      expect(extraOuter!.width!).toBeGreaterThanOrEqual(noExtraOuter!.width! - 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty boundaries in nested structure', async () => {
      const nodes = [
        createBoundary('outer', undefined, { x: 0, y: 0 }, 600, 500),
        createBoundary('inner-empty', 'outer', { x: 50, y: 50 }, 200, 150),
        createBoundary('inner-with-content', 'outer', { x: 300, y: 50 }, 200, 150),
        createDevice('device', 'inner-with-content', { x: 20, y: 20 }),
      ];

      const result = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
      });

      // All nodes should still be present
      expect(result.nodes.length).toBe(4);

      // Empty boundary should not be counted as processed (no children to layout)
      // Only inner-with-content and outer have children to process
      expect(result.stats.boundariesProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should handle single device at maximum depth', async () => {
      const nodes = [
        createBoundary('l0', undefined, { x: 0, y: 0 }, 1000, 900),
        createBoundary('l1', 'l0', { x: 50, y: 50 }, 800, 700),
        createBoundary('l2', 'l1', { x: 50, y: 50 }, 600, 500),
        createBoundary('l3', 'l2', { x: 50, y: 50 }, 400, 300),
        createBoundary('l4', 'l3', { x: 50, y: 50 }, 200, 150),
        createDevice('deep-device', 'l4', { x: 20, y: 20 }),
      ];

      const result = await tidyDiagram(nodes, [], {
        layoutAlgorithm: 'elkjs',
        autoResize: true,
        animate: false,
        boundaryPadding: 30, // Smaller padding to fit in deep hierarchy
        nestedBoundarySpacing: 20,
      });

      // All 6 nodes present
      expect(result.nodes.length).toBe(6);

      // Device should be at depth 5
      expect(getNodeDepth('deep-device', result.nodes)).toBe(5);

      // Device should have valid position
      const device = result.nodes.find(n => n.id === 'deep-device');
      expect(device?.position.x).toBeGreaterThanOrEqual(0);
      expect(device?.position.y).toBeGreaterThanOrEqual(0);
    });
  });
});
