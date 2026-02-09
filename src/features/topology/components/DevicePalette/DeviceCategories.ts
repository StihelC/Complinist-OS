import { useMemo, useState, useEffect } from 'react';
import { getIconsForCategory, getIconsForNetworkLayer, isCacheInitialized } from '@/lib/utils/deviceIconMapping';

// Category structure for organizing devices
export interface DeviceCategoryGroup {
  name: string;
  icon: string;
  iconFiles: string[]; // Icon filenames
}

// IT Function Categories - Azure-based
// Use a function to get categories reactively (updates when cache is ready)
export function useITCategories(): DeviceCategoryGroup[] {
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
    
    const computeIcons = getIconsForCategory('Compute');
    const networkingIcons = getIconsForCategory('Networking');
    
    // REMOVED: Duplicate warning - already logged during cache initialization in deviceIconMapping.ts
    
    return [
      {
        name: 'Compute',
        icon: '🖥️',
        iconFiles: computeIcons,
      },
      {
        name: 'Networking',
        icon: '🌐',
        iconFiles: networkingIcons,
      },
      {
        name: 'Storage',
        icon: '💾',
        iconFiles: getIconsForCategory('Storage'),
      },
      {
        name: 'Databases',
        icon: '🗄️',
        iconFiles: getIconsForCategory('Databases'),
      },
      {
        name: 'Security',
        icon: '🔒',
        iconFiles: getIconsForCategory('Security'),
      },
      {
        name: 'AI & Machine Learning',
        icon: '🤖',
        iconFiles: getIconsForCategory('AI-Machine-Learning'),
      },
      {
        name: 'Analytics',
        icon: '📊',
        iconFiles: getIconsForCategory('Analytics'),
      },
      {
        name: 'Identity',
        icon: '👤',
        iconFiles: getIconsForCategory('Identity'),
      },
      {
        name: 'IoT',
        icon: '📡',
        iconFiles: getIconsForCategory('IoT'),
      },
      {
        name: 'Integration',
        icon: '🔗',
        iconFiles: getIconsForCategory('Integration'),
      },
      {
        name: 'DevOps',
        icon: '⚙️',
        iconFiles: getIconsForCategory('DevOps'),
      },
      {
        name: 'Management & Governance',
        icon: '📋',
        iconFiles: getIconsForCategory('Management-Governance'),
      },
      {
        name: 'Web',
        icon: '🌍',
        iconFiles: getIconsForCategory('Web'),
      },
      {
        name: 'Containers',
        icon: '📦',
        iconFiles: getIconsForCategory('Containers'),
      },
      {
        name: 'Hybrid & Multicloud',
        icon: '☁️',
        iconFiles: getIconsForCategory('Hybrid-Multicloud'),
      },
      {
        name: 'Other',
        icon: '📁',
        iconFiles: getIconsForCategory('Other'),
      },
    ];
  }, [cacheReady]);
}

// Network Layer Categories
export function useNetworkLayerCategories(): DeviceCategoryGroup[] {
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
    
    return [
      {
        name: 'Physical Layer',
        icon: '🔌',
        iconFiles: getIconsForNetworkLayer('Physical'),
      },
      {
        name: 'Data Link Layer',
        icon: '🔗',
        iconFiles: getIconsForNetworkLayer('Data Link'),
      },
      {
        name: 'Network Layer',
        icon: '🌐',
        iconFiles: getIconsForNetworkLayer('Network'),
      },
      {
        name: 'Application Layer',
        icon: '📱',
        iconFiles: getIconsForNetworkLayer('Application'),
      },
    ];
  }, [cacheReady]);
}

// Legacy exports for backward compatibility (will be empty until cache loads)
// These are kept for components that haven't been updated yet
export const itCategories: DeviceCategoryGroup[] = [];
export const networkLayerCategories: DeviceCategoryGroup[] = [];
