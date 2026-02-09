import { AppNode, AppEdge, Project, NistBaseline } from '@/lib/utils/types';
import type { DeviceRecord, DeviceQueryFilters } from '@/window.d';
import type { SerializedDiagramDelta, DeltaSaveResult } from '@/core/types/delta.types';
import { getTRPCClient } from '@/lib/trpc/client';

// Viewport type for diagram saving/loading
interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Check if tRPC client is available (electron-trpc is loaded)
 * Falls back to legacy electronAPI if not available
 */
function getTRPC() {
  return getTRPCClient();
}

/**
 * Database wrapper for Electron IPC calls
 * Uses tRPC for type-safe communication when available,
 * falls back to legacy window.electronAPI otherwise
 */
export const db = {
  createProject: async (name: string, baseline: NistBaseline): Promise<Project> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.createProject.mutate({ name, baseline });
        return result as Project;
      } catch (error) {
        console.warn('[db] tRPC createProject failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      // Return mock project for browser mode
      return {
        id: Date.now(),
        name,
        baseline,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return window.electronAPI.createProject({ name, baseline });
  },

  listProjects: async (): Promise<Project[]> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.listProjects.query();
        return result as Project[];
      } catch (error) {
        console.warn('[db] tRPC listProjects failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.listProjects();
  },

  saveDiagram: async (
    projectId: number,
    nodes: AppNode[],
    edges: AppEdge[],
    viewport: Viewport | null
  ): Promise<{ success: boolean; isDelta?: boolean }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.saveDiagram.mutate({
          projectId,
          nodes: nodes as unknown[],
          edges: edges as unknown[],
          viewport
        });
        return result;
      } catch (error) {
        console.warn('[db] tRPC saveDiagram failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false };
    }
    return window.electronAPI.saveDiagram({ projectId, nodes, edges, viewport });
  },

  /**
   * Save diagram using delta-based approach
   * Only sends changed nodes/edges to reduce IPC overhead
   */
  saveDiagramDelta: async (delta: SerializedDiagramDelta): Promise<DeltaSaveResult> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.saveDiagramDelta.mutate({
          projectId: delta.projectId,
          nodeChanges: delta.nodeChanges as Array<{ type: 'add' | 'update' | 'remove'; nodeId: string; node?: unknown }>,
          edgeChanges: delta.edgeChanges as Array<{ type: 'add' | 'update' | 'remove'; edgeId: string; edge?: unknown }>,
          sequence: delta.sequence,
        });
        return result as DeltaSaveResult;
      } catch (error) {
        console.warn('[db] tRPC saveDiagramDelta failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false, requiresFullSave: true, error: 'Electron API not available' };
    }
    return window.electronAPI.saveDiagramDelta(delta);
  },

  loadDiagram: async (projectId: number): Promise<{ nodes: AppNode[]; edges: AppEdge[]; viewport: { x: number; y: number; zoom: number } }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.loadDiagram.query(projectId);
        return result as { nodes: AppNode[]; edges: AppEdge[]; viewport: { x: number; y: number; zoom: number } };
      } catch (error) {
        console.warn('[db] tRPC loadDiagram failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    }
    return window.electronAPI.loadDiagram(projectId);
  },

  deleteProject: async (projectId: number): Promise<{ success: boolean }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.deleteProject.mutate(projectId);
        return result;
      } catch (error) {
        console.warn('[db] tRPC deleteProject failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false };
    }
    return window.electronAPI.deleteProject(projectId);
  },

  loadControlNarratives: async (
    projectId: number
  ): Promise<Array<{ control_id: string; narrative: string; system_implementation?: string; implementation_status?: string }>> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.loadControlNarratives.query(projectId);
        return result as Array<{ control_id: string; narrative: string; system_implementation?: string; implementation_status?: string }>;
      } catch (error) {
        console.warn('[db] tRPC loadControlNarratives failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.loadControlNarratives(projectId);
  },

  saveControlNarratives: async (
    projectId: number,
    narratives: Array<{ control_id: string; narrative?: string; system_implementation?: string; implementation_status?: string }>
  ): Promise<{ success: boolean }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.saveControlNarratives.mutate({ projectId, narratives });
        return result;
      } catch (error) {
        console.warn('[db] tRPC saveControlNarratives failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false };
    }
    return window.electronAPI.saveControlNarratives({ projectId, narratives });
  },

  updateProjectBaseline: async (
    projectId: number,
    baseline: NistBaseline
  ): Promise<{ success: boolean; baseline: NistBaseline }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.updateProjectBaseline.mutate({ projectId, baseline });
        return result as { success: boolean; baseline: NistBaseline };
      } catch (error) {
        console.warn('[db] tRPC updateProjectBaseline failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false, baseline };
    }
    return window.electronAPI.updateProjectBaseline({ projectId, baseline });
  },

  resetControlNarrative: async (
    projectId: number,
    controlId: string
  ): Promise<{ success: boolean }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.resetControlNarrative.mutate({ projectId, controlId });
        return result;
      } catch (error) {
        console.warn('[db] tRPC resetControlNarrative failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false };
    }
    return window.electronAPI.resetControlNarrative({ projectId, controlId });
  },

  saveSingleControlNarrative: async (
    projectId: number,
    controlId: string,
    systemImplementation: string,
    implementationStatus?: string
  ): Promise<{ success: boolean }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.saveSingleControlNarrative.mutate({
          projectId,
          controlId,
          systemImplementation,
          implementationStatus,
        });
        return result;
      } catch (error) {
        console.warn('[db] tRPC saveSingleControlNarrative failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false };
    }
    return window.electronAPI.saveSingleControlNarrative({
      projectId,
      controlId,
      systemImplementation,
      implementationStatus,
    });
  },

  // Device query operations
  queryDevices: async (
    projectId: number,
    filters?: DeviceQueryFilters
  ): Promise<DeviceRecord[]> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.queryDevices.query({ projectId, filters: filters || {} });
        return result as DeviceRecord[];
      } catch (error) {
        console.warn('[db] tRPC queryDevices failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.queryDevices({ projectId, filters: filters || {} });
  },

  getDevice: async (projectId: number, deviceId: string): Promise<DeviceRecord | null> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.getDevice.query({ projectId, deviceId });
        return result as DeviceRecord | null;
      } catch (error) {
        console.warn('[db] tRPC getDevice failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return null;
    }
    return window.electronAPI.getDevice({ projectId, deviceId });
  },

  searchDevices: async (projectId: number, searchTerm: string): Promise<DeviceRecord[]> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.searchDevices.query({ projectId, searchTerm });
        return result as DeviceRecord[];
      } catch (error) {
        console.warn('[db] tRPC searchDevices failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.searchDevices({ projectId, searchTerm });
  },

  // SSP Metadata operations
  getSSPMetadata: async (projectId: number): Promise<unknown | null> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.getSSPMetadata.query(projectId);
        return result;
      } catch (error) {
        console.warn('[db] tRPC getSSPMetadata failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return null;
    }
    return window.electronAPI.getSSPMetadata(projectId);
  },

  saveSSPMetadata: async (projectId: number, metadata: unknown): Promise<{ success: boolean }> => {
    const trpc = getTRPC();
    if (trpc) {
      try {
        const result = await trpc.database.saveSSPMetadata.mutate({ projectId, metadata });
        return result;
      } catch (error) {
        console.warn('[db] tRPC saveSSPMetadata failed, falling back to legacy IPC:', error);
      }
    }

    if (!window.electronAPI) {
      return { success: false };
    }
    return window.electronAPI.saveSSPMetadata({ projectId, metadata });
  },
};

// Debounce helper
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    const context = this;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
