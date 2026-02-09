import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { AppNode } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate the nesting depth of a node by traversing its parent chain
 * @param nodeId - ID of the node to calculate depth for
 * @param nodes - All nodes in the flow
 * @param cache - Optional cache map to avoid redundant calculations
 * @returns The nesting depth (0 for root-level nodes, 1 for first level nested, etc.)
 */
export function calculateNestingDepth(nodeId: string, nodes: AppNode[], cache?: Map<string, number>): number {
  // Use cache if provided
  if (cache?.has(nodeId)) {
    return cache.get(nodeId)!;
  }
  
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !node.parentId) {
    if (cache) {
      cache.set(nodeId, 0);
    }
    return 0;
  }
  
  // Recursively calculate depth by traversing parent chain
  const depth = 1 + calculateNestingDepth(node.parentId, nodes, cache);
  
  if (cache) {
    cache.set(nodeId, depth);
  }
  
  return depth;
}

/**
 * Check if a node is a descendant of another node (prevents circular nesting)
 * @param nodeId - The potential descendant node ID
 * @param ancestorId - The potential ancestor node ID
 * @param nodes - All nodes in the flow
 * @returns true if nodeId is a descendant of ancestorId
 */
export function isDescendant(nodeId: string, ancestorId: string, nodes: AppNode[]): boolean {
  if (nodeId === ancestorId) {
    return true; // A node is considered its own descendant for circular prevention
  }
  
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !node.parentId) {
    return false;
  }
  
  // Recursively check if any ancestor matches
  return isDescendant(node.parentId, ancestorId, nodes);
}

/**
 * Get all descendant node IDs of a given node
 * @param nodeId - The parent node ID
 * @param nodes - All nodes in the flow
 * @returns Array of descendant node IDs
 */
export function getDescendants(nodeId: string, nodes: AppNode[]): string[] {
  const children = nodes.filter((n) => n.parentId === nodeId);
  const descendants: string[] = [];
  
  for (const child of children) {
    descendants.push(child.id);
    // Recursively get children of children
    descendants.push(...getDescendants(child.id, nodes));
  }
  
  return descendants;
}

/**
 * Calculate the absolute position of a node by traversing its entire parent chain
 * This is crucial for nested boundaries where positions are relative to parents
 * @param nodeId - ID of the node to calculate absolute position for
 * @param nodes - All nodes in the flow
 * @param cache - Optional cache map to avoid redundant calculations
 * @returns The absolute position in canvas coordinates
 */
export function getAbsolutePosition(nodeId: string, nodes: AppNode[], cache?: Map<string, {x: number, y: number}>): { x: number; y: number } {
  // Use cache if provided
  if (cache?.has(nodeId)) {
    return cache.get(nodeId)!;
  }
  
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    const position = { x: 0, y: 0 };
    if (cache) {
      cache.set(nodeId, position);
    }
    return position;
  }
  
  const position = { ...node.position };
  
  // Recursively add all parent positions to get true absolute position
  if (node.parentId) {
    const parentAbsPos = getAbsolutePosition(node.parentId, nodes, cache);
    position.x += parentAbsPos.x;
    position.y += parentAbsPos.y;
  }
  
  if (cache) {
    cache.set(nodeId, position);
  }
  
  return position;
}

