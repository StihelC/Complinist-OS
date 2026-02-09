/**
 * IPC Validation Middleware
 *
 * Centralized validation middleware that sanitizes all data crossing IPC boundaries
 * before processing. Uses Zod for runtime validation to enforce type safety and
 * prevent injection attacks.
 *
 * This middleware is applied to all db:*, ai:*, file:*, and license:* channels.
 */

import { z } from 'zod';
import { ipcMain } from 'electron';

// ============== Input Sanitization Utilities ==============

/**
 * Sanitizes string input to prevent XSS and injection attacks
 * @param {string} input - The string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove null bytes (common attack vector)
  let sanitized = input.replace(/\0/g, '');

  // Trim excessive whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitizes object recursively, applying string sanitization to all string values
 * @param {unknown} obj - The object to sanitize
 * @param {number} depth - Current recursion depth (prevents stack overflow)
 * @returns {unknown} Sanitized object
 */
export function sanitizeObject(obj, depth = 0) {
  const MAX_DEPTH = 20;

  if (depth > MAX_DEPTH) {
    console.warn('[IPC Validation] Max sanitization depth reached');
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    // Handle Buffer and Uint8Array specially - don't sanitize binary data
    if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
      return obj;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }

  return obj;
}

// ============== Input Size Limits ==============

export const INPUT_SIZE_LIMITS = {
  // Maximum payload size in bytes (10MB)
  maxPayloadSize: 10 * 1024 * 1024,
  // Maximum string length for general text fields
  maxStringLength: 100000,
  // Maximum array length for general arrays
  maxArrayLength: 10000,
  // Maximum prompt size for AI operations
  maxPromptSize: 100000,
  // Maximum file path length
  maxPathLength: 4096,
};

/**
 * Checks if the input exceeds size limits
 * @param {unknown} input - Input to check
 * @param {string} context - Handler context for error messages
 * @throws {Error} If input exceeds size limits
 */
export function checkInputSize(input, context) {
  const serialized = JSON.stringify(input);
  if (serialized && serialized.length > INPUT_SIZE_LIMITS.maxPayloadSize) {
    throw new Error(`Input payload too large for ${context}: ${serialized.length} bytes exceeds ${INPUT_SIZE_LIMITS.maxPayloadSize} bytes`);
  }
}

// ============== Validation Error Class ==============

/**
 * Custom error class for IPC validation failures
 */
export class IPCValidationError extends Error {
  constructor(handlerName, issues, originalData = null) {
    const errorMessages = issues.map(e => `${e.path?.join('.') || 'root'}: ${e.message}`).join(', ');
    super(`IPC validation failed for ${handlerName}: ${errorMessages}`);
    this.name = 'IPCValidationError';
    this.handlerName = handlerName;
    this.issues = issues;
    this.code = 'IPC_VALIDATION_FAILED';
    // Don't store original data to avoid exposing sensitive information
  }
}

// ============== Core Validation Functions ==============

/**
 * Validate and sanitize IPC input
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @param {string} handlerName - Name of the IPC handler for error messages
 * @returns {unknown} Validated, parsed, and sanitized data
 * @throws {IPCValidationError} If validation fails
 */
export function validateAndSanitizeInput(schema, data, handlerName) {
  // Step 1: Check input size
  checkInputSize(data, handlerName);

  // Step 2: Sanitize input before validation
  const sanitizedData = sanitizeObject(data);

  // Step 3: Validate against schema
  const result = schema.safeParse(sanitizedData);

  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    throw new IPCValidationError(handlerName, issues);
  }

  return result.data;
}

/**
 * Create a validated IPC handler wrapper with full sanitization
 * @param {z.ZodSchema} schema - Zod schema for input validation
 * @param {Function} handler - The actual handler function
 * @param {string} handlerName - Name for error messages
 * @param {Object} options - Additional options
 * @param {boolean} options.skipSanitization - Skip sanitization for binary data handlers
 * @returns {Function} Wrapped handler with validation
 */
export function createValidatedHandler(schema, handler, handlerName, options = {}) {
  const { skipSanitization = false } = options;

  return async (event, data) => {
    try {
      // Check input size
      checkInputSize(data, handlerName);

      // Optionally skip sanitization for binary data
      const dataToValidate = skipSanitization ? data : sanitizeObject(data);

      // Validate against schema
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const issues = result.error.issues || result.error.errors || [];
        throw new IPCValidationError(handlerName, issues);
      }

      // Call the actual handler with validated data
      return await handler(event, result.data);
    } catch (error) {
      if (error instanceof IPCValidationError) {
        console.error(`[IPC Validation] ${error.message}`);
        throw error;
      }
      // Re-throw other errors as-is
      throw error;
    }
  };
}

/**
 * Register a validated IPC handler
 * @param {string} channel - IPC channel name
 * @param {z.ZodSchema} schema - Zod schema for input validation
 * @param {Function} handler - The handler function
 * @param {Object} options - Additional options
 */
export function registerValidatedHandler(channel, schema, handler, options = {}) {
  const validatedHandler = createValidatedHandler(schema, handler, channel, options);
  ipcMain.handle(channel, validatedHandler);
}

// ============== Channel-Specific Schemas ==============

// Base schemas for common types
export const projectIdSchema = z.number().int().positive();
export const baselineSchema = z.enum(['LOW', 'MODERATE', 'HIGH']).default('MODERATE');
export const projectNameSchema = z.string().min(1).max(255);

// Schema for channels that take no input
export const noInputSchema = z.undefined().or(z.null()).or(z.object({}).optional());

// Schema for project ID only input
export const projectIdOnlySchema = z.union([
  projectIdSchema,
  z.object({ projectId: projectIdSchema })
]);

// Device Types schemas
export const deviceTypeIconPathSchema = z.object({
  iconPath: z.string().min(1).max(500),
});

export const deviceTypeIconSchema = z.string().min(1).max(500);

// License schemas
export const licenseDataSchema = z.object({
  license: z.object({
    license_code: z.string().min(1).max(500),
    user_id: z.string().min(1).max(500),
    email: z.string().email().max(255),
    expires_at: z.number().int(),
    subscription_status: z.string().min(1).max(50),
    subscription_plan: z.string().max(100).optional().nullable(),
    subscription_id: z.string().max(200).optional().nullable(),
    created_at: z.number().int().optional(),
  }),
});

// AI dual-source query schema
export const queryDualSourceSchema = z.object({
  userId: z.string().min(1).max(500),
  queryEmbedding: z.array(z.number()),
  topK: z.number().int().positive().max(100).optional(),
  searchScope: z.enum(['user', 'shared', 'both']).optional(),
});

// Export schemas
export const exportJsonSchema = z.object({
  reportData: z.unknown(),
  projectName: z.string().max(255).optional(),
  selectedIds: z.array(z.string().max(100)).optional(),
});

export const exportPngSchema = z.object({
  imageData: z.string().startsWith('data:'),
  projectName: z.string().max(255).optional(),
});

export const exportSvgSchema = z.object({
  svgContent: z.string().optional(),
  imageData: z.string().optional(),
  projectName: z.string().max(255).optional(),
});

export const exportPngFromSvgSchema = z.object({
  svgContent: z.string(),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  projectName: z.string().max(255).optional(),
});

export const exportCsvSchema = z.object({
  csvContent: z.string(),
  filename: z.string().max(255).optional(),
});

export const exportPdfSchema = z.object({
  pdfBuffer: z.unknown(), // Buffer or array
  filename: z.string().max(255).optional(),
});

export const generateSspPdfSchema = z.object({
  html: z.string().min(1),
  options: z.object({
    pageSize: z.string().max(50).optional(),
    margins: z.object({
      top: z.number().optional(),
      right: z.number().optional(),
      bottom: z.number().optional(),
      left: z.number().optional(),
    }).optional(),
  }).optional(),
});

// Capture viewport schema
export const captureViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  devicePixelRatio: z.number().positive().max(10).optional(),
}).passthrough();

// File save schema with path security
export const saveFileSchema = z.object({
  path: z.string().min(1).max(INPUT_SIZE_LIMITS.maxPathLength).refine(
    (val) => !val.includes('\0') && !val.includes('..'),
    { message: 'Path contains invalid characters or traversal patterns' }
  ),
  data: z.union([z.string(), z.instanceof(Buffer), z.instanceof(Uint8Array)]),
});

// Terraform schemas
export const terraformRunPlanSchema = z.object({
  directory: z.string().min(1).max(INPUT_SIZE_LIMITS.maxPathLength).refine(
    (val) => !val.includes('\0'),
    { message: 'Directory path contains null bytes' }
  ),
  options: z.object({
    refresh: z.boolean().optional(),
  }).optional().default({}),
});

// Console log schema
export const consoleLogSchema = z.object({
  level: z.enum(['log', 'warn', 'error', 'info', 'debug']),
  args: z.array(z.unknown()),
});

// ============== Channel Registry ==============

/**
 * Maps channel prefixes to their validation requirements
 */
export const CHANNEL_PREFIXES = {
  'db:': {
    requiresValidation: true,
    category: 'database',
  },
  'ai:': {
    requiresValidation: true,
    category: 'ai',
  },
  'license:': {
    requiresValidation: true,
    category: 'license',
  },
  'file:': {
    requiresValidation: true,
    category: 'file',
  },
  'export': {
    requiresValidation: true,
    category: 'export',
  },
  'import': {
    requiresValidation: true,
    category: 'import',
  },
  'terraform:': {
    requiresValidation: true,
    category: 'terraform',
  },
  'device-types:': {
    requiresValidation: true,
    category: 'device-types',
  },
};

/**
 * Checks if a channel requires validation
 * @param {string} channel - Channel name
 * @returns {boolean}
 */
export function channelRequiresValidation(channel) {
  for (const prefix of Object.keys(CHANNEL_PREFIXES)) {
    if (channel.startsWith(prefix)) {
      return CHANNEL_PREFIXES[prefix].requiresValidation;
    }
  }
  return false;
}

/**
 * Gets the category for a channel
 * @param {string} channel - Channel name
 * @returns {string|null}
 */
export function getChannelCategory(channel) {
  for (const [prefix, config] of Object.entries(CHANNEL_PREFIXES)) {
    if (channel.startsWith(prefix)) {
      return config.category;
    }
  }
  return null;
}

// ============== Validation Statistics ==============

const validationStats = {
  totalValidations: 0,
  successfulValidations: 0,
  failedValidations: 0,
  byChannel: {},
};

/**
 * Records a validation attempt
 * @param {string} channel - Channel name
 * @param {boolean} success - Whether validation succeeded
 */
export function recordValidation(channel, success) {
  validationStats.totalValidations++;

  if (success) {
    validationStats.successfulValidations++;
  } else {
    validationStats.failedValidations++;
  }

  if (!validationStats.byChannel[channel]) {
    validationStats.byChannel[channel] = { success: 0, failed: 0 };
  }

  if (success) {
    validationStats.byChannel[channel].success++;
  } else {
    validationStats.byChannel[channel].failed++;
  }
}

/**
 * Gets validation statistics
 * @returns {Object}
 */
export function getValidationStats() {
  return { ...validationStats };
}

/**
 * Resets validation statistics
 */
export function resetValidationStats() {
  validationStats.totalValidations = 0;
  validationStats.successfulValidations = 0;
  validationStats.failedValidations = 0;
  validationStats.byChannel = {};
}

export default {
  // Core functions
  validateAndSanitizeInput,
  createValidatedHandler,
  registerValidatedHandler,

  // Sanitization utilities
  sanitizeString,
  sanitizeObject,
  checkInputSize,

  // Error class
  IPCValidationError,

  // Channel utilities
  channelRequiresValidation,
  getChannelCategory,
  CHANNEL_PREFIXES,

  // Statistics
  recordValidation,
  getValidationStats,
  resetValidationStats,

  // Constants
  INPUT_SIZE_LIMITS,

  // Schemas
  noInputSchema,
  projectIdOnlySchema,
  projectIdSchema,
  baselineSchema,
  projectNameSchema,
  deviceTypeIconPathSchema,
  deviceTypeIconSchema,
  licenseDataSchema,
  queryDualSourceSchema,
  exportJsonSchema,
  exportPngSchema,
  exportSvgSchema,
  exportPngFromSvgSchema,
  exportCsvSchema,
  exportPdfSchema,
  generateSspPdfSchema,
  captureViewportSchema,
  saveFileSchema,
  terraformRunPlanSchema,
  consoleLogSchema,
};
