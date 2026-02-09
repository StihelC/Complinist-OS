/**
 * Duplicate Resource Detection
 *
 * Detects collisions between incoming Terraform resources and existing
 * topology nodes to prevent accidental overwrites or merges.
 */

import type { TerraformResourceChange } from '../terraformTypes';
import type { AppNode, DeviceNodeData, BoundaryNodeData } from '@/core/types/topology.types';
import type {
  DuplicateDetectionResult,
  ResourceCollision,
  ExternalResourceId,
  CollisionType,
} from './types';
import { generateExternalId, parseExternalId } from './externalIdGenerator';

/**
 * Type guard to check if node data is DeviceNodeData
 */
function isDeviceNodeData(data: DeviceNodeData | BoundaryNodeData): data is DeviceNodeData {
  return 'deviceType' in data;
}


/**
 * Extract external ID from an existing node
 *
 * @param node - The topology node
 * @returns The external ID if present, null otherwise
 */
export function extractExternalIdFromNode(node: AppNode): ExternalResourceId | null {
  const data = node.data as DeviceNodeData | BoundaryNodeData;

  // Check if the node has an external ID stored
  if (data.externalId) {
    return parseExternalId(data.externalId);
  }

  // Try to reconstruct from terraformAddress if available
  if (data.terraformAddress && data.terraformType) {
    // We don't have the provider info, so we can't fully reconstruct
    // But we can still use the terraform address for matching
    return null;
  }

  return null;
}

/**
 * Get the terraform address from a node if available
 */
export function getTerraformAddressFromNode(node: AppNode): string | null {
  const data = node.data as DeviceNodeData | BoundaryNodeData;
  return data.terraformAddress || null;
}

/**
 * Build a map of external IDs to existing nodes
 *
 * @param nodes - Existing topology nodes
 * @returns Map from external ID full string to node
 */
export function buildExternalIdMap(nodes: AppNode[]): Map<string, AppNode> {
  const map = new Map<string, AppNode>();

  for (const node of nodes) {
    const externalId = extractExternalIdFromNode(node);
    if (externalId) {
      map.set(externalId.fullId, node);
    }
  }

  return map;
}

/**
 * Build a map of terraform addresses to existing nodes
 *
 * @param nodes - Existing topology nodes
 * @returns Map from terraform address to node
 */
export function buildTerraformAddressMap(nodes: AppNode[]): Map<string, AppNode> {
  const map = new Map<string, AppNode>();

  for (const node of nodes) {
    const address = getTerraformAddressFromNode(node);
    if (address) {
      map.set(address, node);
    }
  }

  return map;
}

/**
 * Find a node by its terraform address
 *
 * @param nodes - Existing topology nodes
 * @param address - Terraform address to search for
 * @returns The matching node or null
 */
export function findByTerraformAddress(nodes: AppNode[], address: string): AppNode | null {
  for (const node of nodes) {
    const nodeAddress = getTerraformAddressFromNode(node);
    if (nodeAddress === address) {
      return node;
    }
  }
  return null;
}

/**
 * Find a node by name (looser match)
 *
 * @param nodes - Existing topology nodes
 * @param name - Resource name to search for
 * @param resourceType - Optional resource type to narrow search
 * @returns Matching nodes
 */
export function findByName(
  nodes: AppNode[],
  name: string,
  resourceType?: string
): AppNode[] {
  const matches: AppNode[] = [];

  for (const node of nodes) {
    const data = node.data as DeviceNodeData | BoundaryNodeData;

    // Check name match
    const nodeName = isDeviceNodeData(data) ? data.name : data.label;
    if (nodeName !== name) {
      continue;
    }

    // If resource type specified, check terraform type
    if (resourceType && data.terraformType !== resourceType) {
      continue;
    }

    matches.push(node);
  }

  return matches;
}

/**
 * Detect duplicate resources between incoming Terraform resources
 * and existing topology nodes.
 *
 * @param incomingResources - Resources from Terraform plan
 * @param existingNodes - Current nodes in topology
 * @returns Detection result with new resources, collisions, and references
 */
export function detectDuplicates(
  incomingResources: TerraformResourceChange[],
  existingNodes: AppNode[]
): DuplicateDetectionResult {
  const newResources: TerraformResourceChange[] = [];
  const collisions: ResourceCollision[] = [];
  const existingReferences = new Map<string, AppNode>();

  // Build lookup maps
  const externalIdMap = buildExternalIdMap(existingNodes);
  const addressMap = buildTerraformAddressMap(existingNodes);

  for (const resource of incomingResources) {
    // Skip data sources and no-op changes that shouldn't create nodes
    if (resource.mode === 'data') {
      continue;
    }

    const incomingExternalId = generateExternalId(resource);
    let collision: ResourceCollision | null = null;

    // Check 1: Exact external ID match
    const exactMatch = externalIdMap.get(incomingExternalId.fullId);
    if (exactMatch) {
      collision = {
        incomingResource: resource,
        incomingExternalId,
        existingNode: exactMatch,
        existingExternalId: extractExternalIdFromNode(exactMatch),
        collisionType: 'exact_match',
      };
    }

    // Check 2: Same terraform address
    if (!collision) {
      const addressMatch = addressMap.get(resource.address);
      if (addressMatch) {
        collision = {
          incomingResource: resource,
          incomingExternalId,
          existingNode: addressMatch,
          existingExternalId: extractExternalIdFromNode(addressMatch),
          collisionType: 'same_address',
        };
      }
    }

    // Check 3: Same name and type (looser match)
    if (!collision) {
      const nameMatches = findByName(existingNodes, resource.name, resource.type);
      if (nameMatches.length > 0) {
        // Use the first match
        const match = nameMatches[0];
        collision = {
          incomingResource: resource,
          incomingExternalId,
          existingNode: match,
          existingExternalId: extractExternalIdFromNode(match),
          collisionType: 'same_name',
        };
      }
    }

    if (collision) {
      collisions.push(collision);
      existingReferences.set(resource.address, collision.existingNode);
    } else {
      newResources.push(resource);
    }
  }

  return {
    newResources,
    collisions,
    existingReferences,
    isClean: collisions.length === 0,
  };
}

/**
 * Apply collision resolutions to get the final list of resources to import
 *
 * @param detectionResult - Result from detectDuplicates
 * @param resolutions - Map of collision index to resolution
 * @returns Resources to import after applying resolutions
 */
export function applyCollisionResolutions(
  detectionResult: DuplicateDetectionResult,
  resolutions: Map<number, ResourceCollision['resolution']>
): {
  toImport: TerraformResourceChange[];
  toReplace: Array<{ resource: TerraformResourceChange; existingNode: AppNode }>;
  skipped: TerraformResourceChange[];
} {
  const toImport: TerraformResourceChange[] = [...detectionResult.newResources];
  const toReplace: Array<{ resource: TerraformResourceChange; existingNode: AppNode }> = [];
  const skipped: TerraformResourceChange[] = [];

  detectionResult.collisions.forEach((collision, index) => {
    const resolution = resolutions.get(index) || collision.resolution || 'skip';

    switch (resolution) {
      case 'skip':
        skipped.push(collision.incomingResource);
        break;
      case 'replace':
        toReplace.push({
          resource: collision.incomingResource,
          existingNode: collision.existingNode,
        });
        break;
      case 'create_new':
        toImport.push(collision.incomingResource);
        break;
      case 'manual':
        // Leave for manual handling
        skipped.push(collision.incomingResource);
        break;
    }
  });

  return { toImport, toReplace, skipped };
}

/**
 * Generate a summary of the duplicate detection results
 */
export function generateDetectionSummary(result: DuplicateDetectionResult): string {
  const lines: string[] = [];

  lines.push(`## Duplicate Detection Summary`);
  lines.push('');
  lines.push(`- **New resources to import:** ${result.newResources.length}`);
  lines.push(`- **Collisions detected:** ${result.collisions.length}`);

  if (result.collisions.length > 0) {
    lines.push('');
    lines.push('### Collisions:');

    const byType: Record<CollisionType, ResourceCollision[]> = {
      exact_match: [],
      same_address: [],
      same_name: [],
    };

    for (const collision of result.collisions) {
      byType[collision.collisionType].push(collision);
    }

    if (byType.exact_match.length > 0) {
      lines.push('');
      lines.push(`**Exact matches (${byType.exact_match.length}):**`);
      for (const c of byType.exact_match) {
        lines.push(`  - \`${c.incomingResource.address}\` → existing node \`${c.existingNode.id}\``);
      }
    }

    if (byType.same_address.length > 0) {
      lines.push('');
      lines.push(`**Same address (${byType.same_address.length}):**`);
      for (const c of byType.same_address) {
        lines.push(`  - \`${c.incomingResource.address}\` → existing node \`${c.existingNode.id}\``);
      }
    }

    if (byType.same_name.length > 0) {
      lines.push('');
      lines.push(`**Same name (${byType.same_name.length}):**`);
      for (const c of byType.same_name) {
        lines.push(`  - \`${c.incomingResource.address}\` → existing node \`${c.existingNode.id}\``);
      }
    }
  }

  return lines.join('\n');
}
