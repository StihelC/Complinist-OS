import { memo } from 'react';
import { EdgeMetadata } from '@/lib/utils/types';
import { cn } from '@/lib/utils/utils';
import { useFlowStore } from '@/core/stores/useFlowStore';

interface EdgeLabelProps {
  data: EdgeMetadata;
  labelFields?: string[];
}

// Field display configuration
const FIELD_CONFIG: Record<string, { label: string }> = {
  protocol: { label: 'Protocol' },
  bandwidth: { label: 'Bandwidth' },
  latency: { label: 'Latency' },
  jitter: { label: 'Jitter' },
  packetLoss: { label: 'Packet Loss' },
  errorRate: { label: 'Error Rate' },
  linkType: { label: 'Link Type' },
  vlanId: { label: 'VLAN' },
  qosClass: { label: 'QoS' },
  redundancyType: { label: 'Redundancy' },
  connectionState: { label: 'State' },
  portSource: { label: 'Source Port' },
  portTarget: { label: 'Target Port' },
  dataFlow: { label: 'Data Flow' },
  encryptionProtocol: { label: 'Encryption' },
};

// Custom comparison function to prevent unnecessary re-renders
const areEdgeLabelPropsEqual = (prevProps: EdgeLabelProps, nextProps: EdgeLabelProps): boolean => {
  const prevData = prevProps.data || {};
  const nextData = nextProps.data || {};

  // Compare label and all displayed fields
  if (prevData.label !== nextData.label) return false;
  if (prevData.connectionState !== nextData.connectionState) return false;
  if (prevData.protocol !== nextData.protocol) return false;
  if (prevData.bandwidth !== nextData.bandwidth) return false;
  if (prevData.latency !== nextData.latency) return false;
  if (prevData.jitter !== nextData.jitter) return false;
  if (prevData.packetLoss !== nextData.packetLoss) return false;
  if (prevData.errorRate !== nextData.errorRate) return false;
  if (prevData.linkType !== nextData.linkType) return false;
  if (prevData.vlanId !== nextData.vlanId) return false;
  if (prevData.qosClass !== nextData.qosClass) return false;
  if (prevData.redundancyType !== nextData.redundancyType) return false;
  if (prevData.portSource !== nextData.portSource) return false;
  if (prevData.portTarget !== nextData.portTarget) return false;
  if (prevData.dataFlow !== nextData.dataFlow) return false;
  if (prevData.encryptionProtocol !== nextData.encryptionProtocol) return false;

  // Compare labelFields array
  const prevLabelFields = prevProps.labelFields || [];
  const nextLabelFields = nextProps.labelFields || [];
  if (prevLabelFields.length !== nextLabelFields.length) return false;
  for (let i = 0; i < prevLabelFields.length; i++) {
    if (prevLabelFields[i] !== nextLabelFields[i]) return false;
  }

  return true;
};

const EdgeLabelComponent = ({ data, labelFields }: EdgeLabelProps) => {
  const globalSettings = useFlowStore((state) => state.globalSettings);
  const fontSize = globalSettings.globalConnectionLabelSize;

  // If custom label is provided, show that
  if (data?.label) {
    return (
      <div 
        className="px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-300 rounded-md shadow-md font-medium text-gray-800"
        style={{ fontSize: `${fontSize}px` }}
        key={`edge-label-${fontSize}`}
      >
        {data.label}
      </div>
    );
  }

  // Otherwise, show selected fields
  const fieldsToShow = labelFields || [];
  
  if (fieldsToShow.length === 0) {
    return null;
  }

  // Filter and map fields that have values
  const displayFields = fieldsToShow
    .filter((field) => {
      const value = data[field as keyof EdgeMetadata];
      return value !== undefined && value !== null && value !== '';
    })
    .map((field) => ({
      field,
      value: data[field as keyof EdgeMetadata],
      config: FIELD_CONFIG[field] || { label: field },
    }));

  if (displayFields.length === 0) {
    return null;
  }

  // Get connection state for styling
  const connectionState = data.connectionState || 'active';
  const stateColors = {
    active: 'border-green-400 bg-green-50/95',
    standby: 'border-yellow-400 bg-yellow-50/95',
    failed: 'border-red-400 bg-red-50/95',
  };

  return (
    <div
      className={cn(
        'px-2.5 py-1.5 backdrop-blur-sm border rounded-md shadow-md space-y-0.5 min-w-[100px]',
        stateColors[connectionState]
      )}
      style={{ position: 'relative', fontSize: `${fontSize}px` }}
      key={`edge-label-fields-${fontSize}`}
    >
      {/* Field values */}
      {displayFields.map(({ field, value, config }) => {
        return (
          <div key={field} className="flex items-center gap-1 text-gray-700" style={{ fontSize: `${fontSize}px` }}>
            <span className="font-semibold">{config.label}:</span>
            <span className="text-gray-900">{String(value)}</span>
          </div>
        );
      })}
    </div>
  );
};

// Export memoized component with custom comparison function
export const EdgeLabel = memo(EdgeLabelComponent, areEdgeLabelPropsEqual);
EdgeLabel.displayName = 'EdgeLabel';
