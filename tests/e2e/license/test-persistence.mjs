/**
 * Test License Persistence
 * Tests that license persists after app restart
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LICENSE_FILE_PATH = '/home/cam/1.license';

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

// Get database path (simulating Electron's userData path)
function getTestDbPath() {
  // Use a test database in the project
  return resolve(__dirname, '../../test-license.db');
}

// Test 1: License can be saved to database
function testLicenseSave() {
  try {
    const dbPath = getTestDbPath();
    const db = new Database(dbPath);
    
    // Create licenses table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_code TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        subscription_status TEXT NOT NULL,
        subscription_plan TEXT,
        subscription_id TEXT,
        created_at INTEGER
      )
    `);
    
    // Read license file
    const licenseContent = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
    const license = JSON.parse(licenseContent);
    
    // Clear existing licenses
    db.prepare('DELETE FROM licenses').run();
    
    // Insert license
    const stmt = db.prepare(`
      INSERT INTO licenses (
        license_code, user_id, email, expires_at, 
        subscription_status, subscription_plan, subscription_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      license.license_code,
      license.user_id,
      license.email,
      license.expires_at,
      license.subscription_status,
      license.subscription_plan || null,
      license.subscription_id || null,
      license.created_at || Math.floor(Date.now() / 1000)
    );
    
    db.close();
    
    pass('License can be saved to database');
    return true;
  } catch (error) {
    fail('License can be saved to database', error);
    return false;
  }
}

// Test 2: License can be retrieved from database
function testLicenseRetrieve() {
  try {
    const dbPath = getTestDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file does not exist');
    }
    
    const db = new Database(dbPath);
    const stmt = db.prepare('SELECT * FROM licenses ORDER BY id DESC LIMIT 1');
    const row = stmt.get();
    
    if (!row) {
      throw new Error('No license found in database');
    }
    
    // Verify license structure
    if (!row.license_code || !row.user_id || !row.email) {
      throw new Error('License data is incomplete');
    }
    
    db.close();
    
    pass('License can be retrieved from database');
    return true;
  } catch (error) {
    fail('License can be retrieved from database', error);
    return false;
  }
}

// Test 3: License persists after "restart" (simulated)
function testLicensePersistence() {
  try {
    const dbPath = getTestDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file does not exist');
    }
    
    // Simulate app restart by closing and reopening database
    const db1 = new Database(dbPath);
    const stmt1 = db1.prepare('SELECT * FROM licenses ORDER BY id DESC LIMIT 1');
    const license1 = stmt1.get();
    db1.close();
    
    // "Restart" - open database again
    const db2 = new Database(dbPath);
    const stmt2 = db2.prepare('SELECT * FROM licenses ORDER BY id DESC LIMIT 1');
    const license2 = stmt2.get();
    db2.close();
    
    // Verify license is the same
    if (!license1 || !license2) {
      throw new Error('License not found after restart');
    }
    
    if (license1.license_code !== license2.license_code) {
      throw new Error('License changed after restart');
    }
    
    pass('License persists after restart');
    return true;
  } catch (error) {
    fail('License persists after restart', error);
    return false;
  }
}

// Test 4: License validation after retrieval
function testLicenseValidationAfterRetrieve() {
  try {
    const dbPath = getTestDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file does not exist');
    }
    
    const db = new Database(dbPath);
    const stmt = db.prepare('SELECT * FROM licenses ORDER BY id DESC LIMIT 1');
    const row = stmt.get();
    db.close();
    
    if (!row) {
      throw new Error('No license found');
    }
    
    // Validate license structure
    const license = {
      license_code: row.license_code,
      user_id: row.user_id,
      email: row.email,
      expires_at: row.expires_at,
      subscription_status: row.subscription_status,
      subscription_plan: row.subscription_plan,
      subscription_id: row.subscription_id,
      created_at: row.created_at
    };
    
    // Check required fields
    if (!license.license_code || !license.subscription_status) {
      throw new Error('License missing required fields');
    }
    
    // Check subscription status
    if (license.subscription_status !== 'active') {
      throw new Error(`Subscription status is ${license.subscription_status}, expected active`);
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now >= license.expires_at) {
      throw new Error('License is expired');
    }
    
    pass('License validation after retrieve works');
    return true;
  } catch (error) {
    fail('License validation after retrieve works', error);
    return false;
  }
}

// Cleanup
function cleanup() {
  try {
    const dbPath = getTestDbPath();
    if (fs.existsSync(dbPath)) {
      // Keep database for inspection, but could delete here
      log(`Test database kept at: ${dbPath}`);
    }
  } catch (error) {
    log(`Cleanup warning: ${error.message}`);
  }
}

// Main test runner
function runTests() {
  log('='.repeat(60));
  log('License Persistence Tests');
  log('='.repeat(60));
  log('');
  
  testLicenseSave();
  testLicenseRetrieve();
  testLicensePersistence();
  testLicenseValidationAfterRetrieve();
  
  cleanup();
  
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
  
  // Save results
  const resultsPath = resolve(__dirname, 'persistence-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  log(`Results saved to: ${resultsPath}`);
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests();

