#!/usr/bin/env node
/**
 * Unit Test for Mistral Instruction Formatting
 * Tests the formatting functions without loading the full model
 * 
 * Usage:
 *   node scripts/test-instruction-format-unit.mjs
 */

console.log('\n🧪 Mistral Instruction Format Unit Tests\n');
console.log('='.repeat(70) + '\n');

/**
 * Format prompt with Mistral instruction template
 */
function formatMistralInstruction(prompt, isFirstTurn = true) {
  if (isFirstTurn) {
    return `<s>[INST] ${prompt} [/INST]`;
  } else {
    return `[INST] ${prompt} [/INST]`;
  }
}

/**
 * Test cases
 */
const tests = [
  {
    name: 'First turn instruction format',
    prompt: 'What is the capital of France?',
    isFirstTurn: true,
    expected: '<s>[INST] What is the capital of France? [/INST]',
  },
  {
    name: 'Follow-up turn instruction format',
    prompt: 'Tell me more about it.',
    isFirstTurn: false,
    expected: '[INST] Tell me more about it. [/INST]',
  },
  {
    name: 'Multi-line prompt',
    prompt: 'Explain the following:\n1. Security\n2. Compliance',
    isFirstTurn: true,
    expected: '<s>[INST] Explain the following:\n1. Security\n2. Compliance [/INST]',
  },
  {
    name: 'Prompt with special characters',
    prompt: 'What is AC-2 control? How does it apply to "User Management"?',
    isFirstTurn: true,
    expected: '<s>[INST] What is AC-2 control? How does it apply to "User Management"? [/INST]',
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = formatMistralInstruction(test.prompt, test.isFirstTurn);
  const success = result === test.expected;
  
  if (success) {
    console.log(`✅ PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Got:      ${result}`);
    failed++;
  }
}

console.log('\n' + '='.repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests\n`);

if (failed === 0) {
  console.log('✅ All unit tests passed!\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed.\n');
  process.exit(1);
}















