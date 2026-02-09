import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useControlNarrativesStore } from '@/core/stores/useControlNarrativesStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { useNavigationHistoryStore, getFamilyFromControlId } from '@/core/stores/useNavigationHistoryStore';
import {
  useShallow,
  selectControlCardActions,
  selectControlCardState,
} from '@/core/stores/selectors';
import type { ControlNarrative } from '@/lib/utils/types';
import { ImplementationTips } from './ImplementationTips';
import { ControlEmptyState } from './ControlEmptyState';
import { NarrativeReviewModal } from '@/features/ai-assistant/components/AI/NarrativeReviewModal';
import { polishImplementation, recommendImplementation } from '@/lib/ai/implementationAssistant';
import type { RAGResponse } from '@/lib/ai/types';
import { ChevronDown, ChevronUp, Save, Check, Sparkles, Lightbulb, Loader2, Puzzle } from 'lucide-react';
import { isEnhancement, getBaseControlId } from '@/lib/controls/parser';
import { normalizeControlId } from '@/lib/controls/formatter';

interface ControlCardProps {
  control: ControlNarrative;
}

const STATUS_OPTIONS = [
  'Not Implemented',
  'Planned',
  'Partially Implemented',
  'Implemented',
  'Not Applicable',
];

export function ControlCard({ control }: ControlCardProps) {
  const [showNISTReference, setShowNISTReference] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use shallow selectors for optimized re-renders
  // Actions - stable references, won't cause re-renders
  const {
    updateNarrative,
    updateStatus,
    resetControl,
    saveSingleControl,
  } = useControlNarrativesStore(useShallow(selectControlCardActions));

  // State - only re-renders when dirtyIds or saving actually change
  const { dirtyIds, saving } = useControlNarrativesStore(useShallow(selectControlCardState));

  // Only subscribe to currentProject from FlowStore
  const currentProject = useFlowStore((state) => state.currentProject);

  // Navigation history store
  const addRecentlyEdited = useNavigationHistoryStore((state) => state.addRecentlyEdited);

  // Track when control is edited and add to recently edited list
  const trackEdit = useCallback(() => {
    const familyCode = getFamilyFromControlId(control.control_id);
    addRecentlyEdited({
      controlId: control.control_id,
      family: familyCode,
      title: control.title,
      editedAt: new Date().toISOString(),
      implementationStatus: control.implementation_status,
    });
  }, [control.control_id, control.title, control.implementation_status, addRecentlyEdited]);

  // AI button states
  const [isPolishing, setIsPolishing] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [generatedResponse, setGeneratedResponse] = useState<RAGResponse | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [lastAction, setLastAction] = useState<'polish' | 'recommend' | null>(null);

  const showCustomBadge = control.isCustom || control.wasCustom;
  const disableReset = !control.isCustom && !control.wasCustom;
  const isApplicable = control.isApplicableToBaseline ?? true;
  const systemImplementation = control.system_implementation || '';
  const hasUnsavedChanges = dirtyIds.has(control.control_id);
  const hasContent = Boolean(systemImplementation.trim());

  // Enhancement detection
  const controlIsEnhancement = useMemo(() => isEnhancement(control.control_id), [control.control_id]);
  const parentControlId = useMemo(
    () => controlIsEnhancement ? getBaseControlId(control.control_id) : null,
    [control.control_id, controlIsEnhancement]
  );

  // Get baseline badges for display
  const baselineBadges = useMemo(() => {
    const badges: Array<{ label: string; color: string }> = [];
    if (control.baselines?.includes('LOW')) {
      badges.push({ label: 'LOW', color: 'bg-green-100 text-green-700' });
    }
    if (control.baselines?.includes('MODERATE')) {
      badges.push({ label: 'MOD', color: 'bg-yellow-100 text-yellow-700' });
    }
    if (control.baselines?.includes('HIGH')) {
      badges.push({ label: 'HIGH', color: 'bg-red-100 text-red-700' });
    }
    return badges;
  }, [control.baselines]);

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

  // Polish: Grammar and formatting only
  const handlePolish = async () => {
    if (!hasContent) {
      alert('Please write some implementation text first.');
      return;
    }

    setIsPolishing(true);
    setLastAction('polish');
    try {
      const result = await polishImplementation({
        controlId: control.control_id,
        controlTitle: control.title,
        existingImplementation: systemImplementation,
      });

      setGeneratedResponse({
        controlId: control.control_id,
        narrative: result.polishedText,
        references: [],
        tokensUsed: 0,
        retrievedChunks: [],
      });
      setShowReviewModal(true);
    } catch (error) {
      alert(`Error polishing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPolishing(false);
    }
  };

  // Recommend: Topology-aware implementation suggestion
  const handleRecommend = async () => {
    setIsRecommending(true);
    setLastAction('recommend');
    try {
      const result = await recommendImplementation({
        controlId: control.control_id,
        controlTitle: control.title,
        nistReference: control.default_narrative || '',
        existingImplementation: systemImplementation || undefined,
        projectId: currentProject?.id,
      });

      setGeneratedResponse({
        controlId: control.control_id,
        narrative: result.recommendedImplementation,
        references: result.usedTopology
          ? [{ chunkId: 'topology', reason: 'Based on system topology', score: 1 }]
          : [],
        tokensUsed: 0,
        retrievedChunks: [],
      });
      setShowReviewModal(true);
    } catch (error) {
      alert(`Error generating recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRecommending(false);
    }
  };

  // Accept the generated narrative
  const handleAccept = (narrative: string) => {
    updateNarrative(control.control_id, narrative);
    setShowReviewModal(false);
    setGeneratedResponse(null);
    setLastAction(null);
  };

  // Handle starter click - auto-fill the narrative with the template
  const handleStarterClick = (starterText: string) => {
    updateNarrative(control.control_id, starterText);
    trackEdit();
    // Focus the textarea after a short delay to allow state update
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Reject and close modal
  const handleReject = () => {
    setShowReviewModal(false);
    setGeneratedResponse(null);
    setLastAction(null);
  };

  // Regenerate using the last action
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      if (lastAction === 'polish') {
        const result = await polishImplementation({
          controlId: control.control_id,
          controlTitle: control.title,
          existingImplementation: systemImplementation,
        });
        setGeneratedResponse({
          controlId: control.control_id,
          narrative: result.polishedText,
          references: [],
          tokensUsed: 0,
          retrievedChunks: [],
        });
      } else if (lastAction === 'recommend') {
        const result = await recommendImplementation({
          controlId: control.control_id,
          controlTitle: control.title,
          nistReference: control.default_narrative || '',
          existingImplementation: systemImplementation || undefined,
          projectId: currentProject?.id,
        });
        setGeneratedResponse({
          controlId: control.control_id,
          narrative: result.recommendedImplementation,
          references: result.usedTopology
            ? [{ chunkId: 'topology', reason: 'Based on system topology', score: 1 }]
            : [],
          tokensUsed: 0,
          retrievedChunks: [],
        });
      }
    } catch (error) {
      alert(`Error regenerating: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height based on content, with minimum of 3 rows (~60px) and maximum of 20 rows (~400px)
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 400);
      textarea.style.height = `${newHeight}px`;
    }
  }, [systemImplementation]);

  return (
    <article
      className={`rounded-lg border p-4 shadow-sm ${
        isApplicable
          ? controlIsEnhancement
            ? 'border-blue-200 bg-blue-50/30' // Enhanced styling for enhancements
            : 'border-slate-200 bg-white'
          : 'border-slate-300 bg-slate-50 opacity-75'
      } ${controlIsEnhancement ? 'ml-4' : ''}`}
      data-control-type={controlIsEnhancement ? 'enhancement' : 'base'}
      data-parent-control={parentControlId || undefined}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Control ID Badge - different colors for base vs enhancement */}
            <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              controlIsEnhancement
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-white'
            }`}>
              {normalizeControlId(control.control_id)}
            </span>

            {/* Enhancement Badge - indicates this is optional */}
            {controlIsEnhancement && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                <Puzzle className="h-3 w-3" />
                Optional Enhancement
              </span>
            )}

            {/* Base Control Badge - for non-enhancements */}
            {!controlIsEnhancement && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Base Control
              </span>
            )}

            {/* Baseline Badges - show which baselines require this control */}
            {baselineBadges.length > 0 && (
              <div className="flex items-center gap-1">
                {baselineBadges.map((badge) => (
                  <span
                    key={badge.label}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.color}`}
                    title={`Required for ${badge.label} baseline`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {!isApplicable && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                Not in {control.baselines?.[0] || 'current'} baseline
              </span>
            )}
            {showCustomBadge && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Custom
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm text-slate-900 ${controlIsEnhancement ? 'font-medium' : 'font-semibold'}`}>
            {control.title}
          </p>
          {/* Show parent control reference for enhancements */}
          {controlIsEnhancement && parentControlId && (
            <p className="mt-0.5 text-xs text-slate-500">
              Enhancement of {parentControlId}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Polish Button - Grammar/Formatting only */}
          <button
            className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            onClick={handlePolish}
            disabled={isPolishing || !hasContent || !currentProject}
            title={!hasContent ? 'Write implementation text first' : 'Polish grammar and formatting (no content changes)'}
          >
            {isPolishing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Polishing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                <span>Polish</span>
              </>
            )}
          </button>
          {/* Recommend Button - Topology-aware suggestion */}
          <button
            className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-50"
            onClick={handleRecommend}
            disabled={isRecommending || !currentProject}
            title={hasContent ? 'Rewrite implementation based on topology' : 'Generate implementation based on topology'}
          >
            {isRecommending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Lightbulb className="h-3 w-3" />
                <span>{hasContent ? 'Rewrite' : 'Recommend'}</span>
              </>
            )}
          </button>
          <button
            className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving || saveStatus === 'saving'}
            title={hasUnsavedChanges ? 'Save changes' : 'No changes to save'}
          >
            {saveStatus === 'saved' ? (
              <>
                <Check className="h-3 w-3 text-green-600" />
                <span className="text-green-600">Saved</span>
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-3 w-3" />
                <span>Save</span>
              </>
            )}
          </button>
          <button
            className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => resetControl(control.control_id)}
            disabled={disableReset}
          >
            Reset
          </button>
        </div>
      </header>

      {/* NIST Control Reference (Read-only, Collapsible) */}
      <div className="mt-4 border-t border-slate-200 pt-4">
        <button
          onClick={() => setShowNISTReference(!showNISTReference)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:border-slate-400 hover:bg-slate-100"
        >
          <span className="text-sm font-semibold text-slate-700">
            {showNISTReference ? 'Hide' : 'View'} NIST Control Reference
          </span>
          {showNISTReference ? (
            <ChevronUp className="h-5 w-5 text-slate-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-600" />
          )}
        </button>
        {showNISTReference && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{control.default_narrative}</p>
          </div>
        )}
      </div>

      {/* System Implementation (Always Editable) */}
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Implementation Status
            <select
              className="rounded border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={control.implementation_status ?? 'Not Implemented'}
              onChange={(event) => {
                updateStatus(control.control_id, event.target.value);
                trackEdit();
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {/* Conditional: Show empty state or textarea based on content */}
          {hasContent ? (
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
                  // Track edit in navigation history
                  trackEdit();
                  // Trigger resize on change
                  const textarea = event.target;
                  textarea.style.height = 'auto';
                  const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 400);
                  textarea.style.height = `${newHeight}px`;
                }}
              />
            </label>
          ) : (
            <ControlEmptyState
              control={control}
              onStarterClick={handleStarterClick}
              onAskAI={handleRecommend}
              isLoadingAI={isRecommending}
            />
          )}
        </div>

      {/* Implementation Tips */}
      <ImplementationTips control={control} />

      {/* AI Review Modal */}
      {showReviewModal && generatedResponse && (
        <NarrativeReviewModal
          isOpen={showReviewModal}
          controlId={control.control_id}
          controlTitle={control.title}
          response={generatedResponse}
          onAccept={handleAccept}
          onReject={handleReject}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />
      )}
    </article>
  );
}

