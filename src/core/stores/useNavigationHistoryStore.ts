import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface RecentlyEditedControl {
  controlId: string;
  family: string;
  title: string;
  editedAt: string;
  implementationStatus?: string;
}

export interface NavigationPath {
  type: 'family' | 'control';
  id: string;
  name: string;
}

interface NavigationHistoryState {
  // Recently edited controls (persisted)
  recentlyEdited: RecentlyEditedControl[];
  // Current navigation path for breadcrumbs
  currentPath: NavigationPath[];
  // Expanded families tracking
  expandedFamilies: Set<string>;
  // Selected control for quick navigation
  selectedControlId: string | null;

  // Actions
  addRecentlyEdited: (control: RecentlyEditedControl) => void;
  removeFromRecent: (controlId: string) => void;
  clearRecentHistory: () => void;
  setCurrentPath: (path: NavigationPath[]) => void;
  navigateToFamily: (familyCode: string, familyName: string) => void;
  navigateToControl: (controlId: string, controlTitle: string, familyCode: string, familyName: string) => void;
  clearPath: () => void;
  toggleFamily: (familyCode: string) => void;
  expandFamily: (familyCode: string) => void;
  collapseFamily: (familyCode: string) => void;
  setSelectedControl: (controlId: string | null) => void;
}

const MAX_RECENT_CONTROLS = 15;

export const useNavigationHistoryStore = create<NavigationHistoryState>()(
  devtools(
    persist(
      (set, get) => ({
        recentlyEdited: [],
        currentPath: [],
        expandedFamilies: new Set(),
        selectedControlId: null,

        addRecentlyEdited: (control) => {
          set((state) => {
            // Remove existing entry for this control if exists
            const filtered = state.recentlyEdited.filter(
              (c) => c.controlId !== control.controlId
            );

            // Add new entry at the beginning
            const updated = [
              { ...control, editedAt: new Date().toISOString() },
              ...filtered,
            ].slice(0, MAX_RECENT_CONTROLS);

            return { recentlyEdited: updated };
          });
        },

        removeFromRecent: (controlId) => {
          set((state) => ({
            recentlyEdited: state.recentlyEdited.filter(
              (c) => c.controlId !== controlId
            ),
          }));
        },

        clearRecentHistory: () => {
          set({ recentlyEdited: [] });
        },

        setCurrentPath: (path) => {
          set({ currentPath: path });
        },

        navigateToFamily: (familyCode, familyName) => {
          set({
            currentPath: [
              { type: 'family', id: familyCode, name: familyName },
            ],
            selectedControlId: null,
          });
        },

        navigateToControl: (controlId, controlTitle, familyCode, familyName) => {
          set({
            currentPath: [
              { type: 'family', id: familyCode, name: familyName },
              { type: 'control', id: controlId, name: controlTitle },
            ],
            selectedControlId: controlId,
          });

          // Also expand the family
          get().expandFamily(familyCode);
        },

        clearPath: () => {
          set({ currentPath: [], selectedControlId: null });
        },

        toggleFamily: (familyCode) => {
          set((state) => {
            const newExpanded = new Set(state.expandedFamilies);
            if (newExpanded.has(familyCode)) {
              newExpanded.delete(familyCode);
            } else {
              newExpanded.add(familyCode);
            }
            return { expandedFamilies: newExpanded };
          });
        },

        expandFamily: (familyCode) => {
          set((state) => {
            const newExpanded = new Set(state.expandedFamilies);
            newExpanded.add(familyCode);
            return { expandedFamilies: newExpanded };
          });
        },

        collapseFamily: (familyCode) => {
          set((state) => {
            const newExpanded = new Set(state.expandedFamilies);
            newExpanded.delete(familyCode);
            return { expandedFamilies: newExpanded };
          });
        },

        setSelectedControl: (controlId) => {
          set({ selectedControlId: controlId });
        },
      }),
      {
        name: 'complinist-navigation-history',
        // Only persist recentlyEdited, not the current path or expanded families
        partialize: (state) => ({
          recentlyEdited: state.recentlyEdited,
        }),
        // Handle Set serialization
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const parsed = JSON.parse(str);
            return {
              ...parsed,
              state: {
                ...parsed.state,
                expandedFamilies: new Set(),
                currentPath: [],
                selectedControlId: null,
              },
            };
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            localStorage.removeItem(name);
          },
        },
      }
    ),
    { name: 'NavigationHistoryStore' }
  )
);

// Helper to get family code from control ID (e.g., "AC-2" -> "AC", "SC-7.1" -> "SC")
export function getFamilyFromControlId(controlId: string): string {
  const match = controlId.match(/^([A-Z]{2})/);
  return match ? match[1] : '';
}

// Selectors for optimized re-renders
export const selectRecentlyEdited = (state: NavigationHistoryState) => state.recentlyEdited;
export const selectCurrentPath = (state: NavigationHistoryState) => state.currentPath;
export const selectExpandedFamilies = (state: NavigationHistoryState) => state.expandedFamilies;
export const selectSelectedControlId = (state: NavigationHistoryState) => state.selectedControlId;
