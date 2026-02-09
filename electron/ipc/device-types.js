import { getDatabase } from '../modules/database-init.js';
import { migrateDeviceTypes } from '../database/index.js';

/**
 * Register device types IPC handlers
 */
export function registerDeviceTypesHandlers(ipcMain) {
  ipcMain.handle('device-types:get-all', async () => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM device_types ORDER BY icon_path');
      const results = stmt.all();
      console.log(`[IPC] device-types:get-all returned ${results.length} entries`);
      return results;
    } catch (error) {
      console.error('Error fetching all device types:', error);
      throw error;
    }
  });

  ipcMain.handle('device-types:get-by-icon', async (event, iconPath) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM device_types WHERE icon_path = ?');
      return stmt.get(iconPath);
    } catch (error) {
      console.error('Error fetching device type by icon path:', error);
      throw error;
    }
  });

  ipcMain.handle('device-types:migrate', async () => {
    try {
      console.log('[IPC] Manual migration triggered');
      migrateDeviceTypes();
      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM device_types').get().count;
      return { success: true, count };
    } catch (error) {
      console.error('[IPC] Migration error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Find best matching device type for a given request
   * Used for Terraform imports and template loading
   */
  ipcMain.handle('device-types:find-match', async (event, matchRequest) => {
    try {
      const {
        deviceType,
        deviceSubtype,
        category,
        resourceType,
        provider,
        iconPath
      } = matchRequest;

      // Get all device types from database
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM device_types');
      const availableTypes = stmt.all();

      if (availableTypes.length === 0) {
        console.warn('[device-types:find-match] No device types in database');
        return {
          matched: false,
          deviceType: 'virtual-machine',
          iconPath: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
          displayName: 'Generic Resource',
          matchScore: 0,
          matchReason: 'No device types available'
        };
      }

      // If iconPath provided and exists, return it directly
      if (iconPath) {
        const exactMatch = availableTypes.find(t => t.icon_path === iconPath);
        if (exactMatch) {
          return {
            matched: true,
            deviceType: exactMatch.device_type,
            deviceSubtype: exactMatch.device_subtype,
            iconPath: exactMatch.icon_path,
            displayName: exactMatch.display_name,
            matchScore: 1.0,
            matchReason: 'Exact icon path match'
          };
        }
      }

      // Perform fuzzy matching
      const match = findBestMatch(matchRequest, availableTypes);
      console.log(`[device-types:find-match] Matched ${deviceType || resourceType} -> ${match.deviceType} (score: ${match.matchScore.toFixed(2)})`);

      return match;
    } catch (error) {
      console.error('[device-types:find-match] Error:', error);
      // Return safe fallback on error
      return {
        matched: false,
        deviceType: 'virtual-machine',
        iconPath: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
        displayName: 'Generic Resource',
        matchScore: 0,
        matchReason: `Error: ${error.message}`
      };
    }
  });

  /**
   * Batch find matching device types
   */
  ipcMain.handle('device-types:batch-find-match', async (event, matchRequests) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM device_types');
      const availableTypes = stmt.all();

      const results = matchRequests.map(request => {
        return findBestMatch(request, availableTypes);
      });

      console.log(`[device-types:batch-find-match] Processed ${matchRequests.length} requests`);
      return results;
    } catch (error) {
      console.error('[device-types:batch-find-match] Error:', error);
      throw error;
    }
  });

  console.log('[IPC] Device types handlers registered (get-all, get-by-icon, migrate, find-match, batch-find-match)');
}

/**
 * Find best matching device type
 * Implements fuzzy matching logic similar to deviceTypeMatcher.ts
 */
function findBestMatch(request, availableTypes) {
  if (availableTypes.length === 0) {
    return {
      matched: false,
      deviceType: 'virtual-machine',
      iconPath: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
      displayName: 'Generic Resource',
      matchScore: 0,
      matchReason: 'No device types available'
    };
  }

  const { deviceType, deviceSubtype, category, resourceType, provider, iconPath } = request;

  // Exact icon match
  if (iconPath) {
    const exactMatch = availableTypes.find(t => t.icon_path === iconPath);
    if (exactMatch) {
      return {
        matched: true,
        deviceType: exactMatch.device_type,
        deviceSubtype: exactMatch.device_subtype,
        iconPath: exactMatch.icon_path,
        displayName: exactMatch.display_name,
        matchScore: 1.0,
        matchReason: 'Exact icon path match'
      };
    }
  }

  let bestMatch = null;
  let bestScore = 0;
  let matchReason = '';

  for (const typeRecord of availableTypes) {
    let score = 0;
    const reasons = [];

    // Exact device type match
    if (deviceType && normalize(typeRecord.device_type) === normalize(deviceType)) {
      score += 50;
      reasons.push('exact device type');
    } else if (deviceType) {
      const similarity = calculateSimilarity(typeRecord.device_type, deviceType);
      if (similarity > 0.7) {
        score += similarity * 40;
        reasons.push(`device type similarity: ${(similarity * 100).toFixed(0)}%`);
      }
    }

    // Device subtype match
    if (deviceSubtype && typeRecord.device_subtype) {
      if (normalize(typeRecord.device_subtype) === normalize(deviceSubtype)) {
        score += 30;
        reasons.push('exact subtype');
      } else {
        const similarity = calculateSimilarity(typeRecord.device_subtype, deviceSubtype);
        if (similarity > 0.7) {
          score += similarity * 20;
          reasons.push(`subtype similarity: ${(similarity * 100).toFixed(0)}%`);
        }
      }
    }

    // Category match
    if (category && normalize(typeRecord.it_category) === normalize(category)) {
      score += 20;
      reasons.push('category match');
    }

    // Provider matching
    if (provider && resourceType) {
      const iconPathLower = typeRecord.icon_path.toLowerCase();
      const providerLower = provider.toLowerCase();

      if (providerLower === 'aws' && iconPathLower.includes('/aws/')) {
        score += 15;
        reasons.push('AWS provider match');
      } else if (providerLower === 'azurerm' && iconPathLower.includes('/azure/')) {
        score += 15;
        reasons.push('Azure provider match');
      }

      // Keyword matching
      const resourceKeywords = extractKeywords(resourceType);
      const displayKeywords = extractKeywords(typeRecord.display_name);
      const matchingKeywords = resourceKeywords.filter(kw =>
        displayKeywords.some(dk => calculateSimilarity(kw, dk) > 0.8)
      );

      if (matchingKeywords.length > 0) {
        score += matchingKeywords.length * 10;
        reasons.push(`${matchingKeywords.length} keyword match(es)`);
      }
    }

    // Display name similarity
    if (deviceType) {
      const displaySimilarity = calculateSimilarity(typeRecord.display_name, deviceType);
      if (displaySimilarity > 0.6) {
        score += displaySimilarity * 15;
        reasons.push(`display name similarity: ${(displaySimilarity * 100).toFixed(0)}%`);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = typeRecord;
      matchReason = reasons.join(', ');
    }
  }

  // Return best match if score is reasonable
  if (bestMatch && bestScore >= 20) {
    return {
      matched: true,
      deviceType: bestMatch.device_type,
      deviceSubtype: bestMatch.device_subtype,
      iconPath: bestMatch.icon_path,
      displayName: bestMatch.display_name,
      matchScore: Math.min(bestScore / 100, 1.0),
      matchReason
    };
  }

  // Category fallback
  const categoryFallback = findCategoryFallback(category, availableTypes);
  if (categoryFallback) {
    return {
      matched: false,
      deviceType: categoryFallback.device_type,
      deviceSubtype: categoryFallback.device_subtype,
      iconPath: categoryFallback.icon_path,
      displayName: categoryFallback.display_name,
      matchScore: 0.3,
      matchReason: `Category-based fallback (${category})`
    };
  }

  // Ultimate fallback
  const fallback = availableTypes[0];
  return {
    matched: false,
    deviceType: fallback.device_type,
    deviceSubtype: fallback.device_subtype,
    iconPath: fallback.icon_path,
    displayName: fallback.display_name,
    matchScore: 0.1,
    matchReason: 'No good match found, using fallback'
  };
}

// Helper functions
function normalize(str) {
  return str.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractKeywords(str) {
  return normalize(str).split(' ').filter(word => word.length > 2);
}

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

function findCategoryFallback(category, availableTypes) {
  if (!category) return null;

  const normalizedCategory = normalize(category);
  const categoryMappings = {
    'compute': ['virtual machine', 'vm', 'compute'],
    'networking': ['network', 'load balancer', 'gateway'],
    'storage': ['storage', 'disk', 'blob'],
    'databases': ['database', 'sql', 'cosmos'],
    'security': ['security', 'firewall', 'key vault']
  };

  for (const [key, keywords] of Object.entries(categoryMappings)) {
    if (keywords.some(kw => normalizedCategory.includes(kw) || kw.includes(normalizedCategory))) {
      const match = availableTypes.find(t =>
        normalize(t.it_category).includes(key) || key.includes(normalize(t.it_category))
      );
      if (match) return match;
    }
  }

  return null;
}

