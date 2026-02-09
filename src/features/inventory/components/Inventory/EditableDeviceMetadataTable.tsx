import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AppNode, DeviceNodeData } from '@/lib/utils/types';
import { DEVICE_PROPERTY_FIELDS, type PropertyFieldDefinition } from '@/lib/utils/propertyRegistry';
import type { DeviceMetadata, DeviceType } from '@/lib/utils/types';

// All available device types
const DEVICE_TYPES: DeviceType[] = [
  'router', 'atm-router', 'broadband-router', 'voice-router', 'wireless-router', 'mobile-access-router',
  'optical-services-router', 'content-service-router', 'iscsi-router', 'netflow-router', 'ip-telephony-router',
  'tdm-router', 'wavelength-router', 'storage-router', 'switch', 'layer-2-switch', 'layer-3-switch',
  'atm-switch', 'isdn-switch', 'content-switch', 'voice-switch', 'workgroup-switch', 'multilayer-switch',
  'programmable-switch', 'fibre-channel-switch', 'class-4-5-switch', 'pbx-switch', 'firewall',
  'pix-firewall', 'ios-firewall', 'centri-firewall', 'vpn-gateway', 'vpn-concentrator', 'asa-5500',
  'ssl-terminator', 'nac-appliance', 'server', 'dns-server', 'dhcp-server', 'database-server',
  'file-server', 'web-server', 'directory-server', 'storage-server', 'communications-server',
  'unity-server', 'moh-server', 'iptv-server', 'presence-server', 'software-server', 'access-point',
  'wireless-bridge', 'wireless-transport', 'lightweight-ap', 'mesh-ap', 'dual-mode-ap',
  'wlan-controller', 'wireless-location-appliance', 'ip-phone', 'softphone', 'pbx', 'phone',
  'cellular-phone', 'callmanager', 'voice-gateway', 'gatekeeper', 'mcu', 'endpoint', 'workstation',
  'laptop', 'pc', 'tablet', 'pda', 'mobile-device', 'terminal', 'sun-workstation', 'mac',
  'storage-array', 'tape-array', 'jbod', 'fc-storage', 'disk-subsystem', 'hub', 'repeater',
  'bridge', 'load-balancer', 'proxy', 'modem', 'cable-modem', 'dslam', 'csu-dsu', 'mux', 'pad',
  'protocol-translator', 'dwdm-filter', 'optical-amplifier', 'optical-transport', 'transpath',
  'carrier-routing-system', 'cisco-hub', 'cisco-asa', 'cisco-file-engine', 'cisco-unity',
  'catalyst', 'nexus-1000', 'nexus-2000', 'nexus-5000', 'nexus-7000', 'asr-1000', 'me-1100',
  'content-engine', 'ciscoworks', 'network-management', 'iptc', 'ics', 'detector', 'scanner',
  'printer', 'fax', 'camera', 'speaker', 'generic-appliance', 'antenna', 'satellite',
  'satellite-dish', 'radio-tower', 'cloud', 'generic-building', 'branch-office', 'data-center', 'ups'
];

interface EditableDeviceMetadataTableProps {
  devices: AppNode[];
  updateNode: (nodeId: string, data: Partial<DeviceNodeData>) => void;
}

export const EditableDeviceMetadataTable = ({ devices, updateNode }: EditableDeviceMetadataTableProps) => {
  // Get all field definitions organized by category
  const allFields = Object.values(DEVICE_PROPERTY_FIELDS);
  const categories: Array<PropertyFieldDefinition['category']> = ['Basic', 'Network', 'Hardware', 'Software', 'Security', 'Compliance', 'Ownership'];
  
  // Get all fields in order
  const orderedFields = categories.flatMap(cat => 
    allFields.filter(f => f.category === cat)
  );

  // Column widths state - initialize with default widths
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = { name: 180 };
    orderedFields.forEach(field => {
      widths[field.fieldName] = 150;
    });
    return widths;
  });

  // Row heights state
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  // Resizing state
  const [_resizingColumn, _setResizingColumn] = useState<string | null>(null);
  const [_resizingRow, _setResizingRow] = useState<string | null>(null);
  // const _resizeStartX = useRef<number>(0); // Unused - kept for potential future use
  // const _resizeStartY = useRef<number>(0); // Unused - kept for potential future use
  // const _resizeStartWidth = useRef<number>(0); // Unused - kept for potential future use
  // const _resizeStartHeight = useRef<number>(0); // Unused - kept for potential future use

  const handleFieldChange = (nodeId: string, field: keyof DeviceMetadata, value: any) => {
    updateNode(nodeId, { [field]: value } as Partial<DeviceNodeData>);
  };

  const handleColumnResizeStart = useCallback((fieldName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = columnWidths[fieldName] || 150;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [fieldName]: newWidth }));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      _setResizingColumn(null);
    };
    
    _setResizingColumn(fieldName);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const handleRowResizeStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const startHeight = rowHeights[nodeId] || 40;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientY - startY;
      const newHeight = Math.max(30, startHeight + diff);
      setRowHeights(prev => ({ ...prev, [nodeId]: newHeight }));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      _setResizingRow(null);
    };
    
    _setResizingRow(nodeId);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowHeights]);

  if (devices.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No devices found
      </div>
    );
  }

  return (
    <div className="overflow-auto border border-gray-300 bg-white" style={{ maxHeight: '100%' }}>
      <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
        <thead className="bg-blue-50 sticky top-0 z-10 border-b border-gray-300">
          <tr>
            <th 
              className="text-left font-medium sticky left-0 bg-blue-50 z-20 border-r border-gray-200"
              style={{ width: columnWidths.name || 180, position: 'relative' }}
            >
              <div className="flex items-center h-10 px-3">
                <span className="flex-1 text-gray-700">Name</span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 hover:bg-blue-400 cursor-col-resize"
                  onMouseDown={(e) => handleColumnResizeStart('name', e)}
                  title="Drag to resize column"
                />
              </div>
            </th>
            {orderedFields.map((fieldDef) => (
              <th 
                key={fieldDef.fieldName} 
                className="text-left font-medium border-r border-gray-200 bg-blue-50"
                style={{ width: columnWidths[fieldDef.fieldName] || 150, position: 'relative' }}
                title={fieldDef.description}
              >
                <div className="flex items-center h-10 px-3">
                  <span className="flex-1 truncate text-gray-700">{fieldDef.description}</span>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 hover:bg-blue-400 cursor-col-resize"
                    onMouseDown={(e) => handleColumnResizeStart(String(fieldDef.fieldName), e)}
                    title="Drag to resize column"
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devices.map((node, _index) => {
            const data = node.data as DeviceNodeData;
            const rowHeight = rowHeights[node.id] || 40;
            // const _rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'; // Unused - kept for potential future use
            return (
              <tr 
                key={node.id} 
                className="border-b border-gray-200 hover:bg-blue-50 group"
                style={{ height: rowHeight }}
              >
                <td 
                  className="sticky left-0 bg-white group-hover:bg-blue-50 border-r border-gray-200 z-10"
                  style={{ width: columnWidths.name || 180, position: 'relative' }}
                >
                  <div className="h-full px-3 flex items-center">
                    <Input
                      value={data.name || ''}
                      onChange={(e) => handleFieldChange(node.id, 'name', e.target.value)}
                      className="h-full text-sm w-full font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
                      onBlur={(e) => handleFieldChange(node.id, 'name', e.target.value)}
                    />
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 hover:bg-blue-400 cursor-row-resize"
                    onMouseDown={(e) => handleRowResizeStart(node.id, e)}
                    title="Drag to resize row"
                  />
                </td>
                {orderedFields.map((fieldDef) => (
                  <td 
                    key={fieldDef.fieldName} 
                    className="border-r border-gray-200 bg-white group-hover:bg-blue-50"
                    style={{ width: columnWidths[fieldDef.fieldName] || 150 }}
                  >
                    <div className="h-full px-3 flex items-center">
                      <EditableDeviceMetadataRow
                        nodeId={node.id}
                        data={data}
                        fields={[fieldDef]}
                        onFieldChange={handleFieldChange}
                        singleField={fieldDef}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface EditableDeviceMetadataRowProps {
  nodeId: string;
  data: DeviceNodeData;
  fields: PropertyFieldDefinition[];
  onFieldChange: (nodeId: string, field: keyof DeviceMetadata, value: any) => void;
  columnWidths?: Record<string, number>;
  singleField?: PropertyFieldDefinition;
}

export const EditableDeviceMetadataRow = ({ nodeId, data, fields: _fields, onFieldChange, singleField }: EditableDeviceMetadataRowProps) => {
  const renderField = (fieldDef: PropertyFieldDefinition) => {
    const value = data[fieldDef.fieldName as keyof DeviceNodeData];
    
    // Special handling for deviceType field - show dropdown with all device types
    if (fieldDef.fieldName === 'deviceType') {
      return (
        <Select
          value={String(value || '')}
          onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
          className="h-full text-sm w-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
        >
          <option value="">Select device type...</option>
          {DEVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      );
    }
    
    // Handle array fields (convert to comma-separated string for editing)
    if (Array.isArray(value)) {
      return (
        <Input
          value={value.join(', ')}
          onChange={(e) => {
            const arrayValue = e.target.value.split(',').map(s => s.trim()).filter(s => s);
            onFieldChange(nodeId, fieldDef.fieldName, arrayValue);
          }}
          className="h-full text-sm w-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
          onBlur={(e) => {
            const arrayValue = e.target.value.split(',').map(s => s.trim()).filter(s => s);
            onFieldChange(nodeId, fieldDef.fieldName, arrayValue);
          }}
          placeholder="Comma-separated values"
        />
      );
    }
    
    if (fieldDef.fieldType === 'boolean') {
      return (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={value as boolean || false}
            onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.checked)}
          />
        </div>
      );
    }
    
    if (fieldDef.fieldType === 'select' && fieldDef.options) {
      return (
        <Select
          value={String(value || '')}
          onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
          className="h-full text-sm w-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
        >
          <option value="">-</option>
          {fieldDef.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      );
    }
    
    // Special handling for software field (newline-separated)
    if (fieldDef.fieldName === 'software') {
      return (
        <Textarea
          value={String(value || '')}
          onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
          className="h-full text-xs w-full resize-none border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
          rows={2}
          onBlur={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
          placeholder="One per line"
        />
      );
    }
    
    if (fieldDef.fieldType === 'textarea') {
      return (
        <Textarea
          value={String(value || '')}
          onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
          className="h-full text-xs w-full resize-none border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
          rows={1}
          onBlur={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
        />
      );
    }
    
    if (fieldDef.fieldType === 'date') {
      return (
        <Input
          type="date"
          value={String(value || '')}
          onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
          className="h-full text-sm w-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
          onBlur={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
        />
      );
    }
    
    // Default: text input
    return (
      <Input
        type={fieldDef.fieldType === 'email' ? 'email' : fieldDef.fieldType === 'number' ? 'number' : 'text'}
        value={String(value || '')}
        onChange={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
        className="h-full text-sm w-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
        onBlur={(e) => onFieldChange(nodeId, fieldDef.fieldName, e.target.value)}
        placeholder={fieldDef.description}
      />
    );
  };

  // If singleField is provided, render only that field (for table cells)
  if (singleField) {
    return <>{renderField(singleField)}</>;
  }

  // Otherwise render the name field (for the sticky name column)
  return (
    <Input
      value={data.name || ''}
      onChange={(e) => onFieldChange(nodeId, 'name', e.target.value)}
      className="h-full text-sm w-full font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-100 bg-transparent rounded px-1"
      onBlur={(e) => onFieldChange(nodeId, 'name', e.target.value)}
    />
  );
};

