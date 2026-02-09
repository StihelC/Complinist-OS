import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Trash2, AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween, Layers } from 'lucide-react';

// Panel CSS variables for consistent sizing
const PANEL_STYLES = {
  width: '320px',
  minWidth: '280px',
  maxWidth: '400px',
  maxHeight: 'calc(100vh - 120px)',
  padding: '16px',
} as const;

export const MultiSelectPanel = () => {
  const {
    selectedNodeIds,
    selectedEdgeIds,
    nodes,
    edges,
    deleteNode,
    deleteEdge,
    clearAllSelections,
  } = useFlowStore();

  const totalSelected = selectedNodeIds.length + selectedEdgeIds.length;

  // Don't render if nothing or only single item selected
  if (totalSelected <= 1) {
    return null;
  }

  // Count selected item types
  const selectedDevices = nodes.filter(
    (n) => n.type === 'device' && selectedNodeIds.includes(n.id)
  );
  const selectedBoundaries = nodes.filter(
    (n) => n.type === 'boundary' && selectedNodeIds.includes(n.id)
  );
  const selectedConnections = edges.filter((e) =>
    selectedEdgeIds.includes(e.id)
  );

  const handleDeleteSelected = () => {
    // Delete all selected nodes
    selectedNodeIds.forEach((nodeId) => {
      deleteNode(nodeId);
    });
    // Delete all selected edges
    selectedEdgeIds.forEach((edgeId) => {
      deleteEdge(edgeId);
    });
    clearAllSelections();
  };

  const handleClearSelection = () => {
    clearAllSelections();
  };

  // Position panel in the bottom-right corner of the viewport
  return createPortal(
    <div
      style={{
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        pointerEvents: 'all',
        zIndex: 9999,
      }}
      className="nodrag nopan"
    >
      <Card
        className="shadow-xl border-2 border-blue-400"
        style={{
          width: PANEL_STYLES.width,
          minWidth: PANEL_STYLES.minWidth,
          maxWidth: PANEL_STYLES.maxWidth,
          maxHeight: PANEL_STYLES.maxHeight,
          overflow: 'hidden',
        }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {totalSelected} Items Selected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selection Summary */}
          <div className="text-sm text-muted-foreground space-y-1">
            {selectedDevices.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{selectedDevices.length} device{selectedDevices.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {selectedBoundaries.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>{selectedBoundaries.length} boundar{selectedBoundaries.length !== 1 ? 'ies' : 'y'}</span>
              </div>
            )}
            {selectedConnections.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span>{selectedConnections.length} connection{selectedConnections.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Bulk Actions */}
          <div className="border-t pt-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Bulk Actions
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                className="w-full text-xs"
              >
                Clear Selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                className="w-full text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete All
              </Button>
            </div>

            {/* Alignment actions - only show when multiple nodes selected */}
            {selectedNodeIds.length > 1 && (
              <div className="border-t pt-3 mt-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Alignment (Coming Soon)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full text-xs"
                    title="Align selected items horizontally"
                  >
                    <AlignHorizontalSpaceBetween className="w-3 h-3 mr-1" />
                    Align H
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full text-xs"
                    title="Align selected items vertically"
                  >
                    <AlignVerticalSpaceBetween className="w-3 h-3 mr-1" />
                    Align V
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Selection info */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            <p>Hold <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Shift</kbd> and click to add to selection</p>
            <p>Drag on canvas to marquee select</p>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
};
