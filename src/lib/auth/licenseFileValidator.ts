/**
 * License File Validator
 *
 * Re-exports license utilities from the shared core module.
 * This maintains backward compatibility while using the consolidated implementation.
 *
 * @deprecated Import directly from '@/shared/core' instead
 */

// Re-export all license utilities from the shared core module
export {
  // Types
  type LicenseFile,
  type LicenseValidationResult,
  type LicenseParseResult,

  // Formatting functions
  formatLicenseCode,
  normalizeLicenseCode,
  formatExpirationDate,
  getTimeUntilExpiration,

  // Parsing functions
  parseLicenseFile,

  // Validation functions
  validateLicenseFields,
  isLicenseExpired,
  calculateDaysRemaining,
  calculateDaysExpired,
  validateLicenseFile,
  importLicenseFile,

  // Status helpers
  getLicenseStatusSummary,
} from '@/shared/core';
