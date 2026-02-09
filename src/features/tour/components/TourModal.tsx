import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TourStepIndicator } from './TourStepIndicator';
import { useTourStore } from '../useTourStore';
import { Map, Shield, Bot, X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

/**
 * Get the appropriate icon for each tour step
 */
const getStepIcon = (stepId: string) => {
  switch (stepId) {
    case 'welcome':
      return <Sparkles className="w-12 h-12 text-primary" />;
    case 'create-topology':
      return <Map className="w-12 h-12 text-blue-500" />;
    case 'select-baseline':
      return <Shield className="w-12 h-12 text-green-500" />;
    case 'ai-assistant':
      return <Bot className="w-12 h-12 text-purple-500" />;
    default:
      return <Sparkles className="w-12 h-12 text-primary" />;
  }
};

interface TourModalProps {
  onClose?: () => void;
}

/**
 * Main tour modal component that displays the guided tour steps
 */
export const TourModal: React.FC<TourModalProps> = ({ onClose }) => {
  const {
    isActive,
    currentStepIndex,
    getCurrentStep,
    getTotalSteps,
    nextStep,
    previousStep,
    skipTour,
    completeTour,
  } = useTourStore();

  const currentStep = getCurrentStep();
  const totalSteps = getTotalSteps();
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  if (!isActive || !currentStep) {
    return null;
  }

  const handleSkip = () => {
    skipTour();
    onClose?.();
  };

  const handleComplete = () => {
    completeTour();
    onClose?.();
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      nextStep();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleSkip}
      />

      {/* Modal Card */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-2xl animate-slide-in-from-bottom">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        <CardHeader className="text-center pb-2">
          {/* Step Icon */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-muted rounded-full">
              {getStepIcon(currentStep.id)}
            </div>
          </div>

          <CardTitle className="text-xl">{currentStep.title}</CardTitle>
          <CardDescription className="text-base mt-2">
            {currentStep.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex justify-center">
            <TourStepIndicator
              totalSteps={totalSteps}
              currentStep={currentStepIndex}
            />
          </div>

          {/* Step Counter */}
          <p className="text-center text-sm text-muted-foreground">
            Step {currentStepIndex + 1} of {totalSteps}
          </p>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3">
            {/* Skip / Previous */}
            {isFirstStep ? (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip Tour
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={previousStep}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}

            {/* Next / Complete */}
            <Button onClick={handleNext} className="min-w-[120px]">
              {isLastStep ? (
                <>
                  Get Started
                  <Sparkles className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TourModal;
