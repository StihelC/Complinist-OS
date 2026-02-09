import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeviceNodeData } from '@/lib/utils/types';

interface DeviceNetworkTabProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const DeviceNetworkTab = ({ data, onChange }: DeviceNetworkTabProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="ipAddress" className="text-xs">IP Address</Label>
        <Input
          id="ipAddress"
          value={data.ipAddress || ''}
          onChange={(e) => onChange('ipAddress', e.target.value)}
          placeholder="192.168.1.1"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="macAddress" className="text-xs">MAC Address</Label>
        <Input
          id="macAddress"
          value={data.macAddress || ''}
          onChange={(e) => onChange('macAddress', e.target.value)}
          placeholder="00:00:00:00:00:00"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="subnetMask" className="text-xs">Subnet Mask</Label>
        <Input
          id="subnetMask"
          value={data.subnetMask || ''}
          onChange={(e) => onChange('subnetMask', e.target.value)}
          placeholder="255.255.255.0"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="defaultGateway" className="text-xs">Default Gateway</Label>
        <Input
          id="defaultGateway"
          value={data.defaultGateway || ''}
          onChange={(e) => onChange('defaultGateway', e.target.value)}
          placeholder="192.168.1.1"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="location" className="text-xs">Location</Label>
        <Input
          id="location"
          value={data.location || ''}
          onChange={(e) => onChange('location', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="systemOwner" className="text-xs">System Owner</Label>
        <Input
          id="systemOwner"
          value={data.systemOwner || ''}
          onChange={(e) => onChange('systemOwner', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="department" className="text-xs">Department</Label>
        <Input
          id="department"
          value={data.department || ''}
          onChange={(e) => onChange('department', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="contactEmail" className="text-xs">Contact Email</Label>
        <Input
          id="contactEmail"
          type="email"
          value={data.contactEmail || ''}
          onChange={(e) => onChange('contactEmail', e.target.value)}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
};

