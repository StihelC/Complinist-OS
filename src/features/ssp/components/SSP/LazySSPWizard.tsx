// Lazy-loaded wrapper for SSPWizard component
// Reduces initial bundle size by loading SSP module only when needed

import { lazy, Suspense } from 'react';
import { SSPWizardSkeleton } from './SSPWizardSkeleton';

// Lazy load the SSPWizard component
const SSPWizard = lazy(() =>
  import('./SSPWizard').then(module => ({ default: module.SSPWizard }))
);

interface LazySSPWizardProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
  activeView?: string;
  onSwitchToTopology?: () => void;
}

export function LazySSPWizard(props: LazySSPWizardProps) {
  return (
    <Suspense fallback={<SSPWizardSkeleton />}>
      <SSPWizard {...props} />
    </Suspense>
  );
}
