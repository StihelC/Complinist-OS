// Lazy-loaded wrapper for ControlNarrativeEditor component
// Reduces initial bundle size by loading controls module only when needed

import { lazy, Suspense } from 'react';
import { ControlNarrativeEditorSkeleton } from './ControlNarrativeEditorSkeleton';
import type { NistBaseline } from '@/lib/utils/types';

// Lazy load the ControlNarrativeEditor component
const ControlNarrativeEditor = lazy(() =>
  import('./ControlNarrativeEditor').then(module => ({ default: module.ControlNarrativeEditor }))
);

interface LazyControlNarrativeEditorProps {
  isOpen: boolean;
  projectId: number | null;
  projectName?: string;
  baseline: NistBaseline;
  onClose: () => void;
  inline?: boolean;
}

export function LazyControlNarrativeEditor(props: LazyControlNarrativeEditorProps) {
  return (
    <Suspense fallback={<ControlNarrativeEditorSkeleton />}>
      <ControlNarrativeEditor {...props} />
    </Suspense>
  );
}
