import { describe, it, expect } from 'vitest';
import {
  applyCollisionAvoidance,
  avoidCollisionForDraggedNode,
} from '@/lib/topology/collision-avoidance';
import type { AppNode, DeviceNodeData } from '@/lib/utils/types';

// =============================================================================
// Test Helpers
// =============================================================================

function createDeviceNode(
  id: string,
  x: number,
  y: number,
  width?: number,
  height?: number,
  parentId?: string
): AppNode {
  return {
    id,
    type: 'device',
    position: { x, y },
    data: {
      id,
      name: `Device ${id}`,
      deviceType: 'virtual-machine',
      iconPath: '',
    } as DeviceNodeData,
    ...(width && height ? { width, height } : {}),
    ...(parentId ? { parentId } : {}),
  };
}

// =============================================================================
// Collision Avoidance Tests
// =============================================================================

describe('Collision Avoidance', () => {
  describe('applyCollisionAvoidance', () => {
    it('should not nudge nodes that are far apart', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
        createDeviceNode('node2', 200, 0, 100, 80),
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
      });

      expect(result.hadCollisions).toBe(false);
      expect(result.nudgedCount).toBe(0);
      expect(result.nudgedPositions.size).toBe(0);
    });

    it('should nudge overlapping nodes apart', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
        createDeviceNode('node2', 50, 0, 100, 80), // Overlapping with node1
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
      });

      expect(result.hadCollisions).toBe(true);
      expect(result.nudgedCount).toBeGreaterThan(0);
      expect(result.nudgedPositions.size).toBeGreaterThan(0);
    });

    it('should nudge nodes that are too close (within clearance)', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
        createDeviceNode('node2', 105, 0, 100, 80), // Only 5px apart, need 20px clearance
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
      });

      expect(result.hadCollisions).toBe(true);
      expect(result.nudgedCount).toBeGreaterThan(0);

      // Verify nodes were pushed apart
      const node1NewPos = result.nudgedPositions.get('node1');
      const node2NewPos = result.nudgedPositions.get('node2');

      if (node1NewPos && node2NewPos) {
        // Distance should have increased
        const originalDistance = 105 - 0; // 105px
        const newDistance = Math.abs(node2NewPos.x - node1NewPos.x);
        expect(newDistance).toBeGreaterThan(originalDistance);
      }
    });

    it('should not nudge dragged nodes', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
        createDeviceNode('node2', 50, 0, 100, 80), // Overlapping
      ];

      const draggedNodeIds = new Set(['node1']);

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
        draggedNodeIds,
      });

      // Should still detect collisions
      expect(result.hadCollisions).toBe(true);

      // But node1 (dragged) should NOT be nudged
      expect(result.nudgedPositions.has('node1')).toBe(false);

      // Only node2 should be nudged
      if (result.nudgedCount > 0) {
        expect(result.nudgedPositions.has('node2')).toBe(true);
      }
    });

    it('should only check device nodes when devicesOnly is true', () => {
      const nodes: AppNode[] = [
        createDeviceNode('device1', 0, 0, 100, 80),
        {
          id: 'boundary1',
          type: 'boundary',
          position: { x: 50, y: 0 },
          width: 300,
          height: 200,
          data: { id: 'boundary1', label: 'Boundary', type: 'security_zone' },
        } as AppNode,
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
        devicesOnly: true,
      });

      // No device-to-device collision
      expect(result.hadCollisions).toBe(false);
      expect(result.nudgedCount).toBe(0);
    });

    it('should respect maxNudgeDistance per iteration', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
        createDeviceNode('node2', 10, 0, 100, 80), // Heavy overlap
      ];

      const maxNudgeDistance = 10;

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
        maxNudgeDistance,
        maxIterations: 1, // Single iteration to test per-iteration limit
      });

      expect(result.hadCollisions).toBe(true);
      expect(result.nudgedCount).toBeGreaterThan(0);

      // Check that nudges in a single iteration don't exceed maxNudgeDistance
      result.nudgedPositions.forEach((newPos, nodeId) => {
        const originalNode = nodes.find((n) => n.id === nodeId);
        if (originalNode) {
          const dx = newPos.x - originalNode.position.x;
          const dy = newPos.y - originalNode.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Per-iteration nudge should be limited to maxNudgeDistance
          expect(distance).toBeLessThanOrEqual(maxNudgeDistance + 1); // Small tolerance for floating point
        }
      });
    });

    it('should handle multiple nodes in a cluster', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 80, 60),
        createDeviceNode('node2', 20, 0, 80, 60),
        createDeviceNode('node3', 40, 0, 80, 60),
        createDeviceNode('node4', 0, 20, 80, 60),
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
        maxIterations: 3,
      });

      expect(result.hadCollisions).toBe(true);
      // All nodes should be nudged to resolve the cluster
      expect(result.nudgedCount).toBeGreaterThan(0);
    });

    it('should not check nodes with different parents', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 50, 50, 100, 80, 'parent1'),
        createDeviceNode('node2', 50, 50, 100, 80, 'parent2'), // Same position but different parent
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
      });

      // No collision because they're in different parent boundaries
      expect(result.hadCollisions).toBe(false);
      expect(result.nudgedCount).toBe(0);
    });
  });

  describe('avoidCollisionForDraggedNode', () => {
    it('should return null when no collision', () => {
      const draggedNode = createDeviceNode('dragged', 0, 0, 100, 80);
      const otherNodes: AppNode[] = [
        createDeviceNode('other', 200, 0, 100, 80),
      ];

      const result = avoidCollisionForDraggedNode(draggedNode, otherNodes, {
        minClearance: 20,
      });

      expect(result).toBeNull();
    });

    it('should return new position when collision detected', () => {
      const draggedNode = createDeviceNode('dragged', 50, 0, 100, 80);
      const otherNodes: AppNode[] = [
        createDeviceNode('other', 0, 0, 100, 80),
      ];

      const result = avoidCollisionForDraggedNode(draggedNode, otherNodes, {
        minClearance: 20,
      });

      expect(result).not.toBeNull();
      if (result) {
        // Should be pushed away from other node
        expect(result.x).toBeGreaterThan(draggedNode.position.x);
      }
    });

    it('should average nudges from multiple collisions', () => {
      const draggedNode = createDeviceNode('dragged', 100, 100, 80, 60);
      const otherNodes: AppNode[] = [
        createDeviceNode('left', 50, 100, 80, 60),
        createDeviceNode('right', 150, 100, 80, 60),
        createDeviceNode('top', 100, 50, 80, 60),
      ];

      const result = avoidCollisionForDraggedNode(draggedNode, otherNodes, {
        minClearance: 20,
      });

      expect(result).not.toBeNull();
      // Should be pushed in some direction based on averaged forces
    });

    it('should respect devicesOnly option', () => {
      const draggedNode: AppNode = {
        id: 'boundary',
        type: 'boundary',
        position: { x: 0, y: 0 },
        width: 300,
        height: 200,
        data: { id: 'boundary', label: 'Boundary', type: 'security_zone' },
      };

      const otherNodes: AppNode[] = [
        createDeviceNode('device', 10, 10, 100, 80),
      ];

      const result = avoidCollisionForDraggedNode(draggedNode, otherNodes, {
        minClearance: 20,
        devicesOnly: true,
      });

      // Should not avoid collision because dragged node is not a device
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes exactly on top of each other', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
        createDeviceNode('node2', 0, 0, 100, 80), // Exactly same position
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
      });

      expect(result.hadCollisions).toBe(true);
      expect(result.nudgedCount).toBeGreaterThan(0);

      // Should nudge them apart in some default direction
      const pos1 = result.nudgedPositions.get('node1');
      const pos2 = result.nudgedPositions.get('node2');

      if (pos1 && pos2) {
        // They should no longer be at the same position
        expect(pos1.x !== pos2.x || pos1.y !== pos2.y).toBe(true);
      }
    });

    it('should handle empty node array', () => {
      const result = applyCollisionAvoidance([], {
        minClearance: 20,
      });

      expect(result.hadCollisions).toBe(false);
      expect(result.nudgedCount).toBe(0);
      expect(result.nudgedPositions.size).toBe(0);
    });

    it('should handle single node', () => {
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 100, 80),
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
      });

      expect(result.hadCollisions).toBe(false);
      expect(result.nudgedCount).toBe(0);
    });

    it('should limit iterations to maxIterations', () => {
      // Create a dense cluster that would need many iterations to resolve
      const nodes: AppNode[] = [
        createDeviceNode('node1', 0, 0, 80, 60),
        createDeviceNode('node2', 10, 0, 80, 60),
        createDeviceNode('node3', 20, 0, 80, 60),
        createDeviceNode('node4', 30, 0, 80, 60),
        createDeviceNode('node5', 0, 10, 80, 60),
        createDeviceNode('node6', 10, 10, 80, 60),
      ];

      const result = applyCollisionAvoidance(nodes, {
        minClearance: 20,
        maxIterations: 1, // Only one iteration
      });

      // Should still detect collisions but may not fully resolve them
      expect(result.hadCollisions).toBe(true);
    });
  });
});
