/**
 * tRPC Type Definitions for Renderer Process
 * Provides type-safe inference for database operations
 */
import type { NistBaseline, Project, AppNode, AppEdge } from '@/lib/utils/types';
import type { DeviceRecord } from '@/window.d';
import type { DeltaSaveResult, SerializedDiagramDelta } from '@/core/types/delta.types';

/**
 * Viewport type for diagram state
 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Control narrative record
 * narrative is optional for input, required for output
 */
export interface ControlNarrative {
  control_id: string;
  narrative?: string;
  system_implementation?: string;
  implementation_status?: string;
}

/**
 * Device query filters
 */
export interface DeviceQueryFilters {
  deviceType?: string;
  manufacturer?: string;
  location?: string;
  status?: string;
  missionCritical?: boolean;
  encryptionAtRest?: boolean;
}

/**
 * SSP Metadata type
 */
export interface SSPMetadata {
  organization_name?: string;
  prepared_by?: string;
  system_description?: string;
  system_purpose?: string;
  deployment_model?: string;
  service_model?: string;
  information_type_title?: string;
  information_type_description?: string;
  confidentiality_impact?: 'low' | 'moderate' | 'high';
  integrity_impact?: 'low' | 'moderate' | 'high';
  availability_impact?: 'low' | 'moderate' | 'high';
  authorization_boundary_description?: string;
  system_status?: string;
  system_owner?: string;
  system_owner_email?: string;
  authorizing_official?: string;
  authorizing_official_email?: string;
  security_contact?: string;
  security_contact_email?: string;
  physical_location?: string;
  data_types_processed?: string;
  users_description?: string;
  unedited_controls_mode?: string;
  on_premises_details?: string;
  cloud_provider?: string;
  custom_sections?: string;
  selected_control_ids?: string;
  topology_screenshot?: string;
}

/**
 * Database operation types for tRPC procedures
 */
export interface DatabaseOperations {
  // Queries (read operations)
  listProjects: () => Promise<Project[]>;
  loadDiagram: (projectId: number) => Promise<{ nodes: AppNode[]; edges: AppEdge[]; viewport: Viewport | null }>;
  loadControlNarratives: (projectId: number) => Promise<ControlNarrative[]>;
  getSSPMetadata: (projectId: number) => Promise<SSPMetadata | null>;
  queryDevices: (projectId: number, filters?: DeviceQueryFilters) => Promise<DeviceRecord[]>;
  getDevice: (projectId: number, deviceId: string) => Promise<DeviceRecord | null>;
  searchDevices: (projectId: number, searchTerm: string) => Promise<DeviceRecord[]>;

  // Mutations (write operations)
  createProject: (name: string, baseline?: NistBaseline) => Promise<Project>;
  deleteProject: (projectId: number) => Promise<{ success: boolean }>;
  saveDiagram: (projectId: number, nodes: AppNode[], edges: AppEdge[], viewport: Viewport | null) => Promise<{ success: boolean; isDelta?: boolean }>;
  saveDiagramDelta: (delta: SerializedDiagramDelta) => Promise<DeltaSaveResult>;
  saveControlNarratives: (projectId: number, narratives: ControlNarrative[]) => Promise<{ success: boolean }>;
  saveSingleControlNarrative: (projectId: number, controlId: string, systemImplementation: string, implementationStatus?: string) => Promise<{ success: boolean }>;
  resetControlNarrative: (projectId: number, controlId: string) => Promise<{ success: boolean }>;
  updateProjectBaseline: (projectId: number, baseline: NistBaseline) => Promise<{ success: boolean; baseline: NistBaseline }>;
  saveSSPMetadata: (projectId: number, metadata: SSPMetadata) => Promise<{ success: boolean }>;
}

/**
 * tRPC client shape for type inference
 * This matches the structure of the appRouter from electron/trpc/routers
 */
export interface TRPCClient {
  database: {
    createProject: {
      mutate: (input: { name: string; baseline?: NistBaseline }) => Promise<Project>;
    };
    listProjects: {
      query: () => Promise<Project[]>;
    };
    deleteProject: {
      mutate: (projectId: number) => Promise<{ success: boolean }>;
    };
    saveDiagram: {
      mutate: (input: { projectId: number; nodes: unknown[]; edges: unknown[]; viewport: Viewport | null }) => Promise<{ success: boolean; isDelta?: boolean }>;
    };
    saveDiagramDelta: {
      mutate: (input: {
        projectId: number;
        nodeChanges?: Array<{ type: 'add' | 'update' | 'remove'; nodeId: string; node?: unknown }>;
        edgeChanges?: Array<{ type: 'add' | 'update' | 'remove'; edgeId: string; edge?: unknown }>;
        sequence?: number;
      }) => Promise<DeltaSaveResult>;
    };
    loadDiagram: {
      query: (projectId: number) => Promise<{ nodes: AppNode[]; edges: AppEdge[]; viewport: Viewport | null }>;
    };
    loadControlNarratives: {
      query: (projectId: number) => Promise<ControlNarrative[]>;
    };
    saveControlNarratives: {
      mutate: (input: { projectId: number; narratives: ControlNarrative[] }) => Promise<{ success: boolean }>;
    };
    saveSingleControlNarrative: {
      mutate: (input: { projectId: number; controlId: string; systemImplementation: string; implementationStatus?: string }) => Promise<{ success: boolean }>;
    };
    resetControlNarrative: {
      mutate: (input: { projectId: number; controlId: string }) => Promise<{ success: boolean }>;
    };
    updateProjectBaseline: {
      mutate: (input: { projectId: number; baseline: NistBaseline }) => Promise<{ success: boolean; baseline: NistBaseline }>;
    };
    getSSPMetadata: {
      query: (projectId: number) => Promise<SSPMetadata | null>;
    };
    saveSSPMetadata: {
      mutate: (input: { projectId: number; metadata: unknown }) => Promise<{ success: boolean }>;
    };
    queryDevices: {
      query: (input: { projectId: number; filters?: DeviceQueryFilters }) => Promise<DeviceRecord[]>;
    };
    getDevice: {
      query: (input: { projectId: number; deviceId: string }) => Promise<DeviceRecord | null>;
    };
    searchDevices: {
      query: (input: { projectId: number; searchTerm: string }) => Promise<DeviceRecord[]>;
    };
  };
}
