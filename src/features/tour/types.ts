/**
 * Type definitions for the guided tour feature
 */

export type TourStepId = 'welcome' | 'create-topology' | 'select-baseline' | 'ai-assistant';

export interface TourStep {
  id: TourStepId;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for highlighting element
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface TourState {
  // State
  isActive: boolean;
  currentStepIndex: number;
  completedSteps: TourStepId[];
  hasCompletedTour: boolean;
  hasSkippedTour: boolean;

  // Actions
  startTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
  goToStep: (stepIndex: number) => void;

  // Computed
  getCurrentStep: () => TourStep | null;
  getTotalSteps: () => number;
  getProgress: () => number;
  shouldShowTour: () => boolean;
}

export const TOUR_STORAGE_KEY = 'complinist-tour-state';

export interface TourStorageData {
  hasCompletedTour: boolean;
  hasSkippedTour: boolean;
  completedSteps: TourStepId[];
}
