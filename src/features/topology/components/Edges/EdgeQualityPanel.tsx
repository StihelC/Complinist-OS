/**
 * Edge Quality Panel Component
 *
 * User-facing panel displaying edge routing quality metrics
 * and providing quick actions to fix routing issues.
 *
 * Features:
 * - Warning indicators on edges with label overlap issues
 * - "Fix Edge Routing" quick action for problem areas
 * - Edge routing quality score in topology status panel
 * - Preview mode showing before/after edge optimization
 */

import { useState, useMemo, useCallback, memo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  ChevronRight,
  ChevronDown,
  Activity,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { cn } from '@/lib/utils/utils';
import {
  calculateEdgeDebugMetrics,
} from '@/lib/topology/edge-routing-metrics';
import {
  detectEdgeProblems,
  EdgeProblem,
  getEdgeQualityStatus,
  countProblemsBySeverity,
} from '@/lib/topology/edge-debug-utils';

// =============================================================================
// Types
// =============================================================================

interface EdgeQualityPanelProps {
  /** Whether the panel is expanded */
  isExpanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Callback to open debug overlay */
  onOpenDebug?: () => void;
  /** Optional class name */
  className?: string;
  /** Compact mode for embedding in other panels */
  compact?: boolean;
}

interface QualityIndicatorProps {
  score: number;
  grade: string;
  status: 'good' | 'warning' | 'error';
  compact?: boolean;
}

interface ProblemCardProps {
  problem: EdgeProblem;
  onFix?: () => void;
  onSelect?: () => void;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Quality Score Indicator
 */
const QualityIndicator = memo(({
  score,
  grade,
  status,
  compact = false,
}: QualityIndicatorProps) => {
  const statusColors = {
    good: 'text-green-500 bg-green-100 dark:bg-green-900/30',
    warning: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
    error: 'text-red-500 bg-red-100 dark:bg-red-900/30',
  };

  const progressColor = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center space-x-2 px-2 py-1 rounded-full',
        statusColors[status]
      )}>
        {status === 'good' ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span className="text-xs font-medium">{grade}</span>
        <span className="text-xs">{score}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            statusColors[status]
          )}>
            <span className="text-sm font-bold">{grade}</span>
          </div>
          <div>
            <div className="text-sm font-medium">Edge Quality</div>
            <div className="text-xs text-gray-500">Routing score</div>
          </div>
        </div>
        <div className="text-2xl font-bold">{score}%</div>
      </div>
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', progressColor[status])}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
});

QualityIndicator.displayName = 'QualityIndicator';

/**
 * Problem Card for individual issues
 */
const ProblemCard = memo(({
  problem,
  onFix,
  onSelect,
}: ProblemCardProps) => {
  const severityStyles = {
    warning: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10',
    error: 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
  };

  return (
    <div
      className={cn(
        'p-3 rounded-r border-l-4 cursor-pointer hover:shadow-sm transition-shadow',
        severityStyles[problem.severity]
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className={cn(
              'w-4 h-4 flex-shrink-0',
              problem.severity === 'error' ? 'text-red-500' : 'text-yellow-500'
            )} />
            <code className="text-xs font-mono truncate">
              {problem.edgeId.slice(0, 16)}...
            </code>
          </div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {problem.problems[0]}
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            {problem.suggestedFix}
          </div>
        </div>
        {onFix && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs flex-shrink-0 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onFix();
            }}
          >
            <Zap className="w-3 h-3 mr-1" />
            Fix
          </Button>
        )}
      </div>
    </div>
  );
});

ProblemCard.displayName = 'ProblemCard';

/**
 * Metrics Summary Row
 */
const MetricRow = memo(({
  label,
  value,
  subValue,
  status,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  status?: 'good' | 'warning' | 'error';
}) => {
  const statusColors = {
    good: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  };

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center space-x-1">
        <span className={cn(
          'text-sm font-medium',
          status && statusColors[status]
        )}>
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] text-gray-400">({subValue})</span>
        )}
      </div>
    </div>
  );
});

MetricRow.displayName = 'MetricRow';

// =============================================================================
// Main Component
// =============================================================================

export const EdgeQualityPanel = memo(({
  isExpanded: controlledExpanded,
  onExpandedChange,
  onOpenDebug,
  className,
  compact = false,
}: EdgeQualityPanelProps) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const tidyDiagram = useFlowStore((state) => state.tidyDiagram);
  const isTidying = useFlowStore((state) => state.isTidying);

  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleExpandedChange = useCallback((expanded: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(expanded);
    } else {
      setInternalExpanded(expanded);
    }
  }, [onExpandedChange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    return calculateEdgeDebugMetrics(nodes, edges);
  }, [nodes, edges]);

  // Get status
  const status = useMemo(() => {
    return getEdgeQualityStatus(nodes, edges);
  }, [nodes, edges]);

  // Get problems
  const problems = useMemo(() => {
    return detectEdgeProblems(nodes, edges);
  }, [nodes, edges]);

  const problemCounts = useMemo(() => {
    return countProblemsBySeverity(problems);
  }, [problems]);

  // Quick fix handler using Auto-Tidy
  const handleQuickFix = useCallback(async () => {
    if (!isTidying) {
      await tidyDiagram({ animate: true });
    }
  }, [tidyDiagram, isTidying]);

  // If no edges, show minimal state
  if (edges.length === 0) {
    if (compact) {
      return (
        <div className={cn('flex items-center text-xs text-gray-400', className)}>
          <Activity className="w-3 h-3 mr-1" />
          No edges
        </div>
      );
    }
    return null;
  }

  // Compact mode for embedding
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
          className
        )}
        onClick={() => onOpenDebug?.()}
      >
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium">Edge Quality</span>
        </div>
        <div className="flex items-center space-x-2">
          <QualityIndicator
            score={status.qualityScore}
            grade={status.qualityGrade}
            status={status.status}
            compact
          />
          {problems.length > 0 && (
            <Badge variant="outline" className="text-[10px] py-0 px-1">
              {problems.length} issue{problems.length !== 1 ? 's' : ''}
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => handleExpandedChange(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-sm">Edge Routing Quality</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <QualityIndicator
              score={status.qualityScore}
              grade={status.qualityGrade}
              status={status.status}
              compact
            />
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Quality Score */}
          <QualityIndicator
            score={status.qualityScore}
            grade={status.qualityGrade}
            status={status.status}
          />

          {/* Metrics Grid */}
          <div className="mt-4 space-y-1 border-t border-b py-2">
            <MetricRow
              label="Total Edges"
              value={metrics.summary.totalEdges}
            />
            <MetricRow
              label="Edge Crossings"
              value={metrics.quality.metrics.totalCrossings}
              status={metrics.quality.metrics.totalCrossings > 3 ? 'error' :
                      metrics.quality.metrics.totalCrossings > 0 ? 'warning' : 'good'}
            />
            <MetricRow
              label="Label Collisions"
              value={metrics.quality.metrics.labelCollisionCount}
              status={metrics.quality.metrics.labelCollisionCount > 0 ? 'error' : 'good'}
            />
            <MetricRow
              label="Avg. Edge Length"
              value={`${Math.round(metrics.summary.averageLength)}px`}
              status={metrics.summary.averageLength > 400 ? 'warning' : 'good'}
            />
          </div>

          {/* Quality Distribution */}
          <div className="mt-4">
            <div className="text-xs font-medium mb-2">Quality Distribution</div>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-green-500 transition-all"
                style={{
                  width: `${(metrics.summary.goodQualityEdges / Math.max(1, metrics.summary.totalEdges)) * 100}%`,
                }}
                title={`Good: ${metrics.summary.goodQualityEdges}`}
              />
              <div
                className="bg-yellow-500 transition-all"
                style={{
                  width: `${(metrics.summary.fairQualityEdges / Math.max(1, metrics.summary.totalEdges)) * 100}%`,
                }}
                title={`Fair: ${metrics.summary.fairQualityEdges}`}
              />
              <div
                className="bg-red-500 transition-all"
                style={{
                  width: `${(metrics.summary.poorQualityEdges / Math.max(1, metrics.summary.totalEdges)) * 100}%`,
                }}
                title={`Poor: ${metrics.summary.poorQualityEdges}`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-500">
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                Good: {metrics.summary.goodQualityEdges}
              </span>
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />
                Fair: {metrics.summary.fairQualityEdges}
              </span>
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
                Poor: {metrics.summary.poorQualityEdges}
              </span>
            </div>
          </div>

          {/* Problems */}
          {problems.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1 text-orange-500" />
                  Issues ({problems.length})
                </span>
                {problemCounts.errors > 0 && (
                  <Badge variant="destructive" className="text-[10px] py-0">
                    {problemCounts.errors} error{problemCounts.errors !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {problems.slice(0, 5).map((problem) => (
                  <ProblemCard
                    key={problem.edgeId}
                    problem={problem}
                  />
                ))}
                {problems.length > 5 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{problems.length - 5} more issues
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex space-x-2">
            {problems.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleQuickFix}
                disabled={isTidying}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {isTidying ? 'Optimizing...' : 'Fix All Issues'}
              </Button>
            )}
            {onOpenDebug && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={onOpenDebug}
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                Debug
              </Button>
            )}
          </div>

          {/* Suggestions */}
          {metrics.quality.suggestions.length > 0 && status.status !== 'good' && (
            <div className="mt-4 pt-3 border-t">
              <div className="text-xs font-medium mb-1">Suggestions</div>
              <div className="space-y-1">
                {metrics.quality.suggestions.slice(0, 2).map((suggestion: string, idx: number) => (
                  <div key={idx} className="text-[11px] text-gray-600 dark:text-gray-400 flex">
                    <span className="text-blue-500 mr-1">*</span>
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
});

EdgeQualityPanel.displayName = 'EdgeQualityPanel';

// =============================================================================
// Status Badge for Topology Toolbar
// =============================================================================

export const EdgeQualityStatusBadge = memo(({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const status = useMemo(() => {
    return getEdgeQualityStatus(nodes, edges);
  }, [nodes, edges]);

  if (edges.length === 0) return null;

  const statusColors = {
    good: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <button
      className={cn(
        'flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
        statusColors[status.status],
        className
      )}
      onClick={onClick}
      title={status.statusMessage}
    >
      {status.status === 'good' ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      <span>{status.qualityGrade}</span>
      {status.totalIssues > 0 && (
        <span className="ml-1 text-[10px]">({status.totalIssues})</span>
      )}
    </button>
  );
});

EdgeQualityStatusBadge.displayName = 'EdgeQualityStatusBadge';

export default EdgeQualityPanel;
