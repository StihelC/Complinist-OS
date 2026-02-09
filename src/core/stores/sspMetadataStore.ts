import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { SSPSystemCharacteristics, CustomSection } from '@/lib/utils/types';
import { useControlSelectionStore } from './useControlSelectionStore';
import type { EnhancedNarratives } from '@/lib/ai/narrativeEnhancer';

interface SSPMetadataState {
  metadata: Partial<SSPSystemCharacteristics> | null;
  selectedControlFamilies: string[];
  isDirty: boolean;

  // AI-enhanced narratives (cached per project)
  enhancedNarratives: EnhancedNarratives | null;
  isEnhancing: boolean;
  enhancementError: string | null;

  // Actions
  setMetadata: (metadata: Partial<SSPSystemCharacteristics>) => void;
  updateMetadata: (updates: Partial<SSPSystemCharacteristics>) => void;
  setSelectedControlFamilies: (families: string[]) => void;
  loadMetadata: (projectId: number) => Promise<void>;
  saveMetadata: (projectId: number) => Promise<void>;
  resetMetadata: () => void;
  setDirty: (dirty: boolean) => void;
  addCustomSection: (section: CustomSection) => void;
  updateCustomSection: (id: string, updates: Partial<CustomSection>) => void;
  deleteCustomSection: (id: string) => void;

  // AI enhancement actions
  setEnhancedNarratives: (narratives: EnhancedNarratives | null) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setEnhancementError: (error: string | null) => void;
  clearEnhancedNarratives: () => void;
}

/**
 * Sanitize metadata from database by converting null/undefined values to empty strings
 */
function sanitizeMetadata(metadata: any): Partial<SSPSystemCharacteristics> {
  const sanitized: any = {};
  
  // Helper to ensure string fields are never null/undefined
  const ensureString = (value: any): string => {
    return value ?? '';
  };
  
  // Sanitize all top-level string fields
  for (const key in metadata) {
    const value = metadata[key];
    
    // Handle nested on_premises_details object
    if (key === 'on_premises_details' && typeof value === 'object' && value !== null) {
      sanitized[key] = {
        data_center_location: ensureString(value.data_center_location),
        physical_security_description: ensureString(value.physical_security_description),
        server_infrastructure: ensureString(value.server_infrastructure),
        network_infrastructure: ensureString(value.network_infrastructure),
        backup_systems: ensureString(value.backup_systems),
        disaster_recovery: ensureString(value.disaster_recovery),
      };
    }
    // Handle custom_sections array
    else if (key === 'custom_sections' && Array.isArray(value)) {
      sanitized[key] = value;
    }
    // Handle all string fields
    else if (typeof value === 'string' || value === null || value === undefined) {
      sanitized[key] = ensureString(value);
    }
    // Keep other types as-is (arrays, objects, etc.)
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Track in-flight save operations to prevent duplicates
let saveInProgress = false;
let lastSaveProjectId: number | null = null;

export const useSSPMetadataStore = create<SSPMetadataState>()(
  devtools(
    (set, get) => ({
      metadata: null,
      selectedControlFamilies: [],
      isDirty: false,
      enhancedNarratives: null,
      isEnhancing: false,
      enhancementError: null,

  setMetadata: (metadata) => set({ metadata, isDirty: true }),

  updateMetadata: (updates) => {
    set((state) => ({
      metadata: { ...state.metadata, ...updates },
      isDirty: true,
    }));
  },

  setSelectedControlFamilies: (families) => set({ 
    selectedControlFamilies: families,
    isDirty: true 
  }),

  loadMetadata: async (projectId: number) => {
    try {
      // Check if running in Electron environment
      if (!window.electronAPI?.getSSPMetadata) {
        console.warn('Not running in Electron environment, skipping metadata load');
        set({ metadata: null, isDirty: false });
        return;
      }

      const savedMetadata = await window.electronAPI.getSSPMetadata(projectId);
      
      if (savedMetadata) {
        // Parse JSON fields if they exist
        let parsedMetadata = { ...savedMetadata };
        let parsedControlIds: string[] = [];
        
        if (savedMetadata.on_premises_details && typeof savedMetadata.on_premises_details === 'string') {
          try {
            parsedMetadata.on_premises_details = JSON.parse(savedMetadata.on_premises_details);
          } catch (e) {
            console.warn('Failed to parse on_premises_details:', e);
          }
        }
        
        if (savedMetadata.selected_control_ids && typeof savedMetadata.selected_control_ids === 'string') {
          try {
            parsedControlIds = JSON.parse(savedMetadata.selected_control_ids);
          } catch (e) {
            console.warn('Failed to parse selected_control_ids:', e);
          }
        }
        
        if (savedMetadata.custom_sections && typeof savedMetadata.custom_sections === 'string') {
          try {
            parsedMetadata.custom_sections = JSON.parse(savedMetadata.custom_sections);
          } catch (e) {
            console.warn('Failed to parse custom_sections:', e);
            parsedMetadata.custom_sections = [];
          }
        }
        
        // Sanitize all null/undefined values to prevent React warnings
        const sanitizedMetadata = sanitizeMetadata(parsedMetadata);
        
        // Sync selected control IDs to the shared selection store
        if (parsedControlIds.length > 0) {
          useControlSelectionStore.getState().setSelectedControlIds(parsedControlIds);
        }
        
        set({ 
          metadata: sanitizedMetadata,
          isDirty: false 
        });
      } else {
        set({ metadata: null, isDirty: false });
      }
    } catch (error) {
      console.error('Failed to load SSP metadata:', error);
      set({ metadata: null, isDirty: false });
    }
  },

  saveMetadata: async (projectId: number) => {
    const { metadata } = get();
    
    if (!metadata) {
      console.warn('No metadata to save');
      return;
    }

    // Check if running in Electron environment
    if (!window.electronAPI?.saveSSPMetadata) {
      console.warn('Not running in Electron environment, skipping metadata save');
      return;
    }

    // Prevent duplicate saves for the same project
    if (saveInProgress && lastSaveProjectId === projectId) {
      console.log('[SSPMetadataStore] Save already in progress for project', projectId, '- skipping duplicate');
      return;
    }

    saveInProgress = true;
    lastSaveProjectId = projectId;

    try {
      // Get selected control IDs from the shared selection store
      const selectedControlIds = useControlSelectionStore.getState().selectedControlIds;
      
      // Stringify JSON fields for database storage
      const metadataToSave = { ...metadata } as any;
      
      if (metadataToSave.on_premises_details && typeof metadataToSave.on_premises_details === 'object') {
        metadataToSave.on_premises_details = JSON.stringify(metadataToSave.on_premises_details);
      }
      
      if (metadataToSave.custom_sections && typeof metadataToSave.custom_sections === 'object') {
        metadataToSave.custom_sections = JSON.stringify(metadataToSave.custom_sections);
      }
      
      // Add selected control IDs from shared store
      metadataToSave.selected_control_ids = JSON.stringify(selectedControlIds);
      
      await window.electronAPI.saveSSPMetadata({
        projectId,
        metadata: metadataToSave,
      });
      
      set({ isDirty: false });
    } catch (error) {
      console.error('Failed to save SSP metadata:', error);
      throw error;
    } finally {
      saveInProgress = false;
      // Clear lastSaveProjectId after a short delay to allow for legitimate subsequent saves
      setTimeout(() => {
        if (lastSaveProjectId === projectId) {
          lastSaveProjectId = null;
        }
      }, 100);
    }
  },

  resetMetadata: () => {
    // Also reset the shared selection store
    useControlSelectionStore.getState().clearAll();
    
    set({ 
      metadata: null, 
      selectedControlFamilies: [],
      isDirty: false 
    });
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  addCustomSection: (section) => set((state) => ({
    metadata: {
      ...state.metadata,
      custom_sections: [...(state.metadata?.custom_sections || []), section],
    },
    isDirty: true,
  })),

  updateCustomSection: (id, updates) => set((state) => ({
    metadata: {
      ...state.metadata,
      custom_sections: (state.metadata?.custom_sections || []).map(section =>
        section.id === id ? { ...section, ...updates } : section
      ),
    },
    isDirty: true,
  })),

      deleteCustomSection: (id) => set((state) => ({
        metadata: {
          ...state.metadata,
          custom_sections: (state.metadata?.custom_sections || []).filter(section => section.id !== id),
        },
        isDirty: true,
      })),

      // AI enhancement actions
      setEnhancedNarratives: (narratives) => set({
        enhancedNarratives: narratives,
        enhancementError: null,
      }),

      setIsEnhancing: (isEnhancing) => set({ isEnhancing }),

      setEnhancementError: (error) => set({
        enhancementError: error,
        isEnhancing: false,
      }),

      clearEnhancedNarratives: () => set({
        enhancedNarratives: null,
        enhancementError: null,
      }),
    }),
    { name: 'SSP Metadata Store' }
  )
);

