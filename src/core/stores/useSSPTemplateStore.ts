/**
 * SSP Template Store
 *
 * Manages SSP templates for reuse across similar projects.
 * Templates store metadata and control configurations that can be applied to new SSPs.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { SSPTemplate, SSPSystemCharacteristics, UneditedControlsMode } from '@/core/types/ssp.types';

interface SSPTemplateState {
  templates: SSPTemplate[];
  selectedTemplateId: string | null;

  // Actions
  addTemplate: (template: Omit<SSPTemplate, 'id' | 'createdAt' | 'updatedAt'>) => SSPTemplate;
  updateTemplate: (id: string, updates: Partial<SSPTemplate>) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => SSPTemplate | undefined;
  selectTemplate: (id: string | null) => void;

  // Create template from current SSP metadata
  createFromMetadata: (
    name: string,
    description: string,
    metadata: Partial<SSPSystemCharacteristics>,
    controlConfig?: {
      selectedControlIds?: string[];
      excludedControlIds?: string[];
      uneditedControlsMode?: UneditedControlsMode;
    },
    sourceProject?: { id: number; name: string }
  ) => SSPTemplate;

  // Apply template to get form data
  applyTemplate: (id: string) => {
    metadata: Partial<SSPSystemCharacteristics>;
    controlConfig?: SSPTemplate['controlConfig'];
  } | null;

  // Get templates sorted by last updated
  getSortedTemplates: () => SSPTemplate[];
}

function generateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useSSPTemplateStore = create<SSPTemplateState>()(
  devtools(
    persist(
      (set, get) => ({
        templates: [],
        selectedTemplateId: null,

        addTemplate: (template) => {
          const newTemplate: SSPTemplate = {
            ...template,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set((state) => ({
            templates: [...state.templates, newTemplate],
          }));

          return newTemplate;
        },

        updateTemplate: (id, updates) => {
          set((state) => ({
            templates: state.templates.map((t) =>
              t.id === id
                ? { ...t, ...updates, updatedAt: new Date().toISOString() }
                : t
            ),
          }));
        },

        deleteTemplate: (id) => {
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== id),
            selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId,
          }));
        },

        getTemplate: (id) => {
          return get().templates.find((t) => t.id === id);
        },

        selectTemplate: (id) => {
          set({ selectedTemplateId: id });
        },

        createFromMetadata: (name, description, metadata, controlConfig, sourceProject) => {
          // Clean metadata - remove system-specific values that shouldn't be in templates
          const templateMetadata = { ...metadata };
          // Keep organization-level data, remove system-specific
          delete (templateMetadata as any).system_name; // System name should be unique per project
          delete (templateMetadata as any).topology_screenshot; // Screenshots are project-specific
          delete (templateMetadata as any).authorization_date; // Dates are project-specific

          const newTemplate: SSPTemplate = {
            id: generateId(),
            name,
            description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: templateMetadata,
            controlConfig,
            sourceProjectId: sourceProject?.id,
            sourceProjectName: sourceProject?.name,
          };

          set((state) => ({
            templates: [...state.templates, newTemplate],
          }));

          return newTemplate;
        },

        applyTemplate: (id) => {
          const template = get().templates.find((t) => t.id === id);
          if (!template) return null;

          return {
            metadata: template.metadata,
            controlConfig: template.controlConfig,
          };
        },

        getSortedTemplates: () => {
          return [...get().templates].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        },
      }),
      {
        name: 'complinist-ssp-templates',
        version: 1,
      }
    ),
    { name: 'SSPTemplateStore' }
  )
);
