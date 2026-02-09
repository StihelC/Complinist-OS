/**
 * Canvas UI Store
 *
 * Manages UI state for the flow canvas including placement modes,
 * boundary drawing, modals, and panels.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DeviceType, BoundaryType } from '@/lib/utils/types';

export interface PlacementModeData {
  deviceType: DeviceType;
  iconFilename: string;
  displayName: string;
  deviceSubtype?: string;
}

export interface BoundaryDrawingModeData {
  type: BoundaryType;
  label: string;
  color: string;
}

interface CanvasUIState {
  // Placement mode
  placementMode: PlacementModeData | null;
  setPlacementMode: (mode: PlacementModeData | null) => void;
  handlePlacementComplete: () => void;

  // Boundary drawing mode
  boundaryDrawingMode: BoundaryDrawingModeData | null;
  setBoundaryDrawingMode: (mode: BoundaryDrawingModeData | null) => void;

  // Panel visibility
  showInventoryPanel: boolean;
  setShowInventoryPanel: (show: boolean) => void;

  // Modal visibility
  showProjectDialog: boolean;
  setShowProjectDialog: (show: boolean) => void;
  showSSPModal: boolean;
  setShowSSPModal: (show: boolean) => void;
  showControlSuggestionModal: boolean;
  setShowControlSuggestionModal: (show: boolean) => void;

  // Control suggestion modal data
  suggestionModalData: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    suggestions: any[];
  } | null;
  setSuggestionModalData: (
    data: {
      deviceId: string;
      deviceName: string;
      deviceType: string;
      suggestions: any[];
    } | null
  ) => void;

  // Export selection state
  exportSelectionMode: boolean;
  exportSelectionBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  savedExportBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  exportSelectionCallback:
    | ((data: {
        bounds: { x: number; y: number; width: number; height: number };
        previewImage: string;
      }) => void)
    | null;

  // Export selection actions
  startExportSelection: (
    callback?: (data: {
      bounds: { x: number; y: number; width: number; height: number };
      previewImage: string;
    }) => void
  ) => void;
  cancelExportSelection: () => void;
  setExportSelectionBounds: (
    bounds: { x: number; y: number; width: number; height: number } | null
  ) => void;
  saveExportBounds: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  clearSavedExportBounds: () => void;
}

export const useCanvasUIStore = create<CanvasUIState>()(
  devtools(
    (set) => ({
      // Placement mode
      placementMode: null,
      setPlacementMode: (mode) => set({ placementMode: mode }),
      handlePlacementComplete: () => set({ placementMode: null }),

      // Boundary drawing mode
      boundaryDrawingMode: null,
      setBoundaryDrawingMode: (mode) => set({ boundaryDrawingMode: mode }),

      // Panels
      showInventoryPanel: false,
      setShowInventoryPanel: (show) => set({ showInventoryPanel: show }),

      // Modals
      showProjectDialog: false,
      setShowProjectDialog: (show) => set({ showProjectDialog: show }),
      showSSPModal: false,
      setShowSSPModal: (show) => set({ showSSPModal: show }),
      showControlSuggestionModal: false,
      setShowControlSuggestionModal: (show) =>
        set({ showControlSuggestionModal: show }),

      // Control suggestion modal data
      suggestionModalData: null,
      setSuggestionModalData: (data) => set({ suggestionModalData: data }),

      // Export selection state
      exportSelectionMode: false,
      exportSelectionBounds: null,
      savedExportBounds: null,
      exportSelectionCallback: null,

      // Export selection actions
      startExportSelection: (callback) =>
        set({
          exportSelectionMode: true,
          exportSelectionBounds: null,
          exportSelectionCallback: callback || null,
        }),
      cancelExportSelection: () =>
        set({
          exportSelectionMode: false,
          exportSelectionBounds: null,
          exportSelectionCallback: null,
        }),
      setExportSelectionBounds: (bounds) =>
        set({ exportSelectionBounds: bounds }),
      saveExportBounds: (bounds) => set({ savedExportBounds: bounds }),
      clearSavedExportBounds: () => set({ savedExportBounds: null }),
    }),
    { name: 'Canvas UI Store' }
  )
);
