import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { InventoryItem, AppNode, DeviceNodeData } from '@/lib/utils/types';

interface EditableInventoryTableProps {
  items: InventoryItem[];
  nodes: AppNode[];
  updateNode: (nodeId: string, data: Partial<DeviceNodeData>) => void;
}

export const EditableInventoryTable = ({ items, nodes, updateNode }: EditableInventoryTableProps) => {
  const handleFieldChange = (item: InventoryItem, field: keyof InventoryItem, value: string) => {
    const node = nodes.find(n => n.id === item.deviceId);
    if (!node) return;

    const nodeData = node.data as DeviceNodeData;
    
    // Map inventory item fields back to device node fields
    if (item.category === 'Hardware') {
      const updates: Partial<DeviceNodeData> = {};
      
      switch (field) {
        case 'name':
          updates.name = value;
          break;
        case 'type':
          updates.deviceType = value as any;
          break;
        case 'manufacturer':
          updates.manufacturer = value;
          break;
        case 'model':
          updates.model = value;
          break;
        case 'version':
          updates.firmwareVersion = value;
          break;
        case 'location':
          updates.location = value;
          break;
        case 'owner':
          updates.owner = value;
          break;
        case 'status':
          updates.status = value as any;
          break;
        case 'criticality':
          updates.criticality = value as any;
          break;
        case 'ipAddress':
          updates.ipAddress = value;
          break;
        case 'notes':
          updates.notes = value;
          break;
      }
      
      updateNode(item.deviceId, updates);
    } else if (item.category === 'Software') {
      // For software items, we need to update the software list
      if (field === 'name') {
        const softwareList = (nodeData.software || '').split('\n').filter(s => s.trim());
        const index = softwareList.findIndex(s => s === item.name);
        if (index !== -1) {
          softwareList[index] = value;
          updateNode(item.deviceId, { software: softwareList.join('\n') });
        }
      } else if (field === 'version' && item.type === 'Operating System') {
        updateNode(item.deviceId, { osVersion: value });
      }
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-2 text-left font-semibold sticky left-0 bg-gray-50 z-20 min-w-[150px] border-r border-gray-300 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">Name</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[120px]">Type</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[120px]">Manufacturer</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[120px]">Model</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[100px]">Version</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[120px]">Location</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[120px]">Owner</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[100px]">Status</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[100px]">Criticality</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[120px]">IP Address</th>
            <th className="px-4 py-2 text-left font-semibold min-w-[200px]">Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                No inventory items found
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <EditableInventoryRow 
                key={item.id} 
                item={item} 
                onFieldChange={handleFieldChange}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

interface EditableInventoryRowProps {
  item: InventoryItem;
  onFieldChange: (item: InventoryItem, field: keyof InventoryItem, value: string) => void;
}

const EditableInventoryRow = ({ item, onFieldChange }: EditableInventoryRowProps) => {
  return (
    <tr className="border-b group hover:bg-gray-50">
      <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-gray-50 z-10 min-w-[150px] border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
        <Input
          value={item.name}
          onChange={(e) => onFieldChange(item, 'name', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'name', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[120px]">
        <Input
          value={item.type}
          onChange={(e) => onFieldChange(item, 'type', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'type', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[120px]">
        <Input
          value={item.manufacturer}
          onChange={(e) => onFieldChange(item, 'manufacturer', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'manufacturer', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[120px]">
        <Input
          value={item.model}
          onChange={(e) => onFieldChange(item, 'model', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'model', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[100px]">
        <Input
          value={item.version}
          onChange={(e) => onFieldChange(item, 'version', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'version', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[120px]">
        <Input
          value={item.location}
          onChange={(e) => onFieldChange(item, 'location', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'location', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[120px]">
        <Input
          value={item.owner}
          onChange={(e) => onFieldChange(item, 'owner', e.target.value)}
          className="h-8 text-sm w-full"
          onBlur={(e) => onFieldChange(item, 'owner', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[100px]">
        <Select
          value={item.status}
          onChange={(e) => onFieldChange(item, 'status', e.target.value)}
          className="h-8 text-sm w-full"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Retired">Retired</option>
        </Select>
      </td>
      <td className="px-4 py-2 min-w-[100px]">
        <Select
          value={item.criticality}
          onChange={(e) => onFieldChange(item, 'criticality', e.target.value)}
          className="h-8 text-sm w-full"
        >
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </Select>
      </td>
      <td className="px-4 py-2 min-w-[120px]">
        <Input
          value={item.ipAddress || ''}
          onChange={(e) => onFieldChange(item, 'ipAddress', e.target.value)}
          className="h-8 text-sm w-full font-mono"
          placeholder="IP Address"
          onBlur={(e) => onFieldChange(item, 'ipAddress', e.target.value)}
        />
      </td>
      <td className="px-4 py-2 min-w-[200px]">
        <Textarea
          value={item.notes || ''}
          onChange={(e) => onFieldChange(item, 'notes', e.target.value)}
          className="h-8 text-xs w-full resize-none"
          rows={1}
          onBlur={(e) => onFieldChange(item, 'notes', e.target.value)}
        />
      </td>
    </tr>
  );
};

