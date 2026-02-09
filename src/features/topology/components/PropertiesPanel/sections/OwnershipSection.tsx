import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeviceNodeData } from '@/lib/utils/types';

interface OwnershipSectionProps {
  data: DeviceNodeData;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
}

export const OwnershipSection = ({ data, onChange }: OwnershipSectionProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="systemOwner">System Owner</Label>
        <Input
          id="systemOwner"
          value={data.systemOwner || ''}
          onChange={(e) => onChange('systemOwner', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          value={data.department || ''}
          onChange={(e) => onChange('department', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="contactEmail">Contact Email</Label>
        <Input
          id="contactEmail"
          type="email"
          value={data.contactEmail || ''}
          onChange={(e) => onChange('contactEmail', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="owner">Owner/Administrator</Label>
        <Input
          id="owner"
          value={data.owner || ''}
          onChange={(e) => onChange('owner', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={data.location || ''}
          onChange={(e) => onChange('location', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="costCenter">Cost Center</Label>
        <Input
          id="costCenter"
          value={data.costCenter || ''}
          onChange={(e) => onChange('costCenter', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="purchaseDate">Purchase Date</Label>
        <Input
          id="purchaseDate"
          type="date"
          value={data.purchaseDate || ''}
          onChange={(e) => onChange('purchaseDate', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="warrantyExpiration">Warranty Expiration</Label>
        <Input
          id="warrantyExpiration"
          type="date"
          value={data.warrantyExpiration || ''}
          onChange={(e) => onChange('warrantyExpiration', e.target.value)}
        />
      </div>
    </div>
  );
};

