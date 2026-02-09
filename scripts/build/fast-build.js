#!/usr/bin/env node

/**
 * Fast Build Script with Smart Caching
 *
 * This script provides optimized build commands that leverage:
 * - esbuild for fast transpilation (via Vite)
 * - Incremental TypeScript compilation
 * - Smart caching and change detection
 * - Parallel processing where possible
 *
 * Usage:
 *   node scripts/fast-build.js [command] [options]
 *
 * Commands:
 *   build       - Run optimized production build
 *   dev         - Start development server with HMR
 *   watch       - Watch mode for continuous building
 *   typecheck   - Run TypeScript type checking only
 *   clean       - Clean build artifacts and cache
 *   status      - Show build cache status
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('');
  log('═'.repeat(60), 'cyan');
  log(`  ${message}`, 'bright');
  log('═'.repeat(60), 'cyan');
  console.log('');
}

/**
 * Run a command and return a promise
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const proc = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        log(`  Completed in ${duration}s`, 'green');
        resolve(code);
      } else {
        log(`  Failed with exit code ${code}`, 'red');
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Run TypeScript type checking with incremental compilation
 */
async function typecheck() {
  logHeader('TypeScript Type Checking (Incremental)');

  const tscArgs = [
    '--noEmit',
    '--incremental',
    '--tsBuildInfoFile', '.build-cache/tsc/.tsbuildinfo',
  ];

  log('  Running tsc with incremental compilation...', 'cyan');
  return runCommand('npx', ['tsc', ...tscArgs]);
}

/**
 * Run Vite build with optimizations
 */
async function build(options = {}) {
  logHeader('Vite Build (esbuild-powered)');

  const buildArgs = ['vite', 'build'];

  if (options.mode) {
    buildArgs.push('--mode', options.mode);
  }

  if (options.watch) {
    buildArgs.push('--watch');
  }

  log('  Running Vite build with smart caching...', 'cyan');
  return runCommand('npx', buildArgs);
}

/**
 * Start development server with HMR
 */
async function dev() {
  logHeader('Development Server (HMR Enabled)');

  log('  Starting Vite dev server...', 'cyan');
  return runCommand('npx', ['vite']);
}

/**
 * Watch mode for continuous building
 */
async function watch() {
  logHeader('Watch Mode (Continuous Building)');

  log('  Starting watch mode...', 'cyan');
  return runCommand('npx', ['vite', 'build', '--watch']);
}

/**
 * Clean build artifacts and cache
 */
async function clean() {
  logHeader('Cleaning Build Artifacts');

  const pathsToClean = [
    'dist',
    '.build-cache',
    'node_modules/.vite',
  ];

  for (const p of pathsToClean) {
    const fullPath = path.join(PROJECT_ROOT, p);
    if (fs.existsSync(fullPath)) {
      log(`  Removing ${p}...`, 'yellow');
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  log('  Clean completed!', 'green');
}

/**
 * Show build cache status
 */
async function status() {
  logHeader('Build Cache Status');

  try {
    // Import the build-cache module dynamically
    const buildCache = await import('./build-cache.js');
    const cacheStatus = buildCache.getCacheStatus();

    for (const [key, value] of Object.entries(cacheStatus)) {
      log(`  ${key}: ${value}`, 'cyan');
    }
  } catch (error) {
    log('  Cache not initialized or error loading status', 'yellow');
    log(`  Error: ${error.message}`, 'red');
  }
}

/**
 * Full optimized build (typecheck + build)
 */
async function fullBuild() {
  logHeader('Full Optimized Build');

  const startTime = Date.now();

  try {
    // Run type checking and build in sequence
    // (parallel would be faster but can cause issues with shared resources)
    await typecheck();
    await build({ mode: 'production' });

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('', 'reset');
    logHeader(`Build Complete! Total time: ${totalDuration}s`);
  } catch (error) {
    log(`Build failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

/**
 * Incremental build (only changed files)
 */
async function incrementalBuild() {
  logHeader('Incremental Build');

  const startTime = Date.now();

  try {
    // Check for changes
    const buildCache = await import('./build-cache.js');
    const changes = buildCache.getChangedFiles(['src']);

    if (changes.total === 0) {
      log('  No changes detected, skipping build', 'green');
      return;
    }

    log(`  ${changes.total} file(s) changed`, 'yellow');

    if (changes.requiresFullBuild) {
      log('  Changes require full rebuild', 'yellow');
      await fullBuild();
    } else {
      log('  Running incremental build...', 'cyan');
      await build();
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`  Incremental build completed in ${totalDuration}s`, 'green');
  } catch (error) {
    log(`Incremental build failed: ${error.message}`, 'red');
    // Fall back to full build
    log('  Falling back to full build...', 'yellow');
    await fullBuild();
  }
}

/**
 * Electron development mode
 */
async function electronDev() {
  logHeader('Electron Development Mode');

  log('  Building renderer process...', 'cyan');
  await build();

  log('  Starting Electron with watch mode...', 'cyan');

  // Start vite watch in background
  const viteWatch = spawn('npx', ['vite', 'build', '--watch'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true,
    detached: false,
  });

  // Give vite a moment to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start electron
  const electron = spawn('npx', ['electron', '.', '--no-sandbox'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: true,
  });

  // Handle cleanup
  process.on('SIGINT', () => {
    viteWatch.kill();
    electron.kill();
    process.exit(0);
  });

  return new Promise((resolve, reject) => {
    electron.on('close', (code) => {
      viteWatch.kill();
      resolve(code);
    });
    electron.on('error', reject);
  });
}

// ============================================================================
// CLI Interface
// ============================================================================

const commands = {
  build: () => build({ mode: 'production' }),
  dev,
  watch,
  typecheck,
  clean,
  status,
  full: fullBuild,
  incremental: incrementalBuild,
  'electron:dev': electronDev,
};

const command = process.argv[2] || 'full';

if (commands[command]) {
  commands[command]().catch((error) => {
    log(`Error: ${error.message}`, 'red');
    process.exit(1);
  });
} else {
  console.log('Fast Build Script');
  console.log('=================');
  console.log('');
  console.log('Usage: node scripts/fast-build.js <command>');
  console.log('');
  console.log('Commands:');
  console.log('  build        - Run optimized production build');
  console.log('  dev          - Start development server with HMR');
  console.log('  watch        - Watch mode for continuous building');
  console.log('  typecheck    - Run TypeScript type checking only');
  console.log('  clean        - Clean build artifacts and cache');
  console.log('  status       - Show build cache status');
  console.log('  full         - Full build (typecheck + build)');
  console.log('  incremental  - Incremental build (only changed files)');
  console.log('  electron:dev - Electron development mode');
  console.log('');
  process.exit(1);
}
