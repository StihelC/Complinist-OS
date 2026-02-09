/**
 * Build Cache Management System
 *
 * Provides smart caching and incremental compilation support for both
 * main and renderer processes. Tracks file changes, module dependencies,
 * and build artifacts to enable faster incremental builds.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Cache configuration
const CACHE_DIR = path.join(PROJECT_ROOT, '.build-cache');
const CACHE_MANIFEST_FILE = path.join(CACHE_DIR, 'manifest.json');
const FILE_HASHES_FILE = path.join(CACHE_DIR, 'file-hashes.json');
const DEPENDENCY_GRAPH_FILE = path.join(CACHE_DIR, 'dep-graph.json');
const BUILD_STATS_FILE = path.join(CACHE_DIR, 'build-stats.json');

/**
 * Initialize cache directory structure
 */
function initCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Create subdirectories for different cache types
  const subdirs = ['tsc', 'esbuild', 'vite', 'artifacts'];
  for (const subdir of subdirs) {
    const subdirPath = path.join(CACHE_DIR, subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  }
}

/**
 * Calculate MD5 hash of file content
 */
function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Calculate hash of directory (based on file modification times)
 */
function hashDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json']) {
  const files = [];

  function walkDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules and hidden directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          const stat = fs.statSync(fullPath);
          files.push({ path: fullPath, mtime: stat.mtimeMs });
        }
      }
    } catch (error) {
      // Ignore inaccessible directories
    }
  }

  walkDir(dirPath);

  // Create hash from all file paths and modification times
  const hashInput = files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(f => `${f.path}:${f.mtime}`)
    .join('|');

  return crypto.createHash('md5').update(hashInput).digest('hex');
}

/**
 * Load existing cache manifest
 */
function loadCacheManifest() {
  try {
    if (fs.existsSync(CACHE_MANIFEST_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_MANIFEST_FILE, 'utf-8'));
    }
  } catch (error) {
    console.warn('Failed to load cache manifest:', error.message);
  }
  return {
    version: '1.0.0',
    lastBuild: null,
    buildCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    sourceHash: null,
    electronHash: null,
    dependencyHash: null,
  };
}

/**
 * Save cache manifest
 */
function saveCacheManifest(manifest) {
  try {
    fs.writeFileSync(CACHE_MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.warn('Failed to save cache manifest:', error.message);
  }
}

/**
 * Load file hashes for incremental compilation
 */
function loadFileHashes() {
  try {
    if (fs.existsSync(FILE_HASHES_FILE)) {
      return JSON.parse(fs.readFileSync(FILE_HASHES_FILE, 'utf-8'));
    }
  } catch (error) {
    console.warn('Failed to load file hashes:', error.message);
  }
  return {};
}

/**
 * Save file hashes
 */
function saveFileHashes(hashes) {
  try {
    fs.writeFileSync(FILE_HASHES_FILE, JSON.stringify(hashes, null, 2));
  } catch (error) {
    console.warn('Failed to save file hashes:', error.message);
  }
}

/**
 * Get list of changed files since last build
 */
function getChangedFiles(directories = ['src', 'electron']) {
  const previousHashes = loadFileHashes();
  const currentHashes = {};
  const changedFiles = [];
  const newFiles = [];
  const deletedFiles = new Set(Object.keys(previousHashes));

  for (const dir of directories) {
    const dirPath = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;

    walkDirectory(dirPath, (filePath) => {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      const hash = hashFile(filePath);
      currentHashes[relativePath] = hash;
      deletedFiles.delete(relativePath);

      if (previousHashes[relativePath]) {
        if (previousHashes[relativePath] !== hash) {
          changedFiles.push(relativePath);
        }
      } else {
        newFiles.push(relativePath);
      }
    });
  }

  saveFileHashes(currentHashes);

  return {
    changed: changedFiles,
    new: newFiles,
    deleted: Array.from(deletedFiles),
    total: changedFiles.length + newFiles.length + deletedFiles.size,
    requiresFullBuild: deletedFiles.size > 0 || newFiles.length > 10,
  };
}

/**
 * Walk directory and call callback for each file
 */
function walkDirectory(dir, callback, extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json']) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      if (entry.isDirectory()) {
        walkDirectory(fullPath, callback, extensions);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        callback(fullPath);
      }
    }
  } catch (error) {
    // Ignore inaccessible directories
  }
}

/**
 * Check if dependencies have changed (package.json or lock file)
 */
function checkDependencyChanges() {
  const manifest = loadCacheManifest();
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const lockFilePath = path.join(PROJECT_ROOT, 'package-lock.json');

  const currentHash = crypto.createHash('md5')
    .update(fs.existsSync(packageJsonPath) ? fs.readFileSync(packageJsonPath) : '')
    .update(fs.existsSync(lockFilePath) ? fs.readFileSync(lockFilePath) : '')
    .digest('hex');

  const changed = manifest.dependencyHash !== currentHash;

  if (changed) {
    manifest.dependencyHash = currentHash;
    saveCacheManifest(manifest);
  }

  return {
    changed,
    requiresNodeModulesRebuild: changed,
    requiresNativeRebuild: changed,
  };
}

/**
 * Load build statistics
 */
function loadBuildStats() {
  try {
    if (fs.existsSync(BUILD_STATS_FILE)) {
      return JSON.parse(fs.readFileSync(BUILD_STATS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.warn('Failed to load build stats:', error.message);
  }
  return {
    builds: [],
    averageBuildTime: 0,
    averageIncrementalTime: 0,
    cacheEfficiency: 0,
  };
}

/**
 * Record build statistics
 */
function recordBuildStats(stats) {
  const currentStats = loadBuildStats();

  currentStats.builds.push({
    timestamp: new Date().toISOString(),
    ...stats,
  });

  // Keep only last 50 builds
  if (currentStats.builds.length > 50) {
    currentStats.builds = currentStats.builds.slice(-50);
  }

  // Calculate averages
  const fullBuilds = currentStats.builds.filter(b => b.type === 'full');
  const incrementalBuilds = currentStats.builds.filter(b => b.type === 'incremental');

  currentStats.averageBuildTime = fullBuilds.length > 0
    ? fullBuilds.reduce((sum, b) => sum + b.duration, 0) / fullBuilds.length
    : 0;

  currentStats.averageIncrementalTime = incrementalBuilds.length > 0
    ? incrementalBuilds.reduce((sum, b) => sum + b.duration, 0) / incrementalBuilds.length
    : 0;

  const totalBuilds = currentStats.builds.length;
  const cachedBuilds = currentStats.builds.filter(b => b.cacheHit).length;
  currentStats.cacheEfficiency = totalBuilds > 0 ? (cachedBuilds / totalBuilds) * 100 : 0;

  try {
    fs.writeFileSync(BUILD_STATS_FILE, JSON.stringify(currentStats, null, 2));
  } catch (error) {
    console.warn('Failed to save build stats:', error.message);
  }

  return currentStats;
}

/**
 * Clear all caches
 */
function clearCache() {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    }
    console.log('Build cache cleared successfully');
    initCacheDir();
  } catch (error) {
    console.error('Failed to clear cache:', error.message);
  }
}

/**
 * Get cache status report
 */
function getCacheStatus() {
  const manifest = loadCacheManifest();
  const stats = loadBuildStats();
  const fileHashes = loadFileHashes();

  // Calculate cache size
  let cacheSize = 0;
  if (fs.existsSync(CACHE_DIR)) {
    walkDirectory(CACHE_DIR, (filePath) => {
      try {
        const stat = fs.statSync(filePath);
        cacheSize += stat.size;
      } catch (e) {
        // Ignore
      }
    }, ['']);
  }

  return {
    cacheDir: CACHE_DIR,
    cacheSize: `${(cacheSize / 1024 / 1024).toFixed(2)} MB`,
    filesTracked: Object.keys(fileHashes).length,
    buildCount: manifest.buildCount,
    lastBuild: manifest.lastBuild,
    cacheHits: manifest.cacheHits,
    cacheMisses: manifest.cacheMisses,
    hitRate: manifest.cacheHits + manifest.cacheMisses > 0
      ? ((manifest.cacheHits / (manifest.cacheHits + manifest.cacheMisses)) * 100).toFixed(1) + '%'
      : 'N/A',
    averageFullBuildTime: `${(stats.averageBuildTime / 1000).toFixed(2)}s`,
    averageIncrementalTime: `${(stats.averageIncrementalTime / 1000).toFixed(2)}s`,
    cacheEfficiency: `${stats.cacheEfficiency.toFixed(1)}%`,
  };
}

/**
 * Vite plugin for build caching
 */
function viteCachePlugin() {
  let buildStartTime;
  let isIncrementalBuild = false;

  return {
    name: 'vite-cache-plugin',

    buildStart() {
      buildStartTime = Date.now();
      const changes = getChangedFiles(['src']);
      isIncrementalBuild = changes.total > 0 && !changes.requiresFullBuild;

      if (changes.total === 0) {
        console.log('\x1b[32m%s\x1b[0m', '  Cache: No changes detected');
      } else {
        console.log('\x1b[33m%s\x1b[0m', `  Cache: ${changes.total} file(s) changed`);
        if (isIncrementalBuild) {
          console.log('\x1b[36m%s\x1b[0m', '  Mode: Incremental build');
        }
      }
    },

    buildEnd() {
      const duration = Date.now() - buildStartTime;
      const manifest = loadCacheManifest();

      manifest.buildCount++;
      manifest.lastBuild = new Date().toISOString();
      manifest.sourceHash = hashDirectory(path.join(PROJECT_ROOT, 'src'));

      if (isIncrementalBuild) {
        manifest.cacheHits++;
      } else {
        manifest.cacheMisses++;
      }

      saveCacheManifest(manifest);

      recordBuildStats({
        type: isIncrementalBuild ? 'incremental' : 'full',
        duration,
        cacheHit: isIncrementalBuild,
        filesChanged: getChangedFiles(['src']).total,
      });

      console.log('\x1b[32m%s\x1b[0m', `  Build completed in ${(duration / 1000).toFixed(2)}s`);
    },
  };
}

// Initialize cache on module load
initCacheDir();

// Export functions
export {
  initCacheDir,
  hashFile,
  hashDirectory,
  loadCacheManifest,
  saveCacheManifest,
  getChangedFiles,
  checkDependencyChanges,
  loadBuildStats,
  recordBuildStats,
  clearCache,
  getCacheStatus,
  viteCachePlugin,
  CACHE_DIR,
  PROJECT_ROOT,
};

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];

  switch (command) {
    case 'status':
      console.log('\nBuild Cache Status:');
      console.log('===================');
      const status = getCacheStatus();
      for (const [key, value] of Object.entries(status)) {
        console.log(`  ${key}: ${value}`);
      }
      break;

    case 'clear':
      clearCache();
      break;

    case 'changes':
      console.log('\nChanged Files:');
      console.log('==============');
      const changes = getChangedFiles(['src', 'electron']);
      console.log(`  Changed: ${changes.changed.length}`);
      changes.changed.forEach(f => console.log(`    - ${f}`));
      console.log(`  New: ${changes.new.length}`);
      changes.new.forEach(f => console.log(`    + ${f}`));
      console.log(`  Deleted: ${changes.deleted.length}`);
      changes.deleted.forEach(f => console.log(`    x ${f}`));
      console.log(`\n  Requires full build: ${changes.requiresFullBuild}`);
      break;

    case 'deps':
      console.log('\nDependency Check:');
      console.log('=================');
      const deps = checkDependencyChanges();
      console.log(`  Dependencies changed: ${deps.changed}`);
      console.log(`  Requires node_modules rebuild: ${deps.requiresNodeModulesRebuild}`);
      console.log(`  Requires native rebuild: ${deps.requiresNativeRebuild}`);
      break;

    default:
      console.log('Build Cache CLI');
      console.log('===============');
      console.log('Usage: node build-cache.js <command>');
      console.log('');
      console.log('Commands:');
      console.log('  status  - Show cache status');
      console.log('  clear   - Clear all caches');
      console.log('  changes - Show changed files');
      console.log('  deps    - Check dependency changes');
  }
}
