import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeviceNodeData } from '@/lib/utils/types';

interface DeviceBasicTabProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const DeviceBasicTab = ({ data, onChange }: DeviceBasicTabProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="name" className="text-xs">Name</Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="manufacturer" className="text-xs">Manufacturer</Label>
        <Input
          id="manufacturer"
          value={data.manufacturer || ''}
          onChange={(e) => onChange('manufacturer', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="model" className="text-xs">Model</Label>
        <Input
          id="model"
          value={data.model || ''}
          onChange={(e) => onChange('model', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="serialNumber" className="text-xs">Serial Number</Label>
        <Input
          id="serialNumber"
          value={data.serialNumber || ''}
          onChange={(e) => onChange('serialNumber', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="operatingSystem" className="text-xs">Operating System</Label>
        <Input
          id="operatingSystem"
          value={data.operatingSystem || ''}
          onChange={(e) => onChange('operatingSystem', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="osVersion" className="text-xs">OS Version</Label>
        <Input
          id="osVersion"
          value={data.osVersion || ''}
          onChange={(e) => onChange('osVersion', e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
};

