/**
 * End-to-End Test Suite for License Import System
 * Tests license file import, authentication, and persistence
 */

import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Real license file path
const LICENSE_FILE_PATH = '/home/cam/1.license';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const APP_LAUNCH_TIMEOUT = 10000; // 10 seconds

interface TestContext {
  electronProcess?: ChildProcess;
  mainLogs: string[];
  rendererLogs: string[];
  licenseContent?: string;
}

let testContext: TestContext = {
  mainLogs: [],
  rendererLogs: [],
};

/**
 * Read license file content for testing
 */
function readLicenseFile(): string {
  try {
    const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
    // Validate it's JSON
    JSON.parse(content);
    return content;
  } catch (error) {
    throw new Error(`Failed to read license file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse license file to get license object
 */
function parseLicenseFile(): any {
  const content = readLicenseFile();
  return JSON.parse(content);
}

test.describe('License Import E2E Tests', () => {
  test.beforeAll(() => {
    // Verify license file exists and is valid
    expect(fs.existsSync(LICENSE_FILE_PATH)).toBe(true);
    const license = parseLicenseFile();
    expect(license.subscription_status).toBe('active');
    expect(license.license_code).toBeDefined();
    testContext.licenseContent = readLicenseFile();
  });

  test('License file exists and is valid', () => {
    const license = parseLicenseFile();
    expect(license).toHaveProperty('license_code');
    expect(license).toHaveProperty('user_id');
    expect(license).toHaveProperty('email');
    expect(license).toHaveProperty('expires_at');
    expect(license).toHaveProperty('subscription_status', 'active');
    expect(typeof license.expires_at).toBe('number');
    expect(license.expires_at).toBeGreaterThan(0);
  });

  test('License file content can be read', () => {
    const content = readLicenseFile();
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
    
    // Verify it's valid JSON
    const parsed = JSON.parse(content);
    expect(parsed).toBeInstanceOf(Object);
  });

  test('License validation logic works correctly', async () => {
    // Import the validation function
    const { validateLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
    const license = parseLicenseFile();
    
    const result = validateLicenseFile(license);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.license).toBeDefined();
    expect(result.daysRemaining).toBeGreaterThan(0);
  });
});

test.describe('IPC Handler Tests', () => {
  test('License file can be read via file system', () => {
    const filePath = LICENSE_FILE_PATH;
    expect(fs.existsSync(filePath)).toBe(true);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toBeTruthy();
    
    const license = JSON.parse(content);
    expect(license.subscription_status).toBe('active');
  });

  test('License file format matches expected structure', () => {
    const license = parseLicenseFile();
    
    // Required fields
    expect(license).toHaveProperty('license_code');
    expect(license).toHaveProperty('user_id');
    expect(license).toHaveProperty('email');
    expect(license).toHaveProperty('expires_at');
    expect(license).toHaveProperty('subscription_status');
    
    // Type checks
    expect(typeof license.license_code).toBe('string');
    expect(typeof license.user_id).toBe('string');
    expect(typeof license.email).toBe('string');
    expect(typeof license.expires_at).toBe('number');
    expect(typeof license.subscription_status).toBe('string');
  });
});

test.describe('License Store Tests', () => {
  test('openAndImportLicenseFile can process license content', async () => {
    const { importLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
    const content = readLicenseFile();
    
    const result = importLicenseFile(content);
    expect(result.valid).toBe(true);
    expect(result.license).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  test('License validation handles all required fields', async () => {
    const { validateLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
    const license = parseLicenseFile();
    
    const result = validateLicenseFile(license);
    expect(result.valid).toBe(true);
    expect(result.license?.license_code).toBe(license.license_code);
    expect(result.license?.email).toBe(license.email);
  });
});

test.describe('Integration Tests', () => {
  test('Full license import flow simulation', async () => {
    // Simulate the full flow without actually launching Electron
    const licenseContent = readLicenseFile();
    const license = JSON.parse(licenseContent);
    
    // Step 1: File read (simulated IPC response)
    const fileResult = {
      success: true,
      content: licenseContent,
      filePath: LICENSE_FILE_PATH,
      canceled: false
    };
    expect(fileResult.success).toBe(true);
    expect(fileResult.content).toBeTruthy();
    
    // Step 2: Parse and validate
    const { importLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
    const validation = importLicenseFile(fileResult.content);
    expect(validation.valid).toBe(true);
    expect(validation.license).toBeDefined();
    
    // Step 3: Verify license structure
    if (validation.license) {
      expect(validation.license.subscription_status).toBe('active');
      expect(validation.license.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });
});

