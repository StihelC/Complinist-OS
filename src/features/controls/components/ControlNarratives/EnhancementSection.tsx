/**
 * EnhancementSection Component
 *
 * Displays a collapsible section for control enhancements under their base control.
 * Shows available enhancements grouped together with visual distinction.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Puzzle } from 'lucide-react';
import type { ControlNarrative } from '@/lib/utils/types';
import { ControlCard } from './ControlCard';
import { isEnhancement, getEnhancementNumber } from '@/lib/controls/parser';

interface EnhancementSectionProps {
  /** The base control ID (e.g., "SI-4") */
  baseControlId: string;
  /** All controls in the family (used to find enhancements) */
  familyControls: ControlNarrative[];
  /** Whether the section should be expanded by default */
  defaultExpanded?: boolean;
}

export function EnhancementSection({
  baseControlId,
  familyControls,
  defaultExpanded = false,
}: EnhancementSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Find all enhancements for this base control
  const enhancements = useMemo(() => {
    return familyControls
      .filter((control) => {
        if (!isEnhancement(control.control_id)) return false;
        // Check if this enhancement belongs to the base control
        const baseId = control.control_id.split('(')[0];
        return baseId === baseControlId;
      })
      .sort((a, b) => {
        const numA = getEnhancementNumber(a.control_id) ?? 0;
        const numB = getEnhancementNumber(b.control_id) ?? 0;
        return numA - numB;
      });
  }, [familyControls, baseControlId]);

  // Count enhancements by baseline
  const baselineCounts = useMemo(() => {
    const counts = { LOW: 0, MODERATE: 0, HIGH: 0 };
    enhancements.forEach((enhancement) => {
      if (enhancement.baselines?.includes('LOW')) counts.LOW++;
      if (enhancement.baselines?.includes('MODERATE')) counts.MODERATE++;
      if (enhancement.baselines?.includes('HIGH')) counts.HIGH++;
    });
    return counts;
  }, [enhancements]);

  // Don't render if there are no enhancements
  if (enhancements.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-100"
      >
        <div className="flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Available Enhancements
          </span>
          <span className="text-sm text-blue-600">
            ({enhancements.length} optional)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Baseline summary badges */}
          <div className="flex items-center gap-1 text-[10px] font-medium">
            {baselineCounts.LOW > 0 && (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                L:{baselineCounts.LOW}
              </span>
            )}
            {baselineCounts.MODERATE > 0 && (
              <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700">
                M:{baselineCounts.MODERATE}
              </span>
            )}
            {baselineCounts.HIGH > 0 && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">
                H:{baselineCounts.HIGH}
              </span>
            )}
          </div>

          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-blue-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-blue-600" />
          )}
        </div>
      </button>

      {/* Enhancement Cards */}
      {isExpanded && (
        <div className="mt-2 space-y-2 border-l-2 border-blue-200 pl-3">
          {/* Enhancement Summary */}
          <div className="mb-3 rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> These enhancements are optional additions to the
              base control <strong>{baseControlId}</strong>. Select enhancements
              based on your system's security requirements and applicable baseline.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {enhancements.map((enhancement) => (
                <span
                  key={enhancement.control_id}
                  className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-blue-700 shadow-sm"
                >
                  <strong>{enhancement.control_id}</strong>
                  <span className="text-blue-500">—</span>
                  <span className="max-w-[200px] truncate text-slate-600">
                    {enhancement.title}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Individual Enhancement Cards */}
          {enhancements.map((enhancement) => (
            <ControlCard key={enhancement.control_id} control={enhancement} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Utility function to check if a control has any enhancements
 */
export function hasEnhancements(
  baseControlId: string,
  familyControls: ControlNarrative[]
): boolean {
  return familyControls.some((control) => {
    if (!isEnhancement(control.control_id)) return false;
    const baseId = control.control_id.split('(')[0];
    return baseId === baseControlId;
  });
}

/**
 * Utility function to get all enhancements for a base control
 */
export function getEnhancementsForControl(
  baseControlId: string,
  familyControls: ControlNarrative[]
): ControlNarrative[] {
  return familyControls
    .filter((control) => {
      if (!isEnhancement(control.control_id)) return false;
      const baseId = control.control_id.split('(')[0];
      return baseId === baseControlId;
    })
    .sort((a, b) => {
      const numA = getEnhancementNumber(a.control_id) ?? 0;
      const numB = getEnhancementNumber(b.control_id) ?? 0;
      return numA - numB;
    });
}
