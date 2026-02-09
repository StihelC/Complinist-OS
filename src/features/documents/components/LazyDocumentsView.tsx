// Lazy-loaded wrapper for DocumentsView component
// Reduces initial bundle size by loading documents module only when needed

import { lazy, Suspense } from 'react';
import { DocumentsViewSkeleton } from './DocumentsViewSkeleton';

// Lazy load the DocumentsView component
const DocumentsView = lazy(() =>
  import('./DocumentsView').then(module => ({ default: module.DocumentsView }))
);

export function LazyDocumentsView() {
  return (
    <Suspense fallback={<DocumentsViewSkeleton />}>
      <DocumentsView />
    </Suspense>
  );
}
