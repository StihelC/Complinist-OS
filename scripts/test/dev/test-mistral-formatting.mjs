#!/usr/bin/env node
/**
 * Test Mistral 7B Instruction Formatting
 * Validates that the Mistral instruction format is correctly applied
 * and that responses are coherent
 * 
 * Usage:
 *   node scripts/test-mistral-formatting.mjs
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('\n🔧 Mistral 7B Instruction Format Validation Test\n');
console.log('='.repeat(70) + '\n');

const modelPath = path.join(projectRoot, '.data', 'models', 'mistral-7b-instruct-v0.1.Q4_K_M.gguf');

// Check if model exists
if (!fs.existsSync(modelPath)) {
  console.log('❌ Model not found at:', modelPath);
  console.log('   Please ensure the model is downloaded.\n');
  process.exit(1);
}

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
 * Test case definition
 */
const testCases = [
  {
    name: 'Simple Question',
    prompt: 'What is the capital of France?',
    expectedKeywords: ['paris', 'france', 'capital'],
    maxTokens: 100,
  },
  {
    name: 'Technical Explanation',
    prompt: 'Explain what a firewall does in network security in one paragraph.',
    expectedKeywords: ['firewall', 'network', 'security', 'traffic'],
    maxTokens: 200,
  },
  {
    name: 'NIST Control Query',
    prompt: 'What are the key requirements for NIST 800-53 Access Control (AC-2)?',
    expectedKeywords: ['access', 'control', 'account', 'management'],
    maxTokens: 300,
  },
  {
    name: 'List Generation',
    prompt: 'List 5 best practices for password security.',
    expectedKeywords: ['password', 'security', 'length', 'complex', 'unique'],
    maxTokens: 250,
  },
  {
    name: 'Comparison Query',
    prompt: 'What is the difference between symmetric and asymmetric encryption?',
    expectedKeywords: ['symmetric', 'asymmetric', 'encryption', 'key'],
    maxTokens: 250,
  },
];

/**
 * Run validation tests
 */
async function runTests() {
  console.log('📦 Loading Mistral 7B Instruct model...\n');
  
  const llama = await getLlama();
  const model = await llama.loadModel({
    modelPath: modelPath,
    gpuLayers: 35, // Adjust based on available VRAM
  });
  
  console.log('✅ Model loaded successfully\n');
  console.log('='.repeat(70) + '\n');
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 Test ${i + 1}/${totalTests}: ${testCase.name}`);
    console.log('-'.repeat(70));
    
    // Test WITHOUT instruction formatting
    console.log('\n🔴 WITHOUT Mistral formatting:');
    const unfFormattedPrompt = testCase.prompt;
    const unfFormattedResult = await generateResponse(model, unfFormattedPrompt, testCase.maxTokens);
    console.log(`   Prompt: "${unfFormattedPrompt.substring(0, 60)}..."`);
    console.log(`   Response (${unfFormattedResult.length} chars):`);
    console.log(`   "${unfFormattedResult.substring(0, 200)}..."`);
    
    // Test WITH instruction formatting
    console.log('\n🟢 WITH Mistral formatting:');
    const formattedPrompt = formatMistralInstruction(testCase.prompt);
    const formattedResult = await generateResponse(model, formattedPrompt, testCase.maxTokens);
    console.log(`   Prompt: "${formattedPrompt.substring(0, 60)}..."`);
    console.log(`   Response (${formattedResult.length} chars):`);
    console.log(`   "${formattedResult.substring(0, 200)}..."`);
    
    // Validation checks
    console.log('\n📊 Validation:');
    const coherenceCheck = validateCoherence(formattedResult);
    const keywordCheck = validateKeywords(formattedResult, testCase.expectedKeywords);
    const lengthCheck = formattedResult.length > 20; // At least some content
    
    console.log(`   ✓ Coherence: ${coherenceCheck ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✓ Keywords: ${keywordCheck ? '✅ PASS' : '❌ FAIL'} (found: ${keywordCheck}/${testCase.expectedKeywords.length})`);
    console.log(`   ✓ Length: ${lengthCheck ? '✅ PASS' : '❌ FAIL'} (${formattedResult.length} chars)`);
    
    if (coherenceCheck && keywordCheck && lengthCheck) {
      console.log('\n   ✅ TEST PASSED');
      passedTests++;
    } else {
      console.log('\n   ❌ TEST FAILED');
    }
    
    console.log('\n' + '='.repeat(70));
  }
  
  // Summary
  console.log('\n\n📈 Test Summary\n');
  console.log('='.repeat(70));
  console.log(`\n   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${totalTests - passedTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Mistral formatting is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Review the output above for details.\n');
  }
}

/**
 * Generate response using the model
 */
async function generateResponse(model, prompt, maxTokens) {
  const context = await model.createContext({ contextSize: 2048 });
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
  });
  
  try {
    const response = await session.prompt(prompt, {
      temperature: 0.4,
      maxTokens: maxTokens,
    });
    
    context.dispose();
    return response.trim();
  } catch (error) {
    context.dispose();
    throw error;
  }
}

/**
 * Validate response coherence
 * Checks for common issues: repetition, gibberish, incomplete sentences
 */
function validateCoherence(text) {
  if (!text || text.length < 10) return false;
  
  // Check for excessive repetition (same word repeated 5+ times in a row)
  const repetitionPattern = /\b(\w+)(\s+\1){4,}/gi;
  if (repetitionPattern.test(text)) {
    console.log('      ⚠️  Detected excessive repetition');
    return false;
  }
  
  // Check for gibberish (too many non-word characters)
  const words = text.split(/\s+/);
  const validWords = words.filter(word => /^[a-zA-Z0-9,.'"-]+$/.test(word));
  if (validWords.length / words.length < 0.7) {
    console.log('      ⚠️  Detected potential gibberish (too many invalid chars)');
    return false;
  }
  
  // Check for incomplete sentences (should end with punctuation)
  if (!/[.!?]$/.test(text.trim())) {
    console.log('      ⚠️  Response ends abruptly without punctuation');
    // This is a warning, not a failure
  }
  
  return true;
}

/**
 * Validate presence of expected keywords
 */
function validateKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  const foundCount = keywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  // Pass if at least 50% of keywords are found
  return foundCount >= Math.ceil(keywords.length * 0.5) ? foundCount : false;
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Error running tests:', error.message);
  console.error(error.stack);
  process.exit(1);
});















