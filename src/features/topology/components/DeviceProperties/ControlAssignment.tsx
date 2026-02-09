import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { NistBaseline, DeviceType } from '@/lib/utils/types';
import { getCatalogForBaseline, getAllControls } from '@/lib/controls/controlCatalog';
import type { ControlNarrative } from '@/lib/utils/types';
import { getControlTemplate, hasTemplate } from '@/lib/controls/controlTemplates';
import { categorizeDevice } from '@/lib/topology/topologyAnalyzer';
import type { DeviceCategorySummary } from '@/lib/topology/topologyAnalyzer';
import { FileText } from 'lucide-react';
import { formatControlName, getFamilyName } from '@/lib/controls/formatter';

interface ControlAssignmentProps {
  baseline: NistBaseline;
  assignedControls: string[];
  controlNotes?: Record<string, string>;
  deviceType?: DeviceType;
  onChange: (controls: string[], notes: Record<string, string>) => void;
}

export function ControlAssignment({
  baseline,
  assignedControls,
  controlNotes = {},
  deviceType,
  onChange,
}: ControlAssignmentProps) {
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<ControlNarrative[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllControls, setShowAllControls] = useState(false);
  
  // Get device category for templates
  const deviceCategory: DeviceCategorySummary = deviceType ? categorizeDevice(deviceType) : 'other';

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadCatalog = showAllControls ? getAllControls() : getCatalogForBaseline(baseline);
    
    loadCatalog
      .then((result) => {
        if (!isMounted) return;
        setCatalog(Object.values(result.items));
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load controls');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [baseline, showAllControls]);

  const controlMap = useMemo(() => {
    const map = new Map<string, ControlNarrative>();
    catalog.forEach((control) => map.set(control.control_id, control));
    return map;
  }, [catalog]);

  const { baselineControls, additionalControls } = useMemo(() => {
    // Filter out already assigned controls
    const unassigned = catalog.filter((control) => !assignedControls.includes(control.control_id));
    
    // Group by baseline relevance
    const baselineRelevant = unassigned.filter((control) => control.baselines.includes(baseline));
    const additional = unassigned.filter((control) => !control.baselines.includes(baseline));
    
    // Apply search filter if present
    if (search) {
      const term = search.toLowerCase();
      const filterFn = (control: ControlNarrative) =>
        control.control_id.toLowerCase().includes(term) ||
        control.title.toLowerCase().includes(term);
      
      return {
        baselineControls: baselineRelevant.filter(filterFn),
        additionalControls: additional.filter(filterFn),
      };
    }
    
    return {
      baselineControls: baselineRelevant.slice(0, 20),
      additionalControls: showAllControls ? additional.slice(0, 10) : [],
    };
  }, [catalog, search, assignedControls, baseline, showAllControls]);

  const handleAssign = (controlId: string) => {
    if (assignedControls.includes(controlId)) {
      return;
    }

    const updatedControls = [...assignedControls, controlId];
    const updatedNotes = { ...controlNotes };
    
    // Pre-fill with template if available and notes are empty
    if (!updatedNotes[controlId]) {
      const template = getControlTemplate(deviceCategory, controlId);
      updatedNotes[controlId] = template || '';
    }
    
    onChange(updatedControls, updatedNotes);
    // Clear search to make it easier to assign the next control
    setSearch('');
  };
  
  const handleUseTemplate = (controlId: string) => {
    const template = getControlTemplate(deviceCategory, controlId);
    if (template) {
      const updatedNotes = { ...controlNotes, [controlId]: template };
      onChange(assignedControls, updatedNotes);
    }
  };

  const handleRemove = (controlId: string) => {
    const updatedControls = assignedControls.filter((id) => id !== controlId);
    const updatedNotes = { ...controlNotes };
    delete updatedNotes[controlId];
    onChange(updatedControls, updatedNotes);
  };

  const handleNoteChange = (controlId: string, value: string) => {
    const updatedNotes = { ...controlNotes, [controlId]: value };
    onChange(assignedControls, updatedNotes);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label>Assigned Controls</Label>
          <span className="text-xs text-gray-500">{assignedControls.length} selected</span>
        </div>
        {assignedControls.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No controls assigned to this device yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {assignedControls.map((controlId) => {
              const control = controlMap.get(controlId);
              return (
                <div
                  key={controlId}
                  className="rounded border border-slate-200 bg-slate-50 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {control ? formatControlName(controlId, control.title) : controlId}
                      </p>
                      {control && (
                        <p className="text-xs text-slate-500">
                          {getFamilyName(control.family)} • {control.baselines.join(', ')}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(controlId)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <Label className="text-xs text-slate-500">Implementation Notes</Label>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Describe how THIS device implements this control
                        </p>
                      </div>
                      {hasTemplate(deviceCategory, controlId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUseTemplate(controlId)}
                          className="h-6 text-xs"
                          title="Fill with template"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Use Template
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={controlNotes[controlId] || ''}
                      onChange={(event) => handleNoteChange(controlId, event.target.value)}
                      rows={3}
                      placeholder={hasTemplate(deviceCategory, controlId) 
                        ? "Click 'Use Template' for a pre-filled implementation guide..." 
                        : "Describe how this device satisfies the control..."}
                      className="mt-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="control-search">Add Control</Label>
          {!showAllControls && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-all-controls"
                checked={showAllControls}
                onCheckedChange={(checked) => setShowAllControls(checked === true)}
              />
              <label
                htmlFor="show-all-controls"
                className="text-xs text-slate-600 cursor-pointer"
              >
                Show all controls
              </label>
            </div>
          )}
        </div>
        
        {!showAllControls && !search && (
          <p className="text-xs text-slate-500 italic">
            Based on your <span className="font-medium">{baseline}</span> baseline, these controls are recommended for this device type.
          </p>
        )}
        
        <Input
          id="control-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by ID or title (e.g., AC-2, Boundary Protection)"
        />
        {loading && <p className="text-xs text-slate-500">Loading controls…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        
        <div className="max-h-64 overflow-y-auto rounded border border-dashed border-slate-200">
          {baselineControls.length === 0 && additionalControls.length === 0 && !loading ? (
            <p className="p-3 text-sm text-slate-500">
              {search 
                ? 'No matching controls found. Try a different search term.' 
                : assignedControls.length > 0 
                  ? 'All available controls are already assigned. Use search to find more.'
                  : 'No controls available for this baseline.'}
            </p>
          ) : (
            <>
              {/* Baseline-relevant controls */}
              {baselineControls.length > 0 && (
                <div className="border-b border-slate-200">
                  {!search && (
                    <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
                      <p className="text-xs font-medium text-blue-900">
                        Recommended for {baseline} baseline
                      </p>
                    </div>
                  )}
                  {baselineControls.map((control) => (
                    <button
                      type="button"
                      key={control.control_id}
                      onClick={() => handleAssign(control.control_id)}
                      className="flex w-full flex-col items-start border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-50"
                      disabled={assignedControls.includes(control.control_id)}
                      title={assignedControls.includes(control.control_id) ? 'Already assigned' : 'Click to assign this control'}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {formatControlName(control.control_id, control.title)}
                            </span>
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              {baseline}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            {getFamilyName(control.family)}
                          </span>
                        </div>
                        {!assignedControls.includes(control.control_id) && (
                          <span className="text-xs text-blue-600 font-medium ml-2">+ Assign</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Additional controls (out of baseline) */}
              {additionalControls.length > 0 && (
                <div>
                  {!search && (
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <p className="text-xs font-medium text-slate-600">
                        Additional controls (not in {baseline} baseline)
                      </p>
                    </div>
                  )}
                  {additionalControls.map((control) => (
                    <button
                      type="button"
                      key={control.control_id}
                      onClick={() => handleAssign(control.control_id)}
                      className="flex w-full flex-col items-start border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-50"
                      disabled={assignedControls.includes(control.control_id)}
                      title={assignedControls.includes(control.control_id) ? 'Already assigned' : 'Click to assign this control'}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-700">
                            {formatControlName(control.control_id, control.title)}
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            {getFamilyName(control.family)} • {control.baselines.join(', ')}
                          </span>
                        </div>
                        {!assignedControls.includes(control.control_id) && (
                          <span className="text-xs text-slate-600 font-medium ml-2">+ Assign</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

