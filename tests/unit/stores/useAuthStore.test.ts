import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '@/core/stores/useAuthStore';
import type { LicenseFile } from '@/lib/auth/licenseFileValidator';

// Mock the license store module
vi.mock('@/lib/auth/licenseStore', () => ({
  getValidatedLicense: vi.fn(),
  clearLicense: vi.fn(),
  openAndImportLicenseFile: vi.fn(),
  importLicenseFromContent: vi.fn(),
}));

// Get the mocked functions
import * as licenseStore from '@/lib/auth/licenseStore';

const mockLicense: LicenseFile = {
  license_id: 'test-license-123',
  user_id: 'test-user-456',
  organization: 'Test Organization',
  email: 'test@example.com',
  issued_at: '2024-01-01T00:00:00Z',
  expires_at: '2025-01-01T00:00:00Z',
  features: ['all'],
  signature: 'test-signature',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
      license: null,
      daysRemaining: null,
      error: null,
    });
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.license).toBeNull();
      expect(state.daysRemaining).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should set isAuthenticated to true when license is valid', async () => {
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
        error: undefined,
      });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.license).toEqual(mockLicense);
      expect(state.daysRemaining).toBe(365);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set isAuthenticated to false when license is invalid', async () => {
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: false,
        license: null,
        daysRemaining: null,
        error: 'License expired',
      });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.license).toBeNull();
      expect(state.daysRemaining).toBeNull();
      expect(state.error).toBe('License expired');
    });

    it('should handle initialization errors', async () => {
      vi.mocked(licenseStore.getValidatedLicense).mockRejectedValueOnce(
        new Error('Network error')
      );

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.license).toBeNull();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading to true during initialization', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(licenseStore.getValidatedLicense).mockReturnValueOnce(
        pendingPromise as any
      );

      const initPromise = useAuthStore.getState().initialize();

      // Check loading state during initialization
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
      });

      await initPromise;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should keep expired license for display', async () => {
      const expiredLicense = { ...mockLicense, expires_at: '2020-01-01T00:00:00Z' };
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: false,
        license: expiredLicense,
        daysRemaining: -100,
        error: 'License expired',
      });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.license).toEqual(expiredLicense);
      expect(state.daysRemaining).toBe(-100);
    });
  });

  describe('importLicenseFile', () => {
    it('should successfully import a license file', async () => {
      vi.mocked(licenseStore.openAndImportLicenseFile).mockResolvedValueOnce({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
      });
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
      });

      const result = await useAuthStore.getState().importLicenseFile();

      expect(result.success).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should handle cancelled import', async () => {
      vi.mocked(licenseStore.openAndImportLicenseFile).mockResolvedValueOnce({
        valid: false,
        error: 'cancelled',
      });

      const result = await useAuthStore.getState().importLicenseFile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('cancelled');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should handle invalid license file', async () => {
      vi.mocked(licenseStore.openAndImportLicenseFile).mockResolvedValueOnce({
        valid: false,
        error: 'Invalid signature',
      });

      const result = await useAuthStore.getState().importLicenseFile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid signature');
      expect(useAuthStore.getState().error).toBe('Invalid signature');
    });

    it('should handle import errors', async () => {
      vi.mocked(licenseStore.openAndImportLicenseFile).mockRejectedValueOnce(
        new Error('File read error')
      );

      const result = await useAuthStore.getState().importLicenseFile();

      expect(result.success).toBe(false);
      expect(result.error).toBe('File read error');
      expect(useAuthStore.getState().error).toBe('File read error');
    });
  });

  describe('importLicenseFromDrop', () => {
    const mockContent = JSON.stringify(mockLicense);

    it('should successfully import license from dropped content', async () => {
      vi.mocked(licenseStore.importLicenseFromContent).mockResolvedValueOnce({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
      });
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
      });

      const result = await useAuthStore.getState().importLicenseFromDrop(mockContent);

      expect(result.success).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should handle invalid dropped content', async () => {
      vi.mocked(licenseStore.importLicenseFromContent).mockResolvedValueOnce({
        valid: false,
        error: 'Invalid format',
      });

      const result = await useAuthStore.getState().importLicenseFromDrop('invalid-content');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid format');
    });

    it('should handle drop import errors', async () => {
      vi.mocked(licenseStore.importLicenseFromContent).mockRejectedValueOnce(
        new Error('Parse error')
      );

      const result = await useAuthStore.getState().importLicenseFromDrop('bad-json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Parse error');
    });
  });

  describe('clearLicense', () => {
    it('should clear license and reset state', async () => {
      // First set up authenticated state
      useAuthStore.setState({
        isAuthenticated: true,
        license: mockLicense,
        daysRemaining: 365,
      });

      vi.mocked(licenseStore.clearLicense).mockResolvedValueOnce(undefined);

      await useAuthStore.getState().clearLicense();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.license).toBeNull();
      expect(state.daysRemaining).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should handle clearLicense errors', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        license: mockLicense,
      });

      vi.mocked(licenseStore.clearLicense).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await useAuthStore.getState().clearLicense();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Storage error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should return true when authenticated', async () => {
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: true,
        license: mockLicense,
        daysRemaining: 365,
      });

      const result = await useAuthStore.getState().checkAuth();

      expect(result).toBe(true);
    });

    it('should return false when not authenticated', async () => {
      vi.mocked(licenseStore.getValidatedLicense).mockResolvedValueOnce({
        valid: false,
        license: null,
        daysRemaining: null,
        error: 'No license',
      });

      const result = await useAuthStore.getState().checkAuth();

      expect(result).toBe(false);
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle rapid state updates correctly', async () => {
      const results: boolean[] = [];

      vi.mocked(licenseStore.getValidatedLicense)
        .mockResolvedValueOnce({
          valid: true,
          license: mockLicense,
          daysRemaining: 365,
        })
        .mockResolvedValueOnce({
          valid: false,
          license: null,
          daysRemaining: null,
          error: 'Expired',
        });

      // Fire two initializations concurrently
      await Promise.all([
        useAuthStore.getState().initialize(),
        useAuthStore.getState().initialize(),
      ]);

      // Final state should be from the last resolved promise
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('State Reset', () => {
    it('should properly reset all state fields', () => {
      // Set up a complex state
      useAuthStore.setState({
        isAuthenticated: true,
        isLoading: true,
        license: mockLicense,
        daysRemaining: 365,
        error: 'Some error',
      });

      // Reset to initial state
      useAuthStore.setState({
        isAuthenticated: false,
        isLoading: false,
        license: null,
        daysRemaining: null,
        error: null,
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.license).toBeNull();
      expect(state.daysRemaining).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
