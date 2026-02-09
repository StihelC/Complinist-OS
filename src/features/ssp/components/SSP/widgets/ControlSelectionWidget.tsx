/**
 * Control Selection Widget
 * Custom widget for selecting NIST controls in the SSP wizard
 * Uses react-window for virtual scrolling to handle large catalogs (1000+ controls)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { WidgetProps } from '@rjsf/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { getCatalogForBaseline } from '@/lib/controls/controlCatalog';
import { CheckCircle } from 'lucide-react';
import type { NistBaseline } from '@/lib/utils/types';
import { VirtualizedControlList } from './VirtualizedControlList';

interface ControlSelectionWidgetProps extends WidgetProps {
  baseline?: NistBaseline;
}

export const ControlSelectionWidget: React.FC<ControlSelectionWidgetProps> = ({
  baseline = 'MODERATE',
}) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const { selectedControlIds, setSelectedControlIds, initializeSmartDefaults } = useControlSelectionStore();
  
  const [availableControls, setAvailableControls] = useState<Record<string, any>>({});
  const [controlFamilies, setControlFamilies] = useState<any[]>([]);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load control catalog when baseline changes
  useEffect(() => {
    const loadControls = async () => {
      setIsLoading(true);
      try {
        const catalog = await getCatalogForBaseline(baseline);
        setAvailableControls(catalog.items);
        setControlFamilies(catalog.families);

        // Initialize smart defaults if no selection exists
        const allControlIds = Object.keys(catalog.items);
        if (selectedControlIds.length === 0) {
          initializeSmartDefaults(nodes, edges, allControlIds);
        }
      } catch (error) {
        console.error('[ControlSelectionWidget] Failed to load catalog:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadControls();
  }, [baseline, nodes, edges, selectedControlIds.length, initializeSmartDefaults]);

  // Filter controls by search term
  const filteredFamilies = useMemo(() => {
    if (!searchTerm.trim()) return controlFamilies;

    const term = searchTerm.toLowerCase();
    return controlFamilies
      .map((family) => ({
        ...family,
        controls: family.controls.filter((control: any) => {
          const haystack = `${control.control_id} ${control.title} ${control.family}`.toLowerCase();
          return haystack.includes(term);
        }),
      }))
      .filter((family) => family.controls.length > 0);
  }, [controlFamilies, searchTerm]);

  const toggleFamily = (familyCode: string) => {
    setExpandedFamilies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(familyCode)) {
        newSet.delete(familyCode);
      } else {
        newSet.add(familyCode);
      }
      return newSet;
    });
  };

  const handleControlToggle = (controlId: string, selected: boolean) => {
    if (selected) {
      setSelectedControlIds([...selectedControlIds, controlId]);
    } else {
      setSelectedControlIds(selectedControlIds.filter((id) => id !== controlId));
    }
  };

  const handleSelectAllInFamily = (familyCode: string) => {
    const family = controlFamilies.find((f) => f.code === familyCode);
    if (!family) return;

    const familyControlIds = family.controls.map((c: any) => c.control_id);
    const allSelected = familyControlIds.every((id: string) => selectedControlIds.includes(id));

    if (allSelected) {
      // Deselect all in this family
      setSelectedControlIds(selectedControlIds.filter((id) => !familyControlIds.includes(id)));
    } else {
      // Select all in this family
      const newSelection = [...new Set([...selectedControlIds, ...familyControlIds])];
      setSelectedControlIds(newSelection);
    }
  };

  const handleSelectAllBaseline = () => {
    const allControlIds = Object.keys(availableControls);
    setSelectedControlIds(allControlIds);
  };

  const handleClearAll = () => {
    setSelectedControlIds([]);
  };

  const getFamilyStatus = useCallback((familyCode: string): 'complete' | 'partial' | 'none' => {
    const family = controlFamilies.find((f) => f.code === familyCode);
    if (!family) return 'none';

    const familyControlIds = family.controls.map((c: any) => c.control_id);
    const selectedInFamily = familyControlIds.filter((id: string) => selectedControlIds.includes(id));

    if (selectedInFamily.length === 0) return 'none';
    if (selectedInFamily.length === familyControlIds.length) return 'complete';
    return 'partial';
  }, [controlFamilies, selectedControlIds]);

  return (
    <div className="border rounded-lg bg-gray-50 fade-in">
      {/* Header */}
      <div className="p-4 border-b bg-white rounded-t-lg">
        <h3 className="text-sm font-bold mb-1">Select NIST 800-53 Controls</h3>
        <p className="text-xs text-gray-500 mb-3">Choose which controls to include in your SSP</p>
        <Input
          type="search"
          placeholder="Search controls..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-3"
          disabled={isLoading}
        />
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleSelectAllBaseline}
            type="button"
            disabled={isLoading}
          >
            Select All
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={handleClearAll}
            type="button"
            disabled={isLoading}
          >
            Clear All
          </Button>
        </div>
        {isLoading ? (
          <p className="text-xs text-gray-600 skeleton-loading">Loading controls...</p>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-4 h-4 ${
              selectedControlIds.length === 0 ? 'text-gray-400' :
              selectedControlIds.length < Object.keys(availableControls).length / 2 ? 'text-amber-500' :
              'text-green-500'
            }`} />
            <p className={`text-xs font-medium ${
              selectedControlIds.length === 0 ? 'text-gray-600' :
              selectedControlIds.length < Object.keys(availableControls).length / 2 ? 'text-amber-700' :
              'text-green-700'
            }`}>
              {selectedControlIds.length} of {Object.keys(availableControls).length} selected
              {Object.keys(availableControls).length > 0 && (
                <span className="ml-1">
                  ({Math.round((selectedControlIds.length / Object.keys(availableControls).length) * 100)}%)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Control Families List - Virtualized for performance with 1000+ controls */}
      <div className="bg-gray-50">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg bg-white p-3 skeleton-loading">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <VirtualizedControlList
            families={filteredFamilies}
            expandedFamilies={expandedFamilies}
            selectedControlIds={selectedControlIds}
            onToggleFamily={toggleFamily}
            onToggleControl={handleControlToggle}
            onToggleAllInFamily={handleSelectAllInFamily}
            getFamilyStatus={getFamilyStatus}
            height={384} // Matches the original max-h-96
          />
        )}
      </div>
    </div>
  );
};

