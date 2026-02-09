import { useEffect, useRef } from 'react';
import type { NistBaseline } from '@/lib/utils/types';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { useNavigationHistoryStore, getFamilyFromControlId } from '@/core/stores/useNavigationHistoryStore';
import { ControlFamilySection } from './ControlFamilySection';
import { BreadcrumbNavigation, RecentlyEditedPanel } from '../Navigation';

interface ControlNarrativeEditorProps {
  isOpen: boolean;
  projectId: number | null;
  projectName?: string;
  baseline: NistBaseline;
  onClose: () => void;
  inline?: boolean;
}

export function ControlNarrativeEditor({
  isOpen,
  projectId,
  projectName,
  baseline,
  onClose,
  inline = false,
}: ControlNarrativeEditorProps) {
  const loadControls = useControlNarrativesStore((state) => state.loadControls);
  const changeBaseline = useControlNarrativesStore((state) => state.changeBaseline);
  const currentBaseline = useControlNarrativesStore((state) => state.baseline);
  const families = useControlNarrativesStore((state) => state.families);
  const searchTerm = useControlNarrativesStore((state) => state.searchTerm);
  const setSearchTerm = useControlNarrativesStore((state) => state.setSearchTerm);
  const showOnlyApplicable = useControlNarrativesStore((state) => state.showOnlyApplicable);
  const setShowOnlyApplicable = useControlNarrativesStore((state) => state.setShowOnlyApplicable);
  const hiddenCustomCount = useControlNarrativesStore((state) => state.hiddenCustomCount);
  const items = useControlNarrativesStore((state) => state.items);
  const dirtyCount = useControlNarrativesStore((state) => state.dirtyCount);
  const saveNarratives = useControlNarrativesStore((state) => state.saveNarratives);
  const loading = useControlNarrativesStore((state) => state.loading);
  const saving = useControlNarrativesStore((state) => state.saving);
  const error = useControlNarrativesStore((state) => state.error);
  
  const familySectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Navigation store
  const expandFamily = useNavigationHistoryStore((state) => state.expandFamily);
  const navigateToFamily = useNavigationHistoryStore((state) => state.navigateToFamily);
  const clearPath = useNavigationHistoryStore((state) => state.clearPath);

  // Load controls when component opens or project/baseline changes
  useEffect(() => {
    if (isOpen && projectId) {
      // Use currentBaseline from store if available, otherwise use prop
      const baselineToUse = currentBaseline || baseline;
      loadControls({ baseline: baselineToUse, projectId });
    }
  }, [isOpen, projectId, loadControls]);

  // Sync baseline prop to store when it changes externally (but don't reload if store already matches)
  useEffect(() => {
    if (isOpen && projectId && baseline && baseline !== currentBaseline) {
      // Only sync if the prop is different from store
      changeBaseline(baseline);
    }
  }, [isOpen, projectId, baseline, currentBaseline, changeBaseline]);

  if (!isOpen) {
    return null;
  }

  const handleSave = async () => {
    await saveNarratives();
  };

  // Navigate to a specific control
  const handleNavigateToControl = (_controlId: string, familyCode: string) => {
    // Find the family and expand it
    const family = families.find((f) => f.code === familyCode);
    if (family) {
      expandFamily(familyCode);
      navigateToFamily(familyCode, family.name);

      // Scroll to the family section after a short delay to allow expansion
      setTimeout(() => {
        const familyRef = familySectionRefs.current[familyCode];
        if (familyRef) {
          familyRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  // Navigate to a family
  const handleNavigateToFamily = (familyCode: string) => {
    const family = families.find((f) => f.code === familyCode);
    if (family) {
      expandFamily(familyCode);
      navigateToFamily(familyCode, family.name);

      // Scroll to the family section
      setTimeout(() => {
        const familyRef = familySectionRefs.current[familyCode];
        if (familyRef) {
          familyRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  // Clear navigation when closing
  useEffect(() => {
    if (!isOpen) {
      clearPath();
    }
  }, [isOpen, clearPath]);

  const content = (
    <div
      className={inline ? "w-full h-full flex flex-col bg-white" : "w-full max-w-6xl rounded-2xl bg-white shadow-2xl"}
      onClick={inline ? undefined : (event) => event.stopPropagation()}
    >
      <header className="flex items-start justify-between border-b border-slate-100 px-8 py-6">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Control Narratives
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{projectName ?? 'Unnamed Project'}</h2>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="baseline-selector" className="text-sm font-medium text-slate-700">
                Security Baseline:
              </label>
              <select
                id="baseline-selector"
                value={currentBaseline}
                onChange={(e) => changeBaseline(e.target.value as NistBaseline)}
                disabled={loading || !projectId}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="LOW">LOW</option>
                <option value="MODERATE">MODERATE</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
            {Object.keys(items).length > 0 && (
              <span className="text-sm text-slate-500">
                {Object.values(items).filter(c => c.isApplicableToBaseline).length} applicable controls
              </span>
            )}
          </div>
        </div>
        {!inline && (
          <button
            aria-label="Close control narrative editor"
            className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>

        {/* Breadcrumb Navigation */}
        <div className="px-8 py-2 border-b border-slate-100 bg-slate-50">
          <BreadcrumbNavigation
            onNavigateToFamily={handleNavigateToFamily}
            onNavigateToControl={(controlId) => {
              const familyCode = getFamilyFromControlId(controlId);
              handleNavigateToControl(controlId, familyCode);
            }}
          />
        </div>


        <div className="border-b border-slate-100 px-8 py-4 space-y-3">
              {projectId && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-900">
                    <strong>Review Mode:</strong> These narratives are aggregated from device-level implementation notes. 
                    Edit here to customize project-level narratives for SSP generation. Device-level notes remain the primary source.
                  </p>
                </div>
              )}
              {projectId ? (
                <div className="space-y-3">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <input
                    type="search"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 md:max-w-xl"
                    placeholder="Search by control ID, title, or text..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{dirtyCount} unsaved change(s)</span>
                    <button
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      onClick={handleSave}
                      disabled={dirtyCount === 0 || saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showOnlyApplicable}
                        onChange={(e) => setShowOnlyApplicable(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="text-sm text-slate-700">Show only applicable controls</span>
                    </label>
                    {hiddenCustomCount > 0 && (
                      <span className="text-sm text-amber-600">
                        {hiddenCustomCount} hidden control{hiddenCustomCount !== 1 ? 's' : ''} with customizations
                      </span>
                    )}
                    {Object.keys(items).length > 0 && (
                      <span className="text-sm text-slate-500">
                        Showing {families.reduce((sum, f) => sum + f.controls.length, 0)} of {Object.keys(items).length} controls
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-red-600">
                  Load or create a project to edit control narratives.
                </p>
              )}
            </div>

            {error && <p className="px-8 py-3 text-sm text-red-600">{error}</p>}

            <div className={inline ? "flex-1 overflow-y-auto" : "max-h-[70vh] overflow-y-auto"}>
              <div className="flex gap-6 px-8 py-6">
                {/* Main content - Family sections */}
                <div className="flex-1 space-y-4 min-w-0">
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading controls...</p>
                  ) : families.length === 0 ? (
                    <p className="text-sm text-slate-500">No controls match the current filters.</p>
                  ) : (
                    families.map((family) => (
                      <div
                        key={family.code}
                        ref={(el) => {
                          familySectionRefs.current[family.code] = el;
                        }}
                      >
                        <ControlFamilySection family={family} />
                      </div>
                    ))
                  )}
                </div>

                {/* Sidebar - Recently Edited Panel */}
                <div className="hidden lg:block w-72 flex-shrink-0">
                  <div className="sticky top-0">
                    <RecentlyEditedPanel
                      onNavigateToControl={handleNavigateToControl}
                    />
                  </div>
                </div>
              </div>
            </div>
      </div>
  );

  if (inline) {
    return <div className="w-full h-full flex flex-col">{content}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-10"
      onClick={onClose}
    >
      {content}
    </div>
  );
}

