import type { TerraformPlan, TerraformResourceChange, ResourceMapping, ChangeAction, ValidationReport } from './terraformTypes'
import type { TerraformDependency } from './dependencyAnalyzer'
import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData, BoundaryType } from '@/lib/utils/types'
import { mapTerraformResource, mapTerraformResourceAsync } from './resourceMapper'
import { LAYOUT_CONSTANTS } from '@/lib/layout/layoutConfig'
import { validateCompleteness } from './importValidator'
import { applyElkLayout } from '@/lib/layout/elkLayout'
import type { LayoutOptions } from '@/lib/layout/layoutInterface'
import { generateExternalId } from './validation/externalIdGenerator'

// Container resources that should become boundaries
const CONTAINER_RESOURCES: Record<string, { boundaryType: BoundaryType; labelPrefix: string }> = {
  // AWS
  aws_vpc: { boundaryType: 'network_segment', labelPrefix: 'VPC' },
  aws_subnet: { boundaryType: 'security_zone', labelPrefix: 'Subnet' },
  // Azure
  azurerm_virtual_network: { boundaryType: 'network_segment', labelPrefix: 'VNet' },
  azurerm_subnet: { boundaryType: 'security_zone', labelPrefix: 'Subnet' },
  // GCP
  google_compute_network: { boundaryType: 'network_segment', labelPrefix: 'VPC' },
  google_compute_subnetwork: { boundaryType: 'security_zone', labelPrefix: 'Subnet' },
} as const

// VPC/VNet resource types (top-level network boundaries)
const VPC_TYPES = ['aws_vpc', 'azurerm_virtual_network', 'google_compute_network']

// Subnet resource types (nested in VPCs)
const SUBNET_TYPES = ['aws_subnet', 'azurerm_subnet', 'google_compute_subnetwork']

// Helper to check if an address matches a VPC type
const isVpcAddress = (address: string) => VPC_TYPES.some(t => address.includes(t))

// Helper to check if an address matches a subnet type
const isSubnetAddress = (address: string) => SUBNET_TYPES.some(t => address.includes(t))

export interface ConversionContext {
  plan: TerraformPlan
  resourceMappings: Map<string, ResourceMapping>
  dependencies: TerraformDependency[]
  layoutStrategy: 'auto' | 'manual'
}

export interface ConversionResult {
  nodes: TerraformNode[]
  edges: TerraformEdge[]
  boundaries: TerraformBoundary[]
  warnings: string[]
  validation?: ValidationReport
}

export type TerraformNode = AppNode & {
  data: (DeviceNodeData | BoundaryNodeData) & {
    terraformAddress: string
    terraformType: string
    changeType: ChangeAction
    beforeAttributes?: Record<string, any>
    afterAttributes?: Record<string, any>
    changedFields?: string[]
  }
}

export interface TerraformEdge extends AppEdge {
  data?: {
    terraformRelationship?: string
  }
}

export interface TerraformBoundary {
  id: string
  label: string
  type: 'vpc' | 'vnet' | 'subnet'
  childNodeIds: string[]
}

/**
 * Helper to find parent resource address from dependencies
 *
 * The dependency analyzer creates relationships in two directions:
 * 1. Deep scan (reference scanner): child → parent (e.g., instance.subnet_id → subnet)
 * 2. Pattern matching: parent → child (e.g., subnet → instance for network containment)
 *
 * We check both directions to find the parent boundary.
 */
function findParentAddress(
  resourceAddress: string,
  dependencies: TerraformDependency[],
  parentTypes: string[]
): string | null {
  // Check 1: This resource references a parent (child → parent)
  // e.g., aws_instance references aws_subnet via subnet_id
  const childToParentDep = dependencies.find(dep =>
    dep.source === resourceAddress &&
    parentTypes.some(t => dep.target.includes(t))
  )
  if (childToParentDep) {
    return childToParentDep.target
  }

  // Check 2: Parent references this resource (parent → child)
  // e.g., extractNetworkConnections creates subnet → instance relationships
  const parentToChildDep = dependencies.find(dep =>
    dep.target === resourceAddress &&
    parentTypes.some(t => dep.source.includes(t))
  )
  if (parentToChildDep) {
    return parentToChildDep.source
  }

  return null
}

/**
 * Extract parent boundary address directly from resource attributes
 * This is a fallback when dependency analysis doesn't capture the relationship
 *
 * @param resource - The Terraform resource to find a parent for
 * @param boundaries - Map of terraform address -> node ID for all boundaries
 * @param boundaryIdMap - Map of actual AWS/Azure resource ID -> terraform address (e.g., "vpc-12345" -> "aws_vpc.main")
 */
function findParentFromAttributes(
  resource: TerraformResourceChange,
  boundaries: Map<string, string>,
  boundaryIdMap: Map<string, string> = new Map()
): string | null {
  const attrs = resource.change.after || {}

  // Helper to extract boundary reference from a value
  const extractBoundaryRef = (value: unknown): string | null => {
    if (!value) return null

    // Handle array values
    const values = Array.isArray(value) ? value : [value]

    for (const v of values) {
      if (typeof v !== 'string') continue

      // Check if the value is a Terraform reference (e.g., "aws_subnet.main.id")
      const refMatch = v.match(/^(?:\$\{)?([a-z_]+\.[a-z0-9_]+)/i)
      if (refMatch) {
        const address = refMatch[1]
        if (boundaries.has(address)) {
          return address
        }
      }

      // Check if value matches any boundary address directly
      for (const [addr] of boundaries) {
        if (v.includes(addr)) {
          return addr
        }
      }

      // Check if value is an actual AWS/Azure resource ID (e.g., "vpc-12345abc", "subnet-67890def")
      // Match this against our boundaryIdMap
      if (boundaryIdMap.has(v)) {
        return boundaryIdMap.get(v)!
      }
    }
    return null
  }

  // Common attribute names for parent references (AWS, Azure, GCP)
  const parentAttrs = [
    // AWS - direct attributes
    'subnet_id',
    'subnet_ids',
    'vpc_id',
    'subnets', // For aws_lb, aws_db_subnet_group
    // Azure
    'vnet_id',
    'virtual_network_name',
    // GCP
    'network',
    'subnetwork',
    'subnetwork_self_link',
    // Common
    'network_interface_ids',
  ]

  // First, check direct attributes
  for (const attrName of parentAttrs) {
    const result = extractBoundaryRef(attrs[attrName])
    if (result) return result
  }

  // Check nested vpc_config (used by aws_lambda_function, aws_eks_cluster)
  if (attrs.vpc_config) {
    const vpcConfig = attrs.vpc_config
    if (Array.isArray(vpcConfig) && vpcConfig.length > 0) {
      const config = vpcConfig[0]
      const result = extractBoundaryRef(config.subnet_ids) ||
                     extractBoundaryRef(config.vpc_id) ||
                     extractBoundaryRef(config.security_group_ids)
      if (result) return result
    } else if (typeof vpcConfig === 'object') {
      const result = extractBoundaryRef(vpcConfig.subnet_ids) ||
                     extractBoundaryRef(vpcConfig.vpc_id)
      if (result) return result
    }
  }

  // Check network_configuration (used by aws_ecs_service)
  if (attrs.network_configuration) {
    const netConfig = attrs.network_configuration
    if (Array.isArray(netConfig) && netConfig.length > 0) {
      const config = netConfig[0]
      const result = extractBoundaryRef(config.subnets) || extractBoundaryRef(config.subnet_ids)
      if (result) return result
    }
  }

  // Check network_interface (used by aws_instance)
  if (attrs.network_interface) {
    const netIface = Array.isArray(attrs.network_interface) ? attrs.network_interface : [attrs.network_interface]
    for (const iface of netIface) {
      if (iface && typeof iface === 'object') {
        const result = extractBoundaryRef(iface.subnet_id)
        if (result) return result
      }
    }
  }

  // Check db_subnet_group_name (used by aws_db_instance)
  // This requires looking up the subnet group, but we can try to match by name pattern
  if (attrs.db_subnet_group_name && typeof attrs.db_subnet_group_name === 'string') {
    // Try to find a VPC by matching against boundary names
    for (const [addr] of boundaries) {
      // If the subnet group name contains any part of a VPC address, use that VPC
      const vpcName = addr.split('.')[1] // e.g., "aws_vpc.main" -> "main"
      if (vpcName && attrs.db_subnet_group_name.includes(vpcName)) {
        return addr
      }
    }
  }

  return null
}

export function convertTerraformPlanToNodes(context: ConversionContext): ConversionResult {
  const nodes: TerraformNode[] = []
  const edges: TerraformEdge[] = []
  const boundaries: TerraformBoundary[] = []
  const warnings: string[] = []

  // Pass 1: Create boundary nodes for container resources (VPCs/VNets first, then Subnets)
  const containerResources: TerraformResourceChange[] = []
  const deviceResources: TerraformResourceChange[] = []

  for (const resource of context.plan.resource_changes) {
    if (CONTAINER_RESOURCES[resource.type]) {
      containerResources.push(resource)
    } else {
      deviceResources.push(resource)
    }
  }

  // Sort containers: VPCs/VNets first, then Subnets
  containerResources.sort((a, b) => {
    const aIsRoot = VPC_TYPES.includes(a.type)
    const bIsRoot = VPC_TYPES.includes(b.type)
    if (aIsRoot && !bIsRoot) return -1
    if (!aIsRoot && bIsRoot) return 1
    return 0
  })

  const addressToNodeId = new Map<string, string>()
  const boundaryIdMap = new Map<string, string>() // Maps actual AWS IDs to terraform addresses
  const importTimestamp = new Date().toISOString()

  // Create boundary nodes
  for (const resource of containerResources) {
    const containerInfo = CONTAINER_RESOURCES[resource.type]
    const provider = resource.provider_name
    const mapping = mapTerraformResource({
      provider,
      resourceType: resource.type,
      resourceAttributes: resource.change.after || {},
    })

    const changeType = resource.change.actions[0] as ChangeAction
    const label = mapping.defaultName || `${containerInfo.labelPrefix}: ${resource.name}`

    // Generate external ID for duplicate detection
    const externalId = generateExternalId(resource)

    const boundaryNode: TerraformNode = {
      id: resource.address,
      type: 'boundary',
      position: { x: 0, y: 0 },
      // Don't set fixed dimensions - let ELK calculate based on children
      data: {
        id: resource.address,
        label,
        type: containerInfo.boundaryType,
        terraformAddress: resource.address,
        terraformType: resource.type,
        changeType,
        beforeAttributes: resource.change.before,
        afterAttributes: resource.change.after,
        // External tracking fields
        externalId: externalId.fullId,
        externalSource: 'terraform',
        lastImportTimestamp: importTimestamp,
      } as BoundaryNodeData & { terraformAddress: string; terraformType: string; changeType: ChangeAction; beforeAttributes?: Record<string, any>; afterAttributes?: Record<string, any>; externalId: string; externalSource: 'terraform'; lastImportTimestamp: string },
    }

    nodes.push(boundaryNode)
    addressToNodeId.set(resource.address, resource.address)

    // Map actual AWS/Azure resource ID to terraform address for parent lookup
    const resourceId = resource.change.after?.id
    if (resourceId && typeof resourceId === 'string') {
      boundaryIdMap.set(resourceId, resource.address)
    }

    // Determine parent: Subnets belong to VPCs/VNets
    if (SUBNET_TYPES.includes(resource.type)) {
      let parentAddress = findParentAddress(
        resource.address,
        context.dependencies,
        VPC_TYPES
      )

      // Fallback: Check resource attributes directly (with ID mapping for resolved AWS IDs)
      if (!parentAddress || !addressToNodeId.has(parentAddress)) {
        parentAddress = findParentFromAttributes(resource, addressToNodeId, boundaryIdMap)
      }

      if (parentAddress && addressToNodeId.has(parentAddress)) {
        boundaryNode.parentId = parentAddress
        boundaryNode.extent = 'parent'
      }
    }
  }

  // Pass 2: Create device nodes and determine their parent boundaries
  for (const resource of deviceResources) {
    const provider = resource.provider_name
    const mapping = mapTerraformResource({
      provider,
      resourceType: resource.type,
      resourceAttributes: resource.change.after || {},
    })

    const changeType = resource.change.actions[0] as ChangeAction

    // Generate external ID for duplicate detection
    const externalId = generateExternalId(resource)

    const deviceNode: TerraformNode = {
      id: resource.address,
      type: 'device',
      position: { x: 0, y: 0 },
      data: {
        id: resource.address,
        name: mapping.defaultName,
        deviceType: mapping.deviceType as any,
        deviceSubtype: mapping.deviceSubtype,
        iconPath: mapping.iconPath,
        terraformAddress: resource.address,
        terraformType: resource.type,
        changeType,
        beforeAttributes: resource.change.before,
        afterAttributes: resource.change.after,
        // External tracking fields
        externalId: externalId.fullId,
        externalSource: 'terraform',
        lastImportTimestamp: importTimestamp,
      } as DeviceNodeData & { terraformAddress: string; terraformType: string; changeType: ChangeAction; beforeAttributes?: Record<string, any>; afterAttributes?: Record<string, any>; externalId: string; externalSource: 'terraform'; lastImportTimestamp: string },
    }

    // Determine parent boundary: prefer subnet, fall back to VPC/VNet
    let parentAddress = findParentAddress(
      resource.address,
      context.dependencies,
      SUBNET_TYPES
    )

    if (!parentAddress || !addressToNodeId.has(parentAddress)) {
      // Try VPC/VNet directly
      parentAddress = findParentAddress(
        resource.address,
        context.dependencies,
        VPC_TYPES
      )
    }

    // Fallback: Check resource attributes directly (with ID mapping for resolved AWS IDs)
    if (!parentAddress || !addressToNodeId.has(parentAddress)) {
      parentAddress = findParentFromAttributes(resource, addressToNodeId, boundaryIdMap)
    }

    if (parentAddress && addressToNodeId.has(parentAddress)) {
      deviceNode.parentId = parentAddress
      deviceNode.extent = 'parent'
    }

    nodes.push(deviceNode)
    addressToNodeId.set(resource.address, resource.address)
  }

  // Convert dependencies to edges (only for non-containment relationships)
  for (const dep of context.dependencies) {
    const sourceNode = nodes.find(n => n.data.terraformAddress === dep.source)
    const targetNode = nodes.find(n => n.data.terraformAddress === dep.target)

    if (sourceNode && targetNode) {
      // Skip containment relationships (these are handled via parentId)
      // Must check BOTH directions since dependency analyzer creates edges in both

      // VPC ↔ Subnet containment (either direction)
      const isVpcSubnetContainment =
        (isVpcAddress(dep.target) && isSubnetAddress(dep.source)) ||
        (isVpcAddress(dep.source) && isSubnetAddress(dep.target))

      // Subnet ↔ Device containment (either direction)
      const isSubnetDeviceContainment =
        (isSubnetAddress(dep.target) && sourceNode.type === 'device') ||
        (isSubnetAddress(dep.source) && targetNode.type === 'device')

      // VPC ↔ Device containment (either direction)
      const isVpcDeviceContainment =
        (isVpcAddress(dep.target) && sourceNode.type === 'device') ||
        (isVpcAddress(dep.source) && targetNode.type === 'device')

      // Skip any boundary ↔ device edge (boundaries should contain devices, not connect to them)
      const isBoundaryDeviceEdge =
        (sourceNode.type === 'boundary' && targetNode.type === 'device') ||
        (sourceNode.type === 'device' && targetNode.type === 'boundary')

      if (!isVpcSubnetContainment && !isSubnetDeviceContainment && !isVpcDeviceContainment && !isBoundaryDeviceEdge) {
        edges.push({
          id: `${dep.source}-${dep.target}`,
          source: sourceNode.id,
          target: targetNode.id,
          type: 'default',
          data: {
            terraformRelationship: dep.relationship,
          },
        })
      }
    }
  }

  // Apply simple fallback layout for sync version
  // (ELK is async, so sync version uses basic grid)
  if (context.layoutStrategy === 'auto') {
    applySimpleFallbackLayout(nodes)
  }

  // Validate completeness
  const validation = validateCompleteness(nodes, edges, context.plan)

  // Add validation warnings to main warnings array
  if (!validation.isValid) {
    warnings.push(...validation.warnings)
    validation.missingEdges.forEach(edge => {
      warnings.push(`Missing edge: ${edge.source} -> ${edge.target}: ${edge.reason}`)
    })
    validation.orphanedResources.forEach(resource => {
      warnings.push(`Orphaned resource: ${resource} has no connections`)
    })
  }

  return { nodes, edges, boundaries, warnings, validation }
}

/**
 * Async version with ELK layout and intelligent device type matching
 */
export async function convertTerraformPlanToNodesAsync(context: ConversionContext): Promise<ConversionResult> {
  const nodes: TerraformNode[] = []
  const edges: TerraformEdge[] = []
  const boundaries: TerraformBoundary[] = []
  const warnings: string[] = []

  // Pass 1: Create boundary nodes for container resources (VPCs/VNets first, then Subnets)
  const containerResources: TerraformResourceChange[] = []
  const deviceResources: TerraformResourceChange[] = []

  for (const resource of context.plan.resource_changes) {
    if (CONTAINER_RESOURCES[resource.type]) {
      containerResources.push(resource)
    } else {
      deviceResources.push(resource)
    }
  }

  // Sort containers: VPCs/VNets first, then Subnets
  containerResources.sort((a, b) => {
    const aIsRoot = VPC_TYPES.includes(a.type)
    const bIsRoot = VPC_TYPES.includes(b.type)
    if (aIsRoot && !bIsRoot) return -1
    if (!aIsRoot && bIsRoot) return 1
    return 0
  })

  const addressToNodeId = new Map<string, string>()
  const boundaryIdMap = new Map<string, string>() // Maps actual AWS IDs to terraform addresses

  // Create boundary nodes
  const importTimestamp = new Date().toISOString()

  for (const resource of containerResources) {
    const containerInfo = CONTAINER_RESOURCES[resource.type]
    const provider = resource.provider_name
    const mapping = await mapTerraformResourceAsync({
      provider,
      resourceType: resource.type,
      resourceAttributes: resource.change.after || {},
    })

    const changeType = resource.change.actions[0] as ChangeAction
    const label = mapping.defaultName || `${containerInfo.labelPrefix}: ${resource.name}`

    // Generate external ID for duplicate detection
    const externalId = generateExternalId(resource)

    const boundaryNode: TerraformNode = {
      id: resource.address,
      type: 'boundary',
      position: { x: 0, y: 0 },
      // Don't set fixed dimensions - let ELK calculate based on children
      data: {
        id: resource.address,
        label,
        type: containerInfo.boundaryType,
        terraformAddress: resource.address,
        terraformType: resource.type,
        changeType,
        beforeAttributes: resource.change.before,
        afterAttributes: resource.change.after,
        // External tracking fields
        externalId: externalId.fullId,
        externalSource: 'terraform',
        lastImportTimestamp: importTimestamp,
      } as BoundaryNodeData & { terraformAddress: string; terraformType: string; changeType: ChangeAction; beforeAttributes?: Record<string, any>; afterAttributes?: Record<string, any>; externalId: string; externalSource: 'terraform'; lastImportTimestamp: string },
    }

    nodes.push(boundaryNode)
    addressToNodeId.set(resource.address, resource.address)

    // Map actual AWS/Azure resource ID to terraform address for parent lookup
    const resourceId = resource.change.after?.id
    if (resourceId && typeof resourceId === 'string') {
      boundaryIdMap.set(resourceId, resource.address)
    }

    // Determine parent: Subnets belong to VPCs/VNets
    if (SUBNET_TYPES.includes(resource.type)) {
      let parentAddress = findParentAddress(
        resource.address,
        context.dependencies,
        VPC_TYPES
      )

      // Fallback: Check resource attributes directly (with ID mapping for resolved AWS IDs)
      if (!parentAddress || !addressToNodeId.has(parentAddress)) {
        parentAddress = findParentFromAttributes(resource, addressToNodeId, boundaryIdMap)
      }

      if (parentAddress && addressToNodeId.has(parentAddress)) {
        boundaryNode.parentId = parentAddress
        boundaryNode.extent = 'parent'
      }
    }
  }

  // Pass 2: Create device nodes and determine their parent boundaries
  for (const resource of deviceResources) {
    const provider = resource.provider_name
    const mapping = await mapTerraformResourceAsync({
      provider,
      resourceType: resource.type,
      resourceAttributes: resource.change.after || {},
    })

    const changeType = resource.change.actions[0] as ChangeAction

    // Generate external ID for duplicate detection
    const externalId = generateExternalId(resource)

    const deviceNode: TerraformNode = {
      id: resource.address,
      type: 'device',
      position: { x: 0, y: 0 },
      data: {
        id: resource.address,
        name: mapping.defaultName,
        deviceType: mapping.deviceType as any,
        deviceSubtype: mapping.deviceSubtype,
        iconPath: mapping.iconPath,
        terraformAddress: resource.address,
        terraformType: resource.type,
        changeType,
        beforeAttributes: resource.change.before,
        afterAttributes: resource.change.after,
        // External tracking fields
        externalId: externalId.fullId,
        externalSource: 'terraform',
        lastImportTimestamp: importTimestamp,
      } as DeviceNodeData & { terraformAddress: string; terraformType: string; changeType: ChangeAction; beforeAttributes?: Record<string, any>; afterAttributes?: Record<string, any>; externalId: string; externalSource: 'terraform'; lastImportTimestamp: string },
    }

    // Determine parent boundary: prefer subnet, fall back to VPC/VNet
    let parentAddress = findParentAddress(
      resource.address,
      context.dependencies,
      SUBNET_TYPES
    )

    if (!parentAddress || !addressToNodeId.has(parentAddress)) {
      // Try VPC/VNet directly
      parentAddress = findParentAddress(
        resource.address,
        context.dependencies,
        VPC_TYPES
      )
    }

    // Fallback: Check resource attributes directly (with ID mapping for resolved AWS IDs)
    if (!parentAddress || !addressToNodeId.has(parentAddress)) {
      parentAddress = findParentFromAttributes(resource, addressToNodeId, boundaryIdMap)
    }

    if (parentAddress && addressToNodeId.has(parentAddress)) {
      deviceNode.parentId = parentAddress
      deviceNode.extent = 'parent'
    }

    nodes.push(deviceNode)
    addressToNodeId.set(resource.address, resource.address)
  }

  // Convert dependencies to edges (only for non-containment relationships)
  for (const dep of context.dependencies) {
    const sourceNode = nodes.find(n => n.data.terraformAddress === dep.source)
    const targetNode = nodes.find(n => n.data.terraformAddress === dep.target)

    if (sourceNode && targetNode) {
      // Skip containment relationships (these are handled via parentId)
      // Must check BOTH directions since dependency analyzer creates edges in both

      // VPC ↔ Subnet containment (either direction)
      const isVpcSubnetContainment =
        (isVpcAddress(dep.target) && isSubnetAddress(dep.source)) ||
        (isVpcAddress(dep.source) && isSubnetAddress(dep.target))

      // Subnet ↔ Device containment (either direction)
      const isSubnetDeviceContainment =
        (isSubnetAddress(dep.target) && sourceNode.type === 'device') ||
        (isSubnetAddress(dep.source) && targetNode.type === 'device')

      // VPC ↔ Device containment (either direction)
      const isVpcDeviceContainment =
        (isVpcAddress(dep.target) && sourceNode.type === 'device') ||
        (isVpcAddress(dep.source) && targetNode.type === 'device')

      // Skip any boundary ↔ device edge (boundaries should contain devices, not connect to them)
      const isBoundaryDeviceEdge =
        (sourceNode.type === 'boundary' && targetNode.type === 'device') ||
        (sourceNode.type === 'device' && targetNode.type === 'boundary')

      if (!isVpcSubnetContainment && !isSubnetDeviceContainment && !isVpcDeviceContainment && !isBoundaryDeviceEdge) {
        edges.push({
          id: `${dep.source}-${dep.target}`,
          source: sourceNode.id,
          target: targetNode.id,
          type: 'default',
          data: {
            terraformRelationship: dep.relationship,
          },
        })
      }
    }
  }

  // Apply ELK layout for proper nested boundary support
  if (context.layoutStrategy === 'auto') {
    await applyElkLayoutToTerraform(nodes, edges)
  }

  // Validate completeness
  const validation = validateCompleteness(nodes, edges, context.plan)

  // Add validation warnings to main warnings array
  if (!validation.isValid) {
    warnings.push(...validation.warnings)
    validation.missingEdges.forEach(edge => {
      warnings.push(`Missing edge: ${edge.source} -> ${edge.target}: ${edge.reason}`)
    })
    validation.orphanedResources.forEach(resource => {
      warnings.push(`Orphaned resource: ${resource} has no connections`)
    })
  }

  return { nodes, edges, boundaries, warnings, validation }
}

/**
 * Apply ELK layout optimized for Terraform infrastructure
 * Uses tree layout for hierarchical VPC > Subnet > Device structure
 */
async function applyElkLayoutToTerraform(nodes: TerraformNode[], edges: TerraformEdge[]): Promise<void> {
  if (nodes.length === 0) return

  const layoutOptions: LayoutOptions = {
    algorithm: 'elkjs',
    elkAlgorithm: 'mrtree', // Tree layout for hierarchical infrastructure
    direction: 'DOWN', // Top-to-bottom: VPC at top, devices at bottom
    boundaryPadding: LAYOUT_CONSTANTS.BOUNDARY_PADDING,
    nestedBoundarySpacing: 40, // Extra space for nested boundary labels
    autoResize: true, // Let ELK calculate boundary sizes
    horizontalSpacing: 80,
    verticalSpacing: 60,
    nodeSpacing: 50,
    elkAlignment: 'CENTER',
    elkSeparateComponents: false,
    elkCompaction: false,
  }

  try {
    const result = await applyElkLayout(nodes as AppNode[], edges as AppEdge[], layoutOptions)

    // Update nodes with ELK-computed positions and sizes
    for (const node of nodes) {
      const layoutedNode = result.nodes.find(n => n.id === node.id)
      if (layoutedNode) {
        node.position = layoutedNode.position

        // Update boundary sizes from ELK
        if (node.type === 'boundary') {
          if (layoutedNode.width && layoutedNode.height) {
            node.width = layoutedNode.width
            node.height = layoutedNode.height
            node.style = {
              ...node.style,
              width: layoutedNode.width,
              height: layoutedNode.height,
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('[Terraform] ELK layout failed, falling back to simple layout:', error)
    applySimpleFallbackLayout(nodes)
  }
}

/**
 * Simple fallback layout when ELK is not available (sync contexts)
 * Arranges nodes in a basic grid respecting parent-child relationships
 */
function applySimpleFallbackLayout(nodes: TerraformNode[]) {
  const padding = LAYOUT_CONSTANTS.BOUNDARY_PADDING
  const deviceSpacing = 160
  const boundarySpacing = 450

  // Separate boundaries and devices
  const rootBoundaries = nodes.filter(n => n.type === 'boundary' && !n.parentId)
  const nestedBoundaries = nodes.filter(n => n.type === 'boundary' && n.parentId)
  const devices = nodes.filter(n => n.type === 'device')

  // Layout root boundaries in a row
  rootBoundaries.forEach((boundary, index) => {
    boundary.position = {
      x: padding + index * boundarySpacing,
      y: padding,
    }
    boundary.width = 400
    boundary.height = 350
    boundary.style = { width: 400, height: 350 }
  })

  // Layout nested boundaries within their parents
  for (const boundary of nestedBoundaries) {
    const parent = nodes.find(n => n.id === boundary.parentId)
    if (parent) {
      const siblings = nestedBoundaries.filter(b => b.parentId === parent.id)
      const index = siblings.indexOf(boundary)
      const cols = Math.max(2, Math.ceil(Math.sqrt(siblings.length)))
      const col = index % cols
      const row = Math.floor(index / cols)

      boundary.position = {
        x: padding + col * 200,
        y: padding + 30 + row * 180, // Extra offset for parent label
      }
      boundary.width = 180
      boundary.height = 160
      boundary.style = { width: 180, height: 160 }

      // Expand parent to fit
      const neededWidth = padding * 2 + cols * 200
      const neededHeight = padding * 2 + 30 + Math.ceil(siblings.length / cols) * 180
      if (parent.width) parent.width = Math.max(parent.width, neededWidth)
      if (parent.height) parent.height = Math.max(parent.height, neededHeight)
      if (parent.style) {
        parent.style.width = parent.width
        parent.style.height = parent.height
      }
    }
  }

  // Layout devices within their parent boundaries
  for (const device of devices) {
    if (device.parentId) {
      const parent = nodes.find(n => n.id === device.parentId)
      if (parent) {
        const siblings = devices.filter(d => d.parentId === device.parentId)
        const index = siblings.indexOf(device)
        const cols = Math.max(2, Math.ceil(Math.sqrt(siblings.length)))
        const col = index % cols
        const row = Math.floor(index / cols)

        device.position = {
          x: padding + col * deviceSpacing,
          y: padding + 30 + row * deviceSpacing,
        }

        // Expand parent to fit devices
        const neededWidth = padding * 2 + cols * deviceSpacing
        const neededHeight = padding * 2 + 30 + Math.ceil(siblings.length / cols) * deviceSpacing
        if (parent.width) parent.width = Math.max(parent.width, neededWidth)
        if (parent.height) parent.height = Math.max(parent.height, neededHeight)
        if (parent.style) {
          parent.style.width = parent.width
          parent.style.height = parent.height
        }
      }
    } else {
      // Orphan devices - layout in a separate area
      const orphans = devices.filter(d => !d.parentId)
      const index = orphans.indexOf(device)
      const cols = Math.max(2, Math.ceil(Math.sqrt(orphans.length)))
      const col = index % cols
      const row = Math.floor(index / cols)

      // Position below all boundaries
      const maxBoundaryBottom = Math.max(
        ...rootBoundaries.map(b => (b.position?.y || 0) + (b.height || 350)),
        400
      )

      device.position = {
        x: padding + col * deviceSpacing,
        y: maxBoundaryBottom + padding + row * deviceSpacing,
      }
    }
  }
}
