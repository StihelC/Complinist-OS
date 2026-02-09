import { AppNode } from '@/lib/utils/types';

/**
 * Utility functions for aligning and distributing nodes
 */

export interface NodeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

/**
 * Calculate bounds for a group of nodes
 */
export const calculateNodesBounds = (nodes: AppNode[]): NodeBounds | null => {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const nodeWidth = (node.width as number) || (node.style?.width as number) || 100;
    const nodeHeight = (node.height as number) || (node.style?.height as number) || 100;
    
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + nodeWidth);
    maxY = Math.max(maxY, node.position.y + nodeHeight);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

/**
 * Get selected nodes from all nodes
 */
export const getSelectedNodes = (nodes: AppNode[]): AppNode[] => {
  return nodes.filter((node) => node.selected);
};

/**
 * Align nodes to the left edge
 */
export const alignNodesLeft = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 2) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  const targetX = bounds.minX;

  return nodes.map((node) => {
    if (node.selected) {
      return { ...node, position: { ...node.position, x: targetX } };
    }
    return node;
  });
};

/**
 * Align nodes to the right edge
 */
export const alignNodesRight = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 2) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  return nodes.map((node) => {
    if (node.selected) {
      const nodeWidth = (node.width as number) || (node.style?.width as number) || 100;
      const targetX = bounds.maxX - nodeWidth;
      return { ...node, position: { ...node.position, x: targetX } };
    }
    return node;
  });
};

/**
 * Align nodes to the top edge
 */
export const alignNodesTop = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 2) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  const targetY = bounds.minY;

  return nodes.map((node) => {
    if (node.selected) {
      return { ...node, position: { ...node.position, y: targetY } };
    }
    return node;
  });
};

/**
 * Align nodes to the bottom edge
 */
export const alignNodesBottom = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 2) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  return nodes.map((node) => {
    if (node.selected) {
      const nodeHeight = (node.height as number) || (node.style?.height as number) || 100;
      const targetY = bounds.maxY - nodeHeight;
      return { ...node, position: { ...node.position, y: targetY } };
    }
    return node;
  });
};

/**
 * Align nodes to horizontal center
 */
export const alignNodesHorizontalCenter = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 2) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  return nodes.map((node) => {
    if (node.selected) {
      const nodeWidth = (node.width as number) || (node.style?.width as number) || 100;
      const targetX = bounds.centerX - nodeWidth / 2;
      return { ...node, position: { ...node.position, x: targetX } };
    }
    return node;
  });
};

/**
 * Align nodes to vertical center
 */
export const alignNodesVerticalCenter = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 2) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  return nodes.map((node) => {
    if (node.selected) {
      const nodeHeight = (node.height as number) || (node.style?.height as number) || 100;
      const targetY = bounds.centerY - nodeHeight / 2;
      return { ...node, position: { ...node.position, y: targetY } };
    }
    return node;
  });
};

/**
 * Distribute nodes horizontally with equal spacing
 */
export const distributeNodesHorizontally = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 3) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  // Sort nodes by x position
  const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
  
  // Calculate total width of all nodes
  const totalNodeWidth = sortedNodes.reduce((sum, node) => {
    const nodeWidth = (node.width as number) || (node.style?.width as number) || 100;
    return sum + nodeWidth;
  }, 0);

  // Calculate spacing between nodes
  const availableSpace = bounds.maxX - bounds.minX - totalNodeWidth;
  const spacing = availableSpace / (sortedNodes.length - 1);

  // Update positions
  let currentX = bounds.minX;
  const updatedPositions = new Map<string, number>();

  sortedNodes.forEach((node) => {
    updatedPositions.set(node.id, currentX);
    const nodeWidth = (node.width as number) || (node.style?.width as number) || 100;
    currentX += nodeWidth + spacing;
  });

  return nodes.map((node) => {
    if (node.selected && updatedPositions.has(node.id)) {
      return { ...node, position: { ...node.position, x: updatedPositions.get(node.id)! } };
    }
    return node;
  });
};

/**
 * Distribute nodes vertically with equal spacing
 */
export const distributeNodesVertically = (nodes: AppNode[]): AppNode[] => {
  const selectedNodes = getSelectedNodes(nodes);
  if (selectedNodes.length < 3) return nodes;

  const bounds = calculateNodesBounds(selectedNodes);
  if (!bounds) return nodes;

  // Sort nodes by y position
  const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
  
  // Calculate total height of all nodes
  const totalNodeHeight = sortedNodes.reduce((sum, node) => {
    const nodeHeight = (node.height as number) || (node.style?.height as number) || 100;
    return sum + nodeHeight;
  }, 0);

  // Calculate spacing between nodes
  const availableSpace = bounds.maxY - bounds.minY - totalNodeHeight;
  const spacing = availableSpace / (sortedNodes.length - 1);

  // Update positions
  let currentY = bounds.minY;
  const updatedPositions = new Map<string, number>();

  sortedNodes.forEach((node) => {
    updatedPositions.set(node.id, currentY);
    const nodeHeight = (node.height as number) || (node.style?.height as number) || 100;
    currentY += nodeHeight + spacing;
  });

  return nodes.map((node) => {
    if (node.selected && updatedPositions.has(node.id)) {
      return { ...node, position: { ...node.position, y: updatedPositions.get(node.id)! } };
    }
    return node;
  });
};

