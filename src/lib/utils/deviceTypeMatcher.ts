/**
 * Device Type Matcher
 *
 * Provides intelligent matching of device types, subtypes, and categories
 * to existing device types in the database. Used for:
 * - Terraform imports
 * - Template loading
 * - JSON project imports
 *
 * This ensures that imported resources use the closest matching existing
 * device type and icon rather than falling back to generic defaults.
 */

import type { DeviceType, ITCategory, NetworkLayer } from './types'

export interface DeviceTypeRecord {
  icon_path: string
  device_type: DeviceType
  device_subtype?: string
  display_name: string
  it_category: ITCategory
  network_layer: NetworkLayer
}

export interface DeviceTypeMatchRequest {
  // Primary matching criteria
  deviceType?: string
  deviceSubtype?: string
  category?: string

  // Additional context for better matching
  resourceType?: string  // e.g., 'aws_instance', 'azurerm_virtual_machine'
  provider?: string      // e.g., 'aws', 'azurerm'
  attributes?: Record<string, any>

  // Existing iconPath to validate/fallback to
  iconPath?: string
}

export interface DeviceTypeMatchResult {
  matched: boolean
  deviceType: DeviceType
  deviceSubtype?: string
  iconPath: string
  displayName: string
  matchScore: number
  matchReason: string
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (no match) and 1 (exact match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8

  const len1 = s1.length
  const len2 = s2.length
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Calculate Levenshtein distance
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)

  return 1 - (distance / maxLen)
}

/**
 * Normalize strings for comparison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract keywords from a string for matching
 */
function extractKeywords(str: string): string[] {
  return normalize(str).split(' ').filter(word => word.length > 2)
}

/**
 * Match device type against available device types from database
 */
export function findBestDeviceTypeMatch(
  request: DeviceTypeMatchRequest,
  availableTypes: DeviceTypeRecord[]
): DeviceTypeMatchResult {
  if (availableTypes.length === 0) {
    // No device types available, return generic fallback
    return {
      matched: false,
      deviceType: 'virtual-machine',
      iconPath: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
      displayName: 'Generic Resource',
      matchScore: 0,
      matchReason: 'No device types available in database'
    }
  }

  // If iconPath is provided and exists in database, use it
  if (request.iconPath) {
    const exactIconMatch = availableTypes.find(t => t.icon_path === request.iconPath)
    if (exactIconMatch) {
      return {
        matched: true,
        deviceType: exactIconMatch.device_type,
        deviceSubtype: exactIconMatch.device_subtype,
        iconPath: exactIconMatch.icon_path,
        displayName: exactIconMatch.display_name,
        matchScore: 1.0,
        matchReason: 'Exact icon path match'
      }
    }
  }

  let bestMatch: DeviceTypeRecord | null = null
  let bestScore = 0
  let matchReason = ''

  for (const typeRecord of availableTypes) {
    let score = 0
    const reasons: string[] = []

    // 1. Exact device type match (highest priority)
    if (request.deviceType && normalize(typeRecord.device_type) === normalize(request.deviceType)) {
      score += 50
      reasons.push('exact device type')
    } else if (request.deviceType) {
      const similarity = calculateSimilarity(typeRecord.device_type, request.deviceType)
      if (similarity > 0.7) {
        score += similarity * 40
        reasons.push(`device type similarity: ${(similarity * 100).toFixed(0)}%`)
      }
    }

    // 2. Device subtype match
    if (request.deviceSubtype && typeRecord.device_subtype) {
      if (normalize(typeRecord.device_subtype) === normalize(request.deviceSubtype)) {
        score += 30
        reasons.push('exact subtype')
      } else {
        const similarity = calculateSimilarity(typeRecord.device_subtype, request.deviceSubtype)
        if (similarity > 0.7) {
          score += similarity * 20
          reasons.push(`subtype similarity: ${(similarity * 100).toFixed(0)}%`)
        }
      }
    }

    // 3. Category match
    if (request.category && normalize(typeRecord.it_category) === normalize(request.category)) {
      score += 20
      reasons.push('category match')
    }

    // 4. Provider-specific matching (AWS/Azure)
    if (request.provider && request.resourceType) {
      const iconPathLower = typeRecord.icon_path.toLowerCase()
      const providerLower = request.provider.toLowerCase()

      // Prefer icons from the same provider
      if (providerLower === 'aws' && iconPathLower.includes('/aws/')) {
        score += 15
        reasons.push('AWS provider match')
      } else if (providerLower === 'azurerm' && iconPathLower.includes('/azure/')) {
        score += 15
        reasons.push('Azure provider match')
      }

      // Match resource type keywords
      const resourceKeywords = extractKeywords(request.resourceType)
      const displayNameKeywords = extractKeywords(typeRecord.display_name)
      const matchingKeywords = resourceKeywords.filter(kw =>
        displayNameKeywords.some(dnk => calculateSimilarity(kw, dnk) > 0.8)
      )

      if (matchingKeywords.length > 0) {
        score += matchingKeywords.length * 10
        reasons.push(`${matchingKeywords.length} keyword match(es)`)
      }
    }

    // 5. Display name similarity
    if (request.deviceType) {
      const displayNameSimilarity = calculateSimilarity(typeRecord.display_name, request.deviceType)
      if (displayNameSimilarity > 0.6) {
        score += displayNameSimilarity * 15
        reasons.push(`display name similarity: ${(displayNameSimilarity * 100).toFixed(0)}%`)
      }
    }

    // Update best match if this is better
    if (score > bestScore) {
      bestScore = score
      bestMatch = typeRecord
      matchReason = reasons.join(', ')
    }
  }

  // If we found a match with reasonable confidence
  if (bestMatch && bestScore >= 20) {
    return {
      matched: true,
      deviceType: bestMatch.device_type,
      deviceSubtype: bestMatch.device_subtype,
      iconPath: bestMatch.icon_path,
      displayName: bestMatch.display_name,
      matchScore: Math.min(bestScore / 100, 1.0),
      matchReason
    }
  }

  // Fallback to a reasonable default based on category
  const categoryFallback = findCategoryFallback(request.category, availableTypes)
  if (categoryFallback) {
    return {
      matched: false,
      deviceType: categoryFallback.device_type,
      deviceSubtype: categoryFallback.device_subtype,
      iconPath: categoryFallback.icon_path,
      displayName: categoryFallback.display_name,
      matchScore: 0.3,
      matchReason: `Category-based fallback (${request.category})`
    }
  }

  // Ultimate fallback: use the first available type or generic
  const ultimateFallback = availableTypes[0] || {
    icon_path: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
    device_type: 'virtual-machine' as DeviceType,
    display_name: 'Generic Resource',
    it_category: 'Other' as ITCategory,
    network_layer: 'Application' as NetworkLayer
  }

  return {
    matched: false,
    deviceType: ultimateFallback.device_type,
    deviceSubtype: ultimateFallback.device_subtype,
    iconPath: ultimateFallback.icon_path,
    displayName: ultimateFallback.display_name,
    matchScore: 0.1,
    matchReason: 'No good match found, using fallback'
  }
}

/**
 * Find a fallback device type based on category
 */
function findCategoryFallback(
  category: string | undefined,
  availableTypes: DeviceTypeRecord[]
): DeviceTypeRecord | null {
  if (!category) return null

  const normalizedCategory = normalize(category)

  // Define category priorities
  const categoryMappings: Record<string, string[]> = {
    'compute': ['virtual machine', 'vm', 'compute'],
    'networking': ['network', 'load balancer', 'gateway'],
    'storage': ['storage', 'disk', 'blob'],
    'databases': ['database', 'sql', 'cosmos'],
    'security': ['security', 'firewall', 'key vault']
  }

  // Find matching category
  for (const [key, keywords] of Object.entries(categoryMappings)) {
    if (keywords.some(kw => normalizedCategory.includes(kw) || kw.includes(normalizedCategory))) {
      // Find first device of this category
      const match = availableTypes.find(t =>
        normalize(t.it_category).includes(key) || key.includes(normalize(t.it_category))
      )
      if (match) return match
    }
  }

  return null
}

/**
 * Batch match multiple device types
 */
export function batchMatchDeviceTypes(
  requests: DeviceTypeMatchRequest[],
  availableTypes: DeviceTypeRecord[]
): DeviceTypeMatchResult[] {
  return requests.map(request => findBestDeviceTypeMatch(request, availableTypes))
}
