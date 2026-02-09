import { useState, useEffect, useRef } from 'react';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import type { ControlNarrative } from '@/lib/utils/types';
import { ChevronDown, ChevronUp, Save, Check, Edit2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ControlBuilderCardProps {
  control: ControlNarrative;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (controlId: string, selected: boolean) => void;
  showNarrativeEditor?: boolean;
  compact?: boolean;
}

const STATUS_OPTIONS = [
  'Not Implemented',
  'Planned',
  'Partially Implemented',
  'Implemented',
  'Not Applicable',
];

export function ControlBuilderCard({ 
  control, 
  showCheckbox = false,
  isSelected = false,
  onSelectionChange,
  showNarrativeEditor = false,
  compact = false
}: ControlBuilderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNarrative, setIsEditingNarrative] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const updateNarrative = useControlNarrativesStore((state) => state.updateNarrative);
  const updateStatus = useControlNarrativesStore((state) => state.updateStatus);
  const saveSingleControl = useControlNarrativesStore((state) => state.saveSingleControl);
  const dirtyIds = useControlNarrativesStore((state) => state.dirtyIds);
  const saving = useControlNarrativesStore((state) => state.saving);

  const hasCustomNarrative = control.isCustom || control.wasCustom;
  const systemImplementation = control.system_implementation || '';
  const hasUnsavedChanges = dirtyIds.has(control.control_id);
  const isApplicable = control.isApplicableToBaseline ?? true;

  const handleSave = async () => {
    setSaveStatus('saving');
    const result = await saveSingleControl(control.control_id);
    if (result.success) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(control.control_id, checked);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && isEditingNarrative) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 400);
      textarea.style.height = `${newHeight}px`;
    }
  }, [systemImplementation, isEditingNarrative]);

  // Determine narrative status badge
  const getNarrativeStatusBadge = () => {
    if (hasCustomNarrative) {
      return (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          Custom
        </span>
      );
    }
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        Default
      </span>
    );
  };

  return (
    <article 
      className={`rounded-lg border ${
        isApplicable 
          ? 'border-slate-200 bg-white' 
          : 'border-slate-300 bg-slate-50 opacity-75'
      } ${compact ? 'p-3' : 'p-4'} shadow-sm transition-all ${
        isSelected ? 'ring-2 ring-blue-400 border-blue-400' : ''
      }`}
    >
      <header className="flex items-start gap-3">
        {showCheckbox && (
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              disabled={!isApplicable}
            />
          </div>
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
              {control.control_id}
            </span>
            <span className="text-xs text-slate-600 font-medium">
              {control.family}
            </span>
            {getNarrativeStatusBadge()}
            {!isApplicable && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                Not in baseline
              </span>
            )}
          </div>
          <p className={`${compact ? 'mt-1' : 'mt-2'} text-sm font-semibold text-slate-900`}>
            {control.title}
          </p>
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            {showNarrativeEditor && (
              <button
                onClick={() => setIsEditingNarrative(!isEditingNarrative)}
                className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                title="Edit narrative"
              >
                <Edit2 className="h-3 w-3" />
                {isEditingNarrative ? 'Cancel' : 'Edit'}
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded border border-slate-200 p-1 text-slate-700 hover:bg-slate-50"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </header>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          {/* NIST Reference */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-2">
              NIST Control Reference
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {control.default_narrative}
              </p>
            </div>
          </div>

          {/* Current Implementation Status */}
          {hasCustomNarrative && !isEditingNarrative && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-2">
                System Implementation
              </label>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {systemImplementation || <em className="text-slate-400">No implementation details provided</em>}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline Narrative Editor */}
      {showNarrativeEditor && isEditingNarrative && (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Implementation Status
            <select
              className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={control.implementation_status ?? 'Not Implemented'}
              onChange={(event) => updateStatus(control.control_id, event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            System Implementation
            <p className="text-xs font-normal normal-case text-slate-500">
              Describe how this control is implemented in your specific system
            </p>
            <textarea
              ref={textareaRef}
              rows={3}
              className="w-full resize-y overflow-hidden rounded border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Enter your system-specific implementation details..."
              value={systemImplementation}
              onChange={(event) => {
                updateNarrative(control.control_id, event.target.value);
                const textarea = event.target;
                textarea.style.height = 'auto';
                const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 400);
                textarea.style.height = `${newHeight}px`;
              }}
            />
          </label>

          <div className="flex justify-end">
            <button
              className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving || saveStatus === 'saving'}
              title={hasUnsavedChanges ? 'Save changes' : 'No changes to save'}
            >
              {saveStatus === 'saved' ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>Saved</span>
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

