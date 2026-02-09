import { useState } from 'react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { DeviceNodeData } from '@/lib/utils/types';

export function BulkAssignment() {
  const nodes = useFlowStore((state) => state.nodes);
  const updateNode = useFlowStore((state) => state.updateNode);
  const deviceNodes = nodes.filter((node) => node.type === 'device' || !node.type);

  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [controlInput, setControlInput] = useState('');

  const handleToggleDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId],
    );
  };

  const handleAssign = () => {
    const controls = controlInput
      .split(',')
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);

    if (controls.length === 0 || selectedDevices.length === 0) {
      return;
    }

    selectedDevices.forEach((deviceId) => {
      const node = deviceNodes.find((n) => n.id === deviceId);
      if (!node?.data) return;
      const data = node.data as DeviceNodeData;
      const existing = data.assignedControls || [];
      const merged = Array.from(new Set([...existing, ...controls]));
      updateNode(deviceId, { assignedControls: merged });
    });

    setControlInput('');
    setSelectedDevices([]);
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-4">
      <p className="text-sm font-semibold text-slate-900">Bulk Control Assignment</p>
      {deviceNodes.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Add devices to the topology to use bulk assignment.</p>
      ) : (
        <>
          <Label className="mt-3 block text-xs text-slate-500">Select Devices</Label>
          <div className="mt-2 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto border border-slate-200 p-2 text-sm">
            {deviceNodes.map((node) => {
              const data = node.data as DeviceNodeData;
              const isSelected = selectedDevices.includes(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => handleToggleDevice(node.id)}
                  className={`rounded border px-2 py-1 text-left ${
                    isSelected ? 'border-slate-900 bg-slate-900/10' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="block text-sm font-medium text-slate-900">{data.name || node.id}</span>
                  <span className="text-[11px] text-slate-500">
                    {data.assignedControls?.length || 0} control(s)
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <Label htmlFor="bulk-control-input" className="text-xs text-slate-500">
              Control IDs (comma-separated)
            </Label>
            <Input
              id="bulk-control-input"
              value={controlInput}
              onChange={(event) => setControlInput(event.target.value)}
              placeholder="AC-2, SC-7, CM-8"
              className="mt-1"
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              {selectedDevices.length} device{selectedDevices.length === 1 ? '' : 's'} selected
            </span>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={selectedDevices.length === 0 || controlInput.trim().length === 0}
            >
              Assign Controls
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

