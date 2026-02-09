import { AppNode, AppEdge, LayoutDirection } from '@/lib/utils/types';

/**
 * Analyze the flow direction of edges to determine optimal layout orientation
 */
export function analyzeFlowDirection(
  nodes: AppNode[],
  edges: AppEdge[]
): LayoutDirection {
  if (edges.length === 0) {
    return 'DOWN'; // Default if no edges
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  const relevantEdges = edges.filter(
    e => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  if (relevantEdges.length === 0) {
    return 'DOWN'; // Default if no relevant edges
  }

  // Count connections by direction
  const directionScores = {
    horizontal: 0, // LEFT to RIGHT flow
    vertical: 0,   // TOP to BOTTOM flow
  };

  // Analyze each edge's data flow direction
  relevantEdges.forEach(edge => {
    const dataFlow = edge.data?.dataFlow;
    
    // If dataFlow is explicitly set, use it
    if (dataFlow === 'source-to-target') {
      // This is a directed edge from source to target
      directionScores.vertical += 1;
    } else if (dataFlow === 'target-to-source') {
      // Reverse direction
      directionScores.vertical += 1;
    } else if (dataFlow === 'bidirectional') {
      // Bidirectional doesn't give us direction hints
      directionScores.vertical += 0.5;
      directionScores.horizontal += 0.5;
    } else {
      // No explicit dataFlow, treat as directed (source -> target)
      directionScores.vertical += 1;
    }
  });

  // Determine best orientation
  // For network diagrams, vertical (top-to-bottom) is typically preferred
  // unless there's a strong horizontal pattern
  if (directionScores.horizontal > directionScores.vertical * 1.5) {
    return 'RIGHT';
  } else {
    return 'DOWN';
  }
}

/**
 * Detect if the graph is primarily hierarchical (tree-like) or networked (mesh-like)
 */
export function detectGraphTopology(
  nodes: AppNode[],
  edges: AppEdge[]
): 'hierarchical' | 'networked' | 'mixed' {
  if (nodes.length === 0 || edges.length === 0) {
    return 'hierarchical';
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  const relevantEdges = edges.filter(
    e => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  // Count incoming and outgoing edges per node
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  });

  relevantEdges.forEach(edge => {
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Calculate metrics
  let rootNodes = 0;  // Nodes with no incoming edges
  let leafNodes = 0;  // Nodes with no outgoing edges
  let hubNodes = 0;   // Nodes with many connections

  nodes.forEach(node => {
    const inDeg = inDegree.get(node.id) || 0;
    const outDeg = outDegree.get(node.id) || 0;
    const totalDeg = inDeg + outDeg;

    if (inDeg === 0 && outDeg > 0) rootNodes++;
    if (outDeg === 0 && inDeg > 0) leafNodes++;
    if (totalDeg >= 4) hubNodes++;
  });

  // Determine topology
  const nodeCount = nodes.length;
  
  if (rootNodes === 1 && leafNodes >= nodeCount * 0.3) {
    return 'hierarchical'; // Clear tree structure
  } else if (hubNodes >= nodeCount * 0.3) {
    return 'networked'; // Many interconnected nodes
  } else {
    return 'mixed';
  }
}

/**
 * Find the optimal root node(s) for hierarchical layouts
 */
export function findRootNodes(
  nodes: AppNode[],
  edges: AppEdge[]
): string[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  const relevantEdges = edges.filter(
    e => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  // Count incoming edges for each node
  const inDegree = new Map<string, number>();
  nodes.forEach(node => inDegree.set(node.id, 0));

  relevantEdges.forEach(edge => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Nodes with no incoming edges are roots
  const roots = nodes
    .filter(node => inDegree.get(node.id) === 0)
    .map(node => node.id);

  return roots.length > 0 ? roots : [nodes[0]?.id].filter(Boolean);
}

/**
 * Calculate the depth/rank of each node in the graph
 */
export function calculateNodeRanks(
  nodes: AppNode[],
  edges: AppEdge[]
): Map<string, number> {
  const ranks = new Map<string, number>();
  const nodeIds = new Set(nodes.map(n => n.id));
  const relevantEdges = edges.filter(
    e => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  nodes.forEach(node => adjacency.set(node.id, []));
  relevantEdges.forEach(edge => {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  });

  // BFS from root nodes
  const roots = findRootNodes(nodes, edges);
  const queue = roots.map(id => ({ id, rank: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    ranks.set(id, rank);

    const neighbors = adjacency.get(id) || [];
    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        queue.push({ id: neighborId, rank: rank + 1 });
      }
    });
  }

  // Assign rank 0 to any unvisited nodes
  nodes.forEach(node => {
    if (!ranks.has(node.id)) {
      ranks.set(node.id, 0);
    }
  });

  return ranks;
}

