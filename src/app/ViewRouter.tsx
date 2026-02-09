import { useState, useCallback, lazy, Suspense } from 'react';
import { LazyTopologyCanvas } from '@/features/topology/components/Canvas/LazyTopologyCanvas';
import { LazyInventoryPanel } from '@/features/inventory/components/Inventory/LazyInventoryPanel';
import { LazySSPWizard } from '@/features/ssp/components/SSP/LazySSPWizard';
import { LazyControlNarrativeEditor } from '@/features/controls/components/ControlNarratives/LazyControlNarrativeEditor';
import { LazyUnifiedAIChat } from '@/features/ai-assistant/components/AI/LazyUnifiedAIChat';
import { LazyDocumentsView } from '@/features/documents/components/LazyDocumentsView';
import { RequireAuth } from '@/features/auth/components/Auth/RequireAuth';
import { TopologyEmptyState } from '@/features/topology/components/Canvas/TopologyEmptyState';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useShallow, selectViewRouterState } from '@/core/stores/selectors';

// Lazy load topology sub-components that are only needed when topology view is active
const DevicePalette = lazy(() =>
  import('@/features/topology/components/DevicePalette/DevicePalette').then(m => ({ default: m.DevicePalette }))
);
const BoundaryPalette = lazy(() =>
  import('@/features/topology/components/BoundaryPanel/BoundaryPalette').then(m => ({ default: m.BoundaryPalette }))
);
const AlignmentPanel = lazy(() =>
  import('@/features/topology/components/AlignmentPanel/AlignmentPanel').then(m => ({ default: m.AlignmentPanel }))
);
const TopologyToolbar = lazy(() =>
  import('@/features/topology/components/Canvas/TopologyToolbar').then(m => ({ default: m.TopologyToolbar }))
);
const MultiSelectPanel = lazy(() =>
  import('@/features/topology/components/Nodes/MultiSelectPanel').then(m => ({ default: m.MultiSelectPanel }))
);
const EdgeDebugWrapper = lazy(() =>
  import('@/features/topology/components/Edges/EdgeDebugButton').then(m => ({ default: m.EdgeDebugWrapper }))
);

// Import ActivePanel type for state management
import type { ActivePanel } from '@/features/topology/components/Canvas/TopologyToolbar';

interface ViewRouterProps {
  activeView: 'topology' | 'inventory' | 'ssp' | 'narratives' | 'ai' | 'documents';
  onSwitchToTopology?: () => void;
}

export const ViewRouter = ({ activeView, onSwitchToTopology }: ViewRouterProps) => {
  // State for topology panel management
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Handler to close current panel when user clicks X
  const handlePanelClose = useCallback(() => {
    setActivePanel(null);
  }, []);

  // Handler to toggle panels from toolbar
  const handlePanelChange = useCallback((panel: ActivePanel) => {
    setActivePanel(panel);
  }, []);

  try {
    // Use shallow selector for optimized re-renders
    // Only re-renders when currentProject actually changes
    const { currentProject } = useFlowStore(useShallow(selectViewRouterState));

    // Get nodes for empty state detection
    const nodes = useFlowStore((state) => state.nodes);
    const importDiagramFromJSON = useFlowStore((state) => state.importDiagramFromJSON);
    const loadSampleNetwork = useFlowStore((state) => state.loadSampleNetwork);

    // Check if the canvas is empty (no devices or boundaries)
    const isCanvasEmpty = nodes.length === 0;

    // Handler for "Add Your First Device" action
    const handleAddDevice = useCallback(() => {
      setActivePanel('devices');
    }, []);

    // Handler for "Import from Terraform" action
    const handleImportTerraform = useCallback(async () => {
      await importDiagramFromJSON();
    }, [importDiagramFromJSON]);

    // Handler for "Load Sample Network" action
    const handleLoadSample = useCallback(async () => {
      await loadSampleNetwork();
    }, [loadSampleNetwork]);

    return (
      <>
        {/* Topology View - Wrapped in lazy-loaded ReactFlowProvider */}
        {activeView === 'topology' && (
          <LazyTopologyCanvas>
            {/* Left Toolbar - Action Buttons (lazy-loaded) */}
            <Suspense fallback={null}>
              <TopologyToolbar
                activePanel={activePanel}
                onPanelChange={handlePanelChange}
              />
            </Suspense>

            {/* Device Palette Panel (lazy-loaded) */}
            <Suspense fallback={null}>
              <DevicePalette
                isOpen={activePanel === 'devices'}
                onClose={handlePanelClose}
              />
            </Suspense>

            {/* Boundary Palette Panel (lazy-loaded) */}
            <Suspense fallback={null}>
              <BoundaryPalette
                isOpen={activePanel === 'boundaries'}
                onClose={handlePanelClose}
              />
            </Suspense>

            {/* Alignment Panel - Uses useReactFlow hook (lazy-loaded) */}
            <Suspense fallback={null}>
              <AlignmentPanel
                isOpen={activePanel === 'alignment'}
                onClose={handlePanelClose}
              />
            </Suspense>

            {/* Properties Panel - Removed (BoundaryToolbar now handles all boundary properties) */}

            {/* Multi-Select Panel - Shows when multiple items are selected */}
            <Suspense fallback={null}>
              <MultiSelectPanel />
            </Suspense>

            {/* Edge Debug Overlay - Toggle with Ctrl/Cmd+Shift+E */}
            <Suspense fallback={null}>
              <EdgeDebugWrapper />
            </Suspense>

            {/* Empty State - Shows when canvas has no devices */}
            {isCanvasEmpty && (
              <TopologyEmptyState
                onAddDevice={handleAddDevice}
                onImportTerraform={handleImportTerraform}
                onLoadSample={handleLoadSample}
              />
            )}
          </LazyTopologyCanvas>
        )}

        {activeView === 'inventory' && (
          <LazyInventoryPanel isOpen={true} onClose={() => {}} inline={true} />
        )}
        {activeView === 'ssp' && (
          <RequireAuth feature="ssp">
            <LazySSPWizard
              isOpen={true}
              onClose={() => {}}
              inline={true}
              activeView={activeView}
              onSwitchToTopology={onSwitchToTopology || (() => {})}
            />
          </RequireAuth>
        )}
        {activeView === 'narratives' && (
          <RequireAuth feature="narratives">
            <LazyControlNarrativeEditor
              isOpen={true}
              onClose={() => {}}
              projectId={currentProject?.id ?? null}
              projectName={currentProject?.name}
              baseline={currentProject?.baseline ?? 'MODERATE'}
              inline={true}
            />
          </RequireAuth>
        )}
        {activeView === 'ai' && (
          <RequireAuth feature="ai">
            <LazyUnifiedAIChat />
          </RequireAuth>
        )}
        {activeView === 'documents' && (
          <RequireAuth feature="documents">
            <LazyDocumentsView />
          </RequireAuth>
        )}
      </>
    );
  } catch (error) {
    console.error('[ViewRouter] ERROR in ViewRouter component:', error);
    console.error('[ViewRouter] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
};

