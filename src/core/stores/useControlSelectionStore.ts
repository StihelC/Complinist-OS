import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ControlPriority, AppNode, AppEdge } from '@/lib/utils/types';
import priorityMappings from '@/assets/catalog/control-priorities.json';
import { getControlRecommendations } from '@/lib/controls/controlRecommendations';

interface ControlSelectionState {
  selectedControlIds: string[];
  initialized: boolean;
  
  // Actions
  setSelectedControlIds: (ids: string[]) => void;
  toggleControl: (controlId: string) => void;
  selectByPriority: (priorities: ControlPriority[]) => void;
  selectAll: (allControlIds: string[]) => void;
  clearAll: () => void;
  applyRecommendations: (recommendedIds: string[]) => void;
  initializeSmartDefaults: (nodes: AppNode[], edges: AppEdge[], allControlIds: string[]) => void;
  isSelected: (controlId: string) => boolean;
  getSelectedCount: () => number;
}

/**
 * Unified Control Selection Store
 * Single source of truth for control selection across SSP Generator and Control Narratives
 */
export const useControlSelectionStore = create<ControlSelectionState>()(
  devtools(
    (set, get) => ({
      selectedControlIds: [],
      initialized: false,

      setSelectedControlIds: (ids) => set({ 
        selectedControlIds: ids,
        initialized: true
      }),

      toggleControl: (controlId) => set((state) => {
        const isCurrentlySelected = state.selectedControlIds.includes(controlId);
        return {
          selectedControlIds: isCurrentlySelected
            ? state.selectedControlIds.filter(id => id !== controlId)
            : [...state.selectedControlIds, controlId]
        };
      }),

      selectByPriority: (priorities) => set((state) => {
        // const prioritySet = new Set(priorities); // Unused - kept for potential future use
        const selectedIds = new Set(state.selectedControlIds);
        
        // Add all controls matching the specified priorities
        priorities.forEach(priority => {
          const controlsForPriority = priorityMappings[priority] as string[];
          if (controlsForPriority) {
            controlsForPriority.forEach(id => selectedIds.add(id));
          }
        });
        
        return {
          selectedControlIds: Array.from(selectedIds),
          initialized: true
        };
      }),

      selectAll: (allControlIds) => set({ 
        selectedControlIds: [...allControlIds],
        initialized: true
      }),

      clearAll: () => set({ 
        selectedControlIds: [],
        initialized: true
      }),

      applyRecommendations: (recommendedIds) => set((state) => {
        const selectedSet = new Set(state.selectedControlIds);
        recommendedIds.forEach(id => selectedSet.add(id));
        return {
          selectedControlIds: Array.from(selectedSet),
          initialized: true
        };
      }),

      initializeSmartDefaults: (nodes, edges, allControlIds) => {
        const state = get();
        
        // Only initialize if not already done
        if (state.initialized || state.selectedControlIds.length > 0) {
          return;
        }
        
        // Start with Critical controls
        const criticalControls = priorityMappings.critical as string[];
        const selectedSet = new Set(criticalControls.filter(id => allControlIds.includes(id)));
        
        // Add topology recommendations
        const recommendations = getControlRecommendations(nodes, edges);
        recommendations.forEach(rec => {
          if (allControlIds.includes(rec.controlId)) {
            selectedSet.add(rec.controlId);
          }
        });
        
        set({
          selectedControlIds: Array.from(selectedSet),
          initialized: true
        });
      },

      isSelected: (controlId) => {
        return get().selectedControlIds.includes(controlId);
      },

      getSelectedCount: () => {
        return get().selectedControlIds.length;
      },
    }),
    { name: 'ControlSelectionStore' }
  )
);

