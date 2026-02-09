import { useState, useMemo, useEffect } from 'react';
import { ControlBuilderCard } from '@/features/controls/components/ControlNarratives/ControlBuilderCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { ControlNarrative, ControlFamily } from '@/lib/utils/types';

interface ControlSelectorWithEditorProps {
  controls: Record<string, ControlNarrative>;
  families: ControlFamily[];
  selectedControlIds: string[];
  onSelectionChange: (controlIds: string[]) => void;
}

export function ControlSelectorWithEditor({
  controls,
  families,
  selectedControlIds,
  onSelectionChange,
}: ControlSelectorWithEditorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Initialize with first 3 families expanded
  useEffect(() => {
    if (families.length > 0 && expandedFamilies.size === 0) {
      setExpandedFamilies(new Set(families.slice(0, 3).map(f => f.code)));
    }
  }, [families.length]);

  // Filter families and controls by search
  const filteredFamilies = useMemo(() => {
    if (!searchTerm.trim()) return families;
    
    const term = searchTerm.toLowerCase();
    return families
      .map(family => ({
        ...family,
        controls: family.controls.filter(control => {
          const haystack = `${control.control_id} ${control.title} ${control.family}`.toLowerCase();
          return haystack.includes(term);
        })
      }))
      .filter(family => family.controls.length > 0);
  }, [families, searchTerm]);

  const handleControlSelection = (controlId: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedControlIds, controlId]);
    } else {
      onSelectionChange(selectedControlIds.filter(id => id !== controlId));
    }
  };

  const handleFamilyToggle = (familyCode: string) => {
    const newExpanded = new Set(expandedFamilies);
    if (newExpanded.has(familyCode)) {
      newExpanded.delete(familyCode);
    } else {
      newExpanded.add(familyCode);
    }
    setExpandedFamilies(newExpanded);
  };

  const handleSelectAllInFamily = (family: ControlFamily) => {
    const familyControlIds = family.controls.map(c => c.control_id);
    const allSelected = familyControlIds.every(id => selectedControlIds.includes(id));
    
    if (allSelected) {
      // Deselect all in this family
      onSelectionChange(selectedControlIds.filter(id => !familyControlIds.includes(id)));
    } else {
      // Select all in this family
      const newSelection = [...new Set([...selectedControlIds, ...familyControlIds])];
      onSelectionChange(newSelection);
    }
  };

  const handleSelectAll = () => {
    const allControlIds = Object.keys(controls);
    onSelectionChange(allControlIds);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const selectedCount = selectedControlIds.length;
  const totalCount = Object.keys(controls).length;

  return (
    <div className="space-y-4">
      {/* Header with Search and Bulk Actions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search controls by ID, title, or family..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{selectedCount}</span> of {totalCount} controls selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
            >
              Deselect All
            </Button>
          </div>
        </div>
      </div>

      {/* Control Families */}
      <div className="space-y-3">
        {filteredFamilies.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-500">No controls match your search.</p>
          </div>
        ) : (
          filteredFamilies.map((family) => {
            const isExpanded = expandedFamilies.has(family.code);
            const familyControlIds = family.controls.map(c => c.control_id);
            const selectedInFamily = familyControlIds.filter(id => selectedControlIds.includes(id)).length;
            const allSelected = selectedInFamily === familyControlIds.length;
            
            return (
              <div key={family.code} className="rounded-lg border border-slate-200 bg-white">
                {/* Family Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3">
                  <button
                    onClick={() => handleFamilyToggle(family.code)}
                    className="flex items-center gap-2 flex-1 text-left hover:text-slate-900"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    )}
                    <span className="font-semibold text-sm text-slate-900">
                      {family.code} - {family.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({selectedInFamily}/{familyControlIds.length} selected)
                    </span>
                  </button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAllInFamily(family)}
                    className="text-xs"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                {/* Family Controls */}
                {isExpanded && (
                  <div className="p-3 space-y-2">
                    {family.controls.map((control) => (
                      <ControlBuilderCard
                        key={control.control_id}
                        control={control}
                        showCheckbox={true}
                        isSelected={selectedControlIds.includes(control.control_id)}
                        onSelectionChange={handleControlSelection}
                        showNarrativeEditor={true}
                        compact={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

