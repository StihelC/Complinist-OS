import { describe, it, expect, beforeEach } from 'vitest';
import {
  findCommonAncestor,
  buildHandlerChain,
  getHandlerPosition,
  computeChannelRouting,
  computeChannelRoutingForAllEdges,
  assignChannelNumbers,
  buildHandlerLegends,
  generateChannelRoutePath,
  generateChannelRouteSVGPath,
  shouldUseChannelRouting,
  areInSameBoundary,
  getAncestorChain,
  getContainingBoundary,
  DEFAULT_HANDLER_CONFIG,
} from '@/lib/topology/channel-routing';
import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createDevice(
  id: string,
  parentId?: string,
  position = { x: 100, y: 100 }
): AppNode {
  const node: AppNode = {
    id,
    type: 'device',
    position,
    width: 80,
    height: 80,
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

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a test topology with nested boundaries:
 *
 *   Root
 *   ├── boundary-outer (contains device-A)
 *   │   └── boundary-inner (contains device-B)
 *   └── device-C (root level)
 */
function createNestedTopology(): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [
    createBoundary('boundary-outer', undefined, { x: 50, y: 50 }, 500, 400),
    createBoundary('boundary-inner', 'boundary-outer', { x: 50, y: 100 }, 300, 200),
    createDevice('device-A', 'boundary-outer', { x: 20, y: 20 }),
    createDevice('device-B', 'boundary-inner', { x: 50, y: 50 }),
    createDevice('device-C', undefined, { x: 600, y: 200 }),
  ];

  const edges: AppEdge[] = [
    createEdge('device-A', 'device-B'),
    createEdge('device-B', 'device-C'),
    createEdge('device-A', 'device-C'),
  ];

  return { nodes, edges };
}

/**
 * Creates sibling boundaries topology:
 *
 *   Root
 *   └── boundary-parent
 *       ├── boundary-left (contains device-A)
 *       └── boundary-right (contains device-B)
 */
function createSiblingTopology(): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [
    createBoundary('boundary-parent', undefined, { x: 50, y: 50 }, 800, 400),
    createBoundary('boundary-left', 'boundary-parent', { x: 20, y: 50 }, 300, 300),
    createBoundary('boundary-right', 'boundary-parent', { x: 350, y: 50 }, 300, 300),
    createDevice('device-A', 'boundary-left', { x: 50, y: 100 }),
    createDevice('device-B', 'boundary-right', { x: 50, y: 100 }),
  ];

  const edges: AppEdge[] = [
    createEdge('device-A', 'device-B'),
  ];

  return { nodes, edges };
}

/**
 * Creates a simple same-boundary topology:
 *
 *   boundary-single
 *   ├── device-A
 *   └── device-B
 */
function createSameBoundaryTopology(): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [
    createBoundary('boundary-single', undefined, { x: 50, y: 50 }, 400, 300),
    createDevice('device-A', 'boundary-single', { x: 50, y: 50 }),
    createDevice('device-B', 'boundary-single', { x: 200, y: 50 }),
  ];

  const edges: AppEdge[] = [
    createEdge('device-A', 'device-B'),
  ];

  return { nodes, edges };
}

// =============================================================================
// Tests
// =============================================================================

describe('channel-routing', () => {
  describe('getAncestorChain', () => {
    it('should return empty array for root-level node', () => {
      const { nodes } = createNestedTopology();
      const chain = getAncestorChain('device-C', nodes);
      expect(chain).toEqual([]);
    });

    it('should return parent boundaries for nested device', () => {
      const { nodes } = createNestedTopology();
      const chain = getAncestorChain('device-B', nodes);
      expect(chain).toContain('boundary-inner');
      expect(chain).toContain('boundary-outer');
    });

    it('should return correct order from immediate parent to root', () => {
      const { nodes } = createNestedTopology();
      const chain = getAncestorChain('device-B', nodes);
      // device-B is in boundary-inner which is in boundary-outer
      expect(chain[0]).toBe('boundary-inner');
      expect(chain[1]).toBe('boundary-outer');
    });
  });

  describe('getContainingBoundary', () => {
    it('should return null for root-level device', () => {
      const { nodes } = createNestedTopology();
      const boundary = getContainingBoundary('device-C', nodes);
      expect(boundary).toBeNull();
    });

    it('should return immediate parent boundary for nested device', () => {
      const { nodes } = createNestedTopology();
      const boundary = getContainingBoundary('device-B', nodes);
      expect(boundary).toBe('boundary-inner');
    });

    it('should return parent boundary for nested boundary', () => {
      const { nodes } = createNestedTopology();
      const boundary = getContainingBoundary('boundary-inner', nodes);
      expect(boundary).toBe('boundary-outer');
    });
  });

  describe('areInSameBoundary', () => {
    it('should return true for devices in same boundary', () => {
      const { nodes } = createSameBoundaryTopology();
      expect(areInSameBoundary('device-A', 'device-B', nodes)).toBe(true);
    });

    it('should return false for devices in different boundaries', () => {
      const { nodes } = createSiblingTopology();
      expect(areInSameBoundary('device-A', 'device-B', nodes)).toBe(false);
    });

    it('should return true for both root-level devices', () => {
      const nodes: AppNode[] = [
        createDevice('device-A', undefined, { x: 0, y: 0 }),
        createDevice('device-B', undefined, { x: 200, y: 0 }),
      ];
      expect(areInSameBoundary('device-A', 'device-B', nodes)).toBe(true);
    });

    it('should return false when one device is nested and one is at root', () => {
      const { nodes } = createNestedTopology();
      expect(areInSameBoundary('device-A', 'device-C', nodes)).toBe(false);
    });
  });

  describe('findCommonAncestor', () => {
    it('should return null when both nodes are at root level', () => {
      const nodes: AppNode[] = [
        createDevice('device-A', undefined),
        createDevice('device-B', undefined),
      ];
      const ancestor = findCommonAncestor('device-A', 'device-B', nodes);
      expect(ancestor).toBeNull();
    });

    it('should find common ancestor for sibling boundaries', () => {
      const { nodes } = createSiblingTopology();
      const ancestor = findCommonAncestor('device-A', 'device-B', nodes);
      expect(ancestor).toBe('boundary-parent');
    });

    it('should find common ancestor for nested devices', () => {
      const { nodes } = createNestedTopology();
      const ancestor = findCommonAncestor('device-A', 'device-B', nodes);
      expect(ancestor).toBe('boundary-outer');
    });

    it('should return outer boundary when device is inside nested boundary', () => {
      const { nodes } = createNestedTopology();
      // device-B is in inner, device-C is at root
      // Common ancestor should be null (no common boundary)
      const ancestor = findCommonAncestor('device-B', 'device-C', nodes);
      expect(ancestor).toBeNull();
    });
  });

  describe('buildHandlerChain', () => {
    it('should return empty chain for same-boundary devices', () => {
      const { nodes } = createSameBoundaryTopology();
      const { chain, commonAncestor } = buildHandlerChain('device-A', 'device-B', nodes);
      expect(chain).toHaveLength(0);
      expect(commonAncestor).toBeNull();
    });

    it('should return handler chain for cross-boundary connection', () => {
      const { nodes } = createNestedTopology();
      // device-B (in inner) to device-C (at root)
      const { chain } = buildHandlerChain('device-B', 'device-C', nodes);
      expect(chain).toContain('boundary-inner');
      expect(chain).toContain('boundary-outer');
    });

    it('should return correct chain for sibling boundaries', () => {
      const { nodes } = createSiblingTopology();
      const { chain, commonAncestor } = buildHandlerChain('device-A', 'device-B', nodes);

      // Should route through: boundary-left -> boundary-parent -> boundary-right
      expect(chain).toContain('boundary-left');
      expect(chain).toContain('boundary-parent');
      expect(chain).toContain('boundary-right');
      expect(commonAncestor).toBe('boundary-parent');
    });
  });

  describe('getHandlerPosition', () => {
    it('should return null for non-existent boundary', () => {
      const nodes: AppNode[] = [];
      const position = getHandlerPosition('non-existent', nodes);
      expect(position).toBeNull();
    });

    it('should return null for device node', () => {
      const { nodes } = createNestedTopology();
      const position = getHandlerPosition('device-A', nodes);
      expect(position).toBeNull();
    });

    it('should return position on right side by default', () => {
      const { nodes } = createNestedTopology();
      const position = getHandlerPosition('boundary-outer', nodes);

      expect(position).not.toBeNull();
      expect(position!.side).toBe('right');
      // Right edge of boundary: x + width
      expect(position!.x).toBe(50 + 500); // 550
      // 50% along height
      expect(position!.y).toBe(50 + 200); // 250
    });

    it('should respect custom handler config', () => {
      const nodes: AppNode[] = [
        {
          ...createBoundary('boundary-custom', undefined, { x: 0, y: 0 }, 400, 300),
          data: {
            id: 'boundary-custom',
            label: 'Custom Boundary',
            type: 'security_zone',
            handlerConfig: {
              side: 'top',
              position: 25,
              visible: true,
            },
          } as BoundaryNodeData,
        },
      ];

      const position = getHandlerPosition('boundary-custom', nodes);

      expect(position).not.toBeNull();
      expect(position!.side).toBe('top');
      expect(position!.x).toBe(100); // 25% of 400
      expect(position!.y).toBe(0); // top edge
    });
  });

  describe('computeChannelRouting', () => {
    it('should return non-channel routing for same-boundary devices', () => {
      const { nodes, edges } = createSameBoundaryTopology();
      const result = computeChannelRouting(edges[0], nodes);

      expect(result).not.toBeNull();
      expect(result!.routing.isChannelRouted).toBe(false);
      expect(result!.routing.handlerChain).toHaveLength(0);
    });

    it('should return channel routing for cross-boundary devices', () => {
      const { nodes, edges } = createNestedTopology();
      // device-B to device-C crosses boundaries
      const edge = edges.find(e => e.source === 'device-B' && e.target === 'device-C')!;
      const result = computeChannelRouting(edge, nodes);

      expect(result).not.toBeNull();
      expect(result!.routing.isChannelRouted).toBe(true);
      expect(result!.routing.handlerChain.length).toBeGreaterThan(0);
      expect(result!.waypoints.length).toBeGreaterThan(0);
    });

    it('should include handler waypoints in correct order', () => {
      const { nodes } = createNestedTopology();
      const edge = createEdge('device-B', 'device-C');
      const result = computeChannelRouting(edge, nodes);

      expect(result!.waypoints.length).toBe(result!.routing.handlerChain.length);
      // Each waypoint should have boundaryId matching handler chain
      result!.waypoints.forEach((wp, i) => {
        expect(wp.boundaryId).toBe(result!.routing.handlerChain[i]);
      });
    });
  });

  describe('computeChannelRoutingForAllEdges', () => {
    it('should return empty map for empty edges', () => {
      const { nodes } = createNestedTopology();
      const result = computeChannelRoutingForAllEdges(nodes, []);
      expect(result.size).toBe(0);
    });

    it('should compute routing for all edges', () => {
      const { nodes, edges } = createNestedTopology();
      const result = computeChannelRoutingForAllEdges(nodes, edges);

      expect(result.size).toBe(edges.length);
      edges.forEach(edge => {
        expect(result.has(edge.id)).toBe(true);
      });
    });
  });

  describe('assignChannelNumbers', () => {
    it('should assign sequential channel numbers', () => {
      const { nodes, edges } = createNestedTopology();
      const channelMap = assignChannelNumbers(edges, nodes);

      // Check that channel numbers are assigned
      for (const [handlerId, edgeChannels] of channelMap) {
        const numbers = Array.from(edgeChannels.values());
        // Channel numbers should start at 1 and be sequential
        numbers.sort((a, b) => a - b);
        expect(numbers[0]).toBe(1);
        if (numbers.length > 1) {
          for (let i = 1; i < numbers.length; i++) {
            expect(numbers[i]).toBe(i + 1);
          }
        }
      }
    });

    it('should group edges by handler', () => {
      const { nodes, edges } = createNestedTopology();
      const channelMap = assignChannelNumbers(edges, nodes);

      // Each handler should only have edges that pass through it
      for (const [handlerId, edgeChannels] of channelMap) {
        for (const edgeId of edgeChannels.keys()) {
          const edge = edges.find(e => e.id === edgeId)!;
          const routing = computeChannelRouting(edge, nodes);
          expect(routing!.routing.handlerChain).toContain(handlerId);
        }
      }
    });
  });

  describe('buildHandlerLegends', () => {
    it('should return empty array when no channel routing', () => {
      const { nodes, edges } = createSameBoundaryTopology();
      const legends = buildHandlerLegends(edges, nodes);
      expect(legends).toHaveLength(0);
    });

    it('should build legends for each handler with channels', () => {
      const { nodes, edges } = createNestedTopology();
      const legends = buildHandlerLegends(edges, nodes);

      expect(legends.length).toBeGreaterThan(0);
      legends.forEach(legend => {
        expect(legend.boundaryId).toBeDefined();
        expect(legend.boundaryName).toBeDefined();
        expect(legend.channels.length).toBeGreaterThan(0);
      });
    });

    it('should include source and target names in legend entries', () => {
      const { nodes, edges } = createNestedTopology();
      const legends = buildHandlerLegends(edges, nodes);

      legends.forEach(legend => {
        legend.channels.forEach(channel => {
          expect(channel.sourceName).toBeDefined();
          expect(channel.targetName).toBeDefined();
          expect(channel.edgeId).toBeDefined();
          expect(channel.channelNumber).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('generateChannelRoutePath', () => {
    it('should generate path with source, handlers, and target', () => {
      const { nodes, edges } = createNestedTopology();
      const edge = edges.find(e => e.source === 'device-B' && e.target === 'device-C')!;
      const routingResult = computeChannelRouting(edge, nodes)!;

      const path = generateChannelRoutePath(edge, nodes, routingResult);

      expect(path.length).toBeGreaterThan(2);
      expect(path[0].type).toBe('source');
      expect(path[path.length - 1].type).toBe('target');

      // Middle points should be handlers
      for (let i = 1; i < path.length - 1; i++) {
        expect(path[i].type).toBe('handler');
      }
    });

    it('should have correct coordinates for source and target', () => {
      const { nodes, edges } = createNestedTopology();
      const edge = edges.find(e => e.source === 'device-B' && e.target === 'device-C')!;
      const routingResult = computeChannelRouting(edge, nodes)!;

      const path = generateChannelRoutePath(edge, nodes, routingResult);

      // Source should be at device-B center
      // device-B is at (50, 50) relative to boundary-inner
      // boundary-inner is at (50, 100) relative to boundary-outer
      // boundary-outer is at (50, 50) absolute
      // So device-B absolute = (50 + 50 + 50, 50 + 100 + 50) = (150, 200)
      // Center = (150 + 40, 200 + 40) = (190, 240)
      expect(path[0].x).toBeCloseTo(190, 0);
      expect(path[0].y).toBeCloseTo(240, 0);
    });
  });

  describe('shouldUseChannelRouting', () => {
    it('should return false when mode is direct', () => {
      const { nodes, edges } = createNestedTopology();
      const result = shouldUseChannelRouting(edges[0], nodes, 'direct');
      expect(result).toBe(false);
    });

    it('should return false for same-boundary in channel mode', () => {
      const { nodes, edges } = createSameBoundaryTopology();
      const result = shouldUseChannelRouting(edges[0], nodes, 'channel');
      expect(result).toBe(false);
    });

    it('should return true for cross-boundary in channel mode', () => {
      const { nodes, edges } = createNestedTopology();
      // device-B to device-C crosses boundaries
      const edge = edges.find(e => e.source === 'device-B' && e.target === 'device-C')!;
      const result = shouldUseChannelRouting(edge, nodes, 'channel');
      expect(result).toBe(true);
    });
  });

  describe('DEFAULT_HANDLER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_HANDLER_CONFIG.side).toBe('right');
      expect(DEFAULT_HANDLER_CONFIG.position).toBe(50);
      expect(DEFAULT_HANDLER_CONFIG.visible).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle deeply nested boundaries (3+ levels)', () => {
      const nodes: AppNode[] = [
        createBoundary('level-1', undefined, { x: 0, y: 0 }, 800, 600),
        createBoundary('level-2', 'level-1', { x: 50, y: 50 }, 600, 400),
        createBoundary('level-3', 'level-2', { x: 50, y: 50 }, 400, 200),
        createDevice('device-deep', 'level-3', { x: 50, y: 50 }),
        createDevice('device-root', undefined, { x: 900, y: 300 }),
      ];
      const edges: AppEdge[] = [createEdge('device-deep', 'device-root')];

      const { chain } = buildHandlerChain('device-deep', 'device-root', nodes);

      // Should traverse all 3 levels
      expect(chain).toContain('level-3');
      expect(chain).toContain('level-2');
      expect(chain).toContain('level-1');
    });

    it('should handle boundary-to-boundary connections', () => {
      const nodes: AppNode[] = [
        createBoundary('boundary-A', undefined, { x: 0, y: 0 }),
        createBoundary('boundary-B', undefined, { x: 500, y: 0 }),
      ];
      const edges: AppEdge[] = [createEdge('boundary-A', 'boundary-B')];

      const { chain } = buildHandlerChain('boundary-A', 'boundary-B', nodes);
      // Both at root level, no channel routing needed
      expect(chain).toHaveLength(0);
    });

    it('should handle empty nodes array', () => {
      const result = computeChannelRoutingForAllEdges([], []);
      expect(result.size).toBe(0);
    });

    it('should handle missing source or target node', () => {
      const nodes: AppNode[] = [createDevice('device-A')];
      const edges: AppEdge[] = [createEdge('device-A', 'device-missing')];

      const result = computeChannelRouting(edges[0], nodes);
      // Should handle gracefully
      expect(result).not.toBeNull();
    });
  });

  describe('generateChannelRouteSVGPath', () => {
    it('should return empty path for less than 2 waypoints', () => {
      const [path, labelX, labelY] = generateChannelRouteSVGPath([]);
      expect(path).toBe('');
      expect(labelX).toBe(0);
      expect(labelY).toBe(0);
    });

    it('should generate path starting with M command', () => {
      const waypoints = [
        { x: 0, y: 0, type: 'source' as const },
        { x: 100, y: 100, type: 'target' as const },
      ];
      const [path] = generateChannelRouteSVGPath(waypoints);
      expect(path).toMatch(/^M 0 0/);
    });

    it('should create orthogonal path through handler', () => {
      const waypoints = [
        { x: 0, y: 0, type: 'source' as const },
        { x: 100, y: 50, type: 'handler' as const },
        { x: 200, y: 100, type: 'target' as const },
      ];
      const [path] = generateChannelRouteSVGPath(waypoints);

      // Should contain L commands for line segments
      expect(path).toContain('L');
      // Should start at source
      expect(path).toMatch(/^M 0 0/);
    });

    it('should apply bundle offset for multiple edges', () => {
      const waypoints = [
        { x: 0, y: 0, type: 'source' as const },
        { x: 100, y: 50, type: 'handler' as const },
        { x: 200, y: 100, type: 'target' as const },
      ];

      // First edge of 3
      const [path1] = generateChannelRouteSVGPath(waypoints, 0, 3);
      // Second edge of 3
      const [path2] = generateChannelRouteSVGPath(waypoints, 1, 3);
      // Third edge of 3
      const [path3] = generateChannelRouteSVGPath(waypoints, 2, 3);

      // Paths should be different due to bundling offset
      expect(path1).not.toBe(path2);
      expect(path2).not.toBe(path3);
    });

    it('should calculate label position at midpoint', () => {
      const waypoints = [
        { x: 0, y: 0, type: 'source' as const },
        { x: 100, y: 0, type: 'handler' as const },
        { x: 200, y: 0, type: 'target' as const },
      ];
      const [, labelX, labelY] = generateChannelRouteSVGPath(waypoints);

      // Label should be near the middle waypoint
      expect(labelX).toBeGreaterThan(0);
      expect(labelX).toBeLessThan(200);
    });

    it('should handle vertical paths', () => {
      const waypoints = [
        { x: 100, y: 0, type: 'source' as const },
        { x: 100, y: 100, type: 'handler' as const },
        { x: 100, y: 200, type: 'target' as const },
      ];
      const [path] = generateChannelRouteSVGPath(waypoints);

      // Should create a valid path
      expect(path).toMatch(/^M 100 0/);
      expect(path).toContain('L');
    });

    it('should handle horizontal paths', () => {
      const waypoints = [
        { x: 0, y: 100, type: 'source' as const },
        { x: 100, y: 100, type: 'handler' as const },
        { x: 200, y: 100, type: 'target' as const },
      ];
      const [path] = generateChannelRouteSVGPath(waypoints);

      // Should create a valid path
      expect(path).toMatch(/^M 0 100/);
      expect(path).toContain('L');
    });
  });
});
