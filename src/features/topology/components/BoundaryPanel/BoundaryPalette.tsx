import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { X, Palette, Plus } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { BoundaryType, boundaryStyles } from '@/core/types/topology.types';

interface BoundaryPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// Visual style options - these are just for appearance, not separate boundary types
const visualStyleOptions: Array<{
  value: BoundaryType;
  label: string;
  description: string;
}> = [
  { value: 'custom', label: 'Default', description: 'Gray neutral style' },
  { value: 'ato', label: 'Authorization (Red)', description: 'Red dashed border' },
  { value: 'network_segment', label: 'Network (Blue)', description: 'Blue dotted border' },
  { value: 'security_zone', label: 'Security (Orange)', description: 'Orange dashed border' },
  { value: 'physical_location', label: 'Physical (Green)', description: 'Green dashed border' },
  { value: 'datacenter', label: 'Datacenter (Purple)', description: 'Purple dashed border' },
  { value: 'cloud_region', label: 'Cloud (Sky Blue)', description: 'Sky blue dashed border' },
  { value: 'office', label: 'Office (Cyan)', description: 'Cyan dotted border' },
];

export const BoundaryPalette = ({ isOpen, onClose }: BoundaryPaletteProps) => {
  const createBoundary = useFlowStore((state) => state.createBoundary);
  const { screenToFlowPosition } = useReactFlow();

  // State for the unified boundary creation
  const [boundaryName, setBoundaryName] = useState('New Boundary');
  const [visualStyle, setVisualStyle] = useState<BoundaryType>('custom');

  const handleCreateBoundary = () => {
    // Calculate viewport center position
    const viewportCenter = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // Adjust position to center the boundary (subtract half width/height)
    const defaultWidth = 400;
    const defaultHeight = 300;
    const position = {
      x: viewportCenter.x - defaultWidth / 2,
      y: viewportCenter.y - defaultHeight / 2,
    };

    const style = boundaryStyles[visualStyle];
    createBoundary({
      label: boundaryName || 'New Boundary',
      type: visualStyle,
      position,
      width: defaultWidth,
      height: defaultHeight,
      color: style.color,
    });

    // Reset form and close panel
    setBoundaryName('New Boundary');
    setVisualStyle('custom');
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="topology-panel topology-panel-left" style={{ top: '80px' }}>
      <Card className="shadow-lg w-72">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Add Boundary</CardTitle>
            <Button
              onClick={onClose}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Close boundary palette"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Helpful Instructions */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-medium mb-1">
              Create a New Boundary
            </p>
            <p className="text-xs text-blue-700">
              The boundary will be added to the center of your current view with a default size of 400×300 pixels. You can resize and move it after creation.
            </p>
          </div>

          {/* Boundary Name Input */}
          <div className="space-y-2">
            <Label htmlFor="boundary-name">Boundary Name</Label>
            <Input
              id="boundary-name"
              value={boundaryName}
              onChange={(e) => setBoundaryName(e.target.value)}
              placeholder="Enter boundary name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateBoundary();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              You can rename this anytime by double-clicking the label on the boundary
            </p>
          </div>

          {/* Visual Style Selector */}
          <div className="space-y-2">
            <Label htmlFor="visual-style" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Visual Style
            </Label>
            <Select
              id="visual-style"
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value as BoundaryType)}
            >
              {visualStyleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose a visual style to help categorize your boundary. You can change this later in the boundary properties.
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="w-full h-20 rounded-lg border-2 flex items-center justify-center"
              style={{
                borderColor: boundaryStyles[visualStyle].color,
                borderStyle: boundaryStyles[visualStyle].strokeWidth === 1 ? 'solid' : 'dashed',
                borderWidth: `${boundaryStyles[visualStyle].strokeWidth}px`,
                backgroundColor: `${boundaryStyles[visualStyle].color}15`,
              }}
            >
              <span className="text-sm font-medium text-gray-700">
                {boundaryName || 'New Boundary'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              This is how your boundary will appear on the canvas
            </p>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreateBoundary}
            className="w-full"
            size="lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Boundary
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
