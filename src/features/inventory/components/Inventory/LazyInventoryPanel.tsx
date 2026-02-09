// Lazy-loaded wrapper for InventoryPanel component
// Reduces initial bundle size by loading inventory module only when needed

import { lazy, Suspense } from 'react';
import { InventoryPanelSkeleton } from './InventoryPanelSkeleton';

// Lazy load the InventoryPanel component
const InventoryPanel = lazy(() =>
  import('./InventoryPanel').then(module => ({ default: module.InventoryPanel }))
);

interface LazyInventoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export function LazyInventoryPanel(props: LazyInventoryPanelProps) {
  return (
    <Suspense fallback={<InventoryPanelSkeleton />}>
      <InventoryPanel {...props} />
    </Suspense>
  );
}
