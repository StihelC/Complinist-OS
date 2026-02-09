/**
 * Test Real Electron Dialog
 * Launches Electron and tests the actual license file dialog
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const LICENSE_FILE = '/home/cam/1.license';

console.log('='.repeat(60));
console.log('Testing Real Electron License Dialog');
console.log('='.repeat(60));
console.log(`License file: ${LICENSE_FILE}`);
console.log(`Project root: ${PROJECT_ROOT}`);
console.log('');

// Build first
console.log('Building app...');
const buildProcess = spawn('npm', ['run', 'build'], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit'
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('Build failed!');
    process.exit(1);
  }
  
  console.log('\nBuild complete. Launching Electron...');
  console.log('NOTE: You will need to manually click "Select License File" in the app');
  console.log('This test monitors the logs to see what happens.\n');
  
  // Launch Electron
  const electronProcess = spawn('npx', ['electron', '.', '--no-sandbox'], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe'
  });
  
  let mainLogs = [];
  let rendererLogs = [];
  
  electronProcess.stdout.on('data', (data) => {
    const log = data.toString();
    mainLogs.push(log);
    
    // Look for license-related logs
    if (log.includes('license') || log.includes('License') || log.includes('Dialog')) {
      console.log(`[MAIN] ${log.trim()}`);
    }
  });
  
  electronProcess.stderr.on('data', (data) => {
    const log = data.toString();
    mainLogs.push(log);
    
    if (log.includes('license') || log.includes('License') || log.includes('Dialog')) {
      console.log(`[MAIN ERR] ${log.trim()}`);
    }
  });
  
  // Monitor for 60 seconds
  setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    
    const allLogs = mainLogs.join('\n');
    
    // Check for key events
    const dialogCalled = allLogs.includes('[IPC] license:open-file called');
    const dialogOpened = allLogs.includes('[IPC] Opening file dialog');
    const dialogCanceled = allLogs.includes('canceled: true');
    const dialogSuccess = allLogs.includes('License file read successfully');
    
    console.log(`Dialog IPC called: ${dialogCalled ? '✓' : '✗'}`);
    console.log(`Dialog opened: ${dialogOpened ? '✓' : '✗'}`);
    console.log(`Dialog canceled: ${dialogCanceled ? '✗ (PROBLEM)' : '✓'}`);
    console.log(`File read successfully: ${dialogSuccess ? '✓' : '✗'}`);
    
    if (dialogCanceled && !dialogSuccess) {
      console.log('\n❌ PROBLEM: Dialog is returning canceled even when file is selected');
      console.log('This confirms the issue exists.');
    }
    
    electronProcess.kill();
    process.exit(0);
  }, 60000);
  
  electronProcess.on('error', (error) => {
    console.error('Failed to start Electron:', error);
    process.exit(1);
  });
});

