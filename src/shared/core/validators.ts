/**
 * Shared Validation Functions
 *
 * Pure validation functions that can be used by both main and renderer processes.
 * These are the single source of truth for all validation logic in the application.
 */

/**
 * Result of a validation check
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// IP Address Validation
// ============================================================================

/**
 * Validate IP address (IPv4 or IPv6)
 */
export function validateIPAddress(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: true }; // Optional field
  }

  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 regex (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(value)) {
    // Validate IPv4 octets
    const parts = value.split('.');
    const valid = parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
    return valid
      ? { valid: true }
      : { valid: false, error: 'Invalid IPv4 address' };
  }

  if (ipv6Regex.test(value)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid IP address format' };
}

// ============================================================================
// MAC Address Validation
// ============================================================================

/**
 * Validate MAC address
 */
export function validateMACAddress(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: true }; // Optional field
  }

  // MAC address regex (supports : and - separators)
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  if (macRegex.test(value)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)',
  };
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validate email address
 */
export function validateEmail(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: true }; // Optional field
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailRegex.test(value)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid email address format' };
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate URL
 */
export function validateURL(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: true }; // Optional field
  }

  try {
    new URL(value);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// ============================================================================
// Number Validation
// ============================================================================

/**
 * Validate positive integer
 */
export function validatePositiveInteger(
  value: string | number
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { valid: true }; // Optional field
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
    return { valid: false, error: 'Must be a positive integer' };
  }

  return { valid: true };
}

/**
 * Validate port number (1-65535)
 */
export function validatePortNumber(value: string | number): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { valid: true }; // Optional field
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || num < 1 || num > 65535 || !Number.isInteger(num)) {
    return { valid: false, error: 'Port number must be between 1 and 65535' };
  }

  return { valid: true };
}

// ============================================================================
// String Validation
// ============================================================================

/**
 * Validate non-empty string
 */
export function validateNonEmpty(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: false, error: 'This field is required' };
  }

  return { valid: true };
}

// ============================================================================
// Date Validation
// ============================================================================

/**
 * Validate date string
 */
export function validateDate(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: true }; // Optional field
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  return { valid: true };
}

// ============================================================================
// License Code Validation
// ============================================================================

/**
 * Validate license code format (12 alphanumeric characters)
 */
export function validateLicenseCode(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { valid: false, error: 'License code is required' };
  }

  // Remove dashes and spaces, convert to uppercase
  const cleaned = value.replace(/[-\s]/g, '').toUpperCase();

  // Must be exactly 12 alphanumeric characters
  if (!/^[A-Z0-9]{12}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'License code must be 12 alphanumeric characters',
    };
  }

  return { valid: true };
}

// ============================================================================
// Property Validation Router
// ============================================================================

/**
 * Validator type identifiers
 */
export type ValidatorType =
  | 'ipAddress'
  | 'macAddress'
  | 'email'
  | 'url'
  | 'positiveInteger'
  | 'portNumber'
  | 'nonEmpty'
  | 'date'
  | 'licenseCode';

/**
 * Main validation function that routes to specific validators
 */
export function validateProperty(
  validator: ValidatorType | string | undefined,
  value: unknown
): ValidationResult {
  if (!validator) {
    return { valid: true }; // No validator specified
  }

  switch (validator) {
    case 'ipAddress':
      return validateIPAddress(String(value || ''));
    case 'macAddress':
      return validateMACAddress(String(value || ''));
    case 'email':
      return validateEmail(String(value || ''));
    case 'url':
      return validateURL(String(value || ''));
    case 'positiveInteger':
      return validatePositiveInteger(value as string | number);
    case 'portNumber':
      return validatePortNumber(value as string | number);
    case 'nonEmpty':
      return validateNonEmpty(String(value || ''));
    case 'date':
      return validateDate(String(value || ''));
    case 'licenseCode':
      return validateLicenseCode(String(value || ''));
    default:
      return { valid: true }; // Unknown validator, pass through
  }
}
