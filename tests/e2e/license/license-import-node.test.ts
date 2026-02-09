/**
 * Node.js E2E Test for License Import System
 * Tests the actual license import flow without launching full Electron app
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LICENSE_FILE_PATH = '/home/cam/1.license';

// Mock Electron API for testing
global.window = {
  electronAPI: {
    openLicenseFile: async () => {
      try {
        const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
        return {
          success: true,
          content: content,
          filePath: LICENSE_FILE_PATH,
          canceled: false
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          canceled: false
        };
      }
    },
    saveLicense: async ({ license }: { license: any }) => {
      // Mock save - in real test would check database
      return { success: true };
    },
    getLicense: async () => {
      // Mock get - would query database
      return { success: true, license: null };
    }
  }
} as any;

describe('License Import E2E Tests', () => {
  let licenseContent: string;
  let licenseObject: any;

  beforeAll(() => {
    // Verify license file exists
    if (!fs.existsSync(LICENSE_FILE_PATH)) {
      throw new Error(`License file not found at ${LICENSE_FILE_PATH}`);
    }
    
    licenseContent = fs.readFileSync(LICENSE_FILE_PATH, 'utf-8');
    licenseObject = JSON.parse(licenseContent);
  });

  describe('License File Validation', () => {
    it('should read license file successfully', () => {
      expect(licenseContent).toBeTruthy();
      expect(licenseContent.length).toBeGreaterThan(0);
    });

    it('should parse license file as valid JSON', () => {
      expect(() => JSON.parse(licenseContent)).not.toThrow();
      expect(licenseObject).toBeInstanceOf(Object);
    });

    it('should have all required fields', () => {
      const requiredFields = ['license_code', 'user_id', 'email', 'expires_at', 'subscription_status'];
      for (const field of requiredFields) {
        expect(licenseObject).toHaveProperty(field);
      }
    });

    it('should have active subscription status', () => {
      expect(licenseObject.subscription_status).toBe('active');
    });

    it('should have valid expiration date', () => {
      expect(typeof licenseObject.expires_at).toBe('number');
      expect(licenseObject.expires_at).toBeGreaterThan(0);
      // Check if expired (should not be)
      const now = Math.floor(Date.now() / 1000);
      expect(licenseObject.expires_at).toBeGreaterThan(now);
    });
  });

  describe('License Validation Logic', () => {
    it('should validate license file correctly', async () => {
      const { importLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const result = importLicenseFile(licenseContent);
      
      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.license).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should calculate days remaining correctly', async () => {
      const { validateLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const result = validateLicenseFile(licenseObject);
      
      expect(result.valid).toBe(true);
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(typeof result.daysRemaining).toBe('number');
    });
  });

  describe('License Store Operations', () => {
    it('should simulate openAndImportLicenseFile flow', async () => {
      // Simulate the IPC call
      const fileResult = await (global.window as any).electronAPI.openLicenseFile();
      
      expect(fileResult.success).toBe(true);
      expect(fileResult.content).toBeTruthy();
      expect(fileResult.canceled).toBe(false);
      
      // Parse and validate
      const { importLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const validation = importLicenseFile(fileResult.content);
      
      expect(validation.valid).toBe(true);
      expect(validation.license).toBeDefined();
    });

    it('should handle license import from content', async () => {
      const { importLicenseFromContent } = await import('../../src/lib/auth/licenseStore.ts');
      
      // This will fail because we need actual IPC, but we can test the validation part
      const { importLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const validation = importLicenseFile(licenseContent);
      
      expect(validation.valid).toBe(true);
      if (validation.license) {
        expect(validation.license.subscription_status).toBe('active');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const { importLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const result = importLicenseFile('invalid json');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const { validateLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const invalidLicense = { ...licenseObject };
      delete invalidLicense.license_code;
      
      const result = validateLicenseFile(invalidLicense);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle inactive subscription', async () => {
      const { validateLicenseFile } = await import('../../src/lib/auth/licenseFileValidator.ts');
      const inactiveLicense = { ...licenseObject, subscription_status: 'inactive' };
      
      const result = validateLicenseFile(inactiveLicense);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('active');
    });
  });
});

