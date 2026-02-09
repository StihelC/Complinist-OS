#!/usr/bin/env node
/**
 * Integration Test: AI Embedding in Electron App
 * This script starts the Electron app and tests the AI embedding flow
 *
 * Run with: node scripts/test/test-ai-embedding-integration.js
 *
 * Prerequisites:
 * - AI models must be present in .data/models/
 * - App must be built (npm run build)
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Check if models exist
const modelsPath = join(projectRoot, '.data/models');
const llmModel = join(modelsPath, 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
const embeddingModel = join(modelsPath, 'bge-m3-FP16.gguf');

console.log('🔍 Checking prerequisites...\n');

if (!fs.existsSync(llmModel)) {
  console.error('❌ LLM model not found at:', llmModel);
  console.error('   Please download the model first.');
  process.exit(1);
}

if (!fs.existsSync(embeddingModel)) {
  console.error('❌ Embedding model not found at:', embeddingModel);
  console.error('   Please download the model first.');
  process.exit(1);
}

console.log('✅ Models found');
console.log('   LLM:', llmModel);
console.log('   Embedding:', embeddingModel);

// Check if app is built
const distPath = join(projectRoot, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('\n❌ App not built. Please run: npm run build');
  process.exit(1);
}

console.log('✅ App built at:', distPath);

console.log('\n📝 Test Instructions:');
console.log('=' .repeat(60));
console.log('The Electron app will now launch.');
console.log('Please follow these steps to test the AI embedding fix:\n');
console.log('1. Wait for the app to load (AI models will preload)');
console.log('2. Navigate to the AI Assistant view');
console.log('3. Select "NIST Documents" mode');
console.log('4. Type a query: "what is ac-3"');
console.log('5. Press Send\n');
console.log('Expected Result:');
console.log('  ✅ The query should execute without errors');
console.log('  ✅ You should see a streaming response about AC-3');
console.log('  ✅ No "IPC validation failed" error in console\n');
console.log('Previous Error (now fixed):');
console.log('  ❌ Error: IPC validation failed for ai:embed:');
console.log('     text: Invalid input: expected string, received array\n');
console.log('=' .repeat(60));

console.log('\n🚀 Launching Electron app in test mode...\n');

// Launch Electron
const electron = spawn('electron', ['.', '--no-sandbox'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DEBUG: '1',
  },
  stdio: 'inherit',
});

electron.on('error', (error) => {
  console.error('❌ Failed to start Electron:', error);
  process.exit(1);
});

electron.on('exit', (code) => {
  console.log(`\n📊 Electron exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping test...');
  electron.kill('SIGTERM');
  process.exit(0);
});

console.log('💡 Tip: Check the DevTools console for any errors');
console.log('💡 Press Ctrl+C to stop the test\n');
