import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceNodeData } from '@/lib/utils/types';

interface SecuritySectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const SecuritySection = ({ data, onChange }: SecuritySectionProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="securityZone">Security Zone</Label>
        <Select
          id="securityZone"
          value={data.securityZone || ''}
          onChange={(e) => onChange('securityZone', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="untrusted">Untrusted</option>
          <option value="dmz">DMZ</option>
          <option value="trusted">Trusted</option>
          <option value="internal">Internal</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="assetValue">Asset Value</Label>
        <Select
          id="assetValue"
          value={data.assetValue || ''}
          onChange={(e) => onChange('assetValue', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="missionCritical"
          checked={data.missionCritical || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('missionCritical', e.target.checked)
          }
        />
        <Label htmlFor="missionCritical">Mission Critical</Label>
      </div>
      <div>
        <Label htmlFor="dataClassification">Data Classification</Label>
        <Input
          id="dataClassification"
          value={data.dataClassification || ''}
          onChange={(e) => onChange('dataClassification', e.target.value)}
        />
      </div>
    </div>
  );
};

