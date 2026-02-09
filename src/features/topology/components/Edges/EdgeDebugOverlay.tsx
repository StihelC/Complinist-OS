/**
 * Edge Debug Overlay Component
 *
 * Visual debugging overlay for edge label placement, routing quality,
 * and collision issues. Developer tool for diagnosing edge problems.
 *
 * Features:
 * - Visual overlay showing edge label bounding boxes
 * - Highlight detected collisions (label-to-label, label-to-node)
 * - Display edge routing metrics (length, crossings, bends)
 * - Edge quality heatmap (green=optimal, red=poor routing)
 * - Click edge to show detailed routing analysis
 *
 * Keyboard shortcut: Ctrl/Cmd + Shift + E
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useViewport } from '@xyflow/react';
import { X, Eye, AlertTriangle, Activity, Target, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { cn } from '@/lib/utils/utils';
import {
  calculateEdgeDebugMetrics,
  EdgeDebugMetrics,
  HEATMAP_COLORS,
  COLLISION_COLORS,
  formatLength,
  logEdgeMetricsToConsole,
} from '@/lib/topology/edge-routing-metrics';
import {
  DebugOverlayOptions,
  DEFAULT_DEBUG_OPTIONS,
  detectEdgeProblems,
  getEdgeQualityStatus,
} from '@/lib/topology/edge-debug-utils';

// =============================================================================
// Types
// =============================================================================

interface EdgeDebugOverlayProps {
  /** Whether the overlay is visible */
  isOpen: boolean;
  /** Callback to close the overlay */
  onClose: () => void;
  /** Optional class name */
  className?: string;
}

interface OverlayVisualizationProps {
  metrics: EdgeDebugMetrics;
  options: DebugOverlayOptions;
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string | null) => void;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * SVG Overlay for visualizing debug elements
 */
const OverlayVisualization = memo(({
  metrics,
  options,
  selectedEdgeId,
  onSelectEdge,
}: OverlayVisualizationProps) => {
  const viewport = useViewport();

  // Calculate transform for viewport positioning
  const transform = useMemo(() => {
    return `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
  }, [viewport.x, viewport.y, viewport.zoom]);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 9990 }}
    >
      <g style={{ transform, transformOrigin: '0 0' }}>
        {/* Label Bounding Boxes */}
        {options.showLabelBoundingBoxes && metrics.edgeVisualizations.map(edgeViz => {
          if (!edgeViz.labelBoundingBox) return null;
          const box = edgeViz.labelBoundingBox;
          const isSelected = edgeViz.edgeId === selectedEdgeId;
          const hasCollision =
            edgeViz.labelCollisions.withLabels.length > 0 ||
            edgeViz.labelCollisions.withNodes.length > 0;

          return (
            <g key={`bbox-${edgeViz.edgeId}`}>
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={hasCollision ? 'rgba(249, 115, 22, 0.1)' : 'rgba(59, 130, 246, 0.1)'}
                stroke={hasCollision ? COLLISION_COLORS.labelToLabel : COLLISION_COLORS.boundingBox}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={hasCollision ? undefined : '4,4'}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onSelectEdge(edgeViz.edgeId)}
              />
              {/* Edge ID label */}
              <text
                x={box.x + 2}
                y={box.y - 4}
                fontSize={10}
                fill="#6b7280"
              >
                {edgeViz.edgeId.slice(0, 8)}...
              </text>
            </g>
          );
        })}

        {/* Crossing Indicators */}
        {options.showCrossings && metrics.crossingPairs.map((crossing, index) => (
          <g key={`crossing-${index}`}>
            <circle
              cx={crossing.intersectionPoint.x}
              cy={crossing.intersectionPoint.y}
              r={8}
              fill="rgba(139, 92, 246, 0.3)"
              stroke={COLLISION_COLORS.crossing}
              strokeWidth={2}
            />
            <line
              x1={crossing.intersectionPoint.x - 4}
              y1={crossing.intersectionPoint.y - 4}
              x2={crossing.intersectionPoint.x + 4}
              y2={crossing.intersectionPoint.y + 4}
              stroke={COLLISION_COLORS.crossing}
              strokeWidth={2}
            />
            <line
              x1={crossing.intersectionPoint.x + 4}
              y1={crossing.intersectionPoint.y - 4}
              x2={crossing.intersectionPoint.x - 4}
              y2={crossing.intersectionPoint.y + 4}
              stroke={COLLISION_COLORS.crossing}
              strokeWidth={2}
            />
          </g>
        ))}

        {/* Quality Heatmap Overlay Lines */}
        {options.showHeatmap && metrics.edgeVisualizations.map(edgeViz => {
          if (!options.highlightPoorQuality && edgeViz.qualityRating === 'good') return null;

          return (
            <line
              key={`heatmap-${edgeViz.edgeId}`}
              x1={edgeViz.sourcePosition.x}
              y1={edgeViz.sourcePosition.y}
              x2={edgeViz.targetPosition.x}
              y2={edgeViz.targetPosition.y}
              stroke={edgeViz.heatmapColor}
              strokeWidth={edgeViz.qualityRating === 'poor' ? 4 : 2}
              strokeOpacity={0.6}
              strokeLinecap="round"
              className="pointer-events-none"
            />
          );
        })}

        {/* Selected Edge Highlight */}
        {selectedEdgeId && metrics.edgeVisualizations.find(e => e.edgeId === selectedEdgeId) && (() => {
          const edgeViz = metrics.edgeVisualizations.find(e => e.edgeId === selectedEdgeId)!;
          return (
            <g>
              <line
                x1={edgeViz.sourcePosition.x}
                y1={edgeViz.sourcePosition.y}
                x2={edgeViz.targetPosition.x}
                y2={edgeViz.targetPosition.y}
                stroke="#3b82f6"
                strokeWidth={6}
                strokeOpacity={0.4}
                strokeLinecap="round"
              />
              {/* Source indicator */}
              <circle
                cx={edgeViz.sourcePosition.x}
                cy={edgeViz.sourcePosition.y}
                r={6}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
              />
              {/* Target indicator */}
              <circle
                cx={edgeViz.targetPosition.x}
                cy={edgeViz.targetPosition.y}
                r={6}
                fill="#22c55e"
                stroke="white"
                strokeWidth={2}
              />
            </g>
          );
        })()}
      </g>
    </svg>
  );
});

OverlayVisualization.displayName = 'OverlayVisualization';

/**
 * Options Panel for debug overlay
 */
const OptionsPanel = memo(({
  options,
  onOptionsChange,
}: {
  options: DebugOverlayOptions;
  onOptionsChange: (options: DebugOverlayOptions) => void;
}) => {
  const handleToggle = (key: keyof DebugOverlayOptions) => {
    onOptionsChange({
      ...options,
      [key]: !options[key],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="showLabelBoundingBoxes"
          checked={options.showLabelBoundingBoxes}
          onChange={() => handleToggle('showLabelBoundingBoxes')}
        />
        <Label htmlFor="showLabelBoundingBoxes" className="text-xs">
          Label Bounding Boxes
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="showLabelCollisions"
          checked={options.showLabelCollisions}
          onChange={() => handleToggle('showLabelCollisions')}
        />
        <Label htmlFor="showLabelCollisions" className="text-xs">
          Label Collisions
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="showCrossings"
          checked={options.showCrossings}
          onChange={() => handleToggle('showCrossings')}
        />
        <Label htmlFor="showCrossings" className="text-xs">
          Edge Crossings
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="showHeatmap"
          checked={options.showHeatmap}
          onChange={() => handleToggle('showHeatmap')}
        />
        <Label htmlFor="showHeatmap" className="text-xs">
          Quality Heatmap
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="highlightPoorQuality"
          checked={options.highlightPoorQuality}
          onChange={() => handleToggle('highlightPoorQuality')}
        />
        <Label htmlFor="highlightPoorQuality" className="text-xs">
          Highlight Poor Quality
        </Label>
      </div>
    </div>
  );
});

OptionsPanel.displayName = 'OptionsPanel';

/**
 * Edge Details Panel showing metrics for selected edge
 */
const EdgeDetailsPanel = memo(({
  metrics,
  selectedEdgeId,
}: {
  metrics: EdgeDebugMetrics;
  selectedEdgeId: string | null;
}) => {
  const edgeViz = useMemo(() => {
    if (!selectedEdgeId) return null;
    return metrics.edgeVisualizations.find(e => e.edgeId === selectedEdgeId);
  }, [metrics, selectedEdgeId]);

  if (!edgeViz) {
    return (
      <div className="text-xs text-gray-500 italic">
        Click an edge to view detailed metrics
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Edge ID:</span>
        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
          {edgeViz.edgeId.slice(0, 12)}...
        </code>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Length:</span>
          <span className="ml-1 font-medium">{formatLength(edgeViz.length)}</span>
        </div>
        <div>
          <span className="text-gray-500">Bends:</span>
          <span className="ml-1 font-medium">{edgeViz.bendCount}</span>
        </div>
        <div>
          <span className="text-gray-500">Crossings:</span>
          <span className={cn(
            'ml-1 font-medium',
            edgeViz.crossingCount > 0 && 'text-orange-500'
          )}>
            {edgeViz.crossingCount}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Quality:</span>
          <Badge
            variant={
              edgeViz.qualityRating === 'good' ? 'secondary' :
              edgeViz.qualityRating === 'fair' ? 'outline' : 'destructive'
            }
            className="ml-1 text-xs py-0"
          >
            {edgeViz.qualityRating}
          </Badge>
        </div>
      </div>

      {edgeViz.hasLabel && (
        <div className="pt-2 border-t">
          <span className="text-xs text-gray-500">Label Collisions:</span>
          {edgeViz.labelCollisions.withLabels.length === 0 &&
           edgeViz.labelCollisions.withNodes.length === 0 ? (
            <span className="ml-1 text-xs text-green-500">None</span>
          ) : (
            <div className="mt-1 space-y-1">
              {edgeViz.labelCollisions.withLabels.length > 0 && (
                <div className="text-xs text-orange-500">
                  With labels: {edgeViz.labelCollisions.withLabels.length}
                </div>
              )}
              {edgeViz.labelCollisions.withNodes.length > 0 && (
                <div className="text-xs text-red-500">
                  With nodes: {edgeViz.labelCollisions.withNodes.length}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {edgeViz.crossingEdgeIds.length > 0 && (
        <div className="pt-2 border-t">
          <span className="text-xs text-gray-500">Crosses with:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {edgeViz.crossingEdgeIds.slice(0, 3).map(id => (
              <code key={id} className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded">
                {id.slice(0, 8)}
              </code>
            ))}
            {edgeViz.crossingEdgeIds.length > 3 && (
              <span className="text-[10px] text-gray-500">
                +{edgeViz.crossingEdgeIds.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

EdgeDetailsPanel.displayName = 'EdgeDetailsPanel';

// =============================================================================
// Main Component
// =============================================================================

export const EdgeDebugOverlay = memo(({
  isOpen,
  onClose,
  className,
}: EdgeDebugOverlayProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const [options, setOptions] = useState<DebugOverlayOptions>(DEFAULT_DEBUG_OPTIONS);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate metrics (with safety checks)
  const metrics = useMemo(() => {
    // Ensure edges is always an array
    const safeEdges = Array.isArray(edges) ? edges : [];
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    return calculateEdgeDebugMetrics(safeNodes, safeEdges);
  }, [nodes, edges]);

  // Get problems for user-facing display
  const problems = useMemo(() => {
    const safeEdges = Array.isArray(edges) ? edges : [];
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    return detectEdgeProblems(safeNodes, safeEdges);
  }, [nodes, edges]);

  // Get status
  const status = useMemo(() => {
    const safeEdges = Array.isArray(edges) ? edges : [];
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    return getEdgeQualityStatus(safeNodes, safeEdges);
  }, [nodes, edges]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Log to console on open
  useEffect(() => {
    if (isOpen) {
      logEdgeMetricsToConsole(metrics);
    }
  }, [isOpen, metrics]);

  const handleSelectEdge = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) {
      setActiveTab('details');
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen overlay for visualizations */}
      <div className={cn('absolute inset-0 z-[9989] pointer-events-none', className)}>
        <OverlayVisualization
          metrics={metrics}
          options={options}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={handleSelectEdge}
        />
      </div>

      {/* Control Panel */}
      <div className="absolute top-4 right-4 z-[9999] pointer-events-auto">
        <Card className="w-80 shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <CardTitle className="text-sm">Edge Debug</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Status Summary */}
            <div className="mb-4 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Quality Score</span>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      status.status === 'good' ? 'secondary' :
                      status.status === 'warning' ? 'outline' : 'destructive'
                    }
                    className="text-xs"
                  >
                    {status.qualityGrade}
                  </Badge>
                  <span className="text-sm font-bold">{status.qualityScore}%</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div>
                  <div className="text-gray-500">Edges</div>
                  <div className="font-medium">{metrics.summary.totalEdges}</div>
                </div>
                <div>
                  <div className="text-gray-500">Crossings</div>
                  <div className={cn(
                    'font-medium',
                    status.crossings > 0 && 'text-violet-500'
                  )}>
                    {status.crossings}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Collisions</div>
                  <div className={cn(
                    'font-medium',
                    status.labelCollisions > 0 && 'text-orange-500'
                  )}>
                    {status.labelCollisions}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="overview" className="text-xs">
                  <Layers className="w-3 h-3 mr-1" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="options" className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  Options
                </TabsTrigger>
                <TabsTrigger value="details" className="text-xs">
                  <Target className="w-3 h-3 mr-1" />
                  Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-3 space-y-3">
                {/* Quality Distribution */}
                <div>
                  <span className="text-xs font-medium">Quality Distribution</span>
                  <div className="mt-2 flex h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-green-500"
                      style={{
                        width: `${(metrics.summary.goodQualityEdges / Math.max(1, metrics.summary.totalEdges)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-yellow-500"
                      style={{
                        width: `${(metrics.summary.fairQualityEdges / Math.max(1, metrics.summary.totalEdges)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500"
                      style={{
                        width: `${(metrics.summary.poorQualityEdges / Math.max(1, metrics.summary.totalEdges)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                      Good: {metrics.summary.goodQualityEdges}
                    </span>
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1" />
                      Fair: {metrics.summary.fairQualityEdges}
                    </span>
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                      Poor: {metrics.summary.poorQualityEdges}
                    </span>
                  </div>
                </div>

                {/* Problems */}
                {problems.length > 0 && (
                  <div>
                    <span className="text-xs font-medium flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1 text-orange-500" />
                      Issues ({problems.length})
                    </span>
                    <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                      {problems.slice(0, 5).map((problem) => (
                        <div
                          key={problem.edgeId}
                          className={cn(
                            'text-xs p-1.5 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
                            problem.severity === 'error' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-orange-50 dark:bg-orange-900/20'
                          )}
                          onClick={() => handleSelectEdge(problem.edgeId)}
                        >
                          <div className="font-medium truncate">{problem.edgeId.slice(0, 16)}...</div>
                          <div className="text-gray-500 truncate">{problem.problems[0]}</div>
                        </div>
                      ))}
                      {problems.length > 5 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{problems.length - 5} more issues
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {metrics.quality.suggestions.length > 0 && (
                  <div>
                    <span className="text-xs font-medium">Suggestions</span>
                    <div className="mt-1 space-y-1">
                      {metrics.quality.suggestions.slice(0, 2).map((suggestion: string, idx: number) => (
                        <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="options" className="mt-3">
                <OptionsPanel options={options} onOptionsChange={setOptions} />
              </TabsContent>

              <TabsContent value="details" className="mt-3">
                <EdgeDetailsPanel metrics={metrics} selectedEdgeId={selectedEdgeId} />
              </TabsContent>
            </Tabs>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t">
              <span className="text-xs text-gray-500">Legend:</span>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: COLLISION_COLORS.boundingBox }}
                  />
                  Label Bounds
                </div>
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: COLLISION_COLORS.labelToLabel }}
                  />
                  Collision
                </div>
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: COLLISION_COLORS.crossing }}
                  />
                  Crossing
                </div>
                <div className="flex items-center">
                  <span
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: HEATMAP_COLORS.good }}
                  />
                  <span
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: HEATMAP_COLORS.fair }}
                  />
                  <span
                    className="w-3 h-3 rounded mr-1"
                    style={{ backgroundColor: HEATMAP_COLORS.poor }}
                  />
                  Heatmap
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});

EdgeDebugOverlay.displayName = 'EdgeDebugOverlay';

export default EdgeDebugOverlay;
