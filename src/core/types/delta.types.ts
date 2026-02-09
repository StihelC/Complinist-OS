/**
 * Delta-based save system types
 *
 * This module defines types for tracking incremental changes to diagram nodes and edges,
 * enabling efficient saves that only transmit changed entities instead of the full diagram.
 */

import { AppNode, AppEdge } from './topology.types';

/**
 * Types of changes that can occur to nodes/edges
 */
export type ChangeType = 'add' | 'update' | 'remove';

/**
 * Represents a change to a single node
 */
export interface NodeChange {
  type: ChangeType;
  nodeId: string;
  /** Full node data for 'add' and 'update' operations */
  node?: AppNode;
  /** Timestamp when change occurred */
  timestamp: number;
}

/**
 * Represents a change to a single edge
 */
export interface EdgeChange {
  type: ChangeType;
  edgeId: string;
  /** Full edge data for 'add' and 'update' operations */
  edge?: AppEdge;
  /** Timestamp when change occurred */
  timestamp: number;
}

/**
 * A batch of changes to be saved
 */
export interface DiagramDelta {
  /** Changed nodes since last save */
  nodeChanges: NodeChange[];
  /** Changed edges since last save */
  edgeChanges: EdgeChange[];
  /** Sequence number to detect missed deltas */
  sequence: number;
  /** Hash of the last known full state (for verification) */
  lastStateHash?: string;
}

/**
 * Response from the delta save operation
 */
export interface DeltaSaveResult {
  success: boolean;
  /** If delta was rejected, full save is required */
  requiresFullSave?: boolean;
  /** Current sequence number on server */
  serverSequence?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * State tracking for delta saves
 */
export interface DeltaTrackingState {
  /** Current sequence number */
  sequence: number;
  /** Pending node changes not yet saved */
  pendingNodeChanges: Map<string, NodeChange>;
  /** Pending edge changes not yet saved */
  pendingEdgeChanges: Map<string, EdgeChange>;
  /** Last saved state hash for verification */
  lastSavedStateHash: string | null;
  /** Whether delta tracking is active */
  isActive: boolean;
  /** Timestamp of last successful save */
  lastSaveTimestamp: number | null;
}

/**
 * Compressed delta format for IPC transfer
 * Uses arrays instead of Maps for JSON serialization
 */
export interface SerializedDiagramDelta {
  projectId: number;
  nodeChanges: Array<{
    type: ChangeType;
    nodeId: string;
    node?: AppNode;
  }>;
  edgeChanges: Array<{
    type: ChangeType;
    edgeId: string;
    edge?: AppEdge;
  }>;
  sequence: number;
}

/**
 * Full state snapshot for periodic verification saves
 * or when delta chain becomes too long
 */
export interface StateSnapshot {
  nodes: AppNode[];
  edges: AppEdge[];
  sequence: number;
  timestamp: number;
  stateHash: string;
}

/**
 * Constants for delta save behavior
 */
export const DELTA_SAVE_CONFIG = {
  /** Maximum pending changes before forcing a full save */
  MAX_PENDING_CHANGES: 50,
  /** Maximum time (ms) between full saves for data integrity */
  MAX_TIME_BETWEEN_FULL_SAVES: 5 * 60 * 1000, // 5 minutes
  /** Debounce delay for batching rapid changes */
  DEBOUNCE_DELAY_MS: 1000,
  /** Maximum delta chain length before consolidation */
  MAX_DELTA_CHAIN_LENGTH: 100,
} as const;
