#!/usr/bin/env node

/**
 * Source Map Optimization Utilities
 *
 * This module provides utilities for optimizing source maps in both
 * development and production builds:
 *
 * - Development: Inline source maps for faster debugging
 * - Production: External source maps with selective inclusion
 * - Debug mode: Full source maps with original source embedded
 *
 * Features:
 * - Source map generation control
 * - Source map stripping for production releases
 * - Source map size analysis
 * - Source map caching for incremental builds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const CACHE_DIR = path.join(PROJECT_ROOT, '.build-cache', 'sourcemaps');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Source map modes
  modes: {
    development: 'inline',      // Inline source maps for fast debugging
    production: 'hidden',       // External source maps (not linked in bundles)
    debug: 'source-map',        // Full external source maps
    none: false,                // No source maps
  },

  // File patterns to process
  patterns: {
    javascript: /\.js$/,
    css: /\.css$/,
    sourceMap: /\.map$/,
  },

  // Maximum source map size for inline (in bytes)
  maxInlineSize: 512 * 1024, // 512KB
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Initialize cache directory
 */
function initCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get file hash for caching
 */
function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Get human-readable file size
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Walk directory and yield files matching pattern
 */
function* walkDir(dir, pattern) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkDir(fullPath, pattern);
    } else if (pattern.test(entry.name)) {
      yield fullPath;
    }
  }
}

// ============================================================================
// SOURCE MAP OPERATIONS
// ============================================================================

/**
 * Analyze source maps in dist directory
 */
function analyzeSourceMaps() {
  console.log('\nSource Map Analysis');
  console.log('===================\n');

  const analysis = {
    totalFiles: 0,
    totalSize: 0,
    withMaps: 0,
    withoutMaps: 0,
    inlineMaps: 0,
    externalMaps: 0,
    mapFiles: [],
    bundleFiles: [],
  };

  // Find all JS and CSS files
  const jsFiles = [...walkDir(DIST_DIR, CONFIG.patterns.javascript)];
  const cssFiles = [...walkDir(DIST_DIR, CONFIG.patterns.css)];
  const mapFiles = [...walkDir(DIST_DIR, CONFIG.patterns.sourceMap)];

  // Analyze JS files
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const stat = fs.statSync(file);
    const relativePath = path.relative(DIST_DIR, file);

    analysis.totalFiles++;
    analysis.totalSize += stat.size;

    const hasInlineMap = content.includes('//# sourceMappingURL=data:');
    const hasExternalMap = content.match(/\/\/# sourceMappingURL=(.+\.map)/);
    const correspondingMap = file + '.map';

    if (hasInlineMap) {
      analysis.inlineMaps++;
      analysis.withMaps++;
      analysis.bundleFiles.push({
        path: relativePath,
        size: stat.size,
        mapType: 'inline',
      });
    } else if (hasExternalMap || fs.existsSync(correspondingMap)) {
      analysis.externalMaps++;
      analysis.withMaps++;
      analysis.bundleFiles.push({
        path: relativePath,
        size: stat.size,
        mapType: 'external',
      });
    } else {
      analysis.withoutMaps++;
      analysis.bundleFiles.push({
        path: relativePath,
        size: stat.size,
        mapType: 'none',
      });
    }
  }

  // Analyze map files
  for (const file of mapFiles) {
    const stat = fs.statSync(file);
    const relativePath = path.relative(DIST_DIR, file);

    analysis.mapFiles.push({
      path: relativePath,
      size: stat.size,
    });
  }

  // Print results
  console.log('Bundle Files:');
  console.log('-------------');
  for (const file of analysis.bundleFiles.sort((a, b) => b.size - a.size)) {
    const mapIndicator = file.mapType === 'inline' ? '[inline-map]' :
                         file.mapType === 'external' ? '[external-map]' : '[no-map]';
    console.log(`  ${file.path} - ${formatSize(file.size)} ${mapIndicator}`);
  }

  if (analysis.mapFiles.length > 0) {
    console.log('\nSource Map Files:');
    console.log('-----------------');
    for (const file of analysis.mapFiles.sort((a, b) => b.size - a.size)) {
      console.log(`  ${file.path} - ${formatSize(file.size)}`);
    }
  }

  console.log('\nSummary:');
  console.log('--------');
  console.log(`  Total bundle files: ${analysis.totalFiles}`);
  console.log(`  Total bundle size: ${formatSize(analysis.totalSize)}`);
  console.log(`  Files with source maps: ${analysis.withMaps}`);
  console.log(`  Files without source maps: ${analysis.withoutMaps}`);
  console.log(`  Inline source maps: ${analysis.inlineMaps}`);
  console.log(`  External source maps: ${analysis.externalMaps}`);
  console.log(`  Source map files: ${analysis.mapFiles.length}`);
  console.log(`  Total source map size: ${formatSize(analysis.mapFiles.reduce((sum, f) => sum + f.size, 0))}`);

  return analysis;
}

/**
 * Strip source maps from production build
 */
function stripSourceMaps(options = {}) {
  const { dryRun = false, keepExternal = false } = options;

  console.log('\nStripping Source Maps');
  console.log('=====================\n');

  if (dryRun) {
    console.log('(Dry run - no files will be modified)\n');
  }

  let strippedCount = 0;
  let deletedCount = 0;

  // Process JS files - remove inline source map references
  const jsFiles = [...walkDir(DIST_DIR, CONFIG.patterns.javascript)];

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(DIST_DIR, file);

    // Remove inline source map
    const inlineMapRegex = /\/\/# sourceMappingURL=data:[^\n]+/g;
    if (inlineMapRegex.test(content)) {
      console.log(`  Stripping inline map from: ${relativePath}`);
      if (!dryRun) {
        const newContent = content.replace(inlineMapRegex, '');
        fs.writeFileSync(file, newContent);
      }
      strippedCount++;
    }

    // Remove external source map reference (but keep the map file)
    const externalMapRegex = /\/\/# sourceMappingURL=[^\n]+\.map/g;
    if (externalMapRegex.test(content)) {
      console.log(`  Removing source map reference from: ${relativePath}`);
      if (!dryRun) {
        const newContent = content.replace(externalMapRegex, '');
        fs.writeFileSync(file, newContent);
      }
      strippedCount++;
    }
  }

  // Delete external source map files if requested
  if (!keepExternal) {
    const mapFiles = [...walkDir(DIST_DIR, CONFIG.patterns.sourceMap)];

    for (const file of mapFiles) {
      const relativePath = path.relative(DIST_DIR, file);
      console.log(`  Deleting map file: ${relativePath}`);
      if (!dryRun) {
        fs.unlinkSync(file);
      }
      deletedCount++;
    }
  }

  console.log('\nResults:');
  console.log('--------');
  console.log(`  Inline maps stripped: ${strippedCount}`);
  console.log(`  Map files deleted: ${deletedCount}`);

  return { strippedCount, deletedCount };
}

/**
 * Generate source map report for debugging
 */
function generateReport() {
  console.log('\nSource Map Report');
  console.log('=================\n');

  const report = {
    timestamp: new Date().toISOString(),
    analysis: analyzeSourceMaps(),
    recommendations: [],
  };

  // Generate recommendations
  if (report.analysis.inlineMaps > 0) {
    const inlineSize = report.analysis.bundleFiles
      .filter(f => f.mapType === 'inline')
      .reduce((sum, f) => sum + f.size, 0);

    if (inlineSize > 1024 * 1024) {
      report.recommendations.push(
        'Consider using external source maps - inline maps are adding significant bundle size'
      );
    }
  }

  if (report.analysis.withoutMaps > 0) {
    report.recommendations.push(
      `${report.analysis.withoutMaps} file(s) are missing source maps - debugging may be difficult`
    );
  }

  if (report.analysis.mapFiles.length > 0) {
    const totalMapSize = report.analysis.mapFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalMapSize > 5 * 1024 * 1024) {
      report.recommendations.push(
        'Source maps are quite large - consider using "hidden" source maps for production'
      );
    }
  }

  if (report.recommendations.length > 0) {
    console.log('\nRecommendations:');
    console.log('----------------');
    for (const rec of report.recommendations) {
      console.log(`  - ${rec}`);
    }
  }

  // Save report to cache
  const reportPath = path.join(CACHE_DIR, 'report.json');
  initCacheDir();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);

  return report;
}

/**
 * Configure source map mode for next build
 */
function setSourceMapMode(mode) {
  const validModes = Object.keys(CONFIG.modes);

  if (!validModes.includes(mode)) {
    console.error(`Invalid mode: ${mode}`);
    console.error(`Valid modes: ${validModes.join(', ')}`);
    process.exit(1);
  }

  const envFile = path.join(PROJECT_ROOT, '.env.local');
  const envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf-8') : '';

  // Update or add SOURCEMAPS variable
  const sourcemapValue = mode === 'none' ? 'false' : 'true';
  const modeValue = CONFIG.modes[mode];

  let newContent;
  if (envContent.includes('SOURCEMAPS=')) {
    newContent = envContent.replace(/SOURCEMAPS=.*/g, `SOURCEMAPS=${sourcemapValue}`);
  } else {
    newContent = envContent + (envContent.endsWith('\n') ? '' : '\n') + `SOURCEMAPS=${sourcemapValue}\n`;
  }

  if (envContent.includes('SOURCEMAP_MODE=')) {
    newContent = newContent.replace(/SOURCEMAP_MODE=.*/g, `SOURCEMAP_MODE=${modeValue}`);
  } else {
    newContent = newContent + `SOURCEMAP_MODE=${modeValue}\n`;
  }

  fs.writeFileSync(envFile, newContent);
  console.log(`Source map mode set to: ${mode}`);
  console.log(`  SOURCEMAPS=${sourcemapValue}`);
  console.log(`  SOURCEMAP_MODE=${modeValue}`);
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

const command = process.argv[2];

switch (command) {
  case 'analyze':
    analyzeSourceMaps();
    break;

  case 'strip':
    const stripOptions = {
      dryRun: process.argv.includes('--dry-run'),
      keepExternal: process.argv.includes('--keep-external'),
    };
    stripSourceMaps(stripOptions);
    break;

  case 'report':
    generateReport();
    break;

  case 'mode':
    const mode = process.argv[3];
    if (!mode) {
      console.log('Current source map modes:');
      for (const [name, value] of Object.entries(CONFIG.modes)) {
        console.log(`  ${name}: ${value}`);
      }
    } else {
      setSourceMapMode(mode);
    }
    break;

  default:
    console.log('Source Map Optimizer');
    console.log('====================');
    console.log('');
    console.log('Usage: node sourcemap-optimizer.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  analyze               - Analyze source maps in dist/');
    console.log('  strip [options]       - Strip source maps from build');
    console.log('    --dry-run           - Show what would be done without making changes');
    console.log('    --keep-external     - Keep external .map files');
    console.log('  report                - Generate detailed report');
    console.log('  mode [mode]           - Get or set source map mode');
    console.log('    Modes: development, production, debug, none');
    console.log('');
    console.log('Examples:');
    console.log('  node sourcemap-optimizer.js analyze');
    console.log('  node sourcemap-optimizer.js strip --dry-run');
    console.log('  node sourcemap-optimizer.js mode production');
}

export {
  analyzeSourceMaps,
  stripSourceMaps,
  generateReport,
  setSourceMapMode,
  CONFIG,
};
