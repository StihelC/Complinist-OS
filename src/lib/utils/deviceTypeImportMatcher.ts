/**
 * Device Type Import Matcher
 *
 * Handles device type matching when importing projects/templates
 * Ensures imported nodes use the closest matching device type from the database
 */

import type { AppNode, DeviceNodeData } from './types'

/**
 * Match device types for imported nodes
 * Updates nodes to use existing device types from database
 */
export async function matchDeviceTypesForImport(nodes: AppNode[]): Promise<AppNode[]> {
  if (!nodes || nodes.length === 0) {
    return nodes
  }

  // Check if electronAPI is available
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    console.warn('[deviceTypeImportMatcher] electronAPI not available, skipping device type matching')
    return nodes
  }

  try {
    // Build match requests for all device nodes
    const matchRequests = nodes
      .filter(node => node.type === 'device' && node.data)
      .map(node => {
        const deviceData = node.data as DeviceNodeData
        return {
          deviceType: deviceData.deviceType,
          deviceSubtype: deviceData.deviceSubtype,
          iconPath: deviceData.iconPath,
          // Try to infer category from device type if available
          category: inferCategoryFromDeviceType(deviceData.deviceType)
        }
      })

    if (matchRequests.length === 0) {
      return nodes
    }

    // Batch match all device types
    console.log(`[deviceTypeImportMatcher] Matching ${matchRequests.length} device types...`)
    const matchResults = await (window as any).electronAPI.batchFindDeviceTypeMatch(matchRequests)

    // Apply matches to nodes
    let matchCount = 0
    let resultIndex = 0

    const updatedNodes = nodes.map(node => {
      if (node.type !== 'device' || !node.data) {
        return node
      }

      const matchResult = matchResults[resultIndex++]
      if (!matchResult) {
        return node
      }

      const deviceData = node.data as DeviceNodeData

      // Only update if we got a good match or the icon doesn't exist
      if (matchResult.matched && matchResult.matchScore > 0.5) {
        matchCount++
        console.log(
          `[deviceTypeImportMatcher] Matched '${deviceData.name}': ${deviceData.deviceType} -> ${matchResult.deviceType} ` +
          `(score: ${matchResult.matchScore.toFixed(2)}, reason: ${matchResult.matchReason})`
        )

        return {
          ...node,
          data: {
            ...deviceData,
            deviceType: matchResult.deviceType as any,
            deviceSubtype: matchResult.deviceSubtype || deviceData.deviceSubtype,
            iconPath: matchResult.iconPath
          }
        }
      }

      // Even if no good match, update icon if the current one doesn't exist
      if (matchResult.iconPath && matchResult.iconPath !== deviceData.iconPath) {
        console.log(
          `[deviceTypeImportMatcher] Updated icon for '${deviceData.name}': ${deviceData.iconPath} -> ${matchResult.iconPath}`
        )
        return {
          ...node,
          data: {
            ...deviceData,
            iconPath: matchResult.iconPath
          }
        }
      }

      return node
    })

    console.log(`[deviceTypeImportMatcher] Successfully matched ${matchCount}/${matchRequests.length} devices`)
    return updatedNodes

  } catch (error) {
    console.error('[deviceTypeImportMatcher] Error matching device types:', error)
    // Return original nodes if matching fails
    return nodes
  }
}

/**
 * Infer category from device type string
 * Helps improve matching accuracy
 */
function inferCategoryFromDeviceType(deviceType: string): string | undefined {
  if (!deviceType) return undefined

  const type = deviceType.toLowerCase()

  // Compute
  if (type.includes('vm') || type.includes('virtual-machine') ||
      type.includes('app-service') || type.includes('function') ||
      type.includes('container') || type.includes('kubernetes')) {
    return 'Compute'
  }

  // Networking
  if (type.includes('network') || type.includes('load-balancer') ||
      type.includes('gateway') || type.includes('firewall') ||
      type.includes('dns') || type.includes('public-ip')) {
    return 'Networking'
  }

  // Storage
  if (type.includes('storage') || type.includes('disk') ||
      type.includes('blob') || type.includes('file')) {
    return 'Storage'
  }

  // Databases
  if (type.includes('database') || type.includes('sql') ||
      type.includes('cosmos') || type.includes('redis') ||
      type.includes('mysql') || type.includes('postgresql')) {
    return 'Databases'
  }

  // Security
  if (type.includes('key-vault') || type.includes('security') ||
      type.includes('defender') || type.includes('sentinel')) {
    return 'Security'
  }

  return undefined
}
