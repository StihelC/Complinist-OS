/**
 * Modern Export Utilities Using SVG System
 * 
 * Exports topology diagrams as SVG or PNG using the new SVG generation system.
 * This replaces the old Electron viewport capture approach with a more reliable
 * vector-based export that works consistently and produces high-quality output.
 */

import { AppNode, AppEdge } from '@/lib/utils/types';
import { exportTopologyAsSVG } from './svgExport';
import type { Node, Rect } from '@xyflow/react';

export interface ExportOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  format?: 'svg' | 'png';
}

/**
 * Export diagram as SVG file
 */
export async function exportDiagramAsSVG(
  projectName: string,
  nodes: AppNode[],
  edges: AppEdge[],
  getNodesBounds: ((nodes: Node[]) => Rect) | undefined,
  globalSettings: { globalDeviceImageSize: number; globalBoundaryLabelSize: number; globalDeviceLabelSize: number; globalConnectionLabelSize: number },
  options: ExportOptions = {}
): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API not available' };
  }

  if (!nodes || nodes.length === 0) {
    return { success: false, error: 'No nodes to export' };
  }

  try {
    console.log('[SVG Export] Starting SVG export for', nodes.length, 'nodes');
    
    // Generate SVG
    const svgContent = await exportTopologyAsSVG(
      nodes,
      edges,
      getNodesBounds,
      globalSettings,
      {
        width: options.width || 1600,
        height: options.height || 1200,
        backgroundColor: options.backgroundColor || '#ffffff',
      }
    );

    // Save SVG file using Electron API
    const result = await window.electronAPI.exportSVG({
      projectName,
      svgContent,
    });

    if (result.success) {
      console.log('[SVG Export] Export successful:', result.filePath);
    }

    return result;
  } catch (error) {
    console.error('[SVG Export] Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during SVG export',
    };
  }
}

/**
 * Export diagram as PNG file (converts SVG to PNG)
 */
export async function exportDiagramAsPNGFromSVG(
  projectName: string,
  nodes: AppNode[],
  edges: AppEdge[],
  getNodesBounds: ((nodes: Node[]) => Rect) | undefined,
  globalSettings: { globalDeviceImageSize: number; globalBoundaryLabelSize: number; globalDeviceLabelSize: number; globalConnectionLabelSize: number },
  options: ExportOptions = {}
): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API not available' };
  }

  if (!nodes || nodes.length === 0) {
    return { success: false, error: 'No nodes to export' };
  }

  try {
    console.log('[PNG Export] Starting PNG export for', nodes.length, 'nodes');
    
    // Generate SVG first
    const svgContent = await exportTopologyAsSVG(
      nodes,
      edges,
      getNodesBounds,
      globalSettings,
      {
        width: options.width || 2400,  // Higher resolution for PNG
        height: options.height || 1800,
        backgroundColor: options.backgroundColor || '#ffffff',
      }
    );

    // Convert SVG to PNG and save using Electron API
    const result = await window.electronAPI.exportPNGFromSVG({
      projectName,
      svgContent,
      width: options.width || 2400,
      height: options.height || 1800,
    });

    if (result.success) {
      console.log('[PNG Export] Export successful:', result.filePath);
    }

    return result;
  } catch (error) {
    console.error('[PNG Export] Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during PNG export',
    };
  }
}

