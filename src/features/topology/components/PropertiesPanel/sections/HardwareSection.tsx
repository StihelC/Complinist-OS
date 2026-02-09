import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeviceNodeData } from '@/lib/utils/types';

interface HardwareSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const HardwareSection = ({ data, onChange }: HardwareSectionProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="manufacturer">Manufacturer</Label>
        <Input
          id="manufacturer"
          value={data.manufacturer || ''}
          onChange={(e) => onChange('manufacturer', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="model">Model</Label>
        <Input
          id="model"
          value={data.model || ''}
          onChange={(e) => onChange('model', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="serialNumber">Serial Number</Label>
        <Input
          id="serialNumber"
          value={data.serialNumber || ''}
          onChange={(e) => onChange('serialNumber', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="operatingSystem">Operating System</Label>
        <Input
          id="operatingSystem"
          value={data.operatingSystem || ''}
          onChange={(e) => onChange('operatingSystem', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="firmwareVersion">Firmware Version</Label>
        <Input
          id="firmwareVersion"
          value={data.firmwareVersion || ''}
          onChange={(e) => onChange('firmwareVersion', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="cpuModel">CPU Model</Label>
        <Input
          id="cpuModel"
          value={data.cpuModel || ''}
          onChange={(e) => onChange('cpuModel', e.target.value)}
          placeholder="Intel Xeon E5-2680"
        />
      </div>
      <div>
        <Label htmlFor="memorySize">Memory Size</Label>
        <Input
          id="memorySize"
          value={data.memorySize || ''}
          onChange={(e) => onChange('memorySize', e.target.value)}
          placeholder="16GB"
        />
      </div>
      <div>
        <Label htmlFor="storageSize">Storage Size</Label>
        <Input
          id="storageSize"
          value={data.storageSize || ''}
          onChange={(e) => onChange('storageSize', e.target.value)}
          placeholder="500GB"
        />
      </div>
    </div>
  );
};

