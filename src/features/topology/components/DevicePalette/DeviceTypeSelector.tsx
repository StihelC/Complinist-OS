import { useState } from 'react';
import { DeviceType } from '@/lib/utils/types';
import { getIconsForDeviceType, getDeviceIconMetadata } from '@/lib/utils/deviceIconMapping';
import { getIconPath } from '@/lib/utils/iconPath';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/utils';

interface DeviceTypeSelectorProps {
  currentIconPath: string;
  currentDeviceType: DeviceType;
  onSelect: (iconFilename: string, deviceType: DeviceType, deviceSubtype?: string) => void;
}

export const DeviceTypeSelector = ({
  currentIconPath,
  currentDeviceType,
  onSelect,
}: DeviceTypeSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get all available icons for this device type
  const availableIcons = getIconsForDeviceType(currentDeviceType);

  if (!isExpanded) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Device Icon</label>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center gap-2">
            <img
              src={getIconPath(currentIconPath)}
              alt="Current icon"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="text-sm truncate">
              {getDeviceIconMetadata(currentIconPath)?.displayName || 'Select icon'}
            </span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Select Device Icon</label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
        >
          Done
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
        {availableIcons.map((iconFilename) => {
          const metadata = getDeviceIconMetadata(iconFilename);
          if (!metadata) return null;

          const isSelected = iconFilename === currentIconPath;

          return (
            <button
              key={iconFilename}
              onClick={() => {
                onSelect(iconFilename, metadata.deviceType, metadata.deviceSubtype);
                setIsExpanded(false);
              }}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded border transition-colors hover:bg-accent',
                isSelected && 'border-blue-500 bg-blue-50 dark:bg-blue-900'
              )}
              title={metadata.displayName}
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <img
                  src={getIconPath(iconFilename)}
                  alt={metadata.displayName}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <span className="text-[10px] text-center truncate w-full">
                {metadata.deviceSubtype || metadata.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

