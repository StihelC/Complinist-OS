// Lightweight skeleton component shown while the SSP wizard loads
// This component has minimal dependencies to ensure fast initial load

import { Loader2 } from 'lucide-react';

export function SSPWizardSkeleton() {
  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="border-b p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2" />
      </div>

      {/* Form skeleton */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Section cards */}
          {['System Information', 'Security Controls', 'Topology'].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j}>
                    <div className="h-4 w-32 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-10 w-full bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 bg-card p-8 rounded-xl shadow-lg">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Loading SSP Wizard</h3>
            <p className="text-sm text-muted-foreground mt-1">Preparing security plan forms...</p>
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="border-t p-4 flex justify-end gap-2">
        <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
