import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceNodeData } from '@/lib/utils/types';

interface DeviceSecurityTabProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const DeviceSecurityTab = ({ data, onChange }: DeviceSecurityTabProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="securityZone" className="text-xs">Security Zone</Label>
        <Select
          id="securityZone"
          value={data.securityZone || ''}
          onChange={(e) => onChange('securityZone', e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">Select...</option>
          <option value="untrusted">Untrusted</option>
          <option value="dmz">DMZ</option>
          <option value="trusted">Trusted</option>
          <option value="internal">Internal</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="assetValue" className="text-xs">Asset Value</Label>
        <Select
          id="assetValue"
          value={data.assetValue || ''}
          onChange={(e) => onChange('assetValue', e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">Select...</option>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="dataClassification" className="text-xs">Data Classification</Label>
        <Input
          id="dataClassification"
          value={data.dataClassification || ''}
          onChange={(e) => onChange('dataClassification', e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="missionCritical"
            checked={data.missionCritical || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange('missionCritical', e.target.checked)
            }
          />
          <Label htmlFor="missionCritical" className="text-xs">Mission Critical</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="multifactorAuth"
            checked={data.multifactorAuth || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange('multifactorAuth', e.target.checked)
            }
          />
          <Label htmlFor="multifactorAuth" className="text-xs">Multi-Factor Authentication</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="encryptionAtRest"
            checked={data.encryptionAtRest || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange('encryptionAtRest', e.target.checked)
            }
          />
          <Label htmlFor="encryptionAtRest" className="text-xs">Encryption at Rest</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="encryptionInTransit"
            checked={data.encryptionInTransit || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange('encryptionInTransit', e.target.checked)
            }
          />
          <Label htmlFor="encryptionInTransit" className="text-xs">Encryption in Transit</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="backupsConfigured"
            checked={data.backupsConfigured || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange('backupsConfigured', e.target.checked)
            }
          />
          <Label htmlFor="backupsConfigured" className="text-xs">Backups Configured</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="monitoringEnabled"
            checked={data.monitoringEnabled || false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange('monitoringEnabled', e.target.checked)
            }
          />
          <Label htmlFor="monitoringEnabled" className="text-xs">Monitoring Enabled</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="vulnerabilityManagement" className="text-xs">Vulnerability Management</Label>
        <Select
          id="vulnerabilityManagement"
          value={data.vulnerabilityManagement || ''}
          onChange={(e) => onChange('vulnerabilityManagement', e.target.value)}
          className="h-8 text-xs"
        >
          <option value="">Select...</option>
          <option value="none">None</option>
          <option value="quarterly">Quarterly</option>
          <option value="monthly">Monthly</option>
          <option value="continuous">Continuous</option>
        </Select>
      </div>
    </div>
  );
};

