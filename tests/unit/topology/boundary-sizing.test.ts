/**
 * Unit tests for Intelligent Boundary Node Sizing
 */

import { describe, it, expect } from 'vitest';
import { Node } from '@xyflow/react';
import {
  calculateOptimalSize,
  calculateOptimalBoundarySize,
  calculateChildrenBounds,
  calculateChildrenOffset,
  deviceAlignmentToLayoutDirection,
  layoutDirectionToSizing,
  validateSizeQuality,
  BOUNDARY_SIZING_DEFAULTS,
  ASPECT_RATIO_PREFERENCES,
  type LayoutDirectionSizing,
} from '@/lib/topology/boundary-sizing';

// Helper to create mock nodes
function createMockNode(
  id: string,
  position: { x: number; y: number },
  dimensions?: { width?: number; height?: number }
): Node {
  return {
    id,
    position,
    data: {},
    type: 'device',
    width: dimensions?.width,
    height: dimensions?.height,
  } as Node;
}

// Helper to create mock boundary node
function createMockBoundary(id: string): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label: 'Test Boundary', type: 'network_segment' },
    type: 'boundary',
  } as Node;
}

describe('boundary-sizing', () => {
  describe('calculateChildrenBounds', () => {
    it('should return null for empty children array', () => {
      const result = calculateChildrenBounds([]);
      expect(result).toBeNull();
    });

    it('should calculate bounds for a single child', () => {
      const children = [createMockNode('node-1', { x: 50, y: 100 }, { width: 120, height: 150 })];
      const result = calculateChildrenBounds(children);

      expect(result).not.toBeNull();
      expect(result?.minX).toBe(50);
      expect(result?.minY).toBe(100);
      expect(result?.maxX).toBe(170); // 50 + 120
      expect(result?.maxY).toBe(250); // 100 + 150
      expect(result?.contentWidth).toBe(120);
      expect(result?.contentHeight).toBe(150);
    });

    it('should calculate bounds for multiple children', () => {
      const children = [
        createMockNode('node-1', { x: 0, y: 0 }, { width: 100, height: 100 }),
        createMockNode('node-2', { x: 200, y: 150 }, { width: 100, height: 100 }),
        createMockNode('node-3', { x: 50, y: 300 }, { width: 100, height: 100 }),
      ];
      const result = calculateChildrenBounds(children);

      expect(result).not.toBeNull();
      expect(result?.minX).toBe(0);
      expect(result?.minY).toBe(0);
      expect(result?.maxX).toBe(300); // 200 + 100
      expect(result?.maxY).toBe(400); // 300 + 100
      expect(result?.contentWidth).toBe(300);
      expect(result?.contentHeight).toBe(400);
    });

    it('should handle children with negative positions', () => {
      const children = [
        createMockNode('node-1', { x: -50, y: -30 }, { width: 100, height: 100 }),
        createMockNode('node-2', { x: 100, y: 100 }, { width: 100, height: 100 }),
      ];
      const result = calculateChildrenBounds(children);

      expect(result).not.toBeNull();
      expect(result?.minX).toBe(-50);
      expect(result?.minY).toBe(-30);
      expect(result?.maxX).toBe(200);
      expect(result?.maxY).toBe(200);
    });

    it('should use default dimensions when node dimensions are not set', () => {
      const children = [createMockNode('node-1', { x: 0, y: 0 })];
      const result = calculateChildrenBounds(children);

      expect(result).not.toBeNull();
      // Should use DEVICE_DEFAULT_WIDTH (140) and DEVICE_DEFAULT_HEIGHT (110)
      expect(result?.contentWidth).toBe(140);
      expect(result?.contentHeight).toBe(110);
    });
  });

  describe('calculateOptimalSize', () => {
    describe('empty boundaries', () => {
      it('should return minimum size for empty boundary', () => {
        const boundary = createMockBoundary('boundary-1');
        const result = calculateOptimalSize(boundary, [], 'TB');

        expect(result.width).toBe(BOUNDARY_SIZING_DEFAULTS.MIN_WIDTH);
        expect(result.height).toBe(BOUNDARY_SIZING_DEFAULTS.MIN_HEIGHT);
        expect(result.usedMinimumDimensions).toBe(true);
      });

      it('should calculate correct aspect ratio for empty boundary', () => {
        const boundary = createMockBoundary('boundary-1');
        const result = calculateOptimalSize(boundary, [], 'TB');

        const expectedRatio = BOUNDARY_SIZING_DEFAULTS.MIN_WIDTH / BOUNDARY_SIZING_DEFAULTS.MIN_HEIGHT;
        expect(result.aspectRatio).toBeCloseTo(expectedRatio, 2);
      });
    });

    describe('single child', () => {
      it('should size boundary to child + padding', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 100, height: 100 })];
        const padding = 40;
        const result = calculateOptimalSize(boundary, children, 'TB', { padding });

        expect(result.width).toBe(BOUNDARY_SIZING_DEFAULTS.MIN_WIDTH); // 100 + 80 = 180, but min is 300
        expect(result.height).toBe(BOUNDARY_SIZING_DEFAULTS.MIN_HEIGHT); // 100 + 80 = 180, but min is 200
      });

      it('should use custom padding', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 250, height: 150 })];
        const result = calculateOptimalSize(boundary, children, 'TB', { padding: 50 });

        expect(result.width).toBe(350); // 250 + 100
        expect(result.height).toBe(250); // 150 + 100
      });
    });

    describe('multiple children', () => {
      it('should calculate bounding box for all children', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [
          createMockNode('node-1', { x: 0, y: 0 }, { width: 100, height: 100 }),
          createMockNode('node-2', { x: 200, y: 0 }, { width: 100, height: 100 }),
          createMockNode('node-3', { x: 100, y: 150 }, { width: 100, height: 100 }),
        ];
        const padding = 40;
        const result = calculateOptimalSize(boundary, children, 'TB', { padding });

        // Content: 300 wide (0 to 300), 250 tall (0 to 250)
        expect(result.width).toBe(380); // 300 + 80
        expect(result.height).toBe(330); // 250 + 80
      });

      it('should include children bounds in result', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [
          createMockNode('node-1', { x: 10, y: 20 }, { width: 100, height: 100 }),
          createMockNode('node-2', { x: 200, y: 150 }, { width: 100, height: 100 }),
        ];
        const result = calculateOptimalSize(boundary, children, 'TB');

        expect(result.childrenBounds.minX).toBe(10);
        expect(result.childrenBounds.minY).toBe(20);
        expect(result.childrenBounds.maxX).toBe(300);
        expect(result.childrenBounds.maxY).toBe(250);
      });
    });

    describe('minimum dimensions', () => {
      it('should enforce minimum width', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 50, height: 300 })];
        const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });

        expect(result.width).toBe(BOUNDARY_SIZING_DEFAULTS.MIN_WIDTH);
        expect(result.usedMinimumDimensions).toBe(true);
      });

      it('should enforce minimum height', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 400, height: 50 })];
        const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });

        expect(result.height).toBe(BOUNDARY_SIZING_DEFAULTS.MIN_HEIGHT);
        expect(result.usedMinimumDimensions).toBe(true);
      });

      it('should allow custom minimum dimensions', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 50, height: 50 })];
        const result = calculateOptimalSize(boundary, children, 'TB', {
          padding: 20,
          minWidth: 500,
          minHeight: 400,
        });

        expect(result.width).toBe(500);
        expect(result.height).toBe(400);
      });
    });

    describe('layout direction aspect ratio preferences', () => {
      it('should not adjust aspect ratio by default', () => {
        const boundary = createMockBoundary('boundary-1');
        // Square content large enough to exceed minimums
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 220, height: 220 })];
        const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });

        // 300 x 300 = square, ratio = 1.0
        expect(result.aspectRatio).toBeCloseTo(1.0, 1);
      });

      it('should adjust aspect ratio for TB layout when enabled', () => {
        const boundary = createMockBoundary('boundary-1');
        // Wide content
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 500, height: 200 })];
        const result = calculateOptimalSize(boundary, children, 'TB', {
          padding: 40,
          adjustAspectRatio: true,
        });

        // TB prefers taller (ratio 0.6-0.9), so height should increase
        expect(result.aspectRatio).toBeLessThanOrEqual(ASPECT_RATIO_PREFERENCES.TB.max);
      });

      it('should adjust aspect ratio for LR layout when enabled', () => {
        const boundary = createMockBoundary('boundary-1');
        // Tall content
        const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 200, height: 500 })];
        const result = calculateOptimalSize(boundary, children, 'LR', {
          padding: 40,
          adjustAspectRatio: true,
        });

        // LR prefers wider (ratio 1.2-1.8), so width should increase
        expect(result.aspectRatio).toBeGreaterThanOrEqual(ASPECT_RATIO_PREFERENCES.LR.min);
      });
    });

    describe('children partially outside', () => {
      it('should expand to include all children', () => {
        const boundary = createMockBoundary('boundary-1');
        const children = [
          createMockNode('node-1', { x: -100, y: -50 }, { width: 100, height: 100 }),
          createMockNode('node-2', { x: 300, y: 200 }, { width: 100, height: 100 }),
        ];
        const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });

        // Content: from -100 to 400 (width 500), from -50 to 300 (height 350)
        expect(result.width).toBe(580); // 500 + 80
        expect(result.height).toBe(430); // 350 + 80
      });
    });
  });

  describe('calculateOptimalBoundarySize', () => {
    it('should return simplified result matching spec signature', () => {
      const boundary = createMockBoundary('boundary-1');
      const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 200, height: 200 })];
      const result = calculateOptimalBoundarySize(boundary, children, 'TB', 40);

      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('aspectRatio');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('should use default padding when not provided', () => {
      const boundary = createMockBoundary('boundary-1');
      const children = [createMockNode('node-1', { x: 0, y: 0 }, { width: 300, height: 200 })];
      const result = calculateOptimalBoundarySize(boundary, children, 'TB');

      // Default padding is 40, so 300 + 80 = 380, 200 + 80 = 280
      expect(result.width).toBe(380);
      expect(result.height).toBe(280);
    });
  });

  describe('deviceAlignmentToLayoutDirection', () => {
    it('should convert dagre-tb to TB', () => {
      expect(deviceAlignmentToLayoutDirection('dagre-tb')).toBe('TB');
    });

    it('should convert dagre-bt to BT', () => {
      expect(deviceAlignmentToLayoutDirection('dagre-bt')).toBe('BT');
    });

    it('should convert dagre-lr to LR', () => {
      expect(deviceAlignmentToLayoutDirection('dagre-lr')).toBe('LR');
    });

    it('should convert dagre-rl to RL', () => {
      expect(deviceAlignmentToLayoutDirection('dagre-rl')).toBe('RL');
    });

    it('should default to TB for unknown values', () => {
      expect(deviceAlignmentToLayoutDirection('none')).toBe('TB');
      expect(deviceAlignmentToLayoutDirection('unknown')).toBe('TB');
      expect(deviceAlignmentToLayoutDirection('')).toBe('TB');
    });
  });

  describe('layoutDirectionToSizing', () => {
    it('should convert DOWN to TB', () => {
      expect(layoutDirectionToSizing('DOWN')).toBe('TB');
    });

    it('should convert UP to BT', () => {
      expect(layoutDirectionToSizing('UP')).toBe('BT');
    });

    it('should convert RIGHT to LR', () => {
      expect(layoutDirectionToSizing('RIGHT')).toBe('LR');
    });

    it('should convert LEFT to RL', () => {
      expect(layoutDirectionToSizing('LEFT')).toBe('RL');
    });
  });

  describe('calculateChildrenOffset', () => {
    it('should calculate offset to position children at padding distance', () => {
      const result = calculateChildrenOffset({ minX: 50, minY: 30 }, 40);

      expect(result.offsetX).toBe(-10); // 40 - 50
      expect(result.offsetY).toBe(10); // 40 - 30
    });

    it('should handle negative positions', () => {
      const result = calculateChildrenOffset({ minX: -20, minY: -10 }, 40);

      expect(result.offsetX).toBe(60); // 40 - (-20)
      expect(result.offsetY).toBe(50); // 40 - (-10)
    });

    it('should handle zero offset when already at padding', () => {
      const result = calculateChildrenOffset({ minX: 40, minY: 40 }, 40);

      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
    });
  });

  describe('validateSizeQuality', () => {
    it('should validate normal aspect ratios', () => {
      const result = validateSizeQuality(
        {
          width: 400,
          height: 500,
          aspectRatio: 0.8,
          childrenBounds: { minX: 0, minY: 0, maxX: 320, maxY: 420, contentWidth: 320, contentHeight: 420 },
          usedMinimumDimensions: false,
        },
        'TB'
      );

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect extremely tall boundaries', () => {
      const result = validateSizeQuality(
        {
          width: 100,
          height: 500,
          aspectRatio: 0.2,
          childrenBounds: { minX: 0, minY: 0, maxX: 20, maxY: 420, contentWidth: 20, contentHeight: 420 },
          usedMinimumDimensions: false,
        },
        'TB'
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('extremely tall'))).toBe(true);
    });

    it('should detect extremely wide boundaries', () => {
      const result = validateSizeQuality(
        {
          width: 1000,
          height: 200,
          aspectRatio: 5.0,
          childrenBounds: { minX: 0, minY: 0, maxX: 920, maxY: 120, contentWidth: 920, contentHeight: 120 },
          usedMinimumDimensions: false,
        },
        'TB'
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('extremely wide'))).toBe(true);
    });

    it('should warn when aspect ratio does not match direction preference', () => {
      // TB prefers 0.6-0.9, but this is 1.5
      const result = validateSizeQuality(
        {
          width: 450,
          height: 300,
          aspectRatio: 1.5,
          childrenBounds: { minX: 0, minY: 0, maxX: 370, maxY: 220, contentWidth: 370, contentHeight: 220 },
          usedMinimumDimensions: false,
        },
        'TB'
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('outside preferred range'))).toBe(true);
    });

    it('should accept aspect ratios within LR preference', () => {
      // LR prefers 1.2-1.8, and this is 1.5
      const result = validateSizeQuality(
        {
          width: 450,
          height: 300,
          aspectRatio: 1.5,
          childrenBounds: { minX: 0, minY: 0, maxX: 370, maxY: 220, contentWidth: 370, contentHeight: 220 },
          usedMinimumDimensions: false,
        },
        'LR'
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle nested boundaries as children', () => {
      const boundary = createMockBoundary('parent-boundary');
      const children = [
        {
          ...createMockBoundary('child-boundary'),
          position: { x: 50, y: 50 },
          width: 400,
          height: 300,
        } as Node,
      ];
      const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });

      expect(result.width).toBe(480); // 400 + 80
      expect(result.height).toBe(380); // 300 + 80
    });

    it('should handle very large numbers of children efficiently', () => {
      const boundary = createMockBoundary('boundary-1');
      const children: Node[] = [];
      for (let i = 0; i < 100; i++) {
        children.push(createMockNode(`node-${i}`, { x: (i % 10) * 150, y: Math.floor(i / 10) * 180 }, { width: 100, height: 120 }));
      }

      const start = performance.now();
      const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });
      const duration = performance.now() - start;

      // Should complete quickly (< 50ms for 100 nodes)
      expect(duration).toBeLessThan(50);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should handle nodes with measured dimensions', () => {
      const boundary = createMockBoundary('boundary-1');
      const children = [
        {
          id: 'node-1',
          position: { x: 0, y: 0 },
          data: {},
          type: 'device',
          measured: { width: 180, height: 200 },
        } as Node,
      ];
      const result = calculateOptimalSize(boundary, children, 'TB', { padding: 40 });

      // Should use measured dimensions (180x200) not defaults
      expect(result.childrenBounds.contentWidth).toBe(180);
      expect(result.childrenBounds.contentHeight).toBe(200);
    });
  });
});
