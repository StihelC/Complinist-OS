import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectNodeOverlaps,
  detectCollisions,
  extractBoundingBox,
  expandBoundingBox,
  boxesIntersect,
  calculateIntersectionArea,
  calculateOverlapSeverity,
  getNodeDimensions,
  getCollidingNodeIds,
  filterByMinSeverity,
  getOverlapsForNode,
  isLayoutCollisionFree,
  calculateLayoutQuality,
  DEFAULT_MIN_CLEARANCE,
  type BoundingBox,
  type Overlap,
} from '@/lib/topology/collision-detection';
import {
  SpatialHash,
  calculateOptimalCellSize,
  createPopulatedSpatialHash,
  estimateCollisionChecks,
  DEFAULT_CELL_SIZE,
} from '@/lib/topology/spatial-hash';
import type { AppNode, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createDeviceNode(
  id: string,
  x: number,
  y: number,
  width?: number,
  height?: number
): AppNode {
  return {
    id,
    type: 'device',
    position: { x, y },
    data: {
      id,
      name: `Device ${id}`,
      deviceType: 'server',
      iconPath: '',
    } as DeviceNodeData,
    ...(width && height ? { width, height } : {}),
  };
}

function createBoundaryNode(
  id: string,
  x: number,
  y: number,
  width?: number,
  height?: number
): AppNode {
  return {
    id,
    type: 'boundary',
    position: { x, y },
    data: {
      id,
      label: `Boundary ${id}`,
      type: 'security_zone',
    } as BoundaryNodeData,
    ...(width && height ? { width, height } : {}),
  };
}

// =============================================================================
// Bounding Box Tests
// =============================================================================

describe('collision-detection', () => {
  describe('getNodeDimensions', () => {
    it('should use measured dimensions if available', () => {
      const node = createDeviceNode('node-1', 0, 0);
      node.measured = { width: 200, height: 180 };

      const dims = getNodeDimensions(node);

      expect(dims.width).toBe(200);
      expect(dims.height).toBe(180);
    });

    it('should use explicit width/height if no measured', () => {
      const node = createDeviceNode('node-1', 0, 0, 150, 130);

      const dims = getNodeDimensions(node);

      expect(dims.width).toBe(150);
      expect(dims.height).toBe(130);
    });

    it('should use style dimensions if no explicit dimensions', () => {
      const node = createDeviceNode('node-1', 0, 0);
      node.style = { width: 160, height: 140 };

      const dims = getNodeDimensions(node);

      expect(dims.width).toBe(160);
      expect(dims.height).toBe(140);
    });

    it('should use default device dimensions as fallback', () => {
      const node = createDeviceNode('node-1', 0, 0);

      const dims = getNodeDimensions(node);

      expect(dims.width).toBe(140); // DEVICE_DEFAULT_WIDTH
      expect(dims.height).toBe(110); // DEVICE_DEFAULT_HEIGHT
    });

    it('should use default boundary dimensions for boundary nodes', () => {
      const node = createBoundaryNode('boundary-1', 0, 0);

      const dims = getNodeDimensions(node);

      expect(dims.width).toBe(400); // BOUNDARY_DEFAULT_WIDTH
      expect(dims.height).toBe(300); // BOUNDARY_DEFAULT_HEIGHT
    });
  });

  describe('extractBoundingBox', () => {
    it('should extract bounding box from node', () => {
      const node = createDeviceNode('node-1', 100, 200, 150, 130);

      const box = extractBoundingBox(node);

      expect(box.x).toBe(100);
      expect(box.y).toBe(200);
      expect(box.width).toBe(150);
      expect(box.height).toBe(130);
      expect(box.nodeId).toBe('node-1');
    });
  });

  describe('expandBoundingBox', () => {
    it('should expand box by clearance on all sides', () => {
      const box: BoundingBox = { x: 100, y: 100, width: 100, height: 100, nodeId: 'test' };

      const expanded = expandBoundingBox(box, 20);

      expect(expanded.x).toBe(90); // 100 - 10
      expect(expanded.y).toBe(90); // 100 - 10
      expect(expanded.width).toBe(120); // 100 + 20
      expect(expanded.height).toBe(120); // 100 + 20
    });
  });

  describe('boxesIntersect', () => {
    it('should detect intersecting boxes', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 50, y: 50, width: 100, height: 100, nodeId: 'b' };

      expect(boxesIntersect(boxA, boxB)).toBe(true);
    });

    it('should detect non-intersecting boxes (separated horizontally)', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 200, y: 0, width: 100, height: 100, nodeId: 'b' };

      expect(boxesIntersect(boxA, boxB)).toBe(false);
    });

    it('should detect non-intersecting boxes (separated vertically)', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 0, y: 200, width: 100, height: 100, nodeId: 'b' };

      expect(boxesIntersect(boxA, boxB)).toBe(false);
    });

    it('should detect touching boxes as non-intersecting', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 100, y: 0, width: 100, height: 100, nodeId: 'b' };

      expect(boxesIntersect(boxA, boxB)).toBe(false);
    });

    it('should detect one box inside another', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 200, height: 200, nodeId: 'a' };
      const boxB: BoundingBox = { x: 50, y: 50, width: 50, height: 50, nodeId: 'b' };

      expect(boxesIntersect(boxA, boxB)).toBe(true);
    });
  });

  describe('calculateIntersectionArea', () => {
    it('should calculate intersection area for overlapping boxes', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 50, y: 50, width: 100, height: 100, nodeId: 'b' };

      const area = calculateIntersectionArea(boxA, boxB);

      // Intersection: x=[50,100], y=[50,100] = 50x50 = 2500
      expect(area).toBe(2500);
    });

    it('should return 0 for non-intersecting boxes', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 200, y: 200, width: 100, height: 100, nodeId: 'b' };

      const area = calculateIntersectionArea(boxA, boxB);

      expect(area).toBe(0);
    });

    it('should calculate full area when one box is inside another', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 200, height: 200, nodeId: 'a' };
      const boxB: BoundingBox = { x: 50, y: 50, width: 50, height: 50, nodeId: 'b' };

      const area = calculateIntersectionArea(boxA, boxB);

      expect(area).toBe(2500); // 50 * 50
    });
  });

  describe('calculateOverlapSeverity', () => {
    it('should return 0 for non-overlapping boxes', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 200, y: 200, width: 100, height: 100, nodeId: 'b' };

      const severity = calculateOverlapSeverity(boxA, boxB);

      expect(severity).toBe(0);
    });

    it('should return 1.0 when smaller box is completely inside larger', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 200, height: 200, nodeId: 'a' };
      const boxB: BoundingBox = { x: 50, y: 50, width: 50, height: 50, nodeId: 'b' };

      const severity = calculateOverlapSeverity(boxA, boxB);

      // Overlap area = 2500, smaller area = 2500
      expect(severity).toBe(1);
    });

    it('should return value between 0 and 1 for partial overlap', () => {
      const boxA: BoundingBox = { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' };
      const boxB: BoundingBox = { x: 50, y: 50, width: 100, height: 100, nodeId: 'b' };

      const severity = calculateOverlapSeverity(boxA, boxB);

      // Overlap area = 2500, smaller area = 10000
      expect(severity).toBe(0.25);
    });
  });
});

// =============================================================================
// Main Detection Tests
// =============================================================================

describe('detectNodeOverlaps', () => {
  it('should return empty array for less than 2 nodes', () => {
    const nodes = [createDeviceNode('node-1', 0, 0)];

    const overlaps = detectNodeOverlaps(nodes);

    expect(overlaps).toHaveLength(0);
  });

  it('should return empty array for empty node list', () => {
    const overlaps = detectNodeOverlaps([]);

    expect(overlaps).toHaveLength(0);
  });

  it('should detect overlapping nodes', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 50, 50, 100, 100),
    ];

    const overlaps = detectNodeOverlaps(nodes, 0);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].nodeA).toBe('node-1');
    expect(overlaps[0].nodeB).toBe('node-2');
  });

  it('should detect nodes that are too close with clearance', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 120, 0, 100, 100), // 20px gap, less than default clearance
    ];

    const overlaps = detectNodeOverlaps(nodes, 50);

    expect(overlaps).toHaveLength(1);
  });

  it('should not report collision when nodes have enough clearance', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 200, 0, 100, 100), // 100px gap
    ];

    const overlaps = detectNodeOverlaps(nodes, 50);

    expect(overlaps).toHaveLength(0);
  });

  it('should sort overlaps by severity (highest first)', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 50, 0, 100, 100), // 50% overlap
      createDeviceNode('node-3', 0, 0, 100, 100), // Same position as node-1
    ];

    const overlaps = detectNodeOverlaps(nodes, 0);

    expect(overlaps.length).toBeGreaterThanOrEqual(2);
    // Verify sorted by severity descending
    for (let i = 1; i < overlaps.length; i++) {
      expect(overlaps[i - 1].severity).toBeGreaterThanOrEqual(overlaps[i].severity);
    }
  });

  it('should detect multiple overlaps', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 50, 0, 100, 100),
      createDeviceNode('node-3', 100, 0, 100, 100),
    ];

    const overlaps = detectNodeOverlaps(nodes, 0);

    // node-1 overlaps node-2, node-2 overlaps node-3
    expect(overlaps).toHaveLength(2);
  });
});

// =============================================================================
// Advanced Detection Tests
// =============================================================================

describe('detectCollisions', () => {
  it('should return complete collision result', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 50, 50, 100, 100),
    ];

    const result = detectCollisions(nodes, { minClearance: 0 });

    expect(result.totalNodes).toBe(2);
    expect(result.collisionCount).toBe(1);
    expect(result.overlaps).toHaveLength(1);
    expect(result.averageSeverity).toBeGreaterThan(0);
    expect(result.maxSeverity).toBeGreaterThan(0);
  });

  it('should filter to devices only', () => {
    const nodes = [
      createDeviceNode('device-1', 0, 0, 100, 100),
      createDeviceNode('device-2', 50, 50, 100, 100),
      createBoundaryNode('boundary-1', 0, 0, 400, 400),
    ];

    const result = detectCollisions(nodes, { minClearance: 0, devicesOnly: true });

    expect(result.totalNodes).toBe(2);
    expect(result.collisionCount).toBe(1);
    // Boundary should not be in overlaps
    const nodeIds = getCollidingNodeIds(result.overlaps);
    expect(nodeIds.has('boundary-1')).toBe(false);
  });

  it('should filter to boundaries only', () => {
    const nodes = [
      createDeviceNode('device-1', 0, 0, 100, 100),
      createBoundaryNode('boundary-1', 0, 0, 400, 400),
      createBoundaryNode('boundary-2', 200, 200, 400, 400),
    ];

    const result = detectCollisions(nodes, { minClearance: 0, boundariesOnly: true });

    expect(result.totalNodes).toBe(2);
    // Device should not be in overlaps
    const nodeIds = getCollidingNodeIds(result.overlaps);
    expect(nodeIds.has('device-1')).toBe(false);
  });

  it('should return zero metrics when no collisions', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 300, 0, 100, 100),
    ];

    const result = detectCollisions(nodes, { minClearance: 0 });

    expect(result.collisionCount).toBe(0);
    expect(result.averageSeverity).toBe(0);
    expect(result.maxSeverity).toBe(0);
  });

  it('should handle single node gracefully', () => {
    const nodes = [createDeviceNode('node-1', 0, 0, 100, 100)];

    const result = detectCollisions(nodes);

    expect(result.totalNodes).toBe(1);
    expect(result.collisionCount).toBe(0);
    expect(result.overlaps).toHaveLength(0);
  });

  it('should use spatial hash for large node counts', () => {
    // Create many non-overlapping nodes
    const nodes = Array.from({ length: 100 }, (_, i) =>
      createDeviceNode(`node-${i}`, (i % 10) * 200, Math.floor(i / 10) * 200, 100, 100)
    );

    const result = detectCollisions(nodes, { useSpatialHash: true });

    expect(result.totalNodes).toBe(100);
    expect(result.collisionCount).toBe(0);
  });
});

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('utility functions', () => {
  describe('getCollidingNodeIds', () => {
    it('should extract all unique node IDs from overlaps', () => {
      const overlaps: Overlap[] = [
        { nodeA: 'a', nodeB: 'b', severity: 0.5 },
        { nodeA: 'b', nodeB: 'c', severity: 0.3 },
      ];

      const ids = getCollidingNodeIds(overlaps);

      expect(ids.size).toBe(3);
      expect(ids.has('a')).toBe(true);
      expect(ids.has('b')).toBe(true);
      expect(ids.has('c')).toBe(true);
    });

    it('should handle empty overlaps', () => {
      const ids = getCollidingNodeIds([]);

      expect(ids.size).toBe(0);
    });
  });

  describe('filterByMinSeverity', () => {
    it('should filter overlaps by minimum severity', () => {
      const overlaps: Overlap[] = [
        { nodeA: 'a', nodeB: 'b', severity: 0.8 },
        { nodeA: 'c', nodeB: 'd', severity: 0.3 },
        { nodeA: 'e', nodeB: 'f', severity: 0.5 },
      ];

      const filtered = filterByMinSeverity(overlaps, 0.5);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((o) => o.severity >= 0.5)).toBe(true);
    });
  });

  describe('getOverlapsForNode', () => {
    it('should get all overlaps involving a specific node', () => {
      const overlaps: Overlap[] = [
        { nodeA: 'a', nodeB: 'b', severity: 0.5 },
        { nodeA: 'b', nodeB: 'c', severity: 0.3 },
        { nodeA: 'd', nodeB: 'e', severity: 0.4 },
      ];

      const nodeOverlaps = getOverlapsForNode(overlaps, 'b');

      expect(nodeOverlaps).toHaveLength(2);
    });

    it('should return empty array for node not in any overlap', () => {
      const overlaps: Overlap[] = [{ nodeA: 'a', nodeB: 'b', severity: 0.5 }];

      const nodeOverlaps = getOverlapsForNode(overlaps, 'x');

      expect(nodeOverlaps).toHaveLength(0);
    });
  });

  describe('isLayoutCollisionFree', () => {
    it('should return true for collision-free layout', () => {
      const nodes = [
        createDeviceNode('node-1', 0, 0, 100, 100),
        createDeviceNode('node-2', 300, 0, 100, 100),
      ];

      expect(isLayoutCollisionFree(nodes, 50)).toBe(true);
    });

    it('should return false when collisions exist', () => {
      const nodes = [
        createDeviceNode('node-1', 0, 0, 100, 100),
        createDeviceNode('node-2', 50, 0, 100, 100),
      ];

      expect(isLayoutCollisionFree(nodes, 0)).toBe(false);
    });
  });

  describe('calculateLayoutQuality', () => {
    it('should return 1.0 for collision-free layout', () => {
      const nodes = [
        createDeviceNode('node-1', 0, 0, 100, 100),
        createDeviceNode('node-2', 300, 0, 100, 100),
      ];

      const quality = calculateLayoutQuality(nodes, 50);

      expect(quality).toBe(1);
    });

    it('should return lower quality for layouts with collisions', () => {
      const nodes = [
        createDeviceNode('node-1', 0, 0, 100, 100),
        createDeviceNode('node-2', 0, 0, 100, 100), // Same position
      ];

      const quality = calculateLayoutQuality(nodes, 0);

      expect(quality).toBeLessThan(1);
    });

    it('should return 1.0 for single node', () => {
      const nodes = [createDeviceNode('node-1', 0, 0, 100, 100)];

      const quality = calculateLayoutQuality(nodes);

      expect(quality).toBe(1);
    });
  });
});

// =============================================================================
// Spatial Hash Tests
// =============================================================================

describe('SpatialHash', () => {
  let spatialHash: SpatialHash;

  beforeEach(() => {
    spatialHash = new SpatialHash({ cellSize: 100 });
  });

  it('should insert and query bounding boxes', () => {
    const box: BoundingBox = { x: 50, y: 50, width: 100, height: 100, nodeId: 'test' };

    spatialHash.insert(box);
    const candidates = spatialHash.query(box);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].nodeId).toBe('test');
  });

  it('should return nearby boxes in query', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 50, height: 50, nodeId: 'box1' };
    const box2: BoundingBox = { x: 60, y: 60, width: 50, height: 50, nodeId: 'box2' };
    const box3: BoundingBox = { x: 500, y: 500, width: 50, height: 50, nodeId: 'box3' };

    spatialHash.insert(box1);
    spatialHash.insert(box2);
    spatialHash.insert(box3);

    const candidates = spatialHash.query(box1);

    // box1 and box2 are in the same or adjacent cells, box3 is far away
    expect(candidates.some((c) => c.nodeId === 'box1')).toBe(true);
    expect(candidates.some((c) => c.nodeId === 'box2')).toBe(true);
    expect(candidates.some((c) => c.nodeId === 'box3')).toBe(false);
  });

  it('should handle large boxes spanning multiple cells', () => {
    const largeBox: BoundingBox = { x: 0, y: 0, width: 300, height: 300, nodeId: 'large' };
    const smallBox: BoundingBox = { x: 250, y: 250, width: 50, height: 50, nodeId: 'small' };

    spatialHash.insert(largeBox);
    spatialHash.insert(smallBox);

    const candidates = spatialHash.query(smallBox);

    expect(candidates.some((c) => c.nodeId === 'large')).toBe(true);
    expect(candidates.some((c) => c.nodeId === 'small')).toBe(true);
  });

  it('should clear all data', () => {
    const box: BoundingBox = { x: 0, y: 0, width: 50, height: 50, nodeId: 'test' };

    spatialHash.insert(box);
    spatialHash.clear();

    expect(spatialHash.getCellCount()).toBe(0);
  });

  it('should provide statistics', () => {
    const boxes = [
      { x: 0, y: 0, width: 50, height: 50, nodeId: 'a' },
      { x: 0, y: 0, width: 50, height: 50, nodeId: 'b' },
      { x: 200, y: 200, width: 50, height: 50, nodeId: 'c' },
    ];

    boxes.forEach((box) => spatialHash.insert(box));

    const stats = spatialHash.getStats();

    expect(stats.cellCount).toBeGreaterThan(0);
    expect(stats.totalObjects).toBeGreaterThan(0);
    expect(stats.maxObjectsPerCell).toBeGreaterThanOrEqual(1);
  });

  it('should rebuild with new cell size', () => {
    const boxes = [
      { x: 0, y: 0, width: 50, height: 50, nodeId: 'a' },
      { x: 100, y: 100, width: 50, height: 50, nodeId: 'b' },
    ];

    boxes.forEach((box) => spatialHash.insert(box));
    const initialCellCount = spatialHash.getCellCount();

    spatialHash.rebuild(50, boxes);

    // Smaller cells = more cells
    expect(spatialHash.getCellCount()).toBeGreaterThanOrEqual(initialCellCount);
  });
});

describe('spatial-hash utilities', () => {
  describe('calculateOptimalCellSize', () => {
    it('should calculate cell size based on box dimensions', () => {
      const boxes: BoundingBox[] = [
        { x: 0, y: 0, width: 100, height: 100, nodeId: 'a' },
        { x: 0, y: 0, width: 200, height: 150, nodeId: 'b' },
      ];

      const cellSize = calculateOptimalCellSize(boxes, 50);

      // Should be at least max dimension + clearance
      expect(cellSize).toBeGreaterThanOrEqual(250);
    });

    it('should return default for empty boxes', () => {
      const cellSize = calculateOptimalCellSize([]);

      expect(cellSize).toBe(DEFAULT_CELL_SIZE);
    });
  });

  describe('createPopulatedSpatialHash', () => {
    it('should create and populate spatial hash', () => {
      const boxes: BoundingBox[] = [
        { x: 0, y: 0, width: 50, height: 50, nodeId: 'a' },
        { x: 100, y: 100, width: 50, height: 50, nodeId: 'b' },
      ];

      const hash = createPopulatedSpatialHash(boxes);

      expect(hash.getCellCount()).toBeGreaterThan(0);
    });
  });

  describe('estimateCollisionChecks', () => {
    it('should estimate improvement from spatial hashing', () => {
      // Create spread out boxes
      const boxes: BoundingBox[] = Array.from({ length: 50 }, (_, i) => ({
        x: (i % 10) * 200,
        y: Math.floor(i / 10) * 200,
        width: 100,
        height: 100,
        nodeId: `box-${i}`,
      }));

      const estimate = estimateCollisionChecks(boxes, 200);

      expect(estimate.naiveChecks).toBe((50 * 49) / 2);
      expect(estimate.improvement).toBeGreaterThan(1);
    });
  });
});

// =============================================================================
// Edge Cases and Integration Tests
// =============================================================================

describe('edge cases', () => {
  it('should handle nodes at negative coordinates', () => {
    const nodes = [
      createDeviceNode('node-1', -100, -100, 100, 100),
      createDeviceNode('node-2', -50, -50, 100, 100),
    ];

    const overlaps = detectNodeOverlaps(nodes, 0);

    expect(overlaps).toHaveLength(1);
  });

  it('should handle very large clearance values', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 100, 100),
      createDeviceNode('node-2', 500, 0, 100, 100),
    ];

    const overlaps = detectNodeOverlaps(nodes, 1000);

    expect(overlaps).toHaveLength(1);
  });

  it('should handle zero-sized nodes gracefully', () => {
    const nodes = [
      createDeviceNode('node-1', 0, 0, 0, 0),
      createDeviceNode('node-2', 0, 0, 0, 0),
    ];

    // Should not throw
    const overlaps = detectNodeOverlaps(nodes, 0);
    expect(Array.isArray(overlaps)).toBe(true);
  });

  it('should handle identical positions', () => {
    const nodes = [
      createDeviceNode('node-1', 100, 100, 100, 100),
      createDeviceNode('node-2', 100, 100, 100, 100),
    ];

    const overlaps = detectNodeOverlaps(nodes, 0);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].severity).toBe(1); // Complete overlap
  });
});

describe('performance scenarios', () => {
  it('should handle grid layout efficiently', () => {
    // 10x10 grid of nodes with proper spacing
    const nodes = Array.from({ length: 100 }, (_, i) =>
      createDeviceNode(`node-${i}`, (i % 10) * 200, Math.floor(i / 10) * 200, 100, 100)
    );

    const start = performance.now();
    const result = detectCollisions(nodes, { minClearance: 50 });
    const elapsed = performance.now() - start;

    expect(result.collisionCount).toBe(0);
    // Should complete in reasonable time (< 100ms for 100 nodes)
    expect(elapsed).toBeLessThan(100);
  });

  it('should handle clustered nodes', () => {
    // All nodes in a small area
    const nodes = Array.from({ length: 20 }, (_, i) =>
      createDeviceNode(`node-${i}`, (i % 5) * 50, Math.floor(i / 5) * 50, 100, 100)
    );

    const result = detectCollisions(nodes, { minClearance: 0 });

    // Many overlaps expected in clustered layout
    expect(result.collisionCount).toBeGreaterThan(0);
  });
});
