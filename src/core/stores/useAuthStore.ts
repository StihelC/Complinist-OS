// Auth Store - Zustand store for authentication state
// Manages user authentication status based on license file

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  getValidatedLicense,
  clearLicense as clearLicenseFromStore,
  openAndImportLicenseFile,
  importLicenseFromContent,
} from '@/lib/auth/licenseStore';
import type { LicenseFile } from '@/lib/auth/licenseFileValidator';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  license: LicenseFile | null;
  daysRemaining: number | null;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  importLicenseFile: () => Promise<{ success: boolean; error?: string }>;
  importLicenseFromDrop: (content: string) => Promise<{ success: boolean; error?: string }>;
  clearLicense: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: false,
      license: null,
      daysRemaining: null,
      error: null,

  /**
   * Initialize auth state from stored license
   */
  initialize: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await getValidatedLicense();
      
      if (result.valid && result.license) {
        set({
          isAuthenticated: true,
          license: result.license,
          daysRemaining: result.daysRemaining,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isAuthenticated: false,
          license: result.license || null, // Keep expired license for display
          daysRemaining: result.daysRemaining,
          isLoading: false,
          error: result.error || null,
        });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({
        isAuthenticated: false,
        license: null,
        daysRemaining: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  },

  /**
   * Import license file via file picker
   */
  importLicenseFile: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await openAndImportLicenseFile();
      
      // User cancelled
      if (result.error === 'cancelled') {
        set({ isLoading: false });
        return { success: false, error: 'cancelled' };
      }
      
      if (!result.valid) {
        set({
          isLoading: false,
          error: result.error || 'Invalid license file',
        });
        return { success: false, error: result.error };
      }

      // Reload license state
      await get().initialize();
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to import license';
      set({
        isLoading: false,
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Import license from dropped file content
   */
  importLicenseFromDrop: async (content: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await importLicenseFromContent(content);
      
      if (!result.valid) {
        set({
          isLoading: false,
          error: result.error || 'Invalid license file',
        });
        return { success: false, error: result.error };
      }

      // Reload license state
      await get().initialize();
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to import license';
      set({
        isLoading: false,
        error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Clear license and logout
   */
  clearLicense: async () => {
    set({ isLoading: true, error: null });
    
    try {
      await clearLicenseFromStore();
      set({
        isAuthenticated: false,
        license: null,
        daysRemaining: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to clear license:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to clear license',
      });
    }
  },

      /**
       * Check if user is authenticated
       */
      checkAuth: async () => {
        await get().initialize();
        return get().isAuthenticated;
      },
    }),
    { name: 'Auth Store' }
  )
);
