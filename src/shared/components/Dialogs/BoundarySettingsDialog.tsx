import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BoundaryNodeData, LabelPosition, DeviceAlignment, LayoutDirection } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Ban, ArrowDown, ArrowRight, ArrowUp, ArrowLeft } from 'lucide-react';
import { applyDagreLayout } from '@/lib/layout/dagreLayout';

interface BoundarySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  nodeData: BoundaryNodeData;
}

export const BoundarySettingsDialog = ({
  open,
  onOpenChange,
  nodeId,
  nodeData,
}: BoundarySettingsDialogProps) => {
  const updateNode = useFlowStore((state) => state.updateNode);
  const nodes = useFlowStore((state) => state.nodes);
  const setNodes = useFlowStore((state) => state.setNodes);
  
  const [labelPosition, setLabelPosition] = useState<LabelPosition>(
    nodeData.labelPosition || 'top-left'
  );
  const [deviceAlignment, setDeviceAlignment] = useState<DeviceAlignment>(
    nodeData.deviceAlignment || 'none'
  );
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(
    nodeData.layoutDirection || 'DOWN'
  );
  const [spacing, setSpacing] = useState<number>(nodeData.spacing || 50);
  const [isApplyingLayout, setIsApplyingLayout] = useState(false);

  const handleSave = async () => {
    setIsApplyingLayout(true);
    
    // Update the boundary node with new settings
    updateNode(nodeId, {
      labelPosition,
      deviceAlignment,
      layoutDirection,
      spacing,
    });

    // Apply device alignment if selected
    if (deviceAlignment !== 'none') {
      await applyDeviceAlignment();
    }

    setIsApplyingLayout(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setLabelPosition(nodeData.labelPosition || 'top-left');
    setDeviceAlignment(nodeData.deviceAlignment || 'none');
    setLayoutDirection(nodeData.layoutDirection || 'DOWN');
    setSpacing(nodeData.spacing || 50);
    onOpenChange(false);
  };

  const applyDeviceAlignment = async () => {
    const boundaryNode = nodes.find((n) => n.id === nodeId);
    if (!boundaryNode) return;

    const childNodes = nodes.filter((n) => n.parentId === nodeId);
    if (childNodes.length === 0) return;

    const boundaryWidth = boundaryNode.width || 300;
    const boundaryHeight = boundaryNode.height || 200;

    // Get edges from store
    const edges = useFlowStore.getState().edges;

    // Use Dagre for all layouts
    if (deviceAlignment !== 'none') {
      const globalSettings = useFlowStore.getState().globalSettings;
      const updatedNodes = await applyDagreLayout(
        nodeId,
        nodes,
        edges,
        boundaryWidth,
        boundaryHeight,
        deviceAlignment,
        spacing,
        globalSettings.globalDeviceImageSize,
        globalSettings.globalBoundaryLabelSize
      );
      setNodes(updatedNodes);
    }
  };

  const labelPositions: { value: LabelPosition; label: string; description: string }[] = [
    { value: 'top-left', label: 'Top Left', description: 'Label at top-left corner' },
    { value: 'top-center', label: 'Top Center', description: 'Label centered at top' },
    { value: 'top-right', label: 'Top Right', description: 'Label at top-right corner' },
    { value: 'bottom-left', label: 'Bottom Left', description: 'Label at bottom-left corner' },
    { value: 'bottom-center', label: 'Bottom Center', description: 'Label centered at bottom' },
    { value: 'bottom-right', label: 'Bottom Right', description: 'Label at bottom-right corner' },
  ];

  const alignmentOptions: {
    value: DeviceAlignment;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      value: 'none',
      label: 'None',
      icon: <Ban className="w-5 h-5" />,
      description: 'No automatic alignment',
    },
    {
      value: 'dagre-tb',
      label: 'Hierarchical Flow (Top→Bottom)',
      icon: <ArrowDown className="w-5 h-5" />,
      description: 'Best for workflows and process diagrams',
    },
    {
      value: 'dagre-lr',
      label: 'Horizontal Flow (Left→Right)',
      icon: <ArrowRight className="w-5 h-5" />,
      description: 'Best for timelines and sequential processes',
    },
    {
      value: 'dagre-bt',
      label: 'Reverse Hierarchy (Bottom→Top)',
      icon: <ArrowUp className="w-5 h-5" />,
      description: 'Reverse hierarchy, bottom-up view',
    },
    {
      value: 'dagre-rl',
      label: 'Reverse Horizontal (Right→Left)',
      icon: <ArrowLeft className="w-5 h-5" />,
      description: 'Right-to-left reading order',
    },
  ];

  const directionOptions: { value: LayoutDirection; label: string }[] = [
    { value: 'RIGHT', label: 'Left to Right →' },
    { value: 'DOWN', label: 'Top to Bottom ↓' },
    { value: 'LEFT', label: 'Right to Left ←' },
    { value: 'UP', label: 'Bottom to Top ↑' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Boundary Settings</DialogTitle>
          <DialogDescription>
            Configure label position and device alignment for "{nodeData.label}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Label Position */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Label Position</Label>
            <div className="grid grid-cols-3 gap-2">
              {labelPositions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLabelPosition(option.value)}
                  className={`
                    p-3 rounded-lg border-2 transition-all text-left
                    ${
                      labelPosition === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Device Alignment */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Layout Algorithm (Dagre)</Label>
            <p className="text-sm text-gray-500">
              Automatically arrange devices using Dagre directed graph layout
            </p>
            <div className="grid grid-cols-2 gap-3">
              {alignmentOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDeviceAlignment(option.value)}
                  className={`
                    p-4 rounded-lg border-2 transition-all flex items-start gap-3
                    ${
                      deviceAlignment === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="mt-0.5">{option.icon}</div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Layout Direction - Only show if a Dagre algorithm is selected */}
          {deviceAlignment !== 'none' && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Layout Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                {directionOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setLayoutDirection(option.value)}
                    className={`
                      p-3 rounded-lg border-2 transition-all text-center
                      ${
                        layoutDirection === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="font-medium text-sm">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spacing Slider - Only show if a layout is selected */}
          {deviceAlignment !== 'none' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Spacing</Label>
                <span className="text-sm text-gray-600 font-medium">{spacing}px</span>
              </div>
              <input
                type="range"
                min="20"
                max="150"
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((spacing - 20) / 130) * 100}%, #e5e7eb ${((spacing - 20) / 130) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Compact (20px)</span>
                <span>Default (50px)</span>
                <span>Spacious (150px)</span>
              </div>
            </div>
          )}

          {deviceAlignment !== 'none' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Applying alignment will reposition all devices
                within this boundary. You can still manually adjust positions afterwards.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isApplyingLayout}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isApplyingLayout}>
            {isApplyingLayout ? 'Applying Layout...' : 'Apply Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

