import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DeviceNodeData, DeviceType } from '@/lib/utils/types';
import { getIconsForDeviceType, getDeviceIconMetadata, getAllMappedDeviceTypes } from '@/lib/utils/deviceIconMapping';
import { getIconPath } from '@/lib/utils/iconPath';
import { cn } from '@/lib/utils/utils';

interface DeviceVisualTabProps {
  data: DeviceNodeData;
  globalDeviceImageSize: number;
  onChange: (field: keyof DeviceNodeData, value: any) => void;
  onIconChange: (iconFilename: string, deviceType: DeviceType, deviceSubtype?: string) => void;
  onResetImageSize: () => void;
}

export const DeviceVisualTab = ({ 
  data, 
  globalDeviceImageSize, 
  onChange, 
  onIconChange,
  onResetImageSize 
}: DeviceVisualTabProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get all available device types with their first icon
  const deviceTypeOptions = useMemo(() => {
    const types = getAllMappedDeviceTypes().sort();
    return types.map((deviceType) => {
      const icons = getIconsForDeviceType(deviceType);
      const firstIcon = icons.length > 0 ? icons[0] : null;
      const iconMeta = firstIcon ? getDeviceIconMetadata(firstIcon) : null;
      
      return {
        deviceType,
        iconPath: firstIcon,
        iconMeta,
        displayName: deviceType
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      };
    }).filter(option => option.iconPath); // Only show types with icons
  }, []);

  // Find current device type option
  const currentOption = deviceTypeOptions.find(opt => opt.deviceType === data.deviceType);

  // Handle device type selection with icon
  const handleDeviceTypeSelect = (deviceType: DeviceType, iconPath: string, iconMeta: any) => {
    onIconChange(iconPath, deviceType, iconMeta?.deviceSubtype);
    setDropdownOpen(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-2 block">Device Type</Label>
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start h-10 text-xs"
            >
              <div className="flex items-center gap-2 flex-1">
                {currentOption && (
                  <>
                    <img
                      src={getIconPath(currentOption.iconPath || '')}
                      alt={currentOption.displayName}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="truncate">{currentOption.displayName}</span>
                  </>
                )}
                {!currentOption && (
                  <span className="text-gray-400">Select device type...</span>
                )}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-2" align="start">
            <div className="max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {deviceTypeOptions.map((option) => {
                  const isSelected = option.deviceType === data.deviceType;
                  return (
                    <button
                      key={option.deviceType}
                      onClick={() => handleDeviceTypeSelect(
                        option.deviceType,
                        option.iconPath!,
                        option.iconMeta
                      )}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded border text-xs transition-colors hover:bg-accent text-left',
                        isSelected && 'border-blue-500 bg-blue-50'
                      )}
                    >
                      <img
                        src={getIconPath(option.iconPath || '')}
                        alt={option.displayName}
                        className="w-8 h-8 object-contain flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="truncate">{option.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Device Image Size Control */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">
          Device Image Size: {data.deviceImageSize ?? globalDeviceImageSize}%
          {data.deviceImageSize !== undefined && (
            <span className="text-[10px] text-blue-600 ml-1">(overrides global)</span>
          )}
        </Label>
        <Input
          type="range"
          min="20"
          max="100"
          step="5"
          value={data.deviceImageSize ?? globalDeviceImageSize}
          onChange={(e) => {
            const value = Number(e.target.value);
            onChange('deviceImageSize', value);
          }}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>20%</span>
          <span>60%</span>
          <span>100%</span>
        </div>
        <div className="p-2 bg-gray-50 rounded border text-center">
          <div 
            className="mx-auto bg-blue-100 rounded"
            style={{ 
              width: `${data.deviceImageSize ?? globalDeviceImageSize}px`, 
              height: `${data.deviceImageSize ?? globalDeviceImageSize}px` 
            }}
          />
        </div>
        <p className="text-[10px] text-gray-500">
          {data.deviceImageSize !== undefined 
            ? 'This device uses a custom image size. Clear the value to use the global setting.'
            : 'Uses global setting from Styling panel. Set a value to override for this device.'}
        </p>
        {data.deviceImageSize !== undefined && (
          <Button
            variant="outline"
            size="sm"
            onClick={onResetImageSize}
            className="w-full text-xs h-7"
          >
            Reset to Global Setting
          </Button>
        )}
      </div>

      {/* Display Fields Configuration */}
      <div>
        <Label className="text-xs mb-2 block">Display Fields Under Device</Label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded p-2">
          {[
            { value: 'name', label: 'Name' },
            { value: 'deviceType', label: 'Device Type' },
            { value: 'deviceSubtype', label: 'Device Subtype' },
            { value: 'ipAddress', label: 'IP Address' },
            { value: 'macAddress', label: 'MAC Address' },
            { value: 'manufacturer', label: 'Manufacturer' },
            { value: 'model', label: 'Model' },
            { value: 'operatingSystem', label: 'Operating System' },
            { value: 'osVersion', label: 'OS Version' },
            { value: 'securityZone', label: 'Security Zone' },
            { value: 'assetValue', label: 'Asset Value' },
            { value: 'complianceStatus', label: 'Compliance Status' },
            { value: 'location', label: 'Location' },
            { value: 'department', label: 'Department' },
            { value: 'systemOwner', label: 'System Owner' },
            { value: 'missionCritical', label: 'Mission Critical' },
          ].map((option) => {
            const isSelected = (data.labelFields || []).includes(option.value);
            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`label-field-${option.value}`}
                  checked={isSelected}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const currentFields = data.labelFields || [];
                    const newFields = e.target.checked
                      ? [...currentFields, option.value]
                      : currentFields.filter((f) => f !== option.value);
                    onChange('labelFields', newFields);
                  }}
                />
                <Label
                  htmlFor={`label-field-${option.value}`}
                  className="text-xs font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          Select which fields to display underneath the device icon
        </p>
      </div>

      {/* Custom Label Option */}
      <div>
        <Label htmlFor="customLabel" className="text-xs">Custom Label (Optional)</Label>
        <Input
          id="customLabel"
          value={data.label || ''}
          onChange={(e) => onChange('label', e.target.value)}
          placeholder="Override with custom text"
          className="h-8 text-xs"
        />
        <p className="text-[10px] text-gray-500 mt-1">
          If set, this replaces the selected fields above
        </p>
      </div>

      {data.deviceSubtype && (
        <div>
          <Label className="text-xs">Device Subtype</Label>
          <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
            {data.deviceSubtype}
          </div>
        </div>
      )}
    </div>
  );
};

