import { useMemo, useState, useEffect } from 'react';
import { getIconsByProviderAndCategory, isCacheInitialized } from '@/lib/utils/deviceIconMapping';

// Provider and category structure matching Icons folder
export interface ProviderCategoryGroup {
  provider: string;
  categories: {
    name: string;
    iconFiles: string[];
  }[];
}

/**
 * Get device categories organized by provider and category (matching Icons folder structure)
 */
export function useDeviceCategoriesByFolder(): ProviderCategoryGroup[] {
  const [cacheReady, setCacheReady] = useState(isCacheInitialized());
  
  // Poll for cache initialization
  useEffect(() => {
    if (cacheReady) return;
    
    const interval = setInterval(() => {
      if (isCacheInitialized()) {
        setCacheReady(true);
        clearInterval(interval);
      }
    }, 100); // Check every 100ms
    
    return () => clearInterval(interval);
  }, [cacheReady]);
  
  return useMemo(() => {
    if (!cacheReady) {
      return [];
    }
    
    const organized = getIconsByProviderAndCategory();
    const providers: ProviderCategoryGroup[] = [];
    
    // Process providers in order: Azure, Aws, Infrastructure, Other
    const providerOrder = ['Azure', 'Aws', 'Infrastructure', 'Other'];
    
    for (const provider of providerOrder) {
      if (organized[provider]) {
        const categories = Object.entries(organized[provider])
          .map(([categoryName, iconFiles]) => ({
            name: categoryName,
            iconFiles: iconFiles,
          }))
          .filter(cat => cat.iconFiles.length > 0); // Only include categories with icons
        
        if (categories.length > 0) {
          providers.push({
            provider,
            categories,
          });
        }
      }
    }
    
    // Add any other providers not in the standard order
    for (const provider of Object.keys(organized)) {
      if (!providerOrder.includes(provider)) {
        const categories = Object.entries(organized[provider])
          .map(([categoryName, iconFiles]) => ({
            name: categoryName,
            iconFiles: iconFiles,
          }))
          .filter(cat => cat.iconFiles.length > 0);
        
        if (categories.length > 0) {
          providers.push({
            provider,
            categories,
          });
        }
      }
    }
    
    return providers;
  }, [cacheReady]);
}



