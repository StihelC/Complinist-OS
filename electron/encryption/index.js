/**
 * Encryption Module Index
 * Exports all encryption-related functionality
 */
export {
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
} from './key-manager.js';

export {
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
} from './encryption-service.js';

// Default export with commonly used functions
import keyManager from './key-manager.js';
import encryptionService from './encryption-service.js';

export default {
  keyManager,
  encryptionService,
};
