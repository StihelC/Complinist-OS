import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeviceNodeData } from '@/lib/utils/types';

interface NetworkSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const NetworkSection = ({ data, onChange }: NetworkSectionProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="ipAddress">IP Address</Label>
        <Input
          id="ipAddress"
          value={data.ipAddress || ''}
          onChange={(e) => onChange('ipAddress', e.target.value)}
          placeholder="192.168.1.1"
        />
      </div>
      <div>
        <Label htmlFor="macAddress">MAC Address</Label>
        <Input
          id="macAddress"
          value={data.macAddress || ''}
          onChange={(e) => onChange('macAddress', e.target.value)}
          placeholder="00:00:00:00:00:00"
        />
      </div>
      <div>
        <Label htmlFor="subnetMask">Subnet Mask</Label>
        <Input
          id="subnetMask"
          value={data.subnetMask || ''}
          onChange={(e) => onChange('subnetMask', e.target.value)}
          placeholder="255.255.255.0"
        />
      </div>
      <div>
        <Label htmlFor="defaultGateway">Default Gateway</Label>
        <Input
          id="defaultGateway"
          value={data.defaultGateway || ''}
          onChange={(e) => onChange('defaultGateway', e.target.value)}
          placeholder="192.168.1.1"
        />
      </div>
      <div>
        <Label htmlFor="hostname">Hostname</Label>
        <Input
          id="hostname"
          value={data.hostname || ''}
          onChange={(e) => onChange('hostname', e.target.value)}
          placeholder="server01.example.com"
        />
      </div>
      <div>
        <Label htmlFor="dnsServers">DNS Servers (comma-separated)</Label>
        <Input
          id="dnsServers"
          value={data.dnsServers || ''}
          onChange={(e) => onChange('dnsServers', e.target.value)}
          placeholder="8.8.8.8, 8.8.4.4"
        />
      </div>
      <div>
        <Label htmlFor="vlanId">VLAN ID</Label>
        <Input
          id="vlanId"
          value={data.vlanId || ''}
          onChange={(e) => onChange('vlanId', e.target.value)}
          placeholder="100"
        />
      </div>
      <div>
        <Label htmlFor="ports">Open Ports (comma-separated)</Label>
        <Input
          id="ports"
          value={data.ports || ''}
          onChange={(e) => onChange('ports', e.target.value)}
          placeholder="80, 443, 22"
        />
      </div>
    </div>
  );
};

