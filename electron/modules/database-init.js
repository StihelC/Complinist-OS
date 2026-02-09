/**
 * Database Initialization Module
 * Handles SQLite database setup, schema creation, and migrations
 */
import { app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import fs from 'fs';
import { execSync } from 'child_process';
import { getDbPath } from '../path-resolver.js';
import { getRepositories as getRepos, clearRepositoryCache } from '../database/repositories/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database instance (singleton)
let db = null;

// Debug logging
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG;
const debugLog = (...args) => { if (isDev) console.log(...args); };

/**
 * Get the database instance
 * @returns {Database} The SQLite database instance
 */
export function getDatabase() {
  return db;
}

/**
 * Initialize the SQLite database
 * Creates tables, runs migrations, and sets up the schema
 * Uses path-resolver for DB path (portable: exe dir, else userData).
 * Idempotent: safe to call multiple times (e.g. from app-lifecycle and DI).
 */
export function initDatabase() {
  if (db) {
    return db;
  }
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Create core tables
  createCoreTables();

  // Run schema migrations
  runMigrations();

  // Migrate existing data
  migrateExistingData();

  console.log('Database initialized at:', dbPath);
  return db;
}

/**
 * Create core database tables
 */
function createCoreTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      baseline TEXT NOT NULL DEFAULT 'MODERATE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      viewport TEXT,
      compliance_data TEXT,
      report_metadata TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_diagrams_project_id ON diagrams(project_id);

    CREATE TABLE IF NOT EXISTS ssp_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      organization_name TEXT,
      prepared_by TEXT,
      system_description TEXT,
      system_purpose TEXT,
      deployment_model TEXT,
      service_model TEXT,
      information_type_title TEXT,
      information_type_description TEXT,
      confidentiality_impact TEXT DEFAULT 'moderate',
      integrity_impact TEXT DEFAULT 'moderate',
      availability_impact TEXT DEFAULT 'moderate',
      authorization_boundary_description TEXT,
      system_status TEXT DEFAULT 'operational',
      system_owner TEXT,
      system_owner_email TEXT,
      authorizing_official TEXT,
      authorizing_official_email TEXT,
      security_contact TEXT,
      security_contact_email TEXT,
      physical_location TEXT,
      data_types_processed TEXT,
      users_description TEXT,
      unedited_controls_mode TEXT DEFAULT 'placeholder',
      on_premises_details TEXT,
      cloud_provider TEXT,
      topology_screenshot TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id)
    );

    CREATE TABLE IF NOT EXISTS control_narratives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      control_id TEXT NOT NULL,
      narrative TEXT,
      system_implementation TEXT,
      implementation_status TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, control_id),
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_control_narratives_project_control
      ON control_narratives(project_id, control_id);

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT NOT NULL,
      project_id INTEGER NOT NULL,

      -- Basic Info
      name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      device_subtype TEXT,
      icon_path TEXT,

      -- Network Info
      ip_address TEXT,
      mac_address TEXT,
      subnet_mask TEXT,
      default_gateway TEXT,
      hostname TEXT,
      dns_servers TEXT,
      vlan_id TEXT,
      ports TEXT,

      -- Hardware Info
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      firmware_version TEXT,
      operating_system TEXT,
      os_version TEXT,
      software TEXT,
      cpu_model TEXT,
      memory_size TEXT,
      storage_size TEXT,

      -- Security Classification
      security_zone TEXT,
      asset_value TEXT,
      mission_critical INTEGER DEFAULT 0,
      data_classification TEXT,

      -- Security Posture
      multifactor_auth INTEGER DEFAULT 0,
      encryption_at_rest INTEGER DEFAULT 0,
      encryption_in_transit INTEGER DEFAULT 0,
      encryption_status TEXT,
      backups_configured INTEGER DEFAULT 0,
      monitoring_enabled INTEGER DEFAULT 0,
      vulnerability_management TEXT,
      risk_level TEXT,
      criticality TEXT,
      firewall_enabled INTEGER DEFAULT 0,
      antivirus_enabled INTEGER DEFAULT 0,
      patch_level TEXT,
      last_patch_date TEXT,

      -- Compliance
      applicable_controls TEXT,
      last_vuln_scan TEXT,
      compliance_status TEXT,
      assigned_controls TEXT,

      -- Ownership
      system_owner TEXT,
      owner TEXT,
      department TEXT,
      contact_email TEXT,
      location TEXT,
      cost_center TEXT,
      purchase_date TEXT,
      warranty_expiration TEXT,

      -- Additional Metadata
      notes TEXT,
      tags TEXT,
      status TEXT,
      control_notes TEXT,

      -- Visual Configuration
      label TEXT,
      label_fields TEXT,
      device_image_size INTEGER,

      -- Timestamps
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_devices_project_id ON devices(project_id);
    CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
    CREATE INDEX IF NOT EXISTS idx_devices_manufacturer ON devices(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location);
    CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      subscription_status TEXT NOT NULL,
      subscription_plan TEXT,
      subscription_id TEXT,
      created_at INTEGER,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_types (
      icon_path TEXT PRIMARY KEY,
      device_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      it_category TEXT NOT NULL,
      network_layer TEXT NOT NULL DEFAULT 'Application',
      device_subtype TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_device_types_device_type ON device_types(device_type);
    CREATE INDEX IF NOT EXISTS idx_device_types_category ON device_types(it_category);
    CREATE INDEX IF NOT EXISTS idx_device_types_network_layer ON device_types(network_layer);
  `);
}

/**
 * Run schema migrations to add new columns
 */
function runMigrations() {
  ensureProjectBaselineColumn();
  ensureControlNarrativesSystemImplementationColumn();
  ensureSSPMetadataSelectedControlIdsColumn();
  ensureSSPMetadataCustomSectionsColumn();
  ensureSSPMetadataTopologyScreenshotColumn();
  ensureSSPMetadataOrganizationNameColumn();
  ensureSSPMetadataPreparedByColumn();
  ensureDevicesTable();
}

/**
 * Migrate existing data
 */
function migrateExistingData() {
  // Migrate existing devices from diagrams to devices table
  migrateExistingDevices();

  // Migrate device types from TypeScript file to database if table is empty
  migrateDeviceTypes();

  // Scan all SVG files and ensure each has a device_types entry (1:1 mapping)
  scanAllIconsAndSyncToDeviceTypes();
}

// ============== Schema Migration Functions ==============

function ensureProjectBaselineColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(projects)').all();
    const hasBaseline = columns.some((column) => column.name === 'baseline');
    if (!hasBaseline) {
      db.prepare("ALTER TABLE projects ADD COLUMN baseline TEXT NOT NULL DEFAULT 'MODERATE'").run();
      db.prepare("UPDATE projects SET baseline = 'MODERATE' WHERE baseline IS NULL OR baseline = ''").run();
    }
  } catch (error) {
    console.error('Failed to ensure baseline column on projects table:', error);
  }
}

function ensureControlNarrativesSystemImplementationColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(control_narratives)').all();
    const hasSystemImplementation = columns.some((column) => column.name === 'system_implementation');
    if (!hasSystemImplementation) {
      db.prepare('ALTER TABLE control_narratives ADD COLUMN system_implementation TEXT').run();
      db.prepare(`
        UPDATE control_narratives
        SET system_implementation = narrative
        WHERE (system_implementation IS NULL OR system_implementation = '')
          AND narrative IS NOT NULL
      `).run();
    }
  } catch (error) {
    console.error('Failed to ensure system implementation column on control_narratives table:', error);
  }
}

function ensureSSPMetadataSelectedControlIdsColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(ssp_metadata)').all();
    const hasSelectedControlIds = columns.some((column) => column.name === 'selected_control_ids');
    if (!hasSelectedControlIds) {
      db.prepare('ALTER TABLE ssp_metadata ADD COLUMN selected_control_ids TEXT').run();
      console.log('Added selected_control_ids column to ssp_metadata table');
    }
  } catch (error) {
    console.error('Failed to ensure selected_control_ids column on ssp_metadata table:', error);
  }
}

function ensureSSPMetadataCustomSectionsColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(ssp_metadata)').all();
    const hasCustomSections = columns.some((column) => column.name === 'custom_sections');
    if (!hasCustomSections) {
      db.prepare("ALTER TABLE ssp_metadata ADD COLUMN custom_sections TEXT DEFAULT '[]'").run();
      console.log('Added custom_sections column to ssp_metadata table');
    }
  } catch (error) {
    console.error('Failed to ensure custom_sections column on ssp_metadata table:', error);
  }
}

function ensureSSPMetadataTopologyScreenshotColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(ssp_metadata)').all();
    const hasTopologyScreenshot = columns.some((column) => column.name === 'topology_screenshot');
    if (!hasTopologyScreenshot) {
      db.prepare('ALTER TABLE ssp_metadata ADD COLUMN topology_screenshot TEXT').run();
      console.log('Added topology_screenshot column to ssp_metadata table');
    }
  } catch (error) {
    console.error('Failed to ensure topology_screenshot column on ssp_metadata table:', error);
  }
}

function ensureSSPMetadataOrganizationNameColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(ssp_metadata)').all();
    const hasOrganizationName = columns.some((column) => column.name === 'organization_name');
    if (!hasOrganizationName) {
      db.prepare('ALTER TABLE ssp_metadata ADD COLUMN organization_name TEXT').run();
      console.log('Added organization_name column to ssp_metadata table');
    }
  } catch (error) {
    console.error('Failed to ensure organization_name column on ssp_metadata table:', error);
  }
}

function ensureSSPMetadataPreparedByColumn() {
  try {
    const columns = db.prepare('PRAGMA table_info(ssp_metadata)').all();
    const hasPreparedBy = columns.some((column) => column.name === 'prepared_by');
    if (!hasPreparedBy) {
      db.prepare('ALTER TABLE ssp_metadata ADD COLUMN prepared_by TEXT').run();
      console.log('Added prepared_by column to ssp_metadata table');
    }
  } catch (error) {
    console.error('Failed to ensure prepared_by column on ssp_metadata table:', error);
  }
}

function ensureDevicesTable() {
  try {
    // Check if devices table exists by querying sqlite_master
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='devices'
    `).get();

    if (!tableExists) {
      // Table is created in createCoreTables, so we just log
      console.log('Devices table will be created in core tables');
    }
  } catch (error) {
    console.error('Failed to ensure devices table:', error);
  }
}

// ============== Data Migration Functions ==============

/**
 * Migrate existing devices from diagrams to devices table
 */
function migrateExistingDevices() {
  try {
    // Check if devices table has any data
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get();
    if (deviceCount.count > 0) {
      // Devices table already has data, skip migration
      return;
    }

    // Get all projects with diagrams
    const diagrams = db.prepare('SELECT project_id, nodes FROM diagrams').all();

    if (diagrams.length === 0) {
      return;
    }

    console.log(`Migrating devices from ${diagrams.length} diagram(s)...`);
    let migratedCount = 0;

    for (const diagram of diagrams) {
      try {
        const nodes = JSON.parse(diagram.nodes);
        if (Array.isArray(nodes) && nodes.length > 0) {
          syncDevicesToTable(diagram.project_id, nodes);
          const deviceNodes = nodes.filter(node => (node.type === 'device' || !node.type) && node.data);
          migratedCount += deviceNodes.length;
        }
      } catch (error) {
        console.error(`Error migrating devices for project ${diagram.project_id}:`, error);
      }
    }

    console.log(`Migration complete: ${migratedCount} device(s) migrated`);
  } catch (error) {
    console.error('Error during device migration:', error);
  }
}

/**
 * Migrate device types from TypeScript mapping file to database
 */
export function migrateDeviceTypes() {
  try {
    // Check if device_types table has any data
    const deviceTypeCount = db.prepare('SELECT COUNT(*) as count FROM device_types').get();
    if (deviceTypeCount.count > 0) {
      // Device types table already has data - migration already completed
      console.log(`Device types table already has ${deviceTypeCount.count} entries`);
      return;
    }

    console.log('Device types table is empty, running migration...');

    // Read deviceIconMapping.ts
    const mappingFile = path.join(__dirname, '../../src/lib/utils/deviceIconMapping.ts');
    if (!fs.existsSync(mappingFile)) {
      console.warn('Device icon mapping file not found, skipping migration');
      return;
    }

    let content = fs.readFileSync(mappingFile, 'utf8');

    // Extract the deviceIconMapping object
    let mappingStart = content.indexOf('export const deviceIconMapping: Record<string, DeviceIconMetadata> = {');
    if (mappingStart === -1) {
      console.log('Device icon mapping object not found in current file, trying git...');
      try {
        const projectRoot = path.join(__dirname, '../..');
        content = execSync('git show HEAD:src/lib/utils/deviceIconMapping.ts', {
          encoding: 'utf8',
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 10 * 1024 * 1024
        });
        mappingStart = content.indexOf('export const deviceIconMapping: Record<string, DeviceIconMetadata> = {');
        if (mappingStart === -1) {
          console.log('Device icon mapping object not found in git either');
          return;
        }
      } catch (error) {
        console.error('Could not read from git:', error.message);
        return;
      }
    }

    const mappingEnd = content.indexOf('};', mappingStart);
    if (mappingEnd === -1) {
      console.warn('Could not find end of deviceIconMapping object');
      return;
    }

    const mappingContent = content.substring(mappingStart, mappingEnd + 2);
    const entries = [];
    const entryRegex = /'([^']+)':\s*\{[^}]*deviceType:\s*['"]([^'"]+)['"][^}]*displayName:\s*['"]([^'"]+)['"][^}]*itCategory:\s*['"]([^'"]+)['"][^}]*networkLayer:\s*['"]([^'"]+)['"]/gs;

    let match;
    while ((match = entryRegex.exec(mappingContent)) !== null) {
      const [, iconPath, deviceType, displayName, itCategory, networkLayer] = match;
      const subtypeMatch = mappingContent.substring(match.index, match.index + 500).match(/deviceSubtype:\s*['"]([^'"]+)['"]/);
      const deviceSubtype = subtypeMatch ? subtypeMatch[1] : null;
      const convertedIconPath = convertOldPathToNew(iconPath);

      entries.push({
        icon_path: convertedIconPath,
        device_type: deviceType,
        display_name: displayName,
        it_category: itCategory,
        network_layer: networkLayer,
        device_subtype: deviceSubtype,
      });
    }

    if (entries.length === 0) {
      console.warn('No device type entries found in mapping file');
      return;
    }

    console.log(`Found ${entries.length} device type entries, inserting into database...`);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO device_types
        (icon_path, device_type, display_name, it_category, network_layer, device_subtype, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertMany = db.transaction((entries) => {
      for (const entry of entries) {
        insertStmt.run(
          entry.icon_path,
          entry.device_type,
          entry.display_name,
          entry.it_category,
          entry.network_layer,
          entry.device_subtype
        );
      }
    });

    insertMany(entries);

    const finalCount = db.prepare('SELECT COUNT(*) as count FROM device_types').get().count;
    console.log(`Device types migration complete: ${finalCount} entries in database`);

    updateIconPaths();
  } catch (error) {
    console.error('Error during device types migration:', error);
  }
}

/**
 * Scan all SVG files in Icons folder and ensure each has a device_types entry
 */
function scanAllIconsAndSyncToDeviceTypes() {
  try {
    // Check if device_types table already has data - skip if migration already completed
    const deviceTypeCount = db.prepare('SELECT COUNT(*) as count FROM device_types').get();
    if (deviceTypeCount.count > 0) {
      // Database already has entries - sync already completed
      return;
    }

    debugLog('[scanAllIconsAndSyncToDeviceTypes] Scanning all SVG files...');
    const iconsDir = path.join(__dirname, '../../src/Icons');

    if (!fs.existsSync(iconsDir)) {
      console.warn('Icons directory not found:', iconsDir);
      return;
    }

    const svgFiles = scanAllIconsRecursive(iconsDir, path.join(__dirname, '../../src/Icons'));
    debugLog(`Found ${svgFiles.length} SVG files`);

    const existingIconPaths = new Set(svgFiles.map(f => f.iconPath));
    const allDbEntries = db.prepare('SELECT icon_path FROM device_types').all();
    const dbIconPaths = new Set(allDbEntries.map(row => row.icon_path));

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO device_types
        (icon_path, device_type, display_name, it_category, network_layer, device_subtype, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const deleteStmt = db.prepare('DELETE FROM device_types WHERE icon_path = ?');

    let newEntries = 0;
    let deletedEntries = 0;

    for (const svgFile of svgFiles) {
      const { iconPath, filename } = svgFile;
      const fullPath = path.join(__dirname, '../..', iconPath);
      if (!fs.existsSync(fullPath)) continue;

      const deviceType = deriveDeviceTypeFromFilename(filename);
      const displayName = deriveDisplayNameFromFilename(filename);
      const itCategory = inferITCategoryFromPath(iconPath);

      if (!deviceType || !displayName) continue;

      const exists = dbIconPaths.has(iconPath);

      try {
        insertStmt.run(iconPath, deviceType, displayName, itCategory, 'Application', null);
        if (!exists) newEntries++;
      } catch (error) {
        console.error(`Error inserting ${iconPath}:`, error);
      }
    }

    for (const dbPath of dbIconPaths) {
      if (!existingIconPaths.has(dbPath)) {
        const fullPath = path.join(__dirname, '../..', dbPath);
        if (!fs.existsSync(fullPath)) {
          try {
            deleteStmt.run(dbPath);
            deletedEntries++;
          } catch (error) {
            console.error(`Error deleting ${dbPath}:`, error);
          }
        }
      }
    }

    if (newEntries > 0) console.log(`Added ${newEntries} new device type entries from SVG files`);
    if (deletedEntries > 0) console.log(`Removed ${deletedEntries} entries for files that no longer exist`);
  } catch (error) {
    console.error('Error scanning icons and syncing to device_types:', error);
  }
}

// ============== Helper Functions ==============

const categoryMapping = {
  'ai + machine learning': { provider: 'Azure', category: 'Ai-Ml' },
  'analytics': { provider: 'Azure', category: 'Analytics' },
  'app services': { provider: 'Azure', category: 'Application-Integration' },
  'azure ecosystem': { provider: 'Azure', category: 'Other' },
  'azure stack': { provider: 'Azure', category: 'Management-Governance' },
  'blockchain': { provider: 'Other', category: 'Miscellaneous' },
  'compute': { provider: 'Azure', category: 'Compute' },
  'containers': { provider: 'Azure', category: 'Compute' },
  'databases': { provider: 'Azure', category: 'Databases' },
  'devops': { provider: 'Azure', category: 'Developer-Tools' },
  'general': { provider: 'Other', category: 'Cloud-Services' },
  'hybrid + multicloud': { provider: 'Azure', category: 'Other' },
  'identity': { provider: 'Azure', category: 'Security-Identity' },
  'integration': { provider: 'Azure', category: 'Application-Integration' },
  'intune': { provider: 'Azure', category: 'Management-Governance' },
  'iot': { provider: 'Azure', category: 'Iot-Edge' },
  'management + governance': { provider: 'Azure', category: 'Management-Governance' },
  'menu': { provider: 'Other', category: 'Miscellaneous' },
  'migrate': { provider: 'Azure', category: 'Other' },
  'migration': { provider: 'Azure', category: 'Other' },
  'mixed reality': { provider: 'Other', category: 'Miscellaneous' },
  'mobile': { provider: 'Other', category: 'Miscellaneous' },
  'monitor': { provider: 'Azure', category: 'Management-Governance' },
  'networking': { provider: 'Azure', category: 'Networking' },
  'new icons': { provider: 'Other', category: 'Miscellaneous' },
  'other': { provider: 'Other', category: 'Miscellaneous' },
  'security': { provider: 'Azure', category: 'Security-Identity' },
  'storage': { provider: 'Azure', category: 'Storage' },
  'web': { provider: 'Azure', category: 'Application-Integration' },
};

function convertOldPathToNew(oldPath) {
  if (!oldPath || !oldPath.startsWith('src/iconpack/icons/')) {
    return oldPath;
  }

  const parts = oldPath.replace('src/iconpack/icons/', '').split('/');
  if (parts.length < 2) return oldPath;

  const oldCategory = parts[0];
  const filename = parts[parts.length - 1];

  const mapping = categoryMapping[oldCategory.toLowerCase()];
  if (mapping) {
    return `src/Icons/${mapping.provider}/${mapping.category}/${filename}`;
  }

  const iconsDir = path.join(__dirname, '../../src/Icons');
  if (fs.existsSync(iconsDir)) {
    const found = findFileRecursive(iconsDir, filename);
    if (found) {
      const relativePath = path.relative(path.join(__dirname, '../../src'), found);
      return relativePath.replace(/\\/g, '/');
    }
  }

  return `src/Icons/Other/Miscellaneous/${filename}`;
}

function findFileRecursive(dir, filename) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, filename);
        if (found) return found;
      } else if (entry.name === filename) {
        return fullPath;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

function deriveDeviceTypeFromFilename(filename) {
  if (!filename) return null;
  const withoutExt = filename.replace(/\.svg$/i, '');
  return withoutExt.toLowerCase();
}

function deriveDisplayNameFromFilename(filename) {
  if (!filename) return null;
  const withoutExt = filename.replace(/\.svg$/i, '');
  return withoutExt
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function inferITCategoryFromPath(iconPath) {
  if (!iconPath) return 'Miscellaneous';

  const parts = iconPath.split('/');
  if (parts.length >= 4 && parts[0] === 'src' && parts[1] === 'Icons') {
    return parts[3] || 'Miscellaneous';
  }

  return 'Miscellaneous';
}

function scanAllIconsRecursive(dir, iconsBaseDir, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanAllIconsRecursive(fullPath, iconsBaseDir, results);
      } else if (entry.name.endsWith('.svg')) {
        const relativePath = path.relative(iconsBaseDir, fullPath);
        const iconPath = `src/Icons/${relativePath.replace(/\\/g, '/')}`;
        results.push({
          fullPath,
          iconPath,
          filename: entry.name
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
  return results;
}

function updateIconPaths() {
  try {
    debugLog('[updateIconPaths] Starting path verification...');
    const oldPaths = db.prepare("SELECT icon_path FROM device_types WHERE icon_path LIKE 'src/iconpack/%'").all();

    if (oldPaths.length > 0) {
      console.log(`Found ${oldPaths.length} entries with old iconpack paths, updating...`);

      const conversions = new Map();
      const newPathToOldPaths = new Map();

      for (const row of oldPaths) {
        const oldPath = row.icon_path;
        const newPath = convertOldPathToNew(oldPath);

        if (oldPath !== newPath) {
          conversions.set(oldPath, newPath);
          if (!newPathToOldPaths.has(newPath)) {
            newPathToOldPaths.set(newPath, []);
          }
          newPathToOldPaths.get(newPath).push(oldPath);
        }
      }

      const updateStmt = db.prepare('UPDATE device_types SET icon_path = ?, updated_at = CURRENT_TIMESTAMP WHERE icon_path = ?');
      const deleteStmt = db.prepare('DELETE FROM device_types WHERE icon_path = ?');
      const checkStmt = db.prepare('SELECT icon_path FROM device_types WHERE icon_path = ?');

      let updatedCount = 0;
      let deletedCount = 0;

      for (const [oldPath, newPath] of conversions) {
        const existing = checkStmt.get(newPath);

        if (existing) {
          deleteStmt.run(oldPath);
          deletedCount++;
        } else {
          const conflictingOldPaths = newPathToOldPaths.get(newPath);
          if (conflictingOldPaths && conflictingOldPaths.length > 1) {
            if (oldPath === conflictingOldPaths[0]) {
              updateStmt.run(newPath, oldPath);
              updatedCount++;
              for (let i = 1; i < conflictingOldPaths.length; i++) {
                deleteStmt.run(conflictingOldPaths[i]);
                deletedCount++;
              }
            }
          } else {
            updateStmt.run(newPath, oldPath);
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0 || deletedCount > 0) {
        console.log(`Updated ${updatedCount} icon paths and removed ${deletedCount} duplicate entries`);
      }
    }
  } catch (error) {
    console.error('Error updating icon paths:', error);
  }
}

// ============== Device Sync Functions (exported for IPC handlers) ==============

/**
 * Extract device metadata from node and convert to database format
 */
export function extractDeviceMetadata(node) {
  const data = node.data || {};

  const boolToInt = (val) => (val === true ? 1 : 0);
  const toJsonString = (val) => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val) || typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val;
  };

  return {
    id: node.id || '',
    name: data.name || '',
    device_type: data.deviceType || '',
    device_subtype: data.deviceSubtype || null,
    icon_path: data.iconPath || null,
    ip_address: data.ipAddress || null,
    mac_address: data.macAddress || null,
    subnet_mask: data.subnetMask || null,
    default_gateway: data.defaultGateway || null,
    hostname: data.hostname || null,
    dns_servers: data.dnsServers || null,
    vlan_id: data.vlanId || null,
    ports: data.ports || null,
    manufacturer: data.manufacturer || null,
    model: data.model || null,
    serial_number: data.serialNumber || null,
    firmware_version: data.firmwareVersion || null,
    operating_system: data.operatingSystem || null,
    os_version: data.osVersion || null,
    software: data.software || null,
    cpu_model: data.cpuModel || null,
    memory_size: data.memorySize || null,
    storage_size: data.storageSize || null,
    security_zone: data.securityZone || null,
    asset_value: data.assetValue || null,
    mission_critical: boolToInt(data.missionCritical),
    data_classification: data.dataClassification || null,
    multifactor_auth: boolToInt(data.multifactorAuth),
    encryption_at_rest: boolToInt(data.encryptionAtRest),
    encryption_in_transit: boolToInt(data.encryptionInTransit),
    encryption_status: data.encryptionStatus || null,
    backups_configured: boolToInt(data.backupsConfigured),
    monitoring_enabled: boolToInt(data.monitoringEnabled),
    vulnerability_management: data.vulnerabilityManagement || null,
    risk_level: data.riskLevel || null,
    criticality: data.criticality || null,
    firewall_enabled: boolToInt(data.firewallEnabled),
    antivirus_enabled: boolToInt(data.antivirusEnabled),
    patch_level: data.patchLevel || null,
    last_patch_date: data.lastPatchDate || null,
    applicable_controls: toJsonString(data.applicableControls),
    last_vuln_scan: data.lastVulnScan || null,
    compliance_status: data.complianceStatus || null,
    assigned_controls: toJsonString(data.assignedControls),
    system_owner: data.systemOwner || null,
    owner: data.owner || null,
    department: data.department || null,
    contact_email: data.contactEmail || null,
    location: data.location || null,
    cost_center: data.costCenter || null,
    purchase_date: data.purchaseDate || null,
    warranty_expiration: data.warrantyExpiration || null,
    notes: data.notes || null,
    tags: toJsonString(data.tags),
    status: data.status || null,
    control_notes: toJsonString(data.controlNotes),
    label: data.label || null,
    label_fields: toJsonString(data.labelFields),
    device_image_size: data.deviceImageSize || null,
  };
}

/**
 * Sync devices from nodes array to devices table
 */
export function syncDevicesToTable(projectId, nodes) {
  try {
    const deviceNodes = nodes.filter(node =>
      (node.type === 'device' || !node.type) && node.data
    );

    if (deviceNodes.length === 0) {
      cleanupOrphanedDevices(projectId, []);
      return;
    }

    const upsertStmt = db.prepare(`
      INSERT INTO devices (
        id, project_id, name, device_type, device_subtype, icon_path,
        ip_address, mac_address, subnet_mask, default_gateway, hostname, dns_servers, vlan_id, ports,
        manufacturer, model, serial_number, firmware_version, operating_system, os_version, software,
        cpu_model, memory_size, storage_size,
        security_zone, asset_value, mission_critical, data_classification,
        multifactor_auth, encryption_at_rest, encryption_in_transit, encryption_status,
        backups_configured, monitoring_enabled, vulnerability_management, risk_level, criticality,
        firewall_enabled, antivirus_enabled, patch_level, last_patch_date,
        applicable_controls, last_vuln_scan, compliance_status, assigned_controls,
        system_owner, owner, department, contact_email, location, cost_center, purchase_date, warranty_expiration,
        notes, tags, status, control_notes,
        label, label_fields, device_image_size,
        updated_at
      ) VALUES (
        @id, @project_id, @name, @device_type, @device_subtype, @icon_path,
        @ip_address, @mac_address, @subnet_mask, @default_gateway, @hostname, @dns_servers, @vlan_id, @ports,
        @manufacturer, @model, @serial_number, @firmware_version, @operating_system, @os_version, @software,
        @cpu_model, @memory_size, @storage_size,
        @security_zone, @asset_value, @mission_critical, @data_classification,
        @multifactor_auth, @encryption_at_rest, @encryption_in_transit, @encryption_status,
        @backups_configured, @monitoring_enabled, @vulnerability_management, @risk_level, @criticality,
        @firewall_enabled, @antivirus_enabled, @patch_level, @last_patch_date,
        @applicable_controls, @last_vuln_scan, @compliance_status, @assigned_controls,
        @system_owner, @owner, @department, @contact_email, @location, @cost_center, @purchase_date, @warranty_expiration,
        @notes, @tags, @status, @control_notes,
        @label, @label_fields, @device_image_size,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(project_id, id) DO UPDATE SET
        name = excluded.name,
        device_type = excluded.device_type,
        device_subtype = excluded.device_subtype,
        icon_path = excluded.icon_path,
        ip_address = excluded.ip_address,
        mac_address = excluded.mac_address,
        subnet_mask = excluded.subnet_mask,
        default_gateway = excluded.default_gateway,
        hostname = excluded.hostname,
        dns_servers = excluded.dns_servers,
        vlan_id = excluded.vlan_id,
        ports = excluded.ports,
        manufacturer = excluded.manufacturer,
        model = excluded.model,
        serial_number = excluded.serial_number,
        firmware_version = excluded.firmware_version,
        operating_system = excluded.operating_system,
        os_version = excluded.os_version,
        software = excluded.software,
        cpu_model = excluded.cpu_model,
        memory_size = excluded.memory_size,
        storage_size = excluded.storage_size,
        security_zone = excluded.security_zone,
        asset_value = excluded.asset_value,
        mission_critical = excluded.mission_critical,
        data_classification = excluded.data_classification,
        multifactor_auth = excluded.multifactor_auth,
        encryption_at_rest = excluded.encryption_at_rest,
        encryption_in_transit = excluded.encryption_in_transit,
        encryption_status = excluded.encryption_status,
        backups_configured = excluded.backups_configured,
        monitoring_enabled = excluded.monitoring_enabled,
        vulnerability_management = excluded.vulnerability_management,
        risk_level = excluded.risk_level,
        criticality = excluded.criticality,
        firewall_enabled = excluded.firewall_enabled,
        antivirus_enabled = excluded.antivirus_enabled,
        patch_level = excluded.patch_level,
        last_patch_date = excluded.last_patch_date,
        applicable_controls = excluded.applicable_controls,
        last_vuln_scan = excluded.last_vuln_scan,
        compliance_status = excluded.compliance_status,
        assigned_controls = excluded.assigned_controls,
        system_owner = excluded.system_owner,
        owner = excluded.owner,
        department = excluded.department,
        contact_email = excluded.contact_email,
        location = excluded.location,
        cost_center = excluded.cost_center,
        purchase_date = excluded.purchase_date,
        warranty_expiration = excluded.warranty_expiration,
        notes = excluded.notes,
        tags = excluded.tags,
        status = excluded.status,
        control_notes = excluded.control_notes,
        label = excluded.label,
        label_fields = excluded.label_fields,
        device_image_size = excluded.device_image_size,
        updated_at = CURRENT_TIMESTAMP
    `);

    const syncTransaction = db.transaction((deviceNodes) => {
      const nodeIds = [];
      for (const node of deviceNodes) {
        const metadata = extractDeviceMetadata(node);
        metadata.project_id = projectId;

        if (metadata.icon_path && metadata.device_type) {
          ensureDeviceTypeInCatalog(metadata.icon_path, metadata.device_type, metadata.device_subtype);
        }

        upsertStmt.run(metadata);
        nodeIds.push(node.id);
      }
      cleanupOrphanedDevices(projectId, nodeIds);
    });

    syncTransaction(deviceNodes);
  } catch (error) {
    console.error('Error syncing devices to table:', error);
  }
}

/**
 * Clean up devices that no longer exist in the diagram
 */
function cleanupOrphanedDevices(projectId, nodeIds) {
  try {
    if (nodeIds.length === 0) {
      db.prepare('DELETE FROM devices WHERE project_id = ?').run(projectId);
    } else {
      const placeholders = nodeIds.map(() => '?').join(',');
      db.prepare(`
        DELETE FROM devices
        WHERE project_id = ? AND id NOT IN (${placeholders})
      `).run(projectId, ...nodeIds);
    }
  } catch (error) {
    console.error('Error cleaning up orphaned devices:', error);
  }
}

/**
 * Ensure a device type exists in the device_types catalog table
 */
function ensureDeviceTypeInCatalog(iconPath, deviceType, deviceSubtype = null) {
  try {
    if (!iconPath || !deviceType) return;

    const existing = db.prepare('SELECT icon_path FROM device_types WHERE icon_path = ?').get(iconPath);
    if (existing) return;

    let displayName = deviceType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (iconPath.includes('/')) {
      const filename = path.basename(iconPath);
      const derivedDisplayName = deriveDisplayNameFromFilename(filename);
      if (derivedDisplayName) {
        displayName = derivedDisplayName;
      }
    }

    const itCategory = inferITCategoryFromPath(iconPath);

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO device_types
        (icon_path, device_type, display_name, it_category, network_layer, device_subtype, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    insertStmt.run(iconPath, deviceType, displayName, itCategory, 'Application', deviceSubtype);
  } catch (error) {
    console.error(`Error ensuring device type in catalog for ${iconPath}:`, error);
  }
}

/**
 * Enrich nodes with device metadata from devices table
 */
export function enrichNodesWithDeviceMetadata(projectId, nodes) {
  try {
    const devicesStmt = db.prepare('SELECT * FROM devices WHERE project_id = ?');
    const devices = devicesStmt.all(projectId);

    if (devices.length === 0) {
      return nodes;
    }

    const devicesMap = new Map();
    devices.forEach(device => {
      devicesMap.set(device.id, device);
    });

    const parseJsonField = (val) => {
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    };

    const intToBool = (val) => val === 1;

    return nodes.map(node => {
      if (node.type === 'boundary' || !node.data) {
        return node;
      }

      const deviceRecord = devicesMap.get(node.id);
      if (!deviceRecord) {
        return node;
      }

      const enrichedData = {
        ...node.data,
        name: deviceRecord.name || node.data.name,
        deviceType: deviceRecord.device_type || node.data.deviceType,
        deviceSubtype: deviceRecord.device_subtype || node.data.deviceSubtype,
        iconPath: deviceRecord.icon_path || node.data.iconPath,
        ipAddress: deviceRecord.ip_address || node.data.ipAddress,
        macAddress: deviceRecord.mac_address || node.data.macAddress,
        subnetMask: deviceRecord.subnet_mask || node.data.subnetMask,
        defaultGateway: deviceRecord.default_gateway || node.data.defaultGateway,
        hostname: deviceRecord.hostname || node.data.hostname,
        dnsServers: deviceRecord.dns_servers || node.data.dnsServers,
        vlanId: deviceRecord.vlan_id || node.data.vlanId,
        ports: deviceRecord.ports || node.data.ports,
        manufacturer: deviceRecord.manufacturer || node.data.manufacturer,
        model: deviceRecord.model || node.data.model,
        serialNumber: deviceRecord.serial_number || node.data.serialNumber,
        firmwareVersion: deviceRecord.firmware_version || node.data.firmwareVersion,
        operatingSystem: deviceRecord.operating_system || node.data.operatingSystem,
        osVersion: deviceRecord.os_version || node.data.osVersion,
        software: deviceRecord.software || node.data.software,
        cpuModel: deviceRecord.cpu_model || node.data.cpuModel,
        memorySize: deviceRecord.memory_size || node.data.memorySize,
        storageSize: deviceRecord.storage_size || node.data.storageSize,
        securityZone: deviceRecord.security_zone || node.data.securityZone,
        assetValue: deviceRecord.asset_value || node.data.assetValue,
        missionCritical: deviceRecord.mission_critical !== undefined ? intToBool(deviceRecord.mission_critical) : node.data.missionCritical,
        dataClassification: deviceRecord.data_classification || node.data.dataClassification,
        multifactorAuth: deviceRecord.multifactor_auth !== undefined ? intToBool(deviceRecord.multifactor_auth) : node.data.multifactorAuth,
        encryptionAtRest: deviceRecord.encryption_at_rest !== undefined ? intToBool(deviceRecord.encryption_at_rest) : node.data.encryptionAtRest,
        encryptionInTransit: deviceRecord.encryption_in_transit !== undefined ? intToBool(deviceRecord.encryption_in_transit) : node.data.encryptionInTransit,
        encryptionStatus: deviceRecord.encryption_status || node.data.encryptionStatus,
        backupsConfigured: deviceRecord.backups_configured !== undefined ? intToBool(deviceRecord.backups_configured) : node.data.backupsConfigured,
        monitoringEnabled: deviceRecord.monitoring_enabled !== undefined ? intToBool(deviceRecord.monitoring_enabled) : node.data.monitoringEnabled,
        vulnerabilityManagement: deviceRecord.vulnerability_management || node.data.vulnerabilityManagement,
        riskLevel: deviceRecord.risk_level || node.data.riskLevel,
        criticality: deviceRecord.criticality || node.data.criticality,
        firewallEnabled: deviceRecord.firewall_enabled !== undefined ? intToBool(deviceRecord.firewall_enabled) : node.data.firewallEnabled,
        antivirusEnabled: deviceRecord.antivirus_enabled !== undefined ? intToBool(deviceRecord.antivirus_enabled) : node.data.antivirusEnabled,
        patchLevel: deviceRecord.patch_level || node.data.patchLevel,
        lastPatchDate: deviceRecord.last_patch_date || node.data.lastPatchDate,
        applicableControls: parseJsonField(deviceRecord.applicable_controls) || node.data.applicableControls,
        lastVulnScan: deviceRecord.last_vuln_scan || node.data.lastVulnScan,
        complianceStatus: deviceRecord.compliance_status || node.data.complianceStatus,
        assignedControls: parseJsonField(deviceRecord.assigned_controls) || node.data.assignedControls,
        systemOwner: deviceRecord.system_owner || node.data.systemOwner,
        owner: deviceRecord.owner || node.data.owner,
        department: deviceRecord.department || node.data.department,
        contactEmail: deviceRecord.contact_email || node.data.contactEmail,
        location: deviceRecord.location || node.data.location,
        costCenter: deviceRecord.cost_center || node.data.costCenter,
        purchaseDate: deviceRecord.purchase_date || node.data.purchaseDate,
        warrantyExpiration: deviceRecord.warranty_expiration || node.data.warrantyExpiration,
        notes: deviceRecord.notes || node.data.notes,
        tags: parseJsonField(deviceRecord.tags) || node.data.tags,
        status: deviceRecord.status || node.data.status,
        controlNotes: parseJsonField(deviceRecord.control_notes) || node.data.controlNotes,
        label: deviceRecord.label || node.data.label,
        labelFields: parseJsonField(deviceRecord.label_fields) || node.data.labelFields,
        deviceImageSize: deviceRecord.device_image_size || node.data.deviceImageSize,
      };

      return {
        ...node,
        data: enrichedData,
      };
    });
  } catch (error) {
    console.error('Error enriching nodes with device metadata:', error);
    return nodes;
  }
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// ============== Repository Layer Integration ==============

/**
 * Get repository instances for data access
 * @returns {import('../database/repositories/index.js').Repositories}
 */
export function getRepositories() {
  const database = getDatabase();
  if (!database) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return getRepos(database);
}

/**
 * Clear repository cache (useful when database is closed/reopened)
 */
export { clearRepositoryCache };
