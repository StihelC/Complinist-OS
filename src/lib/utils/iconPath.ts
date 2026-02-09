/**
 * Get the correct icon path for both development and production
 * Handles both new paths (src/Icons/...) and legacy iconpack paths
 * In dev: Vite serves from src, so we use /src/Icons/
 * In prod (Electron): Icons are in dist/Icons/, use relative paths
 * Automatically converts old iconpack paths to new Icons structure
 */

// Map old category names to new provider + category structure
const categoryMapping: Record<string, { provider: string; category: string }> = {
  'ai + machine learning': { provider: 'Azure', category: 'Ai-Ml' },
  'analytics': { provider: 'Azure', category: 'Analytics' },
  'app services': { provider: 'Azure', category: 'Application-Integration' },
  'azure ecosystem': { provider: 'Azure', category: 'Other' },
  'azure stack': { provider: 'Azure', category: 'Management-Governance' },
  'blockchain': { provider: 'Other', category: 'Miscellaneous' },
  'compute': { provider: 'Azure', category: 'Compute' },
  'containers': { provider: 'Azure', category: 'Compute' },
  'databases': { provider: 'Azure', category: 'Databases' },
  'devops': { provider: 'Azure', category: 'Developer-Tools' },
  'general': { provider: 'Other', category: 'Cloud-Services' },
  'hybrid + multicloud': { provider: 'Azure', category: 'Other' },
  'identity': { provider: 'Azure', category: 'Security-Identity' },
  'integration': { provider: 'Azure', category: 'Application-Integration' },
  'intune': { provider: 'Azure', category: 'Management-Governance' },
  'iot': { provider: 'Azure', category: 'Iot-Edge' },
  'management + governance': { provider: 'Azure', category: 'Management-Governance' },
  'menu': { provider: 'Other', category: 'Miscellaneous' },
  'migrate': { provider: 'Azure', category: 'Other' },
  'migration': { provider: 'Azure', category: 'Other' },
  'mixed reality': { provider: 'Other', category: 'Miscellaneous' },
  'mobile': { provider: 'Other', category: 'Miscellaneous' },
  'monitor': { provider: 'Azure', category: 'Management-Governance' },
  'networking': { provider: 'Azure', category: 'Networking' },
  'new icons': { provider: 'Other', category: 'Miscellaneous' },
  'other': { provider: 'Other', category: 'Miscellaneous' },
  'security': { provider: 'Azure', category: 'Security-Identity' },
  'storage': { provider: 'Azure', category: 'Storage' },
  'web': { provider: 'Azure', category: 'Application-Integration' },
};

/**
 * Convert old iconpack path to new Icons path
 */
function convertOldPathToNew(oldPath: string): string {
  if (!oldPath.startsWith('src/iconpack/icons/')) {
    return oldPath;
  }

  // Extract category and filename
  const parts = oldPath.replace('src/iconpack/icons/', '').split('/');
  if (parts.length < 2) return oldPath;

  const oldCategory = parts[0];
  const filename = parts[parts.length - 1];

  // Find mapping
  const mapping = categoryMapping[oldCategory.toLowerCase()];
  if (mapping) {
    return `src/Icons/${mapping.provider}/${mapping.category}/${filename}`;
  }

  // Fallback: try to find in new structure (will be handled by file system)
  // For now, return a reasonable default
  return `src/Icons/Other/Miscellaneous/${filename}`;
}

// Cache for tracking logged icon errors to avoid spam
const loggedIconErrors = new Set<string>();

/**
 * Check if we're running in Electron
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as any).electronAPI !== 'undefined';
}

/**
 * Get the correct icon path for both development and production
 */
export function getIconPath(iconPath: string): string {
  if (!iconPath) return '';

  // Check if we're in development mode (Vite dev server)
  // In Electron production, import.meta.env.DEV will be false or undefined
  const isDev = (import.meta as any).env?.DEV ?? false;
  const inElectron = isElectron();

  // Convert old iconpack paths to new Icons structure
  let normalizedPath = iconPath;
  if (iconPath.startsWith('src/iconpack/')) {
    normalizedPath = convertOldPathToNew(iconPath);
  }

  // Handle new path format: src/Icons/provider/category/filename.svg
  if (normalizedPath.startsWith('src/Icons/')) {
    // In Electron dev mode (Vite dev server), use /src/Icons/... (Vite serves from project root)
    // In Electron production (file://), use ./Icons/... (relative to HTML file)
    // In web dev (Vite), use absolute paths (/src/Icons/...)
    if (inElectron && isDev) {
      // Electron dev mode: Loading from Vite dev server, use absolute path
      return `/${normalizedPath}`;
    } else if (inElectron) {
      // Electron production: Loading from file://, use relative path
      const relativePath = normalizedPath.replace('src/Icons/', './Icons/');
      return relativePath;
    } else if (isDev) {
      // Web development: Vite dev server - use absolute path from src
      return `/${normalizedPath}`;
    } else {
      // Web production: Convert src/Icons/... to ./Icons/...
      const relativePath = normalizedPath.replace('src/Icons/', './Icons/');
      return relativePath;
    }
  }

  // Handle paths that already start with ./Icons/ (from database or already normalized)
  if (normalizedPath.startsWith('./Icons/')) {
    // In Electron dev mode, convert to absolute path for Vite dev server
    if (inElectron && isDev) {
      return normalizedPath.replace('./Icons/', '/src/Icons/');
    }
    return normalizedPath;
  }

  // Handle paths that start with /Icons/ (absolute in dev)
  if (normalizedPath.startsWith('/Icons/')) {
    // In Electron dev mode (Vite), keep absolute paths but ensure they're /src/Icons/...
    // In Electron production (file://), convert to relative paths
    if (inElectron && isDev) {
      // Convert /Icons/ to /src/Icons/ for Vite dev server
      return normalizedPath.replace('/Icons/', '/src/Icons/');
    } else if (inElectron && !isDev) {
      return normalizedPath.replace('/Icons/', './Icons/');
    }
    return normalizedPath;
  }

  // Handle paths that start with Icons/ (without src/ or ./ prefix)
  if (normalizedPath.startsWith('Icons/') && !normalizedPath.startsWith('src/Icons/')) {
    if (inElectron && isDev) {
      // Electron dev: Vite dev server - add /src/ prefix
      return `/src/${normalizedPath}`;
    } else if (inElectron) {
      // Electron production: file:// protocol - add ./ prefix
      return `./${normalizedPath}`;
    } else if (isDev) {
      // Web development: Vite dev server
      return `/src/${normalizedPath}`;
    } else {
      // Web production
      return `./${normalizedPath}`;
    }
  }

  // Handle legacy format: just filename or icons/category/filename.svg
  if (iconPath.startsWith('icons/')) {
    if (inElectron && isDev) {
      // Electron dev: Vite dev server
      return `/src/Icons/Other/Miscellaneous/${iconPath.replace('icons/', '')}`;
    } else if (inElectron) {
      // Electron production: file:// protocol
      return `./Icons/Other/Miscellaneous/${iconPath.replace('icons/', '')}`;
    } else if (isDev) {
      // Web development: Vite dev server
      return `/src/Icons/Other/Miscellaneous/${iconPath.replace('icons/', '')}`;
    } else {
      // Web production
      return `./Icons/Other/Miscellaneous/${iconPath.replace('icons/', '')}`;
    }
  }

  // If it's just a filename (no path separators), try to find it
  // First check if it might be a full path without the src/ prefix
  if (!iconPath.includes('/') && !iconPath.includes('\\')) {
    // Legacy: just filename - assume it's in Icons/Other/Miscellaneous/
    if (inElectron && isDev) {
      // Electron dev: Vite dev server
      return `/src/Icons/Other/Miscellaneous/${iconPath}`;
    } else if (inElectron) {
      // Electron production: file:// protocol
      return `./Icons/Other/Miscellaneous/${iconPath}`;
    } else if (isDev) {
      // Web development: Vite serves from src
      return `/src/Icons/Other/Miscellaneous/${iconPath}`;
    } else {
      // Web production: Icons are in dist/Icons/
      return `./Icons/Other/Miscellaneous/${iconPath}`;
    }
  }

  // If we have a path but it doesn't match any pattern, try to normalize it
  // This handles cases where paths might be missing the src/ prefix
  if (normalizedPath.includes('Icons/') && !normalizedPath.startsWith('src/') && !normalizedPath.startsWith('./') && !normalizedPath.startsWith('/')) {
    if (inElectron && isDev) {
      // Electron dev: Vite dev server
      return `/src/${normalizedPath}`;
    } else if (inElectron) {
      // Electron production: file:// protocol
      return `./${normalizedPath}`;
    } else if (isDev) {
      // Web development: Vite dev server
      return `/src/${normalizedPath}`;
    } else {
      // Web production
      return `./${normalizedPath}`;
    }
  }

  // Final fallback: treat as relative path
  if (inElectron && isDev) {
    // Electron dev: Vite dev server
    return `/src/Icons/Other/Miscellaneous/${iconPath}`;
  } else if (inElectron) {
    // Electron production: file:// protocol
    return `./Icons/Other/Miscellaneous/${iconPath}`;
  } else if (isDev) {
    // Web development: Vite dev server
    return `/src/Icons/Other/Miscellaneous/${iconPath}`;
  } else {
    // Web production
    return `./Icons/Other/Miscellaneous/${iconPath}`;
  }
}

/**
 * Log an icon loading error (debounced to avoid spam)
 * @param iconPath - The original icon path that failed to load
 * @param resolvedPath - The resolved URL that was attempted
 * @param error - The error that occurred
 */
export function logIconError(iconPath: string, resolvedPath: string, error?: Error | Event): void {
  const errorKey = `${iconPath}:${resolvedPath}`;
  if (loggedIconErrors.has(errorKey)) {
    return; // Already logged this error
  }
  loggedIconErrors.add(errorKey);

  console.warn(
    `[Icon Loading Error] Failed to load icon:\n` +
    `  Original path: ${iconPath}\n` +
    `  Resolved path: ${resolvedPath}\n` +
    `  Environment: ${(import.meta as any).env?.DEV ? 'development' : 'production'}\n` +
    `  Electron: ${isElectron()}` +
    (error instanceof Error ? `\n  Error: ${error.message}` : '')
  );
}

/**
 * Clear the icon error log cache (useful for testing or after fixing issues)
 */
export function clearIconErrorLog(): void {
  loggedIconErrors.clear();
}

