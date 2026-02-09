// Loading Screen Component
// Shows a full-screen loading overlay with progress bar during app initialization

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LoadingPhase {
  name: string;
  completed: boolean;
}

interface LoadingScreenProps {
  phases: LoadingPhase[];
  currentPhase: string;
  progress: number;
  isComplete: boolean;
}

export function LoadingScreen({ phases, currentPhase, progress, isComplete }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Small delay before hiding to allow smooth transition
    if (isComplete) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center transition-opacity duration-300">
      <div className="flex flex-col items-center gap-6 w-full max-w-md px-8">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CompliNist</h1>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-foreground">{currentPhase}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Phase List (optional, for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="w-full space-y-1 text-xs text-muted-foreground">
            {phases.map((phase, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    phase.completed ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span>{phase.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


