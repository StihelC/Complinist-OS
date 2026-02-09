#!/usr/bin/env node
/**
 * Diagnostic Tool: AI Embedding System
 * Checks all components involved in the embedding flow
 *
 * Run with: node scripts/test/diagnose-ai-embedding.js
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

console.log('🔍 AI Embedding System Diagnostic\n');
console.log('=' .repeat(70));

let issues = 0;
let checks = 0;

function check(name, test, fix = null) {
  checks++;
  console.log(`\n[${checks}] ${name}`);
  console.log('-'.repeat(70));

  try {
    const result = test();
    if (result.pass) {
      console.log('✅ PASS');
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    } else {
      console.log('❌ FAIL');
      console.log(`   ${result.message}`);
      if (fix) {
        console.log(`   Fix: ${fix}`);
      }
      issues++;
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`   ${error.message}`);
    issues++;
  }
}

// Check 1: AI Models
check(
  'AI Models Exist',
  () => {
    const modelsPath = join(projectRoot, '.data/models');
    const llmPath = join(modelsPath, 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');
    const embPath = join(modelsPath, 'bge-m3-FP16.gguf');

    const llmExists = existsSync(llmPath);
    const embExists = existsSync(embPath);

    if (llmExists && embExists) {
      return { pass: true, details: 'Both models found' };
    } else if (!llmExists && !embExists) {
      return { pass: false, message: 'Both models missing' };
    } else if (!llmExists) {
      return { pass: false, message: 'LLM model missing' };
    } else {
      return { pass: false, message: 'Embedding model missing' };
    }
  },
  'Download models and place in .data/models/'
);

// Check 2: embedSchema Definition
check(
  'embedSchema Accepts String or Array',
  () => {
    const validationPath = join(projectRoot, 'electron/ipc-validation.js');
    const content = readFileSync(validationPath, 'utf-8');

    // Check if schema uses union type
    const hasUnion = content.includes('z.union([');
    const hasStringType = content.includes('z.string().min(1).max(50000)');
    const hasArrayType = content.includes('z.array(z.string()');

    if (hasUnion && hasStringType && hasArrayType) {
      return { pass: true, details: 'Schema supports both string and array' };
    } else if (!hasUnion) {
      return { pass: false, message: 'Schema missing z.union() - only accepts one type' };
    } else {
      return { pass: false, message: 'Schema definition incomplete' };
    }
  },
  'Update electron/ipc-validation.js embedSchema to use z.union([string, array])'
);

// Check 3: IPC Handler Registration
check(
  'IPC Handler Registered',
  () => {
    const ipcRegistryPath = join(projectRoot, 'electron/modules/ipc-registry.js');
    const content = readFileSync(ipcRegistryPath, 'utf-8');

    const hasHandler = content.includes("ipcMain.handle('ai:embed'");
    const usesValidation = content.includes('validateIpcInput(embedSchema');

    if (hasHandler && usesValidation) {
      return { pass: true, details: 'Handler registered with validation' };
    } else if (!hasHandler) {
      return { pass: false, message: 'ai:embed handler not registered' };
    } else {
      return { pass: false, message: 'Handler missing validation' };
    }
  },
  'Check electron/modules/ipc-registry.js for ai:embed handler'
);

// Check 4: Preload Exposes Embed API
check(
  'Preload Exposes embed() API',
  () => {
    const preloadPath = join(projectRoot, 'electron/preload.mjs');
    const content = readFileSync(preloadPath, 'utf-8');

    const hasEmbedAPI = content.includes("embed: (data) => ipcRenderer.invoke('ai:embed'");

    if (hasEmbedAPI) {
      return { pass: true, details: 'window.electronAPI.embed() exposed' };
    } else {
      return { pass: false, message: 'embed API not exposed to renderer' };
    }
  },
  'Add embed() to electronAPI in electron/preload.mjs'
);

// Check 5: EmbeddingService Implementation
check(
  'EmbeddingService Handles Arrays',
  () => {
    const servicePath = join(projectRoot, 'src/lib/ai/embeddingService.ts');
    const content = readFileSync(servicePath, 'utf-8');

    const convertsToArray = content.includes('Array.isArray(text) ? text : [text]');
    const callsIPC = content.includes('electronAPI.embed');

    if (convertsToArray && callsIPC) {
      return { pass: true, details: 'Service converts single strings to arrays' };
    } else if (!convertsToArray) {
      return { pass: false, message: 'Service missing array conversion logic' };
    } else {
      return { pass: false, message: 'Service missing IPC call' };
    }
  },
  'Check src/lib/ai/embeddingService.ts embed() method'
);

// Check 6: NIST RAG Uses EmbeddingService
check(
  'NIST RAG Uses EmbeddingService',
  () => {
    const ragPath = join(projectRoot, 'src/lib/ai/nistRAG.ts');
    const content = readFileSync(ragPath, 'utf-8');

    const usesService = content.includes('this.embeddingService.embed');
    const expandsQuery = content.includes('expandQueryWithControlNames');

    if (usesService && expandsQuery) {
      return { pass: true, details: 'RAG uses embedding service with query expansion' };
    } else if (!usesService) {
      return { pass: false, message: 'RAG not using EmbeddingService' };
    } else {
      return { pass: false, message: 'Missing query expansion' };
    }
  },
  'Check src/lib/ai/nistRAG.ts queryNISTDocumentsStream() method'
);

// Check 7: Build Output
check(
  'App Build Exists',
  () => {
    const distPath = join(projectRoot, 'dist');
    const indexPath = join(distPath, 'index.html');

    if (existsSync(indexPath)) {
      return { pass: true, details: 'dist/index.html found' };
    } else {
      return { pass: false, message: 'App not built' };
    }
  },
  'Run: npm run build'
);

// Check 8: Test Scripts
check(
  'Test Scripts Available',
  () => {
    const packagePath = join(projectRoot, 'package.json');
    const content = readFileSync(packagePath, 'utf-8');
    const pkg = JSON.parse(content);

    const hasSchemaTest = 'test:ai:schema' in pkg.scripts;
    const hasIntegrationTest = 'test:ai:integration' in pkg.scripts;
    const hasE2ETest = 'test:ai:e2e' in pkg.scripts;

    if (hasSchemaTest && hasIntegrationTest && hasE2ETest) {
      return { pass: true, details: 'All 3 test scripts configured' };
    } else {
      const missing = [];
      if (!hasSchemaTest) missing.push('test:ai:schema');
      if (!hasIntegrationTest) missing.push('test:ai:integration');
      if (!hasE2ETest) missing.push('test:ai:e2e');
      return { pass: false, message: `Missing: ${missing.join(', ')}` };
    }
  },
  'Add test scripts to package.json'
);

// Check 9: Documentation
check(
  'Documentation Exists',
  () => {
    const fixDoc = join(projectRoot, 'docs/AI_EMBEDDING_FIX.md');
    const testDoc = join(projectRoot, 'docs/TESTING_AI_SYSTEM.md');
    const summary = join(projectRoot, 'TEST_SUMMARY.md');

    const hasDocs = existsSync(fixDoc) && existsSync(testDoc) && existsSync(summary);

    if (hasDocs) {
      return { pass: true, details: 'All documentation files present' };
    } else {
      const missing = [];
      if (!existsSync(fixDoc)) missing.push('AI_EMBEDDING_FIX.md');
      if (!existsSync(testDoc)) missing.push('TESTING_AI_SYSTEM.md');
      if (!existsSync(summary)) missing.push('TEST_SUMMARY.md');
      return { pass: false, message: `Missing: ${missing.join(', ')}` };
    }
  }
);

// Summary
console.log('\n' + '='.repeat(70));
console.log(`\n📊 Diagnostic Summary: ${checks - issues}/${checks} checks passed\n`);

if (issues === 0) {
  console.log('✨ All checks passed! AI embedding system is properly configured.\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run test:ai:schema');
  console.log('  2. Run: npm run test:ai:integration');
  console.log('  3. Test NIST queries in the app\n');
  process.exit(0);
} else {
  console.log(`⚠️  Found ${issues} issue(s). Please review the failures above.\n`);
  console.log('Common fixes:');
  console.log('  - Download AI models to .data/models/');
  console.log('  - Run: npm run build');
  console.log('  - Check that embedSchema uses z.union()');
  console.log('  - Verify IPC handlers are registered\n');
  process.exit(1);
}
