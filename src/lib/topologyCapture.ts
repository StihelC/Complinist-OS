/**
 * Topology Capture Utility
 *
 * Captures ReactFlow canvas as base64 SVG for embedding in SSP PDFs.
 * Uses vector-based SVG export for infinite zoom and crisp rendering.
 */

import type { Node, Rect } from '@xyflow/react';
import {
  exportTopologyAsSVGBase64,
  type SVGExportOptions
} from './export/svgExport';
import { getFlowStoreStateSafe } from '@/core/stores/flowStoreAccessor';

/**
 * Default SVG export options for topology capture
 * Enhanced for high-quality vector output suitable for professional documentation
 */
const DEFAULT_OPTIONS: SVGExportOptions = {
  width: 1600,
  height: 1200,
  backgroundColor: '#ffffff',
  minZoom: 0.3,
  maxZoom: 1.5,
  padding: 0.15,
};

/**
 * Capture topology as base64 SVG using vector export
 * 
 * This function uses React Flow's node bounds calculation to properly
 * fit all nodes in the exported SVG. Falls back to manual calculation if needed.
 */
export async function captureTopologyAsBase64(): Promise<string | undefined> {
  console.log('[Topology Capture] Starting SVG export...');

  // Get nodes, edges, and React Flow instance from the store
  // Using the flowStoreAccessor to avoid circular dependencies
  const flowStore = getFlowStoreStateSafe();
  if (!flowStore) {
    console.warn('[Topology Capture] Flow store not available');
    return undefined;
  }
  const { nodes, edges, reactFlowInstance, globalSettings } = flowStore;
  
  if (!nodes || nodes.length === 0) {
    console.warn('[Topology Capture] No nodes in the diagram - topology image will not be included.');
    return undefined;
  }

  try {
    console.log('[Topology Capture] Exporting', nodes.length, 'nodes and', edges.length, 'edges as SVG');
    
    // getNodesBounds is optional - we have a fallback in svgExport.ts
    const getNodesBounds = reactFlowInstance?.getNodesBounds as ((nodes: Node[]) => Rect) | undefined;
    
    const base64Svg = await exportTopologyAsSVGBase64(
      nodes,
      edges,
      getNodesBounds,
      {
        globalDeviceImageSize: globalSettings.globalDeviceImageSize,
        globalBoundaryLabelSize: globalSettings.globalBoundaryLabelSize,
        globalDeviceLabelSize: globalSettings.globalDeviceLabelSize,
        globalConnectionLabelSize: globalSettings.globalConnectionLabelSize,
      },
      DEFAULT_OPTIONS
    );
    
    console.log('[Topology Capture] SVG export successful, size:', base64Svg.length, 'characters');
    return base64Svg;
  } catch (error) {
    console.error('[Topology Capture] Failed to export SVG:', error);
    return undefined;
  }
}

/**
 * Capture topology with custom options
 */
export async function captureTopologyWithOptions(
  options: Partial<SVGExportOptions> = {}
): Promise<string | undefined> {
  // Using the flowStoreAccessor to avoid circular dependencies
  const flowStore = getFlowStoreStateSafe();
  if (!flowStore) {
    console.warn('[Topology Capture] Flow store not available');
    return undefined;
  }
  const { nodes, edges, reactFlowInstance, globalSettings } = flowStore;
  
  if (!nodes || nodes.length === 0) {
    console.warn('[Topology Capture] No nodes in the diagram');
    return undefined;
  }

  try {
    const getNodesBounds = reactFlowInstance?.getNodesBounds as ((nodes: Node[]) => Rect) | undefined;
    
    return await exportTopologyAsSVGBase64(
      nodes,
      edges,
      getNodesBounds,
      {
        globalDeviceImageSize: globalSettings.globalDeviceImageSize,
        globalBoundaryLabelSize: globalSettings.globalBoundaryLabelSize,
        globalDeviceLabelSize: globalSettings.globalDeviceLabelSize,
        globalConnectionLabelSize: globalSettings.globalConnectionLabelSize,
      },
      { ...DEFAULT_OPTIONS, ...options }
    );
  } catch (error) {
    console.error('[Topology Capture] Failed to export SVG:', error);
    return undefined;
  }
}

/**
 * Get current topology as a data URL (for preview purposes)
 * @deprecated SVG export does not need data URL format for previews
 */
export async function captureTopologyAsDataUrl(): Promise<string | undefined> {
  console.warn('[Topology Capture] captureTopologyAsDataUrl is deprecated with SVG export');
  const base64 = await captureTopologyAsBase64();
  return base64 ? `data:image/svg+xml;base64,${base64}` : undefined;
}

