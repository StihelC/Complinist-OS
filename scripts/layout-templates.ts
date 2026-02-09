#!/usr/bin/env tsx
/**
 * Offline Template Layout Script
 *
 * This script pre-computes optimal positions for all sample project templates.
 * Run this script after modifying templates to ensure proper node spacing.
 *
 * Usage:
 *   npm run layout:templates
 *
 * What it does:
 * 1. Loads all sample templates
 * 2. Applies Dagre layout to each boundary
 * 3. Updates node positions in-place
 * 4. Writes formatted results back to sampleProjects.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import layout dependencies
import dagre from 'dagre';
import type { AppNode, AppEdge } from '../src/lib/utils/types';
import { LAYOUT_CONSTANTS } from '../src/lib/layout/layoutConfig';
import { sampleProjects } from '../src/lib/samples/sampleProjects';
import { detectGraphTopology } from '../src/lib/topology/flowAnalysis';
import { 
  selectOptimalRanker, 
  calculateEdgeWeight, 
  calculateEdgeMinlen 
} from '../src/lib/topology/dagre-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculate layout quality score - lower is better
 * Measures edge crossings, edge lengths, and space utilization
 */
function calculateLayoutQuality(
  g: any,
  childNodes: AppNode[],
  relevantEdges: AppEdge[],
  boundaryWidth: number,
  boundaryHeight: number
): number {
  const graphAttrs = g.graph();
  const graphWidth = graphAttrs.width || boundaryWidth;
  const graphHeight = graphAttrs.height || boundaryHeight;
  
  // Get node positions
  const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  childNodes.forEach((node) => {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      nodePositions.set(node.id, {
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      });
    }
  });

  // Calculate edge crossings (simplified - count overlapping edges)
  let crossingScore = 0;
  for (let i = 0; i < relevantEdges.length; i++) {
    for (let j = i + 1; j < relevantEdges.length; j++) {
      const e1 = relevantEdges[i];
      const e2 = relevantEdges[j];
      
      const pos1 = nodePositions.get(e1.source);
      const pos2 = nodePositions.get(e1.target);
      const pos3 = nodePositions.get(e2.source);
      const pos4 = nodePositions.get(e2.target);
      
      if (pos1 && pos2 && pos3 && pos4) {
        // Check if edges share endpoints (not a crossing)
        if (
          (e1.source === e2.source || e1.source === e2.target ||
           e1.target === e2.source || e1.target === e2.target)
        ) {
          continue;
        }
        
        // Calculate if lines intersect (simplified)
        const x1 = pos1.x;
        const y1 = pos1.y;
        const x2 = pos2.x;
        const y2 = pos2.y;
        const x3 = pos3.x;
        const y3 = pos3.y;
        const x4 = pos4.x;
        const y4 = pos4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) > 0.001) {
          const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
          const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
          
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            crossingScore += 10; // Heavy penalty for crossings
          }
        }
      }
    }
  }

  // Calculate average edge length (shorter is better)
  let totalEdgeLength = 0;
  relevantEdges.forEach((edge) => {
    const pos1 = nodePositions.get(edge.source);
    const pos2 = nodePositions.get(edge.target);
    if (pos1 && pos2) {
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      totalEdgeLength += Math.sqrt(dx * dx + dy * dy);
    }
  });
  const avgEdgeLength = relevantEdges.length > 0 ? totalEdgeLength / relevantEdges.length : 0;

  // Space utilization (closer to boundary size is better)
  const spaceUtilization = (graphWidth * graphHeight) / (boundaryWidth * boundaryHeight);
  const spacePenalty = spaceUtilization > 1.1 ? (spaceUtilization - 1.1) * 100 : 0; // Penalty for exceeding boundary
  const underutilizationPenalty = spaceUtilization < 0.5 ? (0.5 - spaceUtilization) * 50 : 0; // Penalty for too much empty space

  // Total quality score (lower is better)
  return crossingScore + avgEdgeLength * 0.1 + spacePenalty + underutilizationPenalty;
}

// Enhanced version of applyDagreLayout for offline use with edge optimization
// Uses default globalDeviceImageSize of 55% (the application default)
// Tries multiple configurations and selects the best based on edge routing quality
function layoutBoundaryChildren(
  boundaryId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  boundaryWidth: number,
  boundaryHeight: number,
  globalDeviceImageSize: number = 55
): AppNode[] {
  const childNodes = nodes.filter((n) => n.parentId === boundaryId);

  if (childNodes.length === 0) {
    return nodes;
  }

  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const relevantEdges = edges.filter(
    (edge) => childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
  );

  // Detect graph topology for optimal ranker selection
  const topology = detectGraphTopology(childNodes, relevantEdges);

  // Determine which rankers and align options to try for best edge positioning
  const rankersToTry: Array<'network-simplex' | 'tight-tree' | 'longest-path'> = [];
  const optimalRanker = selectOptimalRanker(topology, childNodes.length);
  
  // Try optimal ranker first, then try others if we have time
  rankersToTry.push(optimalRanker);
  if (optimalRanker !== 'network-simplex') rankersToTry.push('network-simplex');
  if (optimalRanker !== 'longest-path') rankersToTry.push('longest-path');
  if (optimalRanker !== 'tight-tree' && childNodes.length < 50) rankersToTry.push('tight-tree');

  // Try different align options for better node positioning
  const alignOptions: Array<'UL' | 'UR' | 'DL' | 'DR' | undefined> = [
    undefined, // Let Dagre choose
    'UL', // Upper Left
    'UR', // Upper Right
  ];

  let bestGraph: any = null;
  let bestQuality = Infinity;
  let bestConfig: { ranker: string; align?: string } | null = null;

  // Try multiple configurations and pick the best for optimal edge routing
  for (const ranker of rankersToTry) {
    for (const align of alignOptions) {
      try {
        // Create a new dagre graph for this configuration
        const g = new dagre.graphlib.Graph();

        // Set graph properties
        g.setGraph({
          rankdir: 'TB',
          nodesep: 180, // Increased for 100% image size support
          ranksep: 240, // Increased for labels + 100% image size
          edgesep: 50,
          ranker: ranker,
          align: align,
          acyclicer: 'greedy',
          marginx: 120,
          marginy: 120,
        });

        g.setDefaultEdgeLabel(() => ({}));

        // Add nodes with their actual dimensions
        childNodes.forEach((node) => {
          let nodeWidth: number;
          let nodeHeight: number;

          if (node.type === 'boundary') {
            const style = node.style as any;
            nodeWidth = style?.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
            nodeHeight = style?.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;
          } else {
            nodeWidth = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
            nodeHeight = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
          }

          g.setNode(node.id, {
            width: nodeWidth,
            height: nodeHeight,
            id: node.id,
          });
        });

        // Add edges using enhanced weight and minlen calculations for better positioning
        relevantEdges.forEach((edge) => {
          const dataFlow = edge.data?.dataFlow;
          
          if (dataFlow === 'target-to-source') {
            // Reverse edge - swap source and target for layout
            const weight = calculateEdgeWeight(edge);
            const minlen = calculateEdgeMinlen(edge);
            g.setEdge(edge.target, edge.source, {
              id: edge.id,
              minlen: minlen,
              weight: weight,
            });
          } else {
            // Use enhanced edge weight and minlen calculations
            const weight = calculateEdgeWeight(edge);
            const minlen = calculateEdgeMinlen(edge);
            g.setEdge(edge.source, edge.target, {
              id: edge.id,
              minlen: minlen,
              weight: weight,
            });
          }
        });

        // Run the layout algorithm
        dagre.layout(g);

        // Calculate quality score for this layout (minimizing edge crossings and length)
        const quality = calculateLayoutQuality(
          g,
          childNodes,
          relevantEdges,
          boundaryWidth,
          boundaryHeight
        );

        // Keep track of the best layout
        if (quality < bestQuality) {
          bestQuality = quality;
          bestGraph = g;
          bestConfig = { ranker, align };
        }
      } catch (error) {
        // Continue to next configuration if this one fails
        console.warn(`Dagre layout failed for ranker=${ranker}, align=${align}:`, error);
      }
    }
  }

  // Use the best layout found, or fall back to single attempt if all failed
  if (!bestGraph) {
    // Fallback: try with default configuration
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',
      nodesep: 180,
      ranksep: 240,
      edgesep: 50,
      ranker: optimalRanker,
      acyclicer: 'greedy',
      marginx: 120,
      marginy: 120,
    });
    g.setDefaultEdgeLabel(() => ({}));
    
    childNodes.forEach((node) => {
      let nodeWidth: number;
      let nodeHeight: number;
      if (node.type === 'boundary') {
        const style = node.style as any;
        nodeWidth = style?.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
        nodeHeight = style?.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;
      } else {
        nodeWidth = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
        nodeHeight = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
      }
      g.setNode(node.id, {
        width: nodeWidth,
        height: nodeHeight,
        id: node.id,
      });
    });
    
    relevantEdges.forEach((edge) => {
      const weight = calculateEdgeWeight(edge);
      const minlen = calculateEdgeMinlen(edge);
      const dataFlow = edge.data?.dataFlow;
      if (dataFlow === 'target-to-source') {
        g.setEdge(edge.target, edge.source, { id: edge.id, minlen, weight });
      } else {
        g.setEdge(edge.source, edge.target, { id: edge.id, minlen, weight });
      }
    });
    
    try {
      dagre.layout(g);
      bestGraph = g;
      bestConfig = { ranker: optimalRanker };
    } catch (error) {
      console.error('Dagre layout failed completely:', error);
      return nodes;
    }
  }

  console.log(`    ✓ Best layout: ranker=${bestConfig?.ranker}, align=${bestConfig?.align || 'auto'}, quality=${bestQuality.toFixed(2)}`);

  // Update positions using the best layout
  const updatedNodes = [...nodes];

  childNodes.forEach((node) => {
    const dagreNode = bestGraph.node(node.id);
    if (dagreNode) {
      const nodeIndex = updatedNodes.findIndex((n) => n.id === node.id);
      if (nodeIndex !== -1) {
        let nodeWidth: number;
        let nodeHeight: number;

        if (node.type === 'boundary') {
          const style = node.style as any;
          nodeWidth = style?.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
          nodeHeight = style?.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;
        } else {
          nodeWidth = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
          nodeHeight = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
        }

        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          position: {
            x: Math.round(dagreNode.x - nodeWidth / 2),
            y: Math.round(dagreNode.y - nodeHeight / 2),
          },
        };
      }
    }
  });

  return updatedNodes;
}

// Main layout function
async function layoutTemplate(template: any): Promise<any> {
  console.log(`\n📐 Laying out template: ${template.name}`);

  let nodes = [...template.nodes];
  const edges = template.edges;

  // Find all boundaries
  const boundaries = nodes.filter((n) => n.type === 'boundary');

  // Sort boundaries by depth (inner boundaries first)
  const sortedBoundaries = boundaries.sort((a, b) => {
    const aDepth = a.parentId ? 1 : 0;
    const bDepth = b.parentId ? 1 : 0;
    return bDepth - aDepth;
  });

  console.log(`  Found ${boundaries.length} boundaries to layout`);

  // Apply layout to each boundary
  for (const boundary of sortedBoundaries) {
    const childCount = nodes.filter((n) => n.parentId === boundary.id).length;

    if (childCount > 0) {
      const style = boundary.style as any;
      const boundaryWidth = style?.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
      const boundaryHeight = style?.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;

      const boundaryLabel = (boundary.data as any).label || boundary.id;
      console.log(`  ⚙️  Layout "${boundaryLabel}": ${childCount} children in ${boundaryWidth}×${boundaryHeight}px`);

      nodes = layoutBoundaryChildren(
        boundary.id,
        nodes,
        edges,
        boundaryWidth,
        boundaryHeight
      );
    }
  }

  return {
    ...template,
    nodes,
  };
}

// Format node for TypeScript output
function formatNode(node: AppNode, indent: string): string {
  const lines: string[] = [];

  lines.push('{');
  lines.push(`  id: generateId('${node.id.split('-')[0]}', ${node.id.split('-').pop()}),`);
  lines.push(`  type: '${node.type}',`);
  lines.push(`  position: { x: ${node.position.x}, y: ${node.position.y} },`);

  if (node.style) {
    const style = node.style as any;
    if (style.width !== undefined && style.height !== undefined) {
      lines.push(`  style: { width: ${style.width}, height: ${style.height} },`);
    }
  }

  if (node.parentId) {
    lines.push(`  parentId: generateId('${node.parentId.split('-')[0]}', ${node.parentId.split('-').pop()}),`);
    lines.push(`  extent: 'parent',`);
  }

  lines.push(`  data: {`);
  const data = node.data as any;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (typeof value === 'string') {
      lines.push(`    ${key}: '${value}',`);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`    ${key}: ${value},`);
    }
  }
  lines.push(`  } as ${node.type === 'boundary' ? 'BoundaryNodeData' : 'DeviceNodeData'},`);
  lines.push('},');

  return lines.map(l => indent + l).join('\n');
}

// Generate TypeScript file content
function generateTemplateFile(templates: any[]): string {
  const header = `/**
 * Sample Project Templates
 *
 * AUTO-GENERATED by scripts/layout-templates.ts
 * Do not edit positions manually - run 'npm run layout:templates' instead
 *
 * Pre-built sample projects that users can clone to get started quickly.
 * Each project includes:
 * - Complete topology with devices and boundaries
 * - Device inventory with security metadata
 * - Starter control narratives
 */

import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData, NistBaseline } from '@/lib/utils/types';

export interface SampleProject {
  id: string;
  name: string;
  description: string;
  baseline: NistBaseline;
  tags: string[];
  nodes: AppNode[];
  edges: AppEdge[];
  controlNarratives: Record<string, string>;
}

// Helper to generate unique IDs for sample data
const generateId = (prefix: string, index: number) => \`\${prefix}-sample-\${index}\`;

`;

  // For now, just return a note - full generation would be complex
  // We'll update positions in the existing file instead
  return header + '// Template definitions follow...\n';
}

// Main execution
async function main() {
  console.log('🚀 Starting template layout generation...\n');

  const layoutedTemplates = [];

  for (const template of sampleProjects) {
    const layouted = await layoutTemplate(template);
    layoutedTemplates.push(layouted);
  }

  console.log('\n✅ Layout complete!');
  console.log('\n📊 Summary:');
  for (const template of layoutedTemplates) {
    const deviceCount = template.nodes.filter((n: any) => n.type === 'device').length;
    const boundaryCount = template.nodes.filter((n: any) => n.type === 'boundary').length;
    console.log(`  ${template.name}: ${deviceCount} devices, ${boundaryCount} boundaries`);
  }

  // Output JSON for inspection
  const outputPath = path.join(__dirname, '../.data/layouted-templates.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(layoutedTemplates, null, 2)
  );

  console.log(`\n💾 Layouted templates written to: ${outputPath}`);
  console.log('\n📝 Next steps:');
  console.log('  1. Review the positions in .data/layouted-templates.json');
  console.log('  2. If they look good, manually update sampleProjects.ts with the new positions');
  console.log('  3. Or use the update script: npm run layout:templates:apply');
}

main().catch(console.error);
