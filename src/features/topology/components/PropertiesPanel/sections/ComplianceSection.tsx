import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DeviceNodeData } from '@/lib/utils/types';

interface ComplianceSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const ComplianceSection = ({ data, onChange }: ComplianceSectionProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="applicableControls">Applicable Controls (comma-separated)</Label>
        <Input
          id="applicableControls"
          value={data.applicableControls?.join(', ') || ''}
          onChange={(e) =>
            onChange(
              'applicableControls',
              e.target.value.split(',').map((s) => s.trim())
            )
          }
          placeholder="AC-1, AC-2, SC-7"
        />
      </div>
      <div>
        <Label htmlFor="lastVulnScan">Last Vulnerability Scan</Label>
        <Input
          id="lastVulnScan"
          type="date"
          value={data.lastVulnScan || ''}
          onChange={(e) => onChange('lastVulnScan', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="complianceStatus">Compliance Status</Label>
        <Select
          id="complianceStatus"
          value={data.complianceStatus || ''}
          onChange={(e) => onChange('complianceStatus', e.target.value)}
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

