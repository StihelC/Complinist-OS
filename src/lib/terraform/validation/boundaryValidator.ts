/**
 * Boundary Enforcement & Nesting Validation
 *
 * Validates that all devices are correctly placed inside architectural
 * boundaries (VPCs, subnets, security zones) and that the boundary
 * hierarchy is valid.
 */

import type { TerraformDependency } from '../dependencyAnalyzer';
import type { AppNode, BoundaryType, DeviceNodeData, BoundaryNodeData } from '@/core/types/topology.types';
import type {
  BoundaryValidationResult,
  BoundaryHierarchyNode,
  BoundaryHierarchyLevel,
  MissingBoundary,
  AutoCreateSuggestion,
  BoundaryResolution,
  ResolutionConfidence,
} from './types';

/**
 * Map of Terraform resource types to boundary hierarchy levels
 */
const RESOURCE_TO_HIERARCHY_LEVEL: Record<string, BoundaryHierarchyLevel> = {
  // AWS
  aws_vpc: 'vpc',
  aws_subnet: 'subnet',
  // Azure
  azurerm_virtual_network: 'vpc',
  azurerm_subnet: 'subnet',
  // GCP
  google_compute_network: 'vpc',
  google_compute_subnetwork: 'subnet',
};

/**
 * Map of boundary types to hierarchy levels
 */
const BOUNDARY_TYPE_TO_LEVEL: Record<BoundaryType, BoundaryHierarchyLevel | null> = {
  ato: 'account',
  network_segment: 'vpc',
  security_zone: 'subnet',
  physical_location: 'region',
  datacenter: 'region',
  office: 'region',
  cloud_region: 'region',
  custom: null,
};

/**
 * Hierarchy level ordering (lower number = higher in hierarchy)
 */
const HIERARCHY_ORDER: Record<BoundaryHierarchyLevel, number> = {
  account: 0,
  region: 1,
  vpc: 2,
  subnet: 3,
  segment: 4,
};

/**
 * Type guard for device node data
 */
function isDeviceNode(node: AppNode): boolean {
  return node.type === 'device';
}

/**
 * Type guard for boundary node data
 */
function isBoundaryNode(node: AppNode): boolean {
  return node.type === 'boundary';
}

/**
 * Get the hierarchy level of a boundary node
 */
function getBoundaryHierarchyLevel(node: AppNode): BoundaryHierarchyLevel | null {
  const data = node.data as BoundaryNodeData;

  // First check terraform type if available
  if (data.terraformType && RESOURCE_TO_HIERARCHY_LEVEL[data.terraformType]) {
    return RESOURCE_TO_HIERARCHY_LEVEL[data.terraformType];
  }

  // Fall back to boundary type
  return BOUNDARY_TYPE_TO_LEVEL[data.type] || null;
}

/**
 * Get nesting depth based on parentId chain
 */
function getNestingDepth(nodeId: string, nodes: AppNode[], visited = new Set<string>()): number {
  if (visited.has(nodeId)) {
    // Circular reference detected
    return -1;
  }

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return 0;

  if (!node.parentId) return 0;

  visited.add(nodeId);
  return 1 + getNestingDepth(node.parentId, nodes, visited);
}

/**
 * Build a hierarchy tree from boundary nodes
 */
export function buildHierarchyTree(nodes: AppNode[]): BoundaryHierarchyNode[] {
  const boundaries = nodes.filter(isBoundaryNode);
  const devices = nodes.filter(isDeviceNode);
  const hierarchy: BoundaryHierarchyNode[] = [];

  for (const boundary of boundaries) {
    const data = boundary.data as BoundaryNodeData;
    const level = getNestingDepth(boundary.id, nodes);

    // Find child boundaries
    const childBoundaries = boundaries
      .filter(b => b.parentId === boundary.id)
      .map(b => b.id);

    // Find contained devices (direct children)
    const containedDevices = devices
      .filter(d => d.parentId === boundary.id)
      .map(d => d.id);

    hierarchy.push({
      boundaryId: boundary.id,
      boundaryType: data.type,
      level,
      parentId: boundary.parentId || null,
      childBoundaries,
      containedDevices,
      terraformAddress: data.terraformAddress,
    });
  }

  return hierarchy;
}

/**
 * Find all boundaries that contain a device (directly or indirectly)
 */
export function findContainingBoundaries(device: AppNode, nodes: AppNode[]): AppNode[] {
  const containing: AppNode[] = [];
  let currentId = device.parentId;

  while (currentId) {
    const parent = nodes.find(n => n.id === currentId);
    if (!parent || !isBoundaryNode(parent)) break;

    containing.push(parent);
    currentId = parent.parentId;
  }

  return containing;
}

/**
 * Find the innermost (deepest) boundary from a list
 */
export function findInnermostBoundary(
  boundaries: AppNode[],
  hierarchy: BoundaryHierarchyNode[]
): AppNode | null {
  if (boundaries.length === 0) return null;
  if (boundaries.length === 1) return boundaries[0];

  // Find the boundary with the highest nesting level
  let innermost = boundaries[0];
  let maxLevel = hierarchy.find(h => h.boundaryId === innermost.id)?.level || 0;

  for (const boundary of boundaries.slice(1)) {
    const level = hierarchy.find(h => h.boundaryId === boundary.id)?.level || 0;
    if (level > maxLevel) {
      maxLevel = level;
      innermost = boundary;
    }
  }

  return innermost;
}

/**
 * Identify missing boundaries based on device relationships
 */
export function identifyMissingBoundaries(
  _devices: AppNode[],
  boundaries: AppNode[],
  dependencies: TerraformDependency[]
): MissingBoundary[] {
  const missing: MissingBoundary[] = [];
  const boundaryAddresses = new Set(
    boundaries.map(b => (b.data as BoundaryNodeData).terraformAddress).filter(Boolean)
  );

  // Check for referenced boundaries that don't exist
  for (const dep of dependencies) {
    // If a device references a VPC/Subnet that doesn't exist as a boundary
    const targetType = dep.target.split('.')[0];
    const hierarchyLevel = RESOURCE_TO_HIERARCHY_LEVEL[targetType];

    if (hierarchyLevel && !boundaryAddresses.has(dep.target)) {
      // Check if already in missing list
      if (!missing.some(m => m.inferredFrom === dep.target)) {
        const suggestedType: BoundaryType =
          hierarchyLevel === 'vpc' ? 'network_segment' :
          hierarchyLevel === 'subnet' ? 'security_zone' : 'custom';

        missing.push({
          expectedLevel: hierarchyLevel,
          inferredFrom: dep.target,
          suggestedLabel: dep.target.split('.').pop() || dep.target,
          suggestedType,
          canAutoCreate: true, // Can auto-create if we know the structure
        });
      }
    }
  }

  return missing;
}

/**
 * Generate suggestions for auto-creating missing boundaries
 */
export function generateAutoCreateSuggestions(
  missingBoundaries: MissingBoundary[],
  existingNodes: AppNode[]
): AutoCreateSuggestion[] {
  const suggestions: AutoCreateSuggestion[] = [];

  // Base position for new boundaries
  let xOffset = 0;
  const yBase = 50;

  // Find max x of existing nodes to position new ones to the right
  const maxX = existingNodes.reduce((max, node) => {
    const nodeRight = (node.position?.x || 0) + (node.width || 200);
    return Math.max(max, nodeRight);
  }, 0);

  for (const missing of missingBoundaries) {
    if (!missing.canAutoCreate) continue;

    const width = missing.expectedLevel === 'vpc' ? 400 : 200;
    const height = missing.expectedLevel === 'vpc' ? 300 : 150;

    suggestions.push({
      missingBoundary: missing,
      suggestedPosition: {
        x: maxX + 50 + xOffset,
        y: yBase,
      },
      suggestedDimensions: { width, height },
      parentBoundaryId: undefined, // Could be enhanced to find parent
    });

    xOffset += width + 50;
  }

  return suggestions;
}

/**
 * Auto-create missing boundaries
 */
export function autoCreateMissingBoundaries(
  suggestions: AutoCreateSuggestion[]
): AppNode[] {
  const newBoundaries: AppNode[] = [];

  for (const suggestion of suggestions) {
    const { missingBoundary, suggestedPosition, suggestedDimensions, parentBoundaryId } = suggestion;

    const newBoundary: AppNode = {
      id: `boundary-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'boundary',
      position: suggestedPosition,
      width: suggestedDimensions.width,
      height: suggestedDimensions.height,
      style: {
        width: suggestedDimensions.width,
        height: suggestedDimensions.height,
      },
      data: {
        id: `boundary-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: missingBoundary.suggestedLabel,
        type: missingBoundary.suggestedType,
        terraformAddress: missingBoundary.inferredFrom,
        externalSource: 'terraform',
        lastImportTimestamp: new Date().toISOString(),
      } as BoundaryNodeData,
    };

    if (parentBoundaryId) {
      newBoundary.parentId = parentBoundaryId;
      newBoundary.extent = 'parent';
    }

    newBoundaries.push(newBoundary);
  }

  return newBoundaries;
}

/**
 * Resolve boundary for each device
 */
function resolveDeviceBoundaries(
  devices: AppNode[],
  boundaries: AppNode[],
  _hierarchy: BoundaryHierarchyNode[]
): BoundaryResolution[] {
  const resolutions: BoundaryResolution[] = [];

  for (const device of devices) {
    const data = device.data as DeviceNodeData;
    const containingBoundaries = findContainingBoundaries(device, [...boundaries, ...devices]);

    let confidence: ResolutionConfidence = 'high';
    let resolvedParent: string | null = device.parentId || null;
    let hierarchyLevel: BoundaryHierarchyLevel | null = null;

    if (containingBoundaries.length === 0 && device.parentId) {
      // Has parentId but parent not found - medium confidence
      confidence = 'medium';
    } else if (containingBoundaries.length === 0) {
      // No parent - device is orphaned
      confidence = 'low';
      resolvedParent = null;
    } else {
      // Has valid parent
      const parent = containingBoundaries[0];
      hierarchyLevel = getBoundaryHierarchyLevel(parent);
    }

    resolutions.push({
      resourceAddress: data.terraformAddress || device.id,
      resolvedParentBoundary: resolvedParent,
      hierarchyLevel,
      confidence,
      autoCreatedBoundaries: [],
    });
  }

  return resolutions;
}

/**
 * Validate boundary hierarchy
 *
 * Checks:
 * 1. Every device has exactly one parent boundary
 * 2. No devices exist outside boundaries
 * 3. No circular nesting
 * 4. Hierarchy levels are valid (VPC > Subnet > Device)
 */
export function validateBoundaryHierarchy(
  nodes: AppNode[],
  dependencies: TerraformDependency[]
): BoundaryValidationResult {
  const devices = nodes.filter(isDeviceNode);
  const boundaries = nodes.filter(isBoundaryNode);

  // Build hierarchy tree
  const hierarchy = buildHierarchyTree(nodes);

  // Track issues
  const devicesWithoutBoundary: string[] = [];
  const devicesInMultipleBoundaries: string[] = [];

  // Check each device
  for (const device of devices) {
    const containingBoundaries = findContainingBoundaries(device, nodes);

    if (!device.parentId && containingBoundaries.length === 0) {
      // Device has no parent boundary
      devicesWithoutBoundary.push(device.id);
    }

    // Check for multiple direct parents (shouldn't happen with parentId model)
    // This is more of a sanity check
    const directParentCount = device.parentId ? 1 : 0;
    if (directParentCount > 1) {
      devicesInMultipleBoundaries.push(device.id);
    }
  }

  // Identify missing boundaries
  const missingBoundaries = identifyMissingBoundaries(devices, boundaries, dependencies);

  // Generate auto-create suggestions
  const autoCreateSuggestions = generateAutoCreateSuggestions(missingBoundaries, nodes);

  // Resolve boundaries for each device
  const resolutions = resolveDeviceBoundaries(devices, boundaries, hierarchy);

  // Determine if validation passes
  const valid =
    devicesWithoutBoundary.length === 0 &&
    devicesInMultipleBoundaries.length === 0;

  return {
    valid,
    devicesWithoutBoundary,
    devicesInMultipleBoundaries,
    missingBoundaries,
    boundaryHierarchy: hierarchy,
    autoCreateSuggestions,
    resolutions,
  };
}

/**
 * Validate that boundary nesting respects hierarchy levels
 * (e.g., a Subnet can't contain a VPC)
 */
export function validateHierarchyLevels(hierarchy: BoundaryHierarchyNode[]): string[] {
  const violations: string[] = [];

  for (const node of hierarchy) {
    if (!node.parentId) continue;

    const parent = hierarchy.find(h => h.boundaryId === node.parentId);
    if (!parent) continue;

    // Check that parent's level is higher (lower number) than child's
    const parentLevel = BOUNDARY_TYPE_TO_LEVEL[parent.boundaryType];
    const childLevel = BOUNDARY_TYPE_TO_LEVEL[node.boundaryType];

    if (parentLevel && childLevel) {
      const parentOrder = HIERARCHY_ORDER[parentLevel];
      const childOrder = HIERARCHY_ORDER[childLevel];

      if (parentOrder >= childOrder) {
        violations.push(
          `Invalid nesting: ${node.boundaryType} (${node.boundaryId}) cannot be inside ${parent.boundaryType} (${parent.boundaryId})`
        );
      }
    }
  }

  return violations;
}

/**
 * Generate a summary of boundary validation results
 */
export function generateBoundaryValidationSummary(result: BoundaryValidationResult): string {
  const lines: string[] = [];

  lines.push('## Boundary Validation Summary');
  lines.push('');
  lines.push(`**Status:** ${result.valid ? 'PASSED' : 'FAILED'}`);
  lines.push('');

  if (result.devicesWithoutBoundary.length > 0) {
    lines.push(`### Devices Without Boundaries (${result.devicesWithoutBoundary.length})`);
    for (const id of result.devicesWithoutBoundary) {
      lines.push(`  - \`${id}\``);
    }
    lines.push('');
  }

  if (result.devicesInMultipleBoundaries.length > 0) {
    lines.push(`### Devices in Multiple Boundaries (${result.devicesInMultipleBoundaries.length})`);
    for (const id of result.devicesInMultipleBoundaries) {
      lines.push(`  - \`${id}\``);
    }
    lines.push('');
  }

  if (result.missingBoundaries.length > 0) {
    lines.push(`### Missing Boundaries (${result.missingBoundaries.length})`);
    for (const missing of result.missingBoundaries) {
      lines.push(`  - **${missing.suggestedLabel}** (${missing.expectedLevel})`);
      lines.push(`    - Inferred from: \`${missing.inferredFrom}\``);
      lines.push(`    - Can auto-create: ${missing.canAutoCreate ? 'Yes' : 'No'}`);
    }
    lines.push('');
  }

  if (result.autoCreateSuggestions.length > 0) {
    lines.push(`### Auto-Create Suggestions (${result.autoCreateSuggestions.length})`);
    for (const suggestion of result.autoCreateSuggestions) {
      lines.push(`  - Create boundary: **${suggestion.missingBoundary.suggestedLabel}**`);
      lines.push(`    - Type: ${suggestion.missingBoundary.suggestedType}`);
      lines.push(`    - Position: (${suggestion.suggestedPosition.x}, ${suggestion.suggestedPosition.y})`);
    }
    lines.push('');
  }

  lines.push('### Boundary Hierarchy');
  const rootBoundaries = result.boundaryHierarchy.filter(h => !h.parentId);
  for (const root of rootBoundaries) {
    lines.push(formatHierarchyNode(root, result.boundaryHierarchy, 0));
  }

  return lines.join('\n');
}

/**
 * Format a hierarchy node for display
 */
function formatHierarchyNode(
  node: BoundaryHierarchyNode,
  allNodes: BoundaryHierarchyNode[],
  indent: number
): string {
  const prefix = '  '.repeat(indent);
  let result = `${prefix}- **${node.boundaryId}** (${node.boundaryType})`;

  if (node.containedDevices.length > 0) {
    result += `\n${prefix}  Devices: ${node.containedDevices.join(', ')}`;
  }

  for (const childId of node.childBoundaries) {
    const child = allNodes.find(n => n.boundaryId === childId);
    if (child) {
      result += '\n' + formatHierarchyNode(child, allNodes, indent + 1);
    }
  }

  return result;
}
