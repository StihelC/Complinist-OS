/**
 * Connection Semantics Verification
 *
 * Enforces valid topology relationships:
 * - Device ↔ Device: Valid network connections
 * - Boundary containment: Uses parentId, not edges
 * - Device → Boundary: Invalid
 * - Boundary → Boundary network: Invalid
 */

import type { AppNode, AppEdge } from '@/core/types/topology.types';
import type {
  ConnectionValidationResult,
  ConnectionSemantics,
  InvalidEdge,
  AutoRepairableEdge,
  EdgeRepairSuggestion,
} from './types';

/**
 * Classify the semantic type of a connection
 */
export function classifyConnectionSemantics(
  sourceType: string | undefined,
  targetType: string | undefined
): ConnectionSemantics {
  // Handle missing types
  if (!sourceType || !targetType) {
    return 'device_to_device'; // Assume valid, let other checks catch issues
  }

  const sourceIsDevice = sourceType === 'device';
  const targetIsDevice = targetType === 'device';
  const sourceIsBoundary = sourceType === 'boundary';
  const targetIsBoundary = targetType === 'boundary';

  if (sourceIsDevice && targetIsDevice) {
    return 'device_to_device';
  }

  if (sourceIsBoundary && targetIsBoundary) {
    // Boundaries connecting to each other via edges is invalid
    // Containment should use parentId
    return 'boundary_network';
  }

  if (sourceIsDevice && targetIsBoundary) {
    return 'device_to_boundary';
  }

  if (sourceIsBoundary && targetIsDevice) {
    return 'boundary_to_device';
  }

  // Default fallback
  return 'device_to_device';
}

/**
 * Check if a device is inside a boundary (directly or through nesting)
 */
function isDeviceInsideBoundary(
  deviceId: string,
  boundaryId: string,
  nodes: AppNode[]
): boolean {
  const device = nodes.find(n => n.id === deviceId);
  if (!device) return false;

  let currentParentId = device.parentId;

  while (currentParentId) {
    if (currentParentId === boundaryId) {
      return true;
    }

    const parent = nodes.find(n => n.id === currentParentId);
    if (!parent) break;

    currentParentId = parent.parentId;
  }

  return false;
}

/**
 * Suggest a repair for an invalid edge
 */
export function suggestRepair(
  edge: AppEdge,
  nodes: AppNode[],
  sourceType: string,
  targetType: string
): EdgeRepairSuggestion | null {
  const sourceIsDevice = sourceType === 'device';
  const targetIsDevice = targetType === 'device';
  const sourceIsBoundary = sourceType === 'boundary';
  const targetIsBoundary = targetType === 'boundary';

  // Device → Boundary
  if (sourceIsDevice && targetIsBoundary) {
    // Check if device is inside the boundary
    if (isDeviceInsideBoundary(edge.source, edge.target, nodes)) {
      return {
        action: 'remove',
        description: `Remove edge: device ${edge.source} is already inside boundary ${edge.target} via containment`,
      };
    }

    // Check if there's a device inside the boundary we could connect to
    const devicesInBoundary = nodes.filter(
      n => n.type === 'device' && isDeviceInsideBoundary(n.id, edge.target, nodes)
    );

    if (devicesInBoundary.length > 0) {
      return {
        action: 'reroute',
        description: `Reroute edge to connect to a device inside the boundary instead`,
        newEdge: {
          ...edge,
          target: devicesInBoundary[0].id,
        },
      };
    }

    return {
      action: 'remove',
      description: `Remove invalid device-to-boundary edge`,
    };
  }

  // Boundary → Device
  if (sourceIsBoundary && targetIsDevice) {
    // Check if device is inside the boundary
    if (isDeviceInsideBoundary(edge.target, edge.source, nodes)) {
      return {
        action: 'remove',
        description: `Remove edge: device ${edge.target} is already inside boundary ${edge.source} via containment`,
      };
    }

    // Check if there's a device inside the boundary we could use as source
    const devicesInBoundary = nodes.filter(
      n => n.type === 'device' && isDeviceInsideBoundary(n.id, edge.source, nodes)
    );

    if (devicesInBoundary.length > 0) {
      return {
        action: 'reroute',
        description: `Reroute edge to originate from a device inside the boundary instead`,
        newEdge: {
          ...edge,
          source: devicesInBoundary[0].id,
        },
      };
    }

    return {
      action: 'remove',
      description: `Remove invalid boundary-to-device edge`,
    };
  }

  // Boundary → Boundary (network connection)
  if (sourceIsBoundary && targetIsBoundary) {
    // Check if one is parent of the other (containment relationship)
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (sourceNode && targetNode) {
      if (targetNode.parentId === edge.source) {
        return {
          action: 'convert_to_containment',
          description: `This appears to be a containment relationship - it should use parentId, not an edge`,
        };
      }
      if (sourceNode.parentId === edge.target) {
        return {
          action: 'convert_to_containment',
          description: `This appears to be a containment relationship - it should use parentId, not an edge`,
        };
      }
    }

    return {
      action: 'remove',
      description: `Remove invalid boundary-to-boundary edge (boundaries don't have network connections)`,
    };
  }

  return null;
}

/**
 * Validate connection semantics for all edges
 *
 * Rules:
 * - Device ↔ Device: Valid
 * - Boundary containment: Should use parentId, not edges
 * - Device → Boundary: Invalid
 * - Boundary → Device: Invalid
 * - Boundary → Boundary (network): Invalid
 */
export function validateConnectionSemantics(
  nodes: AppNode[],
  edges: AppEdge[]
): ConnectionValidationResult {
  // Build node type map for quick lookup
  const nodeTypeMap = new Map<string, string>();
  for (const node of nodes) {
    nodeTypeMap.set(node.id, node.type || 'device');
  }

  const validEdges: AppEdge[] = [];
  const invalidEdges: InvalidEdge[] = [];
  const autoRepairableEdges: AutoRepairableEdge[] = [];

  for (const edge of edges) {
    const sourceType = nodeTypeMap.get(edge.source);
    const targetType = nodeTypeMap.get(edge.target);

    // Check for missing nodes
    if (!sourceType || !targetType) {
      invalidEdges.push({
        edge,
        semantics: 'device_to_device',
        reason: !sourceType
          ? `Source node ${edge.source} not found`
          : `Target node ${edge.target} not found`,
        sourceNodeType: (sourceType as 'device' | 'boundary') || 'device',
        targetNodeType: (targetType as 'device' | 'boundary') || 'device',
      });
      continue;
    }

    const semantics = classifyConnectionSemantics(sourceType, targetType);

    switch (semantics) {
      case 'device_to_device':
        // Valid connection
        validEdges.push(edge);
        break;

      case 'boundary_containment':
        // This should use parentId, not edges
        {
          const invalid: InvalidEdge = {
            edge,
            semantics,
            reason: 'Boundary containment should use parentId relationship, not edges',
            sourceNodeType: sourceType as 'device' | 'boundary',
            targetNodeType: targetType as 'device' | 'boundary',
          };

          const repair = suggestRepair(edge, nodes, sourceType, targetType);
          if (repair) {
            autoRepairableEdges.push({ ...invalid, suggestedRepair: repair });
          } else {
            invalidEdges.push(invalid);
          }
        }
        break;

      case 'device_to_boundary':
        {
          const invalid: InvalidEdge = {
            edge,
            semantics,
            reason: 'Devices cannot connect directly to boundaries. Connect to devices within the boundary instead.',
            sourceNodeType: 'device',
            targetNodeType: 'boundary',
          };

          const repair = suggestRepair(edge, nodes, sourceType, targetType);
          if (repair) {
            autoRepairableEdges.push({ ...invalid, suggestedRepair: repair });
          } else {
            invalidEdges.push(invalid);
          }
        }
        break;

      case 'boundary_to_device':
        {
          const invalid: InvalidEdge = {
            edge,
            semantics,
            reason: 'Boundaries cannot connect directly to devices. Use device-to-device connections instead.',
            sourceNodeType: 'boundary',
            targetNodeType: 'device',
          };

          const repair = suggestRepair(edge, nodes, sourceType, targetType);
          if (repair) {
            autoRepairableEdges.push({ ...invalid, suggestedRepair: repair });
          } else {
            invalidEdges.push(invalid);
          }
        }
        break;

      case 'boundary_network':
        {
          const invalid: InvalidEdge = {
            edge,
            semantics,
            reason: 'Boundaries cannot have network connections to other boundaries. Use containment (parentId) for hierarchy.',
            sourceNodeType: 'boundary',
            targetNodeType: 'boundary',
          };

          const repair = suggestRepair(edge, nodes, sourceType, targetType);
          if (repair) {
            autoRepairableEdges.push({ ...invalid, suggestedRepair: repair });
          } else {
            invalidEdges.push(invalid);
          }
        }
        break;
    }
  }

  // Separate auto-repairable from truly invalid
  const requiresManualReview = invalidEdges.filter(
    e => !autoRepairableEdges.some(r => r.edge.id === e.edge.id)
  );

  return {
    valid: invalidEdges.length === 0 && autoRepairableEdges.length === 0,
    validEdges,
    invalidEdges: [...invalidEdges, ...autoRepairableEdges],
    autoRepairableEdges,
    requiresManualReview,
  };
}

/**
 * Apply auto-repairs to edges
 */
export function applyAutoRepairs<T extends AppEdge>(
  edges: T[],
  repairs: AutoRepairableEdge[]
): {
  repairedEdges: T[];
  removedEdgeIds: string[];
  modifiedEdges: T[];
} {
  const removedEdgeIds: string[] = [];
  const modifiedEdges: T[] = [];
  const edgeMap = new Map(edges.map(e => [e.id, e]));

  for (const repair of repairs) {
    const { edge, suggestedRepair } = repair;

    switch (suggestedRepair.action) {
      case 'remove':
        removedEdgeIds.push(edge.id);
        edgeMap.delete(edge.id);
        break;

      case 'reroute':
        if (suggestedRepair.newEdge) {
          const originalEdge = edgeMap.get(edge.id);
          if (originalEdge) {
            const modified = { ...originalEdge, ...suggestedRepair.newEdge } as T;
            edgeMap.set(edge.id, modified);
            modifiedEdges.push(modified);
          }
        }
        break;

      case 'convert_to_containment':
        // Just remove the edge - containment is handled via parentId
        removedEdgeIds.push(edge.id);
        edgeMap.delete(edge.id);
        break;
    }
  }

  return {
    repairedEdges: Array.from(edgeMap.values()),
    removedEdgeIds,
    modifiedEdges,
  };
}

/**
 * Generate a summary of connection validation results
 */
export function generateConnectionValidationSummary(result: ConnectionValidationResult): string {
  const lines: string[] = [];

  lines.push('## Connection Validation Summary');
  lines.push('');
  lines.push(`**Status:** ${result.valid ? 'PASSED' : 'FAILED'}`);
  lines.push('');
  lines.push(`- Valid edges: ${result.validEdges.length}`);
  lines.push(`- Invalid edges: ${result.invalidEdges.length}`);
  lines.push(`- Auto-repairable: ${result.autoRepairableEdges.length}`);
  lines.push(`- Requires manual review: ${result.requiresManualReview.length}`);
  lines.push('');

  if (result.autoRepairableEdges.length > 0) {
    lines.push('### Auto-Repairable Edges');
    for (const repair of result.autoRepairableEdges) {
      lines.push(`- **${repair.edge.id}**: ${repair.edge.source} → ${repair.edge.target}`);
      lines.push(`  - Issue: ${repair.reason}`);
      lines.push(`  - Suggested repair: ${repair.suggestedRepair.description}`);
    }
    lines.push('');
  }

  if (result.requiresManualReview.length > 0) {
    lines.push('### Requires Manual Review');
    for (const invalid of result.requiresManualReview) {
      lines.push(`- **${invalid.edge.id}**: ${invalid.edge.source} → ${invalid.edge.target}`);
      lines.push(`  - Type: ${invalid.semantics}`);
      lines.push(`  - Issue: ${invalid.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
