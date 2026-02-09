import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceNodeData } from '@/lib/utils/types';

interface SecurityPostureSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const SecurityPostureSection = ({ data, onChange }: SecurityPostureSectionProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="multifactorAuth"
          checked={data.multifactorAuth || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('multifactorAuth', e.target.checked)
          }
        />
        <Label htmlFor="multifactorAuth">Multi-Factor Authentication</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="encryptionAtRest"
          checked={data.encryptionAtRest || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('encryptionAtRest', e.target.checked)
          }
        />
        <Label htmlFor="encryptionAtRest">Encryption at Rest</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="encryptionInTransit"
          checked={data.encryptionInTransit || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('encryptionInTransit', e.target.checked)
          }
        />
        <Label htmlFor="encryptionInTransit">Encryption in Transit</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="backupsConfigured"
          checked={data.backupsConfigured || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('backupsConfigured', e.target.checked)
          }
        />
        <Label htmlFor="backupsConfigured">Backups Configured</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="monitoringEnabled"
          checked={data.monitoringEnabled || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('monitoringEnabled', e.target.checked)
          }
        />
        <Label htmlFor="monitoringEnabled">Monitoring Enabled</Label>
      </div>
      <div>
        <Label htmlFor="vulnerabilityManagement">Vulnerability Management</Label>
        <Select
          id="vulnerabilityManagement"
          value={data.vulnerabilityManagement || ''}
          onChange={(e) => onChange('vulnerabilityManagement', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="none">None</option>
          <option value="quarterly">Quarterly</option>
          <option value="monthly">Monthly</option>
          <option value="continuous">Continuous</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="encryptionStatus">Encryption Status</Label>
        <Select
          id="encryptionStatus"
          value={data.encryptionStatus || ''}
          onChange={(e) => onChange('encryptionStatus', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="Enabled">Enabled</option>
          <option value="Partial">Partial</option>
          <option value="Not Configured">Not Configured</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="riskLevel">Risk Level</Label>
        <Select
          id="riskLevel"
          value={data.riskLevel || ''}
          onChange={(e) => onChange('riskLevel', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="Low">Low</option>
          <option value="Moderate">Moderate</option>
          <option value="High">High</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="criticality">Criticality</Label>
        <Select
          id="criticality"
          value={data.criticality || ''}
          onChange={(e) => onChange('criticality', e.target.value)}
        >
          <option value="">Select...</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="firewallEnabled"
          checked={data.firewallEnabled || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('firewallEnabled', e.target.checked)
          }
        />
        <Label htmlFor="firewallEnabled">Firewall Enabled</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="antivirusEnabled"
          checked={data.antivirusEnabled || false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange('antivirusEnabled', e.target.checked)
          }
        />
        <Label htmlFor="antivirusEnabled">Antivirus Enabled</Label>
      </div>
    </div>
  );
};

