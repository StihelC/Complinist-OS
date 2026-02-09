import { useMemo } from 'react';
import type { ControlFamily, ControlNarrative } from '@/lib/utils/types';
import { useNavigationHistoryStore } from '@/core/stores/useNavigationHistoryStore';
import { ControlCard } from './ControlCard';
import { EnhancementSection } from './EnhancementSection';
import { isEnhancement, getBaseControlId } from '@/lib/controls/parser';

interface ControlFamilySectionProps {
  family: ControlFamily;
}

/**
 * Groups controls into base controls and their enhancements
 */
function groupControlsByBase(controls: ControlNarrative[]): {
  baseControls: ControlNarrative[];
  enhancementsByBase: Map<string, ControlNarrative[]>;
  baseControlCount: number;
  enhancementCount: number;
} {
  const baseControls: ControlNarrative[] = [];
  const enhancementsByBase = new Map<string, ControlNarrative[]>();

  controls.forEach((control) => {
    if (isEnhancement(control.control_id)) {
      const baseId = getBaseControlId(control.control_id);
      if (!enhancementsByBase.has(baseId)) {
        enhancementsByBase.set(baseId, []);
      }
      enhancementsByBase.get(baseId)!.push(control);
    } else {
      baseControls.push(control);
    }
  });

  return {
    baseControls,
    enhancementsByBase,
    baseControlCount: baseControls.length,
    enhancementCount: controls.length - baseControls.length,
  };
}

export function ControlFamilySection({ family }: ControlFamilySectionProps) {
  const expandedFamilies = useNavigationHistoryStore((state) => state.expandedFamilies);
  const toggleFamily = useNavigationHistoryStore((state) => state.toggleFamily);
  const navigateToFamily = useNavigationHistoryStore((state) => state.navigateToFamily);

  const isExpanded = expandedFamilies.has(family.code);

  // Group controls by base vs enhancement
  const { baseControls, enhancementsByBase, baseControlCount, enhancementCount } = useMemo(
    () => groupControlsByBase(family.controls),
    [family.controls]
  );

  const handleToggle = () => {
    toggleFamily(family.code);
    if (!isExpanded) {
      // When expanding, update the navigation path
      navigateToFamily(family.code, family.name);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {family.code}
          </p>
          <h3 className="text-base font-semibold text-slate-900">{family.name}</h3>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{baseControlCount} base controls</span>
            {enhancementCount > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-blue-600">{enhancementCount} enhancements</span>
              </>
            )}
          </div>
        </div>
        <button
          className="rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white"
          onClick={handleToggle}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </header>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {baseControls.map((control) => (
            <div key={control.control_id}>
              {/* Base Control Card */}
              <ControlCard control={control} />

              {/* Enhancement Section - shows enhancements grouped under base control */}
              {enhancementsByBase.has(control.control_id) && (
                <EnhancementSection
                  baseControlId={control.control_id}
                  familyControls={family.controls}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


