// Lightweight skeleton component shown while the control narrative editor loads
// This component has minimal dependencies to ensure fast initial load

import { Loader2 } from 'lucide-react';

export function ControlNarrativeEditorSkeleton() {
  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-56 bg-muted animate-pulse rounded" />
            <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Tabs and search skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-muted animate-pulse rounded" />
            <div className="h-9 w-28 bg-muted animate-pulse rounded" />
            <div className="h-9 w-28 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-9 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-card p-8 rounded-xl shadow-lg">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Loading Control Narratives</h3>
            <p className="text-sm text-muted-foreground mt-1">Fetching security control data...</p>
          </div>
        </div>
      </div>

      {/* Control families skeleton */}
      <div className="absolute inset-x-0 bottom-0 top-32 px-4 pb-4 overflow-hidden opacity-30">
        <div className="space-y-4">
          {['Access Control (AC)', 'Audit (AU)', 'Configuration (CM)'].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg">
              {/* Family header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-40 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
              </div>
              {/* Control items */}
              <div className="divide-y">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="p-4 flex items-start gap-4">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-muted animate-pulse rounded mb-2" />
                      <div className="h-20 w-full bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
