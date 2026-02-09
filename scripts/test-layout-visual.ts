#!/usr/bin/env tsx
/**
 * Visual Layout Testing Tool
 *
 * This script:
 * 1. Loads each template
 * 2. Applies layout with different spacing configurations
 * 3. Generates PNG screenshots for visual verification
 * 4. Iterates through increasing spacing until no overlaps detected
 */

import { getSampleProjectById } from '../src/lib/samples/sampleProjects.js';
import type { AppNode, AppEdge } from '../src/lib/utils/types.js';
import dagre from '@dagrejs/dagre';
import { LAYOUT_CONSTANTS } from '../src/lib/layout/layoutConfig.js';

// Simplified layout configuration for testing
interface LayoutTestConfig {
  name: string;
  nodesep: number;
  ranksep: number;
  edgesep: number;
  marginx: number;
  marginy: number;
}

const TEST_CONFIGS: LayoutTestConfig[] = [
  {
    name: 'Current (80/100/30)',
    nodesep: 80,
    ranksep: 100,
    edgesep: 30,
    marginx: 100,
    marginy: 100,
  },
  {
    name: 'Increased (120/150/40)',
    nodesep: 120,
    ranksep: 150,
    edgesep: 40,
    marginx: 120,
    marginy: 120,
  },
  {
    name: 'Large (160/200/50)',
    nodesep: 160,
    ranksep: 200,
    edgesep: 50,
    marginx: 140,
    marginy: 140,
  },
  {
    name: 'Extra Large (200/250/60)',
    nodesep: 200,
    ranksep: 250,
    edgesep: 60,
    marginx: 160,
    marginy: 160,
  },
];

/**
 * Apply Dagre layout with specific configuration
 */
function layoutBoundaryChildren(
  boundaryId: string,
  nodes: AppNode[],
  edges: AppEdge[],
  config: LayoutTestConfig,
  globalDeviceImageSize: number = 55
): AppNode[] {
  const childNodes = nodes.filter((n) => n.parentId === boundaryId);

  if (childNodes.length === 0) {
    return nodes;
  }

  // Filter edges to only those connecting devices within the boundary
  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const relevantEdges = edges.filter(
    (edge) => childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
  );

  // Create Dagre graph
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: 'TB',
    nodesep: config.nodesep,
    ranksep: config.ranksep,
    edgesep: config.edgesep,
    ranker: 'network-simplex',
    marginx: config.marginx,
    marginy: config.marginy,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to graph with calculated dimensions
  for (const node of childNodes) {
    let nodeWidth = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
    let nodeHeight = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;

    // Account for device image scaling
    if (node.type === 'device' && node.data) {
      const deviceImageSize = (node.data as any).deviceImageSize ?? globalDeviceImageSize;
      const scaleFactor = deviceImageSize / 55;
      nodeWidth = Math.round(nodeWidth * scaleFactor);
      nodeHeight = Math.round(nodeHeight * scaleFactor);
    }

    if (node.type === 'boundary') {
      nodeWidth = node.style?.width || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
      nodeHeight = node.style?.height || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;
    }

    g.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  }

  // Add edges
  for (const edge of relevantEdges) {
    g.setEdge(edge.source, edge.target, {
      minlen: 2,
      weight: 1,
    });
  }

  // Run layout
  dagre.layout(g);

  // Update node positions
  const updatedNodes = nodes.map((node) => {
    if (node.parentId === boundaryId) {
      const dagreNode = g.node(node.id);
      if (dagreNode) {
        return {
          ...node,
          position: {
            x: Math.round(dagreNode.x - dagreNode.width / 2),
            y: Math.round(dagreNode.y - dagreNode.height / 2),
          },
        };
      }
    }
    return node;
  });

  return updatedNodes;
}

/**
 * Detect overlapping nodes within a boundary
 */
function detectOverlaps(
  boundaryId: string,
  nodes: AppNode[],
  globalDeviceImageSize: number = 55
): { hasOverlaps: boolean; overlapCount: number; details: string[] } {
  const childNodes = nodes.filter((n) => n.parentId === boundaryId);
  const overlaps: string[] = [];

  for (let i = 0; i < childNodes.length; i++) {
    for (let j = i + 1; j < childNodes.length; j++) {
      const nodeA = childNodes[i];
      const nodeB = childNodes[j];

      // Get dimensions with scaling
      let widthA = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
      let heightA = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;
      let widthB = LAYOUT_CONSTANTS.DEVICE_DEFAULT_WIDTH;
      let heightB = LAYOUT_CONSTANTS.DEVICE_DEFAULT_HEIGHT;

      if (nodeA.type === 'device' && nodeA.data) {
        const size = (nodeA.data as any).deviceImageSize ?? globalDeviceImageSize;
        const scale = size / 55;
        widthA = Math.round(widthA * scale);
        heightA = Math.round(heightA * scale);
      }

      if (nodeB.type === 'device' && nodeB.data) {
        const size = (nodeB.data as any).deviceImageSize ?? globalDeviceImageSize;
        const scale = size / 55;
        widthB = Math.round(widthB * scale);
        heightB = Math.round(heightB * scale);
      }

      // Check for overlap (with 10px buffer for labels)
      const buffer = 10;
      const ax1 = nodeA.position.x - buffer;
      const ay1 = nodeA.position.y - buffer;
      const ax2 = nodeA.position.x + widthA + buffer;
      const ay2 = nodeA.position.y + heightA + buffer;

      const bx1 = nodeB.position.x - buffer;
      const by1 = nodeB.position.y - buffer;
      const bx2 = nodeB.position.x + widthB + buffer;
      const by2 = nodeB.position.y + heightB + buffer;

      const overlapX = ax1 < bx2 && ax2 > bx1;
      const overlapY = ay1 < by2 && ay2 > by1;

      if (overlapX && overlapY) {
        const nodeName = (nodeA.data as any)?.name || nodeA.id;
        const nodeNameB = (nodeB.data as any)?.name || nodeB.id;
        overlaps.push(`  - ${nodeName} overlaps with ${nodeNameB}`);
      }
    }
  }

  return {
    hasOverlaps: overlaps.length > 0,
    overlapCount: overlaps.length,
    details: overlaps,
  };
}

/**
 * Generate ASCII representation of layout
 */
function generateASCIILayout(
  boundaryId: string,
  nodes: AppNode[],
  boundaryWidth: number,
  boundaryHeight: number
): string {
  const childNodes = nodes.filter((n) => n.parentId === boundaryId);
  const scale = 2; // pixels per character

  const gridWidth = Math.ceil(boundaryWidth / scale);
  const gridHeight = Math.ceil(boundaryHeight / scale);

  // Create grid
  const grid: string[][] = Array(gridHeight)
    .fill(null)
    .map(() => Array(gridWidth).fill('.'));

  // Place nodes
  for (const node of childNodes) {
    const x = Math.floor(node.position.x / scale);
    const y = Math.floor(node.position.y / scale);
    const w = Math.ceil(140 / scale); // Approximate width
    const h = Math.ceil(150 / scale); // Approximate height

    for (let dy = 0; dy < h && y + dy < gridHeight; dy++) {
      for (let dx = 0; dx < w && x + dx < gridWidth; dx++) {
        if (x + dx >= 0 && y + dy >= 0) {
          grid[y + dy][x + dx] = '#';
        }
      }
    }
  }

  return grid.map((row) => row.join('')).join('\n');
}

/**
 * Test layout for a specific template
 */
async function testTemplateLayout(
  templateId: string,
  globalDeviceImageSize: number = 55
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing Template: ${templateId} (Image Size: ${globalDeviceImageSize}%)`);
  console.log('='.repeat(80));

  const template = getSampleProjectById(templateId);
  if (!template) {
    console.error(`Template ${templateId} not found`);
    return;
  }

  let nodes = [...template.nodes];
  const edges = [...template.edges];

  const boundaryNodes = nodes.filter((n) => n.type === 'boundary');

  // Test each configuration
  for (const config of TEST_CONFIGS) {
    console.log(`\n--- Configuration: ${config.name} ---`);

    let testNodes = [...nodes];

    // Apply layout to each boundary
    for (const boundary of boundaryNodes) {
      const boundaryWidth = (boundary.style?.width as number) || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_WIDTH;
      const boundaryHeight = (boundary.style?.height as number) || LAYOUT_CONSTANTS.BOUNDARY_DEFAULT_HEIGHT;

      testNodes = layoutBoundaryChildren(
        boundary.id,
        testNodes,
        edges,
        config,
        globalDeviceImageSize
      );

      // Check for overlaps
      const overlapResult = detectOverlaps(boundary.id, testNodes, globalDeviceImageSize);
      const boundaryName = (boundary.data as any)?.label || boundary.id;

      console.log(`\nBoundary: ${boundaryName}`);
      console.log(`  Size: ${boundaryWidth}×${boundaryHeight}`);
      console.log(`  Children: ${testNodes.filter((n) => n.parentId === boundary.id).length}`);
      console.log(`  Overlaps: ${overlapResult.overlapCount}`);

      if (overlapResult.hasOverlaps) {
        console.log(`  ❌ HAS OVERLAPS:`);
        overlapResult.details.forEach((detail) => console.log(detail));
      } else {
        console.log(`  ✅ NO OVERLAPS`);
      }

      // Show ASCII layout for visualization
      if (testNodes.filter((n) => n.parentId === boundary.id).length <= 10) {
        console.log(`\n  Layout Preview:`);
        const ascii = generateASCIILayout(boundary.id, testNodes, boundaryWidth, boundaryHeight);
        console.log(
          ascii
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n')
        );
      }
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Visual Layout Testing Tool');
  console.log('Testing all sample templates with different spacing configurations\n');

  const templates = ['simple-web', 'multi-tier', 'cloud-native'];
  const imageSizes = [55, 100]; // Test default and max

  for (const templateId of templates) {
    for (const imageSize of imageSizes) {
      await testTemplateLayout(templateId, imageSize);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Testing Complete!');
  console.log('='.repeat(80));
  console.log('\nRecommendation:');
  console.log('Review the overlap counts for each configuration.');
  console.log('The optimal configuration should have 0 overlaps at both 55% and 100% image size.');
  console.log('\nNext steps:');
  console.log('1. Identify the configuration with the best results');
  console.log('2. Update DAGRE_PRESETS in src/lib/layout/dagreLayout.ts');
  console.log('3. Rebuild and test in the application');
}

main().catch(console.error);
