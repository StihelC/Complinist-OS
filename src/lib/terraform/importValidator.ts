import type { TerraformPlan, ValidationReport } from './terraformTypes'
import type { TerraformNode, TerraformEdge } from './stateConverter'

/**
 * Validate completeness of Terraform import
 * Checks for missing edges, orphaned resources, and expected relationships
 *
 * Note: Containment relationships (device inside boundary) use parentId, not edges.
 * Only device-to-device connections use edges.
 */
export function validateCompleteness(
  nodes: TerraformNode[],
  edges: TerraformEdge[],
  plan: TerraformPlan
): ValidationReport {
  const warnings: string[] = []
  const missingEdges: Array<{ source: string, target: string, reason: string }> = []
  const orphanedResources: string[] = []

  // Build maps for quick lookup
  const nodeMap = new Map(nodes.map(n => [n.data.terraformAddress, n]))
  const edgeMap = new Map<string, Set<string>>()

  for (const edge of edges) {
    const sourceAddr = edge.source
    if (!edgeMap.has(sourceAddr)) {
      edgeMap.set(sourceAddr, new Set())
    }
    edgeMap.get(sourceAddr)!.add(edge.target)
  }

  // Check 1: All resources have corresponding nodes
  for (const resource of plan.resource_changes) {
    if (!nodeMap.has(resource.address)) {
      warnings.push(`Resource ${resource.address} was not converted to a node`)
    }
  }

  // Check 2: Identify orphaned resources (no edges AND no parent boundary)
  // Devices inside boundaries via parentId are NOT orphaned
  // Regional/global services (S3, DynamoDB, etc.) are legitimately isolated
  for (const node of nodes) {
    const address = node.data.terraformAddress
    const resourceType = node.data.terraformType
    const hasOutgoing = edgeMap.has(address) && edgeMap.get(address)!.size > 0
    const hasIncoming = Array.from(edgeMap.values()).some(targets => targets.has(address))
    const hasParent = !!node.parentId // Contained in a boundary

    if (!hasOutgoing && !hasIncoming && !hasParent) {
      // Skip regional services - they don't belong in VPCs
      if (isRegionalService(resourceType)) {
        continue
      }

      // Warn for critical resources that should have connections
      if (isCriticalResource(resourceType)) {
        orphanedResources.push(address)
        warnings.push(`Critical resource ${address} (${resourceType}) has no connections`)
      }
    }
  }

  // Check 3: Verify expected network relationships
  // Note: Containment relationships (device→subnet, subnet→VPC) use parentId, not edges
  for (const resource of plan.resource_changes) {
    const node = nodeMap.get(resource.address)
    if (!node) continue

    const attrs = resource.change.after || {}

    // Check for missing subnet connections on instances
    // Instances should be CONTAINED in subnets via parentId, not connected via edges
    if (isComputeResource(resource.type) && attrs.subnet_id) {
      const subnetRef = extractResourceReference(attrs.subnet_id)
      if (subnetRef && nodeMap.has(subnetRef)) {
        // Check if instance is contained in the subnet (or any parent boundary)
        const isContained = isContainedInBoundary(node, subnetRef, nodeMap)
        const hasEdge = edgeMap.get(resource.address)?.has(subnetRef) ||
                       Array.from(edgeMap.entries()).some(([src, targets]) =>
                         targets.has(resource.address) && src === subnetRef
                       )
        if (!hasEdge && !isContained) {
          missingEdges.push({
            source: subnetRef,
            target: resource.address,
            reason: `Instance ${resource.address} references subnet ${subnetRef} but no edge exists`,
          })
        }
      }
    }

    // Check for missing VPC connections on subnets
    // Subnets should be CONTAINED in VPCs via parentId, not connected via edges
    if (resource.type === 'aws_subnet' || resource.type === 'azurerm_subnet') {
      const vpcRef = attrs.vpc_id || attrs.virtual_network_name
      if (vpcRef) {
        const vpcAddr = extractResourceReference(vpcRef)
        if (vpcAddr && nodeMap.has(vpcAddr)) {
          // Check if subnet is contained in the VPC via parentId
          const isContained = node.parentId === vpcAddr
          const hasEdge = edgeMap.get(vpcAddr)?.has(resource.address) ||
                         edgeMap.get(resource.address)?.has(vpcAddr)
          if (!hasEdge && !isContained) {
            missingEdges.push({
              source: vpcAddr,
              target: resource.address,
              reason: `Subnet ${resource.address} references VPC ${vpcAddr} but no edge exists`,
            })
          }
        }
      }
    }

    // Check for missing security group connections on instances
    // Note: Security groups are devices, so they connect via edges (device-to-device)
    if (isComputeResource(resource.type)) {
      const sgIds = attrs.vpc_security_group_ids || attrs.security_group_ids || []
      if (Array.isArray(sgIds)) {
        for (const sgId of sgIds) {
          const sgRef = extractResourceReference(String(sgId))
          if (sgRef && nodeMap.has(sgRef)) {
            const hasEdge = edgeMap.get(sgRef)?.has(resource.address) ||
                           edgeMap.get(resource.address)?.has(sgRef)
            if (!hasEdge) {
              missingEdges.push({
                source: sgRef,
                target: resource.address,
                reason: `Instance ${resource.address} references security group ${sgRef} but no edge exists`,
              })
            }
          }
        }
      }
    }
  }

  const isValid = warnings.length === 0 && missingEdges.length === 0 && orphanedResources.length === 0

  return {
    warnings,
    missingEdges,
    orphanedResources,
    isValid,
  }
}

/**
 * Check if a node is contained within a boundary (directly or through nesting)
 */
function isContainedInBoundary(
  node: TerraformNode,
  boundaryAddress: string,
  nodeMap: Map<string, TerraformNode>
): boolean {
  let currentParentId = node.parentId

  while (currentParentId) {
    if (currentParentId === boundaryAddress) {
      return true
    }

    const parentNode = nodeMap.get(currentParentId)
    if (!parentNode) break

    currentParentId = parentNode.parentId
  }

  return false
}

/**
 * Check if a resource type is critical (should have connections or be inside a boundary)
 * Excludes regional/global services that don't belong in VPCs (S3, DynamoDB, IAM, etc.)
 */
function isCriticalResource(resourceType: string): boolean {
  const criticalTypes = [
    'aws_instance',
    'azurerm_virtual_machine',
    'azurerm_linux_virtual_machine',
    'azurerm_windows_virtual_machine',
    'aws_db_instance',
    'azurerm_sql_database',
    'aws_lb',
    'aws_alb',
    'azurerm_lb',
  ]
  return criticalTypes.some(type => resourceType === type)
}

/**
 * Check if a resource type is a regional/global service that doesn't belong in a VPC
 * These resources are legitimately orphaned and shouldn't be flagged
 */
function isRegionalService(resourceType: string): boolean {
  const regionalServices = [
    // AWS Regional/Global Services
    'aws_s3_bucket',
    'aws_s3_bucket_policy',
    'aws_s3_bucket_acl',
    'aws_dynamodb_table',
    'aws_sqs_queue',
    'aws_sns_topic',
    'aws_iam_role',
    'aws_iam_policy',
    'aws_iam_user',
    'aws_iam_group',
    'aws_cloudwatch_log_group',
    'aws_cloudwatch_metric_alarm',
    'aws_route53_zone',
    'aws_route53_record',
    'aws_acm_certificate',
    'aws_kms_key',
    'aws_secretsmanager_secret',
    'aws_ssm_parameter',
    'aws_cloudfront_distribution',
    'aws_waf_web_acl',
    'aws_wafv2_web_acl',
    // Azure Regional/Global Services
    'azurerm_resource_group',
    'azurerm_storage_account',
    'azurerm_cosmosdb_account',
    'azurerm_key_vault',
    'azurerm_log_analytics_workspace',
    // Security Groups (these connect to VPCs via vpc_id, but don't have outgoing connections)
    'aws_security_group',
    'azurerm_network_security_group',
  ]
  return regionalServices.some(type => resourceType === type)
}

/**
 * Check if a resource type is a compute resource
 */
function isComputeResource(resourceType: string): boolean {
  return resourceType === 'aws_instance' ||
         resourceType === 'azurerm_virtual_machine' ||
         resourceType === 'azurerm_linux_virtual_machine' ||
         resourceType === 'azurerm_windows_virtual_machine'
}

/**
 * Extract resource address from a reference string
 * e.g., "aws_vpc.main.id" -> "aws_vpc.main"
 */
function extractResourceReference(ref: string | any): string | null {
  if (typeof ref !== 'string') return null
  // Match pattern: resource_type.resource_name (with optional .property)
  const match = ref.match(/^([a-z_]+\.[a-z0-9_]+)/i)
  return match ? match[1] : null
}