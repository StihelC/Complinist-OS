/**
 * Project Repository
 *
 * Handles all database operations for projects.
 * Centralizes project-related queries and provides a clean API.
 */

import { BaseRepository } from './BaseRepository.js';

/**
 * @typedef {Object} Project
 * @property {number} id
 * @property {string} name
 * @property {string} baseline
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CreateProjectData
 * @property {string} name
 * @property {string} [baseline='MODERATE']
 */

export class ProjectRepository extends BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    super(db, 'projects', { primaryKey: 'id', hasTimestamps: true });
  }

  /**
   * Create a new project
   * @param {CreateProjectData} data
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  createProject(data) {
    const { name, baseline = 'MODERATE' } = data;

    if (!name || name.trim() === '') {
      return { success: false, error: 'Project name is required' };
    }

    try {
      const stmt = this.db.prepare(
        'INSERT INTO projects (name, baseline) VALUES (?, ?)'
      );
      const result = stmt.run(name.trim(), baseline);

      return {
        success: true,
        data: {
          id: result.lastInsertRowid,
          name: name.trim(),
          baseline,
        },
      };
    } catch (error) {
      console.error('[ProjectRepository] Error creating project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all projects ordered by updated_at descending
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  listProjects() {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, created_at, updated_at, COALESCE(baseline, 'MODERATE') as baseline
        FROM projects
        ORDER BY updated_at DESC
      `);
      const projects = stmt.all();
      return { success: true, data: projects };
    } catch (error) {
      console.error('[ProjectRepository] Error listing projects:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a project by ID
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getProject(projectId) {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, created_at, updated_at, COALESCE(baseline, 'MODERATE') as baseline
        FROM projects
        WHERE id = ?
      `);
      const project = stmt.get(projectId);
      return { success: true, data: project || null };
    } catch (error) {
      console.error('[ProjectRepository] Error getting project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update project name
   * @param {number} projectId
   * @param {string} name
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  updateProjectName(projectId, name) {
    if (!name || name.trim() === '') {
      return { success: false, error: 'Project name is required' };
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE projects
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(name.trim(), projectId);
      return this.getProject(projectId);
    } catch (error) {
      console.error('[ProjectRepository] Error updating project name:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update project baseline
   * @param {number} projectId
   * @param {string} baseline
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  updateProjectBaseline(projectId, baseline) {
    if (!baseline) {
      return { success: false, error: 'Baseline is required' };
    }

    const validBaselines = ['LOW', 'MODERATE', 'HIGH'];
    if (!validBaselines.includes(baseline)) {
      return { success: false, error: `Invalid baseline: ${baseline}. Must be one of: ${validBaselines.join(', ')}` };
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE projects
        SET baseline = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(baseline, projectId);
      return { success: true, data: { baseline } };
    } catch (error) {
      console.error('[ProjectRepository] Error updating project baseline:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Touch project updated_at timestamp
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  touchProject(projectId) {
    try {
      const stmt = this.db.prepare(
        'UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(projectId);
      return { success: true };
    } catch (error) {
      console.error('[ProjectRepository] Error touching project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a project and all related data (cascades through foreign keys)
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  deleteProject(projectId) {
    try {
      const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
      const result = stmt.run(projectId);
      return { success: true, data: result.changes > 0 };
    } catch (error) {
      console.error('[ProjectRepository] Error deleting project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a project exists
   * @param {number} projectId
   * @returns {boolean}
   */
  projectExists(projectId) {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM projects WHERE id = ? LIMIT 1');
      return stmt.get(projectId) !== undefined;
    } catch (error) {
      console.error('[ProjectRepository] Error checking project existence:', error);
      return false;
    }
  }

  /**
   * Get project count
   * @returns {number}
   */
  getProjectCount() {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects');
      const result = stmt.get();
      return result ? result.count : 0;
    } catch (error) {
      console.error('[ProjectRepository] Error getting project count:', error);
      return 0;
    }
  }

  /**
   * Search projects by name
   * @param {string} searchTerm
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  searchProjects(searchTerm) {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, created_at, updated_at, COALESCE(baseline, 'MODERATE') as baseline
        FROM projects
        WHERE name LIKE ?
        ORDER BY updated_at DESC
      `);
      const projects = stmt.all(`%${searchTerm}%`);
      return { success: true, data: projects };
    } catch (error) {
      console.error('[ProjectRepository] Error searching projects:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recently updated projects
   * @param {number} [limit=5]
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getRecentProjects(limit = 5) {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, created_at, updated_at, COALESCE(baseline, 'MODERATE') as baseline
        FROM projects
        ORDER BY updated_at DESC
        LIMIT ?
      `);
      const projects = stmt.all(limit);
      return { success: true, data: projects };
    } catch (error) {
      console.error('[ProjectRepository] Error getting recent projects:', error);
      return { success: false, error: error.message };
    }
  }
}

export default ProjectRepository;
