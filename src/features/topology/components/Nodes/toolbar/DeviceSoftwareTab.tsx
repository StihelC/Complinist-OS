import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DeviceNodeData } from '@/lib/utils/types';
import { Plus, Trash2 } from 'lucide-react';

interface DeviceSoftwareTabProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const DeviceSoftwareTab = ({ data, onChange }: DeviceSoftwareTabProps) => {
  const [newSoftware, setNewSoftware] = useState('');
  const softwareList = (data.software || '').split('\n').filter(s => s.trim());
  
  const handleAddSoftware = () => {
    if (!newSoftware.trim()) return;
    const currentSoftware = data.software || '';
    const updatedSoftware = currentSoftware 
      ? `${currentSoftware}\n${newSoftware.trim()}`
      : newSoftware.trim();
    onChange('software', updatedSoftware);
    setNewSoftware('');
  };

  const handleRemoveSoftware = (index: number) => {
    const updatedList = softwareList.filter((_, i) => i !== index);
    onChange('software', updatedList.join('\n'));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-2 block">Installed Software</Label>
        <div className="space-y-2">
          {softwareList.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
              {softwareList.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                  <span className="flex-1 text-xs">{item}</span>
                  <Button
                    type="button"
                    onClick={() => handleRemoveSoftware(index)}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-gray-500 border rounded">
              No software added yet. Use the form below to add software.
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Enter software name (e.g., Apache 2.4, MySQL 8.0)"
              value={newSoftware}
              onChange={(e) => setNewSoftware(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSoftware();
                }
              }}
              className="h-8 text-xs flex-1"
            />
            <Button
              type="button"
              onClick={handleAddSoftware}
              size="sm"
              variant="default"
              disabled={!newSoftware.trim()}
              className="h-8"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-[10px] text-gray-500">
            Press Enter or click "Add" to add software to the list.
          </p>
        </div>
      </div>
    </div>
  );
};

