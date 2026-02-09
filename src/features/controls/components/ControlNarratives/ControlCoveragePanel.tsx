import { useMemo } from 'react';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import type { DeviceNodeData } from '@/lib/utils/types';
import { Button } from '@/components/ui/button';

export function ControlCoveragePanel() {
  const controls = useControlNarrativesStore((state) => state.items);
  const baseline = useControlNarrativesStore((state) => state.baseline);
  const nodes = useFlowStore((state) => state.nodes);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);

  const { totalDevices, coverageEntries } = useMemo(() => {
    const deviceNodes = nodes.filter((node) => node.type === 'device' || !node.type);
    const total = deviceNodes.length;

    // Filter controls by baseline applicability
    const applicableControls = Object.values(controls).filter(
      (control) => control.isApplicableToBaseline
    );

    const entries = applicableControls.map((control) => {
      const assignedDevices = deviceNodes
        .map((node) => ({
          id: node.id,
          data: node.data as DeviceNodeData,
        }))
        .filter(({ data }) => data?.assignedControls?.includes(control.control_id))
        .map(({ id, data }) => ({
          id,
          name: data.name || data.hostname || id,
          zone: data.securityZone,
        }));

      const percentage =
        total > 0 ? Math.round((assignedDevices.length / total) * 100) : 0;

      return {
        controlId: control.control_id,
        title: control.title,
        count: assignedDevices.length,
        percentage,
        devices: assignedDevices,
      };
    });

    return { totalDevices: total, coverageEntries: entries };
  }, [controls, nodes, baseline]);

  const topCoverage = coverageEntries
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const uncoveredControls = coverageEntries.filter((entry) => entry.count === 0).length;

  if (totalDevices === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Add devices to the topology to begin tracking control coverage.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Control Coverage</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {baseline} Baseline • {coverageEntries.length} applicable controls
          </p>
        </div>
        <span className="text-xs text-slate-500">{totalDevices} device(s)</span>
      </div>
      {topCoverage.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No controls have implementing devices yet. Assign controls within device properties to build coverage.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {topCoverage.map((entry) => (
            <div
              key={entry.controlId}
              className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {entry.controlId} • {entry.count} device(s)
                </p>
                <p className="text-xs text-slate-500 line-clamp-1">{entry.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{entry.percentage}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={entry.devices.length === 0}
                  onClick={() => {
                    if (entry.devices.length > 0) {
                      setSelectedNodeId(entry.devices[0].id);
                    }
                  }}
                >
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {uncoveredControls > 0 && (
        <p className="mt-3 text-xs text-amber-600">
          {uncoveredControls} control{uncoveredControls === 1 ? '' : 's'} currently have no tagged devices.
        </p>
      )}
    </div>
  );
}

