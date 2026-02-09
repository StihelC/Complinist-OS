/**
 * Settings Store
 *
 * Manages global settings for the flow canvas including
 * display preferences, grid settings, and React Flow instance.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { GlobalSettings, LayoutSettings } from '@/lib/utils/types';

// Default layout settings
const getDefaultLayoutSettings = (): LayoutSettings => ({
  algorithm: 'elkjs',
  elkAlgorithm: 'mrtree',
  direction: 'RIGHT',
  horizontalSpacing: 50,
  verticalSpacing: 50,
  nodeSpacing: 40,
  rankSpacing: 60,
  boundaryPadding: 45,
  nestedBoundarySpacing: 30,
  edgeRouting: 'smart',
  spacingTier: 'comfortable',
  autoResize: true,
  animate: true,
  animationDuration: 300,
});

// Load global settings from localStorage with defaults
const loadGlobalSettings = (): GlobalSettings => {
  try {
    if (typeof window === 'undefined') {
      return getDefaultSettings();
    }
    const stored = localStorage.getItem('complinist-global-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure backward compatibility - add deviceAttachmentSlots if missing
      // Default to 1 handle per side (fixed count, not dynamic)
      if (parsed.deviceAttachmentSlots === undefined) {
        parsed.deviceAttachmentSlots = 1;
      }
      // Ensure backward compatibility - add boundaryPadding if missing
      if (parsed.boundaryPadding === undefined) {
        parsed.boundaryPadding = 45;
      }
      // Ensure backward compatibility - add useFloatingEdges if missing
      if (parsed.useFloatingEdges === undefined) {
        parsed.useFloatingEdges = true;
      }
      // Ensure backward compatibility - add layoutDebugMode if missing
      if (parsed.layoutDebugMode === undefined) {
        parsed.layoutDebugMode = false;
      }
      // Ensure backward compatibility - add layoutSettings if missing
      if (parsed.layoutSettings === undefined) {
        parsed.layoutSettings = getDefaultLayoutSettings();
      } else {
        // Merge with defaults to ensure all fields exist
        parsed.layoutSettings = { ...getDefaultLayoutSettings(), ...parsed.layoutSettings };
      }
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load global settings:', error);
  }
  return getDefaultSettings();
};

// Save global settings to localStorage
const saveGlobalSettings = (settings: GlobalSettings) => {
  try {
    localStorage.setItem('complinist-global-settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save global settings:', error);
  }
};

// Default settings
const getDefaultSettings = (): GlobalSettings => ({
  globalDeviceLabelSize: 6,
  globalBoundaryLabelSize: 14,
  globalConnectionLabelSize: 12,
  globalDeviceImageSize: 55,
  deviceAttachmentSlots: 1, // Fixed number of handles per side (1-4)
  boundaryPadding: 45, // Internal padding for boundaries (20-150px)
  showGrid: false,
  snapToGrid: false,
  gridSize: 20,
  useFloatingEdges: true, // Default to floating edges for cleaner appearance
  hierarchicalEdgeRouting: false, // Routes edges through parent boundary borders
  layoutDebugMode: false, // Layout debugging off by default
  layoutSettings: getDefaultLayoutSettings(),
});

interface ReactFlowInstanceMethods {
  getNodesBounds: ((nodes: any[]) => any) | null;
  getViewport: (() => { x: number; y: number; zoom: number }) | null;
}

interface SettingsState {
  // Global settings
  globalSettings: GlobalSettings;
  setGlobalSettings: (settings: Partial<GlobalSettings>) => void;

  // React Flow instance methods (set by FlowCanvas)
  reactFlowInstance: ReactFlowInstanceMethods;
  setReactFlowInstance: (instance: {
    getNodesBounds: (nodes: any[]) => any;
    getViewport: () => { x: number; y: number; zoom: number };
  }) => void;

  // Auto-tidy state
  isTidying: boolean;
  tidyProgress: number;
  setIsTidying: (value: boolean) => void;
  setTidyProgress: (value: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      // Global settings - initialized from localStorage
      globalSettings: loadGlobalSettings(),

      setGlobalSettings: (settings) => {
        const newSettings = { ...get().globalSettings, ...settings };
        set({ globalSettings: newSettings });
        saveGlobalSettings(newSettings);
      },

      // React Flow instance methods
      reactFlowInstance: {
        getNodesBounds: null,
        getViewport: null,
      },
      setReactFlowInstance: (instance) => set({ reactFlowInstance: instance }),

      // Auto-tidy state
      isTidying: false,
      tidyProgress: 0,
      setIsTidying: (value) => set({ isTidying: value }),
      setTidyProgress: (value) => set({ tidyProgress: value }),
    }),
    { name: 'Settings Store' }
  )
);
