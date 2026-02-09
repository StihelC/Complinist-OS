/**
 * Channel Legend Panel
 *
 * Floating panel showing channel → edge mappings for channel routing.
 * Displays channels grouped by handler/boundary.
 */

import { memo, useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Route } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { buildHandlerLegends } from '@/lib/topology/channel-routing';
import { cn } from '@/lib/utils/utils';

interface ChannelLegendPanelProps {
  onEdgeSelect?: (edgeId: string) => void;
  onEdgeHover?: (edgeId: string | null) => void;
}

const ChannelLegendPanelComponent = ({
  onEdgeSelect,
  onEdgeHover,
}: ChannelLegendPanelProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setSelectedEdgeId = useFlowStore((state) => state.setSelectedEdgeId);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedHandlers, setExpandedHandlers] = useState<Set<string>>(new Set());
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  // Channel routing mode is not currently enabled
  const isChannelMode = false;

  // Build legend data
  const legends = useMemo(() => {
    if (!isChannelMode) return [];
    return buildHandlerLegends(edges, nodes);
  }, [edges, nodes, isChannelMode]);

  // Count total channels
  const totalChannels = useMemo(() => {
    return legends.reduce((sum, legend) => sum + legend.channels.length, 0);
  }, [legends]);

  // Toggle handler expansion
  const toggleHandler = useCallback((handlerId: string) => {
    setExpandedHandlers((prev) => {
      const next = new Set(prev);
      if (next.has(handlerId)) {
        next.delete(handlerId);
      } else {
        next.add(handlerId);
      }
      return next;
    });
  }, []);

  // Handle edge click
  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      setSelectedEdgeId(edgeId);
      onEdgeSelect?.(edgeId);
    },
    [setSelectedEdgeId, onEdgeSelect]
  );

  // Handle edge hover
  const handleEdgeHover = useCallback(
    (edgeId: string | null) => {
      setHoveredEntry(edgeId);
      onEdgeHover?.(edgeId);
    },
    [onEdgeHover]
  );

  // Don't render if not in channel mode or no channels
  if (!isChannelMode || legends.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute bottom-20 right-4 z-[100]',
        'bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200',
        'transition-all duration-200',
        isCollapsed ? 'w-auto' : 'w-72'
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 rounded-t-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-sm text-gray-700">
            Channel Legend
          </span>
          {!isCollapsed && (
            <span className="text-xs text-gray-400">
              ({totalChannels} channel{totalChannels !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
          {legends.map((legend) => (
            <div key={legend.boundaryId} className="border-b border-gray-50 last:border-0">
              {/* Handler header */}
              <div
                className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded"
                onClick={() => toggleHandler(legend.boundaryId)}
              >
                <div className="flex items-center gap-2">
                  {expandedHandlers.has(legend.boundaryId) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-600 truncate max-w-40">
                    {legend.boundaryName}
                  </span>
                </div>
                <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  {legend.channels.length}
                </span>
              </div>

              {/* Channel entries */}
              {expandedHandlers.has(legend.boundaryId) && (
                <div className="ml-4 space-y-0.5 pb-1">
                  {legend.channels.map((channel) => (
                    <div
                      key={channel.edgeId}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors',
                        'hover:bg-amber-50',
                        hoveredEntry === channel.edgeId && 'bg-amber-100'
                      )}
                      onClick={() => handleEdgeClick(channel.edgeId)}
                      onMouseEnter={() => handleEdgeHover(channel.edgeId)}
                      onMouseLeave={() => handleEdgeHover(null)}
                    >
                      {/* Channel number badge */}
                      <div
                        className="flex items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          width: '18px',
                          height: '18px',
                          minWidth: '18px',
                          backgroundColor: '#fbbf24',
                          color: '#1f2937',
                        }}
                      >
                        {channel.channelNumber}
                      </div>

                      {/* Edge description */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-600 truncate">
                          <span className="font-medium">{channel.sourceName}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="font-medium">{channel.targetName}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {legends.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              No channel routes
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ChannelLegendPanel = memo(ChannelLegendPanelComponent);
ChannelLegendPanel.displayName = 'ChannelLegendPanel';
