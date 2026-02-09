/**
 * Dimension Calculator Service
 *
 * Unified dimension calculation for all nodes.
 * Ensures consistency across measurement, scaling, and layout.
 *
 * @module dimension-calculator
 */

import { AppNode, DeviceNodeData, BoundaryNodeData, GlobalSettings } from '@/lib/utils/types';
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig';
import {
  LayoutDimensions,
  createLayoutDimensions,
} from './layout-dimensions';
import { layoutLogger } from './layoutLogger';

/**
 * Node measurement data from DOM inspection
 */
export interface NodeMeasurement {
  nodeId: string;
  core: { width: number; height: number };
  label?: { width: number; height: number };
  total: { width: number; height: number };
}

// =============================================================================
// Types
// =============================================================================

export interface DimensionCalculatorOptions {
  /** Global device image size (20-100%) */
  globalDeviceImageSize: number;
  /** Global device label size in pixels */
  globalDeviceLabelSize: number;
  /** Enable spacing buffer for devices */
  enableSpacingBuffer: boolean;
}

// =============================================================================
// Calculator Class
// =============================================================================

export class LayoutDimensionCalculator {
  private options: DimensionCalculatorOptions;

  constructor(globalSettings: GlobalSettings) {
    this.options = {
      globalDeviceImageSize: globalSettings.globalDeviceImageSize || 55,
      globalDeviceLabelSize: globalSettings.globalDeviceLabelSize || 6,
      enableSpacingBuffer: true,
    };
  }

  /**
   * Calculate all dimensions for a node in one pass
   * Ensures consistency across all dimension types
   */
  calculateDimensions(
    node: AppNode,
    measurement?: NodeMeasurement
  ): LayoutDimensions {
    // Check if we're using ReactFlow's measured dimensions
    const usingReactFlowMeasured = !!(node.measured?.width && node.measured?.height);

    const nodeLabel = node.type === 'device' ? (node.data as any).label : (node.data as any).label;
    layoutLogger.debug(`[DimensionCalc] ${node.type} "${nodeLabel || node.id.slice(0, 8)}"`);
    layoutLogger.debug('[DimensionCalc] Input sources:', {
      'node.measured': node.measured ? `${node.measured.width}×${node.measured.height}` : 'NONE',
      'node.width': node.width || 'NONE',
      'node.height': node.height || 'NONE',
      'measurement': measurement ? `${measurement.core.width}×${measurement.core.height}` : 'NONE',
      'using': usingReactFlowMeasured ? 'ReactFlow measured' : 'fallback'
    });

    // Step 1: Get base core dimensions
    const baseDimensions = this.getCoreDimensions(node, measurement);
    layoutLogger.debug(`[DimensionCalc] Core dimensions: ${baseDimensions.width}×${baseDimensions.height}`);

    let visual: { width: number; height: number };
    let labelHeight = 0;

    if (usingReactFlowMeasured) {
      // ReactFlow's measured includes the ENTIRE rendered node (core + labels + all)
      // No need to add label height separately - it's already included!
      visual = {
        width: baseDimensions.width,
        height: baseDimensions.height,
      };

      layoutLogger.debug('[DimensionCalc] Using ReactFlow measured AS-IS (already includes labels)');

      // Still track label height for modifiers (useful for debugging)
      const labelSpace = this.calculateLabelSpace(node);
      labelHeight = labelSpace.height;
    } else {
      // For DOM measurements or defaults, we need to add label space
      // Step 2: Apply device image scaling (if applicable)
      const scaledCore = this.applyDeviceImageScaling(
        baseDimensions,
        node
      );

      const deviceImageSize = this.getDeviceImageSize(node);
      const scaleFactor = node.type === 'device' ? deviceImageSize / 55 : 1.0;
      layoutLogger.debug('[DimensionCalc] Device image scaling:', {
        deviceImageSize,
        scaleFactor,
        before: `${baseDimensions.width}×${baseDimensions.height}`,
        after: `${scaledCore.width}×${scaledCore.height}`
      });

      // Step 3: Calculate label dimensions
      const labelSpace = this.calculateLabelSpace(node);
      labelHeight = labelSpace.height;
      layoutLogger.debug(`[DimensionCalc] Label space: ${labelSpace.width}×${labelSpace.height}`);

      // Step 4: Calculate visual bounds (core + labels)
      visual = {
        width: Math.max(scaledCore.width, labelSpace.width),
        height: scaledCore.height + labelSpace.height,
      };

      layoutLogger.debug('[DimensionCalc] Fallback: manually calculated core + labels');
    }

    // Step 5: Calculate layout dimensions (with spacing buffer)
    const spacingBuffer = this.getSpacingBuffer(node);
    const layout = {
      width: visual.width + spacingBuffer,
      height: visual.height + spacingBuffer,
    };

    layoutLogger.debug('[DimensionCalc] Final dimensions:', {
      visual: `${visual.width}×${visual.height}`,
      layout: `${layout.width}×${layout.height}`,
      spacingBuffer
    });

    // Step 6: Collect modifiers
    const modifiers = {
      deviceImageSize: this.getDeviceImageSize(node),
      labelHeight: labelHeight,
      paddingAdjustment: spacingBuffer,
      scaleFactor: node.type === 'device' ? this.getDeviceImageSize(node) / 55 : 1.0,
    };

    return createLayoutDimensions(
      {
        core: baseDimensions,
        visual,
        layout,
        modifiers,
      },
      usingReactFlowMeasured ? 'reactflow-measured' : (measurement ? 'dom-measured' : 'calculated')
    );
  }

  /**
   * Get core dimensions from node or measurement
   *
   * Priority order (ReactFlow v12+):
   * 1. ReactFlow's measured dimensions (from ResizeObserver)
   * 2. DOM measurement (if provided - fallback for SSR or initial render)
   * 3. Explicit node.width/height (user-defined fixed dimensions)
   * 4. Default dimensions
   */
  private getCoreDimensions(
    node: AppNode,
    measurement?: NodeMeasurement
  ): { width: number; height: number } {
    // Priority 1: Use ReactFlow's measured dimensions (most accurate!)
    // ReactFlow uses ResizeObserver to measure rendered nodes
    // These are in flow coordinates (zoom-independent, transform-independent)
    if (node.measured?.width && node.measured?.height) {
      return {
        width: node.measured.width,
        height: node.measured.height,
      };
    }

    // Priority 2: Use DOM measurement if available (fallback for edge cases)
    // This is mainly for SSR or when ReactFlow hasn't measured yet
    if (measurement) {
      return {
        width: measurement.core.width,
        height: measurement.core.height,
      };
    }

    // Priority 3: Use explicit node dimensions (user-defined fixed size)
    if (node.width && node.height) {
      return {
        width: node.width,
        height: node.height,
      };
    }

    // Priority 4: Use defaults
    if (node.type === 'boundary') {
      return {
        width: LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH,
        height: LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT,
      };
    } else {
      return {
        width: LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH,
        height: LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT,
      };
    }
  }

  /**
   * Apply device image size scaling to core dimensions
   */
  private applyDeviceImageScaling(
    core: { width: number; height: number },
    node: AppNode
  ): { width: number; height: number } {
    if (node.type !== 'device') {
      return core;
    }

    const deviceImageSize = this.getDeviceImageSize(node);

    // Scale factor: image size percentage relative to default 55%
    // At 55% (default), scaleFactor = 1.0
    // At 100%, scaleFactor ≈ 1.82
    // At 20%, scaleFactor ≈ 0.36
    const scaleFactor = deviceImageSize / 55;

    return {
      width: Math.round(core.width * scaleFactor),
      height: Math.round(core.height * scaleFactor),
    };
  }

  /**
   * Calculate space needed for labels
   */
  private calculateLabelSpace(
    node: AppNode
  ): { width: number; height: number } {
    // For devices: labels appear below (add to height)
    if (node.type === 'device') {
      const deviceData = node.data as DeviceNodeData;
      const hasLabel = deviceData.label && deviceData.label.length > 0;

      if (!hasLabel) {
        return { width: 0, height: 0 };
      }

      // Label height = fontSize * lineHeight + spacing
      const fontSize = this.options.globalDeviceLabelSize;
      const lineHeight = 1.5;
      const spacing = 8;
      const labelHeight = Math.round(fontSize * lineHeight + spacing);

      return { width: 0, height: labelHeight };
    }

    // For boundaries: depends on label placement
    if (node.type === 'boundary') {
      const boundaryData = node.data as BoundaryNodeData;

      // Only add height if label is outside
      if (boundaryData.labelPlacement !== 'outside') {
        return { width: 0, height: 0 };
      }

      // Check if label is top/bottom positioned
      const position = boundaryData.labelPosition || 'bottom-center';
      if (!position.includes('top') && !position.includes('bottom')) {
        return { width: 0, height: 0 }; // Side labels don't add to height
      }

      const fontSize = boundaryData.labelSize || 14;
      const lineHeight = 1.5;
      const spacing = 12;
      const labelHeight = Math.round(fontSize * lineHeight + spacing);

      return { width: 0, height: labelHeight };
    }

    return { width: 0, height: 0 };
  }

  /**
   * Get spacing buffer for layout
   * Small buffer to prevent tight packing
   */
  private getSpacingBuffer(node: AppNode): number {
    if (!this.options.enableSpacingBuffer) {
      return 0;
    }

    // Boundaries don't need buffer (they have internal padding)
    if (node.type === 'boundary') {
      return 0;
    }

    // Devices get small buffer (10px) for breathing room
    return 10;
  }

  /**
   * Get effective device image size for a node
   */
  private getDeviceImageSize(node: AppNode): number {
    if (node.type !== 'device') {
      return this.options.globalDeviceImageSize;
    }

    const deviceData = node.data as DeviceNodeData;
    return deviceData.deviceImageSize ?? this.options.globalDeviceImageSize;
  }

  /**
   * Update options (useful for testing or runtime changes)
   */
  updateOptions(updates: Partial<DimensionCalculatorOptions>): void {
    this.options = { ...this.options, ...updates };
  }

  /**
   * Get current options
   */
  getOptions(): DimensionCalculatorOptions {
    return { ...this.options };
  }
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Calculate dimensions for multiple nodes
 */
export function calculateDimensionsForNodes(
  nodes: AppNode[],
  measurements: NodeMeasurement[],
  globalSettings: GlobalSettings
): Map<string, LayoutDimensions> {
  const calculator = new LayoutDimensionCalculator(globalSettings);
  const measurementMap = new Map(measurements.map(m => [m.nodeId, m]));
  const dimensionsMap = new Map<string, LayoutDimensions>();

  for (const node of nodes) {
    const measurement = measurementMap.get(node.id);
    const dimensions = calculator.calculateDimensions(node, measurement);
    dimensionsMap.set(node.id, dimensions);
  }

  return dimensionsMap;
}

/**
 * Apply calculated dimensions to nodes
 */
export function applyDimensionsToNodes(
  nodes: AppNode[],
  dimensionsMap: Map<string, LayoutDimensions>
): AppNode[] {
  return nodes.map(node => {
    const dimensions = dimensionsMap.get(node.id);
    if (!dimensions) {
      layoutLogger.warn(`[DimensionCalculator] No dimensions found for node ${node.id}`);
      return node;
    }

    return {
      ...node,
      // Apply visual dimensions to node.width/height for layout algorithm
      width: dimensions.visual.width,
      height: dimensions.visual.height,
      // IMPORTANT: Don't overwrite node.measured - ReactFlow owns this!
      // ReactFlow sets this via ResizeObserver, we should only read it
      // measured: { ... } ❌ DO NOT SET - this breaks ReactFlow's measurement system

      // Store complete dimension data for debugging
      data: {
        ...node.data,
        layoutDimensions: dimensions,
      },
    };
  });
}

export default {
  LayoutDimensionCalculator,
  calculateDimensionsForNodes,
  applyDimensionsToNodes,
};
