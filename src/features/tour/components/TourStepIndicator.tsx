import React from 'react';
import { cn } from '@/lib/utils/utils';

interface TourStepIndicatorProps {
  totalSteps: number;
  currentStep: number;
  className?: string;
}

/**
 * Visual indicator showing tour progress with step dots
 */
export const TourStepIndicator: React.FC<TourStepIndicatorProps> = ({
  totalSteps,
  currentStep,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index}
          className={cn(
            'w-2 h-2 rounded-full transition-all duration-300',
            index === currentStep
              ? 'w-6 bg-primary'
              : index < currentStep
              ? 'bg-primary/60'
              : 'bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
};
