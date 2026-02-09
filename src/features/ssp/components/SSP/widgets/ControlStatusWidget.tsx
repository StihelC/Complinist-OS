/**
 * Control Status Widget
 * Read-only display showing control narrative completion status
 */

import { useMemo } from 'react';
import { WidgetProps } from '@rjsf/utils';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { getCatalogForBaseline } from '@/lib/controls/controlCatalog';
import { AlertCircle, CheckCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NistBaseline } from '@/lib/utils/types';
import { useEffect, useState } from 'react';

interface ControlStatusWidgetProps extends WidgetProps {
  baseline?: NistBaseline;
}

export const ControlStatusWidget: React.FC<ControlStatusWidgetProps> = ({
  baseline = 'MODERATE',
}) => {
  const { selectedControlIds } = useControlSelectionStore();
  const narrativeStore = useControlNarrativesStore();
  const [availableControls, setAvailableControls] = useState<Record<string, any>>({});

  // Load control catalog
  useEffect(() => {
    const loadControls = async () => {
      try {
        const catalog = await getCatalogForBaseline(baseline);
        setAvailableControls(catalog.items);
      } catch (error) {
        console.error('[ControlStatusWidget] Failed to load catalog:', error);
      }
    };

    loadControls();
  }, [baseline]);

  const summary = useMemo(() => {
    const selectedControls = selectedControlIds
      .map((id) => availableControls[id])
      .filter(Boolean);

    // Group by family
    const byFamily: Record<string, number> = {};
    selectedControls.forEach((control) => {
      byFamily[control.family] = (byFamily[control.family] || 0) + 1;
    });

    // Count controls with custom narratives
    const withCustomNarratives = selectedControlIds.filter((controlId) => {
      const narrative = narrativeStore.items[controlId];
      return narrative && narrative.narrative && narrative.narrative.trim().length > 0;
    });

    // Count controls without narratives
    const withoutNarratives = selectedControlIds.filter((controlId) => {
      const narrative = narrativeStore.items[controlId];
      return !narrative || !narrative.narrative || narrative.narrative.trim().length === 0;
    });

    // Get list of controls without narratives for display
    const withoutNarrativesList = withoutNarratives
      .map((id) => availableControls[id])
      .filter(Boolean);

    return {
      total: selectedControlIds.length,
      byFamily,
      withCustomNarratives: withCustomNarratives.length,
      withoutNarratives: withoutNarratives.length,
      withoutNarrativesList,
    };
  }, [selectedControlIds, availableControls, narrativeStore.items]);

  const familyEntries = Object.entries(summary.byFamily).sort((a, b) => a[0].localeCompare(b[0]));

  const handleEditNarratives = () => {
    // Trigger switch to narratives tab
    const event = new CustomEvent('switch-to-narratives');
    window.dispatchEvent(event);
  };

  return (
    <div className="space-y-4">
      {/* Total Count */}
      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200">
        <span className="text-sm font-medium text-slate-700">Total Controls Selected</span>
        <span className="text-2xl font-bold text-blue-600">{summary.total}</span>
      </div>

      {/* Breakdown by Family */}
      {familyEntries.length > 0 && (
        <div className="border rounded-lg p-4 bg-white">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Breakdown by Family</h4>
          <div className="grid grid-cols-2 gap-2">
            {familyEntries.map(([family, count]) => (
              <div
                key={family}
                className="flex justify-between items-center p-2 border border-slate-200 rounded bg-gray-50"
              >
                <span className="text-xs font-medium text-slate-700">{family}</span>
                <span className="text-sm font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative Status */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-700">Control Implementation Status</h4>

        <div className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-slate-700">With Custom Implementation Details</span>
          </div>
          <span className="text-lg font-bold text-green-600">{summary.withCustomNarratives}</span>
        </div>

        {summary.withoutNarratives > 0 && (
          <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-slate-700">
                  Need Custom Implementation Details
                </span>
              </div>
              <span className="text-lg font-bold text-amber-600">{summary.withoutNarratives}</span>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              These controls will use generic text. Add custom details for better compliance documentation.
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
              {summary.withoutNarrativesList.slice(0, 10).map((control) => (
                <div
                  key={control.control_id}
                  className="text-xs text-slate-600 flex items-center gap-2"
                >
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-mono font-semibold">{control.control_id}</span>
                  <span>
                    - {control.title.length > 50 ? `${control.title.substring(0, 50)}...` : control.title}
                  </span>
                </div>
              ))}
              {summary.withoutNarrativesList.length > 10 && (
                <p className="text-xs text-slate-500 italic pt-1">
                  ... and {summary.withoutNarrativesList.length - 10} more
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={handleEditNarratives}
              type="button"
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Edit Narratives in Control Narratives Tab
            </Button>
          </div>
        )}
      </div>

      {/* Helpful Tip */}
      {summary.withoutNarratives > 0 && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-600">
            <strong>Tip:</strong> Custom narratives show how YOUR system implements each control. 
            Generic text may not satisfy auditors.
          </p>
        </div>
      )}
    </div>
  );
};

