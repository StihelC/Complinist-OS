// Lightweight skeleton component shown while the inventory panel loads
// This component has minimal dependencies to ensure fast initial load

import { Loader2 } from 'lucide-react';

export function InventoryPanelSkeleton() {
  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-48 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
            <div className="h-9 w-9 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Search bar skeleton */}
        <div className="h-10 w-full bg-muted animate-pulse rounded" />
      </div>

      {/* Tabs skeleton */}
      <div className="border-b p-2">
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          <div className="h-9 w-24 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-card p-8 rounded-xl shadow-lg">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Loading Inventory</h3>
            <p className="text-sm text-muted-foreground mt-1">Fetching device inventory...</p>
          </div>
        </div>
      </div>

      {/* Table skeleton rows */}
      <div className="absolute inset-x-0 bottom-0 top-48 px-4 pb-4 overflow-hidden opacity-30">
        <div className="bg-card rounded-lg border">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-b-0"
            >
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
