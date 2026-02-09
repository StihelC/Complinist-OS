import { useMemo } from 'react';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import type { DeviceNodeData } from '@/lib/utils/types';
import { Button } from '@/components/ui/button';
import { Info, CheckCircle2, TrendingUp, Lightbulb } from 'lucide-react';

export function CoverageGapPanel() {
  const controls = useControlNarrativesStore((state) => state.items);
  const baseline = useControlNarrativesStore((state) => state.baseline);
  const nodes = useFlowStore((state) => state.nodes);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);

  const statistics = useMemo(() => {
    const deviceNodes = nodes.filter((node) => node.type === 'device' || !node.type);
    const totalDevices = deviceNodes.length;

    // Calculate device coverage
    const devicesWithControls = deviceNodes.filter(
      (node) => {
        const data = node.data as DeviceNodeData;
        return data?.assignedControls && data.assignedControls.length > 0;
      }
    ).length;

    const devicesWithoutControls = deviceNodes.filter(
      (node) => {
        const data = node.data as DeviceNodeData;
        return !data?.assignedControls || data.assignedControls.length === 0;
      }
    );

    // Filter controls by baseline applicability
    const applicableControls = Object.values(controls).filter(
      (control) => control.isApplicableToBaseline
    );
    
    // Calculate control coverage
    const totalControls = applicableControls.length;
    const controlCoverage = applicableControls.map((control) => {
      const assignedDevices = deviceNodes
        .map((node) => ({
          id: node.id,
          name: (node.data as DeviceNodeData).name || (node.data as DeviceNodeData).hostname || node.id,
          data: node.data as DeviceNodeData,
        }))
        .filter(({ data }) => data?.assignedControls?.includes(control.control_id));

      const percentage = totalDevices > 0 ? Math.round((assignedDevices.length / totalDevices) * 100) : 0;

      return {
        controlId: control.control_id,
        title: control.title,
        family: control.family,
        count: assignedDevices.length,
        percentage,
        devices: assignedDevices,
      };
    });

    const fullyUncoveredControls = controlCoverage.filter((c) => c.count === 0);
    const partiallyUncoveredControls = controlCoverage.filter(
      (c) => c.count > 0 && c.percentage < 50
    );
    const wellCoveredControls = controlCoverage.filter((c) => c.percentage >= 75);

    return {
      totalDevices,
      devicesWithControls,
      devicesWithoutControls,
      totalControls,
      fullyUncoveredControls,
      partiallyUncoveredControls,
      wellCoveredControls,
      deviceCoveragePercentage:
        totalDevices > 0 ? Math.round((devicesWithControls / totalDevices) * 100) : 0,
      controlCoveragePercentage:
        totalControls > 0
          ? Math.round(((totalControls - fullyUncoveredControls.length) / totalControls) * 100)
          : 0,
    };
  }, [controls, nodes, baseline]);

  const handleDeviceClick = (deviceId: string) => {
    setSelectedNodeId(deviceId);
    // TODO: Could also scroll to device on canvas
  };

  if (statistics.totalDevices === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Info className="h-12 w-12 text-slate-300 mb-3" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">No Devices in Topology</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Add devices to your topology to begin tracking control coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Baseline Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm font-semibold text-blue-900">
          {baseline} Baseline Coverage
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Showing statistics for {statistics.totalControls} controls applicable to {baseline} baseline
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Device Coverage</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {statistics.deviceCoveragePercentage}%
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {statistics.devicesWithControls} of {statistics.totalDevices} devices
              </p>
            </div>
            <div
              className={`rounded-full p-3 ${
                statistics.deviceCoveragePercentage >= 75
                  ? 'bg-green-100'
                  : statistics.deviceCoveragePercentage >= 50
                  ? 'bg-blue-100'
                  : 'bg-slate-100'
              }`}
            >
              {statistics.deviceCoveragePercentage >= 75 ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <Info
                  className={`h-6 w-6 ${
                    statistics.deviceCoveragePercentage >= 50 ? 'text-blue-600' : 'text-slate-600'
                  }`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Control Coverage</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {statistics.controlCoveragePercentage}%
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {statistics.totalControls - statistics.fullyUncoveredControls.length} of{' '}
                {statistics.totalControls} controls
              </p>
            </div>
            <div
              className={`rounded-full p-3 ${
                statistics.controlCoveragePercentage >= 75
                  ? 'bg-green-100'
                  : statistics.controlCoveragePercentage >= 50
                  ? 'bg-blue-100'
                  : 'bg-slate-100'
              }`}
            >
              {statistics.controlCoveragePercentage >= 75 ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <Info
                  className={`h-6 w-6 ${
                    statistics.controlCoveragePercentage >= 50 ? 'text-blue-600' : 'text-slate-600'
                  }`}
                />
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Well Covered</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {statistics.wellCoveredControls.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">controls at 75%+</p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Devices Ready for Review */}
      {statistics.devicesWithoutControls.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Lightbulb className="h-4 w-4" />
            Devices Ready for Review ({statistics.devicesWithoutControls.length})
          </h3>
          <p className="mt-1 text-xs text-blue-700">
            Consider assigning controls to these devices to document their security posture.
          </p>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {statistics.devicesWithoutControls.map((node) => {
              const data = node.data as DeviceNodeData;
              return (
                <div
                  key={node.id}
                  className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {data.name || data.hostname || node.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.deviceType || 'Unknown type'} • {data.ipAddress || 'No IP'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeviceClick(node.id)}
                  >
                    Assign Controls
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Next Steps */}
      {statistics.fullyUncoveredControls.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            Suggested Next Steps ({statistics.fullyUncoveredControls.length})
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            These controls could be assigned to relevant devices in your topology.
          </p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {statistics.fullyUncoveredControls.map((control) => (
              <div
                key={control.controlId}
                className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {control.controlId} — {control.title}
                  </p>
                  <p className="text-xs text-slate-500">{control.family}</p>
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                  Not yet assigned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partially Covered Controls */}
      {statistics.partiallyUncoveredControls.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Info className="h-4 w-4 text-blue-600" />
            Controls to Consider ({statistics.partiallyUncoveredControls.length})
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            These controls are assigned to some devices. Consider expanding coverage to additional devices.
          </p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {statistics.partiallyUncoveredControls.map((control) => (
              <div
                key={control.controlId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {control.controlId} — {control.title}
                    </p>
                    <p className="text-xs text-slate-500">{control.family}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {control.percentage}% coverage
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-600">
                    Assigned to {control.count} device{control.count !== 1 ? 's' : ''}:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {control.devices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => handleDeviceClick(device.id)}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                      >
                        {device.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Well Covered Summary */}
      {statistics.wellCoveredControls.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-green-900">
            <CheckCircle2 className="h-4 w-4" />
            Well Covered Controls ({statistics.wellCoveredControls.length})
          </h3>
          <p className="mt-1 text-xs text-green-700">
            These controls are assigned to 75% or more of devices. Good job!
          </p>
        </div>
      )}
    </div>
  );
}

