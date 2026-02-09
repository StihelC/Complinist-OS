// Lightweight skeleton component shown while the AI chat loads
// This component has minimal dependencies to ensure fast initial load

import { Loader2 } from 'lucide-react';

export function UnifiedAIChatSkeleton() {
  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-muted animate-pulse rounded" />
            <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Scope selector skeleton */}
        <div className="flex gap-2 mt-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 w-28 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
      </div>

      {/* Chat messages area skeleton */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="space-y-4">
          {/* Sample message skeletons */}
          <div className="flex justify-end">
            <div className="h-16 w-3/4 bg-primary/10 animate-pulse rounded-lg" />
          </div>
          <div className="flex justify-start">
            <div className="h-32 w-4/5 bg-muted animate-pulse rounded-lg" />
          </div>
          <div className="flex justify-end">
            <div className="h-12 w-2/3 bg-primary/10 animate-pulse rounded-lg" />
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 bg-card p-8 rounded-xl shadow-lg">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Loading AI Assistant</h3>
            <p className="text-sm text-muted-foreground mt-1">Initializing compliance advisor...</p>
          </div>
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-muted animate-pulse rounded-lg" />
          <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    </div>
  );
}
