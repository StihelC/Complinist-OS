/**
 * Bulk Control Selector Widget
 *
 * Provides UI for bulk control selection based on:
 * - Priority levels (Critical, High, Medium, Low)
 * - Topology analysis recommendations
 * - Control families
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Shield,
  AlertTriangle,
  Layers,
  Network,
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { getControlRecommendations } from '@/lib/controls/controlRecommendations';
import priorityMappings from '@/assets/catalog/control-priorities.json';
import type { ControlPriority, NistBaseline } from '@/lib/utils/types';

interface BulkControlSelectorProps {
  baseline: NistBaseline;
  availableControlIds: string[];
  onSelectionChange?: (count: number) => void;
}

interface SelectionPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  getControlIds: () => string[];
  color: string;
}

export const BulkControlSelector: React.FC<BulkControlSelectorProps> = ({
  baseline,
  availableControlIds,
  onSelectionChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);

  const {
    selectedControlIds,
    setSelectedControlIds,
  } = useControlSelectionStore();

  // Get topology-based recommendations
  const topologyRecommendations = useMemo(() => {
    return getControlRecommendations(nodes, edges);
  }, [nodes, edges]);

  // Get priority control IDs
  const getPriorityControlIds = useCallback(
    (priority: ControlPriority): string[] => {
      const priorityData = priorityMappings as {
        critical: string[];
        high: string[];
        medium: string[];
        low: string[];
        topology_mappings: Record<string, string[]>;
      };
      const ids = priorityData[priority] || [];
      return ids.filter((id) => availableControlIds.includes(id));
    },
    [availableControlIds]
  );

  // Define selection presets
  const presets: SelectionPreset[] = useMemo(
    () => [
      {
        id: 'critical',
        name: 'Critical Controls',
        description: 'Essential security controls required for baseline compliance',
        icon: <AlertTriangle className="w-4 h-4" />,
        getControlIds: () => getPriorityControlIds('critical'),
        color: 'text-red-600 bg-red-50 border-red-200',
      },
      {
        id: 'critical-high',
        name: 'Critical + High Priority',
        description: 'Critical controls plus high-priority recommendations',
        icon: <Shield className="w-4 h-4" />,
        getControlIds: () => [
          ...getPriorityControlIds('critical'),
          ...getPriorityControlIds('high'),
        ],
        color: 'text-orange-600 bg-orange-50 border-orange-200',
      },
      {
        id: 'topology',
        name: 'Topology-Based',
        description: `${topologyRecommendations.length} controls recommended based on your network devices`,
        icon: <Network className="w-4 h-4" />,
        getControlIds: () => topologyRecommendations.map((r) => r.controlId),
        color: 'text-blue-600 bg-blue-50 border-blue-200',
      },
      {
        id: 'smart',
        name: 'Smart Selection',
        description: 'Critical + High + Topology recommendations combined',
        icon: <Zap className="w-4 h-4" />,
        getControlIds: () => {
          const ids = new Set<string>();
          getPriorityControlIds('critical').forEach((id) => ids.add(id));
          getPriorityControlIds('high').forEach((id) => ids.add(id));
          topologyRecommendations.forEach((r) => ids.add(r.controlId));
          return Array.from(ids).filter((id) => availableControlIds.includes(id));
        },
        color: 'text-purple-600 bg-purple-50 border-purple-200',
      },
      {
        id: 'all-baseline',
        name: 'Full Baseline',
        description: `All ${availableControlIds.length} controls for ${baseline} baseline`,
        icon: <Layers className="w-4 h-4" />,
        getControlIds: () => availableControlIds,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
      },
    ],
    [getPriorityControlIds, topologyRecommendations, availableControlIds, baseline]
  );

  const handleApplyPreset = useCallback(
    (preset: SelectionPreset) => {
      const controlIds = preset.getControlIds();
      const uniqueIds = [...new Set(controlIds)];

      setSelectedControlIds(uniqueIds);
      onSelectionChange?.(uniqueIds.length);

      setMessage({
        type: 'success',
        text: `Applied "${preset.name}" - ${uniqueIds.length} controls selected`,
      });
      setTimeout(() => setMessage(null), 3000);
    },
    [setSelectedControlIds, onSelectionChange]
  );

  const handleAddToSelection = useCallback(
    (preset: SelectionPreset) => {
      const controlIds = preset.getControlIds();
      const newSelection = [...new Set([...selectedControlIds, ...controlIds])];

      setSelectedControlIds(newSelection);
      onSelectionChange?.(newSelection.length);

      const addedCount = newSelection.length - selectedControlIds.length;
      setMessage({
        type: 'info',
        text: `Added ${addedCount} controls from "${preset.name}"`,
      });
      setTimeout(() => setMessage(null), 3000);
    },
    [selectedControlIds, setSelectedControlIds, onSelectionChange]
  );

  // Calculate preset statistics
  const getPresetStats = useCallback(
    (preset: SelectionPreset) => {
      const presetIds = preset.getControlIds();
      const selectedCount = presetIds.filter((id) =>
        selectedControlIds.includes(id)
      ).length;
      return {
        total: presetIds.length,
        selected: selectedCount,
        percentage: presetIds.length > 0 ? Math.round((selectedCount / presetIds.length) * 100) : 0,
      };
    },
    [selectedControlIds]
  );

  return (
    <div className="border rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/50 transition-colors"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">Bulk Control Selection</h3>
            <p className="text-xs text-gray-500">
              Quick presets based on priority & topology
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {topologyRecommendations.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
              {topologyRecommendations.length} Topology Recommendations
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t bg-white p-4 space-y-4">
          {/* Message Banner */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              <Check className="w-4 h-4" />
              {message.text}
            </div>
          )}

          {/* Preset Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {presets.map((preset) => {
              const stats = getPresetStats(preset);
              const isFullySelected = stats.selected === stats.total && stats.total > 0;

              return (
                <div
                  key={preset.id}
                  className={`p-3 rounded-lg border ${preset.color} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {preset.icon}
                      <span className="text-sm font-medium">{preset.name}</span>
                    </div>
                    <span className="text-xs font-medium">
                      {stats.total} controls
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{preset.description}</p>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {stats.selected}/{stats.total} selected
                      </span>
                      <span>{stats.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-current transition-all duration-300"
                        style={{ width: `${stats.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyPreset(preset)}
                      className="flex-1 text-xs h-7"
                      type="button"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddToSelection(preset)}
                      disabled={isFullySelected}
                      className="flex-1 text-xs h-7"
                      type="button"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Topology Recommendations Details */}
          {topologyRecommendations.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Topology Analysis Results
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {topologyRecommendations.slice(0, 5).map((rec) => (
                  <div
                    key={rec.controlId}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-blue-700">
                        {rec.controlId}
                      </span>
                      <span className="text-gray-600 truncate max-w-[200px]">
                        {rec.reason}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        rec.confidence === 'high'
                          ? 'bg-green-100 text-green-700'
                          : rec.confidence === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {rec.confidence}
                    </span>
                  </div>
                ))}
                {topologyRecommendations.length > 5 && (
                  <p className="text-xs text-blue-600 pt-1">
                    + {topologyRecommendations.length - 5} more recommendations
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
