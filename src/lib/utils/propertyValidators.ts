/**
 * Property Validators
 *
 * Re-exports validation functions from the shared core module.
 * This maintains backward compatibility while using the consolidated implementation.
 *
 * @deprecated Import directly from '@/shared/core' instead
 */

// Re-export all validators from the shared core module
export {
  type ValidationResult,
  type ValidatorType,
  validateIPAddress,
  validateMACAddress,
  validateEmail,
  validateURL,
  validatePositiveInteger,
  validatePortNumber,
  validateNonEmpty,
  validateDate,
  validateLicenseCode,
  validateProperty,
} from '@/shared/core';
