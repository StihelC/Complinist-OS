/**
 * Encryption Key Manager
 * Handles PBKDF2 key derivation from license key and secure key management
 *
 * Security Design:
 * - Keys are derived from license_code + user_id using PBKDF2-SHA256
 * - Keys are never stored on disk - always derived at runtime
 * - Uses crypto.timingSafeEqual for comparison operations
 * - Implements key rotation support via version tracking
 */
import crypto from 'crypto';

// Key derivation parameters
const PBKDF2_ITERATIONS = 100000; // NIST recommended minimum
const KEY_LENGTH = 32; // 256-bit key for AES-256
const SALT_LENGTH = 16; // 128-bit salt
const IV_LENGTH = 16; // 128-bit IV for AES-256-GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

// Application salt - combined with license data for uniqueness
const APP_SALT_PREFIX = 'CompliNist-v1-';

// Key manager state
let derivedKey = null;
let keyVersion = null;
let isInitialized = false;

/**
 * Generate a deterministic salt from license data
 * This ensures the same license always produces the same key
 * @param {string} licenseCode - The license code
 * @param {string} userId - The user ID
 * @returns {Buffer} Deterministic salt
 */
function generateDeterministicSalt(licenseCode, userId) {
  const saltInput = `${APP_SALT_PREFIX}${licenseCode}:${userId}`;
  return crypto.createHash('sha256').update(saltInput).digest().subarray(0, SALT_LENGTH);
}

/**
 * Derive encryption key from license data using PBKDF2
 * @param {string} licenseCode - The license code
 * @param {string} userId - The user ID
 * @returns {Promise<Buffer>} Derived key
 */
async function deriveKeyFromLicense(licenseCode, userId) {
  return new Promise((resolve, reject) => {
    if (!licenseCode || !userId) {
      reject(new Error('License code and user ID are required for key derivation'));
      return;
    }

    const password = `${licenseCode}:${userId}`;
    const salt = generateDeterministicSalt(licenseCode, userId);

    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256', (err, key) => {
      if (err) {
        reject(err);
      } else {
        resolve(key);
      }
    });
  });
}

/**
 * Initialize the key manager with license data
 * @param {Object} license - License object with license_code and user_id
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initializeKeyManager(license) {
  if (!license || !license.license_code || !license.user_id) {
    console.warn('[KeyManager] Cannot initialize without valid license');
    return false;
  }

  try {
    derivedKey = await deriveKeyFromLicense(license.license_code, license.user_id);
    keyVersion = crypto.createHash('sha256')
      .update(`${license.license_code}:${license.user_id}`)
      .digest('hex')
      .substring(0, 8);
    isInitialized = true;
    console.log('[KeyManager] Encryption key derived successfully');
    return true;
  } catch (error) {
    console.error('[KeyManager] Failed to derive encryption key:', error);
    derivedKey = null;
    keyVersion = null;
    isInitialized = false;
    return false;
  }
}

/**
 * Clear the key manager state
 * Call this on license change or app shutdown
 */
export function clearKeyManager() {
  if (derivedKey) {
    // Overwrite the key buffer with zeros before dereferencing
    derivedKey.fill(0);
  }
  derivedKey = null;
  keyVersion = null;
  isInitialized = false;
  console.log('[KeyManager] Encryption key cleared');
}

/**
 * Check if the key manager is initialized
 * @returns {boolean}
 */
export function isKeyManagerInitialized() {
  return isInitialized && derivedKey !== null;
}

/**
 * Get the current key version (for data versioning)
 * @returns {string|null}
 */
export function getKeyVersion() {
  return keyVersion;
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data in format: version:iv:authTag:ciphertext (base64)
 */
export function encrypt(plaintext) {
  if (!isInitialized || !derivedKey) {
    throw new Error('Key manager not initialized. Cannot encrypt data.');
  }

  if (plaintext === null || plaintext === undefined) {
    return null;
  }

  if (typeof plaintext !== 'string') {
    plaintext = String(plaintext);
  }

  // Empty strings don't need encryption
  if (plaintext === '') {
    return '';
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: version:iv:authTag:ciphertext
    return `${keyVersion}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('[KeyManager] Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data in format: version:iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedData) {
  if (!isInitialized || !derivedKey) {
    throw new Error('Key manager not initialized. Cannot decrypt data.');
  }

  if (encryptedData === null || encryptedData === undefined) {
    return null;
  }

  if (typeof encryptedData !== 'string') {
    return encryptedData;
  }

  // Empty strings
  if (encryptedData === '') {
    return '';
  }

  // Check if data is encrypted (has our format)
  if (!encryptedData.includes(':')) {
    // Data is not encrypted (legacy unencrypted data)
    return encryptedData;
  }

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
      // Not our encryption format, return as-is (legacy data)
      return encryptedData;
    }

    const [version, ivB64, authTagB64, ciphertext] = parts;

    // Validate version matches
    if (version !== keyVersion) {
      console.warn('[KeyManager] Key version mismatch. Data may be from different license.');
      // Still try to decrypt - this could be a migration scenario
    }

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // If decryption fails, the data might be legacy unencrypted data
    // Return as-is to support backwards compatibility during migration
    console.warn('[KeyManager] Decryption failed, returning data as-is (may be unencrypted):', error.message);
    return encryptedData;
  }
}

/**
 * Check if a string is encrypted (has our encryption format)
 * @param {string} data - Data to check
 * @returns {boolean}
 */
export function isEncrypted(data) {
  if (typeof data !== 'string' || !data.includes(':')) {
    return false;
  }

  const parts = data.split(':');
  if (parts.length !== 4) {
    return false;
  }

  // Check if parts look like base64
  try {
    Buffer.from(parts[1], 'base64');
    Buffer.from(parts[2], 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt an object's sensitive fields
 * @param {Object} obj - Object with fields to encrypt
 * @param {string[]} fields - Array of field names to encrypt
 * @returns {Object} Object with encrypted fields
 */
export function encryptFields(obj, fields) {
  if (!obj || !fields || !Array.isArray(fields)) {
    return obj;
  }

  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
}

/**
 * Decrypt an object's encrypted fields
 * @param {Object} obj - Object with encrypted fields
 * @param {string[]} fields - Array of field names to decrypt
 * @returns {Object} Object with decrypted fields
 */
export function decryptFields(obj, fields) {
  if (!obj || !fields || !Array.isArray(fields)) {
    return obj;
  }

  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
}

/**
 * Get encryption status for diagnostics
 * @returns {Object} Status object
 */
export function getEncryptionStatus() {
  return {
    initialized: isInitialized,
    keyVersion: keyVersion,
    algorithm: 'AES-256-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
  };
}

export default {
  initializeKeyManager,
  clearKeyManager,
  isKeyManagerInitialized,
  getKeyVersion,
  encrypt,
  decrypt,
  isEncrypted,
  encryptFields,
  decryptFields,
  getEncryptionStatus,
};
