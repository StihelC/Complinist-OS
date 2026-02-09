import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Category mapping for converting old iconpack paths to new Icons paths
const categoryMapping = {
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
export function convertOldPathToNew(oldPath) {
  if (!oldPath || !oldPath.startsWith('src/iconpack/icons/')) {
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

  // Fallback: try to find file in new structure by searching recursively
  const iconsDir = path.join(__dirname, '../src/Icons');
  if (fs.existsSync(iconsDir)) {
    const found = findFileRecursive(iconsDir, filename);
    if (found) {
      const relativePath = path.relative(path.join(__dirname, '../src'), found);
      return relativePath.replace(/\\/g, '/');
    }
  }

  // Final fallback - but log a warning
  console.warn(`Could not find file ${filename} in new Icons structure, using fallback path`);
  return `src/Icons/Other/Miscellaneous/${filename}`;
}

/**
 * Recursively find a file by filename
 */
export function findFileRecursive(dir, filename) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, filename);
        if (found) return found;
      } else if (entry.name === filename) {
        return fullPath;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Derive device type from filename
 * Convert "Virtual-Machine.svg" → "virtual-machine"
 */
export function deriveDeviceTypeFromFilename(filename) {
  if (!filename) return null;
  // Remove .svg extension
  const withoutExt = filename.replace(/\.svg$/i, '');
  // Convert to lowercase kebab-case
  return withoutExt.toLowerCase();
}

/**
 * Derive display name from filename
 * Convert "Virtual-Machine.svg" → "Virtual Machine"
 */
export function deriveDisplayNameFromFilename(filename) {
  if (!filename) return null;
  // Remove .svg extension
  const withoutExt = filename.replace(/\.svg$/i, '');
  // Replace hyphens with spaces and capitalize words
  return withoutExt
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Infer IT category from icon path
 * Extract category from path like "src/Icons/Azure/Compute/Virtual-Machine.svg" → "Compute"
 */
export function inferITCategoryFromPath(iconPath) {
  if (!iconPath) return 'Miscellaneous';
  
  // Extract path parts: src/Icons/Provider/Category/Filename.svg
  const parts = iconPath.split('/');
  if (parts.length >= 4 && parts[0] === 'src' && parts[1] === 'Icons') {
    // parts[2] is provider (Azure, Aws, Infrastructure, Other)
    // parts[3] is category
    return parts[3] || 'Miscellaneous';
  }
  
  return 'Miscellaneous';
}

/**
 * Recursively scan all SVG files in Icons directory
 */
export function scanAllIconsRecursive(dir, iconsBaseDir, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanAllIconsRecursive(fullPath, iconsBaseDir, results);
      } else if (entry.name.endsWith('.svg')) {
        // Get relative path from iconsBaseDir (which is src/Icons)
        const relativePath = path.relative(iconsBaseDir, fullPath);
        // Construct icon path: src/Icons/Provider/Category/Filename.svg
        const iconPath = `src/Icons/${relativePath.replace(/\\/g, '/')}`;
        results.push({
          fullPath,
          iconPath,
          filename: entry.name
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
  return results;
}

