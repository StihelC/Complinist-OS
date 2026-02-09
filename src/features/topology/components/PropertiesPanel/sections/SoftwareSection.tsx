import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DeviceNodeData } from '@/lib/utils/types';

interface SoftwareSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const SoftwareSection = ({ data, onChange }: SoftwareSectionProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="operatingSystem">Operating System</Label>
        <Input
          id="operatingSystem"
          value={data.operatingSystem || ''}
          onChange={(e) => onChange('operatingSystem', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="osVersion">OS Version</Label>
        <Input
          id="osVersion"
          value={data.osVersion || ''}
          onChange={(e) => onChange('osVersion', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="software">Installed Software (one per line)</Label>
        <Textarea
          id="software"
          value={data.software || ''}
          onChange={(e) => onChange('software', e.target.value)}
          placeholder="Apache 2.4&#10;MySQL 8.0&#10;PHP 8.1"
          rows={5}
        />
      </div>
      <div>
        <Label htmlFor="patchLevel">Patch Level</Label>
        <Input
          id="patchLevel"
          value={data.patchLevel || ''}
          onChange={(e) => onChange('patchLevel', e.target.value)}
          placeholder="2024-01"
        />
      </div>
      <div>
        <Label htmlFor="lastPatchDate">Last Patch Date</Label>
        <Input
          id="lastPatchDate"
          type="date"
          value={data.lastPatchDate || ''}
          onChange={(e) => onChange('lastPatchDate', e.target.value)}
        />
      </div>
    </div>
  );
};

