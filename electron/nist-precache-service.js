// NIST Pre-cache Service
// Handles pre-processing of NIST documents for first-launch optimization
// Checks if the shared compliance database is initialized and provides status

import path from 'path';
import fs from 'fs';
import { app } from 'electron';

// Path to shared NIST data
const getSharedDataPath = () => {
  if (!app.isPackaged) {
    return path.join(process.cwd(), '.data', 'shared');
  }
  return path.join(app.getPath('userData'), 'shared');
};

/**
 * Check if NIST compliance library is pre-cached
 * @returns {Object} Status of the pre-cached NIST data
 */
export function checkNISTCacheStatus() {
  try {
    const sharedPath = getSharedDataPath();
    const chromaPath = path.join(sharedPath, 'chroma_db');
    const chromaSqlite = path.join(chromaPath, 'chroma.sqlite3');

    // Check if ChromaDB exists
    const hasChromaDB = fs.existsSync(chromaSqlite);

    // Get database size if it exists
    let dbSize = 0;
    if (hasChromaDB) {
      const stats = fs.statSync(chromaSqlite);
      dbSize = stats.size;
    }

    // Check for catalog files
    const catalogPath = path.join(process.cwd(), 'src', 'assets', 'catalog');
    const hasBaselines = fs.existsSync(path.join(catalogPath, 'nist-800-53b-baselines.json'));
    const hasNISTCatalog = fs.existsSync(path.join(catalogPath, 'NIST_SP-800-53_rev5_catalog_load.csv'));

    return {
      isInitialized: hasChromaDB && dbSize > 1000, // Assume >1KB means populated
      hasChromaDB,
      databaseSize: dbSize,
      hasBaselines,
      hasNISTCatalog,
      sharedPath,
      chromaPath
    };
  } catch (error) {
    console.error('[NISTPreCache] Error checking cache status:', error);
    return {
      isInitialized: false,
      hasChromaDB: false,
      databaseSize: 0,
      hasBaselines: false,
      hasNISTCatalog: false,
      error: error.message
    };
  }
}

/**
 * Get list of available NIST documents that can be pre-processed
 * @returns {Array} List of available NIST document info
 */
export function getAvailableNISTDocuments() {
  return [
    {
      id: 'nist-800-53-rev5',
      title: 'NIST SP 800-53 Rev. 5 Controls',
      description: 'Complete security and privacy controls catalog',
      type: 'catalog',
      isBuiltIn: true,
      size: 'Large (~1.1MB)',
      chunks: 'Approximately 2000+ chunks'
    },
    {
      id: 'nist-800-53b-baselines',
      title: 'NIST SP 800-53B Baselines',
      description: 'Control baselines for LOW, MODERATE, HIGH impact systems',
      type: 'baselines',
      isBuiltIn: true,
      size: 'Small (~50KB)',
      chunks: 'N/A (Reference data)'
    }
  ];
}

/**
 * Check if this is the first launch (no user data exists)
 * @param {string} userId - User ID to check
 * @returns {boolean} True if first launch for this user
 */
export function isFirstLaunch(userId) {
  try {
    const userDataPath = path.join(
      app.isPackaged ? app.getPath('userData') : path.join(process.cwd(), '.data'),
      'users',
      userId
    );

    // Check if user directory exists and has any documents
    if (!fs.existsSync(userDataPath)) {
      return true;
    }

    const documentsFile = path.join(userDataPath, 'documents.json');
    if (!fs.existsSync(documentsFile)) {
      return true;
    }

    // Read documents metadata
    const metadata = JSON.parse(fs.readFileSync(documentsFile, 'utf-8'));
    return !metadata.documents || metadata.documents.length === 0;
  } catch (error) {
    console.error('[NISTPreCache] Error checking first launch:', error);
    return true;
  }
}

/**
 * Get recommended documents based on project baseline
 * @param {string} baseline - Project baseline (LOW, MODERATE, HIGH)
 * @returns {Array} Recommended document list
 */
export function getRecommendedDocuments(baseline) {
  const base = baseline?.toUpperCase() || 'MODERATE';

  const recommendations = [
    {
      id: 'nist-800-53',
      title: 'NIST SP 800-53 Rev. 5',
      relevance: 'essential',
      reason: 'Core security controls reference'
    },
    {
      id: 'nist-800-37',
      title: 'NIST SP 800-37 Rev. 2 (RMF)',
      relevance: 'essential',
      reason: 'Risk management framework guidance'
    }
  ];

  if (base === 'MODERATE' || base === 'HIGH') {
    recommendations.push({
      id: 'nist-800-30',
      title: 'NIST SP 800-30 Rev. 1',
      relevance: 'recommended',
      reason: 'Risk assessment methodology'
    });
  }

  if (base === 'HIGH') {
    recommendations.push({
      id: 'nist-800-137',
      title: 'NIST SP 800-137',
      relevance: 'recommended',
      reason: 'Continuous monitoring guidance'
    });
  }

  return recommendations;
}

export default {
  checkNISTCacheStatus,
  getAvailableNISTDocuments,
  isFirstLaunch,
  getRecommendedDocuments
};
