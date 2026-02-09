import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BoundaryType, boundaryStyles } from '@/lib/utils/types';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useFlowStore } from '@/core/stores/useFlowStore';

export const BoundaryForm = () => {
  const { createBoundary } = useFlowStore();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [formData, setFormData] = useState({
    label: 'New Boundary',
    type: 'security_zone' as BoundaryType,
    x: 100,
    y: 100,
    width: 400,
    height: 300,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBoundary({
      label: formData.label,
      type: formData.type,
      position: { x: formData.x, y: formData.y },
      width: formData.width,
      height: formData.height,
    });
    // Reset form
    setFormData({
      label: 'New Boundary',
      type: 'security_zone',
      x: formData.x + 50,
      y: formData.y + 50,
      width: 400,
      height: 300,
    });
  };

  if (isCollapsed) {
    return (
      <div className="absolute left-4 top-16 z-20">
        <Button
          onClick={() => setIsCollapsed(false)}
          size="sm"
          variant="outline"
          className="shadow-lg gap-2"
        >
          <ChevronRight className="w-4 h-4" />
          Add Boundary
        </Button>
      </div>
    );
  }

  const currentStyle = boundaryStyles[formData.type];

  return (
    <div className="absolute left-4 top-4 z-40 w-80">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Create Boundary</CardTitle>
            <Button
              onClick={() => setIsCollapsed(true)}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Boundary name"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as BoundaryType,
                  })
                }
              >
                <option value="ato">ATO</option>
                <option value="network_segment">Network Segment</option>
                <option value="security_zone">Security Zone</option>
                <option value="physical_location">Physical Location</option>
                <option value="datacenter">Datacenter</option>
                <option value="office">Office</option>
                <option value="cloud_region">Cloud Region</option>
                <option value="custom">Custom</option>
              </Select>
            </div>

            {/* Style Preview */}
            <div className="space-y-2">
              <Label>Style Preview</Label>
              <div
                className="w-full h-16 rounded"
                style={{
                  border: `${currentStyle.strokeWidth}px dashed ${currentStyle.color}`,
                  backgroundColor: `${currentStyle.color}10`,
                }}
              >
                <div
                  className="inline-block px-2 py-1 m-2 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: `${currentStyle.color}20`,
                    color: currentStyle.color,
                  }}
                >
                  {formData.type}
                </div>
              </div>
            </div>

            {/* Position */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="x">X Position</Label>
                <Input
                  id="x"
                  type="number"
                  value={formData.x}
                  onChange={(e) =>
                    setFormData({ ...formData, x: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="y">Y Position</Label>
                <Input
                  id="y"
                  type="number"
                  value={formData.y}
                  onChange={(e) =>
                    setFormData({ ...formData, y: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            {/* Size */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  type="number"
                  value={formData.width}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      width: parseInt(e.target.value),
                    })
                  }
                  min={300}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.height}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      height: parseInt(e.target.value),
                    })
                  }
                  min={200}
                />
              </div>
            </div>

            <Button type="submit" className="w-full">
              Create Boundary
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

