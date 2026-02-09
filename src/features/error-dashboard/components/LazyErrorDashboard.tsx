/**
 * Lazy Error Dashboard
 *
 * Lazy-loaded wrapper for the Error Dashboard component.
 */

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ErrorDashboard = lazy(() =>
  import('./ErrorDashboard').then((m) => ({ default: m.ErrorDashboard }))
);

function LoadingFallback() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-gray-500">Loading Error Dashboard...</span>
      </div>
    </div>
  );
}

export function LazyErrorDashboard() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ErrorDashboard />
    </Suspense>
  );
}
