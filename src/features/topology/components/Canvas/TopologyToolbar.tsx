import {
  MonitorSmartphone,
  Box,
  Settings2,
  MousePointer2,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { AutoTidyButton } from '../AutoTidy';

export type ActivePanel = 'devices' | 'boundaries' | 'alignment' | null;

interface TopologyToolbarProps {
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  ariaLabel: string;
}

const ToolbarButton = ({ icon, label, isActive, onClick, ariaLabel }: ToolbarButtonProps) => (
  <button
    className={cn(
      'topology-toolbar-button flex items-center gap-2 px-3 py-2',
      isActive && 'active'
    )}
    onClick={onClick}
    aria-label={ariaLabel}
    title={label}
    style={{ width: 'auto', minWidth: 'auto' }}
  >
    {icon}
    <span className="text-xs font-medium whitespace-nowrap">{label}</span>
  </button>
);

export const TopologyToolbar = ({ activePanel, onPanelChange }: TopologyToolbarProps) => {
  const boundaryDrawingMode = useFlowStore((state) => state.boundaryDrawingMode);
  const placementMode = useFlowStore((state) => state.placementMode);
  const setBoundaryDrawingMode = useFlowStore((state) => state.setBoundaryDrawingMode);
  const setPlacementMode = useFlowStore((state) => state.setPlacementMode);

  const togglePanel = (panel: ActivePanel) => {
    if (activePanel === panel) {
      onPanelChange(null);
    } else {
      onPanelChange(panel);
    }
  };

  // Determine current mode for status indicator
  const getCurrentMode = () => {
    if (boundaryDrawingMode) {
      return { label: `Drawing: ${boundaryDrawingMode.label}`, icon: <Crosshair className="w-4 h-4" />, color: 'text-blue-600' };
    }
    if (placementMode) {
      return { label: `Placing: ${placementMode.displayName}`, icon: <Crosshair className="w-4 h-4" />, color: 'text-green-600' };
    }
    return { label: 'Select / Move', icon: <MousePointer2 className="w-4 h-4" />, color: 'text-gray-600' };
  };

  const currentMode = getCurrentMode();
  const hasActiveMode = boundaryDrawingMode !== null || placementMode !== null;

  return (
    <div className="topology-toolbar topology-toolbar-left">
      <div className="topology-toolbar-group">
        <ToolbarButton
          icon={<MonitorSmartphone className="w-4 h-4" />}
          label="Add Device"
          isActive={activePanel === 'devices'}
          onClick={() => togglePanel('devices')}
          ariaLabel="Open device palette to add devices to the topology"
        />
        <ToolbarButton
          icon={<Box className="w-4 h-4" />}
          label="Add Boundary"
          isActive={activePanel === 'boundaries'}
          onClick={() => togglePanel('boundaries')}
          ariaLabel="Open boundary form to create security zones and boundaries"
        />
        <ToolbarButton
          icon={<Settings2 className="w-4 h-4" />}
          label="Styling"
          isActive={activePanel === 'alignment'}
          onClick={() => togglePanel('alignment')}
          ariaLabel="Open styling panel for visual settings"
        />
      </div>

      {/* Auto-Tidy Button with Options */}
      <AutoTidyButton className="mt-2" />

      {/* Mode Status Indicator */}
      <div
        data-testid="mode-indicator"
        className={cn(
          'flex items-center gap-2 bg-white rounded-lg shadow-md border px-3 py-2 mt-2',
          hasActiveMode ? 'border-blue-300' : 'border-gray-200'
        )}
        style={{ maxWidth: '200px' }}
      >
        <span className={currentMode.color}>
          {currentMode.icon}
        </span>
        <span className={cn('text-xs font-medium whitespace-nowrap', currentMode.color)}>
          {currentMode.label}
        </span>
        {hasActiveMode && (
          <button
            data-testid="mode-esc-button"
            onClick={() => {
              setBoundaryDrawingMode(null);
              setPlacementMode(null);
            }}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline flex-shrink-0"
            title="Press ESC to exit"
          >
            ESC
          </button>
        )}
      </div>
    </div>
  );
};
