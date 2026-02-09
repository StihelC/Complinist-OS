export { AutoTidyButton } from './AutoTidyButton';
export type { AutoTidyButtonProps } from './AutoTidyButton';

// Re-export LayoutPanel for convenience
export { LayoutPanel } from '../LayoutPanel';
export type { LayoutPanelProps } from '../LayoutPanel';

// Status indicator (still used)
export { TidyStatusIndicator, TidyStatusBadge } from './TidyStatusIndicator';
export type {
  TidyResult,
  TidyStatus,
  TidyStatusIndicatorProps,
  TidyStatusBadgeProps,
} from './TidyStatusIndicator';

// Legacy exports for backwards compatibility (deprecated)
// These components are replaced by LayoutPanel but kept for existing code
export { TidyOptionsPanel, DEFAULT_TIDY_OPTIONS, SPACING_CONFIGS, toLibraryOptions } from './TidyOptionsPanel';
export type { TidyOptions, TidyOptionsPanelProps, SpacingTier } from './TidyOptionsPanel';

export { TidyPreviewModal } from './TidyPreviewModal';
export type { TidyPreviewModalProps } from './TidyPreviewModal';
