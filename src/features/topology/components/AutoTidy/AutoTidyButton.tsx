import { useState, useCallback, useEffect, useMemo } from 'react';
import { Wand2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { Spinner } from '@/components/ui/spinner';
import { LayoutPanel } from '../LayoutPanel';
import { TidyStatusIndicator, TidyResult as StatusTidyResult } from './TidyStatusIndicator';
import type { TidyOptions, TidyResult, EdgeRoutingType, SpacingTier } from '@/lib/topology/auto-tidy';
import type { LayoutOptions } from '@/lib/layout/layoutInterface';
import type { LayoutSettings } from '@/lib/utils/types';

export interface AutoTidyButtonProps {
  className?: string;
  showOptionsDropdown?: boolean;
}

// Convert LayoutPanel options to TidyOptions
const layoutOptionsToTidyOptions = (layoutOptions: LayoutOptions): Partial<TidyOptions> => ({
  layoutAlgorithm: layoutOptions.algorithm,
  elkAlgorithm: layoutOptions.elkAlgorithm,
  layoutDirection: layoutOptions.direction,
  horizontalSpacing: layoutOptions.horizontalSpacing,
  verticalSpacing: layoutOptions.verticalSpacing,
  nodeSpacing: layoutOptions.nodeSpacing,
  rankSpacing: layoutOptions.rankSpacing,
  boundaryPadding: layoutOptions.boundaryPadding,
  nestedBoundarySpacing: layoutOptions.nestedBoundarySpacing,
  spacingTier: (layoutOptions.spacingTier as SpacingTier) || 'comfortable',
  animate: layoutOptions.animate ?? true,
  animationDuration: layoutOptions.animationDuration ?? 300,
  autoResize: layoutOptions.autoResize ?? true,
  edgeOptimization: {
    edgeRoutingType: (layoutOptions.edgeRouting as EdgeRoutingType) || 'smart',
  },
});

// Convert stored LayoutSettings to TidyOptions for quick tidy
const layoutSettingsToTidyOptions = (settings: LayoutSettings): Partial<TidyOptions> => ({
  layoutAlgorithm: settings.algorithm,
  elkAlgorithm: settings.elkAlgorithm,
  layoutDirection: settings.direction,
  horizontalSpacing: settings.horizontalSpacing,
  verticalSpacing: settings.verticalSpacing,
  nodeSpacing: settings.nodeSpacing,
  rankSpacing: settings.rankSpacing,
  boundaryPadding: settings.boundaryPadding,
  nestedBoundarySpacing: settings.nestedBoundarySpacing,
  spacingTier: settings.spacingTier as SpacingTier,
  animate: settings.animate,
  animationDuration: settings.animationDuration,
  autoResize: settings.autoResize,
  edgeOptimization: {
    edgeRoutingType: settings.edgeRouting as EdgeRoutingType,
  },
});

// Default layout settings (fallback if store not initialized)
const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  algorithm: 'elkjs',
  elkAlgorithm: 'mrtree',
  direction: 'RIGHT',
  horizontalSpacing: 50,
  verticalSpacing: 50,
  nodeSpacing: 40,
  rankSpacing: 60,
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  edgeRouting: 'smart',
  spacingTier: 'comfortable',
  autoResize: true,
  animate: true,
  animationDuration: 300,
};

// Convert algorithm result to status result
const algorithmToStatusResult = (
  result: TidyResult | null,
  duration: number,
  nodesBefore: number
): StatusTidyResult | null => {
  if (!result) return null;
  return {
    success: true,
    nodesBefore,
    nodesAfter: result.stats.totalNodes,
    collisionsBefore: 0,
    collisionsResolved: result.stats.devicesRepositioned,
    qualityScore: Math.min(100, Math.round((result.stats.boundariesProcessed / Math.max(1, result.stats.totalNodes)) * 100 + 60)),
    duration,
    timestamp: Date.now(),
  };
};

export const AutoTidyButton = ({ className, showOptionsDropdown = true }: AutoTidyButtonProps) => {
  const [showOptions, setShowOptions] = useState(false);
  const [lastResult, setLastResult] = useState<StatusTidyResult | null>(null);

  const nodes = useFlowStore((state) => state.nodes);
  const isTidying = useFlowStore((state) => state.isTidying);
  const tidyDiagram = useFlowStore((state) => state.tidyDiagram);
  const globalSettings = useFlowStore((state) => state.globalSettings);

  // Get stored layout settings or use defaults
  const storedLayoutSettings = useMemo(() => {
    return globalSettings.layoutSettings || DEFAULT_LAYOUT_SETTINGS;
  }, [globalSettings.layoutSettings]);

  // Count device nodes (not boundaries) for determining if tidy is available
  const deviceCount = nodes.filter((n) => n.type === 'device').length;
  const isDisabled = deviceCount === 0 || isTidying;

  // Count resolved for badge display
  const resolvedCount = lastResult?.collisionsResolved || 0;

  const handleTidy = useCallback(async (tidyOptions?: Partial<TidyOptions>) => {
    // Use stored settings if no options provided
    const optionsToUse = tidyOptions || layoutSettingsToTidyOptions(storedLayoutSettings);
    if (isDisabled) return;

    setLastResult(null);

    const startTime = performance.now();
    const nodesBefore = deviceCount;

    try {
      const result = await tidyDiagram(optionsToUse);
      const endTime = performance.now();

      const statusResult = algorithmToStatusResult(result, endTime - startTime, nodesBefore);
      setLastResult(statusResult);

      // Clear the result after 5 seconds
      setTimeout(() => {
        setLastResult(null);
      }, 5000);
    } catch (error) {
      console.error('Auto-tidy failed:', error);
      setLastResult({
        success: false,
        nodesBefore: deviceCount,
        nodesAfter: deviceCount,
        collisionsBefore: 0,
        collisionsResolved: 0,
        qualityScore: 0,
        duration: 0,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [isDisabled, tidyDiagram, deviceCount, storedLayoutSettings]);

  const handleQuickTidy = useCallback(() => {
    // Use stored layout settings (no options = use stored settings)
    handleTidy();
  }, [handleTidy]);

  const handleLayoutApply = useCallback((layoutOptions: LayoutOptions) => {
    const tidyOptions = layoutOptionsToTidyOptions(layoutOptions);
    // Keep panel open - user can close with X button
    handleTidy(tidyOptions);
  }, [handleTidy]);

  // Handle keyboard shortcut (Ctrl/Cmd + Shift + T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (!isDisabled) {
          handleQuickTidy();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDisabled, handleQuickTidy]);

  return (
    <div className={cn('relative flex items-center', className)}>
      {/* Main Tidy Button */}
      <button
        className={cn(
          'topology-toolbar-button relative',
          isTidying && 'cursor-wait',
          showOptionsDropdown && 'rounded-r-none border-r-0'
        )}
        onClick={handleQuickTidy}
        disabled={isDisabled}
        aria-label="Auto-tidy diagram layout"
        title={isDisabled ? 'Add devices to the diagram to enable auto-tidy' : 'Auto-tidy diagram (Ctrl+Shift+T)'}
        data-testid="auto-tidy-button"
      >
        {isTidying ? (
          <Spinner size="sm" variant="primary" />
        ) : (
          <Wand2 className="w-4 h-4" />
        )}

        {/* Resolved count badge */}
        {resolvedCount > 0 && !isTidying && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-green-500 rounded-full">
            {resolvedCount > 9 ? '9+' : resolvedCount}
          </span>
        )}
      </button>

      {/* Options Button */}
      {showOptionsDropdown && (
        <button
          className={cn(
            'topology-toolbar-button rounded-l-none w-6 min-w-[24px]',
            showOptions && 'active'
          )}
          onClick={() => setShowOptions(!showOptions)}
          disabled={isTidying}
          aria-label="Layout options"
          title="Layout options"
          data-testid="auto-tidy-options-button"
        >
          <Settings2 className="w-3 h-3" />
        </button>
      )}

      {/* Layout Panel */}
      <LayoutPanel
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
        onApply={handleLayoutApply}
        isLoading={isTidying}
        className="top-full left-0 mt-2"
      />

      {/* Status Indicator (shown below the button when result is available) */}
      {lastResult && (
        <div className="absolute top-full left-0 mt-2 z-50">
          <TidyStatusIndicator result={lastResult} />
        </div>
      )}
    </div>
  );
};
