/**
 * Encryption Service
 * Provides encryption/decryption services for sensitive database fields
 *
 * This service acts as a layer between the database repositories and the key manager,
 * handling the encryption of sensitive compliance data including:
 * - SSP metadata (organization names, emails, security classifications)
 * - Control narratives (implementation details, system descriptions)
 * - Device information (IP addresses, serial numbers, security configurations)
 */
import keyManager from './key-manager.js';

// Define which fields should be encrypted for each table
export const ENCRYPTED_FIELDS = {
  ssp_metadata: [
    'organization_name',
    'prepared_by',
    'system_description',
    'system_purpose',
    'information_type_title',
    'information_type_description',
    'authorization_boundary_description',
    'system_owner',
    'system_owner_email',
    'authorizing_official',
    'authorizing_official_email',
    'security_contact',
    'security_contact_email',
    'physical_location',
    'data_types_processed',
    'users_description',
    'on_premises_details',
    'cloud_provider',
    'custom_sections',
    'topology_screenshot',
  ],

  control_narratives: [
    'narrative',
    'system_implementation',
  ],

  devices: [
    'ip_address',
    'mac_address',
    'hostname',
    'dns_servers',
    'serial_number',
    'firmware_version',
    'system_owner',
    'owner',
    'contact_email',
    'notes',
    'control_notes',
  ],

  // License encryption is handled specially - we don't encrypt license_code
  // since it's used for key derivation
  licenses: [
    // 'license_code', - NOT encrypted (used for key derivation)
    // 'user_id', - NOT encrypted (used for key derivation)
    // 'email', - Keep unencrypted for display
  ],
};

/**
 * Check if encryption is available
 * @returns {boolean}
 */
export function isEncryptionAvailable() {
  return keyManager.isKeyManagerInitialized();
}

/**
 * Encrypt a single value if encryption is available
 * @param {*} value - Value to encrypt
 * @returns {*} Encrypted value or original if encryption unavailable
 */
export function encryptValue(value) {
  if (!isEncryptionAvailable()) {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  return keyManager.encrypt(String(value));
}

/**
 * Decrypt a single value if encryption is available
 * @param {*} value - Value to decrypt
 * @returns {*} Decrypted value or original if encryption unavailable
 */
export function decryptValue(value) {
  if (!isEncryptionAvailable()) {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  return keyManager.decrypt(value);
}

/**
 * Encrypt fields for a specific table
 * @param {string} tableName - Name of the table
 * @param {Object} data - Data object to encrypt
 * @returns {Object} Data with encrypted fields
 */
export function encryptForTable(tableName, data) {
  if (!isEncryptionAvailable()) {
    return data;
  }

  const fields = ENCRYPTED_FIELDS[tableName];
  if (!fields || fields.length === 0) {
    return data;
  }

  return keyManager.encryptFields(data, fields);
}

/**
 * Decrypt fields for a specific table
 * @param {string} tableName - Name of the table
 * @param {Object} data - Data object to decrypt
 * @returns {Object} Data with decrypted fields
 */
export function decryptForTable(tableName, data) {
  if (!isEncryptionAvailable()) {
    return data;
  }

  const fields = ENCRYPTED_FIELDS[tableName];
  if (!fields || fields.length === 0) {
    return data;
  }

  return keyManager.decryptFields(data, fields);
}

/**
 * Decrypt an array of records for a specific table
 * @param {string} tableName - Name of the table
 * @param {Object[]} records - Array of records to decrypt
 * @returns {Object[]} Array with decrypted records
 */
export function decryptArrayForTable(tableName, records) {
  if (!records || !Array.isArray(records)) {
    return records;
  }

  if (!isEncryptionAvailable()) {
    return records;
  }

  return records.map(record => decryptForTable(tableName, record));
}

/**
 * Encrypt SSP metadata
 * @param {Object} metadata - SSP metadata object
 * @returns {Object} Encrypted metadata
 */
export function encryptSSPMetadata(metadata) {
  return encryptForTable('ssp_metadata', metadata);
}

/**
 * Decrypt SSP metadata
 * @param {Object} metadata - Encrypted SSP metadata object
 * @returns {Object} Decrypted metadata
 */
export function decryptSSPMetadata(metadata) {
  return decryptForTable('ssp_metadata', metadata);
}

/**
 * Encrypt control narrative
 * @param {Object} narrative - Control narrative object
 * @returns {Object} Encrypted narrative
 */
export function encryptControlNarrative(narrative) {
  return encryptForTable('control_narratives', narrative);
}

/**
 * Decrypt control narrative
 * @param {Object} narrative - Encrypted control narrative object
 * @returns {Object} Decrypted narrative
 */
export function decryptControlNarrative(narrative) {
  return decryptForTable('control_narratives', narrative);
}

/**
 * Decrypt array of control narratives
 * @param {Object[]} narratives - Array of encrypted narratives
 * @returns {Object[]} Decrypted narratives
 */
export function decryptControlNarratives(narratives) {
  return decryptArrayForTable('control_narratives', narratives);
}

/**
 * Encrypt device data
 * @param {Object} device - Device object
 * @returns {Object} Encrypted device
 */
export function encryptDevice(device) {
  return encryptForTable('devices', device);
}

/**
 * Decrypt device data
 * @param {Object} device - Encrypted device object
 * @returns {Object} Decrypted device
 */
export function decryptDevice(device) {
  return decryptForTable('devices', device);
}

/**
 * Decrypt array of devices
 * @param {Object[]} devices - Array of encrypted devices
 * @returns {Object[]} Decrypted devices
 */
export function decryptDevices(devices) {
  return decryptArrayForTable('devices', devices);
}

/**
 * Get encryption status including which tables are protected
 * @returns {Object} Encryption status
 */
export function getEncryptionServiceStatus() {
  const keyStatus = keyManager.getEncryptionStatus();
  return {
    ...keyStatus,
    available: isEncryptionAvailable(),
    protectedTables: Object.keys(ENCRYPTED_FIELDS),
    fieldCounts: Object.fromEntries(
      Object.entries(ENCRYPTED_FIELDS).map(([table, fields]) => [table, fields.length])
    ),
  };
}

export default {
  isEncryptionAvailable,
  encryptValue,
  decryptValue,
  encryptForTable,
  decryptForTable,
  decryptArrayForTable,
  encryptSSPMetadata,
  decryptSSPMetadata,
  encryptControlNarrative,
  decryptControlNarrative,
  decryptControlNarratives,
  encryptDevice,
  decryptDevice,
  decryptDevices,
  getEncryptionServiceStatus,
  ENCRYPTED_FIELDS,
};
