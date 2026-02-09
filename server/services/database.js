/**
 * Database Service
 * SQLite database operations using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '.data');
const DB_PATH = path.join(DATA_DIR, 'complinist.db');

let db = null;

export function initDatabase() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      baseline TEXT DEFAULT 'MODERATE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS diagrams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL UNIQUE,
      nodes TEXT DEFAULT '[]',
      edges TEXT DEFAULT '[]',
      viewport TEXT DEFAULT '{"x":0,"y":0,"zoom":1}',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS control_narratives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      control_id TEXT NOT NULL,
      narrative TEXT,
      status TEXT DEFAULT 'not_started',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, control_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ssp_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL UNIQUE,
      metadata TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  console.log('[Database] Initialized at', DB_PATH);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// Project operations
export function createProject(name, baseline = 'MODERATE') {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const stmt = getDb().prepare(`
    INSERT INTO projects (id, name, baseline) VALUES (?, ?, ?)
  `);
  stmt.run(id, name, baseline);
  return { id, name, baseline };
}

export function listProjects() {
  return getDb().prepare(`
    SELECT p.*, d.updated_at as diagram_updated_at
    FROM projects p
    LEFT JOIN diagrams d ON p.id = d.project_id
    ORDER BY p.updated_at DESC
  `).all();
}

export function deleteProject(projectId) {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  return { success: true };
}

export function updateProjectBaseline(projectId, baseline) {
  getDb().prepare(`
    UPDATE projects SET baseline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(baseline, projectId);
  return { success: true };
}

// Diagram operations
export function saveDiagram(projectId, nodes, edges, viewport) {
  const stmt = getDb().prepare(`
    INSERT INTO diagrams (project_id, nodes, edges, viewport, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET
      nodes = excluded.nodes,
      edges = excluded.edges,
      viewport = excluded.viewport,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(projectId, JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(viewport));

  // Update project timestamp
  getDb().prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

  return { success: true };
}

export function loadDiagram(projectId) {
  const row = getDb().prepare(`
    SELECT * FROM diagrams WHERE project_id = ?
  `).get(projectId);

  if (!row) {
    return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  }

  return {
    nodes: JSON.parse(row.nodes || '[]'),
    edges: JSON.parse(row.edges || '[]'),
    viewport: JSON.parse(row.viewport || '{"x":0,"y":0,"zoom":1}')
  };
}

// Control narrative operations
export function loadControlNarratives(projectId) {
  const rows = getDb().prepare(`
    SELECT control_id, narrative, status FROM control_narratives WHERE project_id = ?
  `).all(projectId);

  const narratives = {};
  for (const row of rows) {
    narratives[row.control_id] = {
      narrative: row.narrative,
      status: row.status
    };
  }
  return narratives;
}

export function saveControlNarratives(projectId, narratives) {
  const stmt = getDb().prepare(`
    INSERT INTO control_narratives (project_id, control_id, narrative, status, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, control_id) DO UPDATE SET
      narrative = excluded.narrative,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = getDb().transaction((items) => {
    for (const [controlId, data] of Object.entries(items)) {
      stmt.run(projectId, controlId, data.narrative || '', data.status || 'not_started');
    }
  });

  transaction(narratives);
  return { success: true };
}

export function saveSingleControlNarrative(projectId, controlId, narrative, status) {
  const stmt = getDb().prepare(`
    INSERT INTO control_narratives (project_id, control_id, narrative, status, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id, control_id) DO UPDATE SET
      narrative = excluded.narrative,
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(projectId, controlId, narrative, status);
  return { success: true };
}

export function resetControlNarrative(projectId, controlId) {
  getDb().prepare(`
    DELETE FROM control_narratives WHERE project_id = ? AND control_id = ?
  `).run(projectId, controlId);
  return { success: true };
}

// SSP Metadata operations
export function getSSPMetadata(projectId) {
  const row = getDb().prepare(`
    SELECT metadata FROM ssp_metadata WHERE project_id = ?
  `).get(projectId);

  return row ? JSON.parse(row.metadata) : {};
}

export function saveSSPMetadata(projectId, metadata) {
  const stmt = getDb().prepare(`
    INSERT INTO ssp_metadata (project_id, metadata, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(projectId, JSON.stringify(metadata));
  return { success: true };
}
