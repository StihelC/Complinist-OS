// Auto-generated Azure icon mappings
// This file maps Azure service icons to device types
// Data is now loaded from SQLite database and cached in memory

import { DeviceType, ITCategory, NetworkLayer } from './types';

export interface DeviceIconMetadata {
  deviceType: DeviceType;
  deviceSubtype?: string;
  itCategory: ITCategory;
  networkLayer: NetworkLayer;
  displayName: string;
}

// In-memory cache populated from database on startup
let deviceIconCache: Record<string, DeviceIconMetadata> = {};
let cacheInitialized = false;
let cacheInitializationPromise: Promise<void> | null = null;

/**
 * Initialize device icon cache from database
 * Called on app startup to load all device types into memory
 */
export async function initializeDeviceIconCache(): Promise<void> {
  // If already initialized, return immediately
  if (cacheInitialized) {
    return;
  }

  // If initialization is in progress, wait for it
  if (cacheInitializationPromise) {
    return cacheInitializationPromise;
  }

  // Start initialization
  cacheInitializationPromise = (async () => {
    try {
      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const deviceTypes = await (window as any).electronAPI.getDeviceTypes();
        
        if (!Array.isArray(deviceTypes)) {
          console.error('getDeviceTypes returned invalid data:', deviceTypes);
          throw new Error('Invalid response from database');
        }
        
        // Build cache from database results
        const newCache: Record<string, DeviceIconMetadata> = {};
        for (const row of deviceTypes) {
          if (row && row.icon_path && row.device_type) {
            newCache[row.icon_path] = {
              deviceType: row.device_type as DeviceType,
              deviceSubtype: row.device_subtype || undefined,
              itCategory: row.it_category as ITCategory,
              networkLayer: row.network_layer as NetworkLayer,
              displayName: row.display_name,
            };
          }
        }
        
        deviceIconCache = newCache;
        cacheInitialized = true;
        const entryCount = Object.keys(deviceIconCache).length;
        console.log(`Device icon cache initialized with ${entryCount} entries`);
        
        if (entryCount === 0) {
          console.warn('⚠️ Device icon cache is empty!');
          console.warn('The database may need to be populated. Please:');
          console.warn('1. Check the main process console for migration messages');
          console.warn('2. Restart the app to trigger auto-migration');
          console.warn('3. Or run: node scripts/populate-device-types.js');
        }
      } else {
        // Not in Electron environment (e.g., during build or tests)
        console.warn('Device icon cache: Not in Electron environment, cache will remain empty');
        cacheInitialized = true; // Mark as initialized to prevent retries
      }
    } catch (error) {
      console.error('Failed to initialize device icon cache:', error);
      // Mark as initialized even on error to prevent infinite retries
      cacheInitialized = true;
      throw error;
    }
  })();

  return cacheInitializationPromise;
}

/**
 * Get device icon metadata by icon path
 * Synchronous lookup from in-memory cache
 */
export function getDeviceIconMetadata(iconPath: string): DeviceIconMetadata | undefined {
  if (!iconPath) return undefined;
  
  // If cache not initialized, return undefined (components should wait for initialization)
  if (!cacheInitialized) {
    return undefined;
  }
  
  // Direct lookup in cache
  return deviceIconCache[iconPath];
}

/**
 * Get all icons for a specific device type
 */
export function getIconsForDeviceType(deviceType: DeviceType): string[] {
  if (!cacheInitialized) {
    return [];
  }
  
  return Object.entries(deviceIconCache)
    .filter(([_, metadata]) => metadata.deviceType === deviceType)
    .map(([path]) => path);
}

/**
 * Get all icons in a category
 */
export function getIconsForCategory(category: ITCategory): string[] {
  if (!cacheInitialized) {
    return [];
  }
  
  return Object.entries(deviceIconCache)
    .filter(([_, metadata]) => metadata.itCategory === category)
    .map(([path]) => path);
}

/**
 * Get all icons for a network layer
 */
export function getIconsForNetworkLayer(layer: NetworkLayer): string[] {
  if (!cacheInitialized) {
    return [];
  }
  
  return Object.entries(deviceIconCache)
    .filter(([_, metadata]) => metadata.networkLayer === layer)
    .map(([path]) => path);
}

/**
 * Get all unique device types from the cache
 */
export function getAllMappedDeviceTypes(): DeviceType[] {
  if (!cacheInitialized) {
    return [];
  }
  
  const types = new Set<DeviceType>();
  Object.values(deviceIconCache).forEach(metadata => {
    types.add(metadata.deviceType);
  });
  return Array.from(types);
}

/**
 * Check if cache is initialized
 */
export function isCacheInitialized(): boolean {
  return cacheInitialized;
}

/**
 * Get icons organized by provider and category
 * Returns structure: { Provider: { Category: [iconPaths] } }
 */
export function getIconsByProviderAndCategory(): Record<string, Record<string, string[]>> {
  if (!cacheInitialized) {
    return {};
  }

  const organized: Record<string, Record<string, string[]>> = {};

  for (const [iconPath, _metadata] of Object.entries(deviceIconCache)) {
    // Extract provider from icon path (e.g., "src/Icons/Azure/..." -> "Azure")
    const pathParts = iconPath.split('/');
    const provider = pathParts[2] || 'Other'; // src/Icons/{Provider}/...
    const category = pathParts[3] || 'Uncategorized'; // src/Icons/{Provider}/{Category}/...

    if (!organized[provider]) {
      organized[provider] = {};
    }
    if (!organized[provider][category]) {
      organized[provider][category] = [];
    }

    organized[provider][category].push(iconPath);
  }

  return organized;
}

/**
 * Manually trigger migration and reload cache
 * Useful for debugging or manual migration
 */
export async function triggerMigrationAndReload(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.migrateDeviceTypes();
      if (result.success) {
        console.log(`Migration completed: ${result.count} entries in database`);
        // Reset cache and reload
        deviceIconCache = {};
        cacheInitialized = false;
        cacheInitializationPromise = null;
        await initializeDeviceIconCache();
      } else {
        console.error('Migration failed:', result.error);
        throw new Error(result.error || 'Migration failed');
      }
    } else {
      throw new Error('Electron API not available');
    }
  } catch (error) {
    console.error('Error triggering migration:', error);
    throw error;
  }
}
