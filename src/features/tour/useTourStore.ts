import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TourState, TOUR_STORAGE_KEY, TourStorageData } from './types';
import { TOUR_STEPS } from './tourSteps';

/**
 * Load tour state from localStorage
 */
const loadTourState = (): TourStorageData | null => {
  try {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load tour state:', error);
  }
  return null;
};

/**
 * Save tour state to localStorage
 */
const saveTourState = (data: TourStorageData): void => {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save tour state:', error);
  }
};

/**
 * Zustand store for managing the guided tour state
 */
export const useTourStore = create<TourState>()(
  devtools(
    (set, get) => {
      // Initialize with stored state
      const storedState = loadTourState();

      return {
        // Initial state
        isActive: false,
        currentStepIndex: 0,
        completedSteps: storedState?.completedSteps || [],
        hasCompletedTour: storedState?.hasCompletedTour || false,
        hasSkippedTour: storedState?.hasSkippedTour || false,

        // Actions
        startTour: () => {
          set({
            isActive: true,
            currentStepIndex: 0,
          });
        },

        nextStep: () => {
          const { currentStepIndex, completedSteps } = get();
          const currentStep = TOUR_STEPS[currentStepIndex];
          const newCompletedSteps = currentStep && !completedSteps.includes(currentStep.id)
            ? [...completedSteps, currentStep.id]
            : completedSteps;

          if (currentStepIndex < TOUR_STEPS.length - 1) {
            set({
              currentStepIndex: currentStepIndex + 1,
              completedSteps: newCompletedSteps,
            });
            // Save progress
            saveTourState({
              hasCompletedTour: get().hasCompletedTour,
              hasSkippedTour: get().hasSkippedTour,
              completedSteps: newCompletedSteps,
            });
          } else {
            // Last step - complete the tour
            get().completeTour();
          }
        },

        previousStep: () => {
          const { currentStepIndex } = get();
          if (currentStepIndex > 0) {
            set({ currentStepIndex: currentStepIndex - 1 });
          }
        },

        skipTour: () => {
          set({
            isActive: false,
            hasSkippedTour: true,
            currentStepIndex: 0,
          });
          saveTourState({
            hasCompletedTour: get().hasCompletedTour,
            hasSkippedTour: true,
            completedSteps: get().completedSteps,
          });
        },

        completeTour: () => {
          const currentStep = TOUR_STEPS[get().currentStepIndex];
          const completedSteps = currentStep && !get().completedSteps.includes(currentStep.id)
            ? [...get().completedSteps, currentStep.id]
            : get().completedSteps;

          set({
            isActive: false,
            hasCompletedTour: true,
            completedSteps,
            currentStepIndex: 0,
          });
          saveTourState({
            hasCompletedTour: true,
            hasSkippedTour: get().hasSkippedTour,
            completedSteps,
          });
        },

        resetTour: () => {
          set({
            isActive: false,
            currentStepIndex: 0,
            completedSteps: [],
            hasCompletedTour: false,
            hasSkippedTour: false,
          });
          localStorage.removeItem(TOUR_STORAGE_KEY);
        },

        goToStep: (stepIndex: number) => {
          if (stepIndex >= 0 && stepIndex < TOUR_STEPS.length) {
            set({ currentStepIndex: stepIndex });
          }
        },

        // Computed
        getCurrentStep: () => {
          const { currentStepIndex } = get();
          return TOUR_STEPS[currentStepIndex] || null;
        },

        getTotalSteps: () => TOUR_STEPS.length,

        getProgress: () => {
          const { currentStepIndex } = get();
          return ((currentStepIndex + 1) / TOUR_STEPS.length) * 100;
        },

        shouldShowTour: () => {
          const { hasCompletedTour, hasSkippedTour } = get();
          return !hasCompletedTour && !hasSkippedTour;
        },
      };
    },
    { name: 'Tour Store' }
  )
);
