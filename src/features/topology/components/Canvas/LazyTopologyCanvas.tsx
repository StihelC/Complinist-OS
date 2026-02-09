// Lazy-loaded wrapper for topology canvas and related components
// This component defers loading of @xyflow/react and related graph libraries
// until the topology view is actually opened

import { lazy, Suspense, ReactNode } from 'react';
import { TopologyCanvasSkeleton } from './TopologyCanvasSkeleton';

// Lazy load the FlowCanvas component
// This defers loading of @xyflow/react (~200KB+) until needed
const FlowCanvas = lazy(() =>
  import('./FlowCanvas').then(module => ({ default: module.FlowCanvas }))
);

// Lazy load the ReactFlowProvider separately to keep it with the canvas
// We'll create a wrapper component that includes the provider
const ReactFlowProviderWrapper = lazy(() =>
  import('@xyflow/react').then(module => ({
    default: ({ children }: { children: ReactNode }) => (
      <module.ReactFlowProvider>{children}</module.ReactFlowProvider>
    ),
  }))
);

interface LazyTopologyCanvasProps {
  // Children that need ReactFlowProvider context (e.g., AlignmentPanel)
  children?: ReactNode;
}

/**
 * LazyTopologyCanvas - Lazy loads the ReactFlow library and FlowCanvas component
 *
 * This component wraps both FlowCanvas and any children in the ReactFlowProvider,
 * ensuring all components that need ReactFlow context have access to it.
 *
 * Benefits:
 * - Defers ~500KB+ of graph libraries until topology view is opened
 * - Shows skeleton loader while libraries are loading
 * - Provides ReactFlowProvider context to children (like AlignmentPanel)
 */
export function LazyTopologyCanvas({ children }: LazyTopologyCanvasProps) {
  return (
    <Suspense fallback={<TopologyCanvasSkeleton />}>
      <ReactFlowProviderWrapper>
        <FlowCanvas />
        {children}
      </ReactFlowProviderWrapper>
    </Suspense>
  );
}

// Export alias for clarity
export const LazyTopologyView = LazyTopologyCanvas;
