/**
 * Database module - re-exports from modules/database-init.js (single source of truth).
 * Use this for DI and IPC; app-lifecycle already calls initDatabase from database-init.js.
 */
export {
  initDatabase,
  getDatabase,
  syncDevicesToTable,
  enrichNodesWithDeviceMetadata,
  migrateDeviceTypes,
} from '../modules/database-init.js';
