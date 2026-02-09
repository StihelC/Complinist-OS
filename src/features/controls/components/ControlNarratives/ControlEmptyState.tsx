// ControlEmptyState - Empty state card shown when a control has no narrative
// Provides control description, AI help button, and example narrative starters

import { useState } from 'react';
import { Sparkles, Lightbulb, Loader2, ArrowRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/utils';
import type { ControlNarrative } from '@/lib/utils/types';
import { getNarrativeStarters } from './narrativeStarters';

interface ControlEmptyStateProps {
  control: ControlNarrative;
  onStarterClick: (starterText: string) => void;
  onAskAI: () => void;
  isLoadingAI: boolean;
}

interface StarterButtonProps {
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
}

const StarterButton = ({ title, description, onClick, delay }: StarterButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      'starter-button group',
      'flex items-start gap-3 p-3 rounded-lg border text-left w-full',
      'transition-all duration-200 ease-out',
      'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
    )}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex-shrink-0 p-1.5 rounded bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
      <FileText className="w-3.5 h-3.5" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
          {title}
        </span>
        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
        {description}
      </p>
    </div>
  </button>
);

export function ControlEmptyState({
  control,
  onStarterClick,
  onAskAI,
  isLoadingAI,
}: ControlEmptyStateProps) {
  const [expandedDescription, setExpandedDescription] = useState(false);

  // Get control-specific narrative starters
  const starters = getNarrativeStarters(control.control_id, control.family);

  // Truncate description for display
  const defaultNarrative = control.default_narrative || '';
  const shouldTruncate = defaultNarrative.length > 200;
  const displayDescription = expandedDescription || !shouldTruncate
    ? defaultNarrative
    : defaultNarrative.slice(0, 200) + '...';

  return (
    <div className="control-empty-state mt-4 space-y-4">
      {/* Control Description Section */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-blue-100">
            <Lightbulb className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-800">
              No implementation narrative yet
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              This control requires a narrative describing how your system implements it.
              Use one of the starters below or let AI help you get started.
            </p>
          </div>
        </div>

        {/* NIST Reference Summary */}
        {defaultNarrative && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              NIST Control Reference
            </p>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {displayDescription}
            </p>
            {shouldTruncate && (
              <button
                onClick={() => setExpandedDescription(!expandedDescription)}
                className="text-xs text-blue-600 hover:text-blue-700 mt-1.5 font-medium"
              >
                {expandedDescription ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Help Button */}
      <button
        onClick={onAskAI}
        disabled={isLoadingAI}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
          'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium text-sm',
          'hover:from-blue-700 hover:to-blue-800 transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700',
          'shadow-sm hover:shadow-md'
        )}
      >
        {isLoadingAI ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating recommendation...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Ask AI for Help</span>
          </>
        )}
      </button>

      {/* Narrative Starters */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">
          Or start with a template
        </p>
        <div className="space-y-2">
          {starters.map((starter, index) => (
            <StarterButton
              key={starter.title}
              title={starter.title}
              description={starter.preview}
              onClick={() => onStarterClick(starter.template)}
              delay={index * 50}
            />
          ))}
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-center text-slate-400 pt-1">
        You can always edit the narrative after selecting a starter
      </p>
    </div>
  );
}
