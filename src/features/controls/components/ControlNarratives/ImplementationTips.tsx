// Implementation Tips Component
// Shows AI-generated tips for improving control implementation narratives

import { useState } from 'react';
import { Lightbulb, Loader2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Target, Sparkles, RefreshCw } from 'lucide-react';
import { analyzeImplementationTips, type ImplementationTip } from '@/lib/ai/implementationTips';
import type { ControlNarrative } from '@/lib/utils/types';

interface ImplementationTipsProps {
  control: ControlNarrative;
}

// Category styling configuration
const categoryConfig: Record<string, { icon: typeof AlertCircle; color: string; bgColor: string; borderColor: string }> = {
  'Missing Elements': {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  'Clarity Suggestions': {
    icon: Sparkles,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  'Compliance Alignment': {
    icon: Target,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  'Enhancement Ideas': {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
};

// Default styling for unknown categories
const defaultCategoryConfig = {
  icon: Lightbulb,
  color: 'text-slate-600',
  bgColor: 'bg-slate-50',
  borderColor: 'border-slate-200',
};

export function ImplementationTips({ control }: ImplementationTipsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tips, setTips] = useState<ImplementationTip[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hasContent = Boolean(control.system_implementation?.trim());
  const hasTips = tips.length > 0;

  const handleGetTips = async () => {
    if (!hasContent) {
      setError('Please write some implementation notes first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsExpanded(true);

    try {
      const result = await analyzeImplementationTips({
        controlId: control.control_id,
        controlTitle: control.title,
        nistReference: control.default_narrative || '',
        userImplementation: control.system_implementation || '',
      });

      setTips(result.tips);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze implementation tips.');
      setTips([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Group tips by category
  const tipsByCategory = tips.reduce((acc, tip) => {
    if (!acc[tip.category]) {
      acc[tip.category] = [];
    }
    acc[tip.category].push(tip);
    return acc;
  }, {} as Record<string, ImplementationTip[]>);

  // Order categories by priority
  const categoryOrder = ['Missing Elements', 'Compliance Alignment', 'Clarity Suggestions', 'Enhancement Ideas'];
  const sortedCategories = Object.keys(tipsByCategory).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
        >
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span>Implementation Tips</span>
          {hasTips && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {tips.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {!isLoading && (
          <button
            onClick={handleGetTips}
            disabled={!hasContent || isLoading}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-slate-300 transition-colors"
          >
            {hasTips ? (
              <>
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </>
            ) : (
              <span>Get Tips</span>
            )}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Analyzing your implementation...</p>
                <p className="text-xs text-blue-700 mt-0.5">Comparing against NIST control requirements</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Unable to generate tips</p>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Tips Display */}
          {!isLoading && !error && hasTips && (
            <div className="space-y-3">
              {sortedCategories.map((category) => {
                const categoryTips = tipsByCategory[category];
                const config = categoryConfig[category] || defaultCategoryConfig;
                const Icon = config.icon;

                return (
                  <div
                    key={category}
                    className={`rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}
                  >
                    {/* Category Header */}
                    <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${config.borderColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <h4 className="text-sm font-semibold text-slate-900">{category}</h4>
                      <span className="ml-auto rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {categoryTips.length} {categoryTips.length === 1 ? 'tip' : 'tips'}
                      </span>
                    </div>
                    {/* Tips List */}
                    <ul className="divide-y divide-slate-100">
                      {categoryTips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-3 px-4 py-3 bg-white/40">
                          <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${config.color.replace('text-', 'bg-')} flex-shrink-0`} />
                          <span className="text-sm text-slate-700 leading-relaxed">{tip.tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State - Has Content but No Tips */}
          {!isLoading && !error && !hasTips && hasContent && (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Get AI-powered suggestions</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click "Get Tips" to receive personalized recommendations for improving your implementation narrative based on NIST requirements.
                </p>
              </div>
            </div>
          )}

          {/* Empty State - No Content */}
          {!hasContent && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Implementation text required</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Write some implementation notes in the text area above, then click "Get Tips" for AI-powered suggestions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

