/**
 * Shared Constants
 *
 * Single source of truth for constants used by both main and renderer processes.
 * This ensures consistency across the application.
 */

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Token estimation ratio (characters per token)
 * Based on empirical testing with common LLM tokenizers.
 * Using 3.5 for English text which is more accurate than the common /4 approximation.
 */
export const TOKEN_ESTIMATION_RATIO = 3.5;

/**
 * Default response reserve tokens
 * Space reserved for model response in token budget calculations
 */
export const DEFAULT_RESPONSE_RESERVE = 200;

/**
 * Minimum tokens to allocate for context chunks
 */
export const MINIMUM_CHUNK_TOKENS = 256;

/**
 * Average expected chunk size in tokens
 */
export const AVERAGE_CHUNK_SIZE = 400;

// ============================================================================
// License Configuration
// ============================================================================

/**
 * License code format (12 alphanumeric characters)
 */
export const LICENSE_CODE_LENGTH = 12;

/**
 * License code group size for display formatting
 */
export const LICENSE_CODE_GROUP_SIZE = 3;

/**
 * Seconds per day (for license expiration calculations)
 */
export const SECONDS_PER_DAY = 86400;

/**
 * Seconds per hour
 */
export const SECONDS_PER_HOUR = 3600;

/**
 * Seconds per minute
 */
export const SECONDS_PER_MINUTE = 60;

// ============================================================================
// Validation Patterns
// ============================================================================

/**
 * Regular expressions for validation
 */
export const VALIDATION_PATTERNS = {
  // IPv4 address
  IPV4: /^(\d{1,3}\.){3}\d{1,3}$/,

  // IPv6 address (simplified)
  IPV6: /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/,

  // MAC address (supports : and - separators)
  MAC: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,

  // Email address
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // License code (12 alphanumeric characters)
  LICENSE_CODE: /^[A-Z0-9]{12}$/,

  // Alphanumeric only
  ALPHANUMERIC: /^[A-Za-z0-9]+$/,
} as const;

// ============================================================================
// Network Configuration
// ============================================================================

/**
 * Valid port number range
 */
export const PORT_RANGE = {
  MIN: 1,
  MAX: 65535,
} as const;

/**
 * Valid IPv4 octet range
 */
export const IPV4_OCTET_RANGE = {
  MIN: 0,
  MAX: 255,
} as const;

// ============================================================================
// IPC Channels
// ============================================================================

/**
 * License-related IPC channels
 */
export const LICENSE_CHANNELS = {
  OPEN_FILE: 'license:open-file',
  SAVE: 'license:save',
  GET: 'license:get',
  CLEAR: 'license:clear',
} as const;

/**
 * Database-related IPC channels
 */
export const DATABASE_CHANNELS = {
  CREATE_PROJECT: 'db:create-project',
  GET_PROJECTS: 'db:get-projects',
  DELETE_PROJECT: 'db:delete-project',
  SAVE_DIAGRAM: 'db:save-diagram',
  LOAD_DIAGRAM: 'db:load-diagram',
} as const;

/**
 * Export-related IPC channels
 */
export const EXPORT_CHANNELS = {
  JSON: 'export:json',
  PNG: 'export:png',
  SVG: 'export:svg',
  PDF: 'export:pdf',
  CSV: 'export:csv',
} as const;

/**
 * AI-related IPC channels
 */
export const AI_CHANNELS = {
  GENERATE: 'ai:generate',
  EMBED: 'ai:embed',
  CHROMA_QUERY: 'ai:chroma-query',
  CHROMA_ADD: 'ai:chroma-add',
  GET_STATUS: 'ai:get-status',
} as const;

// ============================================================================
// Application Limits
// ============================================================================

/**
 * Maximum string lengths for various inputs
 */
export const MAX_LENGTHS = {
  PROJECT_NAME: 255,
  CONTROL_ID: 50,
  SEARCH_TERM: 500,
  PROMPT: 100000,
  EMBED_TEXT: 50000,
  COLLECTION_NAME: 100,
} as const;

/**
 * Maximum counts for various operations
 */
export const MAX_COUNTS = {
  TOP_K_RESULTS: 100,
  MAX_TOKENS: 100000,
} as const;

// ============================================================================
// NIST Baseline Levels
// ============================================================================

/**
 * NIST baseline security levels
 */
export const NIST_BASELINES = ['LOW', 'MODERATE', 'HIGH'] as const;

export type NISTBaseline = (typeof NIST_BASELINES)[number];

/**
 * Default baseline for new projects
 */
export const DEFAULT_BASELINE: NISTBaseline = 'MODERATE';

// ============================================================================
// File Extensions
// ============================================================================

/**
 * Supported file extensions
 */
export const FILE_EXTENSIONS = {
  LICENSE: '.license',
  JSON: '.json',
  PNG: '.png',
  SVG: '.svg',
  PDF: '.pdf',
  CSV: '.csv',
} as const;
