#!/usr/bin/env node
/**
 * CI Smoke Test for CompliFlow
 *
 * Launches the built Electron app and verifies it starts successfully.
 * The pass criterion is simple: the process stays alive for a startup
 * period without crashing.
 *
 * Exits with code 0 on success, 1 on failure.
 *
 * Usage:
 *   node scripts/build/smoke-test.js --platform=win
 *   node scripts/build/smoke-test.js --platform=linux
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const STARTUP_WAIT_MS = 15000; // Wait 15 seconds for startup
const OVERALL_TIMEOUT_MS = 30000; // 30 second hard timeout

// Parse args
const args = process.argv.slice(2);
const platformArg = args.find((a) => a.startsWith('--platform='));
const platform = platformArg
  ? platformArg.split('=')[1]
  : process.platform === 'win32'
    ? 'win'
    : 'linux';

function findExecutable() {
  const releaseDir = path.join(projectRoot, 'release');

  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Release directory not found: ${releaseDir}`);
  }

  if (platform === 'win') {
    // electron-builder puts the unpacked app in win-unpacked/
    const unpackedExe = path.join(releaseDir, 'win-unpacked', 'CompliNist.exe');
    if (fs.existsSync(unpackedExe)) return unpackedExe;

    // Check for portable .exe directly (skip installer exes)
    const files = fs
      .readdirSync(releaseDir)
      .filter((f) => f.endsWith('.exe') && !f.includes('Setup'));
    if (files.length > 0) return path.join(releaseDir, files[0]);

    throw new Error(
      `No Windows executable found in ${releaseDir}. Contents: ${fs.readdirSync(releaseDir).join(', ')}`
    );
  }

  if (platform === 'linux') {
    // electron-builder puts the unpacked app in linux-unpacked/
    const unpackedExe = path.join(releaseDir, 'linux-unpacked', 'complinist-desktop');
    if (fs.existsSync(unpackedExe)) return unpackedExe;

    // Check for tar.gz extracted or AppImage
    const appImages = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.AppImage'));
    if (appImages.length > 0) {
      const appImagePath = path.join(releaseDir, appImages[0]);
      // Make executable
      fs.chmodSync(appImagePath, 0o755);
      return appImagePath;
    }

    throw new Error(
      `No Linux executable found in ${releaseDir}. Contents: ${fs.readdirSync(releaseDir).join(', ')}`
    );
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function killProcess(child) {
  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill to kill the process tree
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      // On Linux, kill the process group
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // Process may have already exited
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

async function runSmokeTest() {
  console.log(`\n=== CompliFlow Smoke Test (${platform}) ===\n`);

  let exePath;
  try {
    exePath = findExecutable();
  } catch (e) {
    console.error(`FAIL: ${e.message}`);
    process.exit(1);
  }

  console.log(`Executable: ${exePath}`);
  console.log(`Startup wait: ${STARTUP_WAIT_MS}ms`);
  console.log(`Overall timeout: ${OVERALL_TIMEOUT_MS}ms\n`);

  const electronArgs = ['--no-sandbox', '--disable-gpu'];

  const child = spawn(exePath, electronArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      NODE_ENV: 'production',
    },
    detached: process.platform !== 'win32', // detached for process group kill on Linux
  });

  let stdout = '';
  let stderr = '';
  let processExited = false;
  let exitCode = null;

  child.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    // Print in real time for CI logs
    process.stdout.write(`[app stdout] ${text}`);
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    process.stderr.write(`[app stderr] ${text}`);
  });

  child.on('exit', (code) => {
    processExited = true;
    exitCode = code;
  });

  child.on('error', (err) => {
    console.error(`FAIL: Failed to start process: ${err.message}`);
    process.exit(1);
  });

  // Wait for startup period
  await new Promise((resolve) => setTimeout(resolve, STARTUP_WAIT_MS));

  // Check if process crashed during startup
  if (processExited) {
    console.error(`\nFAIL: Process exited during startup with code ${exitCode}`);
    if (stderr) {
      console.error(`\nstderr (last 2000 chars):\n${stderr.slice(-2000)}`);
    }
    if (stdout) {
      console.log(`\nstdout (last 2000 chars):\n${stdout.slice(-2000)}`);
    }
    process.exit(1);
  }

  // Process is still running -- that is a pass
  console.log('\nPASS: Application started and is running after startup wait period');

  // Clean up
  killProcess(child);

  // Give it a moment to actually terminate
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('Smoke test PASSED\n');
  process.exit(0);
}

// Set overall timeout
const timeout = setTimeout(() => {
  console.error('FAIL: Smoke test timed out');
  process.exit(1);
}, OVERALL_TIMEOUT_MS);

// Prevent the timeout from keeping the process alive if everything else is done
timeout.unref();

runSmokeTest().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
