// Lightweight skeleton component shown while the topology canvas loads
// This component has minimal dependencies to ensure fast initial load

import { Loader2 } from 'lucide-react';

export function TopologyCanvasSkeleton() {
  return (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center relative">
      {/* Canvas background pattern simulation */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Loading indicator */}
      <div className="flex flex-col items-center gap-4 z-10 bg-white/80 backdrop-blur-sm p-8 rounded-xl shadow-lg">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">Loading Topology Canvas</h3>
          <p className="text-sm text-gray-500 mt-1">Preparing graph visualization...</p>
        </div>
      </div>

      {/* Skeleton toolbar on left */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>

      {/* Skeleton minimap in corner */}
      <div className="absolute right-4 bottom-4 w-32 h-24 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
