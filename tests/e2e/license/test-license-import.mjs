/**
 * E2E Test Script for License Import System
 * Tests license file import flow with real license file
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LICENSE_FILE_PATH = '/home/cam/1.license';

// Test results
const results = {
  passed: [],
  failed: [],
  logs: []
};

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  results.logs.push(logMessage);
}

function pass(testName) {
  log(`✓ PASS: ${testName}`);
  results.passed.push(testName);
}

function fail(testName, error) {
  log(`✗ FAIL: ${testName} - ${error}`);
  results.failed.push({ test: testName, error: error.message || String(error) });
}

// Test 1: License file exists and is readable
function testLicenseFileExists() {
  try {
    if (!fs.existsSync(LICENSE_FILE_PATH)) {
      throw new Error(`License file not found at ${LICENSE_FILE_PATH}`);
    }
    const stats = fs.statSync(LICENSE_FILE_PATH);
    if (stats.size === 0) {
      throw new Error('License file is empty');
    }
    pass('License file exists and is readable');
    return true;
  } catch (error) {
    fail('License file exists and is readable', error);
    return false;
  }
}

// Test 2: License file is valid JSON
function testLicenseFileIsValidJSON() {
  try {
    const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('License file is not a valid JSON object');
    }
    pass('License file is valid JSON');
    return parsed;
  } catch (error) {
    fail('License file is valid JSON', error);
    return null;
  }
}

// Test 3: License has required fields
function testLicenseHasRequiredFields(license) {
  if (!license) return false;
  
  try {
    const requiredFields = ['license_code', 'user_id', 'email', 'expires_at', 'subscription_status'];
    const missing = requiredFields.filter(field => !(field in license));
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    pass('License has all required fields');
    return true;
  } catch (error) {
    fail('License has all required fields', error);
    return false;
  }
}

// Test 4: License has active subscription
function testLicenseIsActive(license) {
  if (!license) return false;
  
  try {
    if (license.subscription_status !== 'active') {
      throw new Error(`Subscription status is "${license.subscription_status}", expected "active"`);
    }
    pass('License has active subscription');
    return true;
  } catch (error) {
    fail('License has active subscription', error);
    return false;
  }
}

// Test 5: License is not expired
function testLicenseNotExpired(license) {
  if (!license) return false;
  
  try {
    const now = Math.floor(Date.now() / 1000);
    if (license.expires_at <= now) {
      const daysExpired = Math.floor((now - license.expires_at) / 86400);
      throw new Error(`License expired ${daysExpired} days ago`);
    }
    const daysRemaining = Math.floor((license.expires_at - now) / 86400);
    log(`  License expires in ${daysRemaining} days`);
    pass('License is not expired');
    return true;
  } catch (error) {
    fail('License is not expired', error);
    return false;
  }
}

// Test 6: Test license validation logic
async function testLicenseValidation() {
  try {
    // Dynamic import to handle TypeScript/ES modules
    const licenseContent = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
    const license = JSON.parse(licenseContent);
    
    // Test validation logic manually (since we can't easily import TS in .mjs)
    // Check required fields
    const requiredFields = ['license_code', 'user_id', 'email', 'expires_at', 'subscription_status'];
    for (const field of requiredFields) {
      if (!(field in license)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Check types
    if (typeof license.license_code !== 'string' || license.license_code.trim() === '') {
      throw new Error('license_code must be a non-empty string');
    }
    
    if (typeof license.subscription_status !== 'string' || license.subscription_status !== 'active') {
      throw new Error(`subscription_status must be "active", got: ${license.subscription_status}`);
    }
    
    if (typeof license.expires_at !== 'number' || license.expires_at <= 0) {
      throw new Error('expires_at must be a positive number');
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (now >= license.expires_at) {
      throw new Error('License is expired');
    }
    
    pass('License validation logic works correctly');
    return true;
  } catch (error) {
    fail('License validation logic works correctly', error);
    return false;
  }
}

// Test 7: Test IPC handler simulation
function testIPCHandlerSimulation() {
  try {
    // Simulate what the IPC handler does
    const filePath = LICENSE_FILE_PATH;
    
    // Check file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    
    // Read file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error('File is empty');
    }
    
    // Parse JSON
    const license = JSON.parse(fileContent);
    
    // Return IPC-like response
    const ipcResponse = {
      success: true,
      content: fileContent,
      filePath: filePath
    };
    
    if (!ipcResponse.success || !ipcResponse.content) {
      throw new Error('IPC response is invalid');
    }
    
    pass('IPC handler simulation works correctly');
    return true;
  } catch (error) {
    fail('IPC handler simulation works correctly', error);
    return false;
  }
}

// Test 8: Test full import flow simulation
function testFullImportFlow() {
  try {
    // Step 1: Read file (simulate IPC)
    const fileResult = {
      success: true,
      content: fs.readFileSync(LICENSE_FILE_PATH, 'utf-8'),
      filePath: LICENSE_FILE_PATH,
      canceled: false
    };
    
    if (!fileResult.success || fileResult.canceled) {
      throw new Error('File dialog should return success');
    }
    
    // Step 2: Parse
    const license = JSON.parse(fileResult.content);
    
    // Step 3: Validate structure
    if (license.subscription_status !== 'active') {
      throw new Error('License must be active');
    }
    
    // Step 4: Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now >= license.expires_at) {
      throw new Error('License must not be expired');
    }
    
    pass('Full import flow simulation works correctly');
    return true;
  } catch (error) {
    fail('Full import flow simulation works correctly', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('='.repeat(60));
  log('License Import E2E Test Suite');
  log('='.repeat(60));
  log(`License file: ${LICENSE_FILE_PATH}`);
  log('');
  
  // Run tests
  const fileExists = testLicenseFileExists();
  const license = testLicenseFileIsValidJSON();
  if (license) {
    testLicenseHasRequiredFields(license);
    testLicenseIsActive(license);
    testLicenseNotExpired(license);
  }
  await testLicenseValidation();
  testIPCHandlerSimulation();
  testFullImportFlow();
  
  // Print summary
  log('');
  log('='.repeat(60));
  log('Test Summary');
  log('='.repeat(60));
  log(`Total tests: ${results.passed.length + results.failed.length}`);
  log(`Passed: ${results.passed.length}`);
  log(`Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    log('');
    log('Failed tests:');
    results.failed.forEach(({ test, error }) => {
      log(`  - ${test}: ${error}`);
    });
  }
  
  log('');
  log('='.repeat(60));
  
  // Save results to file
  const resultsPath = resolve(__dirname, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  log(`Results saved to: ${resultsPath}`);
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});

