import type { TerraformPlan, TerraformResourceChange, ResourceReference } from './terraformTypes'
import { classifyRelationship } from './providerKnowledge'

/**
 * Extract all resource references from a Terraform plan by recursively scanning all attributes
 */
export function extractAllResourceReferences(plan: TerraformPlan): ResourceReference[] {
  const references: ResourceReference[] = []
  const resourceMap = new Map<string, TerraformResourceChange>(
    plan.resource_changes.map(r => [r.address, r])
  )

  for (const resource of plan.resource_changes) {
    const attrs = resource.change.after || {}

    // Recursively scan attributes
    scanAttributes(
      attrs,
      resource.address,
      resource.type,
      resourceMap,
      references,
      [] // path tracker
    )
  }

  // Classify relationships now that we have all references
  for (const ref of references) {
    const targetResource = resourceMap.get(ref.target)
    if (targetResource) {
      ref.relationshipType = classifyRelationship(
        resourceMap.get(ref.source)?.type || '',
        targetResource.type,
        ref.attributePath
      )
    }
  }

  return references
}

/**
 * Recursively scan any value for Terraform resource references
 */
function scanAttributes(
  value: any,
  sourceAddress: string,
  sourceType: string,
  resourceMap: Map<string, TerraformResourceChange>,
  references: ResourceReference[],
  path: string[]
): void {
  if (!value) return

  // String values: check for Terraform references
  if (typeof value === 'string') {
    const refs = extractReferencesFromString(value, resourceMap)
    for (const ref of refs) {
      references.push({
        source: sourceAddress,
        target: ref.address,
        attributePath: [...path],
        referenceValue: value,
        relationshipType: 'unknown', // Will be classified later
        confidence: ref.confidence,
      })
    }
    return
  }

  // Arrays: scan each element
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanAttributes(
        item,
        sourceAddress,
        sourceType,
        resourceMap,
        references,
        [...path, `[${index}]`]
      )
    })
    return
  }

  // Objects: scan each property
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, val]) => {
      scanAttributes(
        val,
        sourceAddress,
        sourceType,
        resourceMap,
        references,
        [...path, key]
      )
    })
    return
  }
}

/**
 * Extract resource references from a string value
 * Handles patterns like: "${aws_vpc.main.id}", "aws_subnet.public.id", etc.
 */
function extractReferencesFromString(
  value: string,
  resourceMap: Map<string, TerraformResourceChange>
): Array<{ address: string, targetType: string, confidence: 'high' | 'medium' | 'low' }> {
  const references: Array<{ address: string, targetType: string, confidence: 'high' | 'medium' | 'low' }> = []
  const seen = new Set<string>()

  // Pattern 1: Interpolated reference "${aws_resource.name.property}"
  const interpolatedPattern = /\$\{([a-z_]+\.[a-z0-9_]+)/gi
  let match: RegExpExecArray | null
  while ((match = interpolatedPattern.exec(value)) !== null) {
    const address = match[1]
    if (seen.has(address)) continue
    seen.add(address)

    const resource = resourceMap.get(address)
    if (resource) {
      references.push({
        address,
        targetType: resource.type,
        confidence: 'high',
      })
    }
  }

  // Pattern 2: Direct reference "aws_resource.name.property" (no interpolation)
  // Match pattern: word.word.word where first part is resource type
  const directPattern = /\b([a-z_]+)\.([a-z0-9_]+)(?:\.[a-z0-9_]+)*/gi
  while ((match = directPattern.exec(value)) !== null) {
    const resourceType = match[1]
    const resourceName = match[2]
    const address = `${resourceType}.${resourceName}`

    if (seen.has(address)) continue

    // Check if this looks like a Terraform resource reference
    // Resource types typically start with provider prefix (aws_, azurerm_, etc.)
    if (resourceType.startsWith('aws_') || resourceType.startsWith('azurerm_') || resourceType.startsWith('google_')) {
      seen.add(address)
      const resource = resourceMap.get(address)
      if (resource) {
        // High confidence if:
        // 1. Contains interpolation syntax ${...}
        // 2. The entire value is exactly a terraform reference (e.g., "aws_vpc.main.id")
        const isExactReference = /^[a-z_]+\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/i.test(value.trim())
        const confidence = value.includes('${') || isExactReference ? 'high' : 'medium'
        references.push({
          address,
          targetType: resource.type,
          confidence,
        })
      }
    }
  }

  return references
}