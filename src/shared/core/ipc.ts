/**
 * Shared IPC Utilities
 *
 * Common response formatting and error handling patterns for IPC communication.
 * Used by both main process handlers and renderer process callers.
 */

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard IPC success response
 */
export interface IPCSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Standard IPC error response
 */
export interface IPCErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Union type for all IPC responses
 */
export type IPCResponse<T = unknown> = IPCSuccessResponse<T> | IPCErrorResponse;

/**
 * Canceled operation response
 */
export interface IPCCanceledResponse {
  success: false;
  canceled: true;
}

// ============================================================================
// Response Factories
// ============================================================================

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): IPCSuccessResponse<T> {
  const response: IPCSuccessResponse<T> = { success: true };
  if (data !== undefined) response.data = data;
  if (message) response.message = message;
  return response;
}

/**
 * Create an error response
 */
export function createErrorResponse(
  error: string | Error,
  code?: string,
  details?: unknown
): IPCErrorResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  const response: IPCErrorResponse = {
    success: false,
    error: errorMessage,
  };
  if (code) response.code = code;
  if (details !== undefined) response.details = details;
  return response;
}

/**
 * Create a canceled response
 */
export function createCanceledResponse(): IPCCanceledResponse {
  return { success: false, canceled: true };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response is successful
 */
export function isSuccessResponse<T>(
  response: IPCResponse<T>
): response is IPCSuccessResponse<T> {
  return response.success === true;
}

/**
 * Check if response is an error
 */
export function isErrorResponse(
  response: IPCResponse
): response is IPCErrorResponse {
  return response.success === false && 'error' in response;
}

/**
 * Check if response was canceled
 */
export function isCanceledResponse(
  response: unknown
): response is IPCCanceledResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'canceled' in response &&
    (response as IPCCanceledResponse).canceled === true
  );
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard IPC error codes
 */
export const IPCErrorCodes = {
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // License errors
  LICENSE_INVALID: 'LICENSE_INVALID',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  LICENSE_NOT_FOUND: 'LICENSE_NOT_FOUND',

  // AI/Model errors
  MODEL_NOT_LOADED: 'MODEL_NOT_LOADED',
  INFERENCE_ERROR: 'INFERENCE_ERROR',
  CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',

  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  OPERATION_CANCELED: 'OPERATION_CANCELED',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type IPCErrorCode = (typeof IPCErrorCodes)[keyof typeof IPCErrorCodes];

// ============================================================================
// Handler Utilities
// ============================================================================

/**
 * Wrap an async function with standard error handling
 * Returns a function that catches errors and returns proper IPC responses
 */
export function withErrorHandling<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  handlerName: string
): (...args: Args) => Promise<IPCResponse<T>> {
  return async (...args: Args): Promise<IPCResponse<T>> => {
    try {
      const result = await fn(...args);
      return createSuccessResponse(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`[IPC] ${handlerName} error:`, error);
      return createErrorResponse(
        errorMessage,
        IPCErrorCodes.INTERNAL_ERROR,
        { handler: handlerName }
      );
    }
  };
}

/**
 * Log format for IPC operations
 */
export function formatIPCLog(
  channel: string,
  operation: 'call' | 'success' | 'error',
  details?: string
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[IPC][${timestamp}]`;
  const opLabel = operation === 'error' ? 'ERROR' : operation.toUpperCase();

  if (details) {
    return `${prefix} ${channel} ${opLabel}: ${details}`;
  }
  return `${prefix} ${channel} ${opLabel}`;
}

// ============================================================================
// Data Sanitization
// ============================================================================

/**
 * Remove non-serializable properties from an object for IPC transfer
 */
export function sanitizeForIPC<T extends object>(
  obj: T,
  removeKeys: string[] = []
): Partial<T> {
  const defaultRemoveKeys = ['_internal', '_cache', '__proto__'];
  const allRemoveKeys = new Set([...defaultRemoveKeys, ...removeKeys]);

  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip keys that should be removed
    if (allRemoveKeys.has(key)) continue;

    // Skip functions
    if (typeof value === 'function') continue;

    // Skip symbols
    if (typeof value === 'symbol') continue;

    // Skip undefined
    if (value === undefined) continue;

    // Handle nested objects
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        // Sanitize array elements
        (sanitized as Record<string, unknown>)[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? sanitizeForIPC(item as object, removeKeys)
            : item
        );
      } else {
        // Recursively sanitize nested objects
        (sanitized as Record<string, unknown>)[key] = sanitizeForIPC(
          value as object,
          removeKeys
        );
      }
    } else {
      // Copy primitive values
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize nodes for export (remove React Flow internal properties)
 */
export function sanitizeNodesForExport<
  T extends { data?: Record<string, unknown> }
>(nodes: T[]): T[] {
  return nodes.map((node) => {
    const sanitized = { ...node };
    if (sanitized.data) {
      sanitized.data = sanitizeForIPC(sanitized.data, [
        'onConnect',
        'onNodeClick',
        'onEdgeClick',
        'selected',
        'dragging',
      ]);
    }
    return sanitized;
  });
}

/**
 * Sanitize edges for export (remove React Flow internal properties)
 */
export function sanitizeEdgesForExport<T extends object>(edges: T[]): T[] {
  return edges.map((edge) =>
    sanitizeForIPC(edge, ['selected', 'animated']) as T
  );
}
