/**
 * Diagram Repository
 *
 * Handles all database operations for diagrams including:
 * - Full diagram save/load
 * - Delta-based saving for incremental updates
 * - Device synchronization coordination
 */

import { BaseRepository } from './BaseRepository.js';

/**
 * @typedef {Object} Diagram
 * @property {number} id
 * @property {number} project_id
 * @property {string} nodes - JSON string
 * @property {string} edges - JSON string
 * @property {string|null} viewport - JSON string
 * @property {string|null} compliance_data - JSON string
 * @property {string|null} report_metadata - JSON string
 * @property {string} updated_at
 */

/**
 * @typedef {Object} NodeChange
 * @property {'add'|'update'|'remove'} type
 * @property {string} nodeId
 * @property {Object} [node]
 */

/**
 * @typedef {Object} EdgeChange
 * @property {'add'|'update'|'remove'} type
 * @property {string} edgeId
 * @property {Object} [edge]
 */

/**
 * @typedef {Object} DeltaSaveResult
 * @property {boolean} success
 * @property {boolean} [isDelta]
 * @property {boolean} [requiresFullSave]
 * @property {string} [error]
 * @property {Object} [appliedChanges]
 * @property {number} [serverSequence]
 */

export class DiagramRepository extends BaseRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    super(db, 'diagrams', { primaryKey: 'id', hasTimestamps: true });
  }

  /**
   * Get diagram by project ID
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  getByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM diagrams WHERE project_id = ?');
      const diagram = stmt.get(projectId);
      return { success: true, data: diagram || null };
    } catch (error) {
      console.error('[DiagramRepository] Error getting diagram:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a diagram exists for a project
   * @param {number} projectId
   * @returns {boolean}
   */
  existsForProject(projectId) {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM diagrams WHERE project_id = ? LIMIT 1');
      return stmt.get(projectId) !== undefined;
    } catch (error) {
      console.error('[DiagramRepository] Error checking diagram existence:', error);
      return false;
    }
  }

  /**
   * Save a full diagram (create or update)
   * @param {number} projectId
   * @param {Object[]} nodes
   * @param {Object[]} edges
   * @param {Object|null} viewport
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveDiagram(projectId, nodes, edges, viewport) {
    try {
      const nodesJson = JSON.stringify(nodes || []);
      const edgesJson = JSON.stringify(edges || []);
      const viewportJson = viewport ? JSON.stringify(viewport) : null;

      const existing = this.existsForProject(projectId);

      if (existing) {
        const stmt = this.db.prepare(`
          UPDATE diagrams
          SET nodes = ?, edges = ?, viewport = ?, updated_at = CURRENT_TIMESTAMP
          WHERE project_id = ?
        `);
        stmt.run(nodesJson, edgesJson, viewportJson, projectId);
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO diagrams (project_id, nodes, edges, viewport)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(projectId, nodesJson, edgesJson, viewportJson);
      }

      return { success: true, data: { isDelta: false } };
    } catch (error) {
      console.error('[DiagramRepository] Error saving diagram:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load a diagram with parsed JSON fields
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  loadDiagram(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM diagrams WHERE project_id = ?');
      const diagram = stmt.get(projectId);

      if (!diagram) {
        return {
          success: true,
          data: { nodes: [], edges: [], viewport: null },
        };
      }

      return {
        success: true,
        data: {
          nodes: this.parseJsonField(diagram.nodes, []),
          edges: this.parseJsonField(diagram.edges, []),
          viewport: this.parseJsonField(diagram.viewport, null),
        },
      };
    } catch (error) {
      console.error('[DiagramRepository] Error loading diagram:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply delta changes to a diagram
   * @param {number} projectId
   * @param {NodeChange[]} nodeChanges
   * @param {EdgeChange[]} edgeChanges
   * @param {number} [sequence]
   * @returns {DeltaSaveResult}
   */
  saveDiagramDelta(projectId, nodeChanges, edgeChanges, sequence) {
    try {
      const existing = this.db.prepare(
        'SELECT id, nodes, edges, viewport FROM diagrams WHERE project_id = ?'
      ).get(projectId);

      if (!existing) {
        return {
          success: false,
          requiresFullSave: true,
          error: 'No existing diagram found for delta save',
        };
      }

      // Parse current state
      let nodes = this.parseJsonField(existing.nodes, []);
      let edges = this.parseJsonField(existing.edges, []);

      // Apply changes
      const { updatedNodes, updatedEdges } = this.applyDeltaChanges(
        nodes,
        edges,
        nodeChanges || [],
        edgeChanges || []
      );

      // Save updated diagram
      const stmt = this.db.prepare(`
        UPDATE diagrams
        SET nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(updatedNodes), JSON.stringify(updatedEdges), projectId);

      return {
        success: true,
        isDelta: true,
        appliedChanges: {
          nodes: (nodeChanges || []).length,
          edges: (edgeChanges || []).length,
        },
        serverSequence: sequence,
        updatedNodes,
        updatedEdges,
      };
    } catch (error) {
      console.error('[DiagramRepository] Error saving diagram delta:', error);
      return {
        success: false,
        requiresFullSave: true,
        error: error.message,
      };
    }
  }

  /**
   * Apply delta changes to nodes and edges
   * @private
   * @param {Object[]} nodes
   * @param {Object[]} edges
   * @param {NodeChange[]} nodeChanges
   * @param {EdgeChange[]} edgeChanges
   * @returns {{ updatedNodes: Object[], updatedEdges: Object[] }}
   */
  applyDeltaChanges(nodes, edges, nodeChanges, edgeChanges) {
    // Create maps for fast lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgeMap = new Map(edges.map(e => [e.id, e]));

    // Apply node changes
    for (const change of nodeChanges) {
      switch (change.type) {
        case 'add':
          if (change.node) {
            nodeMap.set(change.nodeId, change.node);
          }
          break;
        case 'update':
          if (change.node) {
            nodeMap.set(change.nodeId, change.node);
          }
          break;
        case 'remove':
          nodeMap.delete(change.nodeId);
          break;
      }
    }

    // Apply edge changes
    for (const change of edgeChanges) {
      switch (change.type) {
        case 'add':
          if (change.edge) {
            edgeMap.set(change.edgeId, change.edge);
          }
          break;
        case 'update':
          if (change.edge) {
            edgeMap.set(change.edgeId, change.edge);
          }
          break;
        case 'remove':
          edgeMap.delete(change.edgeId);
          break;
      }
    }

    return {
      updatedNodes: Array.from(nodeMap.values()),
      updatedEdges: Array.from(edgeMap.values()),
    };
  }

  /**
   * Update viewport only
   * @param {number} projectId
   * @param {Object} viewport
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  updateViewport(projectId, viewport) {
    try {
      const stmt = this.db.prepare(`
        UPDATE diagrams
        SET viewport = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(viewport), projectId);
      return { success: true };
    } catch (error) {
      console.error('[DiagramRepository] Error updating viewport:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get nodes from diagram
   * @param {number} projectId
   * @returns {Object[]}
   */
  getNodes(projectId) {
    try {
      const stmt = this.db.prepare('SELECT nodes FROM diagrams WHERE project_id = ?');
      const result = stmt.get(projectId);
      return result ? this.parseJsonField(result.nodes, []) : [];
    } catch (error) {
      console.error('[DiagramRepository] Error getting nodes:', error);
      return [];
    }
  }

  /**
   * Get edges from diagram
   * @param {number} projectId
   * @returns {Object[]}
   */
  getEdges(projectId) {
    try {
      const stmt = this.db.prepare('SELECT edges FROM diagrams WHERE project_id = ?');
      const result = stmt.get(projectId);
      return result ? this.parseJsonField(result.edges, []) : [];
    } catch (error) {
      console.error('[DiagramRepository] Error getting edges:', error);
      return [];
    }
  }

  /**
   * Get device nodes (nodes that aren't boundaries)
   * @param {number} projectId
   * @returns {Object[]}
   */
  getDeviceNodes(projectId) {
    const nodes = this.getNodes(projectId);
    return nodes.filter(node =>
      (node.type === 'device' || !node.type) && node.data
    );
  }

  /**
   * Delete diagram for a project
   * @param {number} projectId
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  deleteByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('DELETE FROM diagrams WHERE project_id = ?');
      const result = stmt.run(projectId);
      return { success: true, data: result.changes > 0 };
    } catch (error) {
      console.error('[DiagramRepository] Error deleting diagram:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse a JSON field safely
   * @private
   * @param {string|null} value
   * @param {*} defaultValue
   * @returns {*}
   */
  parseJsonField(value, defaultValue) {
    if (!value) return defaultValue;
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (error) {
      console.error('[DiagramRepository] Error parsing JSON field:', error);
      return defaultValue;
    }
  }

  /**
   * Save compliance data
   * @param {number} projectId
   * @param {Object} complianceData
   * @returns {import('./BaseRepository.js').RepositoryResult}
   */
  saveComplianceData(projectId, complianceData) {
    try {
      const stmt = this.db.prepare(`
        UPDATE diagrams
        SET compliance_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `);
      stmt.run(JSON.stringify(complianceData), projectId);
      return { success: true };
    } catch (error) {
      console.error('[DiagramRepository] Error saving compliance data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get compliance data
   * @param {number} projectId
   * @returns {Object|null}
   */
  getComplianceData(projectId) {
    try {
      const stmt = this.db.prepare('SELECT compliance_data FROM diagrams WHERE project_id = ?');
      const result = stmt.get(projectId);
      return result ? this.parseJsonField(result.compliance_data, null) : null;
    } catch (error) {
      console.error('[DiagramRepository] Error getting compliance data:', error);
      return null;
    }
  }
}

export default DiagramRepository;
