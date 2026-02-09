/**
 * Repository Layer Index
 *
 * Provides a centralized factory for all repository instances.
 * Implements lazy loading and caching of repository instances.
 */

import { BaseRepository } from './BaseRepository.js';
import { ProjectRepository } from './ProjectRepository.js';
import { DiagramRepository } from './DiagramRepository.js';
import { DeviceRepository } from './DeviceRepository.js';
import { ControlNarrativeRepository } from './ControlNarrativeRepository.js';
import { SSPMetadataRepository } from './SSPMetadataRepository.js';

// Cache for repository instances
let repositoryCache = null;

/**
 * @typedef {Object} Repositories
 * @property {ProjectRepository} projects
 * @property {DiagramRepository} diagrams
 * @property {DeviceRepository} devices
 * @property {ControlNarrativeRepository} controlNarratives
 * @property {SSPMetadataRepository} sspMetadata
 */

/**
 * Get or create repository instances
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {Repositories}
 */
export function getRepositories(db) {
  if (!db) {
    throw new Error('Database instance is required');
  }

  // Return cached instances if database hasn't changed
  if (repositoryCache && repositoryCache._db === db) {
    return repositoryCache;
  }

  // Create new repository instances
  repositoryCache = {
    _db: db, // Store reference to detect database changes
    projects: new ProjectRepository(db),
    diagrams: new DiagramRepository(db),
    devices: new DeviceRepository(db),
    controlNarratives: new ControlNarrativeRepository(db),
    sspMetadata: new SSPMetadataRepository(db),
  };

  return repositoryCache;
}

/**
 * Clear the repository cache (useful for testing)
 */
export function clearRepositoryCache() {
  repositoryCache = null;
}

/**
 * Create a repository factory for a specific database instance
 * @param {import('better-sqlite3').Database} db
 * @returns {function(string): BaseRepository}
 */
export function createRepositoryFactory(db) {
  const repos = getRepositories(db);

  return function getRepository(name) {
    switch (name) {
      case 'projects':
        return repos.projects;
      case 'diagrams':
        return repos.diagrams;
      case 'devices':
        return repos.devices;
      case 'controlNarratives':
        return repos.controlNarratives;
      case 'sspMetadata':
        return repos.sspMetadata;
      default:
        throw new Error(`Unknown repository: ${name}`);
    }
  };
}

// Re-export all repository classes
export {
  BaseRepository,
  ProjectRepository,
  DiagramRepository,
  DeviceRepository,
  ControlNarrativeRepository,
  SSPMetadataRepository,
};
