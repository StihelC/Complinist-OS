// Database types and interfaces
// Types specific to database operations

export interface DatabaseProject {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  baseline: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface DatabaseDiagram {
  project_id: number;
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
}

export interface DatabaseControlNarrative {
  project_id: number;
  control_id: string;
  narrative?: string;
  system_implementation?: string;
  implementation_status?: string;
}

