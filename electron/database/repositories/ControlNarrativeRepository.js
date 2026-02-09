/**
 * Control Narrative Repository
 *
 * Handles all database operations for control narratives including:
 * - CRUD operations for control narrative records
 * - Bulk save operations with transaction support
 * - Implementation status management
 * - Encryption of sensitive narrative data at rest
 */

import { BaseRepository } from './BaseRepository.js';
import { encryptControlNarrative, decryptControlNarrative, decryptControlNarratives, isEncryptionAvailable } from '../../encryption/index.js';

/**
 * @typedef {Object} ControlNarrative
 * @property {number} id
 * @property {number} project_id
 * @property {string} control_id
 * @property {string|null} narrative
 * @property {string|null} system_implementation
 * @property {string|null} implementation_status
 * @property {string} updated_at
 */

/**
 * @typedef {Object} SaveNarrativeData
 * @property {string} control_id
 * @property {string} [narrative]
 * @property {string} [system_implementation]
 * @property {string} [implementation_status]
 */

export class ControlNarrativeRepository extends BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    super(db, 'control_narratives', { primaryKey: 'id', hasTimestamps: true });
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Load all control narratives for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  loadNarratives(projectId) {
    try {
      const stmt = this.db.prepare(`
        SELECT control_id, narrative, implementation_status, system_implementation
        FROM control_narratives
        WHERE project_id = ?
      `);
      const narratives = stmt.all(projectId);

      // Decrypt sensitive fields if encryption is available
      const decryptedNarratives = decryptControlNarratives(narratives);

      return { success: true, data: decryptedNarratives };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error loading narratives:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get a single control narrative
   * @param {number} projectId
   * @param {string} controlId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getNarrative(projectId, controlId) {
    try {
      const stmt = this.db.prepare(`
        SELECT control_id, narrative, implementation_status, system_implementation, updated_at
        FROM control_narratives
        WHERE project_id = ? AND control_id = ?
      `);
      const narrative = stmt.get(projectId, controlId);

      // Decrypt sensitive fields if encryption is available
      const decryptedNarrative = narrative ? decryptControlNarrative(narrative) : null;

      return { success: true, data: decryptedNarrative };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error getting narrative:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get narratives by implementation status
   * @param {number} projectId
   * @param {string} status
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getNarrativesByStatus(projectId, status) {
    try {
      const stmt = this.db.prepare(`
        SELECT control_id, narrative, implementation_status, system_implementation
        FROM control_narratives
        WHERE project_id = ? AND implementation_status = ?
      `);
      const narratives = stmt.all(projectId, status);

      // Decrypt sensitive fields if encryption is available
      const decryptedNarratives = decryptControlNarratives(narratives);

      return { success: true, data: decryptedNarratives };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error getting narratives by status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get control IDs that have narratives
   * @param {number} projectId
   * @returns {string[]}
   */
  getControlIdsWithNarratives(projectId) {
    try {
      const stmt = this.db.prepare(`
        SELECT control_id
        FROM control_narratives
        WHERE project_id = ? AND (narrative IS NOT NULL OR system_implementation IS NOT NULL)
      `);
      const results = stmt.all(projectId);
      return results.map(r => r.control_id);
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error getting control IDs:', error);
      return [];
    }
  }

  // ==========================================================================
  // Save Operations
  // ==========================================================================

  /**
   * Save multiple control narratives in a transaction
   * @param {number} projectId
   * @param {SaveNarrativeData[]} narratives
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveNarratives(projectId, narratives) {
    if (!projectId || !Array.isArray(narratives)) {
      return { success: false, error: 'Invalid payload for saving control narratives' };
    }

    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO control_narratives (project_id, control_id, narrative, system_implementation, implementation_status)
        VALUES (@project_id, @control_id, @narrative, @system_implementation, @implementation_status)
        ON CONFLICT(project_id, control_id) DO UPDATE SET
          narrative = excluded.narrative,
          system_implementation = excluded.system_implementation,
          implementation_status = excluded.implementation_status,
          updated_at = CURRENT_TIMESTAMP
      `);

      const runInsert = this.db.transaction((records) => {
        for (const record of records) {
          // Prepare record params
          const recordParams = {
            project_id: projectId,
            control_id: record.control_id,
            narrative: record.narrative ?? record.system_implementation ?? null,
            system_implementation: record.system_implementation ?? record.narrative ?? null,
            implementation_status: record.implementation_status ?? null,
          };

          // Encrypt sensitive fields before saving
          const encryptedParams = encryptControlNarrative(recordParams);
          insertStmt.run(encryptedParams);
        }
      });

      runInsert(narratives);
      return { success: true, data: { saved: narratives.length } };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error saving narratives:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save a single control narrative
   * @param {number} projectId
   * @param {string} controlId
   * @param {string} systemImplementation
   * @param {string} [implementationStatus]
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveSingleNarrative(projectId, controlId, systemImplementation, implementationStatus) {
    if (!projectId || !controlId) {
      return { success: false, error: 'Project ID and Control ID are required' };
    }

    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO control_narratives (project_id, control_id, narrative, system_implementation, implementation_status)
        VALUES (@project_id, @control_id, @narrative, @system_implementation, @implementation_status)
        ON CONFLICT(project_id, control_id) DO UPDATE SET
          narrative = excluded.narrative,
          system_implementation = excluded.system_implementation,
          implementation_status = excluded.implementation_status,
          updated_at = CURRENT_TIMESTAMP
      `);

      insertStmt.run({
        project_id: projectId,
        control_id: controlId,
        narrative: systemImplementation ?? null,
        system_implementation: systemImplementation ?? null,
        implementation_status: implementationStatus ?? null,
      });

      return { success: true };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error saving single narrative:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update implementation status for a control
   * @param {number} projectId
   * @param {string} controlId
   * @param {string} status
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  updateImplementationStatus(projectId, controlId, status) {
    try {
      const stmt = this.db.prepare(`
        UPDATE control_narratives
        SET implementation_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ? AND control_id = ?
      `);
      stmt.run(status, projectId, controlId);
      return { success: true };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error updating status:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Reset (delete) a single control narrative
   * @param {number} projectId
   * @param {string} controlId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  resetNarrative(projectId, controlId) {
    if (!projectId || !controlId) {
      return { success: false, error: 'Project ID and Control ID are required' };
    }

    try {
      const stmt = this.db.prepare(
        'DELETE FROM control_narratives WHERE project_id = ? AND control_id = ?'
      );
      const result = stmt.run(projectId, controlId);
      return { success: true, data: result.changes > 0 };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error resetting narrative:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete all narratives for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  deleteByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('DELETE FROM control_narratives WHERE project_id = ?');
      const result = stmt.run(projectId);
      return { success: true, data: result.changes };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error deleting narratives:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete multiple narratives by control IDs
   * @param {number} projectId
   * @param {string[]} controlIds
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  deleteNarratives(projectId, controlIds) {
    if (!controlIds || controlIds.length === 0) {
      return { success: true, data: 0 };
    }

    try {
      const placeholders = controlIds.map(() => '?').join(',');
      const stmt = this.db.prepare(`
        DELETE FROM control_narratives
        WHERE project_id = ? AND control_id IN (${placeholders})
      `);
      const result = stmt.run(projectId, ...controlIds);
      return { success: true, data: result.changes };
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error deleting narratives:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get narrative count by implementation status
   * @param {number} projectId
   * @returns {Object}
   */
  getStatusCounts(projectId) {
    try {
      const stmt = this.db.prepare(`
        SELECT implementation_status, COUNT(*) as count
        FROM control_narratives
        WHERE project_id = ?
        GROUP BY implementation_status
      `);
      const results = stmt.all(projectId);

      const counts = {
        total: 0,
        implemented: 0,
        partial: 0,
        planned: 0,
        not_applicable: 0,
        other: 0,
      };

      for (const row of results) {
        counts.total += row.count;
        const status = (row.implementation_status || '').toLowerCase();
        if (status === 'implemented' || status === 'fully implemented') {
          counts.implemented += row.count;
        } else if (status === 'partial' || status === 'partially implemented') {
          counts.partial += row.count;
        } else if (status === 'planned') {
          counts.planned += row.count;
        } else if (status === 'not applicable' || status === 'n/a') {
          counts.not_applicable += row.count;
        } else {
          counts.other += row.count;
        }
      }

      return counts;
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error getting status counts:', error);
      return { total: 0, implemented: 0, partial: 0, planned: 0, not_applicable: 0, other: 0 };
    }
  }

  /**
   * Get narrative count for a project
   * @param {number} projectId
   * @returns {number}
   */
  getNarrativeCount(projectId) {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM control_narratives WHERE project_id = ?');
      const result = stmt.get(projectId);
      return result ? result.count : 0;
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error getting count:', error);
      return 0;
    }
  }

  /**
   * Check if a narrative exists
   * @param {number} projectId
   * @param {string} controlId
   * @returns {boolean}
   */
  narrativeExists(projectId, controlId) {
    try {
      const stmt = this.db.prepare(
        'SELECT 1 FROM control_narratives WHERE project_id = ? AND control_id = ? LIMIT 1'
      );
      return stmt.get(projectId, controlId) !== undefined;
    } catch (error) {
      console.error('[ControlNarrativeRepository] Error checking existence:', error);
      return false;
    }
  }
}

export default ControlNarrativeRepository;
