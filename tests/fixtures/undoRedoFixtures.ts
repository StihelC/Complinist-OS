import type { AppNode, AppEdge } from '@/lib/utils/types';

/**
 * Test fixtures for undo/redo tests
 */

export const createTestNode = (id: string, overrides?: Partial<AppNode>): AppNode => ({
  id,
  type: 'device',
  position: { x: 100, y: 100 },
  data: {
    id,
    name: `Device ${id}`,
    deviceType: 'server',
  },
  ...overrides,
} as AppNode);

export const createTestEdge = (id: string, source: string, target: string, overrides?: Partial<AppEdge>): AppEdge => ({
  id,
  source,
  target,
  type: 'default',
  ...overrides,
} as AppEdge);

export const createTestBoundary = (id: string, overrides?: Partial<AppNode>): AppNode => ({
  id,
  type: 'boundary',
  position: { x: 0, y: 0 },
  width: 300,
  height: 200,
  data: {
    id,
    label: `Boundary ${id}`,
    type: 'security_zone',
    color: '#e2e8f0',
  },
  ...overrides,
} as AppNode);

export const createTestNodes = (count: number, prefix = 'node'): AppNode[] => {
  return Array.from({ length: count }, (_, i) => 
    createTestNode(`${prefix}-${i}`, { position: { x: i * 100, y: i * 100 } })
  );
};

export const createTestEdges = (nodeIds: string[]): AppEdge[] => {
  if (nodeIds.length < 2) return [];
  const edges: AppEdge[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    edges.push(createTestEdge(`edge-${i}`, nodeIds[i], nodeIds[i + 1]));
  }
  return edges;
};
