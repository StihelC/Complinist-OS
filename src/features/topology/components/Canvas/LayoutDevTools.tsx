/**
 * Layout DevTools
 *
 * A debug panel that shows node positions, boundary dimensions,
 * and layout hierarchy information. Only visible when layoutDebugMode is enabled.
 */

import { useMemo } from 'react';
import { X, Layers, Box, GitBranch, Move } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { AppNode, BoundaryNodeData, DeviceNodeData } from '@/lib/utils/types';

interface LayoutDevToolsProps {
  onClose: () => void;
}

/**
 * Get the depth of a node in the boundary hierarchy
 */
function getNodeDepth(nodeId: string, nodes: AppNode[]): number {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || !node.parentId) return 0;
  return 1 + getNodeDepth(node.parentId, nodes);
}

/**
 * Build a tree structure from flat nodes
 */
function buildHierarchy(nodes: AppNode[]): Map<string | undefined, AppNode[]> {
  const map = new Map<string | undefined, AppNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId;
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId)!.push(node);
  }
  return map;
}

export const LayoutDevTools = ({ onClose }: LayoutDevToolsProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  // Calculate statistics
  const stats = useMemo(() => {
    const boundaries = nodes.filter(n => n.type === 'boundary');
    const devices = nodes.filter(n => n.type === 'device');
    const maxDepth = Math.max(0, ...nodes.map(n => getNodeDepth(n.id, nodes)));
    const orphanDevices = devices.filter(n => !n.parentId);
    const hierarchy = buildHierarchy(nodes);

    return {
      totalNodes: nodes.length,
      boundaryCount: boundaries.length,
      deviceCount: devices.length,
      edgeCount: edges.length,
      maxDepth,
      orphanDeviceCount: orphanDevices.length,
      rootBoundaryCount: hierarchy.get(undefined)?.filter(n => n.type === 'boundary').length || 0,
    };
  }, [nodes, edges]);

  // Build hierarchy tree for display
  const hierarchyTree = useMemo(() => {
    const map = buildHierarchy(nodes);
    const result: { node: AppNode; depth: number; childCount: number }[] = [];

    const traverse = (parentId: string | undefined, depth: number) => {
      const children = map.get(parentId) || [];
      // Sort: boundaries first, then devices
      const sorted = [...children].sort((a, b) => {
        if (a.type === 'boundary' && b.type !== 'boundary') return -1;
        if (a.type !== 'boundary' && b.type === 'boundary') return 1;
        return 0;
      });

      for (const node of sorted) {
        const nodeChildren = map.get(node.id) || [];
        result.push({ node, depth, childCount: nodeChildren.length });
        traverse(node.id, depth + 1);
      }
    };

    traverse(undefined, 0);
    return result;
  }, [nodes]);

  return (
    <div className="absolute bottom-4 left-4 z-50 w-80 max-h-[60vh] bg-background border rounded-lg shadow-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-yellow-600" />
          <span className="font-medium text-sm">Layout DevTools</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Close DevTools"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Section */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.totalNodes}</div>
            <div className="text-[10px] text-muted-foreground">Nodes</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{stats.boundaryCount}</div>
            <div className="text-[10px] text-muted-foreground">Boundaries</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600">{stats.deviceCount}</div>
            <div className="text-[10px] text-muted-foreground">Devices</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600">{stats.maxDepth}</div>
            <div className="text-[10px] text-muted-foreground">Max Depth</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          {stats.edgeCount} edges | {stats.orphanDeviceCount} orphan devices | {stats.rootBoundaryCount} root boundaries
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5 font-mono text-[11px]">
          {hierarchyTree.map(({ node, depth, childCount }) => {
            const isBoundary = node.type === 'boundary';
            const data = node.data as (BoundaryNodeData | DeviceNodeData);
            const label = isBoundary
              ? (data as BoundaryNodeData).label || node.id
              : (data as DeviceNodeData).name || node.id;
            const width = node.width || node.style?.width as number || 0;
            const height = node.height || node.style?.height as number || 0;

            return (
              <div
                key={node.id}
                className="flex items-start gap-1 hover:bg-muted/50 rounded px-1 py-0.5"
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
              >
                {isBoundary ? (
                  <Box className="w-3 h-3 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <GitBranch className="w-3 h-3 text-purple-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`truncate ${isBoundary ? 'text-green-700 font-medium' : 'text-purple-700'}`}>
                      {label}
                    </span>
                    {childCount > 0 && (
                      <span className="text-[9px] text-muted-foreground">({childCount})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Move className="w-2.5 h-2.5" />
                      {Math.round(node.position.x)}, {Math.round(node.position.y)}
                    </span>
                    {isBoundary && width > 0 && height > 0 && (
                      <span>
                        {Math.round(width)}×{Math.round(height)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hierarchyTree.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No nodes in diagram
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground text-center">
        Debug mode enabled • Console logging active
      </div>
    </div>
  );
};

export default LayoutDevTools;
