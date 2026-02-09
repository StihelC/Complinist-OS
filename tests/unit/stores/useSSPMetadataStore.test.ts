import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSSPMetadataStore } from '@/core/stores/sspMetadataStore';
import { useControlSelectionStore } from '@/core/stores/useControlSelectionStore';
import type { CustomSection } from '@/lib/utils/types';

// Mock the control selection store
vi.mock('@/core/stores/useControlSelectionStore', () => ({
  useControlSelectionStore: {
    getState: vi.fn(() => ({
      selectedControlIds: ['AC-2', 'SC-7'],
      setSelectedControlIds: vi.fn(),
      clearAll: vi.fn(),
    })),
  },
}));

// Setup window.electronAPI mock
const mockElectronAPI = {
  getSSPMetadata: vi.fn(),
  saveSSPMetadata: vi.fn(),
};

beforeAll(() => {
  (global as any).window = { electronAPI: mockElectronAPI };
});

afterAll(() => {
  delete (global as any).window;
});

describe('useSSPMetadataStore', () => {
  const mockMetadata = {
    system_name: 'Test System',
    system_owner: 'Test Owner',
    system_description: 'A test system for compliance',
    security_categorization: 'MODERATE',
    authorization_boundary: 'Internal network only',
  };

  const mockCustomSection: CustomSection = {
    id: 'custom-1',
    title: 'Custom Section',
    content: 'Custom content here',
  };

  beforeEach(() => {
    // Reset store state
    useSSPMetadataStore.setState({
      metadata: null,
      selectedControlFamilies: [],
      isDirty: false,
    });

    vi.clearAllMocks();

    // Reset the mock implementations
    vi.mocked(useControlSelectionStore.getState).mockReturnValue({
      selectedControlIds: ['AC-2', 'SC-7'],
      setSelectedControlIds: vi.fn(),
      clearAll: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useSSPMetadataStore.getState();
      expect(state.metadata).toBeNull();
      expect(state.selectedControlFamilies).toEqual([]);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('setMetadata', () => {
    it('should set metadata', () => {
      useSSPMetadataStore.getState().setMetadata(mockMetadata);

      const state = useSSPMetadataStore.getState();
      expect(state.metadata).toEqual(mockMetadata);
      expect(state.isDirty).toBe(true);
    });

    it('should replace existing metadata', () => {
      useSSPMetadataStore.setState({
        metadata: { system_name: 'Old System' },
        selectedControlFamilies: [],
        isDirty: false,
      });

      useSSPMetadataStore.getState().setMetadata(mockMetadata);

      expect(useSSPMetadataStore.getState().metadata?.system_name).toBe('Test System');
    });
  });

  describe('updateMetadata', () => {
    it('should update specific fields', () => {
      useSSPMetadataStore.setState({
        metadata: mockMetadata,
        selectedControlFamilies: [],
        isDirty: false,
      });

      useSSPMetadataStore.getState().updateMetadata({ system_name: 'Updated System' });

      const state = useSSPMetadataStore.getState();
      expect(state.metadata?.system_name).toBe('Updated System');
      expect(state.metadata?.system_owner).toBe('Test Owner'); // Preserved
      expect(state.isDirty).toBe(true);
    });

    it('should merge with null metadata', () => {
      useSSPMetadataStore.getState().updateMetadata({ system_name: 'New System' });

      expect(useSSPMetadataStore.getState().metadata?.system_name).toBe('New System');
    });

    it('should handle multiple updates', () => {
      useSSPMetadataStore.setState({
        metadata: mockMetadata,
        selectedControlFamilies: [],
        isDirty: false,
      });

      useSSPMetadataStore.getState().updateMetadata({ system_name: 'Update 1' });
      useSSPMetadataStore.getState().updateMetadata({ system_owner: 'Update 2' });

      const state = useSSPMetadataStore.getState();
      expect(state.metadata?.system_name).toBe('Update 1');
      expect(state.metadata?.system_owner).toBe('Update 2');
    });
  });

  describe('setSelectedControlFamilies', () => {
    it('should set selected control families', () => {
      useSSPMetadataStore.getState().setSelectedControlFamilies(['AC', 'SC', 'AU']);

      const state = useSSPMetadataStore.getState();
      expect(state.selectedControlFamilies).toEqual(['AC', 'SC', 'AU']);
      expect(state.isDirty).toBe(true);
    });

    it('should replace existing families', () => {
      useSSPMetadataStore.setState({
        metadata: null,
        selectedControlFamilies: ['AC'],
        isDirty: false,
      });

      useSSPMetadataStore.getState().setSelectedControlFamilies(['SC', 'AU']);

      expect(useSSPMetadataStore.getState().selectedControlFamilies).toEqual(['SC', 'AU']);
    });
  });

  describe('loadMetadata', () => {
    it('should load metadata from API', async () => {
      mockElectronAPI.getSSPMetadata.mockResolvedValueOnce(mockMetadata);

      await useSSPMetadataStore.getState().loadMetadata(1);

      const state = useSSPMetadataStore.getState();
      expect(state.metadata?.system_name).toBe('Test System');
      expect(state.isDirty).toBe(false);
    });

    it('should parse JSON fields', async () => {
      mockElectronAPI.getSSPMetadata.mockResolvedValueOnce({
        ...mockMetadata,
        on_premises_details: JSON.stringify({
          data_center_location: 'Building A',
          server_infrastructure: 'Dell servers',
        }),
        selected_control_ids: JSON.stringify(['AC-2', 'AC-3']),
        custom_sections: JSON.stringify([mockCustomSection]),
      });

      const mockSetSelectedControlIds = vi.fn();
      vi.mocked(useControlSelectionStore.getState).mockReturnValue({
        selectedControlIds: [],
        setSelectedControlIds: mockSetSelectedControlIds,
        clearAll: vi.fn(),
      } as any);

      await useSSPMetadataStore.getState().loadMetadata(1);

      const state = useSSPMetadataStore.getState();
      expect(state.metadata?.on_premises_details?.data_center_location).toBe('Building A');
      expect(state.metadata?.custom_sections).toHaveLength(1);
      expect(mockSetSelectedControlIds).toHaveBeenCalledWith(['AC-2', 'AC-3']);
    });

    it('should handle null metadata', async () => {
      mockElectronAPI.getSSPMetadata.mockResolvedValueOnce(null);

      await useSSPMetadataStore.getState().loadMetadata(1);

      expect(useSSPMetadataStore.getState().metadata).toBeNull();
      expect(useSSPMetadataStore.getState().isDirty).toBe(false);
    });

    it('should handle load errors', async () => {
      mockElectronAPI.getSSPMetadata.mockRejectedValueOnce(new Error('Database error'));

      await useSSPMetadataStore.getState().loadMetadata(1);

      expect(useSSPMetadataStore.getState().metadata).toBeNull();
      expect(useSSPMetadataStore.getState().isDirty).toBe(false);
    });

    it('should sanitize null values to empty strings', async () => {
      mockElectronAPI.getSSPMetadata.mockResolvedValueOnce({
        system_name: null,
        system_owner: undefined,
        system_description: 'Valid description',
      });

      await useSSPMetadataStore.getState().loadMetadata(1);

      const state = useSSPMetadataStore.getState();
      expect(state.metadata?.system_name).toBe('');
      expect(state.metadata?.system_owner).toBe('');
      expect(state.metadata?.system_description).toBe('Valid description');
    });
  });

  describe('saveMetadata', () => {
    it('should save metadata to API', async () => {
      useSSPMetadataStore.setState({
        metadata: mockMetadata,
        selectedControlFamilies: [],
        isDirty: true,
      });

      mockElectronAPI.saveSSPMetadata.mockResolvedValueOnce(undefined);

      await useSSPMetadataStore.getState().saveMetadata(1);

      expect(mockElectronAPI.saveSSPMetadata).toHaveBeenCalledWith({
        projectId: 1,
        metadata: expect.objectContaining({
          system_name: 'Test System',
          selected_control_ids: JSON.stringify(['AC-2', 'SC-7']),
        }),
      });
      expect(useSSPMetadataStore.getState().isDirty).toBe(false);
    });

    it('should stringify JSON fields', async () => {
      useSSPMetadataStore.setState({
        metadata: {
          ...mockMetadata,
          on_premises_details: {
            data_center_location: 'Building A',
            physical_security_description: '',
            server_infrastructure: '',
            network_infrastructure: '',
            backup_systems: '',
            disaster_recovery: '',
          },
          custom_sections: [mockCustomSection],
        },
        selectedControlFamilies: [],
        isDirty: true,
      });

      mockElectronAPI.saveSSPMetadata.mockResolvedValueOnce(undefined);

      await useSSPMetadataStore.getState().saveMetadata(1);

      const savedMetadata = mockElectronAPI.saveSSPMetadata.mock.calls[0][0].metadata;
      expect(typeof savedMetadata.on_premises_details).toBe('string');
      expect(typeof savedMetadata.custom_sections).toBe('string');
    });

    it('should not save if no metadata', async () => {
      await useSSPMetadataStore.getState().saveMetadata(1);

      expect(mockElectronAPI.saveSSPMetadata).not.toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      useSSPMetadataStore.setState({
        metadata: mockMetadata,
        selectedControlFamilies: [],
        isDirty: true,
      });

      mockElectronAPI.saveSSPMetadata.mockRejectedValueOnce(new Error('Save failed'));

      await expect(useSSPMetadataStore.getState().saveMetadata(1)).rejects.toThrow('Save failed');
    });
  });

  describe('resetMetadata', () => {
    it('should reset all state', () => {
      const mockClearAll = vi.fn();
      vi.mocked(useControlSelectionStore.getState).mockReturnValue({
        selectedControlIds: ['AC-2'],
        setSelectedControlIds: vi.fn(),
        clearAll: mockClearAll,
      } as any);

      useSSPMetadataStore.setState({
        metadata: mockMetadata,
        selectedControlFamilies: ['AC', 'SC'],
        isDirty: true,
      });

      useSSPMetadataStore.getState().resetMetadata();

      const state = useSSPMetadataStore.getState();
      expect(state.metadata).toBeNull();
      expect(state.selectedControlFamilies).toEqual([]);
      expect(state.isDirty).toBe(false);
      expect(mockClearAll).toHaveBeenCalled();
    });
  });

  describe('setDirty', () => {
    it('should set dirty flag', () => {
      useSSPMetadataStore.getState().setDirty(true);
      expect(useSSPMetadataStore.getState().isDirty).toBe(true);

      useSSPMetadataStore.getState().setDirty(false);
      expect(useSSPMetadataStore.getState().isDirty).toBe(false);
    });
  });

  describe('Custom Sections', () => {
    describe('addCustomSection', () => {
      it('should add custom section', () => {
        useSSPMetadataStore.setState({
          metadata: mockMetadata,
          selectedControlFamilies: [],
          isDirty: false,
        });

        useSSPMetadataStore.getState().addCustomSection(mockCustomSection);

        const state = useSSPMetadataStore.getState();
        expect(state.metadata?.custom_sections).toHaveLength(1);
        expect(state.metadata?.custom_sections?.[0]).toEqual(mockCustomSection);
        expect(state.isDirty).toBe(true);
      });

      it('should append to existing sections', () => {
        useSSPMetadataStore.setState({
          metadata: {
            ...mockMetadata,
            custom_sections: [mockCustomSection],
          },
          selectedControlFamilies: [],
          isDirty: false,
        });

        const newSection: CustomSection = {
          id: 'custom-2',
          title: 'Another Section',
          content: 'More content',
        };

        useSSPMetadataStore.getState().addCustomSection(newSection);

        expect(useSSPMetadataStore.getState().metadata?.custom_sections).toHaveLength(2);
      });

      it('should handle null metadata', () => {
        useSSPMetadataStore.getState().addCustomSection(mockCustomSection);

        expect(useSSPMetadataStore.getState().metadata?.custom_sections).toHaveLength(1);
      });
    });

    describe('updateCustomSection', () => {
      it('should update existing section', () => {
        useSSPMetadataStore.setState({
          metadata: {
            ...mockMetadata,
            custom_sections: [mockCustomSection],
          },
          selectedControlFamilies: [],
          isDirty: false,
        });

        useSSPMetadataStore.getState().updateCustomSection('custom-1', {
          title: 'Updated Title',
        });

        const section = useSSPMetadataStore.getState().metadata?.custom_sections?.[0];
        expect(section?.title).toBe('Updated Title');
        expect(section?.content).toBe('Custom content here'); // Preserved
      });

      it('should not modify non-matching sections', () => {
        const section2: CustomSection = {
          id: 'custom-2',
          title: 'Section 2',
          content: 'Content 2',
        };

        useSSPMetadataStore.setState({
          metadata: {
            ...mockMetadata,
            custom_sections: [mockCustomSection, section2],
          },
          selectedControlFamilies: [],
          isDirty: false,
        });

        useSSPMetadataStore.getState().updateCustomSection('custom-1', { title: 'Updated' });

        const sections = useSSPMetadataStore.getState().metadata?.custom_sections;
        expect(sections?.[1].title).toBe('Section 2');
      });
    });

    describe('deleteCustomSection', () => {
      it('should delete section by id', () => {
        useSSPMetadataStore.setState({
          metadata: {
            ...mockMetadata,
            custom_sections: [mockCustomSection],
          },
          selectedControlFamilies: [],
          isDirty: false,
        });

        useSSPMetadataStore.getState().deleteCustomSection('custom-1');

        expect(useSSPMetadataStore.getState().metadata?.custom_sections).toHaveLength(0);
        expect(useSSPMetadataStore.getState().isDirty).toBe(true);
      });

      it('should only delete matching section', () => {
        const section2: CustomSection = {
          id: 'custom-2',
          title: 'Section 2',
          content: 'Content 2',
        };

        useSSPMetadataStore.setState({
          metadata: {
            ...mockMetadata,
            custom_sections: [mockCustomSection, section2],
          },
          selectedControlFamilies: [],
          isDirty: false,
        });

        useSSPMetadataStore.getState().deleteCustomSection('custom-1');

        const sections = useSSPMetadataStore.getState().metadata?.custom_sections;
        expect(sections).toHaveLength(1);
        expect(sections?.[0].id).toBe('custom-2');
      });

      it('should handle empty custom sections', () => {
        useSSPMetadataStore.setState({
          metadata: mockMetadata,
          selectedControlFamilies: [],
          isDirty: false,
        });

        // Should not throw
        expect(() => {
          useSSPMetadataStore.getState().deleteCustomSection('non-existent');
        }).not.toThrow();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing electronAPI gracefully', async () => {
      const originalElectronAPI = (window as any).electronAPI;
      (window as any).electronAPI = undefined;

      await useSSPMetadataStore.getState().loadMetadata(1);
      expect(useSSPMetadataStore.getState().metadata).toBeNull();

      (window as any).electronAPI = originalElectronAPI;
    });

    it('should handle malformed JSON fields gracefully', async () => {
      mockElectronAPI.getSSPMetadata.mockResolvedValueOnce({
        ...mockMetadata,
        on_premises_details: 'not valid json',
        custom_sections: 'also not valid',
      });

      await useSSPMetadataStore.getState().loadMetadata(1);

      // Should not throw, just use the original string values
      expect(useSSPMetadataStore.getState().metadata).toBeDefined();
    });
  });
});
