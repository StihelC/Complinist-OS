import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AppNode, DeviceNodeData } from '@/lib/utils/types';
import { X, Plus, Edit2 } from 'lucide-react';

interface DeviceManagementTableProps {
  devices: AppNode[];
  editingDeviceId: string | null;
  editedDevice: Partial<DeviceNodeData> | null;
  editingSoftwareDeviceId: string | null;
  onStartEdit: (node: AppNode) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onFieldChange: (field: keyof DeviceNodeData, value: any) => void;
  onInlineFieldChange: (nodeId: string, field: keyof DeviceNodeData, value: any) => void;
  onStartEditSoftware: (nodeId: string) => void;
  onAddSoftware: (nodeId: string, softwareName: string) => void;
  onRemoveSoftware: (nodeId: string, index: number) => void;
}

export const DeviceManagementTable = ({
  devices,
  editingDeviceId,
  editedDevice,
  editingSoftwareDeviceId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onFieldChange,
  onInlineFieldChange,
  onStartEditSoftware,
  onAddSoftware,
  onRemoveSoftware
}: DeviceManagementTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Name</th>
            <th className="px-4 py-2 text-left font-semibold">Type</th>
            <th className="px-4 py-2 text-left font-semibold">Manufacturer</th>
            <th className="px-4 py-2 text-left font-semibold">Model</th>
            <th className="px-4 py-2 text-left font-semibold">IP Address</th>
            <th className="px-4 py-2 text-left font-semibold">OS</th>
            <th className="px-4 py-2 text-left font-semibold">Location</th>
            <th className="px-4 py-2 text-left font-semibold">Status</th>
            <th className="px-4 py-2 text-left font-semibold">Software</th>
            <th className="px-4 py-2 text-left font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                No devices found
              </td>
            </tr>
          ) : (
            devices.map((node) => {
              const data = node.data as DeviceNodeData;
              const isEditing = editingDeviceId === node.id;
              const deviceData = isEditing && editedDevice ? editedDevice : data;

              return (
                <DeviceRow
                  key={node.id}
                  node={node}
                  data={deviceData}
                  isEditing={isEditing}
                  isEditingSoftware={editingSoftwareDeviceId === node.id}
                  onStartEdit={() => onStartEdit(node)}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  onFieldChange={onFieldChange}
                  onInlineFieldChange={onInlineFieldChange}
                  onStartEditSoftware={onStartEditSoftware}
                  onAddSoftware={onAddSoftware}
                  onRemoveSoftware={onRemoveSoftware}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

interface DeviceRowProps {
  node: AppNode;
  data: Partial<DeviceNodeData>;
  isEditing: boolean;
  isEditingSoftware: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onFieldChange: (field: keyof DeviceNodeData, value: any) => void;
  onInlineFieldChange: (nodeId: string, field: keyof DeviceNodeData, value: any) => void;
  onStartEditSoftware: (nodeId: string) => void;
  onAddSoftware: (nodeId: string, softwareName: string) => void;
  onRemoveSoftware: (nodeId: string, index: number) => void;
}

const DeviceRow = ({
  node,
  data,
  isEditing: _isEditing,
  isEditingSoftware,
  onStartEdit,
  onCancelEdit: _onCancelEdit,
  onSaveEdit: _onSaveEdit,
  onFieldChange: _onFieldChange,
  onInlineFieldChange,
  onStartEditSoftware,
  onAddSoftware,
  onRemoveSoftware
}: DeviceRowProps) => {
  const [localSoftwareInput, setLocalSoftwareInput] = useState('');
  const softwareList = (data.software || '').split('\n').filter(s => s.trim());

  const handleAddSoftwareLocal = () => {
    if (!localSoftwareInput.trim()) return;
    onAddSoftware(node.id, localSoftwareInput);
    setLocalSoftwareInput('');
  };

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-2">
        <Input
          value={data.name || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'name', e.target.value)}
          onBlur={(e) => onInlineFieldChange(node.id, 'name', e.target.value)}
          className="h-8 text-sm w-full"
          placeholder="Device name"
        />
      </td>
      <td className="px-4 py-2">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
          {data.deviceType || '-'}
        </span>
      </td>
      <td className="px-4 py-2">
        <Input
          value={data.manufacturer || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'manufacturer', e.target.value)}
          onBlur={(e) => onInlineFieldChange(node.id, 'manufacturer', e.target.value)}
          className="h-8 text-sm w-full"
          placeholder="Manufacturer"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={data.model || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'model', e.target.value)}
          onBlur={(e) => onInlineFieldChange(node.id, 'model', e.target.value)}
          className="h-8 text-sm w-full"
          placeholder="Model"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={data.ipAddress || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'ipAddress', e.target.value)}
          onBlur={(e) => onInlineFieldChange(node.id, 'ipAddress', e.target.value)}
          className="h-8 text-sm w-full font-mono"
          placeholder="192.168.1.1"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={data.operatingSystem || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'operatingSystem', e.target.value)}
          onBlur={(e) => onInlineFieldChange(node.id, 'operatingSystem', e.target.value)}
          className="h-8 text-sm w-full"
          placeholder="OS"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={data.location || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'location', e.target.value)}
          onBlur={(e) => onInlineFieldChange(node.id, 'location', e.target.value)}
          className="h-8 text-sm w-full"
          placeholder="Location"
        />
      </td>
      <td className="px-4 py-2">
        <Select
          value={data.status || ''}
          onChange={(e) => onInlineFieldChange(node.id, 'status', e.target.value)}
          className="h-8 text-sm w-full"
        >
          <option value="">Select...</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Retired">Retired</option>
        </Select>
      </td>
      <td className="px-4 py-2 min-w-[200px]">
        {isEditingSoftware ? (
          <div className="space-y-1">
            {softwareList.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {softwareList.map((item, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs">
                    <span className="flex-1 truncate">{item}</span>
                    <Button
                      type="button"
                      onClick={() => onRemoveSoftware(node.id, index)}
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input
                value={localSoftwareInput}
                onChange={(e) => setLocalSoftwareInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSoftwareLocal();
                  }
                }}
                placeholder="Add software..."
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                onClick={handleAddSoftwareLocal}
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={!localSoftwareInput.trim()}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <Button
              type="button"
              onClick={() => onStartEditSoftware('')}
              size="sm"
              variant="ghost"
              className="h-6 w-full text-xs"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {softwareList.length > 0 ? (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {softwareList.slice(0, 3).map((item, index) => (
                  <div key={index} className="text-xs text-gray-600 truncate">
                    {item}
                  </div>
                ))}
                {softwareList.length > 3 && (
                  <div className="text-xs text-gray-400">
                    +{softwareList.length - 3} more
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-400">No software</span>
            )}
            <Button
              type="button"
              onClick={() => onStartEditSoftware(node.id)}
              size="sm"
              variant="ghost"
              className="h-6 w-full text-xs"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </td>
      <td className="px-4 py-2">
        <Button onClick={onStartEdit} size="sm" variant="outline" className="h-7 px-2" title="Open full editor">
          <Edit2 className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  );
};

