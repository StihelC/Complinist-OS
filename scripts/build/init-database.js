#!/usr/bin/env node
/**
 * Simple database initialization script for release packaging
 * Creates a fresh SQLite database with the core schema
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.argv[2];
if (!dbPath) {
  console.error('Usage: node init-database.js <db-path>');
  process.exit(1);
}

const db = new Database(dbPath);

// Create core tables (minimal schema for fresh install)
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

db.close();
console.log(`Database initialized: ${dbPath}`);
