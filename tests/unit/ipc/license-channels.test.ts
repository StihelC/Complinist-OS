/**
 * IPC License Channel Tests (license:*)
 *
 * Tests all license-related IPC channels for:
 * - License file operations (open, save, get, clear)
 * - License validation
 * - Type safety and error handling
 * - Data persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockElectronAPI,
  resetMockState,
  getCallsForChannel,
  setMockConfig,
  setMockLicense,
  createMockLicense,
} from '../../fixtures/ipc/__mocks__/electronAPI.mock';
import type { ElectronAPI, LicenseFile } from '@/window.d';

describe('License IPC Channels (license:*)', () => {
  let mockAPI: ElectronAPI;

  beforeEach(() => {
    resetMockState();
    setMockConfig({});
    mockAPI = createMockElectronAPI();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('license:open-file', () => {
    it('should return canceled when no file selected', async () => {
      const result = await mockAPI.openLicenseFile();

      // When no license is set, mock returns canceled
      expect(result.success).toBe(false);
      expect(result.canceled).toBe(true);
      expect(getCallsForChannel('license:open-file')).toHaveLength(1);
    });

    it('should return file content when license exists', async () => {
      const license = createMockLicense();
      setMockLicense(license);

      const result = await mockAPI.openLicenseFile();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('filePath');
      expect(result.content).toBe(JSON.stringify(license));
    });

    it('should return file path', async () => {
      setMockLicense(createMockLicense());

      const result = await mockAPI.openLicenseFile();

      expect(result.filePath).toContain('.license');
    });

    it('should handle file system errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'File read error' });

      await expect(mockAPI.openLicenseFile())
        .rejects.toThrow('File read error');
    });

    it('should record IPC call', async () => {
      await mockAPI.openLicenseFile();

      expect(getCallsForChannel('license:open-file')).toHaveLength(1);
      expect(getCallsForChannel('license:open-file')[0].args).toEqual([]);
    });
  });

  describe('license:save', () => {
    it('should save valid license', async () => {
      const license = createMockLicense();

      const result = await mockAPI.saveLicense({ license });

      expect(result.success).toBe(true);
      expect(getCallsForChannel('license:save')).toHaveLength(1);
    });

    it('should save license with all required fields', async () => {
      const license: LicenseFile = {
        license_code: 'TEST-CODE-12345',
        user_id: 'user-abc-123',
        email: 'user@example.com',
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
        subscription_status: 'active'
      };

      const result = await mockAPI.saveLicense({ license });

      expect(result.success).toBe(true);
    });

    it('should save license with optional fields', async () => {
      const license: LicenseFile = {
        license_code: 'TEST-CODE-12345',
        user_id: 'user-abc-123',
        email: 'user@example.com',
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 365,
        subscription_status: 'active',
        subscription_plan: 'enterprise',
        subscription_id: 'sub-xyz-789',
        created_at: Math.floor(Date.now() / 1000)
      };

      const result = await mockAPI.saveLicense({ license });

      expect(result.success).toBe(true);
    });

    it('should persist license for later retrieval', async () => {
      const license = createMockLicense({ email: 'persist@test.com' });
      await mockAPI.saveLicense({ license });

      const getResult = await mockAPI.getLicense();

      expect(getResult.success).toBe(true);
      expect(getResult.license?.email).toBe('persist@test.com');
    });

    it('should handle save errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Database write failed' });

      await expect(mockAPI.saveLicense({ license: createMockLicense() }))
        .rejects.toThrow('Database write failed');
    });

    it('should record license data in IPC call', async () => {
      const license = createMockLicense({ license_code: 'RECORDED-CODE' });
      await mockAPI.saveLicense({ license });

      const call = getCallsForChannel('license:save')[0];
      expect(call.args[0].license.license_code).toBe('RECORDED-CODE');
    });
  });

  describe('license:get', () => {
    it('should return null when no license saved', async () => {
      const result = await mockAPI.getLicense();

      expect(result.success).toBe(true);
      expect(result.license).toBeNull();
      expect(getCallsForChannel('license:get')).toHaveLength(1);
    });

    it('should return saved license', async () => {
      const license = createMockLicense({ email: 'saved@test.com' });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.success).toBe(true);
      expect(result.license).not.toBeNull();
      expect(result.license?.email).toBe('saved@test.com');
    });

    it('should return complete license structure', async () => {
      const license = createMockLicense({
        license_code: 'FULL-LICENSE-CODE',
        user_id: 'user-full',
        email: 'full@test.com',
        expires_at: 1704067200, // 2024-01-01
        subscription_status: 'active',
        subscription_plan: 'professional',
        subscription_id: 'sub-123'
      });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license).toEqual(expect.objectContaining({
        license_code: 'FULL-LICENSE-CODE',
        user_id: 'user-full',
        email: 'full@test.com',
        subscription_status: 'active'
      }));
    });

    it('should handle get errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Database read failed' });

      await expect(mockAPI.getLicense())
        .rejects.toThrow('Database read failed');
    });
  });

  describe('license:clear', () => {
    it('should clear saved license', async () => {
      await mockAPI.saveLicense({ license: createMockLicense() });
      const beforeClear = await mockAPI.getLicense();
      expect(beforeClear.license).not.toBeNull();

      const result = await mockAPI.clearLicense();

      expect(result.success).toBe(true);
      const afterClear = await mockAPI.getLicense();
      expect(afterClear.license).toBeNull();
    });

    it('should succeed even when no license exists', async () => {
      const result = await mockAPI.clearLicense();

      expect(result.success).toBe(true);
    });

    it('should record IPC call', async () => {
      await mockAPI.clearLicense();

      expect(getCallsForChannel('license:clear')).toHaveLength(1);
    });

    it('should handle clear errors', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Database delete failed' });

      await expect(mockAPI.clearLicense())
        .rejects.toThrow('Database delete failed');
    });
  });

  describe('License Expiration', () => {
    it('should save license with future expiration', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year from now
      const license = createMockLicense({ expires_at: futureExpiry });

      const result = await mockAPI.saveLicense({ license });

      expect(result.success).toBe(true);
    });

    it('should save license with past expiration', async () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 86400 * 30; // 30 days ago
      const license = createMockLicense({ expires_at: pastExpiry });

      const result = await mockAPI.saveLicense({ license });

      // Mock doesn't validate - just saves
      expect(result.success).toBe(true);
    });

    it('should preserve expiration timestamp', async () => {
      const expires_at = 1735689600; // 2025-01-01
      const license = createMockLicense({ expires_at });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license?.expires_at).toBe(expires_at);
    });
  });

  describe('Subscription Status', () => {
    it('should handle active subscription', async () => {
      const license = createMockLicense({ subscription_status: 'active' });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license?.subscription_status).toBe('active');
    });

    it('should handle inactive subscription', async () => {
      const license = createMockLicense({ subscription_status: 'inactive' });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license?.subscription_status).toBe('inactive');
    });

    it('should handle trial subscription', async () => {
      const license = createMockLicense({ subscription_status: 'trial' });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license?.subscription_status).toBe('trial');
    });
  });

  describe('License Replacement', () => {
    it('should replace existing license with new one', async () => {
      const license1 = createMockLicense({ email: 'first@test.com' });
      const license2 = createMockLicense({ email: 'second@test.com' });

      await mockAPI.saveLicense({ license: license1 });
      await mockAPI.saveLicense({ license: license2 });

      const result = await mockAPI.getLicense();

      expect(result.license?.email).toBe('second@test.com');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type structure for license', async () => {
      const license = createMockLicense();
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      if (result.license) {
        expect(typeof result.license.license_code).toBe('string');
        expect(typeof result.license.user_id).toBe('string');
        expect(typeof result.license.email).toBe('string');
        expect(typeof result.license.expires_at).toBe('number');
        expect(typeof result.license.subscription_status).toBe('string');
      }
    });

    it('should handle optional fields correctly', async () => {
      const minimalLicense: LicenseFile = {
        license_code: 'MIN-LICENSE',
        user_id: 'user-min',
        email: 'min@test.com',
        expires_at: Date.now() / 1000,
        subscription_status: 'active'
      };

      await mockAPI.saveLicense({ license: minimalLicense });
      const result = await mockAPI.getLicense();

      expect(result.license).toBeDefined();
      // Optional fields might be undefined
    });
  });

  describe('Concurrency', () => {
    it('should handle rapid save/get operations', async () => {
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          mockAPI.saveLicense({ license: createMockLicense({ email: `user${i}@test.com` }) })
        );
        operations.push(mockAPI.getLicense());
      }

      await Promise.all(operations);

      // Last saved license should be retrievable
      const finalResult = await mockAPI.getLicense();
      expect(finalResult.license).not.toBeNull();
    });

    it('should handle concurrent operations without race conditions', async () => {
      const save1 = mockAPI.saveLicense({ license: createMockLicense({ email: 'a@test.com' }) });
      const save2 = mockAPI.saveLicense({ license: createMockLicense({ email: 'b@test.com' }) });

      await Promise.all([save1, save2]);

      const result = await mockAPI.getLicense();
      expect(['a@test.com', 'b@test.com']).toContain(result.license?.email);
    });
  });

  describe('Error Handling', () => {
    it('should handle open file dialog permission error', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Permission denied' });

      await expect(mockAPI.openLicenseFile())
        .rejects.toThrow('Permission denied');
    });

    it('should handle database connection error on save', async () => {
      setMockConfig({ shouldFail: true, failureMessage: 'Connection refused' });

      await expect(mockAPI.saveLicense({ license: createMockLicense() }))
        .rejects.toThrow('Connection refused');
    });

    it('should handle network timeout', async () => {
      setMockConfig({ delay: 100 });

      const start = Date.now();
      await mockAPI.getLicense();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all license fields through save/load cycle', async () => {
      const originalLicense: LicenseFile = {
        license_code: 'INTEGRITY-TEST-CODE',
        user_id: 'user-integrity-123',
        email: 'integrity@test.com',
        expires_at: 1767225600, // 2026-01-01
        subscription_status: 'active',
        subscription_plan: 'enterprise',
        subscription_id: 'sub-integrity-789',
        created_at: 1704067200 // 2024-01-01
      };

      await mockAPI.saveLicense({ license: originalLicense });
      const result = await mockAPI.getLicense();

      expect(result.license).toEqual(originalLicense);
    });

    it('should handle special characters in email', async () => {
      const license = createMockLicense({ email: 'user+tag@sub.domain.co.uk' });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license?.email).toBe('user+tag@sub.domain.co.uk');
    });

    it('should handle unicode in license fields', async () => {
      // Note: In practice, license codes wouldn't have unicode, but testing handling
      const license = createMockLicense({ user_id: 'user-测试-123' });
      await mockAPI.saveLicense({ license });

      const result = await mockAPI.getLicense();

      expect(result.license?.user_id).toBe('user-测试-123');
    });
  });

  describe('Complete License Workflow', () => {
    it('should complete full license lifecycle', async () => {
      // 1. Start with no license
      const initial = await mockAPI.getLicense();
      expect(initial.license).toBeNull();

      // 2. Import license file
      const license = createMockLicense();
      setMockLicense(license);
      const openResult = await mockAPI.openLicenseFile();
      expect(openResult.success).toBe(true);

      // 3. Save the license
      const saveResult = await mockAPI.saveLicense({ license });
      expect(saveResult.success).toBe(true);

      // 4. Retrieve the license
      const getResult = await mockAPI.getLicense();
      expect(getResult.license).not.toBeNull();

      // 5. Clear the license
      const clearResult = await mockAPI.clearLicense();
      expect(clearResult.success).toBe(true);

      // 6. Verify license is cleared
      const final = await mockAPI.getLicense();
      expect(final.license).toBeNull();
    });
  });
});
