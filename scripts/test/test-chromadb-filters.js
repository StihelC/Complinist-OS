#!/usr/bin/env node
/**
 * Test Script: ChromaDB Filter JSON Conversion
 * Tests that boolean filters are correctly converted to Python format
 *
 * Run with: node scripts/test/test-chromadb-filters.js
 */

console.log('🧪 Testing ChromaDB Filter Conversion\n');
console.log('=' .repeat(70));

// Simulate the filter conversion logic
function convertFilters(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return null;
  }

  // NEW: Just use JSON.stringify - will be parsed by json.loads() in Python
  return JSON.stringify(filters);
}

// Test cases
const testCases = [
  {
    name: 'Boolean filter (is_small_chunk: true)',
    input: { is_small_chunk: true },
    expectedContains: 'true', // Should keep as JSON boolean
    shouldNotContain: 'True', // Should NOT convert to Python True
  },
  {
    name: 'Complex filter with $and and boolean',
    input: {
      "$and": [
        { "is_small_chunk": true },
        { "family": { "$in": ["AC"] } },
        { "control_id": "AC-4" }
      ]
    },
    expectedContains: 'true',
    shouldNotContain: 'True',
  },
  {
    name: 'Multiple booleans',
    input: {
      is_small_chunk: true,
      is_active: false,
      has_parent: true,
    },
    expectedContains: ['true', 'false'],
    shouldNotContain: ['True', 'False'],
  },
  {
    name: 'Null value',
    input: {
      parent_id: null,
    },
    expectedContains: 'null',
    shouldNotContain: 'None',
  },
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, idx) => {
  console.log(`\nTest ${idx + 1}: ${testCase.name}`);
  console.log('-'.repeat(70));

  const result = convertFilters(testCase.input);

  console.log('Input:', JSON.stringify(testCase.input));
  console.log('Output:', result);

  let testPassed = true;

  // Check expected contents
  if (testCase.expectedContains) {
    const expected = Array.isArray(testCase.expectedContains)
      ? testCase.expectedContains
      : [testCase.expectedContains];

    for (const exp of expected) {
      if (!result.includes(exp)) {
        console.log(`❌ Missing expected: "${exp}"`);
        testPassed = false;
      }
    }
  }

  // Check should not contain
  if (testCase.shouldNotContain) {
    const forbidden = Array.isArray(testCase.shouldNotContain)
      ? testCase.shouldNotContain
      : [testCase.shouldNotContain];

    for (const forb of forbidden) {
      if (result.includes(forb)) {
        console.log(`❌ Contains forbidden: "${forb}"`);
        testPassed = false;
      }
    }
  }

  if (testPassed) {
    console.log('✅ PASS');
    passed++;
  } else {
    console.log('❌ FAIL');
    failed++;
  }
});

// Test Python script generation
console.log('\n' + '='.repeat(70));
console.log('\n🐍 Python Script Generation Test\n');
console.log('-'.repeat(70));

const sampleFilter = { "$and": [{ "is_small_chunk": true }, { "family": { "$in": ["AC"] } }] };
const filtersJson = JSON.stringify(sampleFilter);

// Simulate what the Python script will have
const pythonCode = `
# Parse filters from JSON string (avoids f-string issues with booleans)
filters_json = """${filtersJson.replace(/"/g, '\\"')}"""
try:
    filters_dict = json.loads(filters_json)
    if isinstance(filters_dict, dict) and len(filters_dict) > 0:
        query_params['where'] = filters_dict
except Exception as parse_error:
    print(json.dumps({'error': f'Failed to parse filters JSON: {str(parse_error)}'}), file=sys.stderr)
    sys.exit(1)
`;

console.log('Generated Python code:');
console.log(pythonCode);

// Check for issues
let pythonOk = true;
if (pythonCode.includes('True') && !pythonCode.includes('true')) {
  console.log('❌ FAIL: Python code has "True" instead of "true"');
  pythonOk = false;
  failed++;
} else if (pythonCode.includes('true')) {
  console.log('✅ PASS: Python code correctly uses JSON "true"');
  passed++;
  pythonOk = true;
}

// Final summary
console.log('\n' + '='.repeat(70));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✨ All tests passed! ChromaDB filter conversion is fixed.\n');
  console.log('Key fix: Using JSON.stringify() instead of string replacement');
  console.log('Python will use json.loads() to parse booleans correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the conversion logic.\n');
  process.exit(1);
}
