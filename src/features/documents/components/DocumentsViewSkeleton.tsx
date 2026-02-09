// Lightweight skeleton component shown while the documents view loads
// This component has minimal dependencies to ensure fast initial load

import { Loader2 } from 'lucide-react';

export function DocumentsViewSkeleton() {
  return (
    <div className="w-full h-full bg-background flex flex-col">
      {/* Header skeleton */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted animate-pulse rounded" />
            <div className="h-7 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-32 bg-muted animate-pulse rounded" />
            <div className="h-9 w-9 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Description skeleton */}
        <div className="h-4 w-96 bg-muted animate-pulse rounded" />
      </div>

      {/* Upload area skeleton */}
      <div className="p-4">
        <div className="border-2 border-dashed border-muted rounded-lg p-8 flex flex-col items-center gap-4">
          <div className="h-12 w-12 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-card p-8 rounded-xl shadow-lg">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Loading Documents</h3>
            <p className="text-sm text-muted-foreground mt-1">Fetching your document library...</p>
          </div>
        </div>
      </div>

      {/* Document list skeleton */}
      <div className="absolute inset-x-0 bottom-0 top-64 px-4 pb-4 overflow-hidden opacity-30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-muted animate-pulse rounded" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-3 w-20 bg-muted animate-pulse rounded mb-3" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                    <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
