// Lazy-loaded wrapper for UnifiedAIChat component
// Reduces initial bundle size by loading AI assistant module only when needed

import { lazy, Suspense } from 'react';
import { UnifiedAIChatSkeleton } from './UnifiedAIChatSkeleton';

// Lazy load the UnifiedAIChat component
const UnifiedAIChat = lazy(() =>
  import('./UnifiedAIChat').then(module => ({ default: module.UnifiedAIChat }))
);

export function LazyUnifiedAIChat() {
  return (
    <Suspense fallback={<UnifiedAIChatSkeleton />}>
      <UnifiedAIChat />
    </Suspense>
  );
}
