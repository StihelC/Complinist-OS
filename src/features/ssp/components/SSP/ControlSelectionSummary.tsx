import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, ChevronRight, Shield, Target, TrendingUp } from 'lucide-react';
import type { ControlNarrative } from '@/lib/utils/types';

interface ControlSelectionSummaryProps {
  selectedControlIds: string[];
  allControls: Record<string, ControlNarrative>;
  onEditControls?: () => void;
}

export function ControlSelectionSummary({
  selectedControlIds,
  allControls,
  onEditControls,
}: ControlSelectionSummaryProps) {
  const summary = useMemo(() => {
    const selectedControls = selectedControlIds
      .map(id => allControls[id])
      .filter(Boolean);

    // Group by family
    const byFamily: Record<string, number> = {};
    selectedControls.forEach(control => {
      byFamily[control.family] = (byFamily[control.family] || 0) + 1;
    });

    // Count controls with custom narratives
    const withCustomNarratives = selectedControls.filter(
      c => c.isCustom || c.wasCustom
    );

    // Count controls without narratives
    const withoutNarratives = selectedControls.filter(
      c => !c.isCustom && !c.wasCustom && (!c.system_implementation || c.system_implementation.trim() === '')
    );

    return {
      total: selectedControls.length,
      byFamily,
      withCustomNarratives: withCustomNarratives.length,
      withoutNarratives: withoutNarratives.length,
      withoutNarrativesList: withoutNarratives,
    };
  }, [selectedControlIds, allControls]);

  const familyEntries = Object.entries(summary.byFamily).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-4">
      <Card className="shadow-md border-2">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span>Control Selection Summary</span>
            </div>
            {onEditControls && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditControls}
                className="text-xs hover:bg-blue-50"
              >
                Edit Selection
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Total Count */}
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 shadow-sm">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Total Controls Selected</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{summary.total}</div>
              <div className="text-xs text-blue-700">Security Controls</div>
            </div>
          </div>

          {/* Breakdown by Family */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              Breakdown by Family
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {familyEntries.map(([family, count]) => (
                <div
                  key={family}
                  className="flex justify-between items-center p-3 border-2 border-slate-200 rounded-lg bg-white hover:shadow-md transition-shadow"
                >
                  <span className="text-xs font-semibold text-slate-700">{family}</span>
                  <Badge variant="default" className="text-xs">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Narrative Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gray-600" />
              Narrative Status
            </h4>
            
            <div className="flex items-center justify-between p-4 border-2 border-green-200 bg-gradient-to-r from-green-50 to-green-100 rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700">Custom Narratives</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{summary.withCustomNarratives}</div>
                <div className="text-xs text-green-700">Complete</div>
              </div>
            </div>

            {summary.withoutNarratives > 0 && (
              <div className="p-4 border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-700">
                      Without Custom Narratives
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-amber-600">{summary.withoutNarratives}</div>
                    <div className="text-xs text-amber-700">Pending</div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-3 pl-8">
                  These controls will use auto-generated placeholder text in the SSP:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pl-8">
                  {summary.withoutNarrativesList.slice(0, 10).map(control => (
                    <div
                      key={control.control_id}
                      className="text-xs text-slate-700 flex items-start gap-2 p-2 bg-white rounded border border-amber-200"
                    >
                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-600" />
                      <div>
                        <span className="font-mono font-bold text-amber-800">{control.control_id}</span>
                        <span className="text-gray-600"> - {control.title}</span>
                      </div>
                    </div>
                  ))}
                  {summary.withoutNarrativesList.length > 10 && (
                    <p className="text-xs text-slate-500 italic pt-2 pl-2">
                      ... and {summary.withoutNarrativesList.length - 10} more controls
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Helpful Tip */}
          {summary.withoutNarratives > 0 && (
            <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-lg">
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-900">💡 Tip:</strong> You can go back to the Controls step to add custom narratives 
                for better compliance documentation, or proceed to generate the SSP with placeholder text.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

