import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DeviceNodeData } from '@/lib/utils/types';

interface DeviceComplianceTabProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const DeviceComplianceTab = ({ data, onChange }: DeviceComplianceTabProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="applicableControls" className="text-xs">Applicable Controls (comma-separated)</Label>
        <Input
          id="applicableControls"
          value={data.applicableControls?.join(', ') || ''}
          onChange={(e) =>
            onChange(
              'applicableControls',
              e.target.value.split(',').map((s) => s.trim()).filter(s => s)
            )
          }
          placeholder="AC-1, AC-2, SC-7"
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="lastVulnScan" className="text-xs">Last Vulnerability Scan</Label>
        <Input
          id="lastVulnScan"
          type="date"
          value={data.lastVulnScan || ''}
          onChange={(e) => onChange('lastVulnScan', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div>
        <Label htmlFor="complianceStatus" className="text-xs">Compliance Status</Label>
        <Select
          id="complianceStatus"
          value={data.complianceStatus || ''}
          onChange={(e) => onChange('complianceStatus', e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">Select...</option>
          <option value="compliant">Compliant</option>
          <option value="non-compliant">Non-Compliant</option>
          <option value="partial">Partial</option>
        </Select>
      </div>
    </div>
  );
};

