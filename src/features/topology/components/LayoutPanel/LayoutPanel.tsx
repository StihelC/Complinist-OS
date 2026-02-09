/**
 * Layout Panel - Real-time layout configuration with sliders
 *
 * Provides an interactive UI for adjusting layout settings with real-time preview.
 * Settings are persisted to globalSettings and used by auto-tidy.
 */

import { useCallback, useEffect } from 'react';
import { X, Layout, RotateCcw, Zap, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadixSelect, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/radix-select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils/utils';
import { useFlowStore } from '@/core/stores/useFlowStore';
import {
  LayoutAlgorithm,
  LayoutDirection,
  LayoutOptions,
  ElkAlgorithmVariant,
  EdgeRoutingType,
  SpacingTier,
  ElkAlignment,
  ElkPortConstraints,
  ElkHierarchyHandling,
  MrTreeEdgeRoutingMode,
  MrTreeSearchOrder,
} from '@/lib/layout/layoutInterface';
import type { LayoutSettings } from '@/lib/utils/types';

export interface LayoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (options: LayoutOptions) => void;
  isLoading?: boolean;
  className?: string;
}

const ALGORITHM_OPTIONS: { value: LayoutAlgorithm; label: string }[] = [
  { value: 'elkjs', label: 'ELKjs' },
  { value: 'dagre', label: 'Dagre' },
];

const DIRECTION_OPTIONS: { value: LayoutDirection; label: string }[] = [
  { value: 'RIGHT', label: 'Right' },
  { value: 'DOWN', label: 'Down' },
  { value: 'LEFT', label: 'Left' },
  { value: 'UP', label: 'Up' },
];

const ELK_ALGORITHM_OPTIONS: { value: ElkAlgorithmVariant; label: string }[] = [
  { value: 'mrtree', label: 'Mr. Tree' },
  { value: 'layered', label: 'Layered' },
];

const EDGE_ROUTING_OPTIONS: { value: EdgeRoutingType; label: string }[] = [
  { value: 'smart', label: 'Smart' },
  { value: 'smartSmoothStep', label: 'Smart Smooth' },
  { value: 'smoothstep', label: 'Smooth Step' },
  { value: 'step', label: 'Step' },
  { value: 'default', label: 'Bezier' },
  { value: 'straight', label: 'Straight' },
];

const SPACING_TIER_OPTIONS: { value: SpacingTier; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

const ELK_ALIGNMENT_OPTIONS: { value: ElkAlignment; label: string }[] = [
  { value: 'AUTOMATIC', label: 'Automatic' },
  { value: 'BEGIN', label: 'Begin' },
  { value: 'CENTER', label: 'Center' },
  { value: 'END', label: 'End' },
];

const ELK_PORT_CONSTRAINTS_OPTIONS: { value: ElkPortConstraints; label: string }[] = [
  { value: 'UNDEFINED', label: 'Undefined' },
  { value: 'FREE', label: 'Free' },
  { value: 'FIXED_SIDE', label: 'Fixed Side' },
  { value: 'FIXED_ORDER', label: 'Fixed Order' },
  { value: 'FIXED_POS', label: 'Fixed Position' },
];

const ELK_HIERARCHY_OPTIONS: { value: ElkHierarchyHandling; label: string }[] = [
  { value: 'INHERIT', label: 'Inherit' },
  { value: 'INCLUDE_CHILDREN', label: 'Include Children' },
  { value: 'SEPARATE_CHILDREN', label: 'Separate Children' },
];

const MRTREE_EDGE_ROUTING_OPTIONS: { value: MrTreeEdgeRoutingMode; label: string }[] = [
  { value: 'AVOID_OVERLAP', label: 'Avoid Overlap' },
  { value: 'BEND_POINTS', label: 'Bend Points' },
];

const MRTREE_SEARCH_ORDER_OPTIONS: { value: MrTreeSearchOrder; label: string }[] = [
  { value: 'DFS', label: 'Depth First (DFS)' },
  { value: 'BFS', label: 'Breadth First (BFS)' },
];

// Default layout settings for reset
const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  algorithm: 'elkjs',
  elkAlgorithm: 'mrtree',
  direction: 'DOWN',
  horizontalSpacing: 50,
  verticalSpacing: 50,
  nodeSpacing: 50,
  rankSpacing: 60,
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  edgeRouting: 'smart',
  spacingTier: 'comfortable',
  autoResize: true,
  animate: true,
  animationDuration: 300,
  // ELK Graph options
  elkAlignment: 'AUTOMATIC',
  elkEdgeSpacing: 10,
  elkRandomSeed: 1,
  // ELK Node options
  elkPortConstraints: 'UNDEFINED',
  elkHierarchyHandling: 'INHERIT',
  // ELK Sub-graph options
  elkSeparateComponents: false,
  elkCompaction: false,
  elkComponentSpacing: 20,
  // MrTree options
  mrTreeEdgeRoutingMode: 'AVOID_OVERLAP',
  mrTreeEdgeEndTextureLength: 7,
  mrTreeSearchOrder: 'DFS',
};

// Convert stored layout settings to LayoutOptions for applying
const layoutSettingsToOptions = (settings: LayoutSettings): LayoutOptions => ({
  algorithm: settings.algorithm,
  elkAlgorithm: settings.elkAlgorithm,
  direction: settings.direction,
  // Use nodeSpacing for both horizontal spacing and node spacing for consistency
  horizontalSpacing: settings.nodeSpacing,
  verticalSpacing: settings.verticalSpacing,
  nodeSpacing: settings.nodeSpacing,
  rankSpacing: settings.rankSpacing,
  boundaryPadding: settings.boundaryPadding,
  nestedBoundarySpacing: settings.nestedBoundarySpacing,
  edgeRouting: settings.edgeRouting,
  spacingTier: settings.spacingTier,
  animate: settings.animate,
  animationDuration: settings.animationDuration,
  autoResize: settings.autoResize,
  // ELK Graph options
  elkAlignment: settings.elkAlignment,
  elkEdgeSpacing: settings.elkEdgeSpacing,
  elkRandomSeed: settings.elkRandomSeed,
  // ELK Node options
  elkPortConstraints: settings.elkPortConstraints,
  elkHierarchyHandling: settings.elkHierarchyHandling,
  // ELK Sub-graph options
  elkSeparateComponents: settings.elkSeparateComponents,
  elkCompaction: settings.elkCompaction,
  elkComponentSpacing: settings.elkComponentSpacing,
  // MrTree options
  mrTreeEdgeRoutingMode: settings.mrTreeEdgeRoutingMode,
  mrTreeEdgeEndTextureLength: settings.mrTreeEdgeEndTextureLength,
  mrTreeSearchOrder: settings.mrTreeSearchOrder,
});

export const LayoutPanel = ({
  isOpen,
  onClose,
  onApply,
  isLoading = false,
  className,
}: LayoutPanelProps) => {
  // Get layout settings from global settings store
  const globalSettings = useFlowStore((state) => state.globalSettings);
  const setGlobalSettings = useFlowStore((state) => state.setGlobalSettings);

  // Use stored settings or defaults
  const settings = globalSettings.layoutSettings || DEFAULT_LAYOUT_SETTINGS;

  // Live update mode - apply layout as sliders change
  const liveUpdate = settings.animate === false; // Live updates work better without animation

  // Apply layout with given settings
  const applyLayout = useCallback((layoutSettings: LayoutSettings) => {
    if (!isLoading) {
      onApply(layoutSettingsToOptions(layoutSettings));
    }
  }, [isLoading, onApply]);

  // Update a single setting and persist to store (no auto-apply during drag)
  const updateSetting = useCallback(
    <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) => {
      const newLayoutSettings = { ...settings, [key]: value };
      setGlobalSettings({ layoutSettings: newLayoutSettings });
    },
    [settings, setGlobalSettings]
  );

  // Apply layout when slider drag ends (onValueCommit)
  const handleSliderCommit = useCallback(() => {
    if (liveUpdate && !isLoading) {
      applyLayout(settings);
    }
  }, [liveUpdate, isLoading, settings, applyLayout]);

  // Apply layout immediately for dropdown changes (they don't have drag state)
  const updateSettingWithApply = useCallback(
    <K extends keyof LayoutSettings>(key: K, value: LayoutSettings[K]) => {
      const newLayoutSettings = { ...settings, [key]: value };
      setGlobalSettings({ layoutSettings: newLayoutSettings });

      if (liveUpdate && !isLoading) {
        // Small delay to let the state update propagate
        setTimeout(() => {
          applyLayout(newLayoutSettings);
        }, 50);
      }
    },
    [settings, setGlobalSettings, liveUpdate, isLoading, applyLayout]
  );

  // Reset to defaults
  const handleReset = useCallback(() => {
    setGlobalSettings({ layoutSettings: DEFAULT_LAYOUT_SETTINGS });
    if (liveUpdate) {
      applyLayout(DEFAULT_LAYOUT_SETTINGS);
    }
  }, [setGlobalSettings, liveUpdate, applyLayout]);

  // Apply layout with current settings
  const handleApply = useCallback(() => {
    applyLayout(settings);
  }, [settings, applyLayout]);

  // Toggle live update mode
  const toggleLiveUpdate = useCallback(() => {
    // Toggle animation off = live update on
    updateSetting('animate', !settings.animate);
  }, [settings.animate, updateSetting]);

  // Keyboard shortcut for apply (Enter key)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, handleApply]);

  if (!isOpen) return null;

  // Prevent clicks/drags from bubbling to the canvas and stealing focus
  const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        'absolute bg-background border rounded-lg shadow-lg z-50',
        'w-96 max-h-[80vh] overflow-y-auto',
        'nodrag nopan nowheel', // Prevent ReactFlow from intercepting events
        className
      )}
      data-testid="layout-panel"
      onMouseDown={stopPropagation}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layout className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Layout Settings</span>
          {liveUpdate && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
              <Zap className="w-2.5 h-2.5" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLiveUpdate}
            className={cn(
              "p-1 transition-colors",
              liveUpdate
                ? "text-green-600 hover:text-green-700"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={liveUpdate ? "Live updates ON - changes apply instantly" : "Live updates OFF - click Apply to see changes"}
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            aria-label="Close layout panel"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Algorithm Section */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Algorithm
          </Label>

          <div className="space-y-2">
            <RadixSelect
              value={settings.algorithm}
              onValueChange={(value) => updateSettingWithApply('algorithm', value as LayoutAlgorithm)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALGORITHM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>

            {settings.algorithm === 'elkjs' && (
              <RadixSelect
                value={settings.elkAlgorithm}
                onValueChange={(value) => updateSettingWithApply('elkAlgorithm', value as ElkAlgorithmVariant)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELK_ALGORITHM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>
            )}
          </div>
        </div>

        {/* Direction & Density */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <RadixSelect
              value={settings.direction}
              onValueChange={(value) => updateSettingWithApply('direction', value as LayoutDirection)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Density</Label>
            <RadixSelect
              value={settings.spacingTier}
              onValueChange={(value) => updateSettingWithApply('spacingTier', value as SpacingTier)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACING_TIER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>
          </div>
        </div>

        {/* ELK Graph Settings (only when ELK is selected) */}
        {settings.algorithm === 'elkjs' && (
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Graph
            </Label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Alignment</Label>
              <RadixSelect
                value={settings.elkAlignment || 'AUTOMATIC'}
                onValueChange={(value) => updateSettingWithApply('elkAlignment', value as ElkAlignment)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELK_ALIGNMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Random Seed</Label>
              <input
                type="number"
                value={settings.elkRandomSeed ?? 1}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  updateSettingWithApply('elkRandomSeed', value);
                }}
                disabled={isLoading}
                className="h-8 w-full px-2 text-sm border rounded-md bg-background"
                min={1}
              />
              <p className="text-[10px] text-muted-foreground/70">Change to get different layout arrangements</p>
            </div>

            {/* Edge Spacing */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Edge Spacing</span>
                <span className="text-xs font-mono text-muted-foreground">{settings.elkEdgeSpacing ?? 10}</span>
              </div>
              <Slider
                value={[settings.elkEdgeSpacing ?? 10]}
                onValueChange={([v]) => updateSetting('elkEdgeSpacing', v)}
                onValueCommit={handleSliderCommit}
                min={0}
                max={100}
                step={1}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* ELK Node Settings */}
        {settings.algorithm === 'elkjs' && (
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Node
            </Label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Port Constraints</Label>
              <RadixSelect
                value={settings.elkPortConstraints || 'UNDEFINED'}
                onValueChange={(value) => updateSettingWithApply('elkPortConstraints', value as ElkPortConstraints)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELK_PORT_CONSTRAINTS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hierarchy Handling</Label>
              <RadixSelect
                value={settings.elkHierarchyHandling || 'INHERIT'}
                onValueChange={(value) => updateSettingWithApply('elkHierarchyHandling', value as ElkHierarchyHandling)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELK_HIERARCHY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>
            </div>
          </div>
        )}

        {/* ELK Sub-graph Settings */}
        {/* Advanced ELK Options - collapsed by default */}
        {settings.algorithm === 'elkjs' && (
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Advanced
            </Label>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Compaction</span>
                <p className="text-[10px] text-muted-foreground/70">Reduce whitespace</p>
              </div>
              <Switch
                checked={settings.elkCompaction || false}
                onCheckedChange={(checked) => updateSettingWithApply('elkCompaction', checked)}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground">Separate Components</span>
                <p className="text-[10px] text-muted-foreground/70">Layout disconnected groups apart</p>
              </div>
              <Switch
                checked={settings.elkSeparateComponents || false}
                onCheckedChange={(checked) => updateSettingWithApply('elkSeparateComponents', checked)}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* MrTree Specific Options */}
        {settings.algorithm === 'elkjs' && settings.elkAlgorithm === 'mrtree' && (
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mr. Tree Options
            </Label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Edge Routing Mode</Label>
              <RadixSelect
                value={settings.mrTreeEdgeRoutingMode || 'AVOID_OVERLAP'}
                onValueChange={(value) => updateSettingWithApply('mrTreeEdgeRoutingMode', value as MrTreeEdgeRoutingMode)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MRTREE_EDGE_ROUTING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Search Order</Label>
              <RadixSelect
                value={settings.mrTreeSearchOrder || 'DFS'}
                onValueChange={(value) => updateSettingWithApply('mrTreeSearchOrder', value as MrTreeSearchOrder)}
                disabled={isLoading}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MRTREE_SEARCH_ORDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </RadixSelect>
            </div>

            {/* Edge End Texture Length */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Edge End Length</span>
                <span className="text-xs font-mono text-muted-foreground">{settings.mrTreeEdgeEndTextureLength ?? 7}</span>
              </div>
              <Slider
                value={[settings.mrTreeEdgeEndTextureLength ?? 7]}
                onValueChange={([v]) => updateSetting('mrTreeEdgeEndTextureLength', v)}
                onValueCommit={handleSliderCommit}
                min={0}
                max={50}
                step={1}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Spacing Sliders */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Spacing
          </Label>

          {/* Node Spacing */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Node Spacing</span>
              <span className="text-xs font-mono text-muted-foreground">{settings.nodeSpacing}px</span>
            </div>
            <Slider
              value={[settings.nodeSpacing]}
              onValueChange={([v]) => updateSetting('nodeSpacing', v)}
              onValueCommit={handleSliderCommit}
              min={10}
              max={500}
              step={5}
              disabled={isLoading}
            />
          </div>

          {/* Layer Spacing - only for Layered algorithm */}
          {settings.elkAlgorithm === 'layered' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Layer Spacing</span>
                <span className="text-xs font-mono text-muted-foreground">{settings.verticalSpacing}px</span>
              </div>
              <Slider
                value={[settings.verticalSpacing]}
                onValueChange={([v]) => updateSetting('verticalSpacing', v)}
                onValueCommit={handleSliderCommit}
                min={10}
                max={500}
                step={5}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Boundary Settings */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Boundaries
          </Label>

          {/* Boundary Padding */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-muted-foreground">Padding</span>
                <p className="text-[10px] text-muted-foreground/70">Space inside boundary edges</p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{settings.boundaryPadding}px</span>
            </div>
            <Slider
              value={[settings.boundaryPadding]}
              onValueChange={([v]) => updateSetting('boundaryPadding', v)}
              onValueCommit={handleSliderCommit}
              min={10}
              max={700}
              step={5}
              disabled={isLoading}
            />
          </div>

          {/* Nested Boundary Spacing */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-muted-foreground">Nested Extra</span>
                <p className="text-[10px] text-muted-foreground/70">Extra space for nested boundaries</p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{settings.nestedBoundarySpacing}px</span>
            </div>
            <Slider
              value={[settings.nestedBoundarySpacing]}
              onValueChange={([v]) => updateSetting('nestedBoundarySpacing', v)}
              onValueCommit={handleSliderCommit}
              min={0}
              max={200}
              step={5}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Edge Routing */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Edge Routing
          </Label>
          <RadixSelect
            value={settings.edgeRouting}
            onValueChange={(value) => updateSettingWithApply('edgeRouting', value as EdgeRoutingType)}
            disabled={isLoading}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDGE_ROUTING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </RadixSelect>
        </div>

        {/* Animation Settings */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Updates
          </Label>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Live Preview</span>
              <p className="text-[10px] text-muted-foreground/70">
                {liveUpdate ? "Auto-apply on change" : "Manual apply only"}
              </p>
            </div>
            <Switch
              checked={liveUpdate}
              onCheckedChange={() => toggleLiveUpdate()}
              disabled={isLoading}
            />
          </div>

          {!liveUpdate && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Animation Duration</span>
                <span className="text-xs font-mono text-muted-foreground">{settings.animationDuration}ms</span>
              </div>
              <Slider
                value={[settings.animationDuration]}
                onValueChange={([v]) => updateSetting('animationDuration', v)}
                min={100}
                max={1000}
                step={50}
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Behavior */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Behavior
          </Label>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Auto-resize Boundaries</span>
            <Switch
              checked={settings.autoResize}
              onCheckedChange={(checked) => updateSetting('autoResize', checked)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Debug Mode */}
        <div className="space-y-3 border-t pt-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Bug className="w-3 h-3" />
            Debug
          </Label>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">Layout Debug Mode</span>
              <p className="text-[10px] text-muted-foreground/70">
                Show DevTools & enable console logging
              </p>
            </div>
            <Switch
              checked={globalSettings.layoutDebugMode || false}
              onCheckedChange={(checked) => setGlobalSettings({ layoutDebugMode: checked })}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Apply Button */}
        <Button
          onClick={handleApply}
          disabled={isLoading}
          className={cn("w-full", liveUpdate && "opacity-60")}
          size="sm"
          variant={liveUpdate ? "outline" : "default"}
          data-testid="layout-apply-button"
        >
          {isLoading ? 'Applying...' : liveUpdate ? 'Re-apply Layout' : 'Apply Layout'}
        </Button>

        {liveUpdate && (
          <p className="text-[10px] text-center text-muted-foreground">
            Layout applies when you release sliders
          </p>
        )}
      </div>
    </div>
  );
};

export default LayoutPanel;
