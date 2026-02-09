import { DeviceNodeData } from '@/lib/utils/types';
import { useFlowStore } from '@/core/stores/useFlowStore';

interface DeviceLabelProps {
  data: DeviceNodeData;
  labelFields?: string[];
}

// Field display configuration
const FIELD_CONFIG: Record<string, { label: string }> = {
  name: { label: 'Name' },
  deviceType: { label: 'Type' },
  deviceSubtype: { label: 'Subtype' },
  ipAddress: { label: 'IP' },
  macAddress: { label: 'MAC' },
  manufacturer: { label: 'Manufacturer' },
  model: { label: 'Model' },
  operatingSystem: { label: 'OS' },
  osVersion: { label: 'OS Version' },
  securityZone: { label: 'Zone' },
  assetValue: { label: 'Asset Value' },
  complianceStatus: { label: 'Compliance' },
  location: { label: 'Location' },
  department: { label: 'Department' },
  systemOwner: { label: 'Owner' },
  missionCritical: { label: 'Critical' },
};

export const DeviceLabel = ({ data, labelFields }: DeviceLabelProps) => {
  const globalSettings = useFlowStore((state) => state.globalSettings);
  const fontSize = globalSettings.globalDeviceLabelSize;

  // If custom label is provided, show that
  if (data.label) {
    return (
      <div 
        className="px-2 py-1 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-md shadow-sm font-medium text-gray-800 inline-block max-w-full"
        style={{ fontSize: `${fontSize}px` }}
      >
        {data.label}
      </div>
    );
  }

  // Otherwise, show selected fields
  const fieldsToShow = labelFields || [];
  
  // Default to showing name and type in property:value format if no fields specified
  if (fieldsToShow.length === 0) {
    return (
      <div className="space-y-1 w-full">
        <div className="text-center text-gray-700" style={{ fontSize: `${fontSize}px` }}>
          <span className="font-semibold">Name:</span>{' '}
          <span className="text-gray-900">{data.name}</span>
        </div>
        <div className="text-center text-gray-700" style={{ fontSize: `${fontSize}px` }}>
          <span className="font-semibold">Type:</span>{' '}
          <span className="text-gray-900">{data.deviceSubtype || data.deviceType}</span>
        </div>
      </div>
    );
  }

  // Filter and map fields that have values
  const displayFields = fieldsToShow
    .filter((field) => {
      const value = data[field as keyof DeviceNodeData];
      // Special handling for boolean fields
      if (field === 'missionCritical' && typeof value === 'boolean') {
        return true; // Always show boolean even if false
      }
      return value !== undefined && value !== null && value !== '';
    })
    .map((field) => {
      const value = data[field as keyof DeviceNodeData];
      // Format boolean values
      const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
      return {
        field,
        value: displayValue,
        config: FIELD_CONFIG[field] || { label: field },
      };
    });

  if (displayFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1 w-full">
      {displayFields.map(({ field, value, config }) => {
        return (
          <div key={field} className="text-center text-gray-700" style={{ fontSize: `${fontSize}px` }}>
            <span className="font-semibold">{config.label}:</span>{' '}
            <span className="text-gray-900">{value}</span>
          </div>
        );
      })}
    </div>
  );
};

