import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeviceNodeData, DeviceType } from '@/lib/utils/types';
import { DeviceTypeSelector } from '@/features/topology/components/DevicePalette/DeviceTypeSelector';

interface BasicInfoSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
  onIconChange: (iconFilename: string, deviceType: DeviceType, deviceSubtype?: string) => void;
}

export const BasicInfoSection = ({ data, onChange, onIconChange }: BasicInfoSectionProps) => {
  return (
    <div className="space-y-3">
      {/* Device Icon Selector */}
      <DeviceTypeSelector
        currentIconPath={data.iconPath || ''}
        currentDeviceType={data.deviceType}
        onSelect={onIconChange}
      />

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          onBlur={() => {}}
        />
      </div>

      <div>
        <Label htmlFor="deviceType">Device Type</Label>
        <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
          {data.deviceType}
        </div>
      </div>

      {data.deviceSubtype && (
        <div>
          <Label htmlFor="deviceSubtype">Device Subtype</Label>
          <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
            {data.deviceSubtype}
          </div>
        </div>
      )}
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={data.status || ''}
          onChange={(e) => onChange('status', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Retired">Retired</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={data.notes || ''}
          onChange={(e) => onChange('notes', e.target.value)}
          placeholder="General notes about this device..."
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={data.tags?.join(', ') || ''}
          onChange={(e) =>
            onChange(
              'tags',
              e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
            )
          }
          placeholder="production, critical, server"
        />
      </div>
    </div>
  );
};

