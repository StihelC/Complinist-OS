/**
 * IPC Input Validation Schemas
 * Uses Zod for runtime validation of all IPC handler inputs
 *
 * This module provides centralized validation schemas for all IPC channels,
 * enforcing type safety and preventing injection attacks across:
 * - db:* (database operations)
 * - ai:* (AI service operations)
 * - file:* (file operations)
 * - license:* (license management)
 * - export/import (data export/import)
 * - terraform:* (terraform operations)
 * - device-types:* (device type management)
 */

import { z } from 'zod';
import {
  sanitizeString,
  sanitizeObject,
  checkInputSize,
  IPCValidationError,
  INPUT_SIZE_LIMITS,
} from './middleware/ipc-validation-middleware.js';

// Re-export sanitization utilities for convenience
export { sanitizeString, sanitizeObject, checkInputSize, IPCValidationError, INPUT_SIZE_LIMITS };

// ============== Base Schemas ==============

// Base schemas - exported for use in other modules
export const projectIdSchema = z.number().int().positive();
export const baselineSchema = z.enum(['LOW', 'MODERATE', 'HIGH']).default('MODERATE');
export const projectNameSchema = z.string().min(1).max(255);

// Schema for handlers that accept no input
export const noInputSchema = z.undefined().or(z.null()).or(z.object({}).optional());

// Schema for project ID only input (can be number or object with projectId)
export const projectIdOnlySchema = z.union([
  projectIdSchema,
  z.object({ projectId: projectIdSchema })
]);

// Project schemas
export const createProjectSchema = z.object({
  name: projectNameSchema,
  baseline: baselineSchema.optional(),
});

export const saveDiagramSchema = z.object({
  projectId: projectIdSchema,
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }).optional(),
    data: z.record(z.string(), z.any()).optional(),
  }).passthrough()),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
  }).passthrough()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
  }).optional().nullable(),
});

export const saveDiagramDeltaSchema = z.object({
  projectId: projectIdSchema,
  nodeChanges: z.array(z.object({
    type: z.enum(['add', 'update', 'remove']),
    nodeId: z.string(),
    node: z.object({
      id: z.string(),
      type: z.string().optional(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }).optional(),
      data: z.record(z.string(), z.any()).optional(),
    }).passthrough().optional(),
  }).passthrough()).optional().default([]),
  edgeChanges: z.array(z.object({
    type: z.enum(['add', 'update', 'remove']),
    edgeId: z.string(),
    edge: z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
    }).passthrough().optional(),
  }).passthrough()).optional().default([]),
  sequence: z.number().int().optional(),
});

export const saveControlNarrativesSchema = z.object({
  projectId: projectIdSchema,
  narratives: z.array(z.object({
    control_id: z.string().min(1).max(50),
    narrative: z.string().optional(),
    system_implementation: z.string().optional(),
    implementation_status: z.string().optional(),
  })),
});

export const resetControlNarrativeSchema = z.object({
  projectId: projectIdSchema,
  controlId: z.string().min(1).max(50),
});

export const updateProjectBaselineSchema = z.object({
  projectId: projectIdSchema,
  baseline: baselineSchema,
});

export const saveSingleControlNarrativeSchema = z.object({
  projectId: projectIdSchema,
  controlId: z.string().min(1).max(50),
  systemImplementation: z.string(),
  implementationStatus: z.string().optional(),
});

// Device query schemas
export const queryDevicesSchema = z.object({
  projectId: projectIdSchema,
  filters: z.object({
    deviceType: z.string().optional(),
    manufacturer: z.string().optional(),
    location: z.string().optional(),
    status: z.string().optional(),
    missionCritical: z.boolean().optional(),
    encryptionAtRest: z.boolean().optional(),
  }).optional().default({}),
});

export const getDeviceSchema = z.object({
  projectId: projectIdSchema,
  deviceId: z.string().min(1),
});

export const searchDevicesSchema = z.object({
  projectId: projectIdSchema,
  searchTerm: z.string().max(500),
});

// Export schemas
export const exportJsonSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  projectName: z.string().optional(),
  selectedIds: z.array(z.string()).optional(),
});

export const exportPngSchema = z.object({
  dataUrl: z.string().startsWith('data:'),
  filename: z.string().optional(),
});

export const exportSvgSchema = z.object({
  svgContent: z.string(),
  filename: z.string().optional(),
});

export const exportPngFromSvgSchema = z.object({
  svgContent: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  filename: z.string().optional(),
});

export const exportCsvSchema = z.object({
  csvContent: z.string(),
  filename: z.string().optional(),
});

export const exportPdfSchema = z.object({
  content: z.string(),
  filename: z.string().optional(),
});

// AI schemas
export const llmGenerateSchema = z.object({
  prompt: z.string().min(1).max(100000),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(100000).optional(),
});

export const embedSchema = z.object({
  // Support both single string and array of strings for batch embedding
  text: z.union([
    z.string().min(1).max(50000),
    z.array(z.string().min(1).max(50000)).min(1).max(100)
  ]),
});

export const chromaDbQuerySchema = z.object({
  collection: z.string().min(1).max(100),
  queryEmbedding: z.array(z.number()),
  topK: z.number().int().positive().max(100).optional(),
  filters: z.record(z.string(), z.any()).optional(),
});

export const chromaDbAddSchema = z.object({
  collection: z.string().min(1).max(100),
  documents: z.array(z.string()),
  embeddings: z.array(z.array(z.number())),
  metadatas: z.array(z.record(z.string(), z.any())),
  ids: z.array(z.string()),
});

// File operations
export const saveFileSchema = z.object({
  path: z.string().min(1).refine(
    (val) => !val.includes('\0') && !val.includes('..'),
    { message: 'Path contains invalid characters or traversal patterns' }
  ),
  data: z.union([z.string(), z.instanceof(Buffer), z.instanceof(Uint8Array)]),
});

// Terraform path schemas
export const terraformDirectorySchema = z.object({
  directory: z.string().min(1).refine(
    (val) => !val.includes('\0') && !val.includes('..'),
    { message: 'Directory path contains invalid characters or traversal patterns' }
  ),
  options: z.object({
    refresh: z.boolean().optional(),
  }).optional().default({}),
});

// SSP PDF generation
export const generateSspPdfSchema = z.object({
  html: z.string().min(1),
  options: z.object({
    pageSize: z.string().optional(),
    margins: z.object({
      top: z.number().optional(),
      right: z.number().optional(),
      bottom: z.number().optional(),
      left: z.number().optional(),
    }).optional(),
  }).optional(),
});

// License schemas
export const saveLicenseSchema = z.object({
  license: z.object({
    license_code: z.string().min(1),
    user_id: z.string().min(1),
    email: z.string().email(),
    expires_at: z.number().int(),
    subscription_status: z.string(),
    subscription_plan: z.string().optional(),
    subscription_id: z.string().optional(),
    created_at: z.number().int().optional(),
  }),
});

// SSP metadata schema
export const saveSSPMetadataSchema = z.object({
  projectId: projectIdSchema,
  metadata: z.object({
    organization_name: z.string().optional(),
    prepared_by: z.string().optional(),
    system_description: z.string().optional(),
    system_purpose: z.string().optional(),
    deployment_model: z.string().optional(),
    service_model: z.string().optional(),
    information_type_title: z.string().optional(),
    information_type_description: z.string().optional(),
    confidentiality_impact: z.string().optional(),
    integrity_impact: z.string().optional(),
    availability_impact: z.string().optional(),
    authorization_boundary_description: z.string().optional(),
    system_status: z.string().optional(),
    system_owner: z.string().optional(),
    system_owner_email: z.string().optional(),
    authorizing_official: z.string().optional(),
    authorizing_official_email: z.string().optional(),
    security_contact: z.string().optional(),
    security_contact_email: z.string().optional(),
    physical_location: z.string().optional(),
    data_types_processed: z.string().optional(),
    users_description: z.string().optional(),
    unedited_controls_mode: z.string().optional(),
    on_premises_details: z.string().optional(),
    cloud_provider: z.string().optional(),
    topology_screenshot: z.string().optional(),
    selected_control_ids: z.string().optional(),
    custom_sections: z.string().optional(),
  }).passthrough(),
});

// Capture viewport schema
export const captureViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  devicePixelRatio: z.number().positive().max(10).optional(),
}).passthrough();

// ============== Device Types Schemas ==============

// Schema for getting device type by icon path
export const deviceTypeIconPathSchema = z.string().min(1).max(500);

// ============== AI Dual-Source Query Schema ==============

export const queryDualSourceSchema = z.object({
  userId: z.string().min(1).max(500),
  queryEmbedding: z.array(z.number()),
  topK: z.number().int().positive().max(100).optional(),
  searchScope: z.enum(['user', 'shared', 'both']).optional(),
});

// ============== Console Log Schema (for console-log IPC) ==============

export const consoleLogSchema = z.object({
  level: z.enum(['log', 'warn', 'error', 'info', 'debug']),
  args: z.array(z.unknown()),
});

// ============== Delete Project Schema ==============

export const deleteProjectSchema = projectIdSchema;

// ============== Load Diagram Schema ==============

export const loadDiagramSchema = projectIdSchema;

// ============== Load Control Narratives Schema ==============

export const loadControlNarrativesSchema = projectIdSchema;

// ============== Get SSP Metadata Schema ==============

export const getSSPMetadataSchema = projectIdSchema;

// ============== Validation Functions ==============

/**
 * Validate IPC input with sanitization and throw descriptive error if invalid
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @param {string} handlerName - Name of the IPC handler for error messages
 * @returns {unknown} Validated, parsed, and sanitized data
 */
export function validateIpcInput(schema, data, handlerName) {
  // Step 1: Check input size to prevent DoS
  try {
    checkInputSize(data, handlerName);
  } catch (sizeError) {
    throw new Error(`IPC validation failed for ${handlerName}: ${sizeError.message}`);
  }

  // Step 2: Sanitize input before validation
  const sanitizedData = sanitizeObject(data);

  // Step 3: Validate against schema
  const result = schema.safeParse(sanitizedData);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errors = issues.map(e => `${e.path?.join('.') || 'root'}: ${e.message}`).join(', ');
    throw new Error(`IPC validation failed for ${handlerName}: ${errors}`);
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
        const errors = issues.map(e => `${e.path?.join('.') || 'root'}: ${e.message}`).join(', ');
        throw new Error(`IPC validation failed for ${handlerName}: ${errors}`);
      }

      // Call the actual handler with validated data
      return await handler(event, result.data);
    } catch (error) {
      // Log validation errors for monitoring
      console.error(`[IPC Validation] Error in ${handlerName}:`, error.message);
      throw error;
    }
  };
}

/**
 * Validates that a value is a valid project ID (positive integer)
 * @param {unknown} value - Value to validate
 * @param {string} handlerName - Handler name for error messages
 * @returns {number} Validated project ID
 */
export function validateProjectId(value, handlerName) {
  // Handle both raw number and object with projectId
  const id = typeof value === 'object' && value !== null && 'projectId' in value
    ? value.projectId
    : value;

  const result = projectIdSchema.safeParse(id);
  if (!result.success) {
    throw new Error(`IPC validation failed for ${handlerName}: Invalid project ID`);
  }
  return result.data;
}
