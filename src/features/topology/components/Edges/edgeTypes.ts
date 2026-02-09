import { FloatingCustomEdge } from './FloatingCustomEdge';
import { SmartCustomEdge } from './SmartCustomEdge';
import { SmartSmoothStepEdge } from './SmartSmoothStepEdge';
import type { EdgeTypes } from '@xyflow/react';

// Export edge types for React Flow
// Using FloatingCustomEdge which automatically handles both floating and handle-based connections
// SmartCustomEdge uses pathfinding to avoid intersecting with nodes
// SmartSmoothStepEdge uses orthogonal pathfinding with smooth corners and overlap prevention
export const edgeTypes: EdgeTypes = {
  default: FloatingCustomEdge,
  straight: FloatingCustomEdge,
  step: FloatingCustomEdge,
  smoothstep: FloatingCustomEdge,
  simplebezier: FloatingCustomEdge,
  smart: SmartCustomEdge,
  smartSmoothStep: SmartSmoothStepEdge,
} as EdgeTypes;
