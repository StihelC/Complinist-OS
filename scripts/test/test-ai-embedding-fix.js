#!/usr/bin/env node
/**
 * Manual Test Script: AI Embedding Fix Verification
 * Tests the embedSchema fix for accepting both string and array of strings
 *
 * Run with: node scripts/test/test-ai-embedding-fix.js
 */

import { z } from 'zod';

// Copy of the fixed embedSchema
const embedSchema = z.object({
  // Support both single string and array of strings for batch embedding
  text: z.union([
    z.string().min(1).max(50000),
    z.array(z.string().min(1).max(50000)).min(1).max(100)
  ]),
});

console.log('🧪 Testing AI Embedding Schema Fix\n');
console.log('=' .repeat(60));

// Test cases
const testCases = [
  {
    name: 'Single string (original case)',
    input: { text: 'What is access control?' },
    shouldPass: true,
  },
  {
    name: 'Array with single string (causes original error)',
    input: { text: ['what is AC-3 (Access Enforcement)'] },
    shouldPass: true,
  },
  {
    name: 'Array with multiple strings',
    input: { text: ['What is AC-3?', 'Explain access enforcement', 'NIST controls'] },
    shouldPass: true,
  },
  {
    name: 'Empty string (should fail)',
    input: { text: '' },
    shouldPass: false,
  },
  {
    name: 'Empty array (should fail)',
    input: { text: [] },
    shouldPass: false,
  },
  {
    name: 'Array with empty string (should fail)',
    input: { text: [''] },
    shouldPass: false,
  },
  {
    name: 'Array with > 100 strings (should fail)',
    input: { text: Array(101).fill('test') },
    shouldPass: false,
  },
  {
    name: 'String > 50000 chars (should fail)',
    input: { text: 'x'.repeat(50001) },
    shouldPass: false,
  },
  {
    name: 'Mixed valid strings in array',
    input: {
      text: [
        'Short query',
        'Medium length query about NIST controls',
        'x'.repeat(1000), // Long but valid
      ]
    },
    shouldPass: true,
  },
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, idx) => {
  console.log(`\nTest ${idx + 1}: ${testCase.name}`);
  console.log('-'.repeat(60));

  const result = embedSchema.safeParse(testCase.input);
  const success = result.success;

  if (success === testCase.shouldPass) {
    console.log('✅ PASS');
    passed++;
  } else {
    console.log('❌ FAIL');
    console.log('Expected:', testCase.shouldPass ? 'success' : 'failure');
    console.log('Got:', success ? 'success' : 'failure');
    if (!success && result.error) {
      console.log('Error:', result.error.issues[0]?.message);
    }
    failed++;
  }

  if (testCase.shouldPass && success) {
    // Show parsed data structure
    const isArray = Array.isArray(result.data.text);
    console.log(`   Type: ${isArray ? 'Array' : 'String'}`);
    if (isArray) {
      console.log(`   Length: ${result.data.text.length} items`);
      console.log(`   Preview: ${result.data.text[0]?.substring(0, 40)}...`);
    } else {
      console.log(`   Length: ${result.data.text.length} chars`);
      console.log(`   Preview: ${result.data.text.substring(0, 40)}...`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✨ All tests passed! The schema fix is working correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the schema definition.\n');
  process.exit(1);
}
