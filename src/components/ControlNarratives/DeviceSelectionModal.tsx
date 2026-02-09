// Device Selection Modal
// Allows users to select devices and boundaries for AI narrative generation

import { useState, useEffect } from 'react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import type { DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

interface DeviceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (deviceIds: string[], boundaryIds: string[]) => void;
  controlId: string;
}

export function DeviceSelectionModal({
  isOpen,
  onClose,
  onComplete,
  controlId,
}: DeviceSelectionModalProps) {
  const { nodes } = useFlowStore();
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [selectedBoundaryIds, setSelectedBoundaryIds] = useState<Set<string>>(new Set());
  const [selectAllDevices, setSelectAllDevices] = useState(false);

  const deviceNodes = nodes.filter((node) => node.type === 'device' || !node.type);
  const boundaryNodes = nodes.filter((node) => node.type === 'boundary');

  useEffect(() => {
    if (selectAllDevices) {
      setSelectedDeviceIds(new Set(deviceNodes.map((node) => node.id)));
    } else {
      setSelectedDeviceIds(new Set());
    }
  }, [selectAllDevices, deviceNodes]);

  const handleDeviceToggle = (deviceId: string) => {
    const newSet = new Set(selectedDeviceIds);
    if (newSet.has(deviceId)) {
      newSet.delete(deviceId);
      setSelectAllDevices(false);
    } else {
      newSet.add(deviceId);
    }
    setSelectedDeviceIds(newSet);
  };

  const handleBoundaryToggle = (boundaryId: string) => {
    const newSet = new Set(selectedBoundaryIds);
    if (newSet.has(boundaryId)) {
      newSet.delete(boundaryId);
    } else {
      newSet.add(boundaryId);
    }
    setSelectedBoundaryIds(newSet);
  };

  const handleComplete = () => {
    onComplete(Array.from(selectedDeviceIds), Array.from(selectedBoundaryIds));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Devices and Boundaries for {controlId}</DialogTitle>
          <DialogDescription>
            Choose which devices and boundaries to include in the AI-generated narrative for this control.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Devices Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Devices</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-devices"
                  checked={selectAllDevices}
                  onCheckedChange={setSelectAllDevices}
                />
                <Label htmlFor="select-all-devices" className="text-xs cursor-pointer">
                  Select All ({deviceNodes.length})
                </Label>
              </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {deviceNodes.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No devices in topology
                </p>
              ) : (
                deviceNodes.map((node) => {
                  const data = node.data as DeviceNodeData;
                  const isSelected = selectedDeviceIds.has(node.id);
                  return (
                    <Card key={node.id} className={isSelected ? 'border-blue-500 bg-blue-50' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`device-${node.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleDeviceToggle(node.id)}
                          />
                          <Label
                            htmlFor={`device-${node.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium">{data.name || data.hostname || `Device ${node.id}`}</div>
                            <div className="text-xs text-muted-foreground">
                              {data.deviceType} {data.operatingSystem ? `• ${data.operatingSystem}` : ''}
                            </div>
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Boundaries Section */}
          <div>
            <Label className="text-sm font-semibold">Boundaries (Optional)</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
              {boundaryNodes.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No boundaries in topology
                </p>
              ) : (
                boundaryNodes.map((node) => {
                  const data = node.data as BoundaryNodeData;
                  const isSelected = selectedBoundaryIds.has(node.id);
                  return (
                    <Card key={node.id} className={isSelected ? 'border-blue-500 bg-blue-50' : ''}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`boundary-${node.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleBoundaryToggle(node.id)}
                          />
                          <Label
                            htmlFor={`boundary-${node.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium">{data.label || `Boundary ${node.id}`}</div>
                            <div className="text-xs text-muted-foreground">{data.type}</div>
                          </Label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleComplete}>
            Generate Narrative ({selectedDeviceIds.size} device{selectedDeviceIds.size !== 1 ? 's' : ''}, {selectedBoundaryIds.size} boundar{selectedBoundaryIds.size !== 1 ? 'ies' : 'y'})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

