/**
 * Shared License Utilities
 *
 * Pure functions for license parsing, validation, and formatting.
 * Used by both main and renderer processes.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * License file structure from the web portal
 */
export interface LicenseFile {
  license_code: string;
  user_id: string;
  email: string;
  expires_at: number; // Unix timestamp in seconds
  subscription_status: string;
  subscription_plan?: string;
  subscription_id?: string;
  created_at?: number;
}

/**
 * Result of license validation
 */
export interface LicenseValidationResult {
  valid: boolean;
  expired: boolean;
  daysRemaining: number | null;
  license?: LicenseFile;
  error?: string;
}

/**
 * Result of license file parsing
 */
export interface LicenseParseResult {
  success: boolean;
  data?: LicenseFile;
  error?: string;
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format license code for display (e.g., "X7UH4C9ZEVZ7" -> "X7U-H4C-9ZE-VZ7")
 */
export function formatLicenseCode(code: string): string {
  // Remove all non-alphanumeric characters and convert to uppercase
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Split into groups of 3 and join with dashes
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length && i < 12; i += 3) {
    groups.push(cleaned.slice(i, i + 3));
  }

  return groups.join('-');
}

/**
 * Normalize license code (remove formatting, uppercase)
 */
export function normalizeLicenseCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Format expiration date for display
 */
export function formatExpirationDate(expiresAt: number): string {
  const date = new Date(expiresAt * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Get remaining time until expiration as human-readable string
 */
export function getTimeUntilExpiration(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;

  if (remaining <= 0) {
    return 'Expired';
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  }
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a license file content string into a LicenseFile object
 */
export function parseLicenseFile(content: string): LicenseParseResult {
  try {
    const data = JSON.parse(content);

    // Check if it's an object
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { success: false, error: 'Invalid license file format' };
    }

    return { success: true, data: data as LicenseFile };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof SyntaxError
          ? 'Invalid JSON format in license file'
          : 'Failed to parse license file',
    };
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Required fields for a valid license
 */
const REQUIRED_LICENSE_FIELDS: (keyof LicenseFile)[] = [
  'license_code',
  'user_id',
  'email',
  'expires_at',
  'subscription_status',
];

/**
 * Validate required fields in a license file
 */
export function validateLicenseFields(data: LicenseFile): string | null {
  for (const field of REQUIRED_LICENSE_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  // Type validations
  if (
    typeof data.license_code !== 'string' ||
    data.license_code.trim() === ''
  ) {
    return 'Invalid license_code: must be a non-empty string';
  }

  if (typeof data.user_id !== 'string' || data.user_id.trim() === '') {
    return 'Invalid user_id: must be a non-empty string';
  }

  if (typeof data.email !== 'string' || !data.email.includes('@')) {
    return 'Invalid email: must be a valid email address';
  }

  if (typeof data.expires_at !== 'number' || data.expires_at <= 0) {
    return 'Invalid expires_at: must be a positive Unix timestamp';
  }

  if (typeof data.subscription_status !== 'string') {
    return 'Invalid subscription_status: must be a string';
  }

  return null; // All validations passed
}

/**
 * Check if a license is expired
 */
export function isLicenseExpired(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt;
}

/**
 * Calculate days remaining until license expiration
 */
export function calculateDaysRemaining(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;
  return Math.max(0, Math.floor(remaining / 86400));
}

/**
 * Calculate days since license expired (for expired licenses)
 */
export function calculateDaysExpired(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  if (now < expiresAt) return 0;
  return Math.floor((now - expiresAt) / 86400);
}

/**
 * Validate a license file and check expiration
 */
export function validateLicenseFile(data: LicenseFile): LicenseValidationResult {
  // 1. Validate required fields
  const fieldError = validateLicenseFields(data);
  if (fieldError) {
    return {
      valid: false,
      expired: false,
      daysRemaining: null,
      error: fieldError,
    };
  }

  // 2. Check subscription status
  if (data.subscription_status !== 'active') {
    return {
      valid: false,
      expired: false,
      daysRemaining: null,
      license: data,
      error: `License status is "${data.subscription_status}". An active subscription is required.`,
    };
  }

  // 3. Check expiration
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = data.expires_at;

  if (now >= expiresAt) {
    const daysExpired = calculateDaysExpired(expiresAt);
    return {
      valid: false,
      expired: true,
      daysRemaining: 0,
      license: data,
      error: `License expired ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago. Please renew your subscription.`,
    };
  }

  // 4. Calculate days remaining
  const daysRemaining = calculateDaysRemaining(expiresAt);

  return {
    valid: true,
    expired: false,
    daysRemaining,
    license: data,
  };
}

/**
 * Parse and validate a license file in one step
 */
export function importLicenseFile(content: string): LicenseValidationResult {
  // Parse the file
  const parseResult = parseLicenseFile(content);

  if (!parseResult.success || !parseResult.data) {
    return {
      valid: false,
      expired: false,
      daysRemaining: null,
      error: parseResult.error || 'Failed to parse license file',
    };
  }

  // Validate the license
  return validateLicenseFile(parseResult.data);
}

// ============================================================================
// License Status Helpers
// ============================================================================

/**
 * Get license status summary for display
 */
export function getLicenseStatusSummary(license: LicenseFile): {
  status: 'valid' | 'expired' | 'inactive';
  message: string;
  daysRemaining: number | null;
} {
  if (license.subscription_status !== 'active') {
    return {
      status: 'inactive',
      message: `Subscription status: ${license.subscription_status}`,
      daysRemaining: null,
    };
  }

  if (isLicenseExpired(license.expires_at)) {
    const daysExpired = calculateDaysExpired(license.expires_at);
    return {
      status: 'expired',
      message: `Expired ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago`,
      daysRemaining: 0,
    };
  }

  const daysRemaining = calculateDaysRemaining(license.expires_at);
  return {
    status: 'valid',
    message:
      daysRemaining === 0
        ? 'Expires today'
        : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`,
    daysRemaining,
  };
}
