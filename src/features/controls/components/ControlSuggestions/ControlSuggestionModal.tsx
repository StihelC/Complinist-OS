import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lightbulb, X } from 'lucide-react';
import type { ControlSuggestion } from '@/lib/controls/controlSuggestions';
import { getCatalogForBaseline } from '@/lib/controls/controlCatalog';
import type { ControlNarrative, NistBaseline } from '@/lib/utils/types';

interface ControlSuggestionModalProps {
  isOpen: boolean;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  suggestions: ControlSuggestion[];
  baseline: NistBaseline;
  onAssignControls: (deviceId: string, controlIds: string[]) => void;
  onClose: () => void;
}

const STORAGE_KEY = 'complinist-disable-control-suggestions';

export function ControlSuggestionModal({
  isOpen,
  deviceId,
  deviceName,
  deviceType,
  suggestions,
  baseline,
  onAssignControls,
  onClose,
}: ControlSuggestionModalProps) {
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [controlDetails, setControlDetails] = useState<Map<string, ControlNarrative>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load control details from catalog
  useEffect(() => {
    if (!isOpen || suggestions.length === 0) return;

    let isMounted = true;
    setLoading(true);

    getCatalogForBaseline(baseline)
      .then((catalog) => {
        if (!isMounted) return;
        const details = new Map<string, ControlNarrative>();
        suggestions.forEach((suggestion) => {
          const control = catalog.items[suggestion.controlId];
          if (control) {
            details.set(suggestion.controlId, control);
          }
        });
        setControlDetails(details);
      })
      .catch((error) => {
        console.error('Failed to load control catalog:', error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, suggestions, baseline]);

  // Initialize all high-priority controls as selected
  useEffect(() => {
    if (isOpen) {
      const highPriority = suggestions
        .filter((s) => s.priority === 'high')
        .map((s) => s.controlId);
      setSelectedControls(new Set(highPriority));
    }
  }, [isOpen, suggestions]);

  const handleToggleControl = (controlId: string) => {
    setSelectedControls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(controlId)) {
        newSet.delete(controlId);
      } else {
        newSet.add(controlId);
      }
      return newSet;
    });
  };

  const handleAssignAll = () => {
    const allControlIds = suggestions.map((s) => s.controlId);
    onAssignControls(deviceId, allControlIds);
    handleClose();
  };

  const handleAssignSelected = () => {
    onAssignControls(deviceId, Array.from(selectedControls));
    handleClose();
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleClose = () => {
    if (dontAskAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setSelectedControls(new Set());
    setDontAskAgain(false);
    onClose();
  };

  if (!isOpen) return null;

  const highPriorityCount = suggestions.filter((s) => s.priority === 'high').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Lightbulb className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Control Suggestions
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Added <span className="font-medium">{deviceName}</span>{' '}
                <span className="text-slate-400">({deviceType})</span>
              </p>
            </div>
          </div>
          <button
            aria-label="Close"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <div className="mb-4">
            <p className="text-sm text-slate-700">
              We recommend assigning the following controls to this device based on its type.
              {highPriorityCount > 0 && (
                <span className="ml-1 font-medium text-blue-600">
                  {highPriorityCount} high-priority control{highPriorityCount !== 1 ? 's' : ''}{' '}
                  selected by default.
                </span>
              )}
            </p>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading control details...
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              {suggestions.map((suggestion) => {
                const control = controlDetails.get(suggestion.controlId);
                const isSelected = selectedControls.has(suggestion.controlId);

                return (
                  <div
                    key={suggestion.controlId}
                    className={`rounded-lg border bg-white p-3 transition-colors ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleControl(suggestion.controlId)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {suggestion.controlId}
                              </span>
                              {control && (
                                <span className="text-sm text-slate-600">
                                  — {control.title}
                                </span>
                              )}
                            </div>
                            {control && (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {control.family}
                              </p>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              suggestion.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : suggestion.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {suggestion.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {suggestion.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Don't ask again checkbox */}
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id="dont-ask-again"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor="dont-ask-again"
              className="text-sm text-slate-600 cursor-pointer"
            >
              Don't suggest controls automatically in the future
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
          <Button
            variant="outline"
            onClick={handleAssignAll}
            disabled={loading}
          >
            Assign All ({suggestions.length})
          </Button>
          <Button
            onClick={handleAssignSelected}
            disabled={selectedControls.size === 0 || loading}
          >
            Assign Selected ({selectedControls.size})
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if control suggestions are disabled
 */
export function areControlSuggestionsDisabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Re-enable control suggestions
 */
export function enableControlSuggestions(): void {
  localStorage.removeItem(STORAGE_KEY);
}

