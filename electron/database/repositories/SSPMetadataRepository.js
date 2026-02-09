/**
 * SSP Metadata Repository
 *
 * Handles all database operations for System Security Plan (SSP) metadata including:
 * - CRUD operations for SSP metadata records
 * - Upsert operations (single record per project)
 * - Custom sections management
 * - Encryption of sensitive compliance data at rest
 */

import { BaseRepository } from './BaseRepository.js';
import { encryptSSPMetadata, decryptSSPMetadata, isEncryptionAvailable } from '../../encryption/index.js';

/**
 * @typedef {Object} SSPMetadata
 * @property {number} id
 * @property {number} project_id
 * @property {string|null} organization_name
 * @property {string|null} prepared_by
 * @property {string|null} system_description
 * @property {string|null} system_purpose
 * @property {string|null} deployment_model
 * @property {string|null} service_model
 * @property {string|null} information_type_title
 * @property {string|null} information_type_description
 * @property {string} confidentiality_impact
 * @property {string} integrity_impact
 * @property {string} availability_impact
 * @property {string|null} authorization_boundary_description
 * @property {string} system_status
 * @property {string|null} system_owner
 * @property {string|null} system_owner_email
 * @property {string|null} authorizing_official
 * @property {string|null} authorizing_official_email
 * @property {string|null} security_contact
 * @property {string|null} security_contact_email
 * @property {string|null} physical_location
 * @property {string|null} data_types_processed
 * @property {string|null} users_description
 * @property {string} unedited_controls_mode
 * @property {string|null} on_premises_details
 * @property {string|null} cloud_provider
 * @property {string} custom_sections - JSON string
 * @property {string} selected_control_ids - JSON string
 * @property {string|null} topology_screenshot
 * @property {string} updated_at
 */

export class SSPMetadataRepository extends BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    super(db, 'ssp_metadata', { primaryKey: 'id', hasTimestamps: true });
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Get SSP metadata for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getMetadata(projectId) {
    if (!projectId) {
      return { success: false, error: 'Project ID is required' };
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM ssp_metadata WHERE project_id = ?');
      const metadata = stmt.get(projectId);

      // Decrypt sensitive fields if encryption is available
      const decryptedMetadata = metadata ? decryptSSPMetadata(metadata) : null;

      return { success: true, data: decryptedMetadata };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error getting metadata:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if SSP metadata exists for a project
   * @param {number} projectId
   * @returns {boolean}
   */
  metadataExists(projectId) {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM ssp_metadata WHERE project_id = ? LIMIT 1');
      return stmt.get(projectId) !== undefined;
    } catch (error) {
      console.error('[SSPMetadataRepository] Error checking existence:', error);
      return false;
    }
  }

  // ==========================================================================
  // Save Operations
  // ==========================================================================

  /**
   * Save SSP metadata (upsert)
   * @param {number} projectId
   * @param {Object} metadata
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveMetadata(projectId, metadata) {
    if (!projectId || !metadata) {
      return { success: false, error: 'Project ID and metadata are required' };
    }

    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO ssp_metadata (
          project_id, organization_name, prepared_by, system_description, system_purpose,
          deployment_model, service_model, information_type_title, information_type_description,
          confidentiality_impact, integrity_impact, availability_impact,
          authorization_boundary_description, system_status, system_owner,
          system_owner_email, authorizing_official, authorizing_official_email,
          security_contact, security_contact_email, physical_location,
          data_types_processed, users_description, unedited_controls_mode,
          on_premises_details, cloud_provider, custom_sections, selected_control_ids,
          topology_screenshot
        ) VALUES (
          @project_id, @organization_name, @prepared_by, @system_description, @system_purpose,
          @deployment_model, @service_model, @information_type_title, @information_type_description,
          @confidentiality_impact, @integrity_impact, @availability_impact,
          @authorization_boundary_description, @system_status, @system_owner,
          @system_owner_email, @authorizing_official, @authorizing_official_email,
          @security_contact, @security_contact_email, @physical_location,
          @data_types_processed, @users_description, @unedited_controls_mode,
          @on_premises_details, @cloud_provider, @custom_sections, @selected_control_ids,
          @topology_screenshot
        )
        ON CONFLICT(project_id) DO UPDATE SET
          organization_name = excluded.organization_name,
          prepared_by = excluded.prepared_by,
          system_description = excluded.system_description,
          system_purpose = excluded.system_purpose,
          deployment_model = excluded.deployment_model,
          service_model = excluded.service_model,
          information_type_title = excluded.information_type_title,
          information_type_description = excluded.information_type_description,
          confidentiality_impact = excluded.confidentiality_impact,
          integrity_impact = excluded.integrity_impact,
          availability_impact = excluded.availability_impact,
          authorization_boundary_description = excluded.authorization_boundary_description,
          system_status = excluded.system_status,
          system_owner = excluded.system_owner,
          system_owner_email = excluded.system_owner_email,
          authorizing_official = excluded.authorizing_official,
          authorizing_official_email = excluded.authorizing_official_email,
          security_contact = excluded.security_contact,
          security_contact_email = excluded.security_contact_email,
          physical_location = excluded.physical_location,
          data_types_processed = excluded.data_types_processed,
          users_description = excluded.users_description,
          unedited_controls_mode = excluded.unedited_controls_mode,
          on_premises_details = excluded.on_premises_details,
          cloud_provider = excluded.cloud_provider,
          custom_sections = excluded.custom_sections,
          selected_control_ids = excluded.selected_control_ids,
          topology_screenshot = excluded.topology_screenshot,
          updated_at = CURRENT_TIMESTAMP
      `);

      // Encrypt sensitive fields before saving
      const encryptedParams = encryptSSPMetadata(this.prepareMetadataParams(projectId, metadata));
      insertStmt.run(encryptedParams);
      return { success: true };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error saving metadata:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Prepare metadata parameters for database insertion
   * @private
   * @param {number} projectId
   * @param {Object} metadata
   * @returns {Object}
   */
  prepareMetadataParams(projectId, metadata) {
    return {
      project_id: projectId,
      organization_name: metadata.organization_name || null,
      prepared_by: metadata.prepared_by || null,
      system_description: metadata.system_description || null,
      system_purpose: metadata.system_purpose || null,
      deployment_model: metadata.deployment_model || null,
      service_model: metadata.service_model || null,
      information_type_title: metadata.information_type_title || null,
      information_type_description: metadata.information_type_description || null,
      confidentiality_impact: metadata.confidentiality_impact || 'moderate',
      integrity_impact: metadata.integrity_impact || 'moderate',
      availability_impact: metadata.availability_impact || 'moderate',
      authorization_boundary_description: metadata.authorization_boundary_description || null,
      system_status: metadata.system_status || 'operational',
      system_owner: metadata.system_owner || null,
      system_owner_email: metadata.system_owner_email || null,
      authorizing_official: metadata.authorizing_official || null,
      authorizing_official_email: metadata.authorizing_official_email || null,
      security_contact: metadata.security_contact || null,
      security_contact_email: metadata.security_contact_email || null,
      physical_location: metadata.physical_location || null,
      data_types_processed: metadata.data_types_processed || null,
      users_description: metadata.users_description || null,
      unedited_controls_mode: metadata.unedited_controls_mode || 'placeholder',
      on_premises_details: metadata.on_premises_details || null,
      cloud_provider: metadata.cloud_provider || null,
      custom_sections: metadata.custom_sections || '[]',
      selected_control_ids: metadata.selected_control_ids || '[]',
      topology_screenshot: metadata.topology_screenshot || null,
    };
  }

  /**
   * Update specific fields only
   * @param {number} projectId
   * @param {Object} updates
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  updateMetadata(projectId, updates) {
    if (!projectId || !updates || Object.keys(updates).length === 0) {
      return { success: false, error: 'Project ID and updates are required' };
    }

    try {
      // Build SET clause dynamically
      const allowedFields = [
        'organization_name', 'prepared_by', 'system_description', 'system_purpose',
        'deployment_model', 'service_model', 'information_type_title', 'information_type_description',
        'confidentiality_impact', 'integrity_impact', 'availability_impact',
        'authorization_boundary_description', 'system_status', 'system_owner',
        'system_owner_email', 'authorizing_official', 'authorizing_official_email',
        'security_contact', 'security_contact_email', 'physical_location',
        'data_types_processed', 'users_description', 'unedited_controls_mode',
        'on_premises_details', 'cloud_provider', 'custom_sections', 'selected_control_ids',
        'topology_screenshot'
      ];

      const setClauses = [];
      const params = [];

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (setClauses.length === 0) {
        return { success: false, error: 'No valid fields to update' };
      }

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      params.push(projectId);

      const sql = `UPDATE ssp_metadata SET ${setClauses.join(', ')} WHERE project_id = ?`;
      const stmt = this.db.prepare(sql);
      stmt.run(...params);

      return { success: true };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error updating metadata:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Custom Sections Management
  // ==========================================================================

  /**
   * Get custom sections for a project
   * @param {number} projectId
   * @returns {Array}
   */
  getCustomSections(projectId) {
    try {
      const stmt = this.db.prepare('SELECT custom_sections FROM ssp_metadata WHERE project_id = ?');
      const result = stmt.get(projectId);
      if (!result || !result.custom_sections) {
        return [];
      }
      return JSON.parse(result.custom_sections);
    } catch (error) {
      console.error('[SSPMetadataRepository] Error getting custom sections:', error);
      return [];
    }
  }

  /**
   * Save custom sections for a project
   * @param {number} projectId
   * @param {Array} sections
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveCustomSections(projectId, sections) {
    try {
      const stmt = this.db.prepare(`
        UPDATE ssp_metadata
        SET custom_sections = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(sections || []), projectId);
      return { success: true };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error saving custom sections:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Selected Controls Management
  // ==========================================================================

  /**
   * Get selected control IDs for a project
   * @param {number} projectId
   * @returns {string[]}
   */
  getSelectedControlIds(projectId) {
    try {
      const stmt = this.db.prepare('SELECT selected_control_ids FROM ssp_metadata WHERE project_id = ?');
      const result = stmt.get(projectId);
      if (!result || !result.selected_control_ids) {
        return [];
      }
      return JSON.parse(result.selected_control_ids);
    } catch (error) {
      console.error('[SSPMetadataRepository] Error getting selected control IDs:', error);
      return [];
    }
  }

  /**
   * Save selected control IDs for a project
   * @param {number} projectId
   * @param {string[]} controlIds
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveSelectedControlIds(projectId, controlIds) {
    try {
      const stmt = this.db.prepare(`
        UPDATE ssp_metadata
        SET selected_control_ids = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(controlIds || []), projectId);
      return { success: true };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error saving selected control IDs:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Topology Screenshot
  // ==========================================================================

  /**
   * Save topology screenshot
   * @param {number} projectId
   * @param {string} screenshotData - Base64 encoded image data
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveTopologyScreenshot(projectId, screenshotData) {
    try {
      const stmt = this.db.prepare(`
        UPDATE ssp_metadata
        SET topology_screenshot = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(screenshotData, projectId);
      return { success: true };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error saving topology screenshot:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get topology screenshot
   * @param {number} projectId
   * @returns {string|null}
   */
  getTopologyScreenshot(projectId) {
    try {
      const stmt = this.db.prepare('SELECT topology_screenshot FROM ssp_metadata WHERE project_id = ?');
      const result = stmt.get(projectId);
      return result ? result.topology_screenshot : null;
    } catch (error) {
      console.error('[SSPMetadataRepository] Error getting topology screenshot:', error);
      return null;
    }
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Delete SSP metadata for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  deleteByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('DELETE FROM ssp_metadata WHERE project_id = ?');
      const result = stmt.run(projectId);
      return { success: true, data: result.changes > 0 };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error deleting metadata:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Impact Levels
  // ==========================================================================

  /**
   * Get impact levels for a project
   * @param {number} projectId
   * @returns {Object}
   */
  getImpactLevels(projectId) {
    try {
      const stmt = this.db.prepare(`
        SELECT confidentiality_impact, integrity_impact, availability_impact
        FROM ssp_metadata
        WHERE project_id = ?
      `);
      const result = stmt.get(projectId);
      return result || {
        confidentiality_impact: 'moderate',
        integrity_impact: 'moderate',
        availability_impact: 'moderate',
      };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error getting impact levels:', error);
      return {
        confidentiality_impact: 'moderate',
        integrity_impact: 'moderate',
        availability_impact: 'moderate',
      };
    }
  }

  /**
   * Update impact levels
   * @param {number} projectId
   * @param {Object} levels
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  updateImpactLevels(projectId, levels) {
    try {
      const stmt = this.db.prepare(`
        UPDATE ssp_metadata
        SET confidentiality_impact = ?, integrity_impact = ?, availability_impact = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(
        levels.confidentiality_impact || 'moderate',
        levels.integrity_impact || 'moderate',
        levels.availability_impact || 'moderate',
        projectId
      );
      return { success: true };
    } catch (error) {
      console.error('[SSPMetadataRepository] Error updating impact levels:', error);
      return { success: false, error: error.message };
    }
  }
}

export default SSPMetadataRepository;
