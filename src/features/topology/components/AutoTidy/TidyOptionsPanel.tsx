import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import {
  TidyOptions as LibTidyOptions,
  SpacingTier,
  EdgeRoutingType,
  DagreRanker,
  DEFAULT_TIDY_OPTIONS as LIB_DEFAULT_OPTIONS,
} from '@/lib/topology/auto-tidy';

// Re-export types for convenience
export type { SpacingTier, EdgeRoutingType, DagreRanker };

// Extended options interface for UI that maps to the library options
export interface TidyOptions {
  spacingTier: SpacingTier;
  autoResizeBoundaries: boolean;
  animateTransitions: boolean;
  edgeRoutingType: EdgeRoutingType;
  minimizeOverlaps: boolean;
  rankerAlgorithm: DagreRanker | 'auto';
  // Advanced options
  customPadding?: number;
  animationDuration?: number;
}

export const DEFAULT_TIDY_OPTIONS: TidyOptions = {
  spacingTier: LIB_DEFAULT_OPTIONS.spacingTier,
  autoResizeBoundaries: LIB_DEFAULT_OPTIONS.autoResize,
  animateTransitions: LIB_DEFAULT_OPTIONS.animate,
  edgeRoutingType: 'smoothstep',
  minimizeOverlaps: false,
  rankerAlgorithm: 'auto',
  customPadding: undefined,
  animationDuration: LIB_DEFAULT_OPTIONS.animationDuration,
};

export const EDGE_ROUTING_CONFIGS: Record<EdgeRoutingType, { label: string; description: string }> = {
  smart: {
    label: 'Smart',
    description: 'Pathfinding that avoids nodes (recommended)',
  },
  smartSmoothStep: {
    label: 'Smart Smooth',
    description: 'Orthogonal pathfinding with rounded corners, reduces overlap',
  },
  default: {
    label: 'Bezier',
    description: 'Smooth curved edges',
  },
  smoothstep: {
    label: 'Smooth Step',
    description: 'Orthogonal with rounded corners',
  },
  step: {
    label: 'Step',
    description: 'Sharp 90° angle connections',
  },
  straight: {
    label: 'Straight',
    description: 'Direct straight lines',
  },
};

export const SPACING_CONFIGS: Record<SpacingTier, { nodesep: number; ranksep: number; description: string }> = {
  compact: {
    nodesep: 60,
    ranksep: 80,
    description: 'Minimal spacing, fits more content',
  },
  comfortable: {
    nodesep: 120,
    ranksep: 160,
    description: 'Balanced spacing, good readability',
  },
  spacious: {
    nodesep: 200,
    ranksep: 260,
    description: 'Maximum spacing, best for presentations',
  },
};

export const RANKER_CONFIGS: Record<DagreRanker | 'auto', { label: string; description: string }> = {
  auto: {
    label: 'Auto (Recommended)',
    description: 'Automatically selects best algorithm for your topology',
  },
  'network-simplex': {
    label: 'Network Simplex',
    description: 'Balanced layout, good for most diagrams',
  },
  'tight-tree': {
    label: 'Tight Tree',
    description: 'Compact hierarchies, minimal edge length',
  },
  'longest-path': {
    label: 'Longest Path',
    description: 'Fast algorithm, good for simple flows',
  },
};

/**
 * Convert UI TidyOptions to library TidyOptions
 */
export function toLibraryOptions(options: TidyOptions): Partial<LibTidyOptions> {
  return {
    spacingTier: options.spacingTier,
    autoResize: options.autoResizeBoundaries,
    animate: options.animateTransitions,
    animationDuration: options.animationDuration,
    edgeOptimization: {
      edgeRoutingType: options.edgeRoutingType,
      minimizeOverlaps: options.minimizeOverlaps,
      rankerAlgorithm: options.rankerAlgorithm,
    },
  };
}

export interface TidyOptionsPanelProps {
  options: TidyOptions;
  onOptionsChange: (options: TidyOptions) => void;
  onApply: (options: TidyOptions) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TidyOptionsPanel = ({
  options,
  onOptionsChange,
  onApply,
  onCancel,
  isLoading = false,
}: TidyOptionsPanelProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSpacingChange = (tier: SpacingTier) => {
    onOptionsChange({ ...options, spacingTier: tier, customPadding: undefined });
  };

  const handleCheckboxChange = (key: 'autoResizeBoundaries' | 'animateTransitions' | 'minimizeOverlaps', checked: boolean) => {
    onOptionsChange({ ...options, [key]: checked });
  };

  const handleEdgeRoutingChange = (type: EdgeRoutingType) => {
    onOptionsChange({ ...options, edgeRoutingType: type });
  };

  const handleRankerChange = (ranker: DagreRanker | 'auto') => {
    onOptionsChange({ ...options, rankerAlgorithm: ranker });
  };

  const handleAdvancedChange = (key: 'customPadding' | 'animationDuration', value: number | undefined) => {
    onOptionsChange({ ...options, [key]: value });
  };

  return (
    <div className="p-4 space-y-4" data-testid="tidy-options-panel">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Settings2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">Tidy Options</span>
      </div>

      {/* Spacing Tier Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Spacing
        </Label>
        <div className="flex gap-1">
          {(['compact', 'comfortable', 'spacious'] as SpacingTier[]).map((tier) => (
            <button
              key={tier}
              onClick={() => handleSpacingChange(tier)}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-all',
                options.spacingTier === tier
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input'
              )}
              disabled={isLoading}
              data-testid={`spacing-${tier}`}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {SPACING_CONFIGS[options.spacingTier].description}
        </p>
      </div>

      {/* Edge Routing Type Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Edge Routing
        </Label>
        <div className="grid grid-cols-2 gap-1">
          {(['smart', 'smartSmoothStep', 'smoothstep', 'default', 'step', 'straight'] as EdgeRoutingType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleEdgeRoutingChange(type)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-md border transition-all text-left',
                options.edgeRoutingType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input'
              )}
              disabled={isLoading}
              data-testid={`edge-routing-${type}`}
            >
              {EDGE_ROUTING_CONFIGS[type].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {EDGE_ROUTING_CONFIGS[options.edgeRoutingType].description}
        </p>
      </div>

      {/* Layout Algorithm Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Layout Algorithm
        </Label>
        <div className="grid grid-cols-2 gap-1">
          {(['auto', 'network-simplex', 'tight-tree', 'longest-path'] as (DagreRanker | 'auto')[]).map((ranker) => (
            <button
              key={ranker}
              onClick={() => handleRankerChange(ranker)}
              className={cn(
                'px-3 py-2 text-xs font-medium rounded-md border transition-all text-left',
                options.rankerAlgorithm === ranker
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent border-input'
              )}
              disabled={isLoading}
              data-testid={`ranker-${ranker}`}
            >
              {RANKER_CONFIGS[ranker].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {RANKER_CONFIGS[options.rankerAlgorithm].description}
        </p>
      </div>

      {/* Main Options */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Options
        </Label>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoResize"
            checked={options.autoResizeBoundaries}
            onChange={(e) => handleCheckboxChange('autoResizeBoundaries', e.target.checked)}
            disabled={isLoading}
          />
          <Label htmlFor="autoResize" className="text-sm cursor-pointer">
            Auto-resize boundaries to fit contents
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="animate"
            checked={options.animateTransitions}
            onChange={(e) => handleCheckboxChange('animateTransitions', e.target.checked)}
            disabled={isLoading}
          />
          <Label htmlFor="animate" className="text-sm cursor-pointer">
            Animate transitions
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="minimizeOverlaps"
            checked={options.minimizeOverlaps}
            onChange={(e) => handleCheckboxChange('minimizeOverlaps', e.target.checked)}
            disabled={isLoading}
          />
          <Label htmlFor="minimizeOverlaps" className="text-sm cursor-pointer">
            Minimize connection overlaps
          </Label>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        type="button"
      >
        {showAdvanced ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        Advanced options
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-2">
            <Label htmlFor="customPadding" className="text-xs">
              Custom Padding (px)
            </Label>
            <Input
              id="customPadding"
              type="number"
              min="20"
              max="500"
              step="10"
              placeholder="Auto"
              value={options.customPadding ?? ''}
              onChange={(e) =>
                handleAdvancedChange(
                  'customPadding',
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              disabled={isLoading}
              className="h-8"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="animDuration" className="text-xs">
              Animation Duration (ms)
            </Label>
            <Input
              id="animDuration"
              type="number"
              min="0"
              max="2000"
              step="50"
              value={options.animationDuration ?? 300}
              onChange={(e) =>
                handleAdvancedChange('animationDuration', Number(e.target.value))
              }
              disabled={isLoading || !options.animateTransitions}
              className="h-8"
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onApply(options)}
          disabled={isLoading}
          className="flex-1"
          data-testid="apply-tidy-options"
        >
          Apply
        </Button>
      </div>
    </div>
  );
};
