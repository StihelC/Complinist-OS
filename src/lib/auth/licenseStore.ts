// License Store - Manages license storage via Electron IPC
// Interfaces with SQLite database through IPC handlers

import { 
  validateLicenseFile, 
  importLicenseFile,
  type LicenseFile, 
  type LicenseValidationResult 
} from './licenseFileValidator';

/**
 * Save license to database
 */
export async function saveLicense(license: LicenseFile): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate license first
    const validation = validateLicenseFile(license);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid license' };
    }

    // Save to database via IPC
    const result = await window.electronAPI.saveLicense({ license });
    return result;
  } catch (error) {
    console.error('Failed to save license:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save license',
    };
  }
}

/**
 * Get current license from database
 */
export async function getLicense(): Promise<{ success: boolean; license?: LicenseFile | null; error?: string }> {
  try {
    const result = await window.electronAPI.getLicense();
    return result;
  } catch (error) {
    console.error('Failed to get license:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get license',
    };
  }
}

/**
 * Clear license from database
 */
export async function clearLicense(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await window.electronAPI.clearLicense();
    return result;
  } catch (error) {
    console.error('Failed to clear license:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear license',
    };
  }
}

/**
 * Get license and validate it
 */
export async function getValidatedLicense(): Promise<LicenseValidationResult & { license?: LicenseFile }> {
  try {
    const licenseResult = await getLicense();
    
    if (!licenseResult.success || !licenseResult.license) {
      return { 
        valid: false, 
        expired: false,
        daysRemaining: null,
        error: 'No license found' 
      };
    }

    const license = licenseResult.license;
    
    // Validate the license
    const validation = validateLicenseFile(license);
    
    if (!validation.valid) {
      // Auto-clear invalid/expired license
      if (validation.expired) {
        // Keep expired license for display purposes, don't auto-clear
        return { ...validation, license };
      }
      await clearLicense();
      return validation;
    }

    return {
      ...validation,
      license,
    };
  } catch (error) {
    console.error('Failed to get validated license:', error);
    return {
      valid: false,
      expired: false,
      daysRemaining: null,
      error: error instanceof Error ? error.message : 'License validation failed',
    };
  }
}

/**
 * Open file picker and import license file
 */
export async function openAndImportLicenseFile(): Promise<LicenseValidationResult & { license?: LicenseFile }> {
  try {
    console.log('[LicenseStore] Opening license file picker...');
    // Open file picker via Electron
    const fileResult = await window.electronAPI.openLicenseFile();
    console.log('[LicenseStore] File picker result:', { 
      success: fileResult.success, 
      canceled: fileResult.canceled,
      hasContent: !!fileResult.content,
      contentLength: fileResult.content?.length,
      error: fileResult.error 
    });
    
    if (!fileResult.success) {
      if (fileResult.canceled) {
        console.log('[LicenseStore] User canceled file selection');
        return {
          valid: false,
          expired: false,
          daysRemaining: null,
          error: 'cancelled',
        };
      }
      console.error('[LicenseStore] File picker failed:', fileResult.error);
      return {
        valid: false,
        expired: false,
        daysRemaining: null,
        error: fileResult.error || 'Failed to open file',
      };
    }
    
    if (!fileResult.content) {
      console.error('[LicenseStore] File content is missing');
      return {
        valid: false,
        expired: false,
        daysRemaining: null,
        error: 'File is empty',
      };
    }
    
    console.log('[LicenseStore] Parsing and validating license file...');
    // Parse and validate the file
    const validation = importLicenseFile(fileResult.content);
    console.log('[LicenseStore] Validation result:', { 
      valid: validation.valid, 
      expired: validation.expired,
      error: validation.error 
    });
    
    if (!validation.valid || !validation.license) {
      console.error('[LicenseStore] License validation failed:', validation.error);
      return validation;
    }
    
    console.log('[LicenseStore] Saving license to database...');
    // Save valid license to database
    const saveResult = await saveLicense(validation.license);
    
    if (!saveResult.success) {
      console.error('[LicenseStore] Failed to save license:', saveResult.error);
      return {
        valid: false,
        expired: false,
        daysRemaining: null,
        error: saveResult.error || 'Failed to save license',
      };
    }
    
    console.log('[LicenseStore] License imported successfully');
    return validation;
  } catch (error) {
    console.error('[LicenseStore] Failed to import license file:', error);
    console.error('[LicenseStore] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      valid: false,
      expired: false,
      daysRemaining: null,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}

/**
 * Import license from file content (for drag-drop)
 */
export async function importLicenseFromContent(content: string): Promise<LicenseValidationResult & { license?: LicenseFile }> {
  try {
    // Parse and validate the file
    const validation = importLicenseFile(content);
    
    if (!validation.valid || !validation.license) {
      return validation;
    }
    
    // Save valid license to database
    const saveResult = await saveLicense(validation.license);
    
    if (!saveResult.success) {
      return {
        valid: false,
        expired: false,
        daysRemaining: null,
        error: saveResult.error || 'Failed to save license',
      };
    }
    
    return validation;
  } catch (error) {
    console.error('Failed to import license from content:', error);
    return {
      valid: false,
      expired: false,
      daysRemaining: null,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}






