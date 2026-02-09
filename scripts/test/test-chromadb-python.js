#!/usr/bin/env node
/**
 * Test ChromaDB Python Script Generation
 * Actually executes the Python script to verify it works
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPythonCommand } from '../../electron/utils/python-command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🐍 Testing ChromaDB Python Script Generation\n');

// Test filter
const testFilter = {
  "$and": [
    { "is_small_chunk": true },
    { "family": { "$in": ["AC"] } }
  ]
};

const filtersJson = JSON.stringify(testFilter);

// Generate Python script (simplified version)
const pythonScript = `
import json
import sys

try:
    # Parse filters from JSON string (avoids f-string issues with booleans)
    filters_json = """${filtersJson.replace(/"/g, '\\"')}"""

    print(f"JSON string: {filters_json}", file=sys.stderr)

    filters_dict = json.loads(filters_json)

    print(f"Parsed successfully: {type(filters_dict)}", file=sys.stderr)
    print(f"Content: {filters_dict}", file=sys.stderr)

    # Verify boolean type
    if '$and' in filters_dict:
        first_condition = filters_dict['$and'][0]
        if 'is_small_chunk' in first_condition:
            value = first_condition['is_small_chunk']
            print(f"is_small_chunk type: {type(value)}", file=sys.stderr)
            print(f"is_small_chunk value: {value}", file=sys.stderr)

            if isinstance(value, bool):
                print(json.dumps({'success': True, 'message': 'Boolean parsed correctly'}))
                sys.exit(0)
            else:
                print(json.dumps({'success': False, 'error': f'Expected bool, got {type(value)}'}))
                sys.exit(1)

    print(json.dumps({'success': True, 'message': 'Filters parsed'}))

except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
    sys.exit(1)
`;

console.log('Generated Python script:');
console.log('─'.repeat(70));
console.log(pythonScript);
console.log('─'.repeat(70));

console.log('\n📝 Executing Python script...\n');

const pythonCmd = getPythonCommand();
if (!pythonCmd) {
  console.error('❌ No Python command found on this system');
  process.exit(1);
}
const python = spawn(pythonCmd, ['-c', pythonScript]);

let stdout = '';
let stderr = '';

python.stdout.on('data', (data) => {
  stdout += data.toString();
});

python.stderr.on('data', (data) => {
  stderr += data.toString();
  console.log('[Python stderr]', data.toString().trim());
});

python.on('close', (code) => {
  console.log('\n' + '='.repeat(70));

  if (code === 0) {
    console.log('✅ Python script executed successfully');
    console.log('\nOutput:', stdout.trim());

    try {
      const result = JSON.parse(stdout.trim());
      if (result.success) {
        console.log('\n✨ SUCCESS: ChromaDB filter conversion works correctly!');
        console.log('   - JSON parsed without errors');
        console.log('   - Booleans remain as Python bool type');
        console.log('   - No f-string format specifier issues\n');
        process.exit(0);
      } else {
        console.log('\n❌ FAILED:', result.error);
        process.exit(1);
      }
    } catch (e) {
      console.log('\n❌ Failed to parse JSON output:', e.message);
      process.exit(1);
    }
  } else {
    console.log(`❌ Python script exited with code ${code}`);
    console.log('\nStderr:', stderr);
    process.exit(1);
  }
});

python.on('error', (err) => {
  console.error('❌ Failed to execute Python:', err);
  process.exit(1);
});
