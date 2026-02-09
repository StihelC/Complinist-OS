/**
 * Selection handling utilities for export
 */

/**
 * Clear all selections before export
 */
export function clearSelections(
  setSelectedNodeId: (id: string | null) => void,
  setSelectedEdgeId: (id: string | null) => void
): void {
  setSelectedNodeId(null);
  setSelectedEdgeId(null);
}

